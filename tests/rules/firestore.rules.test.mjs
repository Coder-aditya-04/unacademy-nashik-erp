// Run: npm run test:rules
// Needs Java (firebase-tools and @firebase/rules-unit-testing are devDependencies).
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-erp', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8080 } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'users', 'staff1'), { role: 'COUNSELOR', centerId: 'UN_COLLEGE', verified: true, email: 'a@x' });
  await setDoc(doc(db, 'users', 'pending1'), { role: 'COUNSELOR', verified: false });
  await setDoc(doc(db, 'users', 'metadata_bde_list'), { list: ['A'] });
  await setDoc(doc(db, 'users', 'mgr1'), { role: 'MANAGER', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'users', 'dir1'), { role: 'DIRECTOR', verified: true });
  await setDoc(doc(db, 'users', 'pending2'), { role: 'COUNSELOR', verified: false });
  await setDoc(doc(db, 'users', 'staff3'), { role: 'COUNSELOR', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'users', 'staff2'), { role: 'COUNSELOR', centerId: 'UN_NASHIK_RD', verified: true });
  await setDoc(doc(db, 'users', 'acc1'), { role: 'ACCOUNTANT', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'admissions', 'a1'), { status: 'TOKEN_PAID', centerId: 'UN_COLLEGE', bookedById: 'staff1', amount: 100000, totalPaid: 5000 });
  await setDoc(doc(db, 'admissions', 'a2'), { status: 'ACTIVE', centerId: 'UN_NASHIK_RD', bookedById: 'staff2', amount: 100000, totalPaid: 5000 });
  await setDoc(doc(db, 'settings', 'front_desk'), { password: 'secret' });
  await setDoc(doc(db, 'batches', 'b1'), { status: 'UPCOMING', name: 'JEE' });
  await setDoc(doc(db, 'batches', 'b2'), { status: 'CLOSED', name: 'Old' });
});
const anon = env.unauthenticatedContext().firestore();
const staff = env.authenticatedContext('staff1').firestore();
const pending = env.authenticatedContext('pending1').firestore();
const mgr = env.authenticatedContext('mgr1').firestore();
const dir = env.authenticatedContext('dir1').firestore();
const staff2 = env.authenticatedContext('staff2').firestore();
const acc = env.authenticatedContext('acc1').firestore();
const newbie = env.authenticatedContext('newbie').firestore();
const r = [];
const t = async (name, p, ok) => { try { await (ok ? assertSucceeds(p) : assertFails(p)); r.push('PASS ' + name); } catch (e) { r.push('FAIL ' + name + ' ' + e.message); } };
await t('anon cannot read staff profile', getDoc(doc(anon, 'users', 'staff1')), false);
await t('anon cannot list users', getDocs(collection(anon, 'users')), false);
await t('anon can read BDE list', getDoc(doc(anon, 'users', 'metadata_bde_list')), true);
await t('pending user reads own profile', getDoc(doc(pending, 'users', 'pending1')), true);
await t('pending user cannot read others', getDoc(doc(pending, 'users', 'staff1')), false);
await t('staff list users', getDocs(collection(staff, 'users')), true);
await t('anon cannot read front desk password', getDoc(doc(anon, 'settings', 'front_desk')), false);
await t('staff read settings', getDoc(doc(staff, 'settings', 'front_desk')), true);
await t('anon lists upcoming/active batches', getDocs(query(collection(anon, 'batches'), where('status', 'in', ['UPCOMING', 'ACTIVE']))), true);
await t('anon cannot list all batches', getDocs(collection(anon, 'batches')), false);
await t('anon cannot read closed batch', getDoc(doc(anon, 'batches', 'b2')), false);
await t('anon lead missing status/source refused', addDoc(collection(anon, 'leads'), { phone: '9876543210', centerId: 'UN_COLLEGE' }), false);
await t('anon cannot query leads (dup check refused, form now tolerates it)', getDocs(query(collection(anon, 'leads'), where('phone', '==', '9876543210'))), false);
await t('manager approves a pending user', updateDoc(doc(mgr, 'users', 'pending2'), { verified: true }), true);
await t('manager cannot promote self to director', updateDoc(doc(mgr, 'users', 'mgr1'), { role: 'DIRECTOR' }), false);
await t('manager cannot promote others to director (any case)', updateDoc(doc(mgr, 'users', 'staff1'), { role: 'director' }), false);
await t('manager cannot edit a director profile', updateDoc(doc(mgr, 'users', 'dir1'), { verified: false }), false);
await t('manager cannot create a director profile', setDoc(doc(mgr, 'users', 'x1'), { role: 'DIRECTOR', verified: true }), false);
await t('director can promote', updateDoc(doc(dir, 'users', 'staff3'), { role: 'MANAGER' }), true);
await t('self-register as lowercase director refused', setDoc(doc(newbie, 'users', 'newbie'), { role: 'director', verified: false }), false);
await t('self-register as counsellor allowed', setDoc(doc(newbie, 'users', 'newbie'), { role: 'COUNSELLOR', verified: false }), true);

// Approvals: a request starts PENDING, in the requester's own name
await t('staff files a pending discount request', addDoc(collection(staff, 'approvals'), { status: 'PENDING', requestedById: 'staff1', offeredFee: 90000 }), true);
await t('staff cannot file a pre-approved request', addDoc(collection(staff, 'approvals'), { status: 'APPROVED', requestedById: 'staff1' }), false);
await t('staff cannot file a request as someone else', addDoc(collection(staff, 'approvals'), { status: 'PENDING', requestedById: 'staff2' }), false);
// Admissions create
await t('staff books own admission in own centre', setDoc(doc(staff, 'admissions', 'n1'), { status: 'PENDING_APPROVAL', centerId: 'UN_COLLEGE', bookedById: 'staff1', amount: 1, totalPaid: 1 }), true);
await t('staff cannot create an ACTIVE admission', setDoc(doc(staff, 'admissions', 'n2'), { status: 'ACTIVE', centerId: 'UN_COLLEGE', bookedById: 'staff1' }), false);
await t('staff cannot book for another centre', setDoc(doc(staff, 'admissions', 'n3'), { status: 'TOKEN_PAID', centerId: 'UN_NASHIK_RD', bookedById: 'staff1' }), false);
await t('staff cannot book in someone else\'s name', setDoc(doc(staff, 'admissions', 'n4'), { status: 'TOKEN_PAID', centerId: 'UN_COLLEGE', bookedById: 'staff2' }), false);
// Admissions update
await t('staff sets a reminder on own-centre admission', updateDoc(doc(staff, 'admissions', 'a1'), { nextPaymentDate: '2026-12-01', reminderSetBy: 'A' }), true);
await t('staff cannot change totalPaid even on TOKEN_PAID', updateDoc(doc(staff, 'admissions', 'a1'), { totalPaid: 100000 }), false);
await t('staff cannot change status', updateDoc(doc(staff, 'admissions', 'a1'), { status: 'ACTIVE' }), false);
await t('staff cannot touch another centre\'s admission', updateDoc(doc(staff, 'admissions', 'a2'), { nextPaymentDate: '2026-12-01' }), false);
await t('accountant records a payment', updateDoc(doc(acc, 'admissions', 'a2'), { totalPaid: 10000 }), true);
// Leads
await t('website form lead accepted', addDoc(collection(anon, 'leads'), { centerId: 'UN_COLLEGE', studentName: 'Riya', phone: '9876543211', parentPhone: '9876543211', board: 'CBSE', currentClass: '10', courseInterest: 'NEET', source: 'Website', sourceDetails: { role: 'Student', enteredBy: 'Self', location: 'Website Inquiry' }, createdAt: new Date(), status: 'NEW' }), true);
await t('public cannot plant a converted lead', addDoc(collection(anon, 'leads'), { phone: '9876543212', status: 'CONVERTED', source: 'Website' }), false);
await t('public cannot add extra fields', addDoc(collection(anon, 'leads'), { phone: '9876543213', status: 'NEW', source: 'Website', assignedTo: 'staff1' }), false);
await t('public cannot send a huge name', addDoc(collection(anon, 'leads'), { phone: '9876543214', status: 'NEW', source: 'Website', studentName: 'x'.repeat(500) }), false);
await t('staff adds a lead with staff fields', addDoc(collection(staff, 'leads'), { phone: '9876543215', status: 'NEW', assignedTo: 'staff1', centerId: 'UN_COLLEGE', remarks: 'walk-in' }), true);
await t('manager can keep the BDE list', updateDoc(doc(mgr, 'users', 'metadata_bde_list'), { list: ['A', 'B'] }), true);
await t('manager cannot change a staff centre', updateDoc(doc(mgr, 'users', 'staff1'), { centerId: 'PRAYAS' }), false);
console.log(r.join('\n'));
if (r.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
await env.cleanup();
