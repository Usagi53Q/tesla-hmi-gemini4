/**
 * TESLA COCKPIT HMI — APPLICATION ENTRY POINT
 */
import { vehicleStore } from './state/vehicleStore.js?v=14';
import { SceneEngine } from './engine/SceneEngine.js?v=14';
import { MapAndMediaEngine } from './engine/MapAndMediaCanvas.js?v=14';
import { CockpitApp } from './ui/CockpitApp.js?v=14';

function bootstrapHMI() {
  const rootEl = document.getElementById('app');
  if (!rootEl || rootEl.dataset.bootstrapped === 'true') return;
  rootEl.dataset.bootstrapped = 'true';

  let sceneEngine;
  try {
    sceneEngine = new SceneEngine(vehicleStore);
  } catch (err) {
    console.error('[Tesla HMI] SceneEngine fallback initialized:', err);
    sceneEngine = { registerCanvas: () => {} };
  }

  const mapMediaEngine = new MapAndMediaEngine(vehicleStore);
  const app = new CockpitApp(rootEl, vehicleStore, sceneEngine, mapMediaEngine);

  window.__TESLA_HMI__ = {
    store: vehicleStore,
    sceneEngine,
    mapMediaEngine,
    app
  };
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrapHMI);
} else {
  bootstrapHMI();
}
