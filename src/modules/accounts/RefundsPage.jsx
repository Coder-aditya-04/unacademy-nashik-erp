// Refunds and dropouts. Counsellors see refunds of their own students;
// Managers see their centre; Director and Accounts see every centre.
// Dropout % = refunded / cancelled / dropped admissions out of all admissions
// (rejected bookings are left out).
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeAdmissions } from '../../services/cacheService';
import { Seg, Card, Empty, Tile, Count, Contact } from '../../components/j';
import { inr } from '../../components/j/util';
import { CENTRES, CENTRE_NAME, centreOf, inCentre, programLabel, phoneOf, dateLabel } from '../j/data';
import { normaliseRole } from '../../utils/navItems';
import { isDropout, refundOf, dropoutBy, dropoutTotal } from '../../utils/dropout';

const counsellorOf = (a) => a.counsellorName || a.bookedBy || 'Not set';
const mineOf = (a, uid) => a.counsellorId === uid || a.bookedById === uid;

const Bars = ({ rows }) => {
    if (!rows.length) return <Empty emoji="🌱">No admissions yet.</Empty>;
    const top = Math.max(10, ...rows.map(r => r.pct));
    return (
        <ul className="flex flex-col gap-2.5">
            {rows.slice(0, 10).map(r => (
                <li key={r.key}>
                    <div className="flex justify-between text-[13.5px]"><b className="truncate pr-2">{r.key}</b><span className="tabular-nums whitespace-nowrap"><b>{r.pct}%</b> <span style={{ color: 'var(--muted)' }}>· {r.dropped} of {r.total}</span></span></div>
                    <div className="h-2.5 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--track)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(r.pct / top) * 100}%`, background: r.pct >= 15 ? 'var(--late)' : r.pct >= 8 ? '#E0A526' : 'var(--ok)', transition: 'width .6s ease' }} />
                    </div>
                </li>
            ))}
        </ul>
    );
};

const RefundsPage = ({ userProfile }) => {
    const role = normaliseRole(userProfile?.role);
    const seesAll = ['DIRECTOR', 'ACCOUNTANT'].includes(role);
    const isCounsellor = role === 'COUNSELLOR';
    const [adm, setAdm] = useState(null);
    const [centre, setCentre] = useState('ALL');
    const [by, setBy] = useState(isCounsellor ? 'course' : 'counsellor');

    useEffect(() => subscribeAdmissions(seesAll ? 'ALL' : (userProfile?.centerId || 'ALL'), (d) => setAdm(d || [])), [seesAll, userProfile?.centerId]);

    const v = useMemo(() => {
        const scope = (adm || []).filter(a => inCentre(a, centre) && (!isCounsellor || mineOf(a, userProfile?.uid)));
        const refunds = scope.filter(isDropout).map(a => ({ a, r: refundOf(a) })).sort((x, y) => (y.r.ms || 0) - (x.r.ms || 0));
        const keyOf = by === 'course' ? (a) => programLabel(a.program) : by === 'centre' ? (a) => CENTRE_NAME[centreOf(a)] : counsellorOf;
        return { refunds, total: dropoutTotal(scope), rows: dropoutBy(scope, keyOf) };
    }, [adm, centre, by, isCounsellor, userProfile?.uid]);

    if (adm === null) return <div className="jb-sk h-[480px] rounded-3xl" />;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="jb-h text-[26px]">Refunds and dropouts</h1>
                    <p className="jb-sub text-[14px]">{isCounsellor ? 'Your students who took a refund or left, and your dropout rate.' : 'Who took a refund or left, and the dropout rate by counsellor, course and centre.'}</p>
                </div>
                {seesAll && <Seg size="sm" label="Centre" options={CENTRES} value={centre} onChange={setCentre} />}
            </div>

            <div className="jb-grid4">
                <Tile tone="coral" emoji="📉" title="Dropout rate" value={<><Count value={v.total.pct} format={(x) => x.toFixed(1)} />%</>} sub={`${v.total.dropped} of ${v.total.total} admissions`} />
                <Tile tone="butter" emoji="↩️" title="Refunded" value={inr(v.total.refunded)} sub="Money given back" delay={60} />
                <Tile tone="sage" emoji="🎓" title="Still studying" value={<Count value={v.total.total - v.total.dropped} />} sub="Admissions not dropped" delay={120} />
                <Tile tone="blue" emoji="🧾" title="Refund entries" value={<Count value={v.refunds.length} />} sub="Listed below" delay={180} />
            </div>

            <div className="jb-grid21">
                <Card title="Refund list" sub="Newest first. Tap a name to open the student." delay={80}>
                    {v.refunds.length === 0 ? <Empty emoji="🎉">No refunds. Nobody has left.</Empty> : (
                        <ul className="flex flex-col">
                            {v.refunds.slice(0, 80).map(({ a, r }, i) => (
                                <li key={a.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--track)' : 'none' }}>
                                    <Link to={`/staff/student/${a.id}`} className="flex-1 min-w-0">
                                        <b className="text-[14px] block truncate">{a.studentName}</b>
                                        <span className="text-[12.5px] block truncate" style={{ color: 'var(--muted)' }}>{programLabel(a.program)} · {CENTRE_NAME[centreOf(a)]}{isCounsellor ? '' : ` · ${counsellorOf(a)}`}{r.note ? ` · ${r.note}` : ''}</span>
                                    </Link>
                                    <div className="text-right">
                                        <b className="text-[14px] tabular-nums" style={{ color: 'var(--late)' }}>{r.amount ? inr(r.amount) : '—'}</b>
                                        <span className="text-[12px] block" style={{ color: 'var(--muted)' }}>{dateLabel(r.ms, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                    <Contact name={a.studentName} phone={phoneOf(a)} size="sm" message={`Namaste, this is Unacademy Nashik about ${a.studentName}.`} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card title="Dropout %" sub="Share of admissions that left" right={
                    <Seg size="sm" label="Group by" value={by} onChange={setBy}
                        options={[...(isCounsellor ? [] : [{ value: 'counsellor', label: 'Counsellor' }]), { value: 'course', label: 'Course' }, ...(seesAll ? [{ value: 'centre', label: 'Centre' }] : [])]} />
                } delay={120}>
                    <Bars rows={v.rows} />
                </Card>
            </div>
        </div>
    );
};

export default RefundsPage;
