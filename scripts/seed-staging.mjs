// Loads sample data for testing: staff logins, leads, admissions with
// instalments, overdue cases. Safe by default: it refuses to run unless it
// is pointed at the local emulators. Later the same data can be loaded into
// a separate *staging* Firebase project (never the live one) with --project.
//
// Local:
//   npm run emulators            (in one terminal)
//   npm run seed                 (in another)
//   npm run dev:local            (app against the emulators)
//
// All logins use the password Test@1234. Emails: see STAFF below.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { sessionFor } from '../src/utils/academicYear.js';

const LIVE_PROJECT = 'unacademy-nashik-erp';
const argProject = process.argv.find((a) => a.startsWith('--project='))?.split('=')[1];
const projectId = argProject || LIVE_PROJECT;
const onEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

if (!onEmulator && (!argProject || argProject === LIVE_PROJECT)) {
  console.error('Refusing to seed: not on the emulator and no separate staging --project given.');
  console.error('Never seed the live project. Start the emulators and run `npm run seed`.');
  process.exit(1);
}
if (onEmulator && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Set FIREBASE_AUTH_EMULATOR_HOST too (npm run seed does this).');
  process.exit(1);
}

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

const PASSWORD = 'Test@1234';
const STAFF = [
  { uid: 'dir1', email: 'director@test.local', name: 'Test Director', role: 'DIRECTOR', centerId: 'UN_COLLEGE' },
  { uid: 'mgr1', email: 'manager@test.local', name: 'Test Manager', role: 'MANAGER', centerId: 'UN_COLLEGE' },
  { uid: 'acc1', email: 'accounts@test.local', name: 'Test Accountant', role: 'ACCOUNTANT', centerId: 'UN_COLLEGE' },
  { uid: 'rec1', email: 'recovery@test.local', name: 'Test Recovery', role: 'RECOVERY', centerId: 'UN_COLLEGE' },
  { uid: 'c1', email: 'counsellor1@test.local', name: 'Asha Counsellor', role: 'COUNSELLOR', centerId: 'UN_COLLEGE' },
  { uid: 'c2', email: 'counsellor2@test.local', name: 'Rahul Counsellor', role: 'COUNSELLOR', centerId: 'UN_COLLEGE' },
  { uid: 'c3', email: 'counsellor3@test.local', name: 'Neha Counsellor', role: 'COUNSELLOR', centerId: 'UN_NASHIK_RD' },
  { uid: 'fd1', email: 'frontdesk@test.local', name: 'Test Front Desk', role: 'FRONT_DESK', centerId: 'UN_COLLEGE' },
  { uid: 'bde1', email: 'bde@test.local', name: 'Test BDE', role: 'BDE', centerId: 'UN_COLLEGE' },
  { uid: 'tc1', email: 'telecaller1@test.local', name: 'Pooja Telecaller', role: 'TELECALLER', centerId: 'UN_COLLEGE' },
  { uid: 'tc2', email: 'telecaller2@test.local', name: 'Sakshi Telecaller', role: 'TELECALLER', centerId: 'UN_COLLEGE' },
];

// Small deterministic random so every seed gives the same data.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const FIRST = ['Aarav', 'Vihaan', 'Ishita', 'Ananya', 'Kabir', 'Sara', 'Arjun', 'Diya', 'Reyansh', 'Myra', 'Aditi', 'Om', 'Tanvi', 'Yash', 'Riya'];
const LAST = ['Patil', 'Deshmukh', 'Kulkarni', 'Joshi', 'Shinde', 'Pawar', 'Jadhav', 'More', 'Gaikwad', 'Bhosale'];
const PROGRAMS = [
  { key: 'NEET_JEE_1Y', fee: 120000 },
  { key: 'NEET_JEE_2Y', fee: 210000 },
  { key: 'MHT_CET_12', fee: 60000 },
  { key: 'CLASS_10', fee: 85000 },
];
const MODES = ['Cash', 'UPI', 'KAP QR (AXIS)', 'Cheque'];
const DAY = 86400000;
const now = Date.now();
const ts = (msAgo) => Timestamp.fromMillis(now - msAgo);
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const yy = String(new Date().getFullYear()).slice(-2);
const prefix = { UN_COLLEGE: '111', UN_NASHIK_RD: '110', PRAYAS: '112' };

async function wipe() {
  for (const c of ['users', 'leads', 'admissions', 'roll_numbers', 'counters', 'approvals', 'settings', 'batches', 'fee_structures']) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref)));
  }
  const list = await auth.listUsers(1000);
  await Promise.all(list.users.map((u) => auth.deleteUser(u.uid)));
}

async function main() {
  await wipe();

  for (const s of STAFF) {
    await auth.createUser({ uid: s.uid, email: s.email, password: PASSWORD, displayName: s.name });
    await db.doc(`users/${s.uid}`).set({ ...s, id: s.uid, verified: true, isActive: true, createdAt: Timestamp.now() });
  }
  await db.doc('users/metadata_bde_list').set({ records: [{ name: 'Test BDE' }] });
  await db.doc('settings/front_desk').set({ password: 'frontdesk' });
  await db.doc('batches/b1').set({ name: 'NEET Growth 2026', course: 'NEET_JEE_1Y', status: 'ACTIVE', centerId: 'UN_COLLEGE', capacity: 60, totalSeats: 60 });
  await db.doc('batches/b2').set({ name: 'JEE Power 2026', course: 'NEET_JEE_2Y', status: 'UPCOMING', centerId: 'UN_COLLEGE', capacity: 60, totalSeats: 60 });

  const counsellors = STAFF.filter((s) => s.role === 'COUNSELLOR');
  const seq = { UN_COLLEGE: 0, UN_NASHIK_RD: 0, PRAYAS: 0 };
  let leads = 0, admissions = 0, overdue = 0;

  for (let i = 0; i < 60; i++) {
    const c = pick(counsellors);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const phone = String(9000000000 + Math.floor(rnd() * 999999999)).slice(0, 10);
    // A few admissions from last academic year, to try the year picker.
    const createdMs = Math.floor(rnd() * 120) * DAY + (i >= 30 && i < 36 ? 365 * DAY : 0);
    const leadRef = db.collection('leads').doc();
    const converted = i < 36;
    await leadRef.set({
      studentName: name, phone, parentPhone: phone, centerId: c.centerId,
      courseInterest: pick(PROGRAMS).key, status: converted ? 'CONVERTED' : pick(['NEW', 'FOLLOW_UP', 'INTERESTED', 'NOT_INTERESTED']),
      source: pick(['Website', 'MANUAL_ENTRY', 'Walk-in', 'BDE']), assignedTo: c.uid, assignedByName: c.name,
      nextFollowUp: converted ? null : ymd(now + (Math.floor(rnd() * 6) - 2) * DAY),
      nextFollowUpTime: converted || rnd() < 0.3 ? null : `${String(10 + Math.floor(rnd() * 8)).padStart(2, '0')}:${rnd() < 0.5 ? '00' : '30'}`,
      createdAt: ts(createdMs), lastUpdated: ts(createdMs / 2),
      timeline: [{ type: 'NOTE', result: 'Lead created', note: 'Seed data', date: ts(createdMs), by: c.name }],
    });
    leads++;
    if (!converted) continue;

    // Admission with a token, then some instalments; a few are overdue.
    const prog = pick(PROGRAMS);
    const token = pick([5000, 10000, 25000]);
    const payments = [{ amount: token, date: ts(createdMs), mode: pick(MODES), type: 'Token / Booking' }];
    const instCount = Math.floor(rnd() * 3);
    for (let k = 1; k <= instCount; k++) {
      payments.push({ amount: Math.round(prog.fee * 0.3), date: ts(Math.max(0, createdMs - k * 30 * DAY)), mode: pick(MODES), type: 'Installment/Balance' });
    }
    const totalPaid = Math.min(prog.fee, payments.reduce((a, p) => a + p.amount, 0));
    const isOverdue = totalPaid < prog.fee && rnd() < 0.45;
    if (isOverdue) overdue++;
    // Every 7th admission left and took a refund, to try Refunds & dropouts.
    const refunded = i >= 4 && i % 7 === 0;
    if (refunded) payments.push({ amount: -Math.round(token * 0.6), date: ts(Math.max(0, createdMs - 10 * DAY)), mode: 'Bank transfer', type: 'Refund', remarks: pick(['Shifted city', 'Joined another institute', 'Health reasons']) });
    const status = i < 4 ? 'PENDING_APPROVAL' : refunded ? 'REFUNDED' : totalPaid >= prog.fee ? 'COMPLETED' : 'ACTIVE';
    const roll = status === 'PENDING_APPROVAL' ? null : `${prefix[c.centerId]}${yy}${String(++seq[c.centerId]).padStart(4, '0')}`;
    const admRef = db.collection('admissions').doc();
    await admRef.set({
      id: admRef.id, leadId: leadRef.id, studentName: name, phone, parentPhone: phone,
      program: prog.key, standard: prog.key, centerId: c.centerId,
      amount: prog.fee, totalPaid, payments, paymentPlan: 'INSTALLMENT', status,
      counsellorId: c.uid, counsellorName: c.name, bookedById: c.uid, bookedBy: c.name,
      enrollmentDate: ymd(now - createdMs), createdAt: ts(createdMs), updatedAt: ts(createdMs / 2),
      // Half carry the field, half rely on it being derived from the date (like old data).
      ...(i % 2 ? { academicYear: sessionFor(new Date(now - createdMs)).key } : {}),
      nextPaymentDate: totalPaid >= prog.fee ? null : ymd(now + (isOverdue ? -(5 + Math.floor(rnd() * 40)) : 3 + Math.floor(rnd() * 25)) * DAY),
      ...(roll ? { rollNumber: roll } : {}),
      ...(refunded ? { refundAmount: Math.round(token * 0.6) } : {}),
      ...(status !== 'PENDING_APPROVAL' ? { batchAssigned: 'NEET Growth 2026' } : {}),
    });
    if (roll) await db.doc(`roll_numbers/${roll}`).set({ admissionId: admRef.id, centerId: c.centerId, by: 'seed', reservedAt: Timestamp.now() });
    await leadRef.update({ admissionId: admRef.id });
    admissions++;
  }
  for (const [centre, n] of Object.entries(seq)) {
    if (n) await db.doc(`counters/roll_${prefix[centre]}${yy}`).set({ next: n + 1 });
  }

  console.log(`Seeded ${STAFF.length} staff logins, ${leads} leads, ${admissions} admissions (${overdue} overdue).`);
  console.log(`Password for every login: ${PASSWORD}`);
  STAFF.forEach((s) => console.log(`  ${s.role.padEnd(11)} ${s.email}`));
}

await main();
