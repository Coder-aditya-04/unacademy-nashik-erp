// Run: npm run test:storage-rules (Firestore + Storage emulators)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const env = await initializeTestEnvironment({
  projectId: 'demo-erp',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});
await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), 'users', 'acc1'), { role: 'ACCOUNTANT', verified: true });
  await setDoc(doc(c.firestore(), 'users', 'pend1'), { role: 'COUNSELOR', verified: false });
  await setDoc(doc(c.firestore(), 'users', 'tc1'), { role: 'TELECALLER', verified: true });
  await setDoc(doc(c.firestore(), 'users', 'tc2'), { role: 'TELECALLER', verified: true });
  await setDoc(doc(c.firestore(), 'users', 'mgr1'), { role: 'MANAGER', verified: true });
  await uploadBytes(ref(c.storage(), 'proofs/adm1/old'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
  await uploadBytes(ref(c.storage(), 'call_recordings/tc1/old.m4a'), new Uint8Array([1]), { contentType: 'audio/mp4' });
  await uploadBytes(ref(c.storage(), 'faculty/photo.png'), new Uint8Array([1]), { contentType: 'image/png' });
});
const acc = env.authenticatedContext('acc1').storage();
const pend = env.authenticatedContext('pend1').storage();
const anon = env.unauthenticatedContext().storage();
const png = (n = 10) => new Uint8Array(n);
const r = [];
const t = async (name, p, ok) => { try { await (ok ? assertSucceeds(p) : assertFails(p)); r.push('PASS ' + name); } catch (e) { r.push('FAIL ' + name + ' ' + e.message); } };

await t('staff uploads an image proof', uploadBytes(ref(acc, 'proofs/adm1/p1'), png(), { contentType: 'image/jpeg' }), true);
await t('staff uploads a PDF proof', uploadBytes(ref(acc, 'proofs/adm1/p2'), png(), { contentType: 'application/pdf' }), true);
await t('staff reads a proof', getBytes(ref(acc, 'proofs/adm1/old')), true);
await t('proof cannot be overwritten', uploadBytes(ref(acc, 'proofs/adm1/old'), png(), { contentType: 'image/png' }), false);
await t('proof cannot be deleted', deleteObject(ref(acc, 'proofs/adm1/old')), false);
await t('wrong file type refused', uploadBytes(ref(acc, 'proofs/adm1/p3'), png(), { contentType: 'text/html' }), false);
await t('file over 5 MB refused', uploadBytes(ref(acc, 'proofs/adm1/p4'), png(5 * 1024 * 1024 + 1), { contentType: 'image/png' }), false);
await t('unverified sign-up cannot read proofs', getBytes(ref(pend, 'proofs/adm1/old')), false);
await t('unverified sign-up cannot upload proofs', uploadBytes(ref(pend, 'proofs/adm1/p5'), png(), { contentType: 'image/png' }), false);
await t('public cannot read proofs', getBytes(ref(anon, 'proofs/adm1/old')), false);
await t('staff cannot write outside proofs/', uploadBytes(ref(acc, 'faculty/new.png'), png(), { contentType: 'image/png' }), false);
await t('signed-in staff read other files', getBytes(ref(acc, 'faculty/photo.png')), true);

const tc1 = env.authenticatedContext('tc1').storage();
const tc2 = env.authenticatedContext('tc2').storage();
const mgr = env.authenticatedContext('mgr1').storage();
await t('telecaller uploads own recording', uploadBytes(ref(tc1, 'call_recordings/tc1/c1.m4a'), png(), { contentType: 'audio/mp4' }), true);
await t('telecaller cannot upload into another folder', uploadBytes(ref(tc1, 'call_recordings/tc2/c2.m4a'), png(), { contentType: 'audio/mp4' }), false);
await t('recording must be audio', uploadBytes(ref(tc1, 'call_recordings/tc1/c3.m4a'), png(), { contentType: 'image/png' }), false);
await t('recording cannot be overwritten', uploadBytes(ref(tc1, 'call_recordings/tc1/old.m4a'), png(), { contentType: 'audio/mp4' }), false);
await t('telecaller hears own recording', getBytes(ref(tc1, 'call_recordings/tc1/old.m4a')), true);
await t('other telecaller cannot hear it', getBytes(ref(tc2, 'call_recordings/tc1/old.m4a')), false);
await t('accountant cannot hear recordings', getBytes(ref(acc, 'call_recordings/tc1/old.m4a')), false);
await t('manager hears recordings', getBytes(ref(mgr, 'call_recordings/tc1/old.m4a')), true);

console.log(r.join('\n'));
if (r.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
await env.cleanup();
