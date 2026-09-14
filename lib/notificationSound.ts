// Synthesizes a short two-tone chime with the Web Audio API instead of
// shipping an audio asset -- no file to host, and it sounds identical in
// every browser. A single AudioContext is reused across calls; browsers
// warn (and eventually throttle) if a new one is created per play.
let ctx: AudioContext | null = null;

export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!ctx) ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const start = now + i * 0.12;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  } catch (err) {
    console.error('Notification sound unavailable', err);
  }
}
