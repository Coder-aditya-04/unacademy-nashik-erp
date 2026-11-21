// Calling queue for a telecaller (web now, the ERP Android app next).
// Next lead on top, one tap to call from the phone's SIM, then a quick
// after-call sheet: result, stage, call-back time, note. Then the next lead.
// Until the Android app reads the call log, talk time is estimated from the
// time spent away from the page during the call, and labelled as such.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Empty, Tile, Count, Contact, Layer } from '../../components/j';
import { useToast } from '../../components/j/context';
import { toMs, dayStart } from '../../components/j/util';
import { dateLabel, timeLabel, ago, programLabel } from '../j/data';
import { subscribeMyQueue, subscribeCalls, logCall } from '../../services/teleService';
import { STAGE, STAGES, RESULTS, RESULT } from './constants';

const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const mins = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.round(s / 60)}m`);

// Order: call-backs that are due, then never-called leads, then the rest (oldest call first).
const orderQueue = (leads, now) => {
    const today = ymd(now); const nowKey = `${today} ${new Date(now).toTimeString().slice(0, 5)}`;
    const open = leads.filter(l => STAGE[l.stage || 'NEW']?.open !== false);
    const due = (l) => l.nextFollowUp && (l.nextFollowUp.length <= 10 ? l.nextFollowUp <= today : l.nextFollowUp <= nowKey);
    const calledToday = (l) => (toMs(l.lastCallAt) || 0) >= dayStart(now);
    const a = open.filter(due).sort((x, y) => String(x.nextFollowUp).localeCompare(String(y.nextFollowUp)));
    const b = open.filter(l => !due(l) && !l.callCount).sort((x, y) => (toMs(x.createdAt) || 0) - (toMs(y.createdAt) || 0));
    const c = open.filter(l => !due(l) && l.callCount && !calledToday(l) && !l.nextFollowUp).sort((x, y) => (toMs(x.lastCallAt) || 0) - (toMs(y.lastCallAt) || 0));
    const later = open.filter(l => !due(l) && l.callCount && (calledToday(l) || l.nextFollowUp));
    return { queue: [...a, ...b, ...c], due: a.length, fresh: b.length, later };
};

const AfterCall = ({ lead, started, onClose, onSaved, user }) => {
    const toast = useToast();
    const [secs] = useState(() => (started ? Math.max(0, Math.round((Date.now() - started) / 1000) - 8) : 0));
    const [result, setResult] = useState(secs >= 20 ? 'CONNECTED' : 'NO_ANSWER');
    const [stage, setStage] = useState(lead.stage === 'NEW' && secs < 20 ? 'DNP' : (lead.stage || 'NEW'));
    const [day, setDay] = useState('');
    const [time, setTime] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const needsDate = result === 'CALL_LATER' || ['VISIT_SCHEDULED', 'VISIT_RESCHEDULED'].includes(stage);

    const save = async () => {
        if (needsDate && !day) { toast('📅', 'Pick the call-back or visit date'); return; }
        setBusy(true);
        try {
            const r = await logCall(lead, {
                result, stage, note: note.trim(), talkSeconds: result === 'CONNECTED' ? secs : 0, talkSource: 'estimate',
                startedAt: started || Date.now(), nextFollowUp: day ? `${day}${time ? ` ${time}` : ''}` : null,
            }, user);
            toast(r.promotedLeadId ? '🔥' : '✅', r.promotedLeadId ? `${lead.studentName} sent to the Admissions board` : 'Call saved');
            onSaved();
        } catch (e) { console.error(e); toast('⚠️', 'Could not save. Check the connection and try again.'); }
        setBusy(false);
    };

    const chip = (on) => `jb-act ${on ? 'jb-act-ink' : 'jb-act-line'}`;
    return (
        <Layer>
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ background: 'rgba(20,28,24,.35)' }} onClick={onClose}>
                <div className="jb-card jb-rise w-full sm:max-w-[560px] max-h-[92vh] overflow-y-auto" style={{ padding: 20, borderRadius: '24px 24px 0 0' }} onClick={e => e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="jb-h text-[19px]">How did the call go?</h2>
                            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{lead.studentName} · {secs ? `about ${mins(secs)} away from the page` : 'logged by hand'}</p>
                        </div>
                        <button type="button" onClick={onClose} className="jb-act jb-act-line" aria-label="Close">✕</button>
                    </div>
                    <p className="text-[12px] font-bold mt-4 mb-1.5" style={{ color: 'var(--muted)' }}>CALL RESULT</p>
                    <div className="flex flex-wrap gap-1.5">
                        {RESULTS.map(r => <button key={r.id} type="button" className={chip(result === r.id)} style={{ padding: '7px 11px', fontSize: 13 }} onClick={() => setResult(r.id)}>{r.e} {r.label}</button>)}
                    </div>
                    <p className="text-[12px] font-bold mt-4 mb-1.5" style={{ color: 'var(--muted)' }}>LEAD STAGE</p>
                    <div className="flex flex-wrap gap-1.5">
                        {STAGES.map(s => <button key={s.id} type="button" className={chip(stage === s.id)} style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => setStage(s.id)}>{s.label}</button>)}
                    </div>
                    {STAGE[stage]?.promote && !lead.promotedLeadId && <p className="text-[12.5px] mt-2 rounded-xl px-3 py-2" style={{ background: 'var(--okbg)' }}>🔥 Saving this also puts the lead on the Admissions board for the counsellors.</p>}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        <label className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>{needsDate ? 'DATE *' : 'CALL BACK ON'}
                            <input type="date" value={day} min={ymd(Date.now())} onChange={e => setDay(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2 text-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
                        </label>
                        <label className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>TIME
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2 text-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
                        </label>
                    </div>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Note, e.g. Wants NEET 2 year, will visit with father on Sunday"
                        className="mt-3 w-full rounded-xl px-3 py-2 text-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
                    <button type="button" disabled={busy} onClick={save} className="jb-act jb-act-ink w-full justify-center mt-3" style={{ padding: '12px', fontSize: 15 }}>{busy ? 'Saving…' : 'Save and next lead →'}</button>
                </div>
            </div>
        </Layer>
    );
};

const TeleQueue = ({ userProfile }) => {
    const uid = userProfile?.uid;
    const [leads, setLeads] = useState(null);
    const [calls, setCalls] = useState([]);
    const [selId, setSelId] = useState(null);
    const [calling, setCalling] = useState(null); // { id, at }
    const [sheet, setSheet] = useState(null); // { lead, started }
    const [now, setNow] = useState(() => Date.now());
    const away = useRef(null);

    useEffect(() => (uid ? subscribeMyQueue(uid, setLeads) : undefined), [uid]);
    useEffect(() => (uid ? subscribeCalls(null, dayStart(Date.now()), setCalls, uid) : undefined), [uid]);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

    const v = useMemo(() => orderQueue(leads || [], now), [leads, now]);
    const cur = v.queue.find(l => l.id === selId) || v.queue[0];

    // When the dialer hands control back, open the after-call sheet.
    useEffect(() => {
        const onVis = () => {
            if (document.hidden) { if (calling) away.current = Date.now(); return; }
            if (calling && away.current) {
                const lead = (leads || []).find(l => l.id === calling.id);
                if (lead) setSheet({ lead, started: calling.at });
                setCalling(null); away.current = null;
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [calling, leads]);

    const stats = useMemo(() => ({
        n: calls.length, conn: calls.filter(c => c.result === 'CONNECTED').length,
        talk: calls.reduce((s, c) => s + (c.talkSeconds || 0), 0), warm: calls.filter(c => STAGE[c.stage]?.promote).length,
    }), [calls]);

    if (leads === null) return <div className="jb-sk h-[480px] rounded-3xl" />;

    const dial = (l) => { setCalling({ id: l.id, at: Date.now() }); away.current = null; };
    const history = (cur?.activity || []).slice().reverse();

    return (
        <div className="space-y-5 max-w-[980px]">
            <div>
                <h1 className="jb-h text-[26px]">Calling queue</h1>
                <p className="jb-sub text-[14px]">{v.queue.length ? `${v.due} call-backs due · ${v.fresh} new leads` : 'Nothing left to call right now'}</p>
            </div>

            <div className="jb-grid4">
                <Tile tone="blue" emoji="📋" title="Left to call" value={<Count value={v.queue.length} />} sub={`${(leads || []).length} leads with you`} />
                <Tile tone="sage" emoji="📞" title="Calls today" value={<Count value={stats.n} />} sub={`${stats.conn} connected`} delay={60} />
                <Tile tone="butter" emoji="⏱️" title="Talk time" value={mins(stats.talk)} sub="Estimated for now" delay={120} />
                <Tile tone="coral" emoji="🔥" title="To Admissions" value={<Count value={stats.warm} />} sub="Interested or visit booked" delay={180} />
            </div>

            {!cur ? (
                <Card><Empty emoji="🎉">Queue done. New leads appear here as soon as your Manager shares them.</Empty></Card>
            ) : (
                <div className="jb-grid21">
                    <Card delay={60}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>{cur.nextFollowUp ? `⏰ CALL-BACK ${cur.nextFollowUp}` : cur.callCount ? `CALLED ${cur.callCount}×` : 'NEW LEAD'}</p>
                                <h2 className="jb-h text-[26px] leading-tight">{cur.studentName}</h2>
                                <p className="text-[14px] tabular-nums" style={{ color: 'var(--sub)' }}>{cur.phone}{cur.parentPhone ? ` · parent ${cur.parentPhone}` : ''}</p>
                            </div>
                            <span className="jb-tag" style={{ background: STAGE[cur.stage || 'NEW'].tone, color: '#fff' }}>{STAGE[cur.stage || 'NEW'].label}</span>
                        </div>
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-[13px]">
                            {[['Class', cur.currentClass], ['Course', programLabel(cur.courseInterest)], ['School', cur.school], ['Board', cur.board], ['UNSAT score', cur.score], ['Rank', cur.rank], ['Area', cur.area], ['Source', cur.source || cur.uploadName], ['Collected by', cur.collectedBy]]
                                .filter(([, x]) => x).map(([k, x]) => <div key={k}><dt style={{ color: 'var(--muted)' }}>{k}</dt><dd className="font-bold break-words">{x}</dd></div>)}
                        </dl>
                        {cur.lastNote && <p className="mt-3 rounded-xl px-3 py-2 text-[13px]" style={{ background: 'var(--cream)' }}>📝 {cur.lastNote}</p>}
                        <div className="flex flex-wrap gap-2 mt-5">
                            <a href={`tel:+91${cur.phone}`} onClick={() => dial(cur)} className="jb-act jb-act-ink" style={{ padding: '13px 22px', fontSize: 16 }}>📞 Call {cur.studentName.split(' ')[0]}</a>
                            {cur.parentPhone && <a href={`tel:+91${cur.parentPhone}`} onClick={() => dial(cur)} className="jb-act jb-act-soft" style={{ padding: '13px 18px', fontSize: 15 }}>📞 Call parent</a>}
                            <Contact name={cur.studentName} phone={cur.phone} who="student" message={`Hello ${cur.studentName.split(' ')[0]}, this is Unacademy Nashik.`} />
                            <button type="button" className="jb-act jb-act-line" onClick={() => setSheet({ lead: cur, started: null })}>✍️ Log a call</button>
                            <button type="button" className="jb-act jb-act-line" onClick={() => { const i = v.queue.indexOf(cur); setSelId(v.queue[(i + 1) % v.queue.length]?.id); }}>Skip ›</button>
                        </div>
                        {calling && <p className="mt-3 text-[13px] font-semibold jb-pulse">On the call… the result sheet opens when you come back.</p>}

                        <p className="text-[12px] font-bold mt-6 mb-2" style={{ color: 'var(--muted)' }}>HISTORY</p>
                        {history.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No calls yet{cur.uploadName ? ` · came from “${cur.uploadName}”` : ''}.</p> : (
                            <ol className="space-y-2">
                                {history.slice(0, 8).map((h, i) => (
                                    <li key={i} className="flex gap-3 text-[13px]">
                                        <span aria-hidden="true">{RESULT[h.result]?.e || '📞'}</span>
                                        <span className="flex-1"><b>{RESULT[h.result]?.label}</b> · {STAGE[h.stage]?.label}{h.talkSeconds ? ` · ${mins(h.talkSeconds)}` : ''}{h.note ? <span className="block" style={{ color: 'var(--sub)' }}>{h.note}</span> : null}</span>
                                        <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>{ago(toMs(h.at))}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Card>

                    <Card title="Up next" sub="Tap one to call it now" delay={120}>
                        <div className="space-y-1.5">
                            {v.queue.slice(0, 12).map(l => (
                                <button key={l.id} type="button" onClick={() => setSelId(l.id)} className="jb-row w-full text-left flex items-center gap-2"
                                    style={{ padding: '8px 10px', borderRadius: 14, background: l.id === cur.id ? 'var(--sage2)' : 'var(--cream)' }}>
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STAGE[l.stage || 'NEW'].tone }} />
                                    <span className="flex-1 min-w-0"><b className="block text-[13px] truncate">{l.studentName}</b>
                                        <span className="block text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>{l.nextFollowUp ? `⏰ ${l.nextFollowUp}` : l.callCount ? `Last call ${ago(toMs(l.lastCallAt))}` : 'New'} · {STAGE[l.stage || 'NEW'].label}</span></span>
                                </button>
                            ))}
                            {v.queue.length > 12 && <p className="text-[12px] px-1" style={{ color: 'var(--muted)' }}>and {v.queue.length - 12} more</p>}
                        </div>
                        {v.later.length > 0 && <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>{v.later.length} leads have a later call-back or were called today.</p>}
                    </Card>
                </div>
            )}

            {calls.length > 0 && (
                <Card title="Today's calls" delay={160}>
                    <div className="space-y-1.5">
                        {calls.slice().sort((a, b) => (toMs(b.startedAt) || 0) - (toMs(a.startedAt) || 0)).slice(0, 15).map(c => (
                            <div key={c.id} className="flex flex-wrap items-center gap-x-3 text-[13px] rounded-xl px-3 py-1.5" style={{ background: 'var(--cream)' }}>
                                <span className="tabular-nums w-16 text-[12px]" style={{ color: 'var(--muted)' }}>{timeLabel(toMs(c.startedAt))}</span>
                                <b>{c.studentName}</b><span>{RESULT[c.result]?.e} {RESULT[c.result]?.label}</span>
                                <span className="jb-tag jb-tag-soft">{STAGE[c.stage]?.label}</span>
                                {c.nextFollowUp && <span className="text-[12px]" style={{ color: 'var(--muted)' }}>⏰ {c.nextFollowUp.length > 10 ? c.nextFollowUp : dateLabel(new Date(c.nextFollowUp).getTime())}</span>}
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {sheet && <AfterCall lead={sheet.lead} started={sheet.started} user={userProfile} onClose={() => setSheet(null)}
                onSaved={() => { setSheet(null); setSelId(null); }} />}
        </div>
    );
};

export default TeleQueue;
