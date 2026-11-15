# Academic year (design note, on hold)

Status: design only, not built yet. Aditya confirmed (15 Nov 2026) that the
academic year runs **December to November**, and that roll numbers stay
centre-wise (111 College Road, 110 Nashik Road, 112 Prayaas).

## How centre-wise rolls and the year fit together

A roll number stays `<centre prefix><yy><4-digit sequence>`, 9 digits:

| Centre | Session Dec 2026 to Nov 2027 | Session Dec 2027 to Nov 2028 |
|---|---|---|
| College Road (111) | 111 27 0001, 111 27 0002 … | 111 28 0001 … |
| Nashik Road (110) | 110 27 0001 … | 110 28 0001 … |
| Prayaas (112) | 112 27 0001 … | 112 28 0001 … |

Each centre has its own counter per session (`counters/roll_11127`,
`roll_11027`, …), so the centre prefix and the year never clash. `yy` is the
year the session ends in (11 of its 12 months fall in that year). That is
the same as today's calendar-year rule for January to November; the only
change is that an admission saved in **December** takes the next year's
series. So on 1 December 2026, College Road's next roll is 111270001.

## Problem

Today everything is calendar-year based or all-time:

- Roll numbers use `counters/roll_<prefix><yy>` where `yy` is the calendar
  year (`rollNumberService.js`, `yearSuffix`). A batch that starts in
  April 2026 and one that joins in January 2027 belong to the same session
  but get different series.
- Director, Accountant and counsellor totals add up every admission ever
  saved, or filter by calendar month. Nobody can see "this session" alone,
  and last session's dues mix with this session's.

## Proposal

1. **One setting.** `settings/academic_year` holds
   `{ startMonth: 12, startDay: 1 }` (December), so it can change later
   without a code change. Only the Director
   can change it (the rules for `settings` already limit writes to Director
   and Manager; tighten this doc to Director only).

2. **A field on every admission.** `academicYear: '2026-27'`, set when the
   admission is created, from the admission date and the start date above.
   It never changes afterwards, even when fees are paid in the next session.
   A helper `academicYearFor(date, setting)` lives in `src/utils/` with unit
   tests for the boundary days.

3. **A year picker.** A small dropdown in the staff header (Director,
   Manager, Accountant; counsellors see the current year only). The choice
   is held in a context like `MoneyVisibilityProvider` and every total,
   report and list filters on `academicYear`. "All years" stays available
   to the Director.

4. **Roll numbers per centre and academic year.** The counter becomes
   `counters/roll_<prefix><yy>` where `yy` is the session's first year
   (see the table above: the year the session ends in, Dec 2026 to Nov
   2027 → `27`). Roll format stays `<prefix><yy><4 digits>`, 9 digits,
   so KAP Connect enrollment numbers keep the same shape. The rules regex
   for counters does not change. Reservations in `roll_numbers` keep
   guaranteeing uniqueness across all years.

   Rolls already issued keep their numbers. Rolls issued in past Decembers
   under the calendar rule stay valid; the reservations make sure no new
   roll can repeat them.

5. **Migration (one-off, read-mostly).** A script in `scripts/` like
   `roll-number-scan.mjs` that, for each admission without `academicYear`,
   derives it from `enrollmentDate` or `createdAt` and writes only that
   field. Dry run first (prints counts per centre and year), then a write
   run on the staging project, and on live only after Aditya approves.
   Counters are not touched by the migration.

6. **Year rollover.** No job is needed: the helper decides the year from
   the date. On the start date the picker shows the new session, totals
   start from zero for it, and the first new roll of each centre starts at
   `0001` of the new series.

## Tests

- Unit: `academicYearFor` on the day before, the day of and the day after
  the start date; leap years.
- Rules: only the Director writes `settings/academic_year`; counter ids for
  the new series are accepted.
- Emulator: seed admissions across two sessions, check totals per year and
  that two parallel saves on the first day of a session get `…0001` and
  `…0002`.

## Questions for Aditya

1. ~~On which date does the academic year start?~~ December (answered).
2. Should a student admitted in, say, February for the next session count
   in the next session? If yes, the counsellor needs to pick the session
   at admission time instead of it coming from the date.
