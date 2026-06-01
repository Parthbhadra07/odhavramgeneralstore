/** Shared alert sounds for admin (unlocked after first user gesture). */

let audioContext: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

/** Call once after click/tap so order sounds are not blocked by the browser. */
export function unlockNotificationAudio(): void {
  const ctx = getContext();
  if (!ctx || unlocked) return;
  void ctx.resume().then(() => {
    unlocked = true;
  });
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume = 0.22
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/** Distinct three-tone chime for new online orders. */
export function playNewOrderSound(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const t = ctx.currentTime;
    playTone(ctx, 880, t, 0.12);
    playTone(ctx, 1108, t + 0.14, 0.12);
    playTone(ctx, 1318, t + 0.28, 0.18);
  } catch {
    // ignore
  }
}
