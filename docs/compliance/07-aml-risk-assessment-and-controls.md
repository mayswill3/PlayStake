# Policy 07 — Anti-Money Laundering and Counter-Terrorist Financing: Risk Assessment and Controls

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Money Laundering Reporting Officer (MLRO) |
| **Version** | 0.1 — draft for licence application |
| **Review** | **At least annually**, and before launching any new product, game type, payment method or technology, or when a significant new risk or typology is identified (section 9) |
| **Relates to** | LCCP licence condition 12.1.1 (anti-money laundering: assess ML/TF risks and have appropriate policies, procedures and controls, reviewed as necessary and at least annually); Proceeds of Crime Act 2002 (POCA) Part 7; Terrorism Act 2000; sanctions regimes administered by OFSI; the Commission's guidance *"The prevention of money laundering and combating the financing of terrorism — guidance for remote and non-remote operators (excluding casinos)"* |

> Draft for review by a compliance adviser. **Regulatory position:** as a non-casino operator, PlayStake is expected not to be a "relevant person" under the Money Laundering, Terrorist Financing and Transfer of Funds Regulations 2017 (which apply to casino licensees). It is, however, fully subject to POCA, the Terrorism Act and the LCCP. PlayStake nevertheless applies customer due diligence, monitoring and record-keeping to a standard informed by the Regulations. *Confirm this position with legal advisers for the licence type applied for.*
>
> All monetary thresholds below are defaults in the platform, currently in US dollars because payments are in Stripe test mode. They must be converted to pounds sterling and confirmed in this assessment before launch (Master Manual §8 items 6 and 9).

---

## Part A — Risk assessment

### A1. Method

The assessment works as follows:

1. **Identify risks.** Money laundering and terrorist financing risks are identified across six factors: customers, products and games, transactions, delivery channels, payment methods and geography.
2. **Rate inherent risk.** Each risk is rated for likelihood (Low, Medium or High) and impact (Low, Medium or High), before controls, giving an inherent risk.
3. **Rate residual risk.** Each risk is then rated again after PlayStake's controls, giving a residual risk.

**Current assessment.** It is based on the platform as built on 30 September 2026, before real-money launch. There is no live transaction history yet. The first review after launch must use real data (section 9).

### A2. The business model and why it matters

PlayStake customers stake money against **each other** on games they play themselves. PlayStake holds both stakes in escrow and pays the winner, less a platform fee. It never takes a position.

This creates a risk that doesn't exist, or is much smaller, in house-banked betting: **value transfer between customers**. If two accounts are controlled by the same person, or by people acting together, one can deliberately lose to the other. That moves money from one account to another with a gambling transaction as cover. This is "chip dumping" (or "soft play"). The receiving account then withdraws the "winnings". It is the dominant money laundering typology for this business, and most of the controls in Part B are built around it.

### A3. Risk register

| # | Risk | Factor | Inherent (L × I) | Key controls (Part B) | Residual |
|---|---|---|---|---|---|
| 1 | **Chip dumping.** Colluding accounts pass value by losing on purpose. | Product / transactions | High × High = **High** | One-person-one-account screening (B2.3); chip-dumping detection (B3.1); head-to-head cap of 5 matches an hour (B3.2); shared-IP detection (B3.1); withdrawal holds (B4) | **Medium** |
| 2 | **Deposit-and-withdraw without play.** Criminal funds are deposited, lightly played or not played, and withdrawn as apparently legitimate funds. | Transactions | Medium × High = **High** | Deposit-and-withdraw-without-play detection and a real-time withdrawal hold (B3.1, B4); payouts only to a verified bank account (B4) | **Low–Medium** |
| 3 | **Spending the proceeds of crime.** A customer gambles with criminal property, a "lifestyle" risk. | Customers / transactions | Medium × High = **High** | Customer due diligence (CDD) before any deposit (B2); EDD and source of funds over the 30-day threshold (B2.4); affordability markers (Policy 05); per-transaction deposit cap | **Medium** |
| 4 | **Stolen payment methods.** Deposits are made with stolen or compromised cards. | Payment methods | Medium × Medium = **Medium** | Stripe card processing, with 3-D Secure as Stripe applies it by default; chargeback suspension and case (B3.3); *explicit 3-D Secure rules and Stripe Radar rules outstanding* | **Medium** (Low once Radar is live) |
| 5 | **Mule and multiple accounts.** Accounts are opened in other people's names, or one person runs several. | Customers | Medium × High = **High** | Document KYC with selfie and manual review; shared-identity and document-image matching; DOB cross-check; shared-IP detection; *electronic ID with liveness outstanding* | **Medium** |
| 6 | **Result manipulation to move value.** A referee or a player fixes a result. | Product | Medium × High = **High** | Independent referees who are verified, approved per game and never officiate their own matches; hash-chained referee audit; dispute window; overturn tracking; anomaly detection | **Low–Medium** |
| 7 | **Sanctioned persons and PEPs.** | Customers | Low × High = **Medium** | *Screening provider outstanding.* Interim: manual check against the OFSI consolidated list at KYC approval (B2.5). | **Medium**, falling to Low once automated |
| 8 | **Terrorist financing.** Small value transfers, including through the P2P mechanism. | Transactions | Low × High = **Medium** | The same controls as risks 1, 2 and 7; the MLRO reports under the Terrorism Act | **Low** |
| 9 | **Geography.** Customers or funds from high-risk or non-GB jurisdictions. | Geography | Medium × Medium = **Medium** | Country captured at KYC and reviewed at approval; *outstanding for launch: a GB-only restriction, a geolocation check, and automatic refusal of FATF high-risk jurisdictions* | **Low–Medium** |
| 10 | **Insider facilitation.** Staff approve identities improperly, lift restrictions or ignore alerts. | Delivery | Low × High = **Medium** | Staff 2FA; append-only admin audit log; platform-enforced limits on staff actions; quarterly independent review of cases | **Low** |
| 11 | **Streamer and audience channel.** Viewers on Kick challenge streamers; a streamer's audience could be used to channel funds. | Delivery channel | Medium × Medium = **Medium** | All the same controls apply to streamer challenges (it is the same lobby and escrow); referee oversight; head-to-head cap; chip-dumping detection | **Low–Medium** |

**Overall residual risk:** **Medium**. This is driven by risks 1, 3 and 5. It is expected to fall once the outstanding provider-based controls (electronic ID, sanctions/PEP screening, Stripe Radar) are live, and after the first review based on live data.

---

## Part B — Policies, procedures and controls

### B1. Roles

- **The MLRO**, [COMPLIANCE LEAD NAME]:
  - owns this assessment
  - decides AML cases
  - makes Suspicious Activity Reports (SARs) and Defence Against Money Laundering (DAML) requests to the NCA
  - trains staff
  - reports to the board every quarter
- **All staff** must report any knowledge or suspicion of money laundering to the MLRO promptly. They can do this by adding a note to a case in the AML queue, or by telling the MLRO directly. Failing to report is an offence under POCA s.330.

### B2. Customer due diligence

#### B2.1 Before any deposit

Identity is verified before any deposit, any play and any withdrawal (Policy 06):

- legal name, date of birth and address
- a photo identity document and a selfie
- manual review by trained staff

#### B2.2 Ongoing monitoring

- The monitoring in B3 runs on every account.
- Customers' circumstances are reviewed whenever a case is raised.

#### B2.3 One person, one account

At KYC, the new submission is matched against every other account:

- **Same legal name and date of birth, or the same document image** → a `SHARED_IDENTITY` case, and approval is blocked.
- **Document date of birth differs from the one given at sign-up** → a `DOB_MISMATCH` case, and approval is blocked.

#### B2.4 Enhanced due diligence (EDD) and source of funds

- **Trigger:** completed deposits over any 30 days at or above **5,000.00** (setting `AML_EDD_THRESHOLD_CENTS`). This opens a `HIGH_DEPOSIT_VOLUME` case.
- **What the MLRO obtains:** evidence of source of funds, such as payslips, bank statements or other documents appropriate to the amount, and, where needed, source of wealth.
- **What happens meanwhile:**
  - while the case is open, withdrawals are held (B4)
  - the MLRO may suspend the account if evidence is not provided within [14] days
- **Other EDD triggers:** EDD also applies when a customer:
  - is a PEP or connected to one (once screening is live)
  - is linked to a high-risk jurisdiction
  - is the subject of any high-severity case

#### B2.5 Sanctions and PEPs

**Outstanding.** A screening provider is to be appointed.

**Interim control.** Until then, at KYC approval the reviewer checks the customer's name and date of birth against the OFSI consolidated list, and notes the check in the review notes.

**If a customer is a sanctions match:**

1. do not approve the account
2. freeze their funds
3. report to OFSI
4. inform the MLRO

### B3. Transaction monitoring

A scan runs **every 15 minutes**. Its results are cases in the **AML queue** (`/admin/aml`), and each new case alerts the MLRO by email.

#### B3.1 Automated detectors

| Detector | Case type | Triggered when | Severity |
|---|---|---|---|
| **Chip dumping** | `CHIP_DUMPING` (receiver, with the sender linked) | The same two players played **5 or more** times in 7 days, one side won **80% or more** of decided games, and received at least **100.00** net (`AML_CHIP_DUMP_VALUE_CENTS`) | Medium; high at 10+ games or 5× the value |
| **Shared IP, played each other** | `SHARED_IP` (both linked) | Two accounts used the same IP address in the last 30 days **and** wagered against each other | High |
| **Many accounts on one IP** | `SHARED_IP` | Four or more accounts on one IP address in 30 days | Low (for review; households and public networks are common) |
| **Deposit and withdraw without play** | `DEPOSIT_WITHDRAW_NO_PLAY` | Deposits of at least **50.00** in 7 days (`AML_NO_PLAY_MIN_DEPOSIT_CENTS`), at least half withdrawn within 24 hours, and less than a quarter of the deposits staked | Medium |
| **Deposits over the EDD threshold** | `HIGH_DEPOSIT_VOLUME` | See B2.4 | Medium; high at 2× |
| **Identity** | `SHARED_IDENTITY`, `DOB_MISMATCH` | See B2.3 | High / Medium |
| **Chargeback** | `CHARGEBACK` | A card issuer dispute on a deposit | High |

**Signal frequency.** Only one open case exists per customer, type and counterparty, so a continuing pattern doesn't flood the queue.

#### B3.2 Preventive controls

- **Head-to-head cap.** The same two customers can play each other at most **5 times in any hour**. Further matches are refused.
- **No self-play.** The database refuses a bet between an account and itself.
- **Deposit caps.** Each deposit must be between 5.00 and 1,000.00.

#### B3.3 Chargebacks

A card dispute on a deposit has two immediate effects:

- the account is **suspended**, so no stakes or withdrawals can be made
- a high-severity case is opened for the MLRO

### B4. Withdrawal controls

Withdrawals are where laundered funds leave. A withdrawal request is **held for review**, and not paid, when any of these apply:

| Condition | What happens |
|---|---|
| The account is suspended or closed | The withdrawal is refused |
| A **medium- or high-severity** AML case is open on the account | The withdrawal is held. Low-severity cases, such as a shared household IP, do not hold money. |
| The amount is at or above **2,000.00** (`AML_WITHDRAWAL_REVIEW_THRESHOLD_CENTS`) | A review case is opened and the withdrawal is held |
| The withdrawal follows deposits with little play (the B3.1 rule, counting the requested amount) | A `DEPOSIT_WITHDRAW_NO_PLAY` case is opened and the withdrawal is held |

**Customer message.** The customer is told only that the withdrawal "needs a quick review" and that their balance is safe. They are never told about a suspicion.

**Clearing a hold.** When the MLRO closes the case with **no suspicion**, withdrawals of the same kind go through for the following 7 days.

**Where payouts go.** Payouts go only to the customer's own bank account, verified through the payment provider (Stripe Connect), after identity and email verification. *Outstanding: automatically matching the payout account holder's name to the verified legal name. Until then, the MLRO checks this manually for any held withdrawal.*

**Exclusion never traps funds.** Self-exclusion and GAMSTOP registration never block a withdrawal (Policies 03 and 04). Only AML and fraud controls do.

### B5. Case handling and suspicious activity reporting

Every AML case is worked in the AML queue:

1. **Assign.** The investigator or MLRO takes the case.
2. **Investigate.** Review the customer's identity, transactions, betting pattern, counterparties and linked cases. Record notes on the case.
3. **Decide.** The MLRO records the reasoning for every decision on the case. The platform requires it. The decision is one of:
   - **close, no suspicion:** releases held withdrawals of that kind for 7 days
   - **close, action taken:** for example, the account was suspended or closed, or winnings were withheld under the Terms
   - **escalate to the MLRO:** where an investigator has worked the case
   - **SAR submitted:** the MLRO records the NCA reference on the case
4. **Report.** Where the MLRO knows or suspects money laundering or terrorist financing, or has reasonable grounds to, they make a SAR to the NCA through the SAR Online portal as soon as practicable. Where PlayStake would otherwise pay out or process funds it suspects are criminal property, the MLRO requests a **DAML** first, and the funds stay held (the withdrawal hold) until consent is given or the statutory period ends. Every SAR decision is recorded, including decisions *not* to report and why.
5. **Don't tip off.** Nobody may tell the customer, or anyone else, that a SAR has been considered or made, or that an investigation is under way (POCA s.333A). The customer-facing messages are written with this in mind. The AML case page reminds staff.
6. **Notify the Commission** where the LCCP requires it. SARs themselves are not shared with the Commission except as the law allows.

Every action on a case is recorded in the append-only admin audit log.

### B6. Record keeping

The following are kept for **at least 5 years** after the business relationship ends, or after the transaction for occasional transactions:

- CDD records and documents
- transaction and ledger records (the double-entry ledger is immutable by design)
- AML cases and their notes and decisions
- SAR decisions and references

These records are protected from deletion with the customer's account. SAR-related records are held so that they can be produced to the NCA or the courts when required.

### B7. Training

All staff receive AML training before starting and every year after. It covers:

- the offences (POCA ss.327–330 and s.333A; the Terrorism Act)
- PlayStake's typologies, especially chip dumping
- red flags
- how to report to the MLRO
- tipping off

The MLRO keeps training records and tests understanding.

### B8. Governance

The MLRO reports every quarter to the board on:

- case volumes by type
- time to decision
- SARs and DAMLs (numbers only)
- withdrawal holds
- any control weaknesses

The quarterly independent review (Master Manual §3) samples closed cases.

---

## Part C — Review triggers

This assessment is reviewed **at least annually**, and before or immediately after any of these:

- a new product, game type or match type (for example, a new third-party game category)
- a new payment method, currency or payout route, including the move from test mode to live payments in GBP
- new technology, such as a new identity or verification provider, or a change to how results are determined
- entering a new market or jurisdiction
- a significant change in volumes or customer behaviour, or a new typology seen in cases or in Commission or NCA publications
- a material control failure, or findings from the independent review

**The first live-data review** must be carried out **3 months after real-money launch**. It will re-rate each risk using real transaction data and recalibrate the thresholds in B2.4, B3.1 and B4.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft, pre-launch assessment |
