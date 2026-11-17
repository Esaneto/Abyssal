/* Independent touch pointers: keep the floating movement joystick held while
   any on-screen gameplay button responds to a second finger immediately.
   Android WebView can omit a native click during simultaneous touches. */
(function (global) {
  'use strict';
  function installMobileMultitouchControls(options = {}) {
    const doc = options.document || global.document;
    const shell = options.root || doc?.getElementById('gameShell');
    if (!doc || !shell || shell.__abyssalMobileMultitouchReady) return false;
    shell.__abyssalMobileMultitouchReady = true;
    const pendingNativeClicks = new WeakMap();
    const active = () => doc.body?.classList?.contains('game-active') &&
      doc.body.classList.contains('mobile-game-active');
    const actionable = target => {
      const button = target?.closest?.('button');
      if (!button || !shell.contains(button) || button.disabled ||
          button.closest?.('.screen, [hidden], dialog')) return null;
      return button;
    };
    function onPointerDown(event) {
      // Do NOT test isPrimary: the ability finger is normally pointer #2.
      if (!active() || !['touch', 'pen'].includes(event.pointerType)) return;
      const button = actionable(event.target);
      if (!button) return; // Canvas/joystick keeps its own pointer and capture.
      event.preventDefault();
      event.stopPropagation();
      pendingNativeClicks.set(button, { id: event.pointerId, at: Date.now() });
      if (button.id === 'skinActiveBtn') {
        // Unlike Q/E, R verifies isTrusted in the game engine. Forward the actual
        // touchscreen PointerEvent, never a synthetic click with isTrusted=false.
        global.AbyssalGameHooks?.activateSkinAbilityFromPointer?.(event);
      } else {
        button.click(); // Other gameplay controls retain their existing click handlers.
      }
    }
    function onClickCapture(event) {
      if (!active() || event.isTrusted !== true || event.detail === 0) return;
      const button = actionable(event.target);
      const pending = button && pendingNativeClicks.get(button);
      if (!pending) return;
      if (Date.now() - pending.at > 2500) {
        pendingNativeClicks.delete(button);
        return;
      }
      // PointerEvent click exposes pointerId in modern Android browsers.
      if (event.pointerId != null && event.pointerId !== pending.id) return;
      pendingNativeClicks.delete(button);
      event.preventDefault();
      event.stopImmediatePropagation?.();
      event.stopPropagation();
    }
    shell.addEventListener('pointerdown', onPointerDown, true);
    shell.addEventListener('click', onClickCapture, true);
    return true;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { installMobileMultitouchControls };
  if (global.document) installMobileMultitouchControls();
})(typeof window !== 'undefined' ? window : globalThis);
