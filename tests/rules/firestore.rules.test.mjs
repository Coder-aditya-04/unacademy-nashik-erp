// Run: npx firebase emulators:exec --only firestore --project demo-erp "node tests/rules/firestore.rules.test.mjs firestore.rules"
// Needs firebase-tools, @firebase/rules-unit-testing and Java.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-erp', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8080 } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'users', 'staff1'), { role: 'COUNSELOR', centerId: 'UN_COLLEGE', verified: true, email: 'a@x' });
  await setDoc(doc(db, 'users', 'pending1'), { role: 'COUNSELOR', verified: false });
  await setDoc(doc(db, 'users', 'metadata_bde_list'), { list: ['A'] });
  await setDoc(doc(db, 'settings', 'front_desk'), { password: 'secret' });
  await setDoc(doc(db, 'batches', 'b1'), { status: 'UPCOMING', name: 'JEE' });
  await setDoc(doc(db, 'batches', 'b2'), { status: 'CLOSED', name: 'Old' });
});
const anon = env.unauthenticatedContext().firestore();
const staff = env.authenticatedContext('staff1').firestore();
const pending = env.authenticatedContext('pending1').firestore();
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
await t('anon can create lead', addDoc(collection(anon, 'leads'), { phone: '9876543210', centerId: 'UN_COLLEGE' }), true);
await t('anon cannot query leads (dup check refused, form now tolerates it)', getDocs(query(collection(anon, 'leads'), where('phone', '==', '9876543210'))), false);
console.log(r.join('\n'));
await env.cleanup();
