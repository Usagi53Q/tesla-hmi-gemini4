/**
 * 階段一：Model 3 中控屏專用 3D 車輛視圖、3D 空調座艙氣流與前排座椅視圖引擎
 * -----------------------------------------------------------------------------
 * 嚴格實作規範第 2、3、4、5 條：
 * 1. 車輛視圖：收合時為正俯視 (Top-down)，展開時為低角度前方三四分之一視角 (Front 3/4)。
 * 2. 旋轉與重置：只有展開時可拖動或用方向鍵旋轉；5 秒無操作自動回到預設視角；
 *    雙擊立即重置；全程禁用滾輪縮放。
 * 3. 前備箱、尾箱、充電口：實時計算車身 3D 部位螢幕投影座標，繪製指向線連至控制按鈕，
 *    並驅動真實 3D 開合動畫（前備箱蓋上掀、尾箱蓋上掀、充電口蓋側開與呼吸燈）。
 * 4. 空調 3D 座艙與可拖動出風方向：渲染 3D 座艙透視結構與雙區動態氣流束。
 * 5. 前排座椅視圖：即時渲染座椅滑軌前後位置與靠背傾角。
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class Center3DEngine {
  constructor(store) {
    this.store = store;
    this.vehicleCanvas = null;
    this.climateCanvas = null;
    this.seatCanvas = null;

    // Three.js 核心物件
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.carRoot = null;
    this.glbModel = null;

    // 可開合動畫樞紐 (Articulated Pivots)
    this.frunkPivot = null;
    this.trunkPivot = null;
    this.chargePortPivot = null;
    this.chargeLedMat = null;
    this.headlightGlows = [];

    // 動畫插值狀態 (60fps 平滑緩動)
    this.anim = {
      expandProgress: 0, // 0 = 收合正俯視, 1 = 展開低角度前 3/4
      camPos: new THREE.Vector3(0, 5.25, 0.01),
      camTarget: new THREE.Vector3(0, 0.25, 0),
      camUp: new THREE.Vector3(0, 0, -1),
      yawDeg: 36,
      pitchDeg: 18,
      frunkAngle: 0,
      trunkAngle: 0,
      chargePortAngle: 0
    };

    // 3D 部位錨點（車身局部空間：車頭朝 +Z，車尾朝 -Z，車頂朝 +Y，車身左側為 +X / 右側為 -X）
    // 注意：在收合俯視圖中，車頭朝上 (+Z 對應螢幕上方)，因此車身左側充電口位於螢幕左側 (-X)，
    // 前備箱與尾箱控制按鈕排布於螢幕右側 (+X)。
    this.anchors3D = {
      frunk: new THREE.Vector3(0.0, 0.76, 1.48),
      trunk: new THREE.Vector3(0.0, 0.92, -1.58),
      chargePort: new THREE.Vector3(-0.78, 0.84, -1.32)
    };

    this.projectedAnchors = {
      frunk: { x: 50, y: 24 },
      trunk: { x: 50, y: 78 },
      chargePort: { x: 34, y: 72 }
    };

    this.particles = Array.from({ length: 44 }, (_, i) => ({
      phase: (i / 44) * Math.PI * 2,
      speed: 0.65 + (i % 5) * 0.12,
      side: i % 2 === 0 ? 'left' : 'right',
      band: (i % 3) - 1
    }));

    this.lastFrameTime = performance.now();
    this.startLoop();
  }

  mountVehicleCanvas(canvasEl) {
    if (!canvasEl || this.vehicleCanvas === canvasEl) return;
    this.vehicleCanvas = canvasEl;
    this.initThreeScene(canvasEl);
    this.bindVehicleCanvasEvents(canvasEl);
  }

  mountClimateCanvas(canvasEl) {
    this.climateCanvas = canvasEl;
    if (canvasEl) {
      this.bindClimateVentDrag(canvasEl);
    }
  }

  mountSeatCanvas(canvasEl) {
    this.seatCanvas = canvasEl;
    if (canvasEl) {
      this.bindSeatCanvasDrag(canvasEl);
    }
  }

  initThreeScene(canvasEl) {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
    } catch (err) {
      console.warn('[Center3DEngine] WebGL fallback mode:', err);
      this.renderer = null;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

    // 燈光配置（車規展廳柔和棚拍光）
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 1.55);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4.5, 7.5, 5.0);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.1);
    fillLight.position.set(-5.0, 4.0, -3.5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe2e8f0, 0.9);
    rimLight.position.set(0, 3.5, -6.0);
    this.scene.add(rimLight);

    // 地面柔和陰影圓盤
    const shadowGeo = new THREE.PlaneGeometry(5.6, 8.2);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(128, 128, 18, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
    grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 256, 256);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.01;
    this.scene.add(shadowMesh);

    this.carRoot = new THREE.Group();
    this.scene.add(this.carRoot);

    // 建立可開合動態部件樞紐（前備箱蓋、尾箱蓋、左後充電口蓋）
    this.buildArticulatedOverlays();

    // 載入真實 Model 3 GLB 模型
    this.loadModel3Glb();
  }

  buildArticulatedOverlays() {
    const flapPaintMat = new THREE.MeshPhysicalMaterial({
      color: 0xd8dce3,
      metalness: 0.45,
      roughness: 0.24,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12
    });
    const bayInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x161920,
      roughness: 0.75,
      metalness: 0.15
    });

    // 1. 前備箱內襯槽與上掀蓋樞紐 (Frunk Pivot)
    const frunkBay = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.16, 0.62), bayInteriorMat);
    frunkBay.position.set(0, 0.64, 1.42);
    this.carRoot.add(frunkBay);

    this.frunkPivot = new THREE.Group();
    this.frunkPivot.position.set(0, 0.75, 1.12); // 鉸鏈位於前擋下方
    const hoodFlap = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.035, 0.74), flapPaintMat);
    hoodFlap.position.set(0, 0.02, 0.36);
    this.frunkPivot.add(hoodFlap);
    this.carRoot.add(this.frunkPivot);

    // 2. 尾箱內襯槽與上掀蓋樞紐 (Trunk Pivot)
    const trunkBay = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.22, 0.64), bayInteriorMat);
    trunkBay.position.set(0, 0.78, -1.55);
    this.carRoot.add(trunkBay);

    this.trunkPivot = new THREE.Group();
    this.trunkPivot.position.set(0, 0.96, -1.24); // 鉸鏈位於後擋風玻璃下緣
    const trunkFlap = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.04, 0.66), flapPaintMat);
    trunkFlap.position.set(0, -0.02, -0.32);
    this.trunkPivot.add(trunkFlap);
    this.carRoot.add(this.trunkPivot);

    // 3. 左後充電口蓋樞紐與狀態指示燈 (Charge Port Pivot)
    this.chargePortPivot = new THREE.Group();
    this.chargePortPivot.position.set(-0.81, 0.84, -1.32);
    const portDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.12, 0.18),
      new THREE.MeshPhysicalMaterial({ color: 0x1e2430, metalness: 0.4, roughness: 0.25 })
    );
    portDoor.position.set(-0.01, 0.05, 0);
    this.chargePortPivot.add(portDoor);

    this.chargeLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const chargeSocketLed = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), this.chargeLedMat);
    chargeSocketLed.position.set(-0.79, 0.84, -1.32);
    this.carRoot.add(chargeSocketLed);
    this.carRoot.add(this.chargePortPivot);
  }

  loadModel3Glb() {
    const cfg = this.store.getVehicleConfig();
    if (!cfg?.model3D?.url) return;

    const loader = new GLTFLoader();
    try {
      const draco = new DRACOLoader();
      draco.setDecoderPath('./vendor/three/addons/libs/draco/');
      loader.setDRACOLoader(draco);
    } catch (_e) {
      // ignore if draco path unused
    }

    loader.load(
      cfg.model3D.url,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const targetLength = 4.25;
        const scale = targetLength / maxDim;
        model.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        model.position.x = -scaledCenter.x;
        model.position.z = -scaledCenter.z;
        model.position.y = -scaledBox.min.y + 0.02;

        // 調整車頂玻璃為深色不透明煙燻材質，避免座椅白色輪廓透出
        model.traverse((child) => {
          if (!child.isMesh) return;
          const matName = (child.material?.name || '').toLowerCase();
          const meshName = (child.name || '').toLowerCase();
          if (matName.includes('glass') || matName.includes('window') || meshName.includes('glass') || meshName.includes('window')) {
            child.material = new THREE.MeshPhysicalMaterial({
              color: 0x0d121a,
              metalness: 0.15,
              roughness: 0.08,
              clearcoat: 1.0,
              clearcoatRoughness: 0.05,
              transparent: false,
              opacity: 1.0
            });
          }
        });

        this.glbModel = model;
        this.carRoot.add(model);
      },
      undefined,
      (err) => {
        console.warn('[Center3DEngine] GLB load fallback:', err);
      }
    );
  }

  bindVehicleCanvasEvents(canvasEl) {
    let pointerDown = false;
    let startX = 0;
    let startY = 0;

    canvasEl.addEventListener('pointerdown', (e) => {
      const st = this.store.getState();
      if (!st.camera3D.expanded) {
        // 收合俯視狀態下不可拖動旋轉
        return;
      }
      pointerDown = true;
      startX = e.clientX;
      startY = e.clientY;
      canvasEl.setPointerCapture?.(e.pointerId);
      this.store.update((s) => {
        s.camera3D.isDragging = true;
        s.camera3D.lastInteractAt = performance.now();
        s.camera3D.inactivityRemainingSec = 5.0;
      }, ['camera-3d']);
    });

    canvasEl.addEventListener('pointermove', (e) => {
      if (!pointerDown) return;
      const st = this.store.getState();
      if (!st.camera3D.expanded) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      this.store.update((s) => {
        s.camera3D.yawDeg = (s.camera3D.yawDeg - dx * 0.45) % 360;
        s.camera3D.pitchDeg = Math.max(8, Math.min(62, s.camera3D.pitchDeg + dy * 0.32));
        s.camera3D.lastInteractAt = performance.now();
        s.camera3D.inactivityRemainingSec = 5.0;
      }, ['camera-3d']);
    });

    const endDrag = () => {
      if (!pointerDown) return;
      pointerDown = false;
      this.store.update((s) => {
        s.camera3D.isDragging = false;
        s.camera3D.lastInteractAt = performance.now();
      }, ['camera-3d']);
    };

    canvasEl.addEventListener('pointerup', endDrag);
    canvasEl.addEventListener('pointercancel', endDrag);

    // 雙擊立即重置預設視角
    canvasEl.addEventListener('dblclick', () => {
      this.resetCameraToDefault();
    });

    // 嚴格禁用滾輪縮放
    canvasEl.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.store.update((s) => {
          s.camera3D.wheelZoomBlockedCount += 1;
        }, ['camera-3d']);
      },
      { passive: false }
    );
  }

  /**
   * 方向鍵旋轉視角（僅展開狀態有效）
   */
  rotateByArrowKey(key) {
    const st = this.store.getState();
    if (!st.camera3D.expanded) return false;
    const stepYaw = 10;
    const stepPitch = 6;
    this.store.update((s) => {
      if (key === 'ArrowLeft') s.camera3D.yawDeg -= stepYaw;
      if (key === 'ArrowRight') s.camera3D.yawDeg += stepYaw;
      if (key === 'ArrowUp') s.camera3D.pitchDeg = Math.min(62, s.camera3D.pitchDeg + stepPitch);
      if (key === 'ArrowDown') s.camera3D.pitchDeg = Math.max(8, s.camera3D.pitchDeg - stepPitch);
      s.camera3D.lastInteractAt = performance.now();
      s.camera3D.inactivityRemainingSec = 5.0;
    }, ['camera-3d']);
    return true;
  }

  resetCameraToDefault() {
    this.store.update((s) => {
      s.camera3D.yawDeg = s.camera3D.defaultYawDeg;
      s.camera3D.pitchDeg = s.camera3D.defaultPitchDeg;
      s.camera3D.lastInteractAt = 0;
      s.camera3D.inactivityRemainingSec = 0;
    }, ['camera-3d']);
  }

  bindClimateVentDrag(canvasEl) {
    let draggingSide = null;
    const updateVentFromEvent = (e) => {
      const st = this.store.getState();
      if (!st.climate.power) return;
      const rect = canvasEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = Math.max(0.12, Math.min(0.88, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0.18, Math.min(0.82, (e.clientY - rect.top) / rect.height));
      this.store.update((s) => {
        if (draggingSide === 'left') {
          s.climate.ventLeft = { x: Math.min(0.48, nx), y: ny };
        } else if (draggingSide === 'right') {
          s.climate.ventRight = { x: Math.max(0.52, nx), y: ny };
        }
      }, ['climate-vent']);
    };

    canvasEl.addEventListener('pointerdown', (e) => {
      const st = this.store.getState();
      if (!st.climate.power) return;
      const rect = canvasEl.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / (rect.width || 1);
      draggingSide = nx < 0.5 ? 'left' : 'right';
      canvasEl.classList.add('is-dragging');
      canvasEl.setPointerCapture?.(e.pointerId);
      updateVentFromEvent(e);
    });

    canvasEl.addEventListener('pointermove', (e) => {
      if (!draggingSide) return;
      updateVentFromEvent(e);
    });

    const stopVentDrag = () => {
      draggingSide = null;
      canvasEl.classList.remove('is-dragging');
    };
    canvasEl.addEventListener('pointerup', stopVentDrag);
    canvasEl.addEventListener('pointercancel', stopVentDrag);
  }

  bindSeatCanvasDrag(canvasEl) {
    let isDraggingSeat = false;
    let dragMode = 'foreAft'; // 'foreAft' | 'recline'
    let startX = 0;
    let startY = 0;

    canvasEl.addEventListener('pointerdown', (e) => {
      isDraggingSeat = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = canvasEl.getBoundingClientRect();
      const ny = (e.clientY - rect.top) / (rect.height || 1);
      dragMode = ny < 0.52 ? 'recline' : 'foreAft';
      canvasEl.classList.add('is-dragging');
      canvasEl.setPointerCapture?.(e.pointerId);
    });

    canvasEl.addEventListener('pointermove', (e) => {
      if (!isDraggingSeat) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      this.store.update((s) => {
        const side = s.seats.activeSide || 'driver';
        const seat = s.seats[side];
        if (dragMode === 'recline') {
          seat.reclineDeg = Math.round(Math.max(15, Math.min(45, seat.reclineDeg + dx * 0.18)));
        } else {
          seat.foreAftMm = Math.round(Math.max(-50, Math.min(50, seat.foreAftMm - dx * 0.35)));
          seat.heightMm = Math.round(Math.max(-20, Math.min(20, seat.heightMm - dy * 0.2)));
        }
      }, ['seats']);
    });

    const stopSeatDrag = () => {
      isDraggingSeat = false;
      canvasEl.classList.remove('is-dragging');
    };
    canvasEl.addEventListener('pointerup', stopSeatDrag);
    canvasEl.addEventListener('pointercancel', stopSeatDrag);
  }

  startLoop() {
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
      this.lastFrameTime = now;

      this.updateVehicle3D(now, dt);
      this.renderClimate3DCanvas(now);
      this.renderSeatCanvas(now);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  updateVehicle3D(now, dt) {
    const st = this.store.getState();
    const c3d = st.camera3D;

    // 1. 檢查展開狀態下 5 秒無操作自動回正
    if (c3d.expanded && !c3d.isDragging && c3d.lastInteractAt > 0) {
      const elapsedSec = (now - c3d.lastInteractAt) / 1000;
      const remain = Math.max(0, 5.0 - elapsedSec);
      c3d.inactivityRemainingSec = remain;
      const badgeEl = document.getElementById('cam-inactivity-badge');
      if (badgeEl) {
        if (remain > 0.05) {
          badgeEl.textContent = `${remain.toFixed(1)} 秒後自動回正`;
          badgeEl.style.display = 'inline-flex';
        } else {
          badgeEl.style.display = 'none';
        }
      }
      if (elapsedSec >= 5.0) {
        c3d.yawDeg = c3d.defaultYawDeg;
        c3d.pitchDeg = c3d.defaultPitchDeg;
        c3d.lastInteractAt = 0;
        c3d.inactivityRemainingSec = 0;
      }
    } else {
      const badgeEl = document.getElementById('cam-inactivity-badge');
      if (badgeEl) badgeEl.style.display = 'none';
    }

    // 2. 平滑插值相機視角（收合時為正俯視 Top-down；展開時為低角度前方三四分之一視角）
    const targetExpand = c3d.expanded ? 1 : 0;
    this.anim.expandProgress += (targetExpand - this.anim.expandProgress) * Math.min(1, dt * 7.5);
    this.anim.yawDeg += (c3d.yawDeg - this.anim.yawDeg) * Math.min(1, dt * 8.5);
    this.anim.pitchDeg += (c3d.pitchDeg - this.anim.pitchDeg) * Math.min(1, dt * 8.5);

    // 收合俯視相機位置：正上方 (0, 5.35, 0.01)，車頭朝螢幕上方
    const topPos = new THREE.Vector3(0, 5.35, 0.01);
    const topTarget = new THREE.Vector3(0, 0.2, 0);
    const topUp = new THREE.Vector3(0, 0, 1);

    // 展開低角度前 3/4 相機位置
    const yawRad = THREE.MathUtils.degToRad(this.anim.yawDeg);
    const pitchRad = THREE.MathUtils.degToRad(this.anim.pitchDeg);
    const radius = 4.35;
    const expPos = new THREE.Vector3(
      Math.sin(yawRad) * Math.cos(pitchRad) * radius,
      Math.sin(pitchRad) * radius + 0.35,
      Math.cos(yawRad) * Math.cos(pitchRad) * radius
    );
    const expTarget = new THREE.Vector3(0, 0.48, 0);
    const expUp = new THREE.Vector3(0, 1, 0);

    const p = this.anim.expandProgress;
    this.anim.camPos.lerpVectors(topPos, expPos, p);
    this.anim.camTarget.lerpVectors(topTarget, expTarget, p);
    this.anim.camUp.lerpVectors(topUp, expUp, p).normalize();

    if (this.camera) {
      this.camera.position.copy(this.anim.camPos);
      this.camera.up.copy(this.anim.camUp);
      this.camera.lookAt(this.anim.camTarget);
    }

    // 3. 前備箱、尾箱、充電口開合動畫插值
    const targetFrunk = st.vehicle.frunkOpen ? -0.62 : 0;
    const targetTrunk = st.vehicle.trunkOpen ? 0.68 : 0;
    const targetPort = st.vehicle.chargePortOpen ? -0.78 : 0;

    this.anim.frunkAngle += (targetFrunk - this.anim.frunkAngle) * Math.min(1, dt * 8);
    this.anim.trunkAngle += (targetTrunk - this.anim.trunkAngle) * Math.min(1, dt * 8);
    this.anim.chargePortAngle += (targetPort - this.anim.chargePortAngle) * Math.min(1, dt * 10);

    if (this.frunkPivot) {
      this.frunkPivot.rotation.x = this.anim.frunkAngle;
      this.frunkPivot.visible = Math.abs(this.anim.frunkAngle) > 0.02;
    }
    if (this.trunkPivot) {
      this.trunkPivot.rotation.x = this.anim.trunkAngle;
      this.trunkPivot.visible = Math.abs(this.anim.trunkAngle) > 0.02;
    }
    if (this.chargePortPivot) {
      this.chargePortPivot.rotation.z = this.anim.chargePortAngle;
      this.chargePortPivot.visible = Math.abs(this.anim.chargePortAngle) > 0.02;
    }
    if (this.chargeLedMat) {
      this.chargeLedMat.color.setHex(
        st.vehicle.chargePortUnlocked ? 0x38bdf8 : st.vehicle.chargePortOpen ? 0x22c55e : 0x334155
      );
    }

    // 4. 渲染 WebGL 或 Canvas2D 保底視圖並更新指向線投影
    if (this.vehicleCanvas && this.camera) {
      const rect = this.vehicleCanvas.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
        if (this.renderer) {
          this.renderer.setSize(rect.width, rect.height, false);
          this.renderer.render(this.scene, this.camera);
        }
        this.updateCalloutProjections();
      }
    }
  }

  /**
   * 將前備箱、尾箱、充電口的 3D 世界座標投影至 0~100 百分比座標，並即時更新 SVG 指向線
   */
  updateCalloutProjections() {
    if (!this.camera) return;
    const tempV = new THREE.Vector3();

    for (const [key, localPt] of Object.entries(this.anchors3D)) {
      tempV.copy(localPt);
      if (this.carRoot) {
        this.carRoot.localToWorld(tempV);
      }
      tempV.project(this.camera);
      const sx = Math.max(8, Math.min(92, (tempV.x * 0.5 + 0.5) * 100));
      const sy = Math.max(8, Math.min(92, (-tempV.y * 0.5 + 0.5) * 100));
      this.projectedAnchors[key] = { x: sx, y: sy };

      const lineEl = document.getElementById(`callout-line-${key}`);
      const dotEl = document.getElementById(`callout-dot-${key}`);
      if (lineEl) {
        lineEl.setAttribute('x2', sx.toFixed(1));
        lineEl.setAttribute('y2', sy.toFixed(1));
      }
      if (dotEl) {
        dotEl.setAttribute('cx', sx.toFixed(1));
        dotEl.setAttribute('cy', sy.toFixed(1));
      }
    }
  }

  /**
   * 渲染底部空調抽屜內之 3D 透視座艙與雙區動態氣流動畫 (#canvas-climate-3d)
   */
  renderClimate3DCanvas(now) {
    const canvas = this.climateCanvas || document.getElementById('canvas-climate-3d');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    const st = this.store.getState();
    const cl = st.climate;
    const isDay = st.settings.appearanceTheme === 'day';

    ctx.save();
    ctx.scale(dpr, dpr);
    const cw = rect.width;
    const ch = rect.height;

    // 1. 3D 座艙透視背景
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    if (isDay) {
      bg.addColorStop(0, '#e2e8f0');
      bg.addColorStop(0.45, '#cbd5e1');
      bg.addColorStop(1, '#f1f5f9');
    } else {
      bg.addColorStop(0, '#0f131a');
      bg.addColorStop(0.45, '#171c26');
      bg.addColorStop(1, '#11151d');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    // 2. 3D 擋風玻璃與儀表台橫貫出風槽 (3D Perspective Dashboard & Windshield)
    const dashY = ch * 0.32;
    const dashLeftX = cw * 0.14;
    const dashRightX = cw * 0.86;

    // 前擋風玻璃梯形（開啟前除霜時泛起暖琥珀色除霜氣流光）
    ctx.beginPath();
    ctx.moveTo(cw * 0.22, ch * 0.06);
    ctx.lineTo(cw * 0.78, ch * 0.06);
    ctx.lineTo(dashRightX, dashY);
    ctx.lineTo(dashLeftX, dashY);
    ctx.closePath();
    ctx.fillStyle = cl.frontDefrost
      ? 'rgba(245, 158, 11, 0.22)'
      : isDay
      ? 'rgba(148, 163, 184, 0.25)'
      : 'rgba(30, 41, 59, 0.55)';
    ctx.fill();
    ctx.strokeStyle = cl.frontDefrost ? '#f59e0b' : 'rgba(148, 163, 184, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 儀表台出風槽主體
    ctx.fillStyle = isDay ? '#334155' : '#222834';
    ctx.beginPath();
    ctx.roundRect(dashLeftX - 10, dashY - 8, dashRightX - dashLeftX + 20, 22, 8);
    ctx.fill();

    // 橫貫隱藏式出風口發光線
    ctx.strokeStyle = cl.power ? '#38bdf8' : '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dashLeftX + 12, dashY + 3);
    ctx.lineTo(dashRightX - 12, dashY + 3);
    ctx.stroke();

    // 3. 3D 前排雙座椅靠背輪廓 (Left Driver & Right Passenger Seats)
    const drawSeat3D = (cx, seatHeat) => {
      ctx.save();
      ctx.translate(cx, ch * 0.78);
      ctx.fillStyle = isDay ? '#cbd5e1' : '#1e2532';
      ctx.strokeStyle = seatHeat > 0 ? '#ef4444' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 2;
      // 椅背
      ctx.beginPath();
      ctx.roundRect(-56, -42, 112, 68, 18);
      ctx.fill();
      ctx.stroke();
      // 頭枕
      ctx.beginPath();
      ctx.roundRect(-28, -68, 56, 26, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    drawSeat3D(cw * 0.32, st.seats.driver.heatLevel);
    drawSeat3D(cw * 0.68, st.seats.passenger.heatLevel);

    // 4. 雙區動態氣流束與可拖動出風焦點 (Animated 3D Airflow Streams)
    const leftOrigin = { x: cw * 0.32, y: dashY + 4 };
    const rightOrigin = { x: cw * 0.68, y: dashY + 4 };
    const leftTarget = { x: cl.ventLeft.x * cw, y: cl.ventLeft.y * ch };
    const rightTarget = { x: cl.ventRight.x * cw, y: cl.ventRight.y * ch };

    if (cl.power) {
      const speedFactor = 0.6 + (cl.fanSpeed / 10) * 1.6;
      for (const pt of this.particles) {
        const origin = pt.side === 'left' ? leftOrigin : rightOrigin;
        const target = pt.side === 'left' ? leftTarget : rightTarget;
        const tempC = pt.side === 'left' ? cl.driverTempC : cl.passengerTempC;
        const isWarm = tempC >= 23.5;

        const prog = ((now * 0.00065 * pt.speed * speedFactor + pt.phase) % 1);
        const spreadX = pt.band * (12 + prog * 36);
        const px = origin.x + (target.x - origin.x) * prog + spreadX;
        const py = origin.y + (target.y - origin.y + 70) * prog;
        const alpha = Math.sin(prog * Math.PI) * (0.35 + (cl.fanSpeed / 10) * 0.45);

        ctx.strokeStyle = isWarm
          ? `rgba(251, 146, 60, ${alpha.toFixed(2)})`
          : `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
        ctx.lineWidth = 2.2 + (1 - prog) * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px - (target.x - origin.x) * 0.08, py - 14);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }

    // 5. 左右可拖動出風方向控制圓環 (Draggable Vent Focus Handles)
    const drawVentHandle = (target, label) => {
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.fillStyle = cl.power ? 'rgba(59, 130, 246, 0.24)' : 'rgba(100, 116, 139, 0.2)';
      ctx.strokeStyle = cl.power ? '#60a5fa' : '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isDay ? '#0f172a' : '#e2e8f0';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, 36);
      ctx.restore();
    };

    drawVentHandle(leftTarget, '左出風向 (可拖動)');
    drawVentHandle(rightTarget, '右出風向 (可拖動)');

    ctx.restore();
  }

  /**
   * 渲染前排座椅視圖畫布 (#canvas-seat-view)
   */
  renderSeatCanvas() {
    const canvas = this.seatCanvas || document.getElementById('canvas-seat-view');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    const st = this.store.getState();
    const side = st.seats.activeSide || 'driver';
    const seat = st.seats[side];
    const isDay = st.settings.appearanceTheme === 'day';

    ctx.save();
    ctx.scale(dpr, dpr);
    const cw = rect.width;
    const ch = rect.height;

    ctx.fillStyle = isDay ? '#f1f5f9' : '#11151e';
    ctx.fillRect(0, 0, cw, ch);

    // 滑軌底座
    const trackY = ch * 0.82;
    ctx.strokeStyle = isDay ? '#94a3b8' : '#334155';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cw * 0.22, trackY);
    ctx.lineTo(cw * 0.78, trackY);
    ctx.stroke();

    // 座椅基準點（隨前後位置 foreAftMm 與高度 heightMm 移動）
    const pivotX = cw * 0.52 - seat.foreAftMm * 1.25;
    const pivotY = trackY - 26 - seat.heightMm * 0.75;

    ctx.save();
    ctx.translate(pivotX, pivotY);

    const fillCol = isDay ? '#334155' : '#262f3f';
    const strokeCol = seat.heatLevel > 0 ? '#ef4444' : '#60a5fa';

    // 座墊 (Cushion)
    ctx.fillStyle = fillCol;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-95, -18, 128, 32, 14);
    ctx.fill();
    ctx.stroke();

    // 靠背 (Backrest — 隨 reclineDeg 旋轉)
    ctx.save();
    ctx.translate(16, -10);
    const rad = THREE.MathUtils.degToRad(seat.reclineDeg - 12);
    ctx.rotate(rad);
    ctx.beginPath();
    ctx.roundRect(-16, -135, 34, 138, 16);
    ctx.fill();
    ctx.stroke();

    // 頭枕
    ctx.beginPath();
    ctx.roundRect(-14, -172, 28, 34, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // 標註指示文字
    ctx.fillStyle = isDay ? '#0f172a' : '#e2e8f0';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(
      `${side === 'driver' ? '駕駛座' : '副駕駛座'} · 前後 ${seat.foreAftMm >= 0 ? '+' : ''}${seat.foreAftMm} mm · 靠背傾角 ${seat.reclineDeg}° · 高度 ${seat.heightMm >= 0 ? '+' : ''}${seat.heightMm} mm`,
      20,
      28
    );

    ctx.restore();
  }
}
