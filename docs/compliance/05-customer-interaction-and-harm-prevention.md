# Policy 05 — Customer Interaction and Harm Prevention

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Safer Gambling Lead |
| **Version** | 0.1 — draft for licence application |
| **Review** | Annually; the effectiveness data (section 6) is reviewed every quarter |
| **Relates to** | LCCP social responsibility code 3.4.3 (customer interaction, remote) and the Commission's customer interaction guidance ("identify, act, evaluate"); financial vulnerability / affordability requirements; restrictions on marketing to customers at risk; the requirement to offer financial limits |

> Draft for review by a compliance adviser. **The Commission's current thresholds for financial vulnerability checks and its rules on prompting customers to set limits must be confirmed, and PlayStake's thresholds set to match** (see section 3.2 and Master Manual §8 item 16).

## 1. Purpose

PlayStake must spot customers who may be experiencing, or be at risk of, gambling harm, act quickly and appropriately, and check whether what it did worked. This policy describes the system that does that.

**Scale does not excuse us.** Player-versus-player wagering on competitive games can be fast, emotional and repeated: a loss invites a rematch. PlayStake treats harm prevention as a core function, not an add-on.

## 2. Tools every customer has

These tools are available to every customer, from **Responsible Play** in their account:

- **Deposit limits:**
  - daily, weekly and monthly, over rolling periods
  - lowering a limit takes effect immediately
  - raising or removing a limit only takes effect after 24 hours, so it can't be done in the heat of a session
- **A limit prompt before the first deposit.** Before their first deposit, every customer must either set a deposit limit or actively decline to. The platform enforces this, not just the page, and records the answer.
- **Cool-off breaks and self-exclusion.** See Policy 03.
- **Reality checks:**
  - optional reminders every 15, 30, 60 or 120 minutes
  - each one shows how long the customer has been playing, how many bets they have placed, how much they have staked, and their net result
  - each one offers to take them to Responsible Play
  - they run on the dashboard and on the game pages
- **Support information** from GamCare and BeGambleAware, and GAMSTOP signposting.

## 3. Identify: markers of harm

A scan runs **every 15 minutes**. It covers every customer who has played or deposited in the last 24 hours and looks for these markers:

| Marker | Triggered when | Severity |
|---|---|---|
| **Loss chasing — stakes** | Three or more consecutive losses in 24 hours, with the last stake at least double the first | Low at 2×, medium at 3×, high at 4× |
| **Loss chasing — deposits** | Three or more deposits in 24 hours, each within 30 minutes of a losing result | Medium; high at six or more |
| **Rapid deposits** | Five deposits in an hour, or ten in 24 hours | Medium; high at double those numbers |
| **High deposit volume (affordability)** | Completed deposits over 30 days at or above the affordability threshold (setting `AFFORDABILITY_REVIEW_THRESHOLD_CENTS`; currently 2,000.00) | Medium; high at double |
| **Late-night play** | Five or more bets settled between midnight and 6am UK time in 24 hours | Low; medium at ten or more |

**Signal frequency.** Each marker raises a signal at most once in 24 hours per customer, or once in 30 days for high deposit volume, so a single episode doesn't flood the queue.

**Other indicators staff consider during review.** Some indicators are not yet automated. Staff consider them whenever they review a customer. They are:

- how the customer uses the gambling management tools, such as raising or removing limits or ending breaks
- repeated declined deposits or cancelled withdrawals
- time spent on the site
- a complaint or other contact that suggests distress
- anything else the customer tells us

**Customer-led contact.** Any contact from a customer that suggests harm, whether a complaint, an email or something else, must be recorded by staff as an interaction on that customer (see section 4.2).

### 3.1 Customers we already know about

Some customers are already handled before any scan runs. If a customer has self-excluded, is on a break, is registered with GAMSTOP, or has a restricted account, they cannot gamble at all.

### 3.2 Affordability and financial vulnerability

**Current threshold.** The high-deposit-volume marker is PlayStake's affordability trigger. It is set at 2,000.00 of deposits over 30 days.

**Aligning with the Commission.** Before launch, this threshold must be set at or below the level at which the Commission requires financial vulnerability checks. Our AML enhanced due diligence threshold (Policy 07, 5,000.00 over 30 days) requires source-of-funds evidence. Customers who cannot show that their spending is affordable are restricted.

**Planned improvement.** Adding a credit-reference-based financial vulnerability check is a planned improvement once a provider is appointed.

## 4. Act

### 4.1 Immediately, and automatically

When a marker is raised, three things happen straight away:

1. **The customer is contacted.** The next time they are on the site (dashboard or games), they see a supportive message suited to the marker. For example, for loss chasing: *"We noticed your stakes have been going up after a run of losses. Chasing losses is one of the most common ways gambling stops being fun…"*. Every message includes GamCare's free 24/7 number.
   - The message stays until the customer responds. They can:
     - set a deposit limit (taken straight to Responsible Play)
     - take a break
     - say they're OK
   - Their response is recorded.
2. **Marketing stops.** For 30 days after a marker, the customer receives no marketing or optional emails, unless staff review and dismiss the signal.
3. **Staff are alerted.** The Safer Gambling Lead receives an email alert linking to the signal.

### 4.2 Staff review

Every signal appears in the **Harm signals** queue (`/admin/harm-signals`). For each signal, staff see:

- what was observed and over what period
- the customer's deposits and stakes over the last 30 days
- the customer's other signals
- every past interaction with the customer

Staff decide what is proportionate, from light-touch to strong:

| Step | When | How it's recorded |
|---|---|---|
| Record a note | The automated message is enough; watch for recurrence | Interaction (note) |
| Email or phone the customer | Medium or high severity, repeated signals, or no response to the automated message | Interaction (email / phone call), with a follow-up date |
| **Apply a deposit limit** | Spending looks unaffordable, or the customer agrees to one | Interaction (deposit limit applied). The platform only allows staff to *lower* a limit, never raise it. |
| **Apply a cool-off** | Signs of acute harm, or the customer asks | Interaction (cool-off applied) |
| **Suspend the account** | Serious concern, or no engagement after repeated interactions | Account status change with a reason (audited) |
| Close the account | Customer request, or strong evidence of harm | Account status change with a reason (audited) |

**Closing the review.** Staff close the signal as **reviewed** or **dismissed**, with notes explaining what they found and decided. This is recorded in the admin audit log.

**Target times:**

- high-severity signals: reviewed within 24 hours
- all others: within 5 working days

**Staff conduct.** Staff never encourage further gambling, and never offer bonuses or incentives to a customer with an open signal. PlayStake does not currently run bonuses at all.

## 5. Evaluate

**Automatic evaluation.** Fourteen days after each interaction, the platform compares the customer's deposits and stakes in the 14 days before the interaction with the 14 days after, and records the outcome:

| Outcome | Meaning |
|---|---|
| Customer took a break | A cool-off or self-exclusion was started after the interaction |
| Customer set a limit | A deposit limit was set or changed after the interaction |
| Behaviour improved | Deposits plus stakes fell to 75% or less of the previous 14 days |
| Behaviour unchanged | No meaningful change. **Staff are alerted to consider a stronger step.** |

**Manual outcomes.** Staff can also record outcomes themselves, such as "escalated" or "no response".

## 6. Measuring effectiveness

The Harm signals page includes an effectiveness table. For each marker and each type of interaction, it shows how many interactions led to each outcome. Every quarter, the Safer Gambling Lead:

1. reviews the table, alongside complaint and self-exclusion trends
2. decides whether each automated message, threshold and staff response is working
3. adjusts thresholds, messages or escalation rules where it is not
4. records the conclusions and any changes in the quarterly board compliance report and in this policy's version history

## 7. Training

Everyone who works with customers or the admin tools is trained before starting, and every year after. The training covers:

- recognising the signs of gambling harm
- how to have a supportive conversation
- what the platform does automatically
- how to record interactions
- when to escalate

## 8. Records

These records are kept even if the customer's account is later deleted, for at least 5 years:

- signals
- interactions
- responses
- outcomes
- review notes

## 9. Review

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft |
