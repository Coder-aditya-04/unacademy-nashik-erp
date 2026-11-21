// Telecalling for the Manager and Director: upload leads, allocate them to
// telecallers, and watch today's calls. Copies the TeleCRM screens the team
// already uses (import with history, allocation, call report).
import React, { useEffect, useMemo, useState } from 'react';
import { Seg, Card, Empty, Tile, Count, Avatar } from '../../components/j';
import { useToast } from '../../components/j/context';
import { CENTRES, CENTRE_NAME, dateLabel, timeLabel, ago } from '../j/data';
import { toMs, dayStart } from '../../components/j/util';
import { normaliseRole } from '../../utils/navItems';
import {
    fetchKnownPhones, importLeads, subscribeUploads, fetchUnassigned, allocate, fetchTelecallers,
    countAssigned, fetchAssignedTo, subscribeCalls,
} from '../../services/teleService';
import { FIELDS, guessMapping, parseCsv, buildLeads, splitLeads } from './sheet';
import { STAGE, STAGES, RESULT } from './constants';

const SAMPLE = 'data:text/csv;charset=utf-8,' + encodeURIComponent('Student name,Phone,Parent phone,Class,Course,School,Board,UNSAT score,Rank,Area,Lead source,Collected by\nRiya Patil,9876543210,9876500000,11,NEET 2 year,KN Kela School,State,142,15,College Road,School camp,Vivek Patil\n');
const mins = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.round(s / 60)}m`);

/* ---------------- Upload ---------------- */
const Upload = ({ centre, user, onDone }) => {
    const toast = useToast();
    const [file, setFile] = useState(null);
    const [sheet, setSheet] = useState(null); // { headers, rows }
    const [map, setMap] = useState({});
    const [name, setName] = useState('');
    const [known, setKnown] = useState(null);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(0);
    const [err, setErr] = useState('');

    const read = async (f) => {
        setErr(''); setSheet(null); setFile(f); setName(f.name.replace(/\.(csv|xlsx)$/i, ''));
        try {
            let data;
            if (/\.csv$/i.test(f.name)) data = parseCsv(await f.text());
            else {
                const { readSheet } = await import('read-excel-file/browser');
                data = (await readSheet(f)).map(r => r.map(c => (c instanceof Date ? c.toISOString().slice(0, 10) : c ?? '')));
            }
            if (data.length < 2) throw new Error('The file has no rows under the header.');
            if (data.length > 100001) throw new Error('Please split files over 100,000 rows.');
            const headers = data[0].map(h => String(h ?? ''));
            setSheet({ headers, rows: data.slice(1) });
            setMap(guessMapping(headers));
            setKnown(await fetchKnownPhones(centre));
        } catch (e) { setErr(e.message || 'Could not read this file.'); }
    };

    const result = useMemo(() => (sheet && known ? buildLeads(sheet.rows, map, known) : null), [sheet, map, known]);
    const ready = result && map.phone != null && map.studentName != null && result.good.length > 0;

    const save = async () => {
        setBusy(true); setSaved(0);
        try {
            const people = map.owner != null ? await fetchTelecallers(centre).catch(() => []) : [];
            const r = await importLeads({ leads: result.good, fileName: file.name, uploadName: name.trim() || file.name, centerId: centre, user, people, skipped: { dupes: result.dupes.length, bad: result.bad.length } }, setSaved);
            toast?.('📥', r.matched ? `${r.saved} leads saved. ${r.matched} went straight to their old telecaller; allocate the rest.` : `${r.saved} leads saved. Allocate them next.`);
            setSheet(null); setFile(null); onDone(r.id);
        } catch (e) { setErr(e.message); }
        setBusy(false);
    };

    return (
        <div className="space-y-4">
            {!sheet && (
                <label className="block rounded-3xl text-center cursor-pointer jb-lift" style={{ border: '2px dashed var(--line)', padding: '36px 16px', background: 'var(--panel)' }}>
                    <input type="file" accept=".csv,.xlsx" className="hidden" onChange={e => e.target.files?.[0] && read(e.target.files[0])} />
                    <p className="text-[34px]" aria-hidden="true">📥</p>
                    <p className="jb-h text-[18px] mt-1">Choose a .csv or .xlsx file</p>
                    <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Up to 100,000 rows. First row must be the column names.</p>
                    <a href={SAMPLE} download="kap-leads-sample.csv" onClick={e => e.stopPropagation()} className="inline-block mt-3 text-[13px] font-bold underline">Download sample file</a>
                </label>
            )}
            {err && <p className="rounded-2xl p-3 text-[13.5px] font-semibold" style={{ background: 'var(--latebg)' }}>⚠️ {err}</p>}

            {sheet && (
                <Card title={`📄 ${file?.name}`} sub={`${sheet.rows.length.toLocaleString('en-IN')} rows · match each ERP field to a column`}
                    right={<button type="button" className="jb-act jb-act-line" onClick={() => { setSheet(null); setFile(null); }}>Choose another</button>}>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                        {FIELDS.map(f => (
                            <label key={f.key} className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2" style={{ background: 'var(--cream)' }}>
                                <span className="text-[13px] font-bold">{f.label}{f.need ? ' *' : ''}</span>
                                <select value={map[f.key] ?? ''} onChange={e => setMap(m => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                    className="text-[12.5px] rounded-lg px-2 py-1 max-w-[130px]" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
                                    <option value="">Not in file</option>
                                    {sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>

                    {result && (
                        <>
                            <div className="flex flex-wrap gap-2 mt-4 text-[13px] font-bold">
                                <span className="jb-tag jb-tag-ok">{result.good.length.toLocaleString('en-IN')} new leads</span>
                                <span className="jb-tag jb-tag-next">{result.dupes.length.toLocaleString('en-IN')} already in the ERP (skipped)</span>
                                <span className="jb-tag jb-tag-late">{result.bad.length.toLocaleString('en-IN')} without name or valid mobile</span>
                            </div>
                            <div className="overflow-x-auto mt-3">
                                <table className="w-full text-[12.5px]">
                                    <thead><tr className="text-left" style={{ color: 'var(--muted)' }}>{['Name', 'Phone', 'Parent', 'Class', 'School', 'Score', 'Stage'].map(h => <th key={h} className="font-semibold py-1 pr-3">{h}</th>)}</tr></thead>
                                    <tbody>{result.good.slice(0, 5).map(l => (
                                        <tr key={l.phone} style={{ borderTop: '1px solid var(--line)' }}>
                                            <td className="py-1.5 pr-3 font-bold">{l.studentName}</td><td className="pr-3 tabular-nums">{l.phone}</td><td className="pr-3 tabular-nums">{l.parentPhone || '—'}</td>
                                            <td className="pr-3">{l.currentClass || '—'}</td><td className="pr-3">{l.school || '—'}</td><td className="pr-3">{l.score || '—'}</td><td>{STAGE[l.stage].label}</td>
                                        </tr>))}</tbody>
                                </table>
                            </div>
                            {result.bad.length > 0 && <p className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}>Rows skipped, for example line {result.bad.slice(0, 5).map(b => `${b.line} (${b.why})`).join(', ')}.</p>}
                        </>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name this upload, e.g. School camp Nov 26" maxLength={80}
                            className="flex-1 min-w-[220px] rounded-xl px-3 py-2 text-[13.5px]" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }} />
                        <button type="button" disabled={!ready || busy} onClick={save} className="jb-act jb-act-ink" style={{ opacity: ready && !busy ? 1 : 0.5 }}>
                            {busy ? `Saving ${saved.toLocaleString('en-IN')} of ${result.good.length.toLocaleString('en-IN')}…` : `Save ${result?.good.length.toLocaleString('en-IN') || 0} leads to ${CENTRE_NAME[centre] || centre}`}
                        </button>
                    </div>
                    {busy && <div className="h-2 rounded-full overflow-hidden mt-3" style={{ background: 'var(--track)' }}><div className="h-full rounded-full" style={{ width: `${(saved / Math.max(1, result.good.length)) * 100}%`, background: 'var(--ok)', transition: 'width .3s' }} /></div>}
                </Card>
            )}
        </div>
    );
};

/* ---------------- Allocate ---------------- */
const Allocate = ({ centre, user, uploads, uploadId, setUploadId, people }) => {
    const toast = useToast();
    const [pool, setPool] = useState(null);
    const [stages, setStages] = useState(['NEW']);
    const [pick, setPick] = useState([]);
    const [mode, setMode] = useState('EQUAL');
    const [counts, setCounts] = useState({});
    const [howMany, setHowMany] = useState('');
    const [load, setLoad] = useState({});
    const [busy, setBusy] = useState(false);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let live = true;
        setPool(null);
        fetchUnassigned(centre, uploadId || null).then(p => live && setPool(p)).catch(() => live && setPool([]));
        return () => { live = false; };
    }, [centre, uploadId, tick]);
    useEffect(() => {
        let live = true;
        Promise.all(people.map(async p => [p.uid, await countAssigned(p.uid).catch(() => 0)])).then(r => live && setLoad(Object.fromEntries(r)));
        return () => { live = false; };
    }, [people, tick]);

    const avail = (pool || []).filter(l => stages.includes(l.stage || 'NEW'));
    const n = Math.min(avail.length, Number(howMany) > 0 ? Number(howMany) : avail.length);
    const ids = avail.slice(0, n).map(l => l.id);
    const plan = splitLeads(ids, pick, mode === 'COUNT' ? counts : null);
    const planned = Object.values(plan).reduce((s, a) => s + a.length, 0);
    const names = Object.fromEntries(people.map(p => [p.uid, p.name]));

    const go = async () => {
        setBusy(true);
        try { const done = await allocate(plan, names, user); toast?.('🎧', `${done} leads allocated`); setTick(t => t + 1); setPick([]); setCounts({}); }
        catch (e) { toast?.('⚠️', e.message); }
        setBusy(false);
    };
    const takeBack = async (p) => {
        const mine = (await fetchAssignedTo(p.uid)).filter(l => !l.callCount);
        if (!mine.length) { toast?.('ℹ️', `${p.name} has no uncalled leads`); return; }
        await allocate({ null: mine.map(l => l.id) }, names, user);
        toast?.('↩️', `${mine.length} uncalled leads taken back from ${p.name}`); setTick(t => t + 1);
    };

    return (
        <div className="jb-grid21">
            <Card title="Share out leads" sub="Pick the leads, then the telecallers">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold">From</span>
                        <select value={uploadId || ''} onChange={e => setUploadId(e.target.value || null)} className="jb-act jb-act-line">
                            <option value="">All unallocated leads</option>
                            {uploads.map(u => <option key={u.id} value={u.id}>{u.name} ({u.saved || u.total})</option>)}
                        </select>
                        <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{pool === null ? 'Counting…' : `${(pool || []).length.toLocaleString('en-IN')} waiting`}</span>
                    </div>
                    <div>
                        <p className="text-[12px] font-bold mb-1.5" style={{ color: 'var(--muted)' }}>STAGES TO INCLUDE</p>
                        <div className="flex flex-wrap gap-1.5">
                            {STAGES.filter(s => s.open).map(s => {
                                const on = stages.includes(s.id); const c = (pool || []).filter(l => (l.stage || 'NEW') === s.id).length;
                                return <button key={s.id} type="button" onClick={() => setStages(x => (on ? x.filter(y => y !== s.id) : [...x, s.id]))} className={`jb-act ${on ? 'jb-act-ink' : 'jb-act-line'}`} style={{ padding: '6px 10px', fontSize: 12.5 }}>{s.label} · {c}</button>;
                            })}
                        </div>
                    </div>
                    <div>
                        <p className="text-[12px] font-bold mb-1.5" style={{ color: 'var(--muted)' }}>TELECALLERS</p>
                        {people.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No telecallers yet. Add staff with the Telecaller role, then approve them.</p> : (
                            <div className="flex flex-wrap gap-1.5">
                                {people.map(p => {
                                    const on = pick.includes(p.uid);
                                    return <button key={p.uid} type="button" onClick={() => setPick(x => (on ? x.filter(y => y !== p.uid) : [...x, p.uid]))} className={`jb-act ${on ? 'jb-act-ink' : 'jb-act-line'}`} style={{ padding: '6px 10px', fontSize: 12.5 }}>{on ? '✓ ' : ''}{p.name}</button>;
                                })}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Seg size="sm" label="Split" value={mode} onChange={setMode} options={[{ value: 'EQUAL', label: 'Equal (round robin)' }, { value: 'COUNT', label: 'Set a number each' }]} />
                        {mode === 'EQUAL' && (
                            <label className="text-[13px] font-bold flex items-center gap-2">How many
                                <input type="number" min={1} value={howMany} onChange={e => setHowMany(e.target.value)} placeholder={String(avail.length)} className="w-24 rounded-lg px-2 py-1" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }} />
                            </label>
                        )}
                    </div>
                    {mode === 'COUNT' && pick.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {pick.map(uid => (
                                <label key={uid} className="text-[13px] flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: 'var(--cream)' }}>{names[uid]}
                                    <input type="number" min={0} value={counts[uid] || ''} onChange={e => setCounts(c => ({ ...c, [uid]: e.target.value }))} className="w-20 rounded-lg px-2 py-1" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }} />
                                </label>
                            ))}
                        </div>
                    )}
                    {pick.length > 0 && planned > 0 && (
                        <div className="rounded-2xl p-3 text-[13px]" style={{ background: 'var(--okbg)' }}>
                            {pick.map(uid => <span key={uid} className="mr-4"><b>{names[uid]}</b> gets {plan[uid].length}</span>)}
                        </div>
                    )}
                    <button type="button" className="jb-act jb-act-ink" disabled={!planned || busy} onClick={go} style={{ opacity: planned && !busy ? 1 : 0.5 }}>
                        {busy ? 'Allocating…' : `Allocate ${planned.toLocaleString('en-IN')} leads`}
                    </button>
                </div>
            </Card>
            <Card title="Current load" sub="Leads with each telecaller now">
                {people.length === 0 ? <Empty emoji="🎧">No telecallers yet.</Empty> : (
                    <div className="space-y-2">
                        {people.map(p => (
                            <div key={p.uid} className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ background: 'var(--cream)' }}>
                                <Avatar name={p.name} size={32} />
                                <span className="flex-1 min-w-0"><b className="block text-[13.5px] truncate">{p.name}</b><span className="text-[12px]" style={{ color: 'var(--muted)' }}>{CENTRE_NAME[p.centerId] || p.centerId}</span></span>
                                <b className="tabular-nums">{load[p.uid] ?? '…'}</b>
                                <button type="button" className="jb-act jb-act-line" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => takeBack(p)}>Take back uncalled</button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

/* ---------------- Calls today ---------------- */
const CallsToday = ({ centre, people }) => {
    const [calls, setCalls] = useState(null);
    const [since] = useState(() => dayStart(Date.now()));
    useEffect(() => subscribeCalls(centre, since, setCalls), [centre, since]);
    const v = useMemo(() => {
        const list = (calls || []).slice().sort((a, b) => (toMs(b.startedAt) || 0) - (toMs(a.startedAt) || 0));
        const by = {};
        people.forEach(p => { by[p.uid] = { name: p.name, n: 0, conn: 0, talk: 0, warm: 0, first: null, last: null }; });
        list.forEach(c => {
            const r = by[c.byUid] || (by[c.byUid] = { name: c.by, n: 0, conn: 0, talk: 0, warm: 0, first: null, last: null });
            const ms = toMs(c.startedAt);
            r.n += 1; if (c.result === 'CONNECTED') r.conn += 1; r.talk += c.talkSeconds || 0; if (STAGE[c.stage]?.promote) r.warm += 1;
            r.first = r.first == null ? ms : Math.min(r.first, ms); r.last = r.last == null ? ms : Math.max(r.last, ms);
        });
        const hours = Array.from({ length: 13 }, (_, i) => ({ h: 8 + i, n: list.filter(c => new Date(toMs(c.startedAt)).getHours() === 8 + i).length }));
        return { list, rows: Object.entries(by).sort((a, b) => b[1].n - a[1].n), hours, n: list.length, conn: list.filter(c => c.result === 'CONNECTED').length, talk: list.reduce((s, c) => s + (c.talkSeconds || 0), 0), warm: list.filter(c => STAGE[c.stage]?.promote).length };
    }, [calls, people]);
    if (calls === null) return <div className="jb-sk h-[360px] rounded-3xl" />;
    const peak = Math.max(1, ...v.hours.map(h => h.n));
    return (
        <div className="space-y-5">
            <div className="jb-grid4">
                <Tile tone="blue" emoji="📞" title="Calls today" value={<Count value={v.n} />} sub="All telecallers" />
                <Tile tone="sage" emoji="✅" title="Connected" value={<Count value={v.conn} />} sub={v.n ? `${Math.round((v.conn / v.n) * 100)}% of calls` : 'No calls yet'} delay={60} />
                <Tile tone="butter" emoji="⏱️" title="Talk time" value={mins(v.talk)} sub="Estimated until the app reads the call log" delay={120} />
                <Tile tone="coral" emoji="🔥" title="Sent to Admissions" value={<Count value={v.warm} />} sub="Interested or visit booked" delay={180} />
            </div>
            <div className="jb-grid21">
                <Card title="Leaderboard" sub="Today, by calls">
                    {v.rows.length === 0 ? <Empty emoji="🎧">No telecallers yet.</Empty> : (
                        <table className="w-full text-[13px]">
                            <thead><tr className="text-left" style={{ color: 'var(--muted)' }}>{['#', 'Telecaller', 'Calls', 'Connected', 'Talk', 'To Admissions', 'First – last call'].map(h => <th key={h} className="font-semibold py-1.5">{h}</th>)}</tr></thead>
                            <tbody>{v.rows.map(([uid, r], i) => (
                                <tr key={uid} style={{ borderTop: '1px solid var(--line)' }}>
                                    <td className="py-2">{i === 0 && r.n ? '🏆' : i + 1}</td><td className="font-bold">{r.name}</td>
                                    <td className="tabular-nums font-bold">{r.n}</td><td className="tabular-nums">{r.conn}</td><td className="tabular-nums">{mins(r.talk)}</td><td className="tabular-nums">{r.warm}</td>
                                    <td style={{ color: 'var(--muted)' }}>{r.first ? `${timeLabel(r.first)} – ${timeLabel(r.last)}` : 'Not started'}</td>
                                </tr>))}</tbody>
                        </table>
                    )}
                </Card>
                <Card title="Calls by hour" sub="8 AM to 8 PM">
                    <div className="flex items-end gap-1.5 h-[140px]">
                        {v.hours.map(h => (
                            <div key={h.h} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--muted)' }}>{h.n || ''}</span>
                                <div className="w-full rounded-md jb-grow" style={{ height: `${(h.n / peak) * 100}px`, minHeight: 3, background: h.n ? 'var(--ok)' : 'var(--track)' }} />
                                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{h.h > 12 ? h.h - 12 : h.h}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
            <Card title="Latest calls">
                {v.list.length === 0 ? <Empty emoji="☕">No calls yet today.</Empty> : (
                    <div className="space-y-1.5">
                        {v.list.slice(0, 40).map(c => (
                            <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2" style={{ background: 'var(--cream)' }}>
                                <span className="text-[12px] tabular-nums w-16" style={{ color: 'var(--muted)' }}>{timeLabel(toMs(c.startedAt))}</span>
                                <b className="text-[13px]">{c.studentName}</b>
                                <span className="text-[12px]">{RESULT[c.result]?.e} {RESULT[c.result]?.label}</span>
                                <span className="jb-tag jb-tag-soft">{STAGE[c.stage]?.label}</span>
                                {c.note && <span className="text-[12px] truncate max-w-[340px]" style={{ color: 'var(--sub)' }}>“{c.note}”</span>}
                                <span className="ml-auto text-[12px]" style={{ color: 'var(--muted)' }}>{c.by} · {c.talkSeconds ? mins(c.talkSeconds) : '0m'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

/* ---------------- Page ---------------- */
const TeleHome = ({ userProfile }) => {
    const role = normaliseRole(userProfile?.role);
    const isDir = role === 'DIRECTOR';
    const [tab, setTab] = useState('UPLOAD');
    const [centre, setCentre] = useState(isDir ? 'UN_COLLEGE' : (userProfile?.centerId || 'UN_COLLEGE'));
    const [uploads, setUploads] = useState([]);
    const [uploadId, setUploadId] = useState(null);
    const [people, setPeople] = useState([]);
    useEffect(() => subscribeUploads(centre, setUploads), [centre]);
    useEffect(() => { fetchTelecallers(centre).then(setPeople).catch(() => setPeople([])); }, [centre]);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="jb-h text-[26px]">Telecalling</h1>
                    <p className="jb-sub text-[14px]">Upload leads, share them out to telecallers, and see today's calls.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isDir && <Seg size="sm" label="Centre" options={CENTRES.filter(c => c.value !== 'ALL')} value={centre} onChange={setCentre} />}
                    <Seg size="sm" label="View" value={tab} onChange={setTab} pillBg="var(--ink)" onInk="var(--on-ink)"
                        options={[{ value: 'UPLOAD', label: '📥 Upload' }, { value: 'ALLOCATE', label: '🎧 Allocate' }, { value: 'CALLS', label: '📞 Calls today' }]} />
                </div>
            </div>

            {tab === 'UPLOAD' && (
                <>
                    <Upload centre={centre} user={userProfile} onDone={(id) => { setUploadId(id); setTab('ALLOCATE'); }} />
                    <Card title="Upload history" sub={`${uploads.length} files for ${CENTRE_NAME[centre]}`}>
                        {uploads.length === 0 ? <Empty emoji="🗂️">No uploads yet.</Empty> : (
                            <table className="w-full text-[13px]">
                                <thead><tr className="text-left" style={{ color: 'var(--muted)' }}>{['Upload', 'Leads', 'Skipped', 'By', 'When', ''].map(h => <th key={h} className="font-semibold py-1.5">{h}</th>)}</tr></thead>
                                <tbody>{uploads.map(u => (
                                    <tr key={u.id} style={{ borderTop: '1px solid var(--line)' }}>
                                        <td className="py-2"><b>{u.name}</b><span className="block text-[11.5px]" style={{ color: 'var(--muted)' }}>{u.fileName}</span></td>
                                        <td className="tabular-nums font-bold">{u.saved ?? 0}{u.status === 'SAVING' ? ' …' : ''}</td>
                                        <td className="tabular-nums" style={{ color: 'var(--muted)' }}>{(u.duplicates || 0) + (u.invalid || 0)}</td>
                                        <td>{u.by}</td>
                                        <td style={{ color: 'var(--muted)' }}>{toMs(u.createdAt) ? `${dateLabel(toMs(u.createdAt))} · ${ago(toMs(u.createdAt))}` : 'now'}</td>
                                        <td><button type="button" className="jb-act jb-act-line" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => { setUploadId(u.id); setTab('ALLOCATE'); }}>Allocate ›</button></td>
                                    </tr>))}</tbody>
                            </table>
                        )}
                    </Card>
                </>
            )}
            {tab === 'ALLOCATE' && <Allocate centre={centre} user={userProfile} uploads={uploads} uploadId={uploadId} setUploadId={setUploadId} people={people} />}
            {tab === 'CALLS' && <CallsToday centre={centre} people={people} />}
        </div>
    );
};

export default TeleHome;
