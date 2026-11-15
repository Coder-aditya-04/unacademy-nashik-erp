# Payments ledger: design note

Status: proposal for review. No code or data changes yet.

## Why

Fees are the one thing the ERP owns that other apps will read. KAP Connect will show parents what was paid and what is due. Today the money for an admission lives in three fields on the `admissions` document, and they can disagree:

| Field | Meaning today | Written by |
|---|---|---|
| `amount` | total agreed fee | AdmissionForm, paymentService, accountant correction, plan change |
| `totalPaid` | running total paid | every payment path, by hand in the accountant correction |
| `payments[]` | history array (amount, date, mode, type, remarks) | every payment path |
| `refundAmount` | sum of refunds | refund, edit, delete |

Problems found in the code:

1. **The history can be rewritten.** Editing or deleting a payment rewrites the whole `payments` array (StudentManager). PR #2 put this in a transaction, but a past receipt can still change silently. No one can tell what was changed, or by whom.
2. **The accountant correction rescales history.** `AccountantDashboard.handleSaveEdit` sets `totalPaid` by hand, then multiplies every past payment by `new / old` so the array still sums to the total. Receipts already handed to parents stop matching the record.
3. **There is no single source of truth.** `totalPaid` and `sum(payments)` differ for older records (the "legacy initial" amount that StudentManager works around). Different screens compute the balance differently.
4. **Status is mixed with money.** `REFUNDED` is set whenever `refundAmount > 0`, and that zeroes the balance on every screen, even for a partial refund.
5. **There are no receipt numbers.** A payment has no stable id, so a receipt, a parent app, or a bank reconciliation can't refer to one.

## Proposal

Make each payment an immutable document, and treat the admission's money fields as a cache that the ledger can always rebuild.

```
admissions/{admissionId}
  amount, totalPaid, refundAmount, balance    <- cached totals, rebuilt from ledger
  ledgerVersion: 1                            <- set once migrated

admissions/{admissionId}/ledger/{entryId}     <- append-only
  type:      PAYMENT | REFUND | LOAN_DISBURSAL | FEE_SET | FEE_ADJUST | REVERSAL
  amount:    integer rupees (positive; REFUND/REVERSAL subtract)
  mode:      Cash | UPI | ... (payments only)
  receiptNo: "111-26-000123" (per centre-year counter, like roll numbers)
  reverses:  entryId (REVERSAL only)
  remarks, proofImage?
  at:        serverTimestamp
  byUid, byName
```

The rules:
- **Never edit or delete an entry.** To fix a mistake, add a `REVERSAL` that points at the wrong entry, then add the correct entry. Firestore rules enforce this: `ledger` entries allow create only, never update or delete.
- **Fee changes are entries too.** A plan change, a discount or a correction to `amount` is a `FEE_SET` / `FEE_ADJUST` entry. The "scale history" correction goes away.
- **Totals in the same transaction.** Writing an entry updates `totalPaid`, `refundAmount` and `balance` on the admission in the same transaction. A rule checks the totals moved by exactly the entry's amount, so a client can't drift them.
- **Receipt numbers** come from `counters/receipt_<prefix><yy>`, allocated in the same transaction, using the same pattern as roll numbers.
- **Status is derived, not stored as money.** `REFUNDED` means a full refund only. A partial refund lowers `totalPaid` and leaves the balance correct.

## What other apps read

KAP Connect and KAP Core read through one read-only view per student, keyed by roll number (which is the same as the enrollment number). Two options to choose from later:
- a Cloud Function (the project is on Blaze) that returns `{ rollNumber, amount, totalPaid, balance, nextDue, ledger[] }` with a service key, or
- a mirrored `fee_summaries/{rollNumber}` document, kept up to date by a function trigger.

Either way, other apps never write fee data.

## Migration (later, separate PR, after sign-off)

1. Run a read-only report: for every admission compare `totalPaid`, `sum(payments)` and `refundAmount`, and list the mismatches. This is the same style as `scripts/roll-number-scan.mjs`.
2. Accounts resolves the mismatches by hand.
3. A backfill script writes one ledger entry per existing `payments[]` item. If `totalPaid` is still higher than the sum, it adds one `OPENING_BALANCE` entry for the difference. Then it sets `ledgerVersion: 1`.
4. Screens switch to reading the ledger for any admission with `ledgerVersion: 1`, falling back to `payments[]` otherwise. Once every admission is migrated, `payments[]` becomes read-only.
5. Deploy the rules that lock `totalPaid`, `refundAmount` and `payments` against direct edits.

## Open questions for Aditya / Accounts

- Should receipt numbers restart every year per centre, or never restart?
- Who may record a reversal: only the Director, or Accountants too?
- Is a partial refund common? Should it keep the student ACTIVE?
- Does the bank or Tally reconciliation need anything on the entry, such as a UTR or cheque number?
