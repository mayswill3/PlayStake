# DELIVERABLE 1: GAME DESIGN DOCUMENT

## Bullseye Pool -- Game Design Document v1.0

### 1. Overview

**Title**: Bullseye Pool
**Genre**: Precision skill game / pool variant
**Platform**: Web (Next.js), mobile landscape + desktop
**Route**: `/src/app/demo/bullseye/page.tsx`
**Target Duration**: 60-90 seconds (demo format, first to 2)
**Monetization**: P2P wagering via PlayStake widget

**Tagline**: Pool meets bocce ball meets darts. Land your ball closest to the Bullseye. Simple to understand, hard to master.

**Fun Hypothesis**: "Watching your ball drift to a stop two inches from the target -- when your opponent's is four inches away -- feels better than potting a ball, because you can *see* exactly how well you did."

### 2. Design Pillars

1. **Readable at a glance** -- At any moment a spectator must see who is winning. Distance to Bullseye must be visually obvious (spatial, not just a number).
2. **The Bullseye placement is the drama** -- Where the target lands sets the emotional tone. Near a rail = precision challenge. Open centre = power challenge.
3. **Every shot has a clear optimal strategy** -- No "what am I trying to do?" moments. The objective is always: get closer to the dot.
4. **Comeback is always possible** -- One well-placed shot can steal a round. A player down 0-1 must feel they can still win.

---

### 3. Core Gameplay Loop

#### Moment-to-Moment (0-15 seconds)
- **Action**: Player drags to aim and set power, releases to shoot their ball toward the Bullseye target
- **Feedback**: Ball rolls across felt with physics simulation; distance number appears beside ball when it stops
- **Reward**: Visual confirmation of proximity -- leader line from ball to Bullseye, distance in table units

#### Session Loop (per round, 20-40 seconds)
- **Goal**: Land your ball closer to the Bullseye than your opponent
- **Tension**: P1 shoots first (sets the target distance); P2 must beat it (strategic pressure)
- **Resolution**: Winner highlighted with green leader line; round point awarded; score updates

#### Long-Term Loop (per match, 60-90 seconds demo)
- **Progression**: First to 2 rounds (demo) / first to 3 or 5 (standard/extended)
- **Retention Hook**: Wager resolution, "one more match" prompt, variety from random Bullseye placement

---

### 4. Turn Order Decision: Sequential (P1 then P2)

**Decision: Sequential. P1 shoots first, P2 shoots second.**

**Rationale:**

Sequential turns create dramatically superior spectator and player experiences compared to simultaneous play, for these reasons:

1. **P2's shot becomes the climax of every round.** After P1 lands at distance X, the entire round becomes "can P2 beat X?" This is a built-in dramatic question that simultaneous play lacks entirely. Every round has a natural rising tension arc: setup, P1's attempt, the pause, P2's attempt, resolution.

2. **P1's disadvantage is the comeback lever.** P1 always reveals their position first, giving P2 information. This means P2 has a structural advantage -- which means that when P1 wins a round despite going first, it feels earned. The information asymmetry *is* the drama.

3. **It makes spectating legible.** An investor watching a demo immediately understands what P2 is trying to do. With simultaneous hidden shots, the reveal moment is binary ("who won?") rather than a tension arc ("will they beat it?").

4. **It matches the bocce/darts inspiration.** Both bocce and darts are sequential. Players intuitively expect "I go, then you go."

**Balancing P1's disadvantage:**
- P1 and P2 alternate who goes first each round (P1 first in odd rounds, P2 first in even rounds). This ensures each player gets the P2 advantage roughly equally across a match.
- In sudden-death rounds, the player who is currently trailing in match score shoots second (the advantage is deliberately given to the comeback player, reinforcing Pillar 4).

---

### 5. What Balls Are On the Table

**Decision: Each player has their own distinctly colored ball. No shared cue ball.**

Each round places exactly two balls and one Bullseye marker on an otherwise empty table:
- **Player A's ball**: Gold/Yellow (#f5d800), labeled "A" (uses solid ball style, rendered as ball #1 with letter "A" instead of number)
- **Player B's ball**: Blue (#0055cc), labeled "B" (uses solid ball style, rendered as ball #2 with letter "B" instead of number)

**Rationale:**

Using the white cue ball creates ambiguity -- whose ball is whose? In a game built on distance comparison, each player needs an identifiable ball that stays where it lands. Distinct colors map directly to the score display colors and the leader lines, making Pillar 1 (readable at a glance) trivially satisfied.

**Ball placement at round start:**
- The shooting player's ball is placed at the head position: `x = OFFSET + TABLE_WIDTH * 0.25`, `y = OFFSET + TABLE_HEIGHT / 2`
- After P1 shoots and their ball settles, P2's ball is placed at the same head position
- If P1's ball ended up within `BALL_RADIUS * 3` of the head position (extremely rare), shift P2's starting position up or down by `BALL_RADIUS * 4` to avoid overlap

**No cue ball, no cue stick visual.** Each player shoots their own ball directly. The drag-to-aim mechanic works identically -- the player drags from their ball to set direction and power. The aim line, ghost ball preview, and power meter all function the same as existing games. The cue stick visualization IS shown -- it renders relative to the player's colored ball, not a separate cue ball.

---

### 6. Bullseye Placement Algorithm

#### 6.1 Coordinate System

All coordinates are in canvas space. The playable area runs from `(OFFSET, OFFSET)` to `(OFFSET + TABLE_WIDTH, OFFSET + TABLE_HEIGHT)`.

- `TABLE_WIDTH = 800`, `TABLE_HEIGHT = 400`
- `OFFSET = RAIL_INSET + 10 = 40`

For placement math, we define normalized coordinates where `(0, 0)` is the top-left corner of the felt and `(1, 1)` is the bottom-right. Conversion:
```
canvasX = OFFSET + normX * TABLE_WIDTH
canvasY = OFFSET + normY * TABLE_HEIGHT
```

#### 6.2 Exclusion Zones

The Bullseye must NOT be placed:

1. **Inside pocket exclusion radius**: Within `POCKET_EXCLUSION = 0.12 * TABLE_WIDTH = 96 canvas units` of any pocket center. This prevents placements where the target is unreachable without extreme pocket-scratch risk.

2. **Within short-rail exclusion**: `normX < 0.15` or `normX > 0.85`. This prevents placements too close to the short rails where the head position creates a near-impossible angle.

3. **Same quadrant as previous round**: Divide the table into 4 quadrants (top-left, top-right, bottom-left, bottom-right) at `(0.5, 0.5)`. The Bullseye must not appear in the same quadrant as the previous round's placement. For round 1, no quadrant is excluded.

#### 6.3 Zone Definitions and Probability Weights

| Zone | Definition (normalized) | Weight | Rationale |
|------|------------------------|--------|-----------|
| Centre Diamond | `0.35 <= normX <= 0.65` AND `0.30 <= normY <= 0.70` | 30% | Open-table shots test power control. Easiest to read visually. Good for demo. |
| Mid-Table | Not Centre Diamond, and distance from nearest rail edge > 15% of TABLE_HEIGHT (60 units) | 45% | The bread-and-butter placement. Requires angle and power balance. |
| Rail-Adjacent | Distance from nearest rail edge <= 15% of TABLE_HEIGHT (60 units), outside pocket exclusion | 25% | High-drama placements. Precision required. Rail bounces become relevant. |

#### 6.4 Placement Algorithm (Pseudocode)

```
function placeBullseye(previousQuadrant: number | null): { x: number, y: number }
  MAX_ATTEMPTS = 100

  // 1. Roll zone
  roll = random()
  if roll < 0.30: targetZone = "centre"
  else if roll < 0.75: targetZone = "mid"
  else: targetZone = "rail"

  for attempt in 1..MAX_ATTEMPTS:
    // 2. Generate candidate based on zone
    if targetZone == "centre":
      normX = 0.35 + random() * 0.30   // 0.35 to 0.65
      normY = 0.30 + random() * 0.40   // 0.30 to 0.70
    else if targetZone == "rail":
      // Pick a rail: 0=top, 1=bottom, 2=left, 3=right
      rail = randomInt(0, 3)
      if rail == 0: normY = random() * 0.15; normX = 0.15 + random() * 0.70
      if rail == 1: normY = 0.85 + random() * 0.15; normX = 0.15 + random() * 0.70
      if rail == 2: normX = 0.15 + random() * 0.05; normY = 0.15 + random() * 0.70
      if rail == 3: normX = 0.80 + random() * 0.05; normY = 0.15 + random() * 0.70
    else: // mid
      normX = 0.15 + random() * 0.70
      normY = random()

    // 3. Convert to canvas coords
    cx = OFFSET + normX * TABLE_WIDTH
    cy = OFFSET + normY * TABLE_HEIGHT

    // 4. Check exclusions
    if normX < 0.15 or normX > 0.85: continue  // short rail exclusion

    tooCloseToPocket = false
    for each pocket in POCKETS:
      if dist(cx, cy, pocket.x, pocket.y) < POCKET_EXCLUSION: tooCloseToPocket = true
    if tooCloseToPocket: continue

    // 5. Check quadrant constraint
    quadrant = (normX >= 0.5 ? 1 : 0) + (normY >= 0.5 ? 2 : 0)
    if quadrant == previousQuadrant: continue

    // 6. Verify zone membership (for mid, reject if accidentally in centre or rail)
    if targetZone == "mid":
      distToNearestRail = min(normY * TABLE_HEIGHT, (1-normY) * TABLE_HEIGHT,
                              (normX - 0.15) * TABLE_WIDTH, (0.85 - normX) * TABLE_WIDTH)
      if distToNearestRail <= 60: continue  // actually rail-adjacent
      if normX >= 0.35 and normX <= 0.65 and normY >= 0.30 and normY <= 0.70: continue  // actually centre

    return { x: cx, y: cy }

  // Fallback: centre of table (should never reach here)
  return { x: OFFSET + TABLE_WIDTH / 2, y: OFFSET + TABLE_HEIGHT / 2 }
```

---

### 7. Distance Measurement System

#### 7.1 Table Units

1 table unit = `TABLE_WIDTH / 100 = 8 canvas pixels`

Distance formula:
```
distanceInTableUnits = dist(ball.x, ball.y, bullseye.x, bullseye.y) / (TABLE_WIDTH / 100)
```

This means the maximum possible distance (corner to corner) is approximately `sqrt(100^2 + 50^2) = 111.8 table units`.

#### 7.2 Display Rules

- **Internal precision**: Float with full decimal precision for all comparisons
- **UI display**: Rounded to 1 decimal place (e.g., "4.7")
- **Tie comparison**: Raw float. If equal to 2 decimal places (after rounding to 2dp), the round is a draw awarding 0.5 points to each player.

#### 7.3 Visual Display

After each ball settles:
- A **leader line** is drawn from the ball center to the Bullseye center
- The **distance number** is displayed beside the ball (offset 20px above)
- **Winner's line**: Solid, 2px, bright green (#00ff87) with distance in green
- **Loser's line**: Dashed, 1px, muted red (rgba(255,59,92,0.4)) with distance in red
- During P1's shot (before P2 shoots): P1's line is white/neutral (rgba(255,255,255,0.5))
- **Max distance foul**: Display "FOUL" in red instead of distance number; line is dashed red to nearest table edge

---

### 8. Ball Behavior Rules

| Scenario | Rule | Rationale |
|----------|------|-----------|
| Player's ball settles on table | Measure distance to Bullseye normally | Standard case |
| Player's ball falls in a pocket | **Foul**: player receives MAX_DISTANCE (112 table units). Opponent wins round automatically unless both foul. | Pocketing is antithetical to the objective. Harsh punishment creates pocket-avoidance tension near rail placements. |
| Player knocks opponent's ball | Final resting positions of both balls count. Opponent's ball moves to wherever physics sends it. | Risk/reward: you might push their ball further away, or accidentally push it closer. This is the deepest strategic layer. |
| Player knocks opponent's ball into a pocket | Opponent receives MAX_DISTANCE. Shooter wins round (even if shooter's own ball is far away). | Aggressive play option. Creates "take-out shot" strategy from bocce. |
| Player's ball hits the Bullseye marker | Nothing. Bullseye has no physics body. Ball passes through the visual marker. | Simplicity. No physics interactions with the target. |
| Cue ball scratch (N/A -- no cue ball) | Not applicable. Each player shoots their own ball. | Simplification over standard pool. |
| Both players foul (both balls pocketed) | Round is voided. New Bullseye is placed and the round is replayed. Same first-shooter order. | Extremely rare. Fair resolution. |
| Ball stops exactly on Bullseye position | Distance = 0.0. Perfect shot. Treated normally. | Theoretically possible, practically near-impossible. |

---

### 9. Match Structure

| Format | Rounds to Win | Estimated Duration | Use Case |
|--------|--------------|-------------------|----------|
| Sprint | First to 2 | 60-90 seconds | **Investor demo default** |
| Standard | First to 3 | 2-3 minutes | Regular play |
| Extended | First to 5 | 4-6 minutes | High-stakes matches |

**Turn order rotation**: In round N (1-indexed), the first shooter is:
- Odd rounds: Player A
- Even rounds: Player B
- Sudden-death: Trailing player shoots second (gets the informational advantage)

**Round flow:**
1. Bullseye placement animation (0.5s) -- target appears with expanding ring animation
2. First shooter's ball appears at head position (0.3s)
3. First shooter aims and fires (up to 12s shot clock)
4. Ball settles; distance displayed (0.5s pause for readability)
5. Second shooter's ball appears at head position (0.3s)
6. Second shooter aims and fires (up to 12s shot clock)
7. Ball settles; both distances displayed; winner determined (1.0s pause)
8. Round result banner: "PLAYER A WINS ROUND" or "PLAYER B WINS ROUND" (1.0s)
9. Table clears for next round (0.5s fade)

Total round transition time: ~2.5 seconds (between last ball settling and next round's shot clock starting).

---

### 10. Tie Resolution

#### 10.1 Within a Round

Compare raw float distances. If tied when both rounded to 2 decimal places (i.e., `Math.abs(distA - distB) < 0.005`), the round is a draw. Each player receives 0.5 points.

This means scores can be: 0, 0.5, 1, 1.5, 2, etc.

#### 10.2 Match Tie (Sudden Death)

If match score is tied when a player reaches the required wins minus 0.5 (e.g., 1.5-1.5 in Sprint format), the next round is sudden-death.

Sudden-death rules:
- Normal round rules apply
- If the sudden-death round itself ties to 2dp, the player who was closest in the most recent non-tied round wins the match
- If ALL rounds have been ties (astronomically unlikely), Player A wins (first-mover tiebreak)

**The system must always produce an unambiguous winner. DRAW is never sent to PlayStake settlement.**

---

### 11. Shot Clock

**Duration**: 12 seconds

**Rationale**: Bullseye Pool shots are simpler than standard pool shots. There is only one objective (get close to the dot), no ball selection, no pocket calling. 12 seconds is enough to aim carefully but keeps the match within the 60-90 second demo target.

**Display**: Number in top-right corner of table, same as 3-Shot Pool implementation.

**Warning**: At 3 seconds remaining, the number pulses red.

**Expiry behavior**: When the clock hits 0, an auto-shot fires in the player's current aim direction at 15% power (`AUTO_SHOT_POWER_FRAC = 0.15`). If the player has not aimed at all, the auto-shot fires at angle 0 (directly right) at 15% power.

UI string on auto-fire: `"Time's up! Auto-shot fired."`

---

### 12. Bullseye Visual Design

The Bullseye is a **visual-only element** with no physics body. It is drawn on the felt layer, below all balls.

#### 12.1 Concentric Rings

Three concentric rings centered on the Bullseye position:

| Ring | Radius (table units) | Radius (canvas px) | Color | Purpose |
|------|---------------------|---------------------|-------|---------|
| Inner | 3 | 24 | rgba(255, 215, 0, 0.25) | "Perfect shot" zone |
| Middle | 8 | 64 | rgba(255, 215, 0, 0.12) | "Good shot" zone |
| Outer | 15 | 120 | rgba(255, 215, 0, 0.05) | Visible guidance zone |

#### 12.2 Center Marker

- Solid dot: 4px radius, rgba(255, 215, 0, 0.8)
- Crosshair lines: 12px each direction, 1px, rgba(255, 215, 0, 0.5)

#### 12.3 Pulse Animation

- **Idle state**: Slow breathe animation. Inner ring opacity oscillates between base and base + 0.15 on a 1.5s sinusoidal cycle.
  ```
  opacity = baseOpacity + 0.15 * Math.sin(animFrame * 0.04)
  ```
- **Ball within 10 table units**: Pulse freezes. All rings become solid at max opacity. Center dot brightens to rgba(255, 215, 0, 1.0).
- **Ball within 3 table units (inner ring)**: Inner ring fills with rgba(255, 215, 0, 0.4). Visual "glow" effect.

---

### 13. Scoring Display

#### 13.1 Scoreboard (Above Table)

Positioned above the canvas, centered horizontally:

```
  PLAYER A  [1]  -  [0]  PLAYER B
  (Gold)              (Blue)
```

- Player names from `PlayerInfo.displayName` or fallback "Player A" / "Player B"
- Score numbers are large (24px), bold, monospace
- Active shooter's name is highlighted (brighter text)
- Format indicator below: "FIRST TO 2" / "FIRST TO 3" / "FIRST TO 5"

#### 13.2 Round Result Banner

After both balls settle, a centered banner appears over the table for 1.0 second:

**Win**: `"PLAYER [A/B] WINS ROUND"` -- green text on dark semi-transparent background
**Tie**: `"ROUND TIED -- 0.5 EACH"` -- amber text
**Foul win**: `"FOUL! PLAYER [A/B] WINS ROUND"` -- red "FOUL!" then green text

#### 13.3 Match Result Banner

When a player reaches the required win count:

`"PLAYER [A/B] WINS THE MATCH!"` -- large text, 2 seconds display, then triggers settlement flow.

---

### 14. Clear Between Rounds

**Decision: Yes, full clear every round.**

Between rounds:
1. Leader lines and distance numbers fade out (0.3s)
2. Both balls fade out simultaneously (0.3s)
3. Table is empty for 0.2s (clean visual break)
4. New Bullseye appears with ring expansion animation (0.5s)
5. First shooter's ball appears at head position (0.3s)

**Rationale**: Leaving old balls on the table would obscure the Bullseye, create visual clutter, and add confusing physics interactions with stale balls. A fresh table each round keeps the game readable (Pillar 1) and each round feeling like a clean contest.

---

### 15. Game State Machine

```
STATES:
  round_setup          -- Bullseye placed, first ball appearing
  p1_aiming            -- First shooter (per turn order) can aim
  p1_rolling           -- First shooter's ball in motion
  p1_settled           -- First shooter's ball at rest, distance displayed
  p2_aiming            -- Second shooter can aim
  p2_rolling           -- Second shooter's ball in motion
  round_result         -- Both settled, comparing distances, showing result
  round_transition     -- Clearing table, preparing next round
  match_over           -- Winner determined, settlement flow

TRANSITIONS:
  round_setup -> p1_aiming:          After Bullseye animation completes + ball placed
  p1_aiming -> p1_rolling:           On shot (release drag or shot clock auto-fire)
  p1_rolling -> p1_settled:          When allAtRest() returns true
  p1_settled -> p2_aiming:           After 0.5s pause + P2 ball placement
  p2_aiming -> p2_rolling:           On shot
  p2_rolling -> round_result:        When allAtRest() returns true
  round_result -> round_transition:  After 1.5s result display
  round_transition -> round_setup:   If no player has reached win threshold
  round_transition -> match_over:    If a player has reached win threshold

FOUL TRANSITIONS:
  p1_rolling -> round_result:        If P1's ball is pocketed (skip P2's turn, P2 wins round)
  p2_rolling -> round_result:        If P2's ball is pocketed (P1 wins round)

DOUBLE FOUL:
  p2_rolling -> round_setup:         If P2's ball pocketed AND P1 already fouled. Replay round.
```

---

### 16. Game Data Schema (Server Sync)

```typescript
interface BullseyeGameData {
  phase: BullseyePhase;
  roundNumber: number;
  firstShooterThisRound: 'A' | 'B';
  bullseye: { x: number; y: number };
  previousQuadrant: number | null;
  ballA: { x: number; y: number; pocketed: boolean } | null;
  ballB: { x: number; y: number; pocketed: boolean } | null;
  distanceA: number | null;  // table units, raw float
  distanceB: number | null;
  scoreA: number;   // can be X.5 due to tied rounds
  scoreB: number;
  roundsToWin: number;
  winner: 'A' | 'B' | null;
  lastShot: {
    player: 'A' | 'B';
    angle: number;
    power: number;
  } | null;
  shotNumber: number;  // global shot counter for sync
}

type BullseyePhase =
  | 'round_setup'
  | 'p1_aiming'
  | 'p1_rolling'
  | 'p1_settled'
  | 'p2_aiming'
  | 'p2_rolling'
  | 'round_result'
  | 'round_transition'
  | 'match_over';
```

---

### 17. PlayStake Widget Integration

Integration follows the identical pattern established by 3-Shot Pool and 8-Ball Pool:

1. **Role Selection**: `RoleSelector` with `gameLabel={{ a: 'Gold', b: 'Blue' }}`
2. **Game Creation**: `useGameSession.createGame(playerId, 'bullseye')`
3. **Lobby**: `LobbyPanel` -- Player A creates, shares code; Player B joins
4. **Bet Flow**: PlayStake widget handles CREATE_BET / BET_ACCEPTED via postMessage
5. **Game Play**: Local physics simulation, game data synced to server via `setGameData()`
6. **Resolution**: `resolveGame('A' | 'B')` -- never 'draw'
7. **Settlement**: `reportAndSettle()` triggers PlayStake API

**Game type string**: `'bullseye'` (added to `GameType` union)

**Result mapping**:
- `scoreA >= roundsToWin` -> `resolveGame('A')` -> `PLAYER_A_WIN`
- `scoreB >= roundsToWin` -> `resolveGame('B')` -> `PLAYER_B_WIN`
- DRAW is structurally impossible due to sudden-death tiebreak

---

### 18. Investor Demo Mode

#### 18.1 Entry

Demo mode activates when a URL parameter `?demo=true` is present, or via a "Watch Demo" button on the page.

#### 18.2 Demo Configuration

- Auto-start: skip role-select, lobby, and bet acceptance phases
- Wager display: "0.50 USDC"
- Player names: "Player 1" (Gold) vs "Player 2" (Blue)
- Match format: Sprint (first to 2)
- Bot plays at 1.5x physics speed (multiply velocities by 1.5 in stepPhysics, or reduce FRICTION to 0.978 to make balls settle faster)

#### 18.3 Scripted Demo Sequence

Each demo loop runs the following scripted rounds:

**Round 1** -- P1 goes first
- Bullseye placement: Centre Diamond zone, coordinates `(0.50, 0.45)` normalized
- P1 shot: angle and power calculated to land ~8 table units from Bullseye
- P2 shot: angle and power calculated to land ~19 table units from Bullseye
- Result: P1 wins round. Score: 1-0.

**Round 2** -- P2 goes first (turn rotation)
- Bullseye placement: Mid-Table zone, different quadrant, coordinates `(0.35, 0.70)` normalized
- P2 shot: lands ~7 table units from Bullseye
- P1 shot: lands ~22 table units (overshoot)
- Result: P2 wins round. Score: 1-1.

**Round 3** -- P1 goes first
- Bullseye placement: Rail-Adjacent zone, coordinates `(0.60, 0.12)` normalized (near top rail)
- P1 shot: lands ~11 table units from Bullseye (good approach despite rail)
- P2 shot: lands ~13 table units (slightly worse)
- Result: P1 wins. Final score: 2-1. P1 wins match.

**Every 4th loop** -- inject a tied round:
- Round 2 modified: both players land at ~12 table units (within 0.005 of each other)
- Result: Round tied, 0.5 each. Score after round 2: 1.0-0.5.
- Round 3 plays as normal. P1 still wins 2.0-0.5.

#### 18.4 Demo Shot Execution

To make demo shots land at specific distances, pre-calculate the shot parameters:
```
targetLandingX = bullseye.x + desiredDistance * cos(approachAngle) * (TABLE_WIDTH / 100)
targetLandingY = bullseye.y + desiredDistance * sin(approachAngle) * (TABLE_WIDTH / 100)

// Then solve for shot angle and power from head position to target landing
// Use inverse kinematics: given FRICTION and physics, what initial velocity
// produces a ball that stops at (targetX, targetY)?
```

The demo bot should add slight randomness to the approach angle (+/- 5 degrees) so each loop looks slightly different.

#### 18.5 Game Over Copy

After match resolution, display overlay text:

```
"In a live match, this wager resolves on-chain instantly.
Player 1 would receive 0.475 USDC in their wallet right now."
```

The 0.475 figure = 0.50 * 2 * 0.95 (assuming 5% platform fee). If the actual fee is different, calculate dynamically.

#### 18.6 Loop Behavior

After showing game over for 3 seconds, the demo resets and plays again. A small "Replay" indicator appears in the corner. The loop runs indefinitely until the user navigates away or clicks "Play for Real" (which navigates to the standard game flow).

---

### 19. UI Strings (Complete)

| Context | String |
|---------|--------|
| Page title | "Bullseye Pool" |
| Page subtitle | "Land closest to the target. Win the round." |
| Scoreboard format label | "FIRST TO {N}" |
| Round start | "ROUND {N}" |
| Your turn | "YOUR SHOT" |
| Opponent's turn | "OPPONENT'S SHOT" |
| Shot clock warning | (no text, visual pulse only) |
| Auto-fire | "Time's up! Auto-shot fired." |
| P1 settled (waiting for P2) | "Distance: {X} -- Waiting for opponent..." |
| Round win | "{PLAYER} WINS ROUND" |
| Round tie | "ROUND TIED -- 0.5 EACH" |
| Foul (ball pocketed) | "FOUL! Ball pocketed." |
| Double foul | "DOUBLE FOUL -- Round replayed" |
| Match win | "{PLAYER} WINS THE MATCH!" |
| Demo overlay | "In a live match, this wager resolves on-chain instantly." |
| Demo payout | "Player 1 would receive {amount} USDC in their wallet right now." |
| Sudden death announce | "SUDDEN DEATH" |

---

### 20. Balance and Tuning Table

| Variable | Value | Min | Max | Rationale |
|----------|-------|-----|-----|-----------|
| `ROUNDS_TO_WIN_DEMO` | 2 | 1 | 5 | Sprint format. 2 wins keeps demo under 90s. |
| `ROUNDS_TO_WIN_STANDARD` | 3 | 2 | 5 | Standard play. |
| `ROUNDS_TO_WIN_EXTENDED` | 5 | 3 | 7 | High-stakes. |
| `SHOT_CLOCK_SECONDS` | 12 | 8 | 20 | [PLACEHOLDER] Shorter than 3-Shot's 30s. Simple shots need less time. Test if 12s feels rushed. |
| `SHOT_CLOCK_WARNING` | 3 | 2 | 5 | Red pulse threshold. |
| `AUTO_SHOT_POWER_FRAC` | 0.15 | 0.10 | 0.25 | Weak auto-shot as punishment for timeout. |
| `BULLSEYE_INNER_RING` | 3 table units (24px) | 2 | 5 | "Perfect" zone. Landing here should feel exceptional. |
| `BULLSEYE_MIDDLE_RING` | 8 table units (64px) | 5 | 12 | "Good" zone. Typical competitive landing. |
| `BULLSEYE_OUTER_RING` | 15 table units (120px) | 10 | 20 | Guidance ring. Visible at a glance. |
| `POCKET_EXCLUSION` | 96px (12% of TABLE_WIDTH) | 80 | 120 | Keeps Bullseye away from pockets. |
| `SHORT_RAIL_EXCLUSION` | 0.15 (normalized) | 0.10 | 0.20 | Prevents unshootable placements near short rails. |
| `RAIL_ADJACENT_PROB` | 0.25 | 0.15 | 0.35 | 25% rail placements for drama without frustration. |
| `CENTRE_PROB` | 0.30 | 0.20 | 0.40 | Centre placements are readable, good for demos. |
| `MID_TABLE_PROB` | 0.45 | 0.30 | 0.55 | Default zone. |
| `ROUND_TRANSITION_MS` | 2500 | 1500 | 4000 | Time between round end and next shot clock start. |
| `ROUND_RESULT_DISPLAY_MS` | 1500 | 1000 | 2500 | How long the round winner banner shows. |
| `MATCH_OVER_DISPLAY_MS` | 2000 | 1500 | 3000 | Time before sending settlement postMessage. |
| `MAX_DISTANCE` | 112 | - | - | Foul penalty distance. Larger than any possible real distance (~111.8 max corner-to-corner). |
| `HEAD_POSITION_X` | OFFSET + TABLE_WIDTH * 0.25 | - | - | Same as existing games. |
| `HEAD_POSITION_Y` | OFFSET + TABLE_HEIGHT / 2 | - | - | Centre of table vertically. |
| `BULLSEYE_PULSE_PERIOD` | 1.5s (animFrame * 0.04) | 1.0 | 2.5 | Slow breathe. Should not feel urgent. |
| `BALL_PROXIMITY_FREEZE` | 10 table units (80px) | 5 | 15 | Distance at which Bullseye pulse freezes solid. |
| `P2_APPEAR_DELAY_MS` | 500 | 300 | 800 | Pause after P1 settles before P2's ball appears. |
| `DEMO_PHYSICS_SPEED` | 1.5x | 1.0 | 2.0 | Faster ball settlement in demo mode. |

---

### 21. Mobile Considerations

- `useLandscapeLock()` is called when `phase === 'playing' || phase === 'finished'` (identical to existing games)
- `RotatePrompt` shown when portrait orientation detected
- `GameMobileFAB` provides floating action button for widget access
- Canvas scales to viewport width with aspect ratio preserved (existing pattern)
- Touch drag mechanic identical to existing pool games -- no changes needed
- Minimum touch target: the ball itself is 20px diameter (10px radius). On mobile with scaling, verify this is at least 44px at rendered size. If not, expand the touch hit area to 22px radius while keeping visual at 10px.

---

### 22. Edge Cases

| # | Edge Case | Resolution |
|---|-----------|------------|
| E1 | Ball stops exactly on Bullseye | Distance = 0.0 table units. Valid. Player wins round unless opponent also scores 0.0 (tie). |
| E2 | Ball exits table bounds (physics bug) | Clamp ball to table bounds on each physics step (already handled by rail bounce code). |
| E3 | Both balls pocketed in same round | Round voided. Replay with new Bullseye. Same first-shooter order. |
| E4 | Player disconnects mid-shot | Shot clock expires, auto-shot fires. If player reconnects, they see result. If they don't reconnect within 30s after match end, opponent wins by forfeit. |
| E5 | P1's ball resting near head position when P2 needs to spawn | Shift P2 spawn up/down by BALL_RADIUS * 4. If still blocked, shift further in increments of BALL_RADIUS * 3. |
| E6 | Bullseye placement algorithm fails 100 attempts | Fallback to exact center of table. Log warning. |
| E7 | Score reaches N-0.5 vs N-0.5 (tied at threshold) | Next round is sudden death. If sudden death also ties, use most recent non-tied round's closer player. Ultimate fallback: Player A wins. |
| E8 | Player shoots ball directly at opponent's ball (take-out) | Legal. Final positions count. Opponent's ball might go closer to Bullseye (risk) or into a pocket (reward). |
| E9 | Player A refreshes page mid-match | Poll server for latest gameData. Reconstruct ball positions from server state. Resume at correct phase. |
| E10 | Bullseye placement near pocket but outside exclusion zone | Legal. Creates high-drama shot where pocket risk is real. This is intended. |
| E11 | Shot power = 0 (player taps without dragging) | Minimum shot power = 0.5 units of velocity (effectively a tap). Ball barely moves. Counts as a valid shot. |
| E12 | P1 knocks P2's ball during P2's shot | Not possible. P1's ball is already at rest. P2 is the active shooter. P2 CAN hit P1's ball though (it's on the table as an obstacle). |

---

### 23. Implementation Notes for Physics Engine

The existing physics engine requires minimal modification for Bullseye Pool:

**Reuse entirely:**
- `stepPhysics()` -- ball movement, friction, rail bounces
- Ball-ball collision detection and resolution
- Pocket detection
- `allAtRest()` check
- `raycastFirstBall()` for aim line
- `drawTable()`, `drawBall()`, `drawPowerMeter()`, `drawCueStick()`, `drawAimLine()`

**Modify:**
- `drawBall()`: Add a variant for Bullseye Pool balls that renders a letter ("A" or "B") instead of a number, and uses the player's assigned color
- `rackBalls()`: Not used. Replace with `placeBullseyeBalls()` that places only 1-2 balls

**Add new:**
- `drawBullseye()`: Render concentric rings, center dot, crosshair
- `drawLeaderLine()`: Line from ball to Bullseye with distance label
- `drawRoundBanner()`: Centered text overlay for round results
- `placeBullseye()`: Placement algorithm from Section 6
- `calculateDistance()`: Distance in table units

**No physics body for Bullseye.** It is purely visual. Balls pass through it.

---

# DELIVERABLE 2: PLAYER EXPERIENCE ARC

## The Investor's Journey Through Bullseye Pool

### Beat 1: First Glance (0-3 seconds)

The investor sees a pool table. Familiar. But something is different -- there are no racked balls. Instead, a golden target pulses gently near the center of the table. A single gold ball sits at the left side. The score reads 0-0, "FIRST TO 2" beneath it. The investor thinks: "This is not regular pool."

### Beat 2: Understanding (3-10 seconds)

Player 1's ball launches across the felt. It rolls, slows, stops -- roughly near the target. A white line appears connecting ball to Bullseye, with "8.2" beside it. The investor immediately understands: the number is the distance. Lower is better. They did not need to be told.

### Beat 3: The Question (10-15 seconds)

A blue ball appears at the starting position. The investor leans forward slightly. The question forms instinctively: "Can Player 2 beat 8.2?" This is the moment the design earns its keep. The investor is now engaged without understanding a single rule beyond "closer wins."

### Beat 4: Resolution (15-25 seconds)

Player 2 shoots. The ball rolls... rolls... stops. "19.4" appears in muted red. Player 1's line turns bright green. "PLAYER 1 WINS ROUND" flashes. Score: 1-0. The investor exhales. They just watched a complete competitive exchange in 15 seconds and understood everything.

### Beat 5: Comeback (25-50 seconds)

Round 2. New Bullseye position -- lower on the table this time. Player 2 goes first now. They nail it: "7.1". Player 1 overshoots: "22.0". Score: 1-1. The investor feels the tension shift. "This is close."

### Beat 6: Climax (50-75 seconds)

Round 3. The Bullseye appears near the top rail -- tricky. Both players land within a few units. The numbers are close: 11 vs 13. The investor finds themselves watching the ball decelerate with genuine anticipation. Player 1 wins 2-1.

### Beat 7: The Pitch (75-90 seconds)

The game over overlay appears: "In a live match, this wager resolves on-chain instantly. Player 1 would receive 0.475 USDC in their wallet right now."

The investor now understands three things simultaneously: (1) the game is simple and watchable, (2) the outcome is unambiguous, and (3) PlayStake can settle real-money wagers on it. The entire arc -- from confusion to comprehension to engagement to pitch -- took ninety seconds.

---

# DELIVERABLE 3: DIFFERENTIATION BRIEF

## How Bullseye Pool Is Mechanically Distinct

### Versus 8-Ball Pool

| Dimension | 8-Ball Pool | Bullseye Pool |
|-----------|-------------|---------------|
| Objective | Pot all your balls then the 8-ball | Land closest to the target |
| Skill expression | Shot selection, position play, safety | Pure distance control |
| Match duration | 3-8 minutes | 60-90 seconds |
| Rules complexity | High (fouls, ball-in-hand, groups, calling pockets) | Minimal (closer wins) |
| Spectator readability | Requires pool knowledge | Instantly legible |
| Outcome clarity | Can be confusing (why was that a foul?) | Always obvious (smaller number wins) |

**What need Bullseye Pool satisfies that 8-Ball does not**: Instant comprehension. An investor, a non-gamer, or a first-time user understands Bullseye Pool in one round without explanation. 8-Ball requires knowledge of solids vs stripes, foul rules, and calling pockets. Bullseye Pool is a 10-second elevator pitch: "Get closer to the dot."

### Versus 3-Shot Pool

| Dimension | 3-Shot Pool | Bullseye Pool |
|-----------|-------------|---------------|
| Objective | Pot the most balls in 3 shots each | Land closest to the target |
| Scoring | Count of pocketed balls | Distance measurement |
| Outcome type | Discrete (0-15 per turn) | Continuous (0.0-112.0 per round) |
| Drama source | "Will it go in the pocket?" | "How close will it stop?" |
| Table state | Complex (15 balls, evolving positions) | Minimal (2 balls, 1 target) |

**What need Bullseye Pool satisfies that 3-Shot does not**: Visual simplicity and moment-to-moment tension. 3-Shot Pool still has a cluttered table with 15 balls. The drama is binary (potted or not potted). Bullseye Pool's drama is analog -- the ball sliding to a stop near the target has a continuous tension curve that binary pocket outcomes cannot match. The "did it go in?" question becomes "how close will it get?" which is more suspenseful because the answer reveals itself gradually over 2-3 seconds of deceleration.

### The Portfolio Argument

PlayStake now offers three pool variants that serve three different player needs:

1. **8-Ball Pool**: For pool players who want a full game. Deep strategy, long sessions, traditional.
2. **3-Shot Pool**: For competitive players who want quick, high-action matches. Potting-focused.
3. **Bullseye Pool**: For everyone else. Zero learning curve. Pure precision skill. Perfect for demos, casual play, and onboarding new users to the platform.

Bullseye Pool is the game you show first. 8-Ball is the game you retain with.

---

# DELIVERABLE 4: FRONTEND DEVELOPER HANDOFF

## Task List

### MUST-HAVE (Ship for investor demo)

**M1. Page scaffold and routing** (2h)
- Create `/src/app/demo/bullseye/page.tsx`
- Copy structure from `3shot/page.tsx`: imports, component skeleton, role selector, lobby panel, widget integration
- Add `'bullseye'` to `GameType` union in `types.ts`
- Wire up `useDemoAuth('bullseye')`, `useGameSession()`, `useLandscapeLock()`

**M2. Bullseye placement system** (2h)
- Implement `placeBullseye(previousQuadrant)` per Section 6 algorithm
- Zone selection with weighted random
- All exclusion checks (pocket radius, short rail, quadrant)
- Unit test: generate 1000 placements, verify distribution matches weights within 10%

**M3. Ball setup per round** (1h)
- `placeBullseyeBalls(firstShooter)` -- places one ball at head position
- After P1 settles, place P2 ball at head position with overlap avoidance (Section 5)
- Clear all balls between rounds

**M4. Bullseye rendering** (2h)
- `drawBullseye(ctx, x, y, animFrame)` -- concentric rings, center dot, crosshair, pulse animation
- Proximity freeze behavior (ball within 10 table units)
- Inner ring glow (ball within 3 table units)

**M5. Player ball rendering** (1h)
- Modify `drawBall()` to accept a label string ("A" or "B") instead of number
- Player A ball: gold (#f5d800) with "A"
- Player B ball: blue (#0055cc) with "B"
- Reuse existing gradient/shadow styling

**M6. Distance measurement and leader lines** (2h)
- `calculateDistance(ball, bullseye)` returns table units (float)
- `drawLeaderLine(ctx, ball, bullseye, distance, isWinner, phase)` renders:
  - Line from ball to Bullseye
  - Distance label beside ball
  - Color coding: green (winner), red (loser), white (pending)

**M7. Game state machine** (4h)
- Implement `BullseyePhase` state machine per Section 15
- Turn order rotation (odd rounds P1 first, even rounds P2 first)
- Shot handling: aim, fire, rolling, settled transitions
- Foul detection: ball pocketed -> MAX_DISTANCE
- Round result calculation: compare distances, assign points (1 or 0.5)
- Match end detection: check if either player >= roundsToWin

**M8. Shot clock** (1h)
- Reuse `drawShotClock()` from 3-Shot
- 12-second duration
- Auto-fire on expiry at current aim angle, 15% power
- Reset on each new aiming phase

**M9. Scoreboard UI** (1h)
- Above-canvas score display: `PLAYER A [score] - [score] PLAYER B`
- Color-coded names (gold/blue)
- Format label ("FIRST TO 2")
- Active shooter highlight

**M10. Round result banner** (1h)
- Centered overlay text on canvas
- Win: green, Tie: amber, Foul: red
- Display for ROUND_RESULT_DISPLAY_MS (1500ms)

**M11. Match result and settlement** (2h)
- Match over banner (2s)
- Call `resolveGame('A' | 'B')` -- never 'draw'
- Trigger `reportAndSettle()` flow
- Display `GameResultOverlay` component

**M12. Tie resolution logic** (1h)
- Round tie: raw float comparison, threshold 0.005 for tie
- Match tie: sudden-death round with trailing player shooting second
- Ultimate tiebreak: most recent non-tied round winner, then Player A fallback

**M13. Server sync** (2h)
- `syncGameData()` sends `BullseyeGameData` to server via `setGameData()`
- Opponent receives game data via polling, reconstructs state
- Animate opponent's shot from received angle/power (same pattern as 3-Shot)

**M14. Opponent shot replay** (2h)
- When receiving opponent's shot data, replay the physics simulation
- Place opponent's ball, apply shot angle/power, run physics until settled
- Show result after settling

**M15. Mobile touch controls** (1h)
- Reuse existing drag-to-aim from canvas touch events
- Verify touch target size (minimum 44px rendered for ball)
- `GameMobileFAB` for widget access

**Estimated MUST-HAVE total: ~24 hours**

### NICE-TO-HAVE (Post-demo polish)

**N1. Investor demo mode** (4h)
- `?demo=true` parameter detection
- Scripted round sequences per Section 18
- Bot shot calculation (inverse kinematics for target distance)
- 1.5x physics speed
- Auto-loop with 3s pause between matches
- Game over copy overlay

**N2. Bullseye appear animation** (1h)
- Expanding ring animation when Bullseye is placed (0.5s)
- Rings start at radius 0 and expand to full size with easing

**N3. Ball fade animations** (1h)
- Balls fade out between rounds instead of disappearing instantly
- New ball fades in at head position

**N4. Round transition polish** (1h)
- "ROUND N" text briefly appears at round start
- Smooth camera attention flow from Bullseye to ball to aim

**N5. Distance number animation** (0.5h)
- Distance number counts up from 0 to final value over 0.3s when ball settles
- Creates a "meter reading" feel

**N6. Take-out shot feedback** (0.5h)
- When a player hits opponent's ball, flash the opponent's ball briefly
- If opponent's ball goes in pocket, show "KNOCKED OUT!" text

**N7. Perfect shot celebration** (0.5h)
- If ball stops within inner ring (3 table units), brief golden particle burst around Bullseye
- Text: "BULLSEYE!" (or "NEAR PERFECT!" for inner ring edge)

**N8. Standard and Extended format selector** (1h)
- Pre-game UI to select Sprint / Standard / Extended
- Updates `roundsToWin` accordingly

---

# DELIVERABLE 5: OPEN QUESTIONS REGISTER

| # | Question | Recommended Default | Impact if Wrong | Decision Deadline |
|---|----------|-------------------|-----------------|-------------------|
| Q1 | Should P1 be able to see where P2's ball will spawn before P1 shoots? Currently yes (it's always the head position). | Yes -- head position is fixed and known. No surprise. | Low. Both players always know where balls start. | Before M7 |
| Q2 | Should the aim line show trajectory through the Bullseye marker (since it has no physics)? | Yes -- the aim line should pass through the Bullseye as if it is not there, because it IS not there physically. This actually helps the player aim. | Medium. If the aim line stops at the Bullseye, players will think the ball stops there too. | Before M6 |
| Q3 | Can P2 intentionally hit P1's ball? This is implied "yes" in the rules but could be contentious. | Yes. This is the "take-out" strategy from bocce and is the deepest strategic layer. Removing it makes the game purely solo-skill with no interaction. | High. This is a core design decision. If playtesting shows it's frustrating, add a "no-contact" variant. | Before M7 |
| Q4 | Should the shot clock be 12s or 15s? | 12s for demo, 15s for standard/extended play. The demo needs to be fast; real play can breathe. | Low. Easy to tune post-launch. | [PLACEHOLDER] -- playtest |
| Q5 | Should there be a minimum power threshold? (Prevent "zero-power" griefing where player just taps to waste time) | Yes. Minimum velocity = 1.0 (small but non-trivial movement). Below that, force to 1.0. | Low. Edge case. | Before M7 |
| Q6 | How should reconnection work if a player refreshes mid-round? | Reconstruct from server gameData. If a shot was in progress (rolling), treat it as if the ball stopped at its last synced position. | Medium. Affects competitive integrity. | Before M13 |
| Q7 | Should the Bullseye rings be visible during aiming, or only after both balls settle? | Always visible. The rings are aiming aids -- they help the player gauge "how close is close enough." Hiding them removes useful feedback. | Medium. Affects shot difficulty perception. | Before M4 |
| Q8 | Should we show a "ghost Bullseye" on the aim line indicating where the ball would stop if shot at current power? | No for v1. Too complex to calculate (friction-based deceleration path). Nice-to-have for v2. | Low. Would be a significant UX improvement but is not critical. | Post-launch |
| Q9 | Should the demo mode use pre-calculated shot data or actually solve the physics for target distances? | Pre-calculated. Store {angle, power} tuples that produce the desired distances. Solving live is fragile. | Medium. Bad pre-calc = demo looks wrong. | Before N1 |
| Q10 | What happens if a player's ball is moving and hits the rail, then opponent's ball, then goes in a pocket? | Standard rules: ball is pocketed = foul for the shooter. The chain of events doesn't matter; final state matters. | Low. Physics handles this naturally. | Before M7 |
