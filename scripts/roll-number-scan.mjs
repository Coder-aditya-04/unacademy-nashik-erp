// Read-only report on roll numbers in the live `admissions` collection.
// It changes nothing. It lists:
//   - roll numbers held by more than one admission (must be fixed by hand,
//     because the roll is also the KAP Connect enrollment number)
//   - roll numbers not in the 9-digit 110/111/112 format
//   - ACTIVE admissions with no roll number
//   - rolls with no roll_numbers reservation (older rolls; harmless, the
//     app also checks admissions before handing a roll out)
//
// Run with a service account that can read Firestore:
//   npm i --no-save firebase-admin
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/roll-number-scan.mjs
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT || 'unacademy-nashik-erp' });
const db = getFirestore();

const ROLL = /^(110|111|112)\d{6}$/;
const [admissions, reservations] = await Promise.all([
  db.collection('admissions').get(),
  db.collection('roll_numbers').get(),
]);
const reserved = new Map(reservations.docs.map((d) => [d.id, d.data().admissionId]));

const byRoll = new Map();
const badFormat = [];
const activeNoRoll = [];
let unreserved = 0;

for (const d of admissions.docs) {
  const a = d.data();
  const roll = String(a.rollNumber ?? '').trim();
  if (!roll) {
    if (a.status === 'ACTIVE') activeNoRoll.push(`${d.id}  ${a.studentName ?? ''}`);
    continue;
  }
  if (!ROLL.test(roll)) badFormat.push(`${roll}  ${d.id}  ${a.studentName ?? ''}`);
  if (!byRoll.has(roll)) byRoll.set(roll, []);
  byRoll.get(roll).push(`${d.id} (${a.studentName ?? '?'}, ${a.centerId ?? '?'}, ${a.status ?? '?'})`);
  if (reserved.get(roll) !== d.id) unreserved++;
}

const dups = [...byRoll].filter(([, list]) => list.length > 1);
const section = (title, rows) => {
  console.log(`\n${title}: ${rows.length}`);
  rows.slice(0, 200).forEach((r) => console.log('  ' + r));
  if (rows.length > 200) console.log(`  ... and ${rows.length - 200} more`);
};

console.log(`Admissions scanned: ${admissions.size}`);
section('Duplicate roll numbers', dups.map(([roll, list]) => `${roll}: ${list.join(' | ')}`));
section('Badly formatted roll numbers', badFormat);
section('ACTIVE admissions without a roll number', activeNoRoll);
console.log(`\nRolls without a reservation doc (older rolls): ${unreserved}`);
process.exitCode = dups.length ? 1 : 0;
