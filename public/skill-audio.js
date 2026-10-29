/* Distinct synthesized underwater motifs for every combat and shop skill. No external audio files required. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AbyssalSkillAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PATTERNS = Object.freeze({
    power:      { notes:[196, 392, 587], wave:'sawtooth', step:.065, duration:.19, fall:.72 },
    rate:       { notes:[740, 988, 1318, 1568], wave:'square', step:.045, duration:.12, fall:.88 },
    speed:      { notes:[247, 370, 554], wave:'triangle', step:.055, duration:.15, fall:.78 },
    range:      { notes:[440, 554, 831], wave:'sine', step:.10, duration:.22, fall:.68 },
    magnet:     { notes:[330, 415, 622, 831], wave:'sine', step:.075, duration:.20, fall:.84 },
    regen:      { notes:[262, 330, 392, 523], wave:'triangle', step:.11, duration:.24, fall:.91 },
    shield:     { notes:[147, 147, 294, 440], wave:'square', step:.055, duration:.17, fall:.62 },
    burst:      { notes:[110, 220, 165], wave:'sawtooth', step:.07, duration:.24, fall:.52 },
    electric:   { notes:[880, 330, 1047, 440], wave:'square', step:.035, duration:.11, fall:.95 },
    pierce:     { notes:[659, 220, 659, 1318], wave:'sawtooth', step:.06, duration:.16, fall:.72 },
    ricochet:   { notes:[392, 784, 523, 988], wave:'triangle', step:.045, duration:.15, fall:.86 },
    nova:       { notes:[65, 98, 147, 294], wave:'sawtooth', step:.10, duration:.30, fall:.48 },
    pulse:      { notes:[164, 246, 369, 554], wave:'triangle', step:.075, duration:.21, fall:.66 },
    dash:       { notes:[1175, 784, 1568], wave:'square', step:.045, duration:.13, fall:.9 },
    bulkhead:   { notes:[98, 147, 196], wave:'square', step:.09, duration:.22, fall:.62 },
    focuser:    { notes:[523, 659, 1047], wave:'sine', step:.075, duration:.18, fall:.82 },
    current:    { notes:[294, 440, 587, 784], wave:'triangle', step:.055, duration:.16, fall:.88 },
    startShield:{ notes:[130, 196, 260, 390], wave:'square', step:.08, duration:.20, fall:.58 }
  });

  function play(context, skillId, options = {}) {
    const pattern = PATTERNS[skillId];
    if (!context || !pattern || typeof context.createOscillator !== 'function') return false;
    const start = Number(context.currentTime) || 0;
    const volume = Math.max(0, Math.min(.06, Number(options.volume) || .022));
    try {
      pattern.notes.forEach((frequency, index) => {
        const when = start + index * pattern.step;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        oscillator.type = pattern.wave;
        oscillator.frequency.setValueAtTime(frequency, when);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * pattern.fall), when + pattern.duration);
        gain.gain.setValueAtTime(.0001, when);
        gain.gain.linearRampToValueAtTime(volume / (1 + index * .15), when + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, when + pattern.duration);
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(Math.min(2400, frequency * 2.8), when);
          oscillator.connect(filter); filter.connect(gain);
        } else oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(when);
        oscillator.stop(when + pattern.duration + .01);
      });
      return true;
    } catch (_) { return false; }
  }
  return { PATTERNS, play };
});
