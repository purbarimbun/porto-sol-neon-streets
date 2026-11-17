// Synthesized sound only: every effect is a WebAudio oscillator or noise burst,
// so the game ships no audio files and makes no network request.

export function createSound() {
  let context = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume || 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function noise(duration, volume, lowpass) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.2;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (muted) {
        this.stopEngine();
        this.stopSiren();
      }
      return muted;
    },
    isMuted() {
      return muted;
    },
    shot() {
      noise(0.12, 0.25, 900);
      tone(180, 0.1, 'square', 0.1, 60);
    },
    punch() {
      noise(0.08, 0.2, 500);
    },
    hit() {
      tone(120, 0.15, 'sawtooth', 0.12, 70);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.14);
      setTimeout(() => tone(990, 0.12, 'sine', 0.14), 80);
    },
    cash() {
      tone(880, 0.08, 'sine', 0.14);
      setTimeout(() => tone(1174, 0.08, 'sine', 0.14), 70);
      setTimeout(() => tone(1568, 0.16, 'sine', 0.14), 140);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((freq, i) => setTimeout(() => tone(freq, 0.18, 'triangle', 0.16), i * 110));
    },
    fail() {
      tone(220, 0.4, 'sawtooth', 0.12, 110);
    },
    busted() {
      tone(440, 0.25, 'square', 0.12, 220);
      setTimeout(() => tone(330, 0.35, 'square', 0.12, 165), 220);
    },
    carEnter() {
      tone(300, 0.12, 'triangle', 0.12, 420);
    },
    crash() {
      noise(0.2, 0.25, 700);
    },
    startEngine() {
      if (muted) return;
      const ctx = ensure();
      if (!ctx || engineOsc) return;
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
    },
    setEngine(speedRatio) {
      if (engineOsc && engineGain && !muted) {
        engineOsc.frequency.setTargetAtTime(55 + speedRatio * 90, context.currentTime, 0.05);
        engineGain.gain.setTargetAtTime(0.02 + speedRatio * 0.05, context.currentTime, 0.05);
      }
    },
    stopEngine() {
      if (engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null;
        engineGain = null;
      }
    },
    startSiren() {
      if (muted) return;
      const ctx = ensure();
      if (!ctx || sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenGain.gain.value = 0.035;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.start();
      const wail = () => {
        if (!sirenOsc) return;
        sirenOsc.frequency.setTargetAtTime(sirenOsc.frequency.value > 900 ? 700 : 1150, ctx.currentTime, 0.3);
        setTimeout(wail, 650);
      };
      wail();
    },
    stopSiren() {
      if (sirenOsc) {
        try { sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
  };
}
