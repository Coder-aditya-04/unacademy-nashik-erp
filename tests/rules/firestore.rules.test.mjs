// Run: npm run test:rules
// Needs Java (firebase-tools and @firebase/rules-unit-testing are devDependencies).
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, writeBatch, collection, query, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-erp', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8080 } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'users', 'staff1'), { role: 'COUNSELOR', centerId: 'UN_COLLEGE', verified: true, email: 'a@x' });
  await setDoc(doc(db, 'users', 'pending1'), { role: 'COUNSELOR', verified: false });
  await setDoc(doc(db, 'users', 'metadata_bde_list'), { list: ['A'] });
  await setDoc(doc(db, 'users', 'mgr1'), { role: 'MANAGER', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'users', 'dir1'), { role: 'DIRECTOR', verified: true });
  await setDoc(doc(db, 'users', 'pending2'), { role: 'COUNSELOR', centerId: 'UN_COLLEGE', verified: false });
  await setDoc(doc(db, 'users', 'pending3'), { role: 'RECOVERY', centerId: 'UN_NASHIK_RD', verified: false });
  await setDoc(doc(db, 'users', 'staff3'), { role: 'COUNSELOR', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'users', 'staff2'), { role: 'COUNSELOR', centerId: 'UN_NASHIK_RD', verified: true });
  await setDoc(doc(db, 'users', 'acc1'), { role: 'ACCOUNTANT', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'users', 'rec1'), { role: 'RECOVERY', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'leads', 'l1'), { phone: '9876500000', centerId: 'UN_COLLEGE', status: 'NEW', assignedTo: 'staff1' });
  await setDoc(doc(db, 'admissions', 'a1'), { status: 'TOKEN_PAID', centerId: 'UN_COLLEGE', bookedById: 'staff1', amount: 100000, totalPaid: 5000 });
  await setDoc(doc(db, 'admissions', 'r1'), { status: 'PENDING_APPROVAL', centerId: 'UN_COLLEGE', bookedById: 'staff1' });
  await setDoc(doc(db, 'admissions', 'r2'), { status: 'PENDING_APPROVAL', centerId: 'UN_COLLEGE', bookedById: 'staff1' });
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
const rec = env.authenticatedContext('rec1').firestore();
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

// Recovery desk: reads every admission, logs calls and promises, nothing else
await t('recovery reads an admission of its centre', getDoc(doc(rec, 'admissions', 'a1')), true);
await t('recovery lists its centre\'s admissions', getDocs(query(collection(rec, 'admissions'), where('centerId', '==', 'UN_COLLEGE'))), true);
await t('recovery cannot read another centre\'s admission', getDoc(doc(rec, 'admissions', 'a2')), false);
// Listing the whole collection is still allowed for any verified staff (known gap, see the scoped-queries work).
await t('recovery cannot log a call on another centre', updateDoc(doc(rec, 'admissions', 'a2'), { lastContactAt: new Date() }), false);
await t('recovery logs a call with a promised date', updateDoc(doc(rec, 'admissions', 'a1'), { recoveryTimeline: [{ type: 'CALL', outcome: 'PROMISED' }], lastContactAt: new Date(), promisedDate: '2026-12-01', promisedAmount: 20000, nextPaymentDate: '2026-12-01', reminderSetBy: 'Rec' }), true);
await t('recovery cannot change totalPaid', updateDoc(doc(rec, 'admissions', 'a1'), { totalPaid: 100000 }), false);
await t('recovery cannot change payments', updateDoc(doc(rec, 'admissions', 'a1'), { payments: [] }), false);
await t('recovery cannot change status', updateDoc(doc(rec, 'admissions', 'a1'), { status: 'COMPLETED' }), false);
await t('recovery cannot change fee amount', updateDoc(doc(rec, 'admissions', 'a1'), { amount: 1 }), false);
await t('recovery cannot change student contact details', updateDoc(doc(rec, 'admissions', 'a1'), { phone: '9000000000' }), false);
await t('recovery cannot create an admission', setDoc(doc(rec, 'admissions', 'x9'), { status: 'TOKEN_PAID', bookedById: 'rec1', centerId: 'UN_COLLEGE' }), false);
await t('recovery cannot delete an admission', deleteDoc(doc(rec, 'admissions', 'a1')), false);
// Manager adds and approves staff (e.g. Recovery) for their own centre only
await t('manager adds a recovery user for own centre', setDoc(doc(mgr, 'users', 'rec2'), { role: 'RECOVERY', centerId: 'UN_COLLEGE', verified: true }), true);
await t('manager cannot add a user for another centre', setDoc(doc(mgr, 'users', 'rec3'), { role: 'RECOVERY', centerId: 'UN_NASHIK_RD', verified: true }), false);
await t('manager cannot approve a user of another centre', updateDoc(doc(mgr, 'users', 'pending3'), { verified: true }), false);
await t('director approves a recovery user anywhere', updateDoc(doc(dir, 'users', 'pending3'), { verified: true }), true);
await t('recovery cannot reserve a roll number', setDoc(doc(rec, 'counters', 'roll_11126'), { next: 99 }), false);
await t('recovery cannot add a lead', addDoc(collection(rec, 'leads'), { phone: '9876543299', status: 'NEW', centerId: 'UN_COLLEGE' }), false);
await t('recovery cannot edit a lead', updateDoc(doc(rec, 'leads', 'l1'), { status: 'CONVERTED' }), false);
await t('recovery cannot file a discount request', addDoc(collection(rec, 'approvals'), { status: 'PENDING', requestedById: 'rec1' }), false);
await t('recovery cannot change own role', updateDoc(doc(rec, 'users', 'rec1'), { role: 'DIRECTOR' }), false);
await t('counsellor still edits own-centre lead', updateDoc(doc(staff, 'leads', 'l1'), { status: 'FOLLOW_UP' }), true);

// Academic year setting: Director only
await t('manager cannot change the academic year start', setDoc(doc(mgr, 'settings', 'academic_year'), { month: 6, day: 1 }), false);
await t('director sets the academic year start', setDoc(doc(dir, 'settings', 'academic_year'), { month: 12, day: 1 }), true);
await t('staff read the academic year start', getDoc(doc(staff, 'settings', 'academic_year')), true);
await t('accounts sets hostel fees', setDoc(doc(acc, 'settings', 'hostel_fees'), { deposit: 15000 }), true);
await t('director sets hostel fees', setDoc(doc(dir, 'settings', 'hostel_fees'), { deposit: 15000 }), true);
await t('manager cannot change hostel fees', setDoc(doc(mgr, 'settings', 'hostel_fees'), { deposit: 1 }), false);
await t('counsellor cannot change hostel fees', setDoc(doc(staff, 'settings', 'hostel_fees'), { deposit: 1 }), false);
await t('staff read hostel fees', getDoc(doc(staff, 'settings', 'hostel_fees')), true);
await t('accounts cannot change other settings', setDoc(doc(acc, 'settings', 'academic_year'), { month: 1, day: 1 }), false);
await t('accountant uses the next session roll counter', setDoc(doc(acc, 'counters', 'roll_11127'), { next: 1 }), true);

// Personal day plan
await t('staff saves own day plan', setDoc(doc(staff, 'users', 'staff1', 'planner', '2026-11-15'), { items: [{ id: '1', text: 'Call parents' }] }), true);
await t('staff reads own day plan', getDoc(doc(staff, 'users', 'staff1', 'planner', '2026-11-15')), true);
await t('others cannot read a day plan', getDoc(doc(mgr, 'users', 'staff1', 'planner', '2026-11-15')), false);
await t('others cannot write a day plan', setDoc(doc(staff2, 'users', 'staff1', 'planner', '2026-11-15'), { items: [] }), false);

// Roll numbers: reservation and admission must be written together
const assign = (fs, adm, roll, extra = {}) => { const b = writeBatch(fs); b.set(doc(fs, 'roll_numbers', roll), { admissionId: adm }); b.update(doc(fs, 'admissions', adm), { rollNumber: roll, status: 'ACTIVE', ...extra }); return b.commit(); };
await t('accountant assigns a reserved roll', assign(acc, 'r1', '111260001'), true);
await t('roll already reserved for another student is refused', assign(acc, 'r2', '111260001'), false);
await t('roll set on admission without a reservation is refused', updateDoc(doc(acc, 'admissions', 'r2'), { rollNumber: '111260002' }), false);
await t('reservation without the admission taking it is refused', setDoc(doc(acc, 'roll_numbers', '111260003'), { admissionId: 'r2' }), false);
await t('badly formed roll refused', assign(acc, 'r2', '99926000'), false);
await t('counsellor cannot assign a roll', assign(staff2, 'a2', '110260001'), false);
await t('counsellor cannot bump the roll counter', setDoc(doc(staff2, 'counters', 'roll_11026'), { next: 5 }), false);
await t('accountant bumps the roll counter', setDoc(doc(acc, 'counters', 'roll_11126'), { next: 2 }), true);
await t('other admission fields still editable by accountant', updateDoc(doc(acc, 'admissions', 'r1'), { amount: 120000 }), true);
await t('reservation cannot be moved to another admission', updateDoc(doc(acc, 'roll_numbers', '111260001'), { admissionId: 'r2' }), false);
await t('centre transfer keeps the roll (no reservation write needed)', updateDoc(doc(dir, 'admissions', 'r1'), { centerId: 'PRAYAS', centerName: 'Prayaas Education', batchAssigned: null, batchId: null, batchName: null }), true);
await env.withSecurityRulesDisabled(async (c) => { const a = (await getDoc(doc(c.firestore(), 'admissions', 'r1'))).data(); r.push((a.rollNumber === '111260001' && a.centerId === 'PRAYAS' ? 'PASS' : 'FAIL') + ' transfer left rollNumber unchanged'); });
// Telecalling
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'users', 'tc1'), { role: 'TELECALLER', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'users', 'tc2'), { role: 'TELECALLER', centerId: 'UN_COLLEGE', verified: true });
  await setDoc(doc(db, 'tele_leads', 't1'), { phone: '9000000001', centerId: 'UN_COLLEGE', assignedTo: 'tc1', stage: 'NEW', callCount: 0 });
  await setDoc(doc(db, 'tele_leads', 't2'), { phone: '9000000002', centerId: 'UN_NASHIK_RD', assignedTo: null, stage: 'NEW' });
  await setDoc(doc(db, 'calls', 'c1'), { byUid: 'tc1', centerId: 'UN_COLLEGE', talkSeconds: 0 });
});
const tc1 = env.authenticatedContext('tc1').firestore();
const tc2 = env.authenticatedContext('tc2').firestore();
await t('manager uploads a lead for own centre', setDoc(doc(mgr, 'tele_leads', 't3'), { phone: '9000000003', centerId: 'UN_COLLEGE', assignedTo: null }), true);
await t('manager cannot upload for another centre', setDoc(doc(mgr, 'tele_leads', 't4'), { phone: '9000000004', centerId: 'UN_NASHIK_RD' }), false);
await t('telecaller cannot upload leads', setDoc(doc(tc1, 'tele_leads', 't5'), { phone: '9000000005', centerId: 'UN_COLLEGE' }), false);
await t('manager allocates a lead', updateDoc(doc(mgr, 'tele_leads', 't3'), { assignedTo: 'tc2', assignedToName: 'B' }), true);
await t('telecaller reads own allocated leads', getDocs(query(collection(tc1, 'tele_leads'), where('assignedTo', '==', 'tc1'))), true);
await t('telecaller cannot list the whole pool', getDocs(collection(tc1, 'tele_leads')), false);
await t('telecaller cannot read someone else\'s lead', getDoc(doc(tc2, 'tele_leads', 't1')), false);
await t('telecaller logs a call result on own lead', updateDoc(doc(tc1, 'tele_leads', 't1'), { stage: 'WARM', lastResult: 'CONNECTED', callCount: 1 }), true);
await t('telecaller cannot hand a lead to someone else', updateDoc(doc(tc1, 'tele_leads', 't1'), { assignedTo: 'tc2' }), false);
await t('telecaller cannot edit the phone number', updateDoc(doc(tc1, 'tele_leads', 't1'), { phone: '9111111111' }), false);
await t('telecaller rates own lead hot with stars', updateDoc(doc(tc1, 'tele_leads', 't1'), { temperature: 'HOT', stars: 4 }), true);
await t('telecaller cannot rate someone else\'s lead', updateDoc(doc(tc2, 'tele_leads', 't1'), { temperature: 'COLD' }), false);
await t('telecaller records own call', addDoc(collection(tc1, 'calls'), { byUid: 'tc1', centerId: 'UN_COLLEGE', result: 'CONNECTED' }), true);
await t('telecaller cannot record a call as someone else', addDoc(collection(tc1, 'calls'), { byUid: 'tc2', centerId: 'UN_COLLEGE' }), false);
await t('telecaller attaches recording to own call', updateDoc(doc(tc1, 'calls', 'c1'), { recordingPath: 'rec/c1.m4a' }), true);
await t('telecaller cannot change call result later', updateDoc(doc(tc1, 'calls', 'c1'), { result: 'CONNECTED' }), false);
await t('other telecaller cannot read the call', getDoc(doc(tc2, 'calls', 'c1')), false);
await t('manager reads centre calls', getDocs(query(collection(mgr, 'calls'), where('centerId', '==', 'UN_COLLEGE'))), true);
await t('recovery cannot log calls on tele leads', addDoc(collection(rec, 'calls'), { byUid: 'rec1', centerId: 'UN_COLLEGE' }), false);
await t('manager creates an upload record', addDoc(collection(mgr, 'lead_uploads'), { centerId: 'UN_COLLEGE', fileName: 'a.csv' }), true);
await t('telecaller cannot see uploads', getDocs(query(collection(tc1, 'lead_uploads'), where('centerId', '==', 'UN_COLLEGE'))), false);
console.log(r.join('\n'));
if (r.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
await env.cleanup();
