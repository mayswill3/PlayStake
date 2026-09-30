# Policy 04 — Multi-Operator Self-Exclusion (GAMSTOP)

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Head of Compliance |
| **Version** | 0.1 — draft for licence application |
| **Review** | Annually, and on any change to GAMSTOP's integration requirements |
| **Relates to** | LCCP social responsibility code 3.5.6 — participation in the national online multi-operator self-exclusion scheme (GAMSTOP) |

> Draft for review by a compliance adviser. **Status: PlayStake has not yet joined GAMSTOP.** The integration is built and tested, and switches on with configuration once membership and API credentials are in place (section 6).

## 1. Purpose

GAMSTOP lets a person exclude themselves from every online gambling business licensed in Great Britain in one step. Remote operators must take part in the scheme and must not let a GAMSTOP-registered person gamble. This policy describes how PlayStake checks GAMSTOP and acts on the result.

## 2. When PlayStake checks GAMSTOP

The check needs the customer's identity. PlayStake uses the details from their identity-verification submission: legal first and last name, date of birth, postcode and email address.

| When | What happens |
|---|---|
| **Identity verification submitted** | Checked as soon as identity is known, before the account is approved. |
| **Every sign-in** | Checked again on each sign-in. A GAMSTOP outage here never blocks sign-in, because the customer may need to withdraw. |
| **Before any deposit, stake or game entry** | The eligibility check (Master Manual §5.1) uses the stored result if it is under 24 hours old. Otherwise it checks GAMSTOP again first. |

## 3. How the result is used

| GAMSTOP result | What PlayStake does |
|---|---|
| **Registered (excluded)** | The customer cannot deposit, stake or play, and is told why in plain terms. They can still sign in and **withdraw their balance**. They receive no marketing or optional emails. |
| **Previously registered** (exclusion lapsed) | Treated as not excluded for access. The fact is visible to staff on the customer's admin page, and staff may consider it in customer-interaction decisions. |
| **Not registered** | No restriction. |
| **Check could not be completed** (timeout or error) | **Fails closed.** The deposit or stake is refused with a "try again shortly" message, and the failure is logged. If a customer has never been checked, they cannot gamble until a check succeeds. |

**Staff view.** The latest result and the time it was checked are shown on the customer's admin page.

**Launch safeguard.** A production setting (`GAMSTOP_REQUIRED=true`) makes the platform refuse all gambling if the GAMSTOP integration is ever switched off or misconfigured. Gambling can never quietly continue without the check.

## 4. Other controls that work alongside GAMSTOP

- **Signposting.** The Responsible Play page, and the site footer on every public page, tell customers about GAMSTOP and link to it.
- **Our own exclusion.** PlayStake's own self-exclusion (Policy 03) works independently of GAMSTOP, and applies to a person across all of their accounts.

## 5. Records

- **Stored on the account:** the latest GAMSTOP result and the time it was checked.
- **Logged:** failed checks.
- **Not stored:** the details sent to GAMSTOP are not kept in addition to the identity-verification record.

## 6. Go-live steps (outstanding)

1. Apply to join GAMSTOP and sign the operator agreement.
2. Obtain API credentials. Confirm the current API endpoint, the required fields, and how the response is returned. The integration expects GAMSTOP's operator API (form fields: first name, last name, date of birth, email, postcode, mobile; an `X-Exclusion` response header of Y, N or P). *Confirm against GAMSTOP's current specification.*
3. Decide whether to collect a **mobile number** at identity verification, since GAMSTOP accepts it and it may improve matching.
4. Set `GAMSTOP_API_KEY` and `GAMSTOP_REQUIRED=true` in production (and `GAMSTOP_API_URL` if GAMSTOP specifies a different endpoint).
5. Run GAMSTOP's test cases against the staging environment and keep the evidence.
6. Record the go-live date in this policy's version history.

## 7. Review

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft; integration built, awaiting membership |
