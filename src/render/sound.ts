// Tiny sound effects made with the Web Audio API (no sound files to download).

let audio: AudioContext | null = null;

export function playSound(kind: 'good' | 'bad' | 'tick', enabled: boolean) {
  if (!enabled) return;
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    const [freq, length] = kind === 'good' ? [660, 0.18] : kind === 'bad' ? [220, 0.25] : [880, 0.06];
    osc.frequency.setValueAtTime(freq, now);
    if (kind === 'good') osc.frequency.linearRampToValueAtTime(990, now + length);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + length);
  } catch { /* sound not available */ }
}
