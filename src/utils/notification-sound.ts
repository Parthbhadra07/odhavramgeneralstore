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

/** Play new-order notification sound. Pass orderId to prevent duplicate playback. */
export function playNewOrderSound(orderId?: string): void {
  if (typeof window === "undefined") return;
  if (orderId) {
    if (playedOrderIds.has(orderId)) return;
    playedOrderIds.add(orderId);
  }

  try {
    const el = getAudio();
    el.currentTime = 0;
    el.volume = 1;
    void el.play().catch((err) => {
      console.log("Notification sound blocked:", err);
    });
  } catch {
    // ignore
  }
}

/** Clear deduplication cache (e.g. after long session). */
export function resetPlayedOrderIds(): void {
  playedOrderIds.clear();
}

/** Test notification sound from admin panel. */
export function testNotificationSound(): void {
  playNewOrderSound(`test-${Date.now()}`);
}
