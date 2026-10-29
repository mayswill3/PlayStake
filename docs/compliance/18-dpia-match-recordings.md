# Document 18 — Data Protection Impact Assessment: Match Recordings

| | |
|---|---|
| **Controller** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Head of Compliance; [DPO OR PRIVACY LEAD] |
| **Version** | 0.1 — first draft for review |
| **Review** | Before recording is switched on for real customers; then annually, and on any change to what is recorded, who can watch, the storage provider or retention |
| **Relates to** | UK GDPR Articles 5, 6, 13, 28, 35 and 44–49; Gambling Commission LCCP (fair and open gambling, complaints and ADR); Documents 01, 02, 08, 13; Match Rules (recording rule) |

> First draft prepared on 26 October 2026 from the recorder as built. `[BRACKETS]` and the questions in section 8 must be answered, ideally with legal or data-protection advice, before recording is switched on (`RECORDING_ENABLED`). A DPIA is required because the processing systematically records every customer's video and voice at every refereed match, and because the recordings may show third parties and the inside of people's homes.

## 1. What the processing is

Every refereed match is recorded by PlayStake so that a dispute or complaint can be decided on evidence that PlayStake holds, rather than on Kick's past broadcasts, which players can delete.

1. When the referee clicks **Start match**, PlayStake's recorder service opens a private recording page that shows both players' and the referee's Kick streams (through Kick's own embedded player), the match clock, the real time, match events and match chat.
2. The recorder captures that page and the sound of all three streams into one 1080p video, uploading it in 5-minute pieces while it records.
3. When the referee records the result (or the match is cancelled, or reaches the 2-hour limit) the recording stops. The pieces are joined into one file, its SHA-256 fingerprint is written into the match's hash-chained referee audit trail, and the file is stored privately in Cloudflare R2.
4. Only PlayStake admins and approved dispute reviewers who pass the conflict checks (Document 01) can watch a recording, and only from the dispute it belongs to. Each viewing uses a private link that expires after 15 minutes and is logged in the admin audit log.

5. **Voice chat (added 29 October 2026).** The two players and the referee can talk live in a match voice room (LiveKit). Only those three can join, only while the match is live; microphone only. The room is recorded as audio by LiveKit straight into the same private R2 bucket; when a recording finishes its SHA-256 is sealed into the audit trail, and it is kept and deleted exactly like the stream recording. Reviewers listen from the dispute; each listen is logged.

Players and referees are told in the Match Rules, which they must accept (versioned) before playing or officiating, and in the Privacy Policy.

## 2. Data, people and volumes

| Item | Detail |
|---|---|
| **Data subjects** | Players and referees in refereed matches; anyone who appears or is heard on their streams (family, housemates, Kick chat shown on screen) |
| **Personal data** | Voice-chat audio between the players and the referee; video and sound of each stream (face, voice, surroundings, anything shown on screen), display names, Kick channel names, match chat, match events and times; viewing log of who watched |
| **Special category data** | Not intended. Video can incidentally reveal health, religion or other special category information; it is not used to infer or process it. Recordings are not used for facial recognition or any biometric identification |
| **Volume** | About 230 MB per 30-minute match. Beta: [ESTIMATE] matches a month |
| **Retention** | 30 days after the match. If disputed: held until the dispute is decided, then 12 months (8-week complaints process plus IBAS referral), longer only for an investigation or legal claim. Deleted automatically by the hourly retention job; the database row remains, marked deleted |

## 3. Lawful basis

- **Legitimate interests (Article 6(1)(f))**: deciding disputes fairly, protecting players' money from cheating and fixing, and meeting the Gambling Commission's expectations on fair gambling, complaints and ADR. The balancing test: players already broadcast these streams publicly on Kick by choice; the recording adds no new viewers beyond a small number of reviewers; it is short-lived; it protects the players themselves. [CONFIRM with advisor whether contract (Article 6(1)(b)) is the better basis for players, since recording is part of the service they sign up to.]
- Customers cannot opt out of recording and still play a refereed match, because the dispute process depends on it. This is stated before they accept the Match Rules.

## 4. Necessity and proportionality

- **Why not rely on Kick's past broadcasts?** Players control their own Kick archives and can delete them, or not enable them; the evidence would be missing exactly when it matters most.
- **What is recorded is limited**: only from match start to result, only the three streams already public on Kick, only refereed matches.
- **Who can watch is limited**: independent reviewers and admins, never other players, never the original referee.
- **Retention is short** for the 95%+ of matches that are never disputed (30 days).

## 5. Risks and controls

| Risk to individuals | Likelihood / severity | Controls | Residual |
|---|---|---|---|
| Recordings breached or leaked | Low / high | Private R2 bucket, never public; access keys held only by the web app and recorder; playback via 15-minute signed links; every viewing logged; Cloudflare security certifications (ISO 27001, SOC 2) | Low |
| Misuse by a reviewer (sharing, watching without reason) | Low / medium | Only from an assigned dispute, after the conflict checks; every viewing in the append-only admin audit log; reviewers bound by the Referee Code (confidentiality); periodic review of the viewing log | Low |
| Third parties (family, housemates) recorded without knowing | Medium / low | Match Rules tell players anything on stream may be recorded; they choose what their camera shows; retention short | Low |
| Recording tampered with to change an outcome | Low / high | SHA-256 sealed into the hash-chained referee audit trail at the moment of recording; reviewers see the fingerprint | Low |
| Kept too long | Low / medium | Automatic hourly deletion at the retention date; disputes hold recordings only while open, then 12 months | Low |
| Recording missing or broken when a dispute is filed | Medium / medium | Pieces uploaded every 5 minutes, so a failure loses little; failures recorded with a reason; reviewers fall back to the players' Kick channels | Medium (operational, not a privacy risk) |
| Private conversation in voice chat captured | Medium / medium | Only the three participants can join; the Match Rules say voice chat is recorded and why; recording kept only as long as the match recording; reviewers only | Low |
| International transfer | Possible / medium | R2 bucket location set to EU (or UK) jurisdiction [CONFIRM]; Cloudflare DPA includes the UK addendum and SCCs | To confirm |

## 6. Measures agreed

1. Accept Cloudflare's and LiveKit's DPAs (Article 28) and record both in the supplier register (Document 08). Create the LiveKit Cloud project in an EU region.
2. Create the R2 bucket with **EU jurisdiction** and no public access; issue a bucket-scoped API token with object read/write only.
3. Keep the Match Rules recording rule and the Privacy Policy wording in step with what is recorded.
4. Review the recording viewing log monthly alongside dispute outcomes.
5. Answer subject access requests for recordings by giving the person the clip of their own match while it is held (mask other people where needed) [CONFIRM approach with advisor].
6. Re-assess this DPIA before switching recording on, and on any change to what is recorded.

## 7. Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Head of Compliance | [NAME] | [APPROVE / CHANGES] | |
| DPO or privacy lead | [NAME] | [ADVICE] | |
| Board | [NAME] | | |

If residual high risk remains that cannot be reduced, consult the ICO before processing (Article 36).

## 8. Questions to settle

1. Contract or legitimate interests as the lawful basis for recording players (section 3).
2. Does recording Kick streams through Kick's embedded player sit within Kick's terms of service? Ask Kick, and record the answer.
3. R2 bucket jurisdiction (EU or UK) and Cloudflare sub-processors.
4. Handling of subject access requests that include other people (section 6.5).

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 26 October 2026 | First draft from the recorder as built |
| 0.2 | 29 October 2026 | Match voice chat (LiveKit), recorded as audio with the match |
