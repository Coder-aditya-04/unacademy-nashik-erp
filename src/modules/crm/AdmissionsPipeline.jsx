// L3 · Admissions pipeline (design canvas board, approved 20 Nov 2026).
// Kanban of enquiries by stage. Dragging moves a card only where that is a
// plain status change (Enquiry ↔ Visited). Quote, Admit and Not joining open
// the existing flows, so fees and roll numbers keep one code path.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subscribeToLeads, addInteraction } from '../../services/leadService';
import { subscribeAdmissions } from '../../services/cacheService';
import { Seg, Tile, Card, Empty, Contact, Avatar, Count, Layer } from '../../components/j';
import { useToast } from '../../components/j/context';
import { lakh, toMs, DAY } from '../../components/j/util';
import { CENTRES, CENTRE_NAME, inCentre, createdMs, rangeFor, inRange, sparkBuckets, phoneOf, programLabel, ago } from '../j/data';
import { normaliseRole } from '../../utils/navItems';
import AddLead from './pages/AddLead';
import { HostelFeesSheet } from '../../components/j/HostelFees';

const COLS = [
    { id: 'ENQ', l: 'Enquiry', c: '#7E9BC0' },
    { id: 'VIS', l: 'Visited', c: '#9C8FD0' },
    { id: 'QUO', l: 'Quote sent', c: '#E2BE4E' },
    { id: 'TOK', l: 'Token paid', c: '#D8734F' },
    { id: 'ADM', l: 'Admitted', c: '#8FAE7B' },
];
const CLOSED = ['NOT_INTERESTED', 'REJECTED', 'LOST', 'CLOSED', 'REFUNDED'];
const REASONS = ['Fees too high', 'Joined another institute', 'Distance or timing', 'Not ready this year', 'Could not reach', 'Other'];

const stageOf = (l, adm) => {
    if (adm) return ['ACTIVE', 'COMPLETED'].includes(adm.status) ? 'ADM' : 'TOK';
    if (['CONVERTED', 'TOKEN_PAID', 'UNDER_VERIFICATION', 'ADMISSION_TAKEN'].includes(l.status)) return 'TOK';
    if (Number(l.budgetQuoted) > 0 || (l.timeline || []).some(t => t.type === 'QUOTE')) return 'QUO';
    if (['VISITED', 'COUNSELLING_DONE'].includes(l.status) || (l.timeline || []).some(t => t.type === 'VISIT')) return 'VIS';
    return 'ENQ';
};
const isHot = (l) => {
    if (l.temperature) return l.temperature === 'HOT'; // a person's rating wins over the guess
    const last = toMs(l.lastUpdated) || createdMs(l) || 0;
    return l.status === 'INTERESTED' || Number(l.budgetQuoted) > 0 && Date.now() - last < 4 * DAY;
};
// Newest timeline line, for the "last thing that happened" text on a card.
const lastEvent = (l) => {
    const t = (l.timeline || []).filter(e => e && e.type !== 'CREATED' && e.type !== 'CHANGE' && !/^Lead created/.test(e.message || ''));
    if (!t.length) return null;
    return t.reduce((a, e) => ((toMs(e.date) || 0) >= (toMs(a.date) || 0) ? e : a));
};
const lastText = (l) => { const e = lastEvent(l); return e ? (e.result || e.note || e.message || '') : (l.source ? `Enquiry from ${String(l.source).replace(/_/g, ' ').toLowerCase()}` : 'New enquiry'); };
// Pastel fills for funnel bars and source share, dots in the stronger colour.
const SOFT = ['var(--t-blue)', 'var(--t-lilac)', 'var(--t-butter)', 'var(--t-coral)', 'var(--t-sage)'];
const SRC_BAR = ['#9DB58A', '#C5D3E3', '#F0E1A8', '#F2C3B0', '#D4CDEB', '#D9DED6'];
const SRC_DOT = ['#8FAE7B', '#7E9BC0', '#E2BE4E', '#D8734F', '#9C8FD0', '#B9C3BC'];
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Reason sheet for "Not joining": keeps the history, asks why.
const NotJoining = ({ lead, onClose, onDone }) => {
    const [why, setWhy] = useState(REASONS[0]);
    const [note, setNote] = useState('');
    return (
        <Layer>
            <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-[70] shell-fade" style={{ background: 'rgba(17,25,21,.32)' }} />
            <div role="dialog" aria-modal="true" aria-label="Not joining" className="fixed z-[71] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[420px] rounded-[24px] p-6 shell-fade"
                style={{ background: 'var(--panel)', color: 'var(--ink)', boxShadow: '0 30px 70px rgba(29,42,34,.25)' }}>
                <p className="text-[18px] font-extrabold">🗑️ {lead.studentName} is not joining</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>The enquiry and its history stay. You can bring it back later.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                    {REASONS.map(r => (
                        <button key={r} type="button" aria-pressed={why === r} onClick={() => setWhy(r)} className="jb-act"
                            style={{ background: why === r ? 'var(--ink)' : 'var(--cream2)', color: why === r ? 'var(--on-ink)' : 'var(--ink)' }}>{r}</button>
                    ))}
                </div>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Note (optional)" aria-label="Note" className="w-full mt-3 px-3 py-2 rounded-xl border text-[14px]" />
                <div className="flex gap-2 mt-3">
                    <button type="button" className="jb-act jb-act-line flex-1 justify-center" onClick={onClose}>Cancel</button>
                    <button type="button" className="jb-act jb-act-ink flex-1 justify-center" onClick={() => onDone(why, note)}>Save</button>
                </div>
            </div>
        </Layer>
    );
};

const AdmissionsPipeline = ({ userProfile, onList }) => {
    const navigate = useNavigate();
    const toast = useToast();
    const role = normaliseRole(userProfile?.role);
    const seesAll = role === 'DIRECTOR';
    const [leads, setLeads] = useState(null);
    const [hostel, setHostel] = useState(false);
    const [admissions, setAdmissions] = useState([]);
    const [centre, setCentre] = useState(seesAll ? 'ALL' : (userProfile?.centerId || 'ALL'));
    const [mine, setMine] = useState(role === 'COUNSELLOR' ? 'MINE' : 'ALL');
    const [drag, setDrag] = useState(null);
    const [over, setOver] = useState(null);
    const [moved, setMoved] = useState({});
    const [drop, setDrop] = useState(null);
    const [src, setSrc] = useState(null);
    const [adding, setAdding] = useState(false);

    useEffect(() => subscribeToLeads(userProfile, (d) => setLeads(Array.isArray(d) ? d : [])), [userProfile]);
    useEffect(() => {
        if (!['DIRECTOR', 'MANAGER', 'ACCOUNTANT'].includes(role)) return undefined;
        return subscribeAdmissions(role === 'DIRECTOR' ? 'ALL' : (userProfile?.centerId || 'ALL'), (d) => setAdmissions(d || []));
    }, [role, userProfile?.centerId]);

    const v = useMemo(() => {
        const admBy = {};
        admissions.forEach(a => { if (a.leadId) admBy[a.leadId] = a; });
        const all = (leads || []).filter(l => inCentre(l, centre) && (mine === 'ALL' || l.assignedTo === userProfile?.uid));
        const open = all.filter(l => !CLOSED.includes(l.status));
        const month = rangeFor('MONTH');
        const stageFull = (l) => stageOf(l, admBy[l.id] || (l.admissionId ? { status: l.status === 'CONVERTED' ? 'ACTIVE' : 'TOKEN_PAID' } : null));
        const cards = open.map(l => ({ l, adm: admBy[l.id], stage: moved[l.id] || stageFull(l) }))
            .filter(c => c.stage !== 'ADM' || inRange(createdMs(c.adm || c.l), month) || inRange(toMs(c.l.lastUpdated), month));
        const t = todayStr();
        const callBack = open.filter(l => l.nextFollowUp && l.nextFollowUp <= t && !['CONVERTED', 'TOKEN_PAID'].includes(l.status))
            .sort((x, y) => Number(isHot(y)) - Number(isHot(x)));
        const buckets = sparkBuckets('MONTH');
        const monthLeads = all.filter(l => inRange(createdMs(l), month));
        const joined = (l) => !!(l.admissionId || ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'].includes(l.status));
        const session = rangeFor('SESSION');
        const sess = all.filter(l => inRange(createdMs(l), session));
        const reached = (l, i) => ['ENQ', 'VIS', 'QUO', 'TOK', 'ADM'].indexOf(stageFull(l)) >= i || (i <= 3 && joined(l));
        const funnel = COLS.map((c, i) => ({ ...c, n: sess.filter(l => reached(l, i)).length }));
        const srcMap = {};
        sess.forEach(l => {
            const s = String(l.source || 'Other').replace(/_/g, ' ').toLowerCase().replace(/^\w/, x => x.toUpperCase());
            srcMap[s] = srcMap[s] || { s, n: 0, j: 0 }; srcMap[s].n += 1; if (joined(l)) srcMap[s].j += 1;
        });
        const srcs = Object.values(srcMap).sort((x, y) => y.n - x.n).slice(0, 6);
        return {
            cards, callBack, funnel, srcs, sessN: sess.length,
            newN: monthLeads.length, joinedN: monthLeads.filter(joined).length,
            hotN: callBack.filter(isHot).length,
            visitsN: open.filter(l => stageOf(l, admBy[l.id]) === 'VIS').length,
            quoteSum: cards.filter(c => c.stage !== 'ADM').reduce((x, c) => x + (Number(c.l.budgetQuoted) || 0), 0),
            sparkV: buckets.map(b => all.filter(l => stageFull(l) !== 'ENQ' && inRange(createdMs(l), b)).length),
            spark: buckets.map(b => all.filter(l => inRange(createdMs(l), b)).length),
            sparkJ: buckets.map(b => all.filter(l => joined(l) && inRange(toMs(l.lastUpdated) || createdMs(l), b)).length),
        };
    }, [leads, admissions, centre, mine, moved, userProfile?.uid]);

    const move = async (lead, to) => {
        setDrag(null); setOver(null);
        const from = stageOf(lead);
        if (to === from) return;
        if (to === 'QUO') { navigate(`/staff/leads/${lead.id}`); return; }
        if (to === 'TOK' || to === 'ADMIT') {
            navigate('/staff/take-admission', { state: { lead: { ...lead }, quote: { finalFee: lead.budgetQuoted || 0, selectedProgram: lead.courseInterest } } });
            return;
        }
        if (to === 'DROP') { setDrop(lead); return; }
        if (!['ENQ', 'VIS'].includes(to) || !['ENQ', 'VIS'].includes(from)) { toast('ℹ️', 'Open the enquiry to change this stage.'); return; }
        setMoved(m => ({ ...m, [lead.id]: to }));
        const r = await addInteraction(lead.id, { type: to === 'VIS' ? 'VISIT' : 'NOTE', result: to === 'VIS' ? 'Visited the centre' : 'Moved back to enquiry', newStatus: to === 'VIS' ? 'VISITED' : 'FOLLOW_UP' }, userProfile);
        if (r.success) toast('✅', `${lead.studentName} moved to ${to === 'VIS' ? 'Visited' : 'Enquiry'}`);
        else { setMoved(m => { const n = { ...m }; delete n[lead.id]; return n; }); toast('⚠️', 'Could not save. Try again.'); }
    };
    const notJoining = async (why, note) => {
        const lead = drop; setDrop(null);
        const r = await addInteraction(lead.id, { type: 'NOTE', result: `Not joining: ${why}`, note, newStatus: 'NOT_INTERESTED' }, userProfile);
        toast(r.success ? '🗑️' : '⚠️', r.success ? `${lead.studentName} marked not joining` : 'Could not save. Try again.');
    };

    const dragging = drag != null;
    const maxF = Math.max(1, v.funnel[0]?.n || 1);
    const srcTotal = Math.max(1, v.srcs.reduce((x, s) => x + s.n, 0));
    const pctWord = (x) => (x >= 0.45 && x <= 0.55 ? 'half' : `${Math.round(x * 100)}%`);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 jb-rise">
                <div>
                    <h2 className="jb-h text-[32px] sm:text-[42px] leading-tight">Admissions</h2>
                    <p className="jb-sub text-[14.5px] mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {v.cards.length} {v.cards.length === 1 ? 'student' : 'students'} in the pipeline{centre === 'ALL' || seesAll ? '' : ` · ${CENTRE_NAME[centre]}`}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {seesAll && <Seg label="Centre" options={CENTRES} value={centre} onChange={setCentre} />}
                    <Seg label="Whose" value={mine} onChange={setMine} pillBg="var(--ink)" onInk="var(--on-ink)"
                        options={[{ value: 'MINE', label: 'Mine' }, { value: 'ALL', label: role === 'COUNSELLOR' ? 'Team' : 'Everyone' }]} />
                    <button type="button" className="jb-act jb-act-ink !py-3 !px-5" onClick={() => setAdding(true)}>＋ New enquiry</button>
                </div>
            </div>

            {leads === null ? (
                <div className="flex flex-col gap-4" aria-busy="true"><div className="jb-grid4"><div className="jb-sk h-36" /><div className="jb-sk h-36" /><div className="jb-sk h-36" /><div className="jb-sk h-36" /></div><div className="jb-sk h-96" /></div>
            ) : (<>
                <div className="jb-grid4">
                    <Tile tone="blue" title="Enquiries" emoji="📞" spark={v.spark} value={<Count value={v.sessN} />} sub={`▲ ${v.newN} this month`} />
                    <Tile tone="lilac" title="Visits" emoji="🏫" delay={60} spark={v.sparkV} value={<Count value={v.funnel[1]?.n || 0} />}
                        sub={v.sessN ? `${pctWord((v.funnel[1]?.n || 0) / v.sessN)} of enquiries came in` : 'Nobody has visited yet'} />
                    <Tile tone="sage" title="Admitted" emoji="🎓" delay={120} spark={v.sparkJ} value={<Count value={v.funnel[4]?.n || 0} />}
                        sub={v.sessN ? `${Math.round(((v.funnel[4]?.n || 0) / v.sessN) * 100)}% of enquiries joined` : 'This session'} />
                    <div className="jb-rise flex flex-col rounded-[24px] p-5" style={{ background: 'var(--pine)', color: '#FFFFFF', animationDelay: '180ms', minHeight: 150 }}>
                        <div className="flex justify-between"><span className="text-[14px] font-bold" style={{ color: '#C9D8BC' }}>Call back today</span><span aria-hidden="true" className="text-[20px]">📞</span></div>
                        <p className="text-[40px] font-extrabold leading-none mt-2"><Count value={v.callBack.length} /></p>
                        <p className="text-[12.5px] mt-1 mb-3" style={{ color: '#DCE8D2' }}>{v.callBack.length ? `${v.hotN ? `${v.hotN} hot · ` : ''}leads and quotes waiting for a reply` : 'No call-backs due today'}</p>
                        <button type="button" disabled={!v.callBack.length} className="jb-act mt-auto self-start" style={{ background: '#FFFFFF', color: '#1D2A22' }}
                            onClick={() => v.callBack[0] && navigate(`/staff/leads/${v.callBack[0].id}`)}>{v.callBack.length ? 'Start with the hottest →' : 'All done 🎉'}</button>
                    </div>
                </div>

                <Card title="Pipeline" sub="Drag a card to the next stage, or open it. Roll number comes after Accounts verifies." delay={120}
                    right={<div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>Quotes in the pipeline <b className="text-[16px]" style={{ color: 'var(--ink)' }}>{lakh(v.quoteSum)}</b></span>
                        {onList && <button type="button" className="jb-act jb-act-line" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => onList('list')}>📋 Full list</button>}
                        <button type="button" className="jb-act jb-act-line" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setHostel(true)}>🏠 Hostel fees</button>
                    </div>}>
                    <div className="grid grid-flow-col auto-cols-[minmax(190px,1fr)] gap-3 overflow-x-auto pb-2 jb-scroll">
                        {COLS.map((col) => {
                            const cards = v.cards.filter(c => c.stage === col.id).sort((x, y) => Number(isHot(y.l)) - Number(isHot(x.l)) || (toMs(y.l.lastUpdated) || 0) - (toMs(x.l.lastUpdated) || 0));
                            return (
                                <section key={col.id} aria-label={col.l}
                                    onDragOver={(e) => { e.preventDefault(); setOver(col.id); }} onDrop={(e) => { e.preventDefault(); const l = (leads || []).find(x => x.id === drag); if (l) move(l, col.id); }}
                                    className="rounded-[20px] p-2.5 flex flex-col gap-2 min-h-[320px] max-h-[560px] overflow-y-auto jb-scroll transition-colors duration-300"
                                    style={{ background: over === col.id && dragging ? 'var(--t-sage)' : 'var(--cream)' }}>
                                    <header className="sticky -top-2.5 z-[1] px-1.5 pt-1 pb-1.5 rounded-xl" style={{ background: "inherit" }}>
                                        <div className="flex items-center gap-2">
                                            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: col.c }} />
                                            <b className="text-[14px] flex-1">{col.l}</b>
                                            <span className="jb-tag jb-tag-soft !bg-[var(--panel)]">{cards.length}</span>
                                        </div>
                                        <p className="text-[12px] mt-0.5 pl-[18px]" style={{ color: 'var(--muted)' }}>{lakh(cards.reduce((x, c) => x + (Number(c.l.budgetQuoted) || 0), 0))} in quotes</p>
                                    </header>
                                    {cards.length === 0 && <p className="text-[12.5px] text-center py-6" style={{ color: 'var(--muted)' }}>Nobody at this stage right now.</p>}
                                    {cards.slice(0, 30).map(({ l, adm }, i) => (
                                        <article key={l.id} draggable onDragStart={() => setDrag(l.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                                            className="jb-rise jb-lift rounded-2xl p-3 cursor-grab active:cursor-grabbing"
                                            style={{ background: 'var(--panel)', boxShadow: 'var(--card-sh)', animationDelay: `${Math.min(i, 8) * 30}ms`, opacity: drag === l.id ? .5 : 1 }}>
                                            <Link to={adm ? `/staff/student/${adm.id}` : `/staff/leads/${l.id}`} className="block" aria-label={`Open ${l.studentName}`}>
                                                <div className="flex items-start gap-1.5">
                                                    <b className="text-[14px] flex-1 leading-snug">{l.studentName}</b>
                                                    {isHot(l) && <span aria-label="Hot" title="Hot">🔥</span>}
                                                    {l.temperature === 'COLD' && <span aria-label="Cold" title="Cold">🧊</span>}
                                                    {Number(l.budgetQuoted) > 0 && <b className="text-[13px] tabular-nums whitespace-nowrap">{lakh(l.budgetQuoted)}</b>}
                                                </div>
                                                <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>{[programLabel(l.courseInterest) || 'Course not set', CENTRE_NAME[l.centerId]].filter(Boolean).join(' · ')}{l.stars ? <span style={{ color: '#E0A526' }}> · {'★'.repeat(l.stars)}</span> : null}</p>
                                                {col.id === 'TOK' && (!adm || !['ACTIVE', 'COMPLETED'].includes(adm.status))
                                                    ? <span className="inline-block mt-1.5 text-[11.5px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'var(--t-sage)' }}>✅ Waiting for Accounts</span>
                                                    : l.remarks ? <span className="inline-block mt-1.5 text-[11.5px] font-bold px-2 py-0.5 rounded-md max-w-full truncate" style={{ background: 'var(--t-butter)' }}>{l.remarks}</span> : null}
                                            </Link>
                                            <div className="flex items-center gap-1.5 mt-2.5">
                                                <Avatar name={l.assignedByName || l.assignedToName || l.telecaller || '?'} size={24} />
                                                <span className="text-[11.5px] flex-1 truncate" style={{ color: 'var(--muted)' }} title={`${lastText(l)} · ${ago(toMs(l.lastUpdated) || createdMs(l))}`}>{lastText(l)}</span>
                                                <Contact name={l.studentName} phone={phoneOf(l)} size="sm" message={`Namaste, this is Unacademy Nashik about ${l.studentName}'s admission enquiry.`} />
                                            </div>
                                        </article>
                                    ))}
                                </section>
                            );
                        })}
                    </div>
                    {/* Drop zones slide up while dragging */}
                    <div className="grid grid-cols-2 gap-3 overflow-hidden transition-all duration-300" style={{ maxHeight: dragging ? 120 : 0, marginTop: dragging ? 12 : 0, opacity: dragging ? 1 : 0 }}>
                        {[['ADMIT', '🎓', 'Admit', 'Opens the admission form; Accounts then verifies', 'var(--t-sage)'], ['DROP', '🗑️', 'Not joining', 'Asks for a reason, keeps the history', 'var(--t-coral)']].map(([id, e, t, s, bg]) => (
                            <div key={id} onDragOver={(ev) => { ev.preventDefault(); setOver(id); }} onDrop={(ev) => { ev.preventDefault(); const l = (leads || []).find(x => x.id === drag); if (l) move(l, id); }}
                                className="rounded-[20px] p-4 flex items-center gap-3 transition-transform duration-200" style={{ background: bg, transform: over === id ? 'scale(1.02)' : 'none', outline: over === id ? '2px dashed var(--ink)' : 'none' }}>
                                <span aria-hidden="true" className="text-[24px]">{e}</span>
                                <div><b className="text-[14px]">{t}</b><p className="text-[12px]" style={{ color: 'var(--sub)' }}>{s}</p></div>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="jb-grid21">
                    <Card title="This session's funnel" right={<span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>how many move to the next step</span>} delay={200}>
                        <div className="flex flex-col gap-3">
                            {v.funnel.map((f, i) => {
                                const step = i && v.funnel[i - 1].n ? Math.round((f.n / v.funnel[i - 1].n) * 100) : null;
                                return (
                                <div key={f.id} className="flex items-center gap-3">
                                    <span className="w-[96px] text-[13.5px] font-semibold">{i === 0 ? 'Enquiries' : f.l}</span>
                                    <div className="flex-1 h-[30px] rounded-xl overflow-hidden" style={{ background: 'var(--cream)' }}>
                                        <div className="jb-growx h-full rounded-xl flex items-center px-3 text-[13px] font-bold" style={{ width: `${Math.max(6, (f.n / maxF) * 100)}%`, background: SOFT[i], color: 'var(--ink)', animationDelay: `${i * 80}ms` }}>{f.n}</div>
                                    </div>
                                    <span className="w-[54px] text-right text-[13px] font-bold" style={{ color: step == null ? 'var(--muted)' : step >= 60 ? 'var(--ok)' : 'var(--late)' }}>{step == null ? '' : `${step}%`}</span>
                                </div>
                                );
                            })}
                        </div>
                    </Card>
                    <Card title="Where enquiries come from" sub="Click one to see how many of them joined" delay={260}>
                        {v.srcs.length === 0 && <Empty emoji="🌱">No enquiries this session yet.</Empty>}
                        {v.srcs.length > 0 && (
                            <div className="flex h-3 rounded-full overflow-hidden gap-[3px] mb-3" aria-hidden="true">
                                {v.srcs.map((s, i) => <span key={s.s} className="jb-growx h-full rounded-[3px]" style={{ width: `${(s.n / srcTotal) * 100}%`, background: SRC_BAR[i], animationDelay: `${i * 60}ms` }} />)}
                            </div>
                        )}
                        <ul className="flex flex-col">
                            {v.srcs.map((s, i) => {
                                const on = (src || v.srcs[0]?.s) === s.s;
                                return (
                                    <li key={s.s} style={{ borderTop: i ? '1px solid var(--track)' : 'none' }}>
                                        <button type="button" onClick={() => setSrc(s.s)} aria-pressed={on} className="w-full flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 transition-colors text-[13.5px]" style={{ background: on ? 'var(--cream)' : 'transparent' }}>
                                            <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: SRC_DOT[i] }} />
                                            <span className={`flex-1 ${on ? 'font-bold' : 'font-semibold'}`}>{s.s}</span>
                                            <span className="tabular-nums" style={{ color: 'var(--sub)' }}>{Math.round((s.n / srcTotal) * 100)}%</span>
                                            {on && <b className="jb-pop tabular-nums w-[78px] text-right" style={{ color: 'var(--ok)' }}>{Math.round((s.j / s.n) * 100)}% joined</b>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                </div>
            </>)}

            {adding && (
                <Layer>
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 shell-fade" style={{ background: 'rgba(17,25,21,.4)' }}>
                        <div className="max-w-2xl w-full max-h-[92vh] overflow-y-auto">
                            <AddLead userProfile={userProfile} initialData={null} onClose={() => setAdding(false)} onSuccess={() => { setAdding(false); toast('📥', 'Enquiry added'); }} />
                        </div>
                    </div>
                </Layer>
            )}
            {hostel && <HostelFeesSheet onClose={() => setHostel(false)} />}
            {drop && <NotJoining lead={drop} onClose={() => setDrop(null)} onDone={notJoining} />}
        </div>
    );
};

export default AdmissionsPipeline;
