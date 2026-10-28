// A gentle 60-second paced breath: in for 4, out for 6. No holding.
export const INHALE_MS = 4000;
export const EXHALE_MS = 6000;
export const TOTAL_MS = 60000;

export function breathAt(elapsedMs) {
  const t = Math.max(0, elapsedMs);
  if (t >= TOTAL_MS) return { phase: 'done', phaseSecondsLeft: 0, totalSecondsLeft: 0 };
  const inCycle = t % (INHALE_MS + EXHALE_MS);
  const inhale = inCycle < INHALE_MS;
  const phaseLeft = inhale ? INHALE_MS - inCycle : INHALE_MS + EXHALE_MS - inCycle;
  return {
    phase: inhale ? 'inhale' : 'exhale',
    phaseSecondsLeft: Math.ceil(phaseLeft / 1000),
    totalSecondsLeft: Math.ceil((TOTAL_MS - t) / 1000),
  };
}
