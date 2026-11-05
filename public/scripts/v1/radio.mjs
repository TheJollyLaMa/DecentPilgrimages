// Opt-in adaptation of DecentCanopy bcf2572 scripts/canopy-radio.js, actual standalone mount API.
export function createRadioController(element, config, { loadWidget = url => import(url), head, windowRef = window } = {}) {
  let widget = null, destroyed = false, loading = false, sequence = 0;
  async function load() {
    if (loading) return;
    destroyed = false;
    loading = true;
    const request = ++sequence;
    element.textContent = 'Loading optional DBuskRadio…';
    try {
      const module = await loadWidget(config.widgetUrl);
      if (destroyed || request !== sequence) return;
      if (typeof module.mount !== 'function') throw new Error('Widget mount export unavailable.');
      element.replaceChildren();
      widget?.destroy();
      widget = module.mount(element, { workerUrl: config.workerUrl, compact: true, theme: 'dark', volume: 0.08, ...(head ? { head } : {}) });
      if (!widget || typeof widget.destroy !== 'function') throw new Error('Widget lifecycle unavailable.');
    } catch {
      if (destroyed || request !== sequence) return;
      element.textContent = 'DBuskRadio unavailable. No playback started. Use Load radio to retry.';
    } finally {
      if (request === sequence) loading = false;
    }
  }
  function destroy() {
    destroyed = true;
    ++sequence;
    loading = false;
    widget?.destroy();
    widget = null;
    element.replaceChildren();
  }
  windowRef.addEventListener('pagehide', destroy);
  return { load, destroy, dispose() { destroy(); windowRef.removeEventListener('pagehide', destroy); } };
}
