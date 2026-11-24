// In-app message sheet that replaces window.alert / window.confirm, which show
// as plain system popups inside the Android app.
//   const { ask, sheet } = useAsk();
//   await ask({ title, body });                          // message, one button
//   if (!(await ask({ title, body, ok: 'Save anyway', cancel: 'Go back' }))) return;
// Render {sheet} once in the component.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layer } from './index';

const TONE = { warn: 'var(--t-coral)', info: 'var(--t-blue)', ok: 'var(--t-sage)' };

export const useAsk = () => {
    const [q, setQ] = useState(null);
    const done = useRef(null);
    const okRef = useRef(null);
    const ask = useCallback((opts) => new Promise((resolve) => {
        done.current = resolve;
        setQ(typeof opts === 'string' ? { title: opts } : opts);
    }), []);
    const close = (v) => { const r = done.current; done.current = null; setQ(null); r?.(v); };
    useEffect(() => {
        if (!q) return undefined;
        okRef.current?.focus();
        const esc = (e) => { if (e.key === 'Escape') close(false); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [q]);

    const sheet = q ? (
        <Layer>
            <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-3 sm:p-4" style={{ background: 'rgba(29,42,34,.45)' }} onClick={() => close(false)}>
                <div role="alertdialog" aria-modal="true" aria-labelledby="ask-title" onClick={(e) => e.stopPropagation()}
                    className="jb-rise w-full max-w-md rounded-[24px] p-5" style={{ background: 'var(--panel)', color: 'var(--ink)', boxShadow: '0 24px 60px rgba(29,42,34,.25)' }}>
                    <div className="rounded-2xl p-4" style={{ background: TONE[q.tone || 'warn'] }}>
                        <b id="ask-title" className="block text-[16px]">{q.emoji || '⚠️'} {q.title}</b>
                        {q.body && <p className="text-[13.5px] mt-1 whitespace-pre-line">{q.body}</p>}
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
                        {q.cancel && <button type="button" onClick={() => close(false)} className="jb-act jb-act-soft justify-center !py-3">{q.cancel}</button>}
                        <button ref={okRef} type="button" onClick={() => close(true)} className="jb-act jb-act-ink justify-center !py-3">{q.ok || 'OK'}</button>
                    </div>
                </div>
            </div>
        </Layer>
    ) : null;
    return { ask, sheet };
};
