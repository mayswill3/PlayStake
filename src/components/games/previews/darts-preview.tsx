'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { DartboardCanvas, type DartsState, type DartThrow, hitTest } from '@/app/play/darts/DartboardCanvas';

const BOARD_CX = 450;
const BOARD_CY = 272;

// Pre-scripted target offsets from board center — visually interesting zones
const DEMO_TARGETS: [number, number][] = [
  [   2,  -122],  // treble 20
  [ -36,  -108],  // treble 5
  [   5,   -14],  // bull area
  [  75,   -88],  // treble 1
  [ -72,    55],  // treble 11
  [   1,     5],  // bullseye
  [  48,   158],  // double 3
  [ -28,   -75],  // single 12
  [  95,    20],  // treble 6
  [-100,   -45],  // treble 14
  [   0,   172],  // double 19
  [  14,   -12],  // near bull
];

const INITIAL_STATE: DartsState = {
  scoreA: 301,
  scoreB: 301,
  currentTurn: 'A',
  dartsThrown: 0,
  turnStartScore: 301,
  currentDarts: [],
  lastTurnResult: null,
  turnHistory: [],
  phase: 'showing',
  winner: null,
  message: '',
  roundFlash: null,
};

export function DartsPreview() {
  const [gs, setGs] = useState<DartsState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef  = useRef(0);   // index into DEMO_TARGETS
  const gsRef    = useRef(gs);  // always-current gs for use inside closures
  gsRef.current  = gs;

  const schedule = useCallback((fn: () => void, delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, delay);
  }, []);

  const throwNextDart = useCallback(() => {
    const state = gsRef.current;

    // Pick next target (cycle through DEMO_TARGETS)
    const [ox, oy] = DEMO_TARGETS[stepRef.current % DEMO_TARGETS.length];
    stepRef.current += 1;
    const landX = BOARD_CX + ox;
    const landY = BOARD_CY + oy;
    const hit   = hitTest(BOARD_CX, BOARD_CY, landX, landY);

    const newDart: DartThrow = { ...hit, x: landX, y: landY };
    const newDarts = [...state.currentDarts, newDart];
    const newThrown = state.dartsThrown + 1;

    if (newThrown < 3) {
      // More darts to throw this turn
      setGs(prev => ({
        ...prev,
        currentDarts: newDarts,
        dartsThrown:  newThrown,
        phase:        'showing',
      }));
      schedule(throwNextDart, 1400);
    } else {
      // Turn over — compute new score
      const turnTotal  = newDarts.reduce((s, d) => s + d.score, 0);
      const prevScore  = state.currentTurn === 'A' ? state.scoreA : state.scoreB;
      const newScore   = prevScore - turnTotal;
      const isBust     = newScore < 0;
      const finalScore = isBust ? prevScore : newScore;

      const nextTurn: 'A' | 'B' = state.currentTurn === 'A' ? 'B' : 'A';
      const nextScoreA = state.currentTurn === 'A' ? finalScore : state.scoreA;
      const nextScoreB = state.currentTurn === 'B' ? finalScore : state.scoreB;

      const newHistory = [
        ...state.turnHistory,
        {
          player:     state.currentTurn,
          total:      turnTotal,
          wasBust:    isBust,
          scoreAfter: finalScore,
        },
      ];

      // Reset after 2 complete rounds (each player has thrown 4 turns)
      const totalTurns = newHistory.length;
      const shouldReset = totalTurns >= 8;

      setGs(prev => ({
        ...prev,
        currentDarts:    newDarts,
        dartsThrown:     newThrown,
        scoreA:          nextScoreA,
        scoreB:          nextScoreB,
        phase:           'showing',
        lastTurnResult:  { player: state.currentTurn, total: turnTotal, wasBust: isBust },
        turnHistory:     newHistory,
      }));

      // After showing final darts, transition to next turn
      schedule(() => {
        if (shouldReset) {
          setGs({ ...INITIAL_STATE });
          stepRef.current = 0;
          schedule(throwNextDart, 1200);
        } else {
          setGs(prev => ({
            ...prev,
            currentTurn:   nextTurn,
            dartsThrown:   0,
            turnStartScore: nextTurn === 'A' ? nextScoreA : nextScoreB,
            currentDarts:  [],
            phase:         'showing',
            message:       '',
          }));
          schedule(throwNextDart, 800);
        }
      }, 2000);
    }
  }, [schedule]);

  useEffect(() => {
    schedule(throwNextDart, 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DartboardCanvas
      gs={gs}
      role={null}
      isMyTurn={false}
      onThrow={() => {}}
      displayNameA="Player A"
      displayNameB="Player B"
    />
  );
}
