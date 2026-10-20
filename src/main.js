/**
 * 階段一：Tesla Model 3 中控屏 (1920×1200 固定設計畫布) 啟動入口
 */
import { phase1Store, validateAndHydrateState, createDefaultState } from './state/phase1Store.js?v=40';
import { Center3DEngine } from './engine/Center3DEngine.js?v=40';
import { CenterDisplayApp } from './ui/CenterDisplayApp.js?v=40';
import { VEHICLE_CONFIGS } from './config/vehicleConfigs.js?v=40';
import { PHASE1_BEHAVIOR_MATRIX } from './config/behaviorMatrix.js?v=40';

function bootstrapPhase1() {
  const rootEl = document.getElementById('app');
  if (!rootEl || rootEl.dataset.bootstrapped === 'true') return;
  rootEl.dataset.bootstrapped = 'true';

  const engine3D = new Center3DEngine(phase1Store);
  const app = new CenterDisplayApp(rootEl, phase1Store, engine3D);

  window.__TESLA_PHASE1__ = {
    store: phase1Store,
    engine3D,
    app,
    VEHICLE_CONFIGS,
    PHASE1_BEHAVIOR_MATRIX,
    validateAndHydrateState,
    createDefaultState
  };
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrapPhase1);
} else {
  bootstrapPhase1();
}
