import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessMapping, tenDigits, parseCsv, buildLeads, splitLeads } from '../../src/modules/tele/sheet.js';

test('phone numbers become 10-digit mobiles', () => {
    assert.equal(tenDigits('+91 98765 43210'), '9876543210');
    assert.equal(tenDigits('919876543210'), '9876543210');
    assert.equal(tenDigits('09876543210'), '9876543210');
    assert.equal(tenDigits(9876543210), '9876543210');
    assert.equal(tenDigits('9876543210.0'), '9876543210');
    assert.equal(tenDigits('12345'), '');
    assert.equal(tenDigits('5876543210'), '');
});

test('headers map to ERP fields, exact names first', () => {
    const m = guessMapping(['Name', 'Mobile Number', 'Parent Phone Number', 'Class', 'UNSAT Score', 'School', 'Lead Source', 'Status']);
    assert.deepEqual(m, { studentName: 0, phone: 1, parentPhone: 2, currentClass: 3, school: 5, score: 4, source: 6, stage: 7 });
});

test('csv with quotes and commas', () => {
    const rows = parseCsv('Name,Phone\n"Patil, Riya",9876543210\r\n"Om ""OJ"" Joshi",9123456789\n\n');
    assert.deepEqual(rows, [['Name', 'Phone'], ['Patil, Riya', '9876543210'], ['Om "OJ" Joshi', '9123456789']]);
});

test('bad rows and duplicates are kept apart', () => {
    const rows = [['Riya', '9876543210', 'Warm'], ['', '9876543211', ''], ['Om', '123', ''], ['Riya again', '+919876543210', ''], ['Sara', '9000000001', 'Centre visit scheduled']];
    const r = buildLeads(rows, { studentName: 0, phone: 1, stage: 2 }, new Set(['9000000001']));
    assert.equal(r.good.length, 1);
    assert.equal(r.good[0].stage, 'WARM');
    assert.equal(r.bad.length, 2);
    assert.equal(r.dupes.length, 2);
    assert.deepEqual(r.dupes.map(d => d.where).sort(), ['erp', 'file']);
});

test('round robin and fixed counts', () => {
    assert.deepEqual(splitLeads(['a', 'b', 'c', 'd', 'e'], ['x', 'y']), { x: ['a', 'c', 'e'], y: ['b', 'd'] });
    assert.deepEqual(splitLeads(['a', 'b', 'c', 'd'], ['x', 'y'], { x: 1, y: 2 }), { x: ['a'], y: ['b', 'c'] });
});

test('TeleCRM export columns: owner, follow-up, remarks, rating, created', async () => {
    const { ymdFrom } = await import('../../src/modules/tele/sheet.js');
    const headers = ['Lead Name', 'Mobile', 'Lead Status', 'Assigned To', 'Next Follow Up', 'Remarks', 'Rating', 'Created On'];
    const m = guessMapping(headers);
    assert.deepEqual([m.studentName, m.phone, m.stage, m.owner, m.nextFollowUp, m.lastNote, m.temperature, m.createdOn], [0, 1, 2, 3, 4, 5, 6, 7]);
    const r = buildLeads([['Riya', '9876543210', 'Interested', 'Pooja Telecaller', '23/11/2026', 'Wants NEET', 'Hot', '2026-10-02 10:30']], m);
    assert.deepEqual(r.good[0], { studentName: 'Riya', phone: '9876543210', stage: 'INTERESTED', owner: 'Pooja Telecaller', lastNote: 'Wants NEET', nextFollowUp: '2026-11-23', importedCreatedOn: '2026-10-02', temperature: 'HOT' });
    assert.equal(ymdFrom(46347), '2026-11-21');
    assert.equal(ymdFrom('21-11-26'), '2026-11-21');
    assert.equal(ymdFrom(''), '');
});
