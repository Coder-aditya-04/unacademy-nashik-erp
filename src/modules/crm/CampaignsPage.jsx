// Campaigns (design canvas board, approved 20 Nov 2026).
// Where enquiries come from and how many join, per source, from real leads.
// WhatsApp messages go one by one through wa.me links: a true bulk send needs
// a WhatsApp Business API account, which the ERP does not have yet.
import React, { useEffect, useMemo, useState } from 'react';
import { subscribeToLeads } from '../../services/leadService';
import { Seg, Card, Empty, Contact, Tile, Count, Avatar } from '../../components/j';
import { CENTRES, inCentre, createdMs, rangeFor, inRange, programLabel } from '../j/data';

const JOINED = ['CONVERTED', 'TOKEN_PAID', 'ADMISSION_TAKEN'];
const CLOSED = ['NOT_INTERESTED', 'REJECTED', 'LOST', 'CLOSED', 'REFUNDED'];
const srcName = (l) => String(l.source || 'Other').replace(/_/g, ' ').toLowerCase().replace(/^\w/, x => x.toUpperCase());
const joined = (l) => !!(l.admissionId || JOINED.includes(l.status));
const visited = (l) => joined(l) || ['VISITED', 'COUNSELLING_DONE'].includes(l.status) || (l.timeline || []).some(t => t.type === 'VISIT');

const TEMPLATES = [
    { id: 'demo', e: '🎓', label: 'Free demo class', text: (n) => `Hello! ${n ? `${n}, ` : ''}Unacademy Nashik is holding a free demo class this week for NEET and JEE. Reply YES and we will book your seat.` },
    { id: 'visit', e: '🏫', label: 'Visit the centre', text: (n) => `Hello! We would be happy to show ${n || 'you'} our classrooms and faculty. When can you visit Unacademy Nashik this week?` },
    { id: 'scholar', e: '🏆', label: 'Scholarship test', text: (n) => `Hello! ${n ? `${n} can` : 'You can'} sit our scholarship test this Sunday and get up to 90% off the course fee. Reply to book a slot.` },
    { id: 'last', e: '⏳', label: 'Last seats', text: (n) => `Hello! Only a few seats are left in our new batch. Shall we hold one for ${n || 'you'}? – Unacademy Nashik` },
];

const CampaignsPage = ({ userProfile }) => {
    const [leads, setLeads] = useState(null);
    const [centre, setCentre] = useState('ALL');
    const [period, setPeriod] = useState('SESSION');
    const [tpl, setTpl] = useState('demo');
    const [aud, setAud] = useState('ALL');
    const [sent, setSent] = useState({});

    useEffect(() => subscribeToLeads(userProfile, (d) => setLeads(Array.isArray(d) ? d : [])), [userProfile]);

    const v = useMemo(() => {
        const range = rangeFor(period);
        const all = (leads || []).filter(l => inCentre(l, centre) && inRange(createdMs(l), range));
        const map = {};
        all.forEach(l => {
            const s = srcName(l);
            map[s] = map[s] || { s, n: 0, vis: 0, j: 0 };
            map[s].n += 1; if (visited(l)) map[s].vis += 1; if (joined(l)) map[s].j += 1;
        });
        const srcs = Object.values(map).sort((a, b) => b.j - a.j || b.n - a.n);
        const funnel = [
            { l: 'Enquiries', n: all.length, c: '#7E9BC0' },
            { l: 'Visited', n: all.filter(visited).length, c: '#9C8FD0' },
            { l: 'Joined', n: all.filter(joined).length, c: '#8FAE7B' },
        ];
        const open = all.filter(l => !joined(l) && !CLOSED.includes(l.status) && (l.parentPhone || l.phone));
        const audience = aud === 'ALL' ? open : open.filter(l => srcName(l) === aud);
        return { srcs, funnel, open, audience, best: srcs[0] };
    }, [leads, centre, period, aud]);

    if (leads === null) return <div className="jb-sk h-[480px] rounded-3xl" />;
    const t = TEMPLATES.find(x => x.id === tpl);
    const top = Math.max(1, v.funnel[0].n);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="jb-h text-[26px]">Campaigns</h1>
                    <p className="jb-sub text-[14px]">Which sources bring students who join, and quick WhatsApp messages to open enquiries.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {userProfile?.role === 'DIRECTOR' && <Seg size="sm" label="Centre" options={CENTRES} value={centre} onChange={setCentre} />}
                    <Seg size="sm" label="Period" value={period} onChange={setPeriod} pillBg="var(--ink)" onInk="var(--on-ink)"
                        options={[{ value: 'MONTH', label: 'This month' }, { value: 'SESSION', label: 'This year' }]} />
                </div>
            </div>

            <div className="jb-grid4">
                <Tile tone="blue" emoji="📥" title="Enquiries" value={<Count value={v.funnel[0].n} />} sub="From every source" />
                <Tile tone="sage" emoji="🎉" title="Joined" value={<Count value={v.funnel[2].n} />} sub={`${Math.round((v.funnel[2].n / top) * 100)}% of enquiries`} delay={60} />
                <Tile tone="butter" emoji="🏅" title="Best source" value={<span className="text-[24px]">{v.best?.s || '—'}</span>} sub={v.best ? `${v.best.j} joined of ${v.best.n}` : 'No enquiries yet'} delay={120} />
                <Tile tone="coral" emoji="💬" title="Open to message" value={<Count value={v.open.length} />} sub="Not joined, has a phone" delay={180} />
            </div>

            <div className="jb-grid21">
                <Card title="By source" sub="Enquiries → visited → joined" delay={80}>
                    {v.srcs.length === 0 ? <Empty emoji="📭">No enquiries in this period.</Empty> : (
                        <table className="w-full text-[13.5px]">
                            <thead><tr className="text-left" style={{ color: 'var(--muted)' }}>
                                <th className="font-semibold py-1.5">Source</th><th className="font-semibold text-right">Enquiries</th><th className="font-semibold text-right">Visited</th><th className="font-semibold text-right">Joined</th><th className="font-semibold text-right">Join rate</th><th className="font-semibold text-right">Cost / admission</th>
                            </tr></thead>
                            <tbody>
                                {v.srcs.map(s => (
                                    <tr key={s.s} style={{ borderTop: '1px solid var(--line)' }}>
                                        <td className="py-2 font-bold">{s.s}</td>
                                        <td className="text-right tabular-nums">{s.n}</td>
                                        <td className="text-right tabular-nums">{s.vis}</td>
                                        <td className="text-right tabular-nums font-bold">{s.j}</td>
                                        <td className="text-right"><span className={`jb-tag ${s.j / s.n >= 0.3 ? 'jb-tag-ok' : s.j ? 'jb-tag-next' : 'jb-tag-soft'}`}>{Math.round((s.j / s.n) * 100)}%</span></td>
                                        <td className="text-right" style={{ color: 'var(--muted)' }}>needs spend</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>Cost per admission shows once the money spent on each source is entered. The ERP has no place for that yet.</p>
                </Card>

                <Card title="Funnel" sub="How many move to the next step" delay={120}>
                    <div className="space-y-3">
                        {v.funnel.map((f, i) => (
                            <div key={f.l}>
                                <div className="flex justify-between text-[13px] mb-1"><b>{f.l}</b><span className="tabular-nums">{f.n}{i > 0 && v.funnel[i - 1].n ? ` · ${Math.round((f.n / v.funnel[i - 1].n) * 100)}%` : ''}</span></div>
                                <div className="h-7 rounded-xl overflow-hidden" style={{ background: 'var(--track)' }}>
                                    <div className="h-full rounded-xl jb-growx" style={{ width: `${(f.n / top) * 100}%`, background: f.c, animationDelay: `${i * 120}ms` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card title="💬 WhatsApp to open enquiries" sub="Pick a message and who gets it, then tap WhatsApp on each row" delay={160}>
                <div className="flex flex-wrap gap-2 mb-3">
                    {TEMPLATES.map(x => (
                        <button key={x.id} type="button" onClick={() => setTpl(x.id)} className={`jb-act ${tpl === x.id ? 'jb-act-ink' : 'jb-act-line'}`}>{x.e} {x.label}</button>
                    ))}
                </div>
                <div className="rounded-2xl p-4 text-[13.5px] mb-3" style={{ background: 'var(--wa-bg)' }}>{t.text('{name}')}</div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[13px] font-bold">Send to</span>
                    <select value={aud} onChange={e => setAud(e.target.value)} className="jb-act jb-act-line" aria-label="Source">
                        <option value="ALL">All open enquiries ({v.open.length})</option>
                        {v.srcs.map(s => <option key={s.s} value={s.s}>{s.s}</option>)}
                    </select>
                    <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{Object.keys(sent).length} of {v.audience.length} opened</span>
                </div>
                {v.audience.length === 0 ? <Empty emoji="📭">Nobody to message here.</Empty> : (
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                        {v.audience.slice(0, 60).map(l => (
                            <div key={l.id} className="flex items-center gap-2 jb-row" onClickCapture={() => setSent(s => ({ ...s, [l.id]: true }))}
                                style={{ padding: '8px 10px', borderRadius: 14, border: '1px solid var(--line)', opacity: sent[l.id] ? 0.55 : 1 }}>
                                <Avatar name={l.studentName} size={30} />
                                <span className="flex-1 min-w-0">
                                    <span className="block font-bold text-[13px] truncate">{sent[l.id] ? '✓ ' : ''}{l.studentName || 'Enquiry'}</span>
                                    <span className="block text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>{srcName(l)} · {programLabel(l.courseInterest) || 'Course not noted'}</span>
                                </span>
                                <Contact name={l.studentName} phone={l.parentPhone || l.phone} size="sm" message={t.text(l.studentName?.split(' ')[0])} />
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CampaignsPage;
