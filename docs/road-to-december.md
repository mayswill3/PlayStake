# Road to December

**PlayStake · Delivery plan · Aug 2026 → Oct 2027**

Four months to a real-money launch, a quarter to automated refereeing, then mobile. The engineering is in better shape than the deployment is, and neither is the thing most likely to move your date — read the verdict first.

> **The honest read**
>
> **Your code is not the constraint. Licensing is.** The ledger design is genuinely strong, the bet lifecycle is well modelled, and 160 tests pass. But you are proposing to take real money from UK consumers for wagered play, and until a lawyer tells you which side of the Gambling Act 2005 you fall on, every other date on this page is provisional.
>
> Get that opinion in September, not November. If you need a UKGC licence, application alone typically runs **4–6 months** and December becomes impossible — so the plan below front-loads it and gives you a defined fallback: launch free-to-play in December, switch on real money when the licence lands.

---

## Phase 0 — Make what you already built actually run

**Late Aug → mid Sep · 3 weeks**

Nothing new gets written this phase. You have working code that isn't deployed and claims on your site that aren't true. Close that gap before adding to it.

### Deploy the worker service `CRITICAL`

Nine background jobs are written, tested, and have never run in production. Add a second Railway service on the same repo with `npx tsx src/workers/index.ts`.

Do it in a watched window. First boot processes a backlog that has accumulated since launch — expired bets get refunded, stale results get settled, anomaly records appear. Snapshot balances before and after, and reconcile.

### Align the public site with reality `LEGAL EXPOSURE`

`/referees/ai` describes an AI Referee in the present tense — "runs server-side for every match", "a deterministic validator". `/how-it-works` tells players they can choose it. It does not exist; there is no rules engine in the codebase.

Rewrite as roadmap language or remove the pages. Advertising a safety mechanism you don't have is a consumer-protection problem before it's a marketing one, and it's the kind of thing that surfaces badly in diligence.

### CI that runs the tests

You have a malware scan in CI but nothing that runs the 160-test suite on push. Today's bug — a widget calling a deleted API surface, failing silently for months — is exactly what a green-build gate catches.

### A staging environment

You currently test on production because there is nowhere else. Stand up a second Railway environment with its own database so the December launch isn't the first time a release meets a non-developer.

### Error tracking and uptime alerting

Sentry or equivalent, plus an uptime check. Right now a 500 on a payment route is invisible unless a user tells you.

> **Exit gate:** Workers running and reconciled · site claims match implementation · CI green on every push · staging live · you get alerted before users complain.

---

## Phase 1 — Regulatory and money readiness

**Sep → Oct · 6 weeks, runs in parallel**

The long pole. Start every item in the first week of September, because the external dependencies here do not compress.

### Legal opinion on gambling classification `BLOCKER · START WEEK 1`

Instruct a gambling-regulation solicitor. The question: does skill-based P2P wagering with a platform rake constitute licensable gambling in Great Britain, and does any skill exemption apply to your specific game set?

The answer determines everything downstream. Budget £5–15k for a proper written opinion. This is the single highest-leverage spend on this page.

### Licence application, if required `4–6 MONTHS`

A UKGC remote operating licence needs corporate structure, policies, financials, personal management licences for key people, and fees. If the opinion says you need one, December real-money launch is off — go to the fallback plan below.

### Real KYC and age verification

`kycStatus` exists on the user model and an admin can set it by hand, but nothing is integrated and nothing gates deposits or withdrawals on it. Your trust section already claims KYC.

Wire up a provider (Stripe Identity, Onfido, or Persona), enforce 18+, and gate withdrawal on verified status at minimum — deposit too if the legal opinion requires it.

### Responsible play controls

None of this exists today. Even outside a licensing requirement, a real-money wagering product without it is indefensible:

- Deposit limits — daily, weekly, monthly, user-settable
- Self-exclusion and cool-off periods
- Session time reminders
- Loss-chasing detection feeding your existing anomaly worker
- GAMSTOP integration if you end up licensed

### AML and transaction monitoring

Source-of-funds checks above thresholds, suspicious activity procedures, and a named responsible person. Your ledger already gives you the audit trail most startups lack here — that's a genuine head start, but the policy layer still has to exist.

### Stripe live-mode approval

Your own code fails closed on anything but a test key, with the comment "not approved for live Stripe processing". Stripe must underwrite you for this business category, and they will ask about licensing — which is why this follows the legal opinion rather than preceding it.

> **Exit gate:** Written legal opinion in hand · KYC enforced in code · responsible-play controls shipped · Stripe live approval granted or a documented reason it hasn't been.

---

## Phase 2 — Product completeness

**Oct → Nov · 6 weeks**

Turn a working demo into something a stranger can use unsupervised. This is where your two hires earn their keep.

### Both hires onboarded `PEOPLE`

Start recruiting in September so they're productive by October. The QA hire should own the test suite, CI, and a written release checklist from day one — that's the gap that produced today's findings.

### Human referee operations

The code path works, but the operation around it doesn't exist: recruiting referees, vetting them, training on what constitutes evidence, paying them, and measuring decision quality. Referees currently need a linked Kick account and manual admin approval.

You need enough approved referees to cover your expected match volume at peak, or the refereed game modes can't launch.

### Dispute resolution at scale

Define an SLA, build the queue tooling, and decide who works it. Every dispute currently lands on an admin with no time guarantee. This is the thing that generates chargebacks and complaints if it's slow.

### Mobile experience

Your audience is gamers and streamers, and a meaningful share will arrive on a phone from a Kick link. Audit and fix the full journey on mobile — signup, deposit, lobby, match — not just the landing page.

### Load and concurrency testing

Never done. The risky paths are the ones with money and races in them: simultaneous invite acceptance, escrow under concurrent settlement, the SSE lobby stream under many connections. Your ledger uses atomic conditional updates, which is the right design — prove it holds under contention.

### Support and comms

A support inbox, a help centre covering deposits, withdrawals, and disputes, and a status page. Email is currently the weakest link in your stack — verify Resend is configured and deliverable before real users depend on password resets.

> **Exit gate:** A stranger can sign up, deposit, play, dispute, and withdraw on a phone without you intervening · referee bench staffed · load tests pass.

---

## Phase 3 — Launch

**Nov → Dec · 5 weeks**

Prove it under real load with real people, at a stake ceiling low enough that mistakes are survivable.

### Independent security review `BOOK EARLY`

A penetration test focused on the money paths: auth, session handling, the ledger boundary, webhook signature verification, and the widget token flow. Good firms book weeks out — schedule it in October for a November slot.

### Closed beta from your signup list

You already have real signups, including people who selected "investor" and "streamer". Invite in waves of 20–50 with capped stakes. Watch the ledger audit output daily.

### Incident response runbook

Written procedures for: settlement stops working, a deposit double-credits, escrow doesn't balance, a dispute backlog builds. Include who is on call and how you pause the platform. Decide these while calm.

### Financial reconciliation

Daily automated check that Stripe's balance matches your ledger's view of deposits minus withdrawals. Your conservation audit covers internal consistency; this covers the boundary with the outside world, which is where real discrepancies live.

### Public launch with a stake ceiling

Open registration, keep maximum stakes low for the first month, raise deliberately once reconciliation has been clean for several weeks.

> **Exit gate:** Clean pen-test report · closed beta with zero unexplained ledger discrepancies · reconciliation automated · on-call rota in place.

---

## Phase 4 — Automated refereeing

**Jan → Mar 2027 · a quarter**

Your own documentation already describes the right design. Build that, and resist the temptation to make it cleverer.

### Build the deterministic validator first `GOOD INSTINCT`

Your `/referees/ai` page says it plainly: "not a chatbot or a machine learning model making probabilistic guesses — a deterministic validator". That is exactly right, and it's the version you should build. For your own games you control the event stream, so you can replay a match and check the reported result is consistent with what happened. No model required.

This is a rules engine, not AI, and it will be more defensible to a regulator precisely because it's explainable.

### Sequence it

- **Jan** — canonical game-event schema and an append-only event log per match
- **Jan–Feb** — per-game validators for the three built-in games, running in shadow mode alongside existing settlement
- **Feb** — compare validator output against actual outcomes across every historical match; you should be at 100% before trusting it
- **Feb–Mar** — escalation rules: anything ambiguous goes to a human referee rather than guessing
- **Mar** — enable for real settlement on built-in games only

### Where ML genuinely helps — later

Externally-played titles (Call of Duty, FC 26, Rocket League) have no event stream you control, so a deterministic validator can't reach them. That's where vision models on stream footage or scoreboard OCR would apply. Treat it as a separate project after the rules engine has earned trust, and keep a human in the loop on anything it decides.

### Keep humans in the system

Automation should reduce referee load, not eliminate the role. Your human bench is the escalation path, the fallback when the validator is uncertain, and the thing that makes the automated layer defensible.

> **Exit gate:** Validator agrees with 100% of historical outcomes in shadow mode · escalation path tested · live on built-in games with human fallback intact.

---

## Phase 5 — Mobile: challenge, spectate, referee

**Apr → Oct 2027 · two quarters**

Three features, one app. Two of them are mostly built already on the server; the third — spectating — is the hardest engineering on this entire roadmap.

### Read this before scoping anything else `HARD GATE`

Both app stores treat real-money wagering as a restricted category. Apple's Guideline 5.3 requires the app to be submitted by a legal entity *holding the necessary licences*, geo-restricted to permitted territories, and free to download. Google Play's real-money gambling policy works similarly, with its own application and a limited country list.

So a native app is gated on licensing even harder than the website is. No licence, no App Store — there is no workaround, and building the app first doesn't help you.

One genuine upside: when you are licensed, Apple does not treat real-money gaming deposits as in-app purchases, so you keep your payment rail and avoid the 30% cut. Confirm current terms before you rely on it.

### 5a · Ship a PWA first `CHEAP, NO GATEKEEPER`

**Apr–May.** A progressive web app sidesteps store policy entirely and tells you whether people actually want mobile before you spend two quarters on native. You already have `src/app/manifest.ts` with `display: standalone`, so you're partway there — though its colours are stale, still on the pre-rebrand palette rather than the lime.

Add web push (iOS supports it for home-screen PWAs), an install prompt, and an offline shell. If the PWA gets no traction, that's a very cheap lesson.

### 5b · Challenges — mostly server-side already

**Apr–May.** The endpoints exist: lobby invites, streamer challenges, the whole respond flow. Mobile mainly needs push notifications on top.

But there's a product problem to solve first. **Your lobby invite expires in 60 seconds.** That works when both people are sitting at a lobby screen; it's useless as a phone notification. You need a second concept — an asynchronous challenge with a much longer window, that a person can accept from a notification hours later — alongside the existing live invite. That's a schema and service change, not a UI one.

### 5c · Spectating — the hard part `UNDERESTIMATE THIS`

**May–Aug.** Everything real-time you have today is one-to-few: a lobby stream serving the handful of people in it. Spectating is one-to-many, and the architecture is genuinely different.

- **Fan-out** — match state to arbitrarily many viewers. Redis pub/sub into a connection layer built for it; your cost scales with concurrent viewers, so model that before you build.
- **Two very different match types** — for Kick-streamed matches you embed the streamer's video. For built-in games you have to build a spectator renderer per game, replaying state. These share almost no code.
- **Deliberate delay** — spectators must never see state before the players do. A 10–30 second delay is standard in esports and prevents stream-sniping. Build it in from the start; retrofitting it is painful.
- **Integrity** — an audience watching live wagers is one short step from in-play betting, which is a materially different regulatory product. Decide deliberately whether you're going there.

### 5d · Referee from your phone `ECONOMICS ALREADY BUILT`

**Jun–Aug.** This is the strongest of the three ideas, because it solves a supply problem rather than adding a feature. Refereeing needs people available on demand, and a phone in a pocket is exactly the right form factor.

The money side already works: `payRefereeFee` exists in the ledger, pays 10% of the platform fee from platform revenue rather than the players' pot, and has its own `REFEREE_FEE` transaction type. You are surfacing an existing mechanism, not inventing one.

What mobile adds: push for assignment offers, a fast claim flow before another referee takes it, evidence capture straight from the camera, and an earnings view. The camera piece is a real upgrade on the web experience — photographing a scoreboard is natural on a phone and awkward on a laptop.

### Paying referees creates reporting obligations `EASY TO MISS`

Once people earn money through your platform, you are a digital platform with reporting duties. UK rules require platforms to collect and report seller income to HMRC annually. Referees are also self-employed contractors, not employees — worth getting the engagement terms right early rather than unpicking it later.

Not hard, but genuinely easy to forget until the first tax year closes on you.

### 5e · Native apps, only once licensed

**Aug–Oct.** React Native via Expo is the obvious route — same language as your existing stack, so your team and a good chunk of your logic carry over. Budget for store review cycles on a restricted category being slow and occasionally opaque.

### Mobile makes API versioning mandatory

Worth sitting with, given what we found this morning: a widget calling `/api/v1/bets` after that surface was removed, failing silently for months. On the web you fixed it with a deploy. **You cannot force every phone to update.**

Before the first app ships you need real API versioning, a deprecation policy, and a minimum-supported-version check that can tell an old client to upgrade. Today's bug was embarrassing; the same bug with ten thousand installed apps is an outage you can't deploy your way out of.

> **Exit gate:** PWA validated demand before native spend · spectator delay and fan-out load-tested · referee supply measurably improved by mobile · API versioning and forced-upgrade path live · both stores approved.

---

## What could move the date

Ordered by how likely each is to actually cost you December.

| Risk | Impact | What to do about it |
|---|---|---|
| **Licence required** | December real-money launch impossible | Legal opinion in week 1 of September. Fall back to free-to-play launch in December, real money when licensed. |
| **Stripe declines the category** | No payment rail at all | Apply early. Research a gambling-friendly PSP as backup before you need one. |
| **Hiring slips** | Phase 2 compresses into Phase 3 | Start recruiting September. Consider a contractor for the QA work if permanent hiring is slow. |
| **Two-person key-person risk** | Illness or departure stops everything | Document deployment and on-call now. Today's finding — workers never deployed — is what undocumented infrastructure looks like. |
| **Not enough referees** | Refereed game modes can't launch | Recruit from your Kick streamer relationships in October. Model the ratio you need at peak. |
| **App store rejects the category** | No native app at all, whatever you build | Confirm eligibility with both stores *before* Phase 5 scoping. Ship the PWA regardless — it has no gatekeeper. |
| **Spectator costs scale badly** | Watching becomes a loss-making feature | Model cost per concurrent viewer during design, not after launch. Cap free concurrency if needed. |
| **Ledger discrepancy in beta** | Launch pauses until root-caused | Daily reconciliation from day one of beta so you find it at £50, not £5,000. |

---

## The December fallback

Worth deciding now, while it's a strategy rather than a scramble.

> **If licensing isn't resolved by November**
>
> Launch in December as **free-to-play with no real money**. Everything you've built still runs — lobby, matchmaking, referees, the full bet lifecycle, the ledger — with stakes denominated in a non-cash balance. You get real users, real load, real dispute volume, and real product feedback, all without the regulatory surface.
>
> Then switch on real money the day the licence lands. The code already supports this cleanly: your payment layer *already* fails closed on a single environment check, so the switch is genuinely a configuration change rather than a rewrite.
>
> This is also a better investor story than a slipped date. "We chose to prove the product with real users while the licence processes" is a plan. "We're waiting" is not.

---

*Built from the working tree at `badfa28`. Findings on the worker deployment, the AI Referee pages, and the KYC integration were verified against the code and the live Railway project on 25 August 2026. Salary, legal, and licensing figures are UK market estimates and should be confirmed with a solicitor and a recruiter respectively — they are the least certain numbers on this page.*
