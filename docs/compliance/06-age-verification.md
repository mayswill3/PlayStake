# Policy 06 — Age Verification

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Head of Compliance |
| **Version** | 0.1 — draft for licence application |
| **Review** | Annually, and when an electronic verification provider is appointed |
| **Relates to** | Licensing objective 3 (protecting children); Gambling Act 2005 ss.46–47 (inviting or permitting a child or young person to gamble); LCCP social responsibility code 3.2.11 (remote age verification: verify age before a customer can deposit, access free-to-play games, or gamble); LCCP customer identity verification requirements |

> Draft for review by a compliance adviser. LCCP references to be confirmed against the current version.

## 1. Purpose

Nobody under 18 may gamble with PlayStake. Remote operators must verify a customer's age **before** they can deposit, access free-to-play games, or gamble. This policy explains how PlayStake does that and what happens if an under-18 gets through.

## 2. Principles

- **Verify first.** Age is verified before any deposit, any free-to-play game, and any gambling. No product lets anyone play first and verify later.
- **Fail closed.** Anything short of full verification blocks all gambling.
- **No shortcuts.** Staff cannot mark a customer as age-verified without an approved identity document showing they are 18 or over. The platform enforces this.

## 3. How age is verified

### 3.1 At sign-up

- **Email sign-up.** Customers who sign up with email must give their date of birth and actively tick a box confirming they are 18 or over. The box also confirms that their age and identity will be checked before they can deposit or play. Anyone whose date of birth makes them under 18 is refused, and no account is created. The date of birth and the time of the confirmation are recorded.
- **Google sign-in.** Customers who sign in with Google do not give a date of birth at sign-up. They go through exactly the same identity verification (section 3.2) before they can deposit or play.
- **Marketing.** Marketing consent is a separate, unticked, optional box.

**Sign-up does not verify age.** It only stops an under-18 who admits their age from opening an account. Verification happens in section 3.2.

### 3.2 Identity and age verification (KYC)

Before any deposit, free-to-play access or gambling, the customer must complete identity verification. The steps are:

1. **Email address verified first.**
2. **Details and documents submitted.** The customer enters their legal name, date of birth and address, and uploads:
   - a passport (photo page), a driving licence (front and back) or a national ID card (front and back)
   - a selfie
3. **Automatic checks when submitted:**
   - the date of birth entered must show the customer is 18 or over
   - files must be genuine images or PDFs (checked from the file contents, not the file name) and no larger than 8 MB
   - documents are encrypted as soon as they are received (AES-256-GCM)
4. **Identity screening:**
   - the document date of birth is compared with the one given at sign-up; a mismatch opens a case and blocks approval
   - the same name and date of birth, or the same document image, on another account opens a case and blocks approval (one person, one account)
   - GAMSTOP is checked (Policy 04)
5. **Manual review by trained staff**, at `/admin/kyc`. The reviewer checks that:
   - the document is genuine and unaltered, and not expired
   - the name and date of birth on the document match what the customer entered
   - the selfie matches the document photo
   - the address is plausible and consistent
6. **Age re-checked at approval.** When the reviewer approves, the platform re-checks age from the document's date of birth. It refuses approval if the customer is under 18, and tells the reviewer to close the account as under-18 instead.
7. **Decision.** Every approval and rejection is recorded, with the reviewer and their notes, in the admin audit log. A rejection must include a reason, which the customer is told.

**Outstanding (Master Manual §8 item 4).** An electronic identity and age verification provider will be added to supplement manual review. It will provide document-authenticity checks, liveness detection and a credit-reference or electoral-roll age check. Until then, every submission is reviewed manually and nothing is approved automatically.

### 3.3 Where verification is enforced

The eligibility check (Master Manual §5.1) requires verified identity for every one of these actions:

| Action | Blocked until verified? |
|---|---|
| Depositing | Yes |
| Entering the games (`/play`), including free-to-play games | Yes |
| Joining a lobby, sending or accepting an invite, issuing or accepting a challenge | Yes |
| Having a stake locked when an opponent accepts a match | Yes (the opponent is re-checked) |
| Withdrawing | Yes |
| Applying to be a referee | Verified identity is required before approval and before officiating |

**Explaining the block.** A notice on the games page tells an unverified customer they can't play yet and links to verification.

**No manual override.** Staff cannot set a customer to "verified" by hand unless an approved identity document shows they are 18 or over. The attempt is refused.

## 4. If an under-18 is found

An under-18 may be found in several ways: at verification, through a document review, a report from a parent, or information from a payment provider. Whenever it happens, staff act at once:

1. **Close the account as under-18** from the customer's admin page, giving a reason. The platform then automatically:
   - **voids every unsettled bet** they are party to, returning both players' stakes, because an under-18 cannot lawfully win or lose a bet
   - withdraws their lobby entries, invites and challenges
   - signs them out everywhere and prevents them signing in again
   - records the action, including their balance at the time and the voided bets, in the admin audit log
2. **Return their money.** The Head of Compliance arranges for the account's deposits to be returned to their source, outside the platform. Winnings are not paid.
3. **Review settled bets.** For bets that settled before the account was closed, the Head of Compliance reviews each one:
   - stakes the customer lost are returned as part of step 2
   - opponents who lost money to the under-18 are refunded by PlayStake where appropriate
   - every decision is recorded on the customer's record
4. **Consider reporting.** Decide whether to report to the Gambling Commission (for example, as a key event if a control failed) and whether safeguarding concerns need to be raised.
5. **Learn.** Establish how the customer got through verification, and fix the cause.

An under-18 closure **cannot be reversed**. Someone who has since turned 18 must open a new account and be fully verified.

## 5. Marketing and product design

- PlayStake's marketing is aimed only at adults. It does not use content, games, influencers or channels with particular appeal to under-18s.
- The site footer and every email footer state "18+ only", and the Terms of Service set 18 as the minimum age. Email footers also carry GamCare's free support number.
- Streamer partners on Kick must be over 18 and verified. Their PlayStake content must not target under-18s.

## 6. Monitoring and testing

The Head of Compliance carries out checks every quarter:

- **Sample check.** Re-check a sample of approved identity verifications against their documents.
- **Test the controls.** Confirm that an unverified test account cannot deposit, enter the games or stake. The automated test suite also checks this on every code change.

The results are included in the quarterly board compliance report.

## 7. Records

- **Identity documents:** kept encrypted for the retention period in the Privacy Policy. They are only ever decrypted when a reviewer deliberately opens them.
- **Verification decisions:** kept even if the account is deleted, and recorded in the audit log.
- **Under-18 closures:** permanent on the account.

## 8. Review

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft |
