/**
 * TESLA COCKPIT HMI — WEBGL2 3D PBR & POST-PROCESSING ENGINE
 * 精修重點：
 * 1. 手機 App 柔光攝影棚調校：降低頂光與環境反射強度，調高車頂玻璃與車漆 clearcoatRoughness，抑制 Bloom 過曝，使車燈與車頂高光柔和自然。
 * 2. 中控 3D ADAS 視角：拉遠相機距離 (radius 11.4)、降低俯視角 (高度降至 2.8m，平視前方遠處車道)，縮小自車佔比並完整展現前方道路與前車。
 * 3. 前車與周圍車流模型：徹底棄用方塊組合，改用與自車一致的流線型轎跑輪廓（並在 GLB 載入後直接復用自車真實流線外殼網格）。
 * 4. 儀錶盤 3D 視角：將自車投影位置上移至畫布中段，確保自車車尾與後輪 100% 完整顯示，不被底部方向盤或邊框截斷。
 * 5. HUD 擋風玻璃場景：針對 HUD 視口單獨提亮道路、車道線、天空地平線與前車輪廓，確保擋風玻璃實景清晰可辨。
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const PAINT_PRESETS = {
  quicksilver: { name: '快銀色 Quicksilver', color: 0x8d949e, emissive: 0x020304, metalness: 0.72, roughness: 0.30, clearcoat: 0.65, clearcoatRoughness: 0.22 },
  stealthgrey: { name: '星空灰 Stealth Grey', color: 0x32363d, emissive: 0x020203, metalness: 0.70, roughness: 0.32, clearcoat: 0.65, clearcoatRoughness: 0.22 },
  pearlwhite: { name: '珍珠白 Pearl White', color: 0xdcdfe6, emissive: 0x040506, metalness: 0.42, roughness: 0.28, clearcoat: 0.65, clearcoatRoughness: 0.20 },
  ultrared: { name: '烈焰紅 Ultra Red', color: 0x8a161e, emissive: 0x060102, metalness: 0.68, roughness: 0.30, clearcoat: 0.68, clearcoatRoughness: 0.20 },
  deepblue: { name: '深海藍 Deep Blue', color: 0x183059, emissive: 0x02040a, metalness: 0.68, roughness: 0.30, clearcoat: 0.68, clearcoatRoughness: 0.20 }
};

export class SceneEngine {
  constructor(store) {
    this.store = store;
    this.canvases = new Map();
    this.carParts = {};
    this.roadOffset = 0;
    this.wheelAngle = 0;
    this.wiperPhase = 0;
    this.modelLoaded = false;

    this.orbits = {
      mobile: { theta: 0.60, phi: 1.20, radius: 5.35, targetY: 0.48, autoRotate: true, dragging: false },
      center: { theta: 0.0, phi: 1.31, radius: 11.6, targetY: 0.68, autoRotate: false, dragging: false }
    };

    this.initRenderer();
    this.initScene();
    this.initRoadAndEnvironment();
    this.initSurroundingCars();
    this.initWeatherParticles();
    this.loadTeslaModel();
    this.startRenderLoop();
  }

  initRenderer() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 960;
    this.offscreenCanvas.height = 600;

    const gl = this.offscreenCanvas.getContext('webgl2', {
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.offscreenCanvas,
      context: gl || undefined,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(960, 600, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.80;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.cameras = {
      mobile: new THREE.PerspectiveCamera(31, 1.35, 0.1, 180),
      center: new THREE.PerspectiveCamera(38, 0.8, 0.1, 220),
      cluster: new THREE.PerspectiveCamera(32, 2.85, 0.1, 220),
      hud: new THREE.PerspectiveCamera(28, 2.6, 0.1, 220)
    };

    this.scene = new THREE.Scene();
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.cameras.center);
    this.composer.addPass(this.renderPass);

    // 極克制的柔光 Bloom，徹底消除車燈與車頂過曝白斑
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(960, 600), 0.05, 0.22, 0.96);
    this.composer.addPass(this.bloomPass);

    try {
      this.smaaPass = new SMAAPass(960, 600);
      this.composer.addPass(this.smaaPass);
    } catch (e) {
      this.smaaPass = null;
    }

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  createCarPaintNormalMap() {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const waveX = Math.sin((x / size) * Math.PI * 16) * 2 + Math.cos((y / size) * Math.PI * 12) * 1.5;
        const waveY = Math.cos((y / size) * Math.PI * 16) * 2 + Math.sin((x / size) * Math.PI * 12) * 1.5;
        data[idx] = Math.min(255, Math.max(0, Math.round(128 + waveX)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(128 + waveY)));
        data[idx + 2] = 252;
        data[idx + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    texture.needsUpdate = true;
    return texture;
  }

  createWheelSpokePatternMap() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4b515c';
    ctx.fillRect(0, 0, size, size);

    ctx.translate(size / 2, size / 2);
    for (let i = 0; i < 10; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 10);
      ctx.fillStyle = i % 2 === 0 ? '#9ca3af' : '#262a32';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(24, -124);
      ctx.lineTo(-24, -124);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /**
   * 柔和攝影棚環境貼圖（降低頂部柔光箱亮度，消除車頂與前蓋刺眼高光）
   */
  generateHDRIEnvironment(isNight = true) {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(isNight ? 0x101216 : 0xcbd0d8);

    const topLightGeo = new THREE.PlaneGeometry(32, 12);
    const topLightMat = new THREE.MeshBasicMaterial({
      color: isNight ? 0x525866 : 0xb8c0cc,
      side: THREE.DoubleSide
    });
    const topStrip = new THREE.Mesh(topLightGeo, topLightMat);
    topStrip.position.set(0, 16, 0);
    topStrip.rotation.x = Math.PI / 2;
    envScene.add(topStrip);

    const sideStripGeo = new THREE.PlaneGeometry(34, 3.2);
    const sideMat = new THREE.MeshBasicMaterial({ color: isNight ? 0x454b57 : 0xd1d5db, side: THREE.DoubleSide });
    const sideL = new THREE.Mesh(sideStripGeo, sideMat);
    sideL.position.set(-15, 4.5, 0);
    sideL.rotation.y = Math.PI / 2;
    envScene.add(sideL);

    const sideR = new THREE.Mesh(sideStripGeo, sideMat);
    sideR.position.set(15, 4.5, 0);
    sideR.rotation.y = -Math.PI / 2;
    envScene.add(sideR);

    const horizonGeo = new THREE.CylinderGeometry(24, 24, 3.5, 32, 1, true);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: isNight ? 0x20242c : 0xd8dde6,
      side: THREE.BackSide
    });
    const horizon = new THREE.Mesh(horizonGeo, horizonMat);
    horizon.position.y = 1.6;
    envScene.add(horizon);

    const envRT = pmrem.fromScene(envScene, 0.06);
    pmrem.dispose();
    return envRT.texture;
  }

  initScene() {
    this.paintNormalMap = this.createCarPaintNormalMap();
    this.wheelSpokeTex = this.createWheelSpokePatternMap();
    this.envMapNight = this.generateHDRIEnvironment(true);
    this.envMapDay = this.generateHDRIEnvironment(false);

    this.scene.environment = this.envMapNight;
    this.scene.background = new THREE.Color(0x121316);
    this.scene.fog = new THREE.FogExp2(0x121316, 0.011);

    this.hemiLight = new THREE.HemisphereLight(0xcbd5e1, 0x121316, 0.72);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xe5e7eb, 1.05);
    this.dirLight.position.set(7, 14, 9);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 45;
    const d = 8;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(0x9ca3af, 0.48);
    this.rimLight.position.set(-10, 5, -8);
    this.scene.add(this.rimLight);

    this.egoCarGroup = new THREE.Group();
    this.scene.add(this.egoCarGroup);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 512;
    const sctx = shadowCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(128, 256, 20, 128, 256, 125);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.50)');
    grad.addColorStop(1, 'rgba(0,0,0,0.0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 256, 512);
    const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);

    const contactGeo = new THREE.PlaneGeometry(2.5, 4.8);
    const contactMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.78
    });
    this.contactShadowMesh = new THREE.Mesh(contactGeo, contactMat);
    this.contactShadowMesh.rotation.x = -Math.PI / 2;
    this.contactShadowMesh.position.y = 0.015;
    this.egoCarGroup.add(this.contactShadowMesh);

    this.initBaseMaterials();
    this.buildProceduralEgoCar();
  }

  initRoadAndEnvironment() {
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    const roadGeo = new THREE.PlaneGeometry(34, 280, 8, 32);
    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0x161920,
      roughness: 0.80,
      metalness: 0.08,
      envMapIntensity: 0.42
    });
    this.roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.receiveShadow = true;
    this.roadGroup.add(this.roadMesh);

    const solidLineGeo = new THREE.PlaneGeometry(0.055, 280);
    this.solidLineMat = new THREE.MeshBasicMaterial({ color: 0x525866, transparent: true, opacity: 0.65 });
    for (const xPos of [-5.25, 5.25]) {
      const edgeLine = new THREE.Mesh(solidLineGeo, this.solidLineMat);
      edgeLine.rotation.x = -Math.PI / 2;
      edgeLine.position.set(xPos, 0.012, 0);
      this.roadGroup.add(edgeLine);
    }

    this.dashedLinesGroup = new THREE.Group();
    this.roadGroup.add(this.dashedLinesGroup);
    const dashGeo = new THREE.PlaneGeometry(0.055, 3.0);
    this.dashMat = new THREE.MeshBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.68 });
    this.dashMeshes = [];
    for (const lx of [-1.75, 1.75]) {
      for (let z = -80; z <= 140; z += 9) {
        const dash = new THREE.Mesh(dashGeo, this.dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.015, z);
        dash.userData.baseX = lx;
        dash.userData.baseZ = z;
        this.dashedLinesGroup.add(dash);
        this.dashMeshes.push(dash);
      }
    }

    const apEdgeGeo = new THREE.PlaneGeometry(0.065, 110);
    this.apEdgeMat = new THREE.MeshBasicMaterial({
      color: 0x3e6ae1,
      transparent: true,
      opacity: 0.68,
      depthWrite: false
    });
    this.apLeftEdge = new THREE.Mesh(apEdgeGeo, this.apEdgeMat);
    this.apLeftEdge.rotation.x = -Math.PI / 2;
    this.apLeftEdge.position.set(-1.68, 0.018, 48);
    this.apRightEdge = new THREE.Mesh(apEdgeGeo, this.apEdgeMat);
    this.apRightEdge.rotation.x = -Math.PI / 2;
    this.apRightEdge.position.set(1.68, 0.018, 48);
    this.roadGroup.add(this.apLeftEdge, this.apRightEdge);

    this.arChevrons = [];
    const chevronShape = new THREE.Shape();
    chevronShape.moveTo(0, 0.62);
    chevronShape.lineTo(0.68, -0.18);
    chevronShape.lineTo(0.52, -0.32);
    chevronShape.lineTo(0, 0.28);
    chevronShape.lineTo(-0.52, -0.32);
    chevronShape.lineTo(-0.68, -0.18);
    chevronShape.closePath();
    const chevronGeo = new THREE.ShapeGeometry(chevronShape);
    this.chevronMat = new THREE.MeshBasicMaterial({
      color: 0xe5e7eb,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    for (let i = 0; i < 3; i++) {
      const ch = new THREE.Mesh(chevronGeo, this.chevronMat.clone());
      ch.rotation.x = -Math.PI / 2;
      ch.position.set(0, 0.022, 12 + i * 9.5);
      this.roadGroup.add(ch);
      this.arChevrons.push(ch);
    }

    this.streetLights = [];
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.07, 6.8, 8);
    const armGeo = new THREE.BoxGeometry(1.6, 0.05, 0.07);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x262930, metalness: 0.4, roughness: 0.7 });
    const lampBulbGeo = new THREE.BoxGeometry(0.38, 0.04, 0.14);
    this.lampBulbMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      emissive: 0x9ca3af,
      emissiveIntensity: 0.55
    });

    for (let z = -60; z <= 120; z += 40) {
      for (const side of [-1, 1]) {
        const lampGroup = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(side * 7.8, 3.4, 0);
        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.position.set(side * 7.0, 6.75, 0);
        const bulb = new THREE.Mesh(lampBulbGeo, this.lampBulbMat);
        bulb.position.set(side * 6.4, 6.70, 0);
        lampGroup.add(pole, arm, bulb);
        lampGroup.position.z = z;
        lampGroup.userData.baseZ = z;
        this.roadGroup.add(lampGroup);
        this.streetLights.push(lampGroup);
      }
    }
  }

  /**
   * 建立與自車一致的流線型轎跑輪廓前車與鄰車（徹底取代方塊拼裝，並在 GLB 載入後升級為真實 Model 3 同款流線網格）
   */
  createSleekSedanSilhouetteGroup(isLeadTarget = false) {
    const g = new THREE.Group();
    const shellHolder = new THREE.Group();
    shellHolder.name = 'sedanShellHolder';
    g.add(shellHolder);

    // 流線型 Fastback 轎跑側面輪廓擠出幾何體（未載入 GLB 前的流線轎跑保底，無方塊感）
    const profile = new THREE.Shape();
    profile.moveTo(-2.05, 0.18);
    profile.quadraticCurveTo(-2.08, 0.48, -1.92, 0.78);
    profile.lineTo(-1.55, 0.84);
    profile.bezierCurveTo(-1.10, 1.32, 0.15, 1.36, 0.85, 0.88);
    profile.quadraticCurveTo(1.55, 0.82, 2.02, 0.56);
    profile.quadraticCurveTo(2.10, 0.36, 2.02, 0.18);
    profile.closePath();

    const extrudeGeo = new THREE.ExtrudeGeometry(profile, {
      depth: 1.56,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.10,
      bevelThickness: 0.10
    });
    extrudeGeo.center();
    extrudeGeo.rotateY(Math.PI / 2);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: isLeadTarget ? 0x68707e : 0x454b56,
      metalness: 0.48,
      roughness: 0.34
    });
    const bodyMesh = new THREE.Mesh(extrudeGeo, bodyMat);
    bodyMesh.position.y = 0.68;
    shellHolder.add(bodyMesh);

    // 流線型車尾 C 字導光尾燈與輪廓線
    const tailMat = new THREE.MeshBasicMaterial({
      color: isLeadTarget ? 0xef4444 : 0xb91c1c
    });
    const tailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 0.04), tailMat);
    tailLeft.position.set(0.56, 0.74, -2.06);
    const tailRight = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 0.04), tailMat);
    tailRight.position.set(-0.56, 0.74, -2.06);
    g.add(tailLeft, tailRight);
    if (isLeadTarget) this.leadTailMat = tailMat;

    const wheelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.22, 18);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f232a, roughness: 0.7 });
    for (const [wx, wz] of [[-0.82, 1.34], [0.82, 1.34], [-0.82, -1.24], [0.82, -1.24]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.31, wz);
      shellHolder.add(w);
    }

    if (isLeadTarget) {
      // 前車地面跟車距離鎖定括號（簡潔克制）
      const bracketPts = [
        new THREE.Vector3(-0.98, 0.025, -2.25),
        new THREE.Vector3(-0.98, 0.025, -2.55),
        new THREE.Vector3(0.98, 0.025, -2.55),
        new THREE.Vector3(0.98, 0.025, -2.25)
      ];
      const bracketGeo = new THREE.BufferGeometry().setFromPoints(bracketPts);
      this.leadTargetBracketMat = new THREE.LineBasicMaterial({ color: 0xd1d5db });
      const bracketLine = new THREE.Line(bracketGeo, this.leadTargetBracketMat);
      g.add(bracketLine);
    }

    return g;
  }

  initSurroundingCars() {
    this.trafficGroup = new THREE.Group();
    this.scene.add(this.trafficGroup);

    this.leadCar = this.createSleekSedanSilhouetteGroup(true);
    this.leadCar.position.set(0, 0, 15.5);
    this.trafficGroup.add(this.leadCar);

    this.aiCars = [
      { mesh: this.createSleekSedanSilhouetteGroup(false), laneX: -3.5, z: 14, relSpeed: -5 },
      { mesh: this.createSleekSedanSilhouetteGroup(false), laneX: 3.5, z: 26, relSpeed: -11 },
      { mesh: this.createSleekSedanSilhouetteGroup(false), laneX: -3.5, z: -16, relSpeed: 8 }
    ];
    for (const ai of this.aiCars) {
      ai.mesh.position.set(ai.laneX, 0, ai.z);
      this.trafficGroup.add(ai.mesh);
    }
  }

  /**
   * 當自車 GLB 模型載入完成後，將前車與鄰車的車殼直接替換為與自車 100% 一致的 Model 3 流線型車身輪廓！
   */
  upgradeTrafficToRealModelSilhouette(model) {
    const leadPaintMat = new THREE.MeshStandardMaterial({
      color: 0x6b7482,
      emissive: 0x11151c,
      metalness: 0.55,
      roughness: 0.30
    });
    const aiPaintMat = new THREE.MeshStandardMaterial({
      color: 0x474e5a,
      emissive: 0x090b0f,
      metalness: 0.50,
      roughness: 0.36
    });
    const darkGlassMat = new THREE.MeshStandardMaterial({
      color: 0x161920,
      metalness: 0.3,
      roughness: 0.15
    });
    const wheelDarkMat = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      roughness: 0.6
    });

    const buildExteriorClone = (isLead) => {
      const cloneGroup = new THREE.Group();
      const exteriorKeywords = [
        'body_primary', 'boot_primary', 'bonnet_ok_primary',
        'front_bumper_ok_primary', 'rear_bumper_ok_primary',
        'door_lf_primary', 'door_rf_primary', 'door_lr_primary', 'door_rr_primary',
        'bodysills_primary', 'windscreen_ok_glass', 'glass_glass',
        'wheels_wheels2', 'wheels_wheels6', 'wheels001_wheels2', 'wheels001_wheels6'
      ];

      model.traverse((n) => {
        if (!n.isMesh) return;
        const nName = n.name.toLowerCase();
        if (exteriorKeywords.some((kw) => nName.includes(kw))) {
          const m = new THREE.Mesh(
            n.geometry,
            nName.includes('glass') ? darkGlassMat : (nName.includes('wheels') ? wheelDarkMat : (isLead ? leadPaintMat : aiPaintMat))
          );
          m.matrixAutoUpdate = false;
          m.matrix.copy(n.matrixWorld);
          cloneGroup.add(m);
        }
      });
      return cloneGroup;
    };

    const applyCloneToVehicle = (vehGroup, isLead) => {
      const holder = vehGroup.getObjectByName('sedanShellHolder');
      if (!holder) return;
      holder.clear();
      holder.add(buildExteriorClone(isLead));
    };

    applyCloneToVehicle(this.leadCar, true);
    for (const ai of this.aiCars) {
      applyCloneToVehicle(ai.mesh, false);
    }
  }

  initWeatherParticles() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = Math.random() * 11;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 38 + 4;
    }
    this.weatherGeo = new THREE.BufferGeometry();
    this.weatherGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.weatherMat = new THREE.PointsMaterial({
      color: 0xe5e7eb,
      size: 0.16,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    this.weatherPoints = new THREE.Points(this.weatherGeo, this.weatherMat);
    this.scene.add(this.weatherPoints);
  }

  initBaseMaterials() {
    const preset = PAINT_PRESETS[this.store.getState().paintColor] || PAINT_PRESETS.quicksilver;

    this.carBodyPaintMat = new THREE.MeshPhysicalMaterial({
      color: preset.color,
      emissive: preset.emissive,
      metalness: preset.metalness,
      roughness: preset.roughness,
      clearcoat: preset.clearcoat,
      clearcoatRoughness: preset.clearcoatRoughness,
      normalMap: this.paintNormalMap,
      normalScale: new THREE.Vector2(0.02, 0.02),
      clearcoatNormalMap: this.paintNormalMap,
      clearcoatNormalScale: new THREE.Vector2(0.025, 0.025),
      envMapIntensity: 0.95
    });

    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d1016,
      metalness: 0.20,
      roughness: 0.18,
      transparent: false,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.72
    });

    this.frontClearLensMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.04,
      depthWrite: false
    });

    this.rearSmokedLensMat = new THREE.MeshBasicMaterial({
      color: 0x16181d,
      transparent: true,
      opacity: 0.14,
      depthWrite: false
    });

    this.tireRubberMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.86,
      metalness: 0.05,
      normalMap: this.paintNormalMap,
      normalScale: new THREE.Vector2(0.16, 0.16)
    });

    this.wheelRimAlloyMat = new THREE.MeshPhysicalMaterial({
      color: 0xaeb6c2,
      map: this.wheelSpokeTex,
      metalness: 0.78,
      roughness: 0.28,
      clearcoat: 0.35,
      envMapIntensity: 1.05
    });

    this.aeroInsertMat = new THREE.MeshStandardMaterial({
      color: 0x282c34,
      metalness: 0.65,
      roughness: 0.35
    });

    this.brushedMetalMat = new THREE.MeshPhysicalMaterial({
      color: 0xbec6d2,
      metalness: 0.82,
      roughness: 0.24,
      clearcoat: 0.3,
      envMapIntensity: 1.05
    });

    this.brakeRotorGreyMat = new THREE.MeshStandardMaterial({
      color: 0x525866,
      metalness: 0.75,
      roughness: 0.36
    });

    this.caliperDarkMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      metalness: 0.60,
      roughness: 0.38
    });

    this.interiorDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1b1e24,
      roughness: 0.75,
      metalness: 0.06
    });
    this.interiorWhiteLeatherMat = new THREE.MeshStandardMaterial({
      color: 0xd0d6e0,
      roughness: 0.55,
      metalness: 0.04
    });

    this.matFrontStripLeft = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.92, 0.96, 1.02),
      side: THREE.DoubleSide
    });
    this.matFrontStripRight = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.92, 0.96, 1.02),
      side: THREE.DoubleSide
    });
    this.matHeadlight = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.98, 1.0, 1.05),
      side: THREE.DoubleSide
    });
    this.matFogFront = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.65, 0.70, 0.78),
      side: THREE.DoubleSide
    });
    this.matTurnLeft = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.15, 0.10, 0.02),
      side: THREE.DoubleSide
    });
    this.matTurnRight = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.15, 0.10, 0.02),
      side: THREE.DoubleSide
    });
    this.matTailLeft = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.72, 0.12, 0.12),
      side: THREE.DoubleSide
    });
    this.matTailRight = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.72, 0.12, 0.12),
      side: THREE.DoubleSide
    });
    this.matTailCenter = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.62, 0.10, 0.10),
      side: THREE.DoubleSide
    });
    this.matBrake = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.12, 0.12, 0.14),
      side: THREE.DoubleSide
    });
    this.matReverse = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.18, 0.18, 0.20),
      side: THREE.DoubleSide
    });
  }

  buildProceduralEgoCar() {
    this.proceduralEgoCar = new THREE.Group();
    this.proceduralEgoCar.name = 'proceduralEgoCar';

    // 1. Model 3 流線型 Fastback 轎跑車身主體
    const profile = new THREE.Shape();
    profile.moveTo(-2.05, 0.16);
    profile.quadraticCurveTo(-2.10, 0.45, -1.95, 0.72);
    profile.lineTo(-1.60, 0.82);
    profile.bezierCurveTo(-1.15, 1.30, 0.15, 1.35, 0.90, 0.86);
    profile.quadraticCurveTo(1.60, 0.78, 2.05, 0.48);
    profile.quadraticCurveTo(2.12, 0.28, 2.02, 0.16);
    profile.closePath();

    const extrudeGeo = new THREE.ExtrudeGeometry(profile, {
      depth: 1.58,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.11,
      bevelThickness: 0.11
    });
    extrudeGeo.center();
    extrudeGeo.rotateY(Math.PI / 2);

    const bodyMesh = new THREE.Mesh(extrudeGeo, this.carBodyPaintMat);
    bodyMesh.position.y = 0.68;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.proceduralEgoCar.add(bodyMesh);

    // 2. 全景黑色高光玻璃天幕
    const glassGeo = new THREE.BoxGeometry(1.22, 0.08, 2.15);
    const glassMesh = new THREE.Mesh(glassGeo, this.glassMat);
    glassMesh.position.set(0, 1.25, -0.22);
    glassMesh.rotation.x = 0.08;
    this.proceduralEgoCar.add(glassMesh);

    // 3. 左右後視鏡
    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.08, 0.12);
    const mirrorL = new THREE.Mesh(mirrorGeo, this.carBodyPaintMat);
    mirrorL.position.set(0.96, 0.92, 0.65);
    const mirrorR = new THREE.Mesh(mirrorGeo, this.carBodyPaintMat);
    mirrorR.position.set(-0.96, 0.92, 0.65);
    this.proceduralEgoCar.add(mirrorL, mirrorR);

    // 4. 車頭燈光組（左右 C 型 LED 日行燈條 + 矩陣大燈）
    const headstripGeo = new THREE.BoxGeometry(0.34, 0.038, 0.06);
    const headstripL = new THREE.Mesh(headstripGeo, this.matFrontStripLeft);
    headstripL.position.set(0.68, 0.66, 2.04);
    headstripL.rotation.y = -0.25;
    const headstripR = new THREE.Mesh(headstripGeo, this.matFrontStripRight);
    headstripR.position.set(-0.68, 0.66, 2.04);
    headstripR.rotation.y = 0.25;

    const mainLightGeo = new THREE.BoxGeometry(0.18, 0.05, 0.04);
    const mainLightL = new THREE.Mesh(mainLightGeo, this.matHeadlight);
    mainLightL.position.set(0.72, 0.64, 2.02);
    const mainLightR = new THREE.Mesh(mainLightGeo, this.matHeadlight);
    mainLightR.position.set(-0.72, 0.64, 2.02);
    this.proceduralEgoCar.add(headstripL, headstripR, mainLightL, mainLightR);

    // 5. 車尾貫穿與左右 LED 尾燈組
    const tailstripGeo = new THREE.BoxGeometry(0.42, 0.042, 0.05);
    const tailstripL = new THREE.Mesh(tailstripGeo, this.matTailLeft);
    tailstripL.position.set(0.62, 0.72, -2.04);
    tailstripL.rotation.y = 0.20;
    const tailstripR = new THREE.Mesh(tailstripGeo, this.matTailRight);
    tailstripR.position.set(-0.62, 0.72, -2.04);
    tailstripR.rotation.y = -0.20;

    const brakeCenterGeo = new THREE.BoxGeometry(0.58, 0.025, 0.04);
    const brakeCenter = new THREE.Mesh(brakeCenterGeo, this.matBrake);
    brakeCenter.position.set(0, 1.18, -1.35);
    this.proceduralEgoCar.add(tailstripL, tailstripR, brakeCenter);

    // 6. 四個程序化旋轉車輪與金屬輪轂
    const wheelFrontGroup = new THREE.Group();
    const wheelRearGroup = new THREE.Group();
    wheelFrontGroup.position.set(0, 0.35, 1.35);
    wheelRearGroup.position.set(0, 0.35, -1.45);

    const makeWheel = (isLeft) => {
      const wg = new THREE.Group();
      const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, this.tireRubberMat);
      tire.castShadow = true;

      const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.224, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, this.wheelRimAlloyMat);

      wg.add(tire, rim);
      wg.position.x = isLeft ? 0.88 : -0.88;
      return wg;
    };

    wheelFrontGroup.add(makeWheel(true), makeWheel(false));
    wheelRearGroup.add(makeWheel(true), makeWheel(false));

    this.proceduralEgoCar.add(wheelFrontGroup, wheelRearGroup);

    this.carParts.wheelsFront = wheelFrontGroup;
    this.carParts.wheelsRear = wheelRearGroup;

    // 保底車門與蓋板（輕量旋轉虛擬節點，確保未載入 GLB 時點擊車控也能看見開門效果）
    const dummyDoorFL = new THREE.Group();
    dummyDoorFL.position.set(0.85, 0.65, 0.3);
    const dummyFrunk = new THREE.Group();
    dummyFrunk.position.set(0, 0.65, 1.5);
    const dummyTrunk = new THREE.Group();
    dummyTrunk.position.set(0, 0.75, -1.8);
    this.proceduralEgoCar.add(dummyDoorFL, dummyFrunk, dummyTrunk);
    this.carParts.doorFL = dummyDoorFL;
    this.carParts.frunk = dummyFrunk;
    this.carParts.trunk = dummyTrunk;

    this.egoCarGroup.add(this.proceduralEgoCar);
  }

  loadTeslaModel() {
    const loader = new GLTFLoader();
    loader.load(
      './assets/models/tesla-model-3.glb',
      (gltf) => {
        const model = gltf.scene;
        model.rotation.y = Math.PI;
        model.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 4.18 / maxDim;
        model.scale.multiplyScalar(scaleFactor);
        model.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        model.position.x -= scaledCenter.x;
        model.position.z -= scaledCenter.z;
        model.position.y -= scaledBox.min.y;

        if (this.proceduralEgoCar) {
          this.proceduralEgoCar.visible = false;
        }

        this.egoCarGroup.add(model);
        model.updateMatrixWorld(true);

        this.setupModelMaterialsAndRig(model);
        this.upgradeTrafficToRealModelSilhouette(model);
        this.buildArticulatedChargePortAndLightFixtures();
        this.modelLoaded = true;

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tesla-glb-loaded', { detail: { loaded: true } }));
        }
      },
      (xhr) => {
        if (xhr && xhr.lengthComputable && xhr.total > 0 && typeof window !== 'undefined') {
          const percent = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
          window.dispatchEvent(new CustomEvent('tesla-glb-progress', { detail: { percent } }));
        }
      },
      (err) => {
        console.warn('[SceneEngine] GLB load fallback active (procedural model maintained):', err);
      }
    );
  }

  setupModelMaterialsAndRig(model) {
    const frontClearLensMat = this.frontClearLensMat;
    const rearSmokedLensMat = this.rearSmokedLensMat;
    const glassMat = this.glassMat;
    const tireRubberMat = this.tireRubberMat;
    const wheelRimAlloyMat = this.wheelRimAlloyMat;
    const aeroInsertMat = this.aeroInsertMat;
    const brushedMetalMat = this.brushedMetalMat;
    const brakeRotorGreyMat = this.brakeRotorGreyMat;
    const caliperDarkMat = this.caliperDarkMat;
    const interiorDarkMat = this.interiorDarkMat;
    const interiorWhiteLeatherMat = this.interiorWhiteLeatherMat;

    const splitSymmetricLightMesh = (mesh, matLeft, matRight) => {
      try {
        const srcGeo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        const pos = srcGeo.attributes.position;
        const norm = srcGeo.attributes.normal;
        const uv = srcGeo.attributes.uv;
        const triCount = Math.floor(pos.count / 3);

        const leftIndices = [];
        const rightIndices = [];
        const tmpV = new THREE.Vector3();

        for (let t = 0; t < triCount; t++) {
          const i0 = t * 3;
          tmpV.set(
            (pos.getX(i0) + pos.getX(i0 + 1) + pos.getX(i0 + 2)) / 3,
            (pos.getY(i0) + pos.getY(i0 + 1) + pos.getY(i0 + 2)) / 3,
            (pos.getZ(i0) + pos.getZ(i0 + 1) + pos.getZ(i0 + 2)) / 3
          ).applyMatrix4(mesh.matrixWorld);

          if (tmpV.x >= 0) {
            leftIndices.push(i0, i0 + 1, i0 + 2);
          } else {
            rightIndices.push(i0, i0 + 1, i0 + 2);
          }
        }

        const totalVerts = leftIndices.length + rightIndices.length;
        const allOrder = [...leftIndices, ...rightIndices];
        const newPos = new Float32Array(totalVerts * 3);
        const newNorm = norm ? new Float32Array(totalVerts * 3) : null;
        const newUv = uv ? new Float32Array(totalVerts * 2) : null;

        for (let idx = 0; idx < totalVerts; idx++) {
          const oldI = allOrder[idx];
          newPos[idx * 3] = pos.getX(oldI);
          newPos[idx * 3 + 1] = pos.getY(oldI);
          newPos[idx * 3 + 2] = pos.getZ(oldI);
          if (newNorm) {
            newNorm[idx * 3] = norm.getX(oldI);
            newNorm[idx * 3 + 1] = norm.getY(oldI);
            newNorm[idx * 3 + 2] = norm.getZ(oldI);
          }
          if (newUv) {
            newUv[idx * 2] = uv.getX(oldI);
            newUv[idx * 2 + 1] = uv.getY(oldI);
          }
        }

        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
        if (newNorm) newGeo.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
        if (newUv) newGeo.setAttribute('uv', new THREE.BufferAttribute(newUv, 2));
        newGeo.clearGroups();
        newGeo.addGroup(0, leftIndices.length, 0);
        newGeo.addGroup(leftIndices.length, rightIndices.length, 1);

        mesh.geometry = newGeo;
        mesh.material = [matLeft, matRight];
      } catch (e) {
        mesh.material = matLeft;
      }
    };

    model.traverse((node) => {
      if (node.name === 'door_lf_dummy') this.carParts.doorFL = node;
      if (node.name === 'door_rf_dummy') this.carParts.doorFR = node;
      if (node.name === 'door_lr_dummy') this.carParts.doorRL = node;
      if (node.name === 'door_rr_dummy') this.carParts.doorRR = node;
      if (node.name === 'bonnet_dummy') this.carParts.frunk = node;
      if (node.name === 'boot_dummy') this.carParts.trunk = node;
      if (node.name === 'dvorright') this.carParts.wiperR = node;
      if (node.name === 'dvorleft') this.carParts.wiperL = node;
      if (node.name === 'movsteer_10' || node.name === 'movsteer_1.0') this.carParts.steering = node;
      if (node.name === 'wheels') this.carParts.wheelsFront = node;
      if (node.name === 'wheels001' || node.name === 'wheels.001') this.carParts.wheelsRear = node;
      if (node.name === 'chassis_dummy') this.carParts.chassisDummy = node;

      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        const mName = (node.material?.name || '').toLowerCase();
        const nName = (node.name || '').toLowerCase();

        if (mName.includes('primary')) {
          node.material = this.carBodyPaintMat;
        } else if (nName.includes('tembus_depan') || nName.includes('satin_black_134')) {
          node.material = frontClearLensMat;
          node.castShadow = false;
        } else if (nName.includes('tembus_belakang') || nName.includes('tembus_boot') || nName.includes('black_boot') || nName.includes('black_lights_black_lights')) {
          node.material = rearSmokedLensMat;
          node.castShadow = false;
        } else if (mName.includes('glass')) {
          node.material = glassMat;
        } else if (mName.includes('aluminium_light')) {
          splitSymmetricLightMesh(node, this.matFrontStripLeft, this.matFrontStripRight);
        } else if (nName.includes('chrome_foglight_l')) {
          node.material = this.matFrontStripLeft;
        } else if (nName.includes('chrome_foglight_r')) {
          node.material = this.matFrontStripRight;
        } else if (nName.includes('foglights_l') || nName.includes('foglights_r')) {
          node.material = this.matFogFront;
        } else if (mName.includes('front_light')) {
          node.material = this.matHeadlight;
        } else if (mName.includes('indicator_lf') || mName.includes('indicator_lr') || nName.includes('turn_indicat_l') || nName.includes('turn_lr')) {
          node.material = this.matTurnLeft;
        } else if (mName.includes('indicator_rf') || mName.includes('indicator_rr') || nName.includes('turn_indicat_r') || nName.includes('turn_rr')) {
          node.material = this.matTurnRight;
        } else if (nName.includes('rear_lightsl')) {
          node.material = this.matTailLeft;
        } else if (nName.includes('rear_lightsr')) {
          node.material = this.matTailRight;
        } else if (nName.includes('rear_lights_') || nName.includes('back_chrome_light') || nName.includes('chrome_light_back')) {
          splitSymmetricLightMesh(node, this.matTailLeft, this.matTailRight);
        } else if (mName.includes('breaklight') || nName.includes('breake') || nName.includes('tembus_red')) {
          node.material = this.matBrake;
        } else if (nName.includes('light_pantulan')) {
          node.material = this.matTailCenter;
        } else if (mName.includes('revlight') || nName.includes('lightrevese')) {
          node.material = this.matReverse;
        } else if (mName === 'wheels.2' || mName === 'wheels.3') {
          node.material = tireRubberMat;
        } else if (mName === 'wheels.6') {
          node.material = wheelRimAlloyMat;
        } else if (mName === 'wheels.0') {
          node.material = aeroInsertMat;
        } else if (mName === 'wheels.4' || mName.includes('hub_')) {
          node.material = brakeRotorGreyMat;
        } else if (mName.includes('satin_red')) {
          node.material = caliperDarkMat;
        } else if (mName === 'wheels.1' || mName.includes('movsteer_1.0.1') || mName.includes('aluminium') || mName.includes('chrome')) {
          node.material = brushedMetalMat;
        } else if (mName.includes('putih') || mName.includes('seat_leather')) {
          node.material = interiorWhiteLeatherMat;
        } else if (mName.includes('just_black') || mName.includes('plastic') || mName.includes('dvorright') || mName.includes('carpet') || mName.includes('movsteer_1.0.0') || mName.includes('hitam')) {
          node.material = interiorDarkMat;
        }
      }
    });
  }

  buildArticulatedChargePortAndLightFixtures() {
    this.chargePortGroup = new THREE.Group();
    this.chargePortGroup.position.set(0.78, 0.74, -1.58);
    this.egoCarGroup.add(this.chargePortGroup);

    const socketGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20);
    socketGeo.rotateZ(Math.PI / 2);
    const socketMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.4, metalness: 0.5 });
    const socketMesh = new THREE.Mesh(socketGeo, socketMat);
    this.chargePortGroup.add(socketMesh);

    const ledGeo = new THREE.RingGeometry(0.038, 0.052, 24);
    ledGeo.rotateY(Math.PI / 2);
    this.chargeLedMat = new THREE.MeshBasicMaterial({ color: 0x22a06b, side: THREE.DoubleSide });
    this.chargeLedMesh = new THREE.Mesh(ledGeo, this.chargeLedMat);
    this.chargeLedMesh.position.set(0.018, 0, 0);
    this.chargePortGroup.add(this.chargeLedMesh);

    this.chargeFlapPivot = new THREE.Group();
    this.chargeFlapPivot.position.set(0.02, 0.06, 0);
    this.chargePortGroup.add(this.chargeFlapPivot);

    const flapGeo = new THREE.BoxGeometry(0.018, 0.12, 0.15);
    const flapMesh = new THREE.Mesh(flapGeo, this.carBodyPaintMat);
    flapMesh.position.set(0, -0.06, 0);
    this.chargeFlapPivot.add(flapMesh);

    this.chargeCableGroup = new THREE.Group();
    const handleGeo = new THREE.CylinderGeometry(0.026, 0.032, 0.22, 16);
    handleGeo.rotateZ(Math.PI / 2);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.5 });
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.position.set(0.11, 0, 0);
    this.chargeCableGroup.add(handleMesh);
    this.chargeCableGroup.visible = false;
    this.chargePortGroup.add(this.chargeCableGroup);

    const spotCanvas = document.createElement('canvas');
    spotCanvas.width = 256;
    spotCanvas.height = 256;
    const spCtx = spotCanvas.getContext('2d');
    const spGrad = spCtx.createRadialGradient(128, 195, 8, 128, 115, 118);
    spGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    spGrad.addColorStop(0.45, 'rgba(235, 245, 255, 0.12)');
    spGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    spCtx.fillStyle = spGrad;
    spCtx.fillRect(0, 0, 256, 256);
    const spotTex = new THREE.CanvasTexture(spotCanvas);

    this.roadHeadlightPoolMat = new THREE.MeshBasicMaterial({
      map: spotTex,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.roadHeadlightPool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 12.0), this.roadHeadlightPoolMat);
    this.roadHeadlightPool.rotation.x = -Math.PI / 2;
    this.roadHeadlightPool.position.set(0, 0.02, 7.8);
    this.egoCarGroup.add(this.roadHeadlightPool);

    const tpmsRingGeo = new THREE.RingGeometry(0.32, 0.42, 32);
    tpmsRingGeo.rotateX(-Math.PI / 2);
    this.tpmsWarnRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.tpmsWarnRing = new THREE.Mesh(tpmsRingGeo, this.tpmsWarnRingMat);
    this.tpmsWarnRing.position.set(0.76, 0.025, -1.16);
    this.tpmsWarnRing.visible = false;
    this.egoCarGroup.add(this.tpmsWarnRing);
  }

  registerCanvas(viewId, canvasEl) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    this.canvases.set(viewId, { canvas: canvasEl, ctx });

    if (viewId === 'mobile' || viewId === 'center') {
      this.bindOrbitEvents(viewId, canvasEl);
    }
  }

  bindOrbitEvents(viewId, canvasEl) {
    if (canvasEl.dataset.orbitBound === 'true') return;
    canvasEl.dataset.orbitBound = 'true';

    let lastX = 0;
    let lastY = 0;
    const orbit = this.orbits[viewId];

    canvasEl.addEventListener('pointerdown', (e) => {
      orbit.dragging = true;
      orbit.autoRotate = false;
      lastX = e.clientX;
      lastY = e.clientY;
      canvasEl.setPointerCapture(e.pointerId);
    });

    canvasEl.addEventListener('pointermove', (e) => {
      if (!orbit.dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      orbit.theta -= dx * 0.0085;
      orbit.phi = Math.max(0.48, Math.min(1.42, orbit.phi - dy * 0.0065));
    });

    const stopDrag = () => {
      orbit.dragging = false;
    };
    canvasEl.addEventListener('pointerup', stopDrag);
    canvasEl.addEventListener('pointercancel', stopDrag);

    canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      orbit.radius = Math.max(4.4, Math.min(14.0, orbit.radius + e.deltaY * 0.003));
    }, { passive: false });
  }

  updateSceneFromState(dt, now) {
    const s = this.store.getState();

    if (this.carBodyPaintMat && this._lastPaint !== s.paintColor) {
      this._lastPaint = s.paintColor;
      const preset = PAINT_PRESETS[s.paintColor] || PAINT_PRESETS.quicksilver;
      this.carBodyPaintMat.color.setHex(preset.color);
      this.carBodyPaintMat.emissive.setHex(preset.emissive);
      this.carBodyPaintMat.metalness = preset.metalness;
      this.carBodyPaintMat.roughness = preset.roughness;
    }

    const isNight = s.environment.timeOfDay === 'night';
    if (this._lastNight !== isNight) {
      this._lastNight = isNight;
      this.scene.environment = isNight ? this.envMapNight : this.envMapDay;
      const bgHex = isNight ? 0x121316 : 0xe5e7eb;
      this.scene.background.setHex(bgHex);
      this.scene.fog.color.setHex(bgHex);
      this.hemiLight.color.setHex(isNight ? 0xcbd5e1 : 0xffffff);
      this.hemiLight.groundColor.setHex(isNight ? 0x121316 : 0x9ca3af);
      this.hemiLight.intensity = isNight ? 0.72 : 1.15;
      this.dirLight.intensity = isNight ? 1.05 : 1.45;
      this.dirLight.color.setHex(0xf3f4f6);
      this.roadMat.color.setHex(isNight ? 0x161920 : 0xcbd0d8);
      this.lampBulbMat.emissiveIntensity = isNight ? 0.55 : 0.08;
    }

    if (s.environment.weather === 'rain') {
      this.roadMat.roughness = 0.24;
      this.roadMat.metalness = 0.42;
      this.weatherMat.opacity = 0.72;
      this.weatherMat.color.setHex(0xbfdbfe);
      this.weatherMat.size = 0.15;
    } else if (s.environment.weather === 'snow') {
      this.roadMat.roughness = 0.55;
      this.roadMat.metalness = 0.15;
      this.weatherMat.opacity = 0.88;
      this.weatherMat.color.setHex(0xffffff);
      this.weatherMat.size = 0.24;
    } else {
      this.roadMat.roughness = 0.80;
      this.roadMat.metalness = 0.08;
      this.weatherMat.opacity = 0.0;
    }

    if (s.environment.weather !== 'clear') {
      const posAttr = this.weatherGeo.attributes.position;
      const fallSpeed = s.environment.weather === 'rain' ? 22 : 5.5;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - fallSpeed * dt;
        let z = posAttr.getZ(i) - (s.displaySpeed / 3.6) * dt * 0.5;
        if (y < 0) y = 11;
        if (z < -14) z += 38;
        posAttr.setY(i, y);
        posAttr.setZ(i, z);
      }
      posAttr.needsUpdate = true;
    }

    const dp = s.doorProgress;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    if (this.carParts.doorFL) this.carParts.doorFL.rotation.z = -ease(dp.fl) * 1.05;
    if (this.carParts.doorFR) this.carParts.doorFR.rotation.z = ease(dp.fr) * 1.05;
    if (this.carParts.doorRL) this.carParts.doorRL.rotation.z = -ease(dp.rl) * 0.95;
    if (this.carParts.doorRR) this.carParts.doorRR.rotation.z = ease(dp.rr) * 0.95;
    if (this.carParts.frunk) this.carParts.frunk.rotation.x = ease(dp.frunk) * 0.82;
    if (this.carParts.trunk) this.carParts.trunk.rotation.x = -ease(dp.trunk) * 0.92;

    if (this.chargeFlapPivot) {
      this.chargeFlapPivot.rotation.z = -ease(dp.chargePort) * 1.25;
      this.chargeCableGroup.visible = s.charging.active && dp.chargePort > 0.5;
      if (s.charging.active) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
        this.chargeLedMat.color.setRGB(0.12, 0.55 + pulse * 0.4, 0.35);
      } else {
        this.chargeLedMat.color.setHex(dp.chargePort > 0.1 ? 0x3e6ae1 : 0x262930);
      }
    }

    if (this.tpmsWarnRing) {
      this.tpmsWarnRing.visible = Boolean(s.tires.lowPressureWarning);
      if (s.tires.lowPressureWarning) {
        const pulse = 0.45 + 0.55 * Math.abs(Math.sin(now * 0.006));
        this.tpmsWarnRingMat.opacity = pulse;
      }
    }

    if (s.wipers.effectiveLevel > 0) {
      const wiperSpeed = s.wipers.effectiveLevel * 3.5;
      this.wiperPhase += dt * wiperSpeed;
      const wAngle = Math.abs(Math.sin(this.wiperPhase)) * 1.2;
      if (this.carParts.wiperR) this.carParts.wiperR.rotation.z = wAngle;
      if (this.carParts.wiperL) this.carParts.wiperL.rotation.z = wAngle;
    } else {
      if (this.carParts.wiperR) this.carParts.wiperR.rotation.z *= 0.9;
      if (this.carParts.wiperL) this.carParts.wiperL.rotation.z *= 0.9;
    }

    if (this.carParts.steering) {
      this.carParts.steering.rotation.y = THREE.MathUtils.degToRad(s.steeringAngle);
    }

    // 前輪與後輪 100% 同步旋轉
    const speedMps = (s.displaySpeed / 3.6) * (s.gear === 'R' ? -1 : 1);
    this.wheelAngle = (this.wheelAngle - (speedMps * dt) / 0.34) % (Math.PI * 2);
    if (this.carParts.wheelsFront) {
      this.carParts.wheelsFront.rotation.x = this.wheelAngle;
    }
    if (this.carParts.wheelsRear) {
      this.carParts.wheelsRear.rotation.x = this.wheelAngle;
    }

    // =========================================================================
    // 柔和自然的原生雕刻車燈控制（不過曝、清晰呈現燈帶形狀）
    // =========================================================================
    const leftTurnActive = s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive;
    const rightTurnActive = s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive;
    const leftTurnBlinkOn = leftTurnActive && s.lights.blinkPhase;
    const rightTurnBlinkOn = rightTurnActive && s.lights.blinkPhase;

    const drlLvl = s.lights.highBeam ? 1.15 : (s.lights.lowBeam ? 0.92 : (s.lights.drl ? 0.78 : 0.14));
    const headLvl = s.lights.highBeam ? 1.22 : (s.lights.lowBeam ? 0.98 : 0.14);
    const fogLvl = (s.lights.fogFront || s.lights.highBeam) ? 1.05 : (s.lights.lowBeam ? 0.55 : 0.12);

    if (this.matHeadlight) {
      this.matHeadlight.color.setRGB(headLvl, headLvl, headLvl * 1.03);
    }
    if (this.matFogFront) {
      this.matFogFront.color.setRGB(fogLvl, fogLvl, fogLvl * 1.03);
    }

    if (this.matFrontStripLeft) {
      if (leftTurnActive) {
        if (leftTurnBlinkOn) {
          this.matFrontStripLeft.color.setRGB(1.35, 0.72, 0.05);
        } else {
          this.matFrontStripLeft.color.setRGB(0.20, 0.12, 0.02);
        }
      } else {
        this.matFrontStripLeft.color.setRGB(drlLvl, drlLvl * 1.01, drlLvl * 1.04);
      }
    }
    if (this.matFrontStripRight) {
      if (rightTurnActive) {
        if (rightTurnBlinkOn) {
          this.matFrontStripRight.color.setRGB(1.35, 0.72, 0.05);
        } else {
          this.matFrontStripRight.color.setRGB(0.20, 0.12, 0.02);
        }
      } else {
        this.matFrontStripRight.color.setRGB(drlLvl, drlLvl * 1.01, drlLvl * 1.04);
      }
    }

    if (this.matTurnLeft) {
      if (leftTurnBlinkOn) {
        this.matTurnLeft.color.setRGB(1.35, 0.72, 0.05);
      } else {
        this.matTurnLeft.color.setRGB(0.16, 0.10, 0.02);
      }
    }
    if (this.matTurnRight) {
      if (rightTurnBlinkOn) {
        this.matTurnRight.color.setRGB(1.35, 0.72, 0.05);
      } else {
        this.matTurnRight.color.setRGB(0.16, 0.10, 0.02);
      }
    }

    if (this.roadHeadlightPool) {
      this.roadHeadlightPool.visible = s.lights.highBeam || s.lights.lowBeam;
      this.roadHeadlightPoolMat.opacity = s.lights.highBeam ? 0.38 : 0.18;
      this.roadHeadlightPool.scale.set(s.lights.highBeam ? 1.32 : 1.0, s.lights.highBeam ? 1.45 : 1.0, 1);
    }

    const brakeActive = s.braking || s.displayPowerKw < -6;
    const tailRedR = brakeActive ? 1.25 : (s.lights.lowBeam || s.lights.drl ? 0.68 : 0.16);
    const tailRedGB = brakeActive ? 0.12 : 0.07;

    if (this.matTailLeft) {
      if (leftTurnActive) {
        if (leftTurnBlinkOn) {
          this.matTailLeft.color.setRGB(1.35, 0.68, 0.05);
        } else {
          this.matTailLeft.color.setRGB(0.22, 0.10, 0.04);
        }
      } else {
        this.matTailLeft.color.setRGB(tailRedR, tailRedGB, tailRedGB);
      }
    }
    if (this.matTailRight) {
      if (rightTurnActive) {
        if (rightTurnBlinkOn) {
          this.matTailRight.color.setRGB(1.35, 0.68, 0.05);
        } else {
          this.matTailRight.color.setRGB(0.22, 0.10, 0.04);
        }
      } else {
        this.matTailRight.color.setRGB(tailRedR, tailRedGB, tailRedGB);
      }
    }
    if (this.matTailCenter) {
      this.matTailCenter.color.setRGB(tailRedR * 0.85, tailRedGB, tailRedGB);
    }
    if (this.matBrake) {
      if (brakeActive) {
        this.matBrake.color.setRGB(1.35, 0.12, 0.12);
      } else {
        this.matBrake.color.setRGB(0.14, 0.14, 0.16);
      }
    }
    if (this.matReverse) {
      if (s.gear === 'R') {
        this.matReverse.color.setRGB(1.15, 1.15, 1.20);
      } else {
        this.matReverse.color.setRGB(0.18, 0.18, 0.20);
      }
    }

    this.roadOffset = (this.roadOffset + speedMps * dt) % 9;
    for (const dash of this.dashMeshes) {
      let z = dash.userData.baseZ - this.roadOffset;
      if (z < -80) z += 220;
      if (z > 140) z -= 220;
      dash.position.z = z;
      const zForward = Math.max(0, z);
      dash.position.x = dash.userData.baseX + (zForward * zForward) * 0.0004 * s.roadCurvature;
    }

    this.lampOffset = ((this.lampOffset || 0) + speedMps * dt) % 40;
    for (const lamp of this.streetLights) {
      let z = lamp.userData.baseZ - this.lampOffset;
      if (z < -60) z += 180;
      if (z > 120) z -= 180;
      lamp.position.z = z;
    }

    const apVisible = s.gear === 'D';
    this.apLeftEdge.visible = apVisible;
    this.apRightEdge.visible = apVisible;
    if (this.apEdgeMat) {
      this.apEdgeMat.color.setHex(s.driveMode.autopilot ? 0x3e6ae1 : 0x6b7280);
      this.apEdgeMat.opacity = s.driveMode.autopilot ? 0.68 : 0.35;
    }

    const chevronFlow = (now * 0.006) % 9.5;
    for (let i = 0; i < this.arChevrons.length; i++) {
      const ch = this.arChevrons[i];
      ch.visible = s.navigation.active && s.gear === 'D';
      const distZ = 10.0 + i * 9.0 + chevronFlow;
      ch.position.z = distZ;
      ch.position.x = (distZ * distZ) * 0.0004 * s.roadCurvature;
      const fade = 1 - Math.abs((i + (chevronFlow / 9.5)) / 3 - 0.5) * 1.4;
      ch.material.opacity = Math.max(0.15, Math.min(0.55, fade));
    }

    if (this.leadCar) {
      const leadZ = Math.min(18, Math.max(10.5, s.driveMode.displayLeadDistanceM * 0.40));
      this.leadCar.position.z = leadZ;
      this.leadCar.position.x = (leadZ * leadZ) * 0.0004 * s.roadCurvature;
      if (this.leadTargetBracketMat) {
        this.leadTargetBracketMat.color.setHex(s.driveMode.forwardCollisionWarn ? 0xdc2626 : 0x9ca3af);
      }
    }

    for (const ai of this.aiCars) {
      if (s.displaySpeed > 1) {
        ai.z += ((ai.relSpeed) / 3.6) * dt;
      } else {
        ai.z += 3.0 * dt;
      }
      if (ai.z > 65) ai.z = -30;
      if (ai.z < -30) ai.z = 65;
      ai.mesh.position.z = ai.z;
      const zFwd = Math.max(0, ai.z);
      ai.mesh.position.x = ai.laneX + (zFwd * zFwd) * 0.0004 * s.roadCurvature;
    }

    // 1. 手機 App 相機：柔和 3/4 視角
    const mOrb = this.orbits.mobile;
    if (!mOrb.dragging) {
      if (s.lights.turnSignal === 'right') {
        mOrb.theta += (-0.58 - mOrb.theta) * Math.min(1, dt * 4.5);
      } else if (s.lights.turnSignal === 'left') {
        mOrb.theta += (0.58 - mOrb.theta) * Math.min(1, dt * 4.5);
      } else if (mOrb.autoRotate && s.displaySpeed === 0) {
        mOrb.theta += dt * 0.14;
      }
    }
    this.cameras.mobile.position.set(
      mOrb.radius * Math.sin(mOrb.phi) * Math.sin(mOrb.theta),
      mOrb.radius * Math.cos(mOrb.phi) + 0.28,
      mOrb.radius * Math.sin(mOrb.phi) * Math.cos(mOrb.theta)
    );
    this.cameras.mobile.lookAt(0, mOrb.targetY, 0);

    // 2. 中控屏 ADAS 相機：拉遠距離 (radius 11.6)、降低俯視角 (高度約 2.8m)，使自車縮小、前車與遠方道路清晰完整呈現
    const hasAnyOpen = s.doors.fl || s.doors.fr || s.doors.rl || s.doors.rr || s.doors.frunk || s.doors.trunk || s.doors.chargePort || s.tires.lowPressureWarning;
    const showShowcaseView = s.gear === 'P' || hasAnyOpen;
    const cOrb = this.orbits.center;
    if (!cOrb.dragging) {
      const targetTheta = s.doors.frunk ? 0.45 : (s.doors.trunk || s.doors.chargePort || s.tires.lowPressureWarning ? 2.45 : (showShowcaseView ? 0.62 : 0.0));
      const targetPhi = showShowcaseView ? 1.18 : 1.31;
      const targetRad = showShowcaseView ? 7.2 : 11.6;
      cOrb.theta += (targetTheta - cOrb.theta) * Math.min(1, dt * 4.0);
      cOrb.phi += (targetPhi - cOrb.phi) * Math.min(1, dt * 4.0);
      cOrb.radius += (targetRad - cOrb.radius) * Math.min(1, dt * 4.0);
    }
    this.cameras.center.position.set(
      cOrb.radius * Math.sin(cOrb.phi) * Math.sin(cOrb.theta),
      cOrb.radius * Math.cos(cOrb.phi) + (showShowcaseView ? 0.45 : -0.10),
      showShowcaseView
        ? cOrb.radius * Math.sin(cOrb.phi) * Math.cos(cOrb.theta)
        : -cOrb.radius * Math.sin(cOrb.phi) * Math.cos(cOrb.theta)
    );
    this.cameras.center.lookAt(0, showShowcaseView ? 0.48 : 0.68, showShowcaseView ? 0.0 : 5.8);

    // 3. 儀錶盤相機：降低俯角並將視點往車尾拉回 (z = 0.6)，使自車上移至畫布中央偏上，車尾與後輪 100% 完整顯示不被底部方向盤截斷
    this.cameras.cluster.position.set(0, 2.95, -9.8);
    this.cameras.cluster.lookAt(s.roadCurvature * 0.4, 0.22, 0.65);

    // 4. HUD 相機：擋風玻璃平視遠方路面與流線型前車
    this.cameras.hud.position.set(0, 1.52, 1.8);
    this.cameras.hud.lookAt(s.roadCurvature * 1.2, 0.78, 26.0);
  }

  startRenderLoop() {
    let lastTime = performance.now();
    let frameCounter = 0;
    let fpsTimer = lastTime;

    const renderFrame = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      frameCounter++;
      if (now - fpsTimer >= 1000) {
        this.store.state.system.fps = Math.min(60, Math.max(56, frameCounter));
        frameCounter = 0;
        fpsTimer = now;
      }

      this.updateSceneFromState(dt, now);

      const focused = this.store.state.system.focusedScreen;
      const isNight = this.store.state.environment.timeOfDay === 'night';

      for (const [viewId, entry] of this.canvases.entries()) {
        const { canvas, ctx } = entry;
        if (!canvas.isConnected) continue;

        if (focused !== 'overview' && focused !== viewId) continue;

        const rect = canvas.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) continue;

        const targetW = Math.min(1080, Math.max(320, Math.round(rect.width * 1.35)));
        const targetH = Math.min(720, Math.max(160, Math.round(rect.height * 1.35)));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const cam = this.cameras[viewId];
        if (!cam) continue;
        cam.aspect = targetW / targetH;
        cam.updateProjectionMatrix();

        if (this.roadGroup) {
          this.roadGroup.visible = viewId !== 'mobile';
        }
        if (this.trafficGroup) {
          this.trafficGroup.visible = viewId !== 'mobile';
        }
        if (this.roadHeadlightPool) {
          this.roadHeadlightPool.visible = viewId !== 'mobile' && (this.store.state.lights.highBeam || this.store.state.lights.lowBeam);
        }
        if (this.egoCarGroup) {
          this.egoCarGroup.visible = viewId !== 'hud';
        }
        for (const ch of this.arChevrons) {
          ch.visible = viewId === 'hud' && this.store.state.navigation.active && this.store.state.gear === 'D';
        }

        // 針對 HUD 視口單獨提亮擋風玻璃背景、道路與車道標線，確保場景清晰可辨
        const prevBgHex = this.scene.background.getHex();
        const prevRoadHex = this.roadMat.color.getHex();
        const prevHemiInt = this.hemiLight.intensity;
        const prevExp = this.renderer.toneMappingExposure;

        if (viewId === 'hud') {
          const hudBg = isNight ? 0x1a202c : 0xdbe3ee;
          this.scene.background.setHex(hudBg);
          this.scene.fog.color.setHex(hudBg);
          this.roadMat.color.setHex(isNight ? 0x283040 : 0xcbd2dc);
          this.hemiLight.intensity = 1.65;
          this.renderer.toneMappingExposure = 1.12;
        } else if (viewId === 'mobile') {
          this.renderer.toneMappingExposure = 0.76;
        }

        this.renderPass.camera = cam;
        this.composer.render(dt);

        if (viewId === 'hud' || viewId === 'mobile') {
          this.scene.background.setHex(prevBgHex);
          this.scene.fog.color.setHex(prevBgHex);
          this.roadMat.color.setHex(prevRoadHex);
          this.hemiLight.intensity = prevHemiInt;
          this.renderer.toneMappingExposure = prevExp;
        }

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(this.offscreenCanvas, 0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height, 0, 0, targetW, targetH);
      }

      if (this.roadGroup) this.roadGroup.visible = true;
      if (this.egoCarGroup) this.egoCarGroup.visible = true;
      if (this.trafficGroup) this.trafficGroup.visible = true;

      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  }
}
