/** Anti-ban scheduling helpers (pure, timezone America/Sao_Paulo = UTC-3, no DST). */
const TZ_OFFSET_MIN = -180;

function localMinutes(d: Date): number {
  const m = (d.getUTCHours() * 60 + d.getUTCMinutes() + TZ_OFFSET_MIN + 1440) % 1440;
  return m;
}

/** True between 23:00 and 07:30 Brasília time. */
export function isNightTime(d: Date): boolean {
  const m = localMinutes(d);
  return m >= 23 * 60 || m < 7 * 60 + 30;
}

/** Next 07:30 Brasília after d (only meaningful during night). */
export function nextMorning(d: Date): Date {
  const m = localMinutes(d);
  const target = 7 * 60 + 30;
  const add = m < target ? target - m : 1440 - m + target;
  const out = new Date(d.getTime() + add * 60000);
  out.setUTCSeconds(0, 0);
  return out;
}

export function buildSlots(opts: {
  start: Date; count: number; delayMin: number; delayMax: number; nightPause: boolean; random?: () => number;
}): Date[] {
  const rnd = opts.random ?? Math.random;
  const slots: Date[] = [];
  let t = new Date(opts.start);
  for (let i = 0; i < opts.count; i++) {
    if (i > 0) {
      const lo = Math.max(5, Math.min(opts.delayMin, opts.delayMax));
      const hi = Math.max(lo, opts.delayMax);
      t = new Date(t.getTime() + (lo + rnd() * (hi - lo)) * 1000);
    }
    if (opts.nightPause && isNightTime(t)) t = nextMorning(t);
    slots.push(t);
  }
  return slots;
}
