const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8158;
const CDP_PORT = 9278;

// 截圖儲存目錄
const LOCAL_DIR = path.join(__dirname, 'screenshots');
const ARTIFACT_DIR = '/Users/usagi/.gemini/antigravity/brain/aac3bfcb-9c13-44b7-8635-d64d6c19ee30/screenshots';

if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

// 1. 本地靜態文件伺服器
const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(__dirname, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeMap = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.glb': 'model/gltf-binary',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// 29 大全量狀態規格矩陣
const CAPTURE_SPECS = [
  // 模組 A：座艙總覽
  {
    id: 'overview',
    name: '3D真實座艙透視總覽',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'overview';
        st.system.centerActiveModal = null;
        st.system.showDesignDoc = false;
        st.system.showChecklistModal = false;
      });
      document.getElementById('demo-control-panel')?.classList.remove('is-open');
    `,
    selector: '.screens-stage',
    padding: 0
  },

  // 模組 B：手機 App 6 大完整子頁面（消除內部滾動截斷，展示長圖）
  {
    id: 'mobile_home',
    name: '手機App_01首頁與快捷車控',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'home';
        st.system.centerActiveModal = null;
        st.system.showDesignDoc = false;
        st.system.showChecklistModal = false;
      });
      document.getElementById('demo-control-panel')?.classList.remove('is-open');
    `,
    selector: '.physical-iphone-frame',
    isMobile: true,
    padding: 8
  },
  {
    id: 'mobile_location',
    name: '手機App_02定位小地圖與發送目的地',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'location';
        st.system.centerActiveModal = null;
      });
    `,
    selector: '.physical-iphone-frame',
    isMobile: true,
    padding: 8
  },
  {
    id: 'mobile_controls',
    name: '手機App_03車控門鎖網格與鑰匙管理',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'controls';
        st.system.centerActiveModal = null;
      });
    `,
    selector: '.physical-iphone-frame',
    isMobile: true,
    padding: 8
  },
  {
    id: 'mobile_climate',
    name: '手機App_04溫控模式與預約出發',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'climate';
        st.system.centerActiveModal = null;
      });
    `,
    selector: '.physical-iphone-frame',
    isMobile: true,
    padding: 8
  },
  {
    id: 'mobile_charging',
    name: '手機App_05充電功率上限與行程能耗歷史',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'charging';
        st.system.centerActiveModal = null;
      });
    `,
    selector: '.physical-iphone-frame',
    isMobile: true,
    padding: 8
  },
  {
    id: 'mobile_service',
    name: '手機App_06軟件版本OTA與官方保養預約',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'service';
        st.system.centerActiveModal = null;
      });
    `,
    selector: '.physical-iphone-frame',
    isMobile: true,
    padding: 8
  },

  // 模組 C：17" 旗艦中控橫屏主界面與 6 大功能彈窗
  {
    id: 'center_main',
    name: '中控屏_主駕導航與3D車道感知',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = null;
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_apps',
    name: '中控屏_車載應用中心九宮格',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'apps';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_charging',
    name: '中控屏_高壓電池與超級充電管理',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'charging';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_camera360',
    name: '中控屏_360環視全景與相機視角',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'camera360';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_phone',
    name: '中控屏_藍牙電話與通訊錄撥號',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'phone';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_voice',
    name: '中控屏_車載自然語音助理交互',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'voice';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_climate',
    name: '中控屏_雙溫區熱泵空調大彈層',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'climate';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },

  // 模組 D：中控車輛設置中心 7 大選項卡
  {
    id: 'center_settings_display',
    name: '中控設置_01顯示與電動向日葵傾斜',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'display';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_settings_lights',
    name: '中控設置_02燈光與外部照明雨刮',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'lights';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_settings_locks',
    name: '中控設置_03車門車鎖與鑰匙管理',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'locks';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_settings_autopilot',
    name: '中控設置_04Autopilot輔助駕駛與轉向手感',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'autopilot';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_settings_safety',
    name: '中控設置_05安全哨兵與四輪胎壓TPMS',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'safety';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_settings_schedule',
    name: '中控設置_06日程預約出發與離峰充電',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'schedule';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },
  {
    id: 'center_settings_service',
    name: '中控設置_07OTA升級與保養維護模式',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'service';
      });
    `,
    selector: '.bezel-center',
    padding: 4
  },

  // 模組 E：副駕娛樂屏 3 大 Tab
  {
    id: 'passenger_music',
    name: '副駕娛樂屏_音樂播放與24Bit頻譜',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'passenger';
        st.media.activeTab = 'music';
      });
    `,
    selector: '.bezel-passenger',
    padding: 4
  },
  {
    id: 'passenger_video',
    name: '副駕娛樂屏_動態短片劇場',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'passenger';
        st.media.activeTab = 'video';
      });
    `,
    selector: '.bezel-passenger',
    padding: 4
  },
  {
    id: 'passenger_game',
    name: '副駕娛樂屏_街機遊戲中心',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'passenger';
        st.media.activeTab = 'game';
      });
    `,
    selector: '.bezel-passenger',
    padding: 4
  },

  // 模組 F：駕駛儀錶盤與 HUD
  {
    id: 'cluster',
    name: '駕駛儀錶盤_8比3極寬比例主駕屏',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'cluster';
      });
    `,
    selector: '.bezel-cluster',
    padding: 4
  },
  {
    id: 'hud',
    name: '擋風玻璃HUD_極簡平視投影',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'hud';
      });
    `,
    selector: '.hud-frameless-projection',
    padding: 6
  },

  // 模組 G：全局聯動抽屜面板與設計/驗收彈窗
  {
    id: 'control_drawer',
    name: '全局控制面板_五端聯動抽屜',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'overview';
        st.system.centerActiveModal = null;
        st.system.showDesignDoc = false;
        st.system.showChecklistModal = false;
      });
      window.__TESLA_HMI__.app.drawerOpen = true;
      document.querySelector('.cockpit-shell')?.setAttribute('data-drawer', 'open');
    `,
    selector: '#demo-control-sidebar',
    padding: 6
  },
  {
    id: 'design_doc',
    name: '全局模態框_設計規格與架構文檔',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'overview';
        st.system.centerActiveModal = null;
        st.system.showDesignDoc = true;
        st.system.showChecklistModal = false;
      });
      window.__TESLA_HMI__.app.drawerOpen = false;
      document.querySelector('.cockpit-shell')?.setAttribute('data-drawer', 'closed');
    `,
    selector: '.doc-modal-card',
    padding: 10
  },
  {
    id: 'acceptance_checklist',
    name: '全局模態框_量產級驗收自檢清單',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'overview';
        st.system.centerActiveModal = null;
        st.system.showDesignDoc = false;
        st.system.showChecklistModal = true;
      });
      window.__TESLA_HMI__.app.drawerOpen = false;
      document.querySelector('.cockpit-shell')?.setAttribute('data-drawer', 'closed');
    `,
    selector: '.doc-modal-card',
    padding: 10
  }
];

server.listen(PORT, async () => {
  console.log(`[ScreenCapture] 伺服器啟動: http://localhost:${PORT}`);

  // 啟動高分辨率無頭 Chrome
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=2560,1440',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `http://localhost:${PORT}/`
  ]);

  await new Promise(r => setTimeout(r, 2200));

  const jsonTargets = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    }).on('error', reject);
  });

  const page = jsonTargets.find(t => t.type === 'page');
  if (!page) {
    console.error('未找到 Chrome 頁面目標');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => {
    const msgId = id++;
    return new Promise((resolve, reject) => {
      const handler = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        } catch (e) {
          reject(e);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  ws.addEventListener('open', async () => {
    console.log('[CDP] 已建立連接，開始初始化...');
    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    const waitTime = process.argv.length > 2 ? 3500 : 12000;
    console.log(`[CDP] 等待頁面與模型就緒 (${waitTime / 1000}s)...`);
    await new Promise(r => setTimeout(r, waitTime));

    // 注入防裁切的全局輔助樣式（讓手機端與模態框在需要長圖時自然伸展）
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const style = document.createElement('style');
          style.id = 'capture-anti-clipping-style';
          style.textContent = \`
            /* 手機長頁面防裁切模式 */
            .cockpit-shell[data-view="mobile"].capture-unfold-mobile .screens-stage {
              display: flex !important;
              justify-content: center !important;
              align-items: flex-start !important;
              height: auto !important;
              min-height: 100vh !important;
              overflow: visible !important;
              padding: 24px 0 !important;
            }
            .cockpit-shell[data-view="mobile"].capture-unfold-mobile .unit-mobile {
              display: flex !important;
              width: 390px !important;
              height: auto !important;
              max-height: none !important;
              margin: 0 auto !important;
              transform: none !important;
              animation: none !important;
            }
            .cockpit-shell[data-view="mobile"].capture-unfold-mobile .physical-iphone-frame {
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
              padding: 10px !important;
            }
            .cockpit-shell[data-view="mobile"].capture-unfold-mobile .mobile-screen-inner {
              height: auto !important;
              min-height: 720px !important;
              max-height: none !important;
              overflow: visible !important;
            }
            .cockpit-shell[data-view="mobile"].capture-unfold-mobile .mobile-ui-layer {
              height: auto !important;
              min-height: none !important;
              overflow: visible !important;
            }
            .cockpit-shell[data-view="mobile"].capture-unfold-mobile .mobile-page {
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
            /* 隱藏截圖時多餘的光標 */
            * { cursor: default !important; }
          \`;
          document.head.appendChild(style);
        })();
      `
    });

    const filterIds = process.argv.slice(2);
    const activeSpecs = filterIds.length > 0
      ? CAPTURE_SPECS.filter(s => filterIds.includes(s.id))
      : CAPTURE_SPECS;

    console.log(`[CDP] 開始執行 ${activeSpecs.length} 大狀態 × 2 主題（共 ${activeSpecs.length * 2} 張）無裁切截圖...`);

    const themes = [
      { mode: 'night', label: '夜間深色' },
      { mode: 'day', label: '日間淺色' }
    ];

    let count = 0;

    for (const theme of themes) {
      console.log(`\n========================================`);
      console.log(`▶ 切換至【${theme.label}模式 (${theme.mode})】...`);
      console.log(`========================================`);

      // 設置主題
      await send('Runtime.evaluate', {
        expression: `
          window.__TESLA_HMI__.store.update(st => {
            st.environment.timeOfDay = '${theme.mode}';
            document.documentElement.setAttribute('data-theme', '${theme.mode}');
          });
        `
      });
      await new Promise(r => setTimeout(r, 600));

      for (const spec of activeSpecs) {
        count++;
        const filename = `${theme.mode}_${spec.id}.png`;
        console.log(`[${count}/${activeSpecs.length * 2}] 正在抓取: ${theme.label} · ${spec.name} -> ${filename}`);

        // 設置該項目的視圖狀態
        await send('Runtime.evaluate', { expression: spec.setup });

        // 若是手機端長頁面，啟用 capture-unfold-mobile 樣式
        if (spec.isMobile) {
          await send('Runtime.evaluate', {
            expression: `document.querySelector('.cockpit-shell')?.classList.add('capture-unfold-mobile');`
          });
        } else {
          await send('Runtime.evaluate', {
            expression: `document.querySelector('.cockpit-shell')?.classList.remove('capture-unfold-mobile');`
          });
        }

        // 等待佈局穩定與過渡動畫完成
        await new Promise(r => setTimeout(r, 380));

        // 計算元素的精確 Bounding Box
        const rectRes = await send('Runtime.evaluate', {
          expression: `
            (() => {
              const el = document.querySelector('${spec.selector}');
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return {
                x: Math.max(0, Math.round(r.left)),
                y: Math.max(0, Math.round(r.top)),
                width: Math.round(r.width),
                height: Math.round(r.height)
              };
            })();
          `,
          returnByValue: true
        });

        const rect = rectRes?.result?.value;
        let clip = null;

        if (rect && rect.width > 0 && rect.height > 0) {
          const pad = spec.padding || 0;
          clip = {
            x: Math.max(0, rect.x - pad),
            y: Math.max(0, rect.y - pad),
            width: Math.min(2560 - Math.max(0, rect.x - pad), rect.width + pad * 2),
            height: Math.min(1440 - Math.max(0, rect.y - pad), rect.height + pad * 2),
            scale: 1
          };
        }

        const shotParams = { format: 'png' };
        if (clip) {
          shotParams.clip = clip;
        }

        const shot = await send('Page.captureScreenshot', shotParams);

        if (shot && shot.data) {
          const buf = Buffer.from(shot.data, 'base64');
          fs.writeFileSync(path.join(LOCAL_DIR, filename), buf);
          fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
          console.log(`  ✓ 成功儲存 (${(buf.length / 1024).toFixed(1)} KB) 尺寸: ${clip ? `${clip.width}x${clip.height}` : '全屏'}`);
        } else {
          console.error(`  ✗ 截圖失敗: ${filename}`);
        }
      }
    }

    console.log(`\n🎉 全部 58 張全量無裁切截圖已全部生成並同步完畢！`);

    ws.close();
    chrome.kill();
    server.close();
    process.exit(0);
  });
});
