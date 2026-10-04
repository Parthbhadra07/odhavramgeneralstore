/** Shared alert sounds for admin (unlocked after first user gesture). */

const SOUND_URL = "/sounds/new-order.mp3";
const SOUND_FALLBACK_URL = "/sounds/new-order.wav";

let audio: HTMLAudioElement | null = null;
let unlocked = false;
const playedOrderIds = new Set<string>();

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.preload = "auto";
    audio.addEventListener(
      "error",
      () => {
        if (audio && !audio.src.endsWith(SOUND_FALLBACK_URL)) {
          audio.src = SOUND_FALLBACK_URL;
        }
      },
      { once: true }
    );
  }
  return audio;
}

/** Call once after click/tap so order sounds are not blocked by the browser. */
export function unlockNotificationAudio(): void {
  if (typeof window === "undefined" || unlocked) return;
  try {
    const el = getAudio();
    el.volume = 0;
    const playPromise = el.play();
    if (playPromise) {
      void playPromise
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.volume = 1;
          unlocked = true;
        })
        .catch(() => {
          el.volume = 1;
        });
    }
  } catch {
    // ignore
  }
}

function playSynthesizedChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    // First bell tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Second bell tone (higher chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.7);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 1000);
  } catch {
    // blocked or unavailable
  }
}

/** Play new-order notification sound. Pass orderId to prevent duplicate playback. */
export function playNewOrderSound(orderId?: string): void {
  if (typeof window === "undefined") return;
  if (orderId) {
    if (playedOrderIds.has(orderId)) return;
    playedOrderIds.add(orderId);
  }

  let playedHtmlAudio = false;
  try {
    const el = getAudio();
    el.currentTime = 0;
    el.volume = 1;
    const p = el.play();
    if (p) {
      p.then(() => {
        playedHtmlAudio = true;
      }).catch(() => {
        // Fallback to Web Audio synthesis if HTML audio is blocked or failed
        playSynthesizedChime();
      });
    } else {
      playedHtmlAudio = true;
    }
  } catch {
    playSynthesizedChime();
  }

  // If HTML audio failed to start after 100ms, trigger chime
  setTimeout(() => {
    if (!playedHtmlAudio) {
      playSynthesizedChime();
    }
  }, 100);
}

/** Clear deduplication cache (e.g. after long session). */
export function resetPlayedOrderIds(): void {
  playedOrderIds.clear();
}

/** Test notification sound from admin panel. */
export function testNotificationSound(): void {
  playNewOrderSound(`test-${Date.now()}`);
}
