// Adds `academicYear` (e.g. "2025-26", December to November) to admissions
// saved before the field existed. Only that one field is written; nothing
// else on the admission changes, and counters are not touched. The app
// already derives the year from the dates when the field is missing, so this
// only makes the stored data explicit.
//
// Dry run (default, writes nothing): prints counts per centre and session.
//   GOOGLE_APPLICATION_CREDENTIALS=key.json FIREBASE_PROJECT=<project> node scripts/academic-year-backfill.mjs
// Write run: add --write. On the live project it also needs --live-approved,
// to be used only after Aditya has approved the dry-run numbers.
// Emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/academic-year-backfill.mjs --write
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { admissionSession } from '../src/utils/academicYear.js';

const LIVE = 'unacademy-nashik-erp';
const projectId = process.env.FIREBASE_PROJECT || LIVE;
const onEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const write = process.argv.includes('--write');
if (write && !onEmulator && projectId === LIVE && !process.argv.includes('--live-approved')) {
  console.error('Refusing to write to the live project without --live-approved (needs Aditya\'s approval of the dry run).');
  process.exit(1);
}

initializeApp(onEmulator ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();

const snap = await db.collection('admissions').get();
const counts = new Map();
const missing = [];
snap.docs.forEach((d) => {
  const a = d.data();
  const session = admissionSession(a);
  const key = `${a.centerId || 'NO_CENTRE'}  ${session}`;
  counts.set(key, (counts.get(key) || 0) + 1);
  if (!a.academicYear) missing.push({ ref: d.ref, session });
});

console.log(`${snap.size} admissions; ${missing.length} without academicYear.`);
[...counts.entries()].sort().forEach(([k, n]) => console.log(`  ${k}  ${n}`));

if (!write) {
  console.log('Dry run: nothing written. Add --write to save the field.');
} else {
  for (let i = 0; i < missing.length; i += 400) {
    const batch = db.batch();
    missing.slice(i, i + 400).forEach(({ ref, session }) => batch.update(ref, { academicYear: session }));
    await batch.commit();
  }
  console.log(`Wrote academicYear on ${missing.length} admissions.`);
}
