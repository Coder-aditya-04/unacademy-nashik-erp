// Calling from the ERP Android app (Capacitor). In a normal browser these
// fall back to a tel: link and an estimated talk time.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ref, uploadString } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';

const KapPhone = registerPlugin('KapPhone');
export const inApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const tenDigits = (n) => String(n || '').replace(/\D/g, '').slice(-10);

export const ensurePermissions = async () => {
    if (!inApp()) return { call: false, callLog: false, audio: false };
    const p = await KapPhone.permissions();
    if (p.call && p.callLog && p.audio) return p;
    return KapPhone.requestAll();
};

// Places the call. Returns { startedAt, native }.
export const dial = async (number) => {
    const startedAt = Date.now();
    if (inApp()) {
        await ensurePermissions().catch(() => {});
        await KapPhone.dial({ number: `+91${tenDigits(number)}` });
        return { startedAt, native: true };
    }
    window.location.href = `tel:+91${tenDigits(number)}`;
    return { startedAt, native: false };
};

// Real talk time from the phone's call log, or null.
export const talkTimeFromLog = async (number, since) => {
    if (!inApp()) return null;
    try {
        const r = await KapPhone.lastCall({ number: tenDigits(number), since });
        return r.found ? { talkSeconds: Number(r.talkSeconds) || 0, at: r.at, type: r.type } : { talkSeconds: 0, at: null, type: 'NOT_FOUND' };
    } catch (e) {
        console.warn('call log', e);
        return null;
    }
};

const MIME = { m4a: 'audio/mp4', mp3: 'audio/mpeg', amr: 'audio/amr', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', '3gp': 'audio/3gpp' };

// Finds the phone recorder's file for this call and uploads it to
// call_recordings/{uid}/{callId}.{ext}; saves the path on the call.
export const uploadRecording = async ({ callId, number, since, uid }) => {
    if (!inApp() || !callId || !uid) return { uploaded: false, reason: 'not in app' };
    const f = await KapPhone.findRecording({ number: tenDigits(number), since });
    if (!f.found) return { uploaded: false, reason: 'no recording found', looked: f.looked };
    const { base64, name } = await KapPhone.readFile({ path: f.path });
    const ext = (name.split('.').pop() || 'm4a').toLowerCase();
    const path = `call_recordings/${uid}/${callId}.${ext}`;
    await uploadString(ref(storage, path), base64, 'base64', { contentType: MIME[ext] || 'audio/mpeg' });
    await updateDoc(doc(db, 'calls', callId), { recordingPath: path });
    return { uploaded: true, path };
};
