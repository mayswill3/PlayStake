# 3-Shot Pool: Complete Game Design Document

**Version**: 1.0
**Date**: 2026-04-01
**Status**: Implementation-Ready
**Route**: `/src/app/demo/3shot/page.tsx`

---

## Table of Contents

1. [Design Pillars and Fun Hypothesis](#1-design-pillars-and-fun-hypothesis)
2. [Core Rules](#2-core-rules)
3. [Design Decisions with Arguments](#3-design-decisions-with-arguments)
4. [Scoring System and Balance Table](#4-scoring-system-and-balance-table)
5. [Tiebreaker and Overtime](#5-tiebreaker-and-overtime)
6. [State Machine](#6-state-machine)
7. [Investor Demo Mode](#7-investor-demo-mode)
8. [UI Copy Register](#8-ui-copy-register)
9. [Tuning Table](#9-tuning-table)
10. [Edge Case Register](#10-edge-case-register)
11. [Player Experience Arc](#11-player-experience-arc)
12. [Frontend Developer Handoff Brief](#12-frontend-developer-handoff-brief)
13. [Open Questions Register](#13-open-questions-register)

---

## 1. Design Pillars and Fun Hypothesis

### Pillars

1. **Instant comprehension** -- An investor watching over someone's shoulder must understand the entire game within one round. No rule explanations needed. The scoreboard tells the story.
2. **Outcome in under 90 seconds** -- From the first shot to payout display, a normal-pace game never exceeds 90 seconds. This means the game is demo-friendly: you can run it three times in a five-minute meeting slot.
3. **Physics must feel great from shot one** -- The aim line, ghost ball preview, cue stick visualization, and power meter are inherited from the 8-ball game. These are non-negotiable because they make a non-gamer feel competent immediately.
4. **Wager flow must be unmissable** -- The stake amount is visible throughout gameplay. The game over screen is the climax of the pitch -- it shows money moving.

### Fun Hypothesis

"Potting a ball with real money on the line feels better than potting a ball for nothing -- and knowing you only get 3 shots makes every one feel significant."

The constraint of 3 shots transforms pool from a game of sustained excellence into a game of clutch moments. Every shot is either "I scored" or "I wasted one of my three chances." This binary clarity is what makes it investor-legible.

---

## 2. Core Rules

### Setup
- Standard 15-ball rack (reuse `rackBalls()` from existing pool game).
- 6 pockets (4 corner, 2 side) -- existing pocket positions, unchanged.
- Player A always goes first (breaks).

### Turn Structure
- **Player A takes 3 consecutive shots.** Shot 1 is the break.
- After Player A's 3 shots complete, the board state is preserved as-is.
- **Player B takes 3 consecutive shots** on the remaining balls.
- Player B does NOT re-rack. Player B shoots the cue ball from the head position (25% table width, centered vertically) for their first shot.

### Scoring
- Each ball potted = 1 point.
- The 8-ball = 1 point (same as every other ball). See Decision #5 for argument.
- Cue ball pocketed = 0 points from that ball (it is not an object ball).
- Score = total balls potted across all 3 shots.

### Win Condition
- Player with the higher score wins.
- Ties go to overtime (see Section 5).
- A single winner is always produced. DRAW is never sent to the PlayStake widget.

---

## 3. Design Decisions with Arguments

### Decision 1: Does a scratch consume a shot?

**YES. A scratch consumes the shot.**

Argument: The entire design premise is "3 shots, make them count." If scratches did not consume shots, a player could play recklessly -- smash the cue ball into the pack at max power, pot 3 balls, scratch, and get a free do-over. That destroys the risk/reward tension that makes the format compelling. A scratch is a wasted opportunity, and wasted opportunities in a 3-shot format feel punishing in a good way -- the player immediately understands the consequence.

Implementation: When the cue ball is pocketed, the shot counter decrements. The cue ball is respotted at the head position for the next shot (if shots remain). No balls potted on a scratch shot are returned -- they still count. See Decision 2.

### Decision 2: If a player pots a ball on the same shot they scratch -- does it count?

**YES. Balls potted on a scratch shot count toward the score.**

Argument: This creates a delicious risk/reward moment. A player might take a high-risk shot that could pot 2 balls but also risks scratching. If they pot 2 and scratch, they get +2 points but lose a shot. That is a meaningful, legible tradeoff. If we nullified the potted balls, scratches would be purely punitive and would discourage aggressive play -- which is the most exciting play to watch in a demo.

Edge case note: If a player pots a ball and the cue ball on the exact same physics frame, both events register. The ball counts, the scratch consumes the shot, the cue respots.

### Decision 3: Can a player forfeit a shot deliberately?

**NO. There is no "skip shot" button.**

Argument: In a 2-player format where P2 sees P1's score, allowing forfeits would let P2 skip remaining shots once they have a winning lead. This would shorten the game anticlimactically. For the investor demo, we want every shot to happen -- it is more dramatic to watch P2 sink their third shot when they already have a 3-1 lead than to see them hit "skip." The shot clock (Decision 7) ensures no one can stall indefinitely, so forfeiting solves a problem that does not exist.

### Decision 4: What if all 15 balls are potted before all shots are used?

**Remaining shots are forfeited. The player's score is their total pots.**

Argument: This is an extreme edge case. A single player potting all 15 balls in 3 shots requires potting 5 balls per shot on average. With standard rack physics, this is nearly impossible -- a perfect break pots 2-3 balls at most. If it happens, the player has already achieved something extraordinary and does not need more shots. Their score of 15 (or however many they potted) speaks for itself.

For P1: If P1 pots all 15 balls, P2 has nothing to shoot at. P2's score is 0 by default. P1 wins 15-0. The game skips P2's turn entirely and goes straight to the result screen. This is the correct behavior because there is literally nothing for P2 to do.

For P2: If P2 pots all remaining balls before using all 3 shots, their remaining shots are forfeited. Score is locked.

### Decision 5: Should the 8-ball be worth more (e.g., 2 points)?

**NO. All balls are worth 1 point.**

Argument for uniformity:
- **Comprehension**: "Pot balls. More balls = win." is the simplest possible rule. Adding "...except the black one, which is worth 2" forces the investor to process an exception. Exceptions are the enemy of instant comprehension (Pillar 1).
- **Balance**: A 2-point 8-ball would disproportionately reward lucky breaks where the 8 drops early. In a 3-shot format, the 8-ball's position is determined by the rack, and whether it drops on the break is largely physics variance, not skill. Rewarding variance over skill undermines competitive integrity.
- **Strategic depth without complexity**: With uniform scoring, the interesting decision is shot selection -- which cluster to target, which angle maximizes multi-ball potential. A weighted 8-ball would make every player target the 8 first, collapsing the strategy space.

Counterargument acknowledged: A weighted 8-ball would create "big moment" drama. But we already have that via the overtime sudden-death mechanic (Section 5), which is a more controlled way to generate drama.

### Decision 6: Does P2 seeing P1's score before shooting create meaningful tension or feel unfair?

**This asymmetry is a FEATURE, not a bug.**

Argument:
- **For the watching investor**: P2's turn is the dramatic climax. The investor watches P2 knowing exactly what they need to beat. "P1 scored 2 -- can P2 match it?" This is the same narrative structure as every sports broadcast: the team batting second in baseball, the golfer putting last on 18. The audience already knows the target. That creates tension.
- **For P2 as a player**: Knowing the target changes P2's psychology in interesting ways. If P1 scored 3, P2 plays desperately -- taking risky shots. If P1 scored 0, P2 plays conservatively -- just need to pot 1 ball. This strategic adaptation is the most sophisticated decision-making in the game, and it emerges naturally from the asymmetry.
- **For P1 as a player**: P1 has the advantage of a full rack (more balls clustered together, higher multi-pot potential). P2 plays a sparser table. This physical disadvantage partially offsets P2's informational advantage, creating rough balance.
- **Fairness perception**: In playtesting, if players consistently feel P2 has an unfair advantage due to information, we can hide P1's score until P2 finishes. But the default should be visible scores because it is more dramatic for demos. Flag this as a `[REVISIT_AFTER_PLAYTEST]` item.

### Decision 7: Should there be a shot clock?

**YES. 15 seconds per shot.**

Argument:
- **Investor demo context**: An investor watching a demo should never see dead air. 15 seconds is long enough for a deliberate aim (the aim line and ghost ball make 5-8 seconds typical) but short enough that stalling is impossible.
- **Total time budget**: 3 shots x 15 seconds = 45 seconds of aiming time per player. Add ~5 seconds of ball rolling per shot (6 shots x 5s = 30s). Total = 45 + 45 + 30 = 120 seconds maximum. With the 60-second overtime cap, worst case is 3 minutes. Typical case (most shots taken in 8-10 seconds) is 60-75 seconds. This fits the 90-second target.
- **Expiry behavior**: If the shot clock expires, the shot is auto-fired at minimum power in the current aim direction (or straight forward if the player has not started aiming). This prevents the shot from being "skipped" (see Decision 3) while still penalizing indecision. The player sees a 3-second warning countdown with the timer turning red and pulsing.

---

## 4. Scoring System and Balance Table

### Scoring Rules Summary
| Rule | Value |
|------|-------|
| Ball potted | +1 point |
| 8-ball potted | +1 point (no special value) |
| Cue ball pocketed (scratch) | 0 points, shot consumed |
| Balls potted on a scratch shot | Still count |
| Maximum possible score (one player) | 15 (all balls potted, theoretical max) |
| Realistic maximum per 3 shots | 6-8 (exceptional play) |
| Expected average per 3 shots | 1-3 (typical play) |

### Scenario Balance Table

| Scenario | P1 Score | P2 Score | Result | Notes |
|----------|----------|----------|--------|-------|
| P1 pots 3, P2 pots 1 | 3 | 1 | **P1 wins 3-1** | Clear victory, no drama needed |
| P1 pots 2, P2 pots 2 | 2 | 2 | **Overtime** | Sudden-death shootout (Section 5) |
| P1 scratches all 3 shots | 0* | any | Depends on P2 | *P1 may still have points if balls dropped before cue was pocketed |
| P1 scratches 3x, pots 0 balls; P2 scratches 3x, pots 0 balls | 0 | 0 | **Overtime** | 0-0 tie, goes to sudden death |
| P1 pots 8-ball on break | 1 | (plays normally) | Depends on final scores | 8-ball is just 1 point, no special break rule. P2 still gets 3 shots. |
| P1 pots 5 balls across 3 shots | 5 | 2 | **P1 wins 5-2** | Dominant performance |
| P1 pots 0 balls, P2 pots 0 balls | 0 | 0 | **Overtime** | Both players whiffed, sudden death decides |
| P1 pots 15 balls (all) in 3 shots | 15 | 0 (no balls to shoot) | **P1 wins 15-0** | P2's turn is skipped entirely |
| P1 pots 3 (including 1 scratch), P2 pots 3 | 3 | 3 | **Overtime** | Scratch did not reduce score because potted balls still count |

*Note on "P1 scratches all 3 shots": Scratching consumes the shot. If P1 scratches 3 times and also happens to pot object balls on those shots, those balls count. Example: P1's first shot pots 2 balls + scratches = 2 points, 1 shot consumed. P1's second shot scratches with no pots = 0 points, 1 shot consumed. P1's third shot scratches with 1 pot = 1 point, 1 shot consumed. P1's total: 3 points. This is intentional per Decision 2.*

---

## 5. Tiebreaker and Overtime

### Design Goals
- Resolve within 60 seconds maximum
- Guarantee a single winner
- Feel dramatic, not arbitrary
- Simple enough that the investor understands it immediately

### Overtime Format: Sudden-Death Single Shot

**When scores are tied after regulation (3 shots each), each player takes 1 additional shot. Higher score wins. If still tied, repeat.**

#### Overtime Rules
1. The board state is preserved from the end of regulation. Balls already potted stay potted.
2. P1 shoots first (same order as regulation).
3. P1's cue ball is respotted at the head position (25% table width, center).
4. P1 takes 1 shot. Score is recorded (0 or more balls potted).
5. P2's cue ball is respotted at the head position.
6. P2 takes 1 shot. Score is recorded.
7. If P1's overtime score > P2's overtime score: P1 wins.
8. If P2's overtime score > P1's overtime score: P2 wins.
9. If tied again: repeat steps 2-8 (another overtime round).

#### Maximum Overtime Rounds: 3

After 3 overtime rounds (3 extra shots each, 6 total extra shots), if still tied, the **forced tiebreaker** activates.

#### Forced Tiebreaker (after 3 OT rounds)

**Closest-to-center shootout.** Each player shoots the cue ball from the head position. No object balls matter. The cue ball that comes to rest closest to the exact center of the table (OFFSET + TABLE_WIDTH/2, OFFSET + TABLE_HEIGHT/2) wins. If the cue ball is pocketed, the distance is set to the maximum possible value (table diagonal). P1 shoots first.

This is guaranteed to produce a winner because the probability of two cue balls stopping at the exact same pixel coordinate is astronomically low. If it somehow happens (floating point), P2 wins (compensating for P1's first-mover break advantage).

#### Overtime UI Treatment
- When overtime triggers, a full-width banner appears: "OVERTIME" in gold text with a subtle pulse animation.
- The score display changes to show "REGULATION: 2-2 | OT ROUND 1" format.
- The shot clock remains at 15 seconds per shot.
- If forced tiebreaker activates, the banner changes to "FINAL TIEBREAK" and a crosshair target appears at the center of the table.

#### Overtime Time Budget
- 3 OT rounds x 2 shots x (15s aim + 5s roll) = 120 seconds worst case.
- Forced tiebreaker: 2 shots x (15s aim + 5s roll) = 40 seconds.
- But in practice, OT shots are faster (8-10 seconds typical) and most ties resolve in round 1.
- Realistic OT time: 30-45 seconds.

---

## 6. State Machine

### States (Player Perspective)

```
LOBBY -> WAITING_FOR_OPPONENT -> P1_SHOOTING -> P1_BALLS_ROLLING ->
P1_SHOT_RESULT -> [repeat P1_SHOOTING x2 more] -> P1_TURN_COMPLETE ->
P2_SETUP -> P2_SHOOTING -> P2_BALLS_ROLLING -> P2_SHOT_RESULT ->
[repeat P2_SHOOTING x2 more] -> SCORING -> [OVERTIME if tied] -> GAME_OVER
```

### Detailed State Descriptions

#### STATE: ROLE_SELECT
- **What the player sees**: Two buttons: "Player A -- Creates the bet" and "Player B -- Accepts the bet". Standard RoleSelector component.
- **What the player can do**: Click a role button.
- **Transition**: On click -> LOBBY (via auth setup).

#### STATE: LOBBY
- **What the player sees**: Player A sees a game code to share. Player B sees a code input field.
- **What the player can do**: A creates game + shares code. B enters code + joins.
- **Transition**: Both players joined -> WAITING_FOR_START.

#### STATE: WAITING_FOR_START
- **What the player sees**: "Waiting for bet to be placed..." or the PlayStake widget prompting bet creation/acceptance.
- **What the player can do**: Interact with PlayStake widget.
- **Transition**: Bet accepted by both parties -> P1_BREAK.

#### STATE: P1_BREAK
- **What the player sees**: Full rack, cue ball at head position. Status bar: "PLAYER 1 -- BREAK SHOT (3 shots remaining)". Shot clock counting from 15.
- **P1 can do**: Drag from cue ball to aim, release to shoot.
- **P2 can do**: Watch. Status bar shows "Player 1 is breaking..."
- **Transition**: Shot released -> P1_BALLS_ROLLING.

#### STATE: P1_SHOOTING (shots 2 and 3)
- **What the player sees**: Board state from previous shot. Cue ball at its current position (or respotted at head if scratched). Status: "PLAYER 1 -- SHOT 2 OF 3 (2 shots remaining)".
- **P1 can do**: Drag from cue ball to aim, release to shoot.
- **P2 can do**: Watch.
- **Transition**: Shot released -> P1_BALLS_ROLLING.

#### STATE: P1_BALLS_ROLLING
- **What the player sees**: Physics simulation running. Balls moving. No controls active.
- **What the player can do**: Nothing (watch).
- **Transition**: All balls at rest -> P1_SHOT_RESULT.

#### STATE: P1_SHOT_RESULT
- **What the player sees**: Brief flash showing what happened: "Potted 2 balls!" or "Scratch!" or "No balls potted." This appears for 1.5 seconds.
- **Transition**: If P1 has shots remaining -> P1_SHOOTING. If P1 has used all 3 shots -> P1_TURN_COMPLETE.

#### STATE: P1_TURN_COMPLETE
- **What the player sees**: "PLAYER 1 FINISHED -- Score: 3". Banner with P1's final score. Holds for 2 seconds.
- **Transition**: After 2 seconds -> P2_SETUP.

#### STATE: P2_SETUP
- **What the player sees**: The board resets the cue ball only -- cue ball moves to head position (25% width, center). Object balls remain where P1 left them. Status: "PLAYER 2 -- YOUR TURN (3 shots remaining)". If all balls are potted, skip to SCORING.
- **Transition**: After 1-second pause -> P2_SHOOTING.

#### STATE: P2_SHOOTING
- **What the player sees**: Board with remaining balls. P1's score visible in the score bar. Status: "PLAYER 2 -- SHOT 1 OF 3 (3 shots remaining)". Shot clock at 15.
- **P2 can do**: Drag from cue ball to aim, release to shoot.
- **P1 can do**: Watch.
- **Transition**: Shot released -> P2_BALLS_ROLLING.

#### STATE: P2_BALLS_ROLLING
- Same as P1_BALLS_ROLLING.

#### STATE: P2_SHOT_RESULT
- Same as P1_SHOT_RESULT but for P2.
- **Transition**: If P2 has shots remaining -> P2_SHOOTING. If all 3 used -> SCORING.

#### STATE: SCORING
- **What the player sees**: Side-by-side score comparison. "PLAYER 1: 3 -- PLAYER 2: 1 -- PLAYER 1 WINS!" Brief 2-second hold.
- **Transition**: If tied -> OVERTIME_ANNOUNCE. If not tied -> GAME_OVER.

#### STATE: OVERTIME_ANNOUNCE
- **What the player sees**: Gold "OVERTIME" banner with pulse. "Scores tied at 2-2. Sudden death: 1 shot each."
- **Duration**: 2 seconds.
- **Transition**: -> OT_P1_SHOOTING.

#### STATE: OT_P1_SHOOTING
- Cue ball respotted. P1 aims and shoots. Shot clock 15s.
- **Transition**: Shot -> OT_P1_ROLLING -> OT_P1_RESULT -> OT_P2_SETUP.

#### STATE: OT_P2_SHOOTING
- Cue ball respotted. P2 aims and shoots. Shot clock 15s.
- **Transition**: Shot -> OT_P2_ROLLING -> OT_P2_RESULT -> OT_SCORING.

#### STATE: OT_SCORING
- Compare OT round scores.
- **Transition**: If one player scored more -> GAME_OVER. If tied and OT rounds < 3 -> OVERTIME_ANNOUNCE (next round). If tied and OT rounds = 3 -> FORCED_TIEBREAK.

#### STATE: FORCED_TIEBREAK
- Center crosshair target rendered on table.
- Each player shoots cue ball. Closest to center wins.
- **Transition**: Both players shot -> GAME_OVER.

#### STATE: GAME_OVER
- **What the player sees**: GameResultOverlay component.
  - Winner: Trophy icon, green glow, confetti, "+$0.475" (example).
  - Loser: X icon, red shake, "-$0.50" (example).
  - "Play Again" button.
- **What the player can do**: Click "Play Again" (reloads page).
- **Transition**: None (terminal state until page reload).

---

## 7. Investor Demo Mode

### Overview

Demo mode is a standalone experience that requires no login, no opponent, and no real wallet. It demonstrates the full game loop with simulated wagers.

### Entry Point

The page at `/demo/3shot` detects a query parameter `?mode=demo` or shows a button "Try Demo" alongside the normal role selector. Demo mode can also be the default if no auth is configured.

### Demo Mode Badge

A persistent badge in the top-right corner of the game area:
- Text: "DEMO MODE"
- Style: Yellow/amber background, black text, monospace font, pill shape.
- Subtitle below badge: "No real money -- simulated wager"

### Interactive Demo (Default)

- Players are auto-assigned as "Player 1" (shooting) and "Player 2" (CPU).
- No role selection screen. Game starts immediately at P1_BREAK.
- Player name labels: "You" and "CPU".
- Simulated wager: "0.50 USDC" displayed in the wager bar.
- Player controls P1's 3 shots manually.
- CPU takes P2's 3 shots automatically with the bot AI (described below).
- Game resolves normally. Game over screen shows simulated payout.

### "Watch Demo" Auto-Play Mode

Accessed via a "Watch Demo" button on the landing screen or via `?mode=watch`.

#### Auto-Play Script

The game runs fully automated at 1.5x speed (physics tick rate multiplied by 1.5, aim time compressed to 2 seconds per shot).

**Standard script (loops 1 and 2):**
1. P1 breaks. Pots 1 ball on break.
2. P1 shot 2: aims at a cluster, pots 1 ball.
3. P1 shot 3: moderate difficulty shot, misses narrowly (ball rattles pocket edge).
4. P1 score: 2.
5. P2 shot 1: pots 1 ball (straightforward pocket shot).
6. P2 shot 2: scratches (cue follows object ball into pocket). Gets +1 for the potted ball but loses the shot.
7. P2 shot 3: near miss.
8. P2 score: 1 (1 from shot 1 + 1 from shot 2 scratch - but wait, potted ball on scratch counts, so total = 2? Let me recalculate.)

Actually, let me script this more carefully:

**Loop 1 and 2 script (P1 wins 2-1):**
1. P1 break: pots 1 ball. Score: 1.
2. P1 shot 2: pots 1 ball. Score: 2.
3. P1 shot 3: misses (ball hits rail, near-miss on corner pocket). Score: 2.
4. P2 shot 1: pots 1 ball. Score: 1.
5. P2 shot 2: misses (ball clips another ball, goes wide). Score: 1.
6. P2 shot 3: near miss (ball lips out of pocket). Score: 1.
7. Result: P1 wins 2-1.

**Loop 3 script (Overtime):**
1. P1 break: pots 1 ball. Score: 1.
2. P1 shot 2: scratches, but pots 1 ball on the same shot. Score: 2.
3. P1 shot 3: misses. Score: 2.
4. P2 shot 1: pots 1 ball. Score: 1.
5. P2 shot 2: pots 1 ball. Score: 2.
6. P2 shot 3: misses. Score: 2.
7. Overtime: "OVERTIME -- Tied at 2-2!"
8. OT round 1: P1 pots 1 ball. P2 misses.
9. Result: P1 wins 3-2 (OT).

**Bot AI for auto-play:**
The bot does not need to be intelligent. It needs to be *cinematic*. Each scripted shot is implemented as a pre-calculated angle and power value that produces the desired outcome given the deterministic physics. The developer should:
1. Set up the rack.
2. Find angles/powers that produce the scripted outcomes.
3. Hardcode those values as `DEMO_SCRIPT_SHOTS`.
4. For the "miss" shots, aim near a pocket but slightly off -- the ball visibly almost goes in.

If hardcoding exact shots is too brittle (physics can have micro-variations), the alternative is a simple targeting bot:
- `findBestShot(balls, targetOutcome: 'pot' | 'miss' | 'scratch_with_pot')` that raycasts from the cue ball to each object ball, evaluates whether the object ball has a line to a pocket, and picks the best/worst option depending on the desired outcome.
- For "miss" shots: pick a ball near a pocket and aim 5-10 degrees off from the perfect line.

### Wager Display (Demo Mode)

The wager bar always shows:
- Left side: "STAKE: 0.50 USDC"
- Right side: "POT: 1.00 USDC"
- These are static strings, not connected to any wallet.

### Game Over Screen (Demo Mode)

#### Winner Screen Copy

```
VICTORY!

+$0.475

You earned $0.475 on a $0.50 stake.
PlayStake took a 5% platform fee ($0.025).

That's the business model. Every game, every wager, every payout --
PlayStake earns 5% of the winning pot.

[Play Again]    [Watch Demo]
```

#### Loser Screen Copy (CPU wins)

```
DEFEAT

-$0.50

The CPU won this round. Your $0.50 stake went to the winner.
PlayStake collected $0.025 (5% fee) from the payout.

[Play Again]    [Watch Demo]
```

### Demo Mode Technical Notes

- No PlayStake widget is rendered in demo mode.
- No API calls to game session, bet creation, or settlement.
- All state is local.
- The `useGameSession` hook is not used.
- The page component checks for `mode=demo` or `mode=watch` in the URL search params.

---

## 8. UI Copy Register

Every string that appears in the game, organized by context.

### Page Header
- Title: `"3-Shot Pool"`
- Subtitle: `"3 shots each. Most balls potted wins. Real money on the line."`

### Role Selection
- Player A button label: `"BREAK"` (large), `"Player A -- Breaks first, creates the bet"` (small)
- Player B button label: `"CHASE"` (large), `"Player B -- Shoots second, accepts the bet"` (small)

### Lobby
- Player A create game: `"Create Game"` button
- Player A waiting: `"Share this code with Player B:"`
- Waiting status: `"Waiting for opponent to join..."`
- Player B join: `"Enter the game code from Player A:"`
- Join button: `"Join Game"`

### Score Display (persistent during gameplay)
- Format: `"P1: 2  |  P2: --"` (P2 shows "--" until they start playing)
- During P2's turn: `"P1: 2  |  P2: 1"`
- Score label: `"SCORE"`

### Wager Display (persistent during gameplay)
- Format: `"STAKE: $X.XX"` (from betAmountCents)
- Demo mode: `"STAKE: 0.50 USDC"`

### Shot Counter
- `"3 SHOTS LEFT"` (displayed as filled/empty circles or pips)
- `"2 SHOTS LEFT"`
- `"1 SHOT LEFT"`
- `"0 SHOTS LEFT"` (briefly, during turn-complete transition)

### Shot Clock
- Displays as `"15"` counting down, large mono font
- At 3 seconds: turns red, pulses
- At 0: `"TIME!"` flash, then auto-shot fires

### Status Bar Messages (in order of game flow)

#### Player A's Perspective
- `"YOUR BREAK -- Drag from the cue ball to shoot"` (P1, shot 1)
- `"YOUR SHOT -- 2 shots remaining"` (P1, shot 2)
- `"LAST SHOT -- Make it count!"` (P1, shot 3)
- `"WAITING -- Player 2 is shooting..."`

#### Player B's Perspective
- `"Player 1 is breaking..."`
- `"Player 1 is shooting... (2 shots left)"`
- `"Player 1 is on their last shot..."`
- `"YOUR TURN -- You need to beat 2 (3 shots remaining)"` (P2, shot 1 -- shows P1's score as target)
- `"YOUR SHOT -- You need 1 more (2 shots remaining)"` (P2, shot 2 -- dynamic based on score difference)
- `"LAST SHOT -- You need 1 more to tie, 2 to win!"` (P2, shot 3 -- dynamic)

#### Dynamic P2 Status Messages
- If P2 is ahead: `"YOUR SHOT -- You're leading! (N shots remaining)"`
- If P2 is tied: `"YOUR SHOT -- Tied at N! (M shots remaining)"`
- If P2 is behind by 1: `"YOUR SHOT -- 1 more to tie (M shots remaining)"`
- If P2 is behind by 2+: `"YOUR SHOT -- Need N to win (M shots remaining)"`
- If P2 cannot catch up (mathematically eliminated): `"YOUR SHOT -- (M shots remaining)"`

### Shot Result Messages (appear for 1.5 seconds after each shot)
- Potted 1 ball: `"Nice! Potted 1 ball."`
- Potted 2 balls: `"Great shot! Potted 2 balls!"`
- Potted 3+ balls: `"Incredible! Potted N balls!"`
- Potted 0 balls: `"No balls potted."`
- Scratch (cue pocketed): `"Scratch! Cue ball pocketed."`
- Scratch + potted balls: `"Scratch! But you potted N ball(s) -- they count."`
- Shot clock expired: `"Time's up! Auto-shot fired."`

### Turn Transition Messages
- P1 finished: `"PLAYER 1 DONE -- Score: N"`
- P2 starting: `"PLAYER 2'S TURN -- Target: beat N"`
- P2 finished (no tie): `"FINAL SCORE -- P1: N  P2: M"`

### Overtime
- Announcement: `"OVERTIME"`
- Subtitle: `"Tied at N-N. Sudden death -- 1 shot each."`
- OT round label: `"OT ROUND 1"` / `"OT ROUND 2"` / `"OT ROUND 3"`
- OT status (P1 shooting): `"OVERTIME -- Your shot. Pot more than your opponent."`
- OT status (P2 shooting): `"OVERTIME -- Your shot. P1 potted N this round."`
- Forced tiebreak announcement: `"FINAL TIEBREAK"`
- Forced tiebreak instruction: `"Shoot the cue ball closest to the center dot."`

### Game Over
- Winner (wagered game): `"VICTORY!"` + `"+$X.XX"` + `"Winnings added to your balance"`
- Loser (wagered game): `"DEFEAT"` + `"-$X.XX"` + `"Better luck next time"`
- Play again button: `"Play Again"`

### Demo Mode
- Badge: `"DEMO MODE"`
- Badge subtitle: `"No real money -- simulated wager"`
- Watch demo button: `"Watch Demo"`
- Interactive demo start: `"Play vs CPU"`
- Demo landing explainer: `"See how PlayStake turns any game into a real-money wager. Play a round or watch the demo."`

### Error/Edge States
- Opponent disconnected: `"Opponent disconnected. Waiting for reconnection..."`
- Connection lost: `"Connection lost. Reconnecting..."`
- No balls remaining for P2: `"All balls potted! Player 2 has no balls to shoot."`

---

## 9. Tuning Table

| Variable | Value | Min | Max | Rationale |
|----------|-------|-----|-----|-----------|
| SHOTS_PER_PLAYER | 3 | 2 | 5 | 3 is the sweet spot: enough for strategy, few enough for urgency. 2 feels too random (1 break + 1 real shot). 5 approaches standard pool length. |
| SHOT_CLOCK_SECONDS | 15 | 10 | 30 | 15s allows deliberate aiming without stalling. The aim line + ghost ball reduces the cognitive load of aiming, so 15s is generous. |
| SHOT_CLOCK_WARNING_SECONDS | 3 | 2 | 5 | Red pulsing starts at 3 seconds remaining. Enough time to notice and rush a shot. |
| AUTO_SHOT_POWER | 0.15 (as fraction of MAX_SHOT_POWER) | 0.05 | 0.3 | Weak enough that an auto-shot is clearly punitive but not so weak the ball doesn't move. |
| MAX_OVERTIME_ROUNDS | 3 | 1 | 5 | 3 rounds gives reasonable resolution probability. Each round has a ~75% chance of breaking the tie (based on estimated 40-50% pot rate per shot). After 3 rounds: ~98.5% cumulative resolution. |
| CUE_RESPOT_X | OFFSET + TABLE_WIDTH * 0.25 | - | - | Head string position. Same as break position. Consistent and predictable for the player. |
| CUE_RESPOT_Y | OFFSET + TABLE_HEIGHT / 2 | - | - | Center of head string. |
| SHOT_RESULT_DISPLAY_SECONDS | 1.5 | 1.0 | 2.5 | Long enough to read, short enough to maintain pace. |
| TURN_COMPLETE_DISPLAY_SECONDS | 2.0 | 1.5 | 3.0 | Gives the score time to register before P2 starts. |
| P2_SETUP_PAUSE_SECONDS | 1.0 | 0.5 | 2.0 | Brief pause for cue ball respot animation. |
| OVERTIME_ANNOUNCE_SECONDS | 2.0 | 1.5 | 3.0 | Dramatic beat before overtime begins. |
| DEMO_SPEED_MULTIPLIER | 1.5 | 1.0 | 3.0 | 1.5x feels fast but still readable. 2x loses the ability to track ball paths. |
| DEMO_AIM_DURATION_MS | 2000 | 1000 | 3000 | How long the demo bot "aims" before shooting. Creates the illusion of thought. |
| DEMO_STAKE_DISPLAY | "0.50 USDC" | - | - | Represents a relatable micro-wager amount. |
| DEMO_PAYOUT_DISPLAY | "0.475 USDC" | - | - | Stake minus 5% fee. |
| DEMO_FEE_DISPLAY | "0.025 USDC (5%)" | - | - | Makes the business model explicit. |
| GAME_OVER_DISPLAY_MIN_SECONDS | 5.0 | 3.0 | 10.0 | Minimum time the game over screen is visible before "Play Again" becomes clickable. Prevents accidental dismissal. |
| SCORE_ANIMATION_DURATION_MS | 500 | 300 | 800 | CountUp animation when score increments. |

---

## 10. Edge Case Register

### E1: Cue ball and object ball pocketed on the same physics frame
- **What happens**: Both events are registered. The object ball adds +1 to score. The cue ball scratch consumes the shot. The cue is respotted.
- **Why**: The physics engine processes pocket detection in a single pass per frame. Both balls can independently enter pocket radius on the same step.

### E2: Object ball pocketed after cue ball is already pocketed (same shot)
- **What happens**: The object ball still counts for +1 point. The cue ball was already flagged as scratched. The shot is consumed.
- **Why**: Once the cue ball is launched, all physics play out fully. We do not stop simulation when the cue is pocketed.

### E3: Player pots all remaining balls in one shot
- **What happens**: All potted balls count. If this was P1 and balls remain (not all 15), P1 continues with their remaining shots. If P1 potted all 15, P2's turn is skipped (no balls to shoot). If this was P2, their remaining shots are forfeited.
- **Why**: A shot that clears the table is extraordinary and should be fully rewarded.

### E4: Cue ball comes to rest exactly on a pocket edge
- **What happens**: If the ball center is within pocket radius, it is pocketed. If not, it stays on the table. The pocket detection is distance-based, not edge-based.
- **Why**: Consistent with existing physics engine behavior.

### E5: Player disconnects mid-shot (during balls rolling)
- **What happens**: The shooting player's client completes the physics simulation locally and syncs the result to the server. If the disconnected player is the non-shooting player, nothing happens -- they just miss seeing the animation and get the result on reconnect.
- **Why**: Physics is deterministic and runs client-side. The result is the same regardless of connection state.

### E6: Player disconnects and never returns
- **What happens**: The connected player waits. After a timeout (handled by the game session API, not our concern for GDD), the session is abandoned. The bet is refunded via PlayStake's standard cancellation flow.
- **Why**: This is a platform-level concern, not a game-level concern.

### E7: Shot clock expires while player is mid-drag (aiming)
- **What happens**: The drag is cancelled. The auto-shot fires in the current aim direction at minimum power. If the player had not started dragging at all, the auto-shot fires straight forward (angle = 0, rightward).
- **Why**: The shot clock is the hard deadline. No action = auto-action.

### E8: Zero balls on table for P2 (P1 cleared everything)
- **What happens**: P2's turn is skipped entirely. The game transitions directly to SCORING with P2's score at 0.
- **UI**: `"All balls potted! Player 2 has no balls to shoot."` for 2 seconds, then GAME_OVER.
- **Why**: There is literally nothing to shoot at.

### E9: Cue ball hits no other ball (whiff)
- **What happens**: It counts as a shot (shot counter decrements). Score does not change. No special penalty beyond the wasted shot.
- **Why**: In standard pool, failing to contact a ball is a foul that gives the opponent ball-in-hand. But in 3-Shot Pool, there is no ball-in-hand mechanic and no turn switching. The penalty is simply the wasted shot, which in a 3-shot format is already severe.

### E10: Player closes browser tab during the game
- **What happens**: Same as E6. The game session persists server-side. If the player returns (reloads the page), they can rejoin via the session ID. The game state is synced from the server.
- **Implementation note**: The existing `useGameSession` polling mechanism handles this.

### E11: Overtime with no balls left on the table
- **What happens**: If scores are tied and no object balls remain, the forced tiebreaker (closest-to-center) activates immediately, skipping the standard OT rounds. Both players can still shoot the cue ball.
- **Why**: Standard OT requires object balls to pot. Without them, it would be an infinite loop of 0-0 ties.

### E12: Two balls potted simultaneously in the same pocket
- **What happens**: Both count as +1 each (total +2 for the shot).
- **Why**: The physics engine processes pocket detection independently per ball.

### E13: Cue ball bounces off a rail and comes back to rest near its starting position
- **What happens**: Normal shot. The shot counter decrements. If no balls were potted, score does not change.
- **Why**: The shot was taken. Where the cue ball ends up is irrelevant to the rules.

### E14: Multiple scratches by the same player
- **What happens**: Each scratch consumes a shot. The cue is respotted each time. If a player scratches on all 3 shots, they may still have points from object balls potted during those shots (per Decision 2).

### E15: Forced tiebreaker -- both cue balls pocketed
- **What happens**: Both distances are set to maximum (table diagonal). Since they are equal, P2 wins (per the P2-favoring tiebreak rule to compensate for P1's structural break advantage).

### E16: Object ball is touching a pocket but not pocketed (hanging)
- **What happens**: The ball is not pocketed until its center enters the pocket radius. Hanging balls are a legitimate part of table state that P2 can exploit.
- **Why**: Consistent with physics engine behavior.

### E17: P2's first shot -- cue ball placed at head position overlaps with an object ball
- **What happens**: The cue ball is placed at the standard head position (OFFSET + TABLE_WIDTH * 0.25, center). If an object ball is within 2.2 * BALL_RADIUS of this position, the cue ball is shifted along the head string (same X, varying Y) until a clear spot is found. If no clear spot exists on the head string, shift the cue ball slightly left (toward the rail behind the head string) until clear.
- **Why**: The cue ball must be placeable. This is a deterministic algorithm, not player choice, because P2 does not get ball-in-hand.

### E18: Rapid-fire clicking / double-shot
- **What happens**: The `shootingRef` guard prevents any shot from being taken while balls are still in motion. Clicks during animation are ignored.
- **Why**: Existing pool game already handles this with the `shootingRef.current` check.

---

## 11. Player Experience Arc

### The Investor's Journey (Non-Gamer, First Time)

**0:00 -- "What am I looking at?"**
The investor sees a pool table. Familiar shape, familiar green felt. They notice a scoreboard showing "P1: -- | P2: --" and a wager amount "STAKE: $0.50". They immediately understand this is some kind of pool game with money involved.

**0:05 -- "Oh, I see."**
The status bar says "YOUR BREAK -- Drag from the cue ball to shoot". They see "3 SHOTS LEFT" represented as three filled circles. The constraint is immediately clear: this is not a full game of pool. It is 3 shots. That is all.

**0:10 -- "This feels nice."**
They drag from the cue ball. A dotted line extends forward. A ghost ball appears where the cue ball will contact the first object ball. A yellow projected line shows where that ball will go. A power meter on the left fills up with a green-to-red gradient. The cue stick pulls back. This feels like a real pool game, not a toy. They release. The cue stick snaps forward. Balls scatter. Two balls drop into pockets. The score updates: "P1: 2". One of the three shot pips empties.

**0:20 -- "I want another one."**
Two shots left. They line up their second shot. The aim line shows a clear path to a stripe hanging near the corner pocket. They power the shot. The ball drops. "P1: 3". The shot result flashes: "Great shot! Potted 1 ball!" They feel competent.

**0:30 -- "Risk/reward."**
Last shot. A difficult angle. They go for it. The ball rattles the pocket edge and spins out. "No balls potted." The status bar reads "PLAYER 1 DONE -- Score: 3". They feel a pang of regret -- that last shot could have been 4. But 3 is solid.

**0:35 -- "Now the other player..."**
The board resets the cue ball. The opponent (CPU in demo mode) starts shooting. The investor watches. They see the CPU pot 1 ball. Then miss. Then miss again narrowly. "P2: 1". The tension is palpable: "My score held up."

**0:55 -- "There it is."**
The game over screen appears. Trophy icon. Green glow. Confetti. "+$0.475". Below it: "You earned $0.475 on a $0.50 stake. PlayStake took a 5% platform fee ($0.025)." The investor sees the business model in one glance: the game facilitates the wager, PlayStake takes a cut, the winner gets paid. No explanation needed.

**1:00 -- "Do it again."**
"Play Again" button. Or "Watch Demo" to see it run autonomously. The investor has seen the full loop. Stake, play, win, payout. Under 60 seconds. They get it.

### Emotional Beats Summary

| Time | Player Emotion | Investor Emotion |
|------|---------------|-----------------|
| 0:00 | Curiosity | "What is this?" |
| 0:05 | Comprehension | "Pool with stakes, 3 shots" |
| 0:10 | Competence (aim assist) | "The player looks like they know what they're doing" |
| 0:20 | Satisfaction (pot a ball) | "That was satisfying to watch" |
| 0:30 | Regret/excitement (last shot) | "Every shot matters" |
| 0:35 | Tension (watching opponent) | "Will the lead hold?" |
| 0:55 | Triumph/relief | "The money moved!" |
| 1:00 | "One more round" | "I understand the product" |

---

## 12. Frontend Developer Handoff Brief

### Architecture Decision

Single React component at `/src/app/demo/3shot/page.tsx`, following the exact pattern of `/src/app/demo/pool/page.tsx`. This is a deliberate copy-and-modify, not a refactor-and-share. The two games are similar enough to share physics code but different enough in game logic that abstracting shared code would create coupling that slows iteration. Copy the file, strip the 8-ball-specific logic, add 3-Shot-specific logic.

### Task List

#### MUST-HAVE (MVP for investor demo)

**T1: Copy and strip pool game (2-3 hours)**
- Copy `/src/app/demo/pool/page.tsx` to `/src/app/demo/3shot/page.tsx`.
- Remove: group assignment, solids/stripes tracking, calling pocket, 8-ball win/loss logic, ball-in-hand mechanic, two-shots-on-foul logic.
- Keep: all physics (stepPhysics, allAtRest, raycastFirstBall), all drawing (drawTable, drawBall, drawAimLine, drawCueStick, drawPowerMeter), all input handling (mouse + touch), canvas rendering loop.
- Add `'3shot'` to the `GameType` union in `/src/app/demo/_shared/types.ts`.

**T2: Implement 3-Shot game state machine (3-4 hours)**
- New state type: `type ThreeShotPhase = 'p1_break' | 'p1_shooting' | 'p1_rolling' | 'p1_result' | 'p1_complete' | 'p2_setup' | 'p2_shooting' | 'p2_rolling' | 'p2_result' | 'scoring' | 'overtime_announce' | 'ot_shooting' | 'ot_rolling' | 'ot_result' | 'ot_scoring' | 'forced_tiebreak' | 'game_over'`.
- Track: `currentPlayer: 'A' | 'B'`, `shotsRemaining: number` (starts at 3), `scoreA: number`, `scoreB: number`, `otRound: number`.
- Shot execution: on each shot, decrement `shotsRemaining`. Count pocketed balls (excluding cue). Add to player's score. If scratch, respot cue at head position. If `shotsRemaining === 0`, transition to next phase.

**T3: Implement shot clock (1-2 hours)**
- 15-second countdown timer per shot, starting when the phase enters `*_shooting` or `*_break`.
- Visual: large monospace countdown number rendered on the canvas (top-right of table area) or as an HTML overlay.
- At 3 seconds: text turns red, pulses (CSS animation or canvas-based).
- At 0: cancel any active drag, fire auto-shot (angle = current aimAngleRef or 0 if no aim, power = AUTO_SHOT_POWER * MAX_SHOT_POWER).
- Reset timer on each new shot.

**T4: Implement score display (1 hour)**
- Persistent score bar above the canvas: `"P1: N | P2: M"`.
- P2's score shows `"--"` until P2's turn begins.
- Shot counter: 3 pips (filled circles for remaining, empty for used).
- Use CSS transitions for score increment animation (brief scale-up + color flash).

**T5: Implement turn transitions (1-2 hours)**
- After P1's 3 shots: display "PLAYER 1 DONE -- Score: N" for 2 seconds.
- Respot cue ball at head position (with E17 overlap avoidance).
- After P2's 3 shots: transition to SCORING.
- SCORING: display final scores for 2 seconds, then GAME_OVER or OVERTIME.

**T6: Implement overtime (2-3 hours)**
- Track `otRound` (1, 2, or 3).
- Each OT round: P1 gets 1 shot (respot cue), P2 gets 1 shot (respot cue).
- Compare OT round pots. If different, winner declared. If same, increment `otRound`.
- After 3 rounds: forced tiebreaker (T7).

**T7: Implement forced tiebreaker (1-2 hours)**
- Render a crosshair/target at table center (OFFSET + TABLE_WIDTH/2, OFFSET + TABLE_HEIGHT/2).
- Each player shoots the cue ball (no object balls matter).
- Measure distance from cue ball rest position to center. If pocketed, distance = max.
- Lower distance wins. If equal (practically impossible), P2 wins.
- Transition to GAME_OVER.

**T8: Integrate PlayStake settlement (1 hour)**
- Reuse existing pattern from pool game: `resolveGame(winner)` -> `reportAndSettle(apiKey, betId)` -> `setSettlementResult()` -> `GameResultOverlay`.
- Map winner to 'PLAYER_A_WIN' or 'PLAYER_B_WIN'. Never send 'DRAW'.

**T9: Game data sync for multiplayer (2-3 hours)**
- Define `ThreeShotGameData` interface (analogous to `PoolGameData`).
- Include: `phase`, `currentPlayer`, `shotsRemaining`, `scoreA`, `scoreB`, `otRound`, `balls` (positions), `lastShot` (angle, power, preShotBalls for replay).
- Player A (active player) syncs state after each shot.
- Player B (watching) receives state via polling and replays the shot animation (same pattern as existing pool opponent replay).

**T10: P2 status messages with dynamic target (1 hour)**
- When it is P2's turn, the status bar shows what P2 needs: "You need to beat 2 (3 shots remaining)".
- Update dynamically as P2 pots balls: "You need 1 more to tie (2 shots remaining)".
- Logic: `const target = scoreA - scoreB; const verb = target > 0 ? 'need ${target} more' : target === 0 ? 'tied!' : 'leading by ${-target}'`.

#### NICE-TO-HAVE (Polish for demo day)

**T11: Demo mode -- interactive vs CPU (3-4 hours)**
- Detect `?mode=demo` in URL search params.
- Skip role selection, auth, lobby.
- P1 is the human player. P2 is a simple bot.
- Bot AI: for each shot, raycast from cue ball to each object ball, evaluate if the object ball has a clear line to any pocket. Pick the best shot. Add slight random angle perturbation (+/- 3 degrees) to prevent perfect play.
- Bot aims for `DEMO_AIM_DURATION_MS` then fires.

**T12: Watch Demo auto-play mode (2-3 hours)**
- Detect `?mode=watch`.
- Both players are bots.
- Physics runs at 1.5x speed (multiply ball velocities by 1.5 at shot execution, not by changing FRICTION).
- Implement the 3-loop script described in Section 7.
- Loop continuously with a "Press any key to exit" overlay.

**T13: Demo mode game over copy (0.5 hours)**
- Custom GameResultOverlay for demo mode that includes the business model explainer text.
- Different from the standard overlay: includes the fee breakdown string and "That's the business model" copy.

**T14: Score increment animation (1 hour)**
- When a ball is potted, the score number briefly scales up 1.2x and flashes green (CSS transition or canvas draw).
- The shot counter pip transitions from filled to empty with a brief fade.

**T15: Overtime announcement animation (1 hour)**
- Gold "OVERTIME" text with horizontal line expansion animation.
- Subtle pulse glow behind the text.
- Holds for 2 seconds before fading into OT gameplay.

**T16: Near-miss visual feedback (1 hour)**
- When a ball comes within 2px of a pocket radius but does not enter, render a brief red flash on the pocket rim.
- This makes "almost made it" moments visually legible.

**T17: Landing page with mode selector (1 hour)**
- Before role selection, show three options:
  - "Play Online" (proceeds to role selection + matchmaking)
  - "Play vs CPU" (interactive demo mode)
  - "Watch Demo" (auto-play mode)

### Estimated Total

- Must-haves: 15-22 hours
- Nice-to-haves: 12-16 hours
- Total: 27-38 hours

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `/src/app/demo/3shot/page.tsx` | CREATE | Main game component (copy from pool, modify) |
| `/src/app/demo/_shared/types.ts` | MODIFY | Add `'3shot'` to GameType union |
| `/src/app/demo/page.tsx` | MODIFY | Add 3-Shot Pool card to demo index page |

### Dependencies on Existing Code (Do Not Modify)

| File | What We Use |
|------|-------------|
| `/src/app/demo/_shared/GameResultOverlay.tsx` | Win/loss/draw display |
| `/src/app/demo/_shared/PlayStakeWidget.tsx` | Bet creation/acceptance/settlement |
| `/src/app/demo/_shared/RoleSelector.tsx` | Player selection UI |
| `/src/app/demo/_shared/LobbyPanel.tsx` | Game code share/join UI |
| `/src/app/demo/_shared/use-game-session.ts` | Multiplayer session management |
| `/src/app/demo/_shared/use-demo-auth.ts` | Auth setup |
| `/src/app/demo/_shared/use-event-log.ts` | Event logging |
| `/src/hooks/useLandscapeLock.ts` | Mobile orientation lock |
| `/src/components/ui/RotatePrompt.tsx` | Mobile rotate prompt |
| `/src/components/ui/GameMobileFAB.tsx` | Mobile floating action button |

---

## 13. Open Questions Register

### OQ1: Should P1's score be hidden from P2 until P2 finishes?

**Recommended default**: Visible (P2 sees P1's score before shooting).
**Argument**: Visibility creates tension and strategic depth (see Decision 6).
**Revisit condition**: If playtesting shows that P2 wins disproportionately (>60% of games) due to informational advantage, hide P1's score until P2 completes their turn. This is a single boolean flag: `SHOW_P1_SCORE_DURING_P2_TURN = true`.
**Implementation cost to change**: 30 minutes.

### OQ2: Should P2 get ball-in-hand for their first shot?

**Recommended default**: No. P2's cue ball is auto-placed at the head position.
**Argument**: Ball-in-hand gives P2 too much advantage -- they can place the cue ball next to an easy pot. Auto-placement at the head position is fair because P1 also started there (for the break). Both players have the same starting position.
**Revisit condition**: If playtesting shows P2 is consistently disadvantaged by the fixed cue position (P1's play leaves no good shots from the head), consider giving P2 ball-in-hand.
**Implementation cost to change**: 1 hour (add the ball-in-hand placement mechanic from the existing pool game).

### OQ3: Should balls potted on a scratch be worth -1 instead of +1?

**Recommended default**: +1 (they count normally).
**Argument**: See Decision 2. Penalty scratches (-1 per potted ball on scratch) would make the scoring confusing and could result in negative scores, which is unintuitive for investors.
**Revisit condition**: If playtesting shows players deliberately scratching to exploit potted-ball-on-scratch, change to -1 penalty. But this is unlikely -- scratching still costs a shot, which is inherently penalizing in a 3-shot format.
**Implementation cost to change**: 15 minutes.

### OQ4: Should there be a "practice mode" with no timer?

**Recommended default**: No (for v1).
**Argument**: The shot clock is essential for demo pacing. A practice mode without a timer serves a different use case (player onboarding for a production game) that is out of scope for an investor demo.
**Revisit condition**: If the game goes to production beyond the demo, add a practice mode as a separate entry point.

### OQ5: Should the break always be the same or allow cue ball positioning?

**Recommended default**: Fixed position (25% width, center height). No repositioning.
**Argument**: Consistent with the existing pool game's break mechanic. Reduces decision overhead at the start of the game. The break's purpose is to scatter the rack, not to position the cue ball. Fixed position means the skill expression is in the aim angle and power, not the cue ball placement.
**Revisit condition**: If playtesting shows that a fixed-position break consistently produces boring outcomes (always pots 0 or always pots 3), allow cue ball Y-axis positioning along the head string.

### OQ6: What happens if both players have 0 shots remaining and 0 balls are on the table during overtime?

**Recommended default**: Jump directly to forced tiebreaker (closest-to-center). See E11.
**Revisit condition**: None -- this is a deterministic rule with no ambiguity.

### OQ7: Mobile layout -- should the score/shot counter be overlaid on the canvas or rendered as separate HTML elements?

**Recommended default**: HTML elements above the canvas (consistent with existing pool game's status bar pattern).
**Argument**: Canvas overlays require careful positioning math across screen sizes. HTML elements with Tailwind classes adapt automatically. The existing pool game uses HTML Cards for status bars, player bars, and ball rack display -- we should maintain that pattern.
**Revisit condition**: If the HTML elements push the canvas below the fold on small mobile screens, move score/shots into a canvas overlay to reclaim vertical space.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-01 | Initial GDD -- all sections complete, all decisions made |
