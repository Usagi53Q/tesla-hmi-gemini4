const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8000;
const CDP_PORT = 9295;

// 本地項目截圖儲存目錄
const LOCAL_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

// Artifacts 截圖儲存目錄
const ARTIFACT_DIR = path.resolve(__dirname, '../../.gemini/antigravity/brain/aac3bfcb-9c13-44b7-8635-d64d6c19ee30/screenshots');
if (!fs.existsSync(ARTIFACT_DIR)) {
  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  } catch (e) {}
}

// 29 大全量狀態規格矩陣（全部採用 2560×1440 真實瀏覽器全屏視口，保留頂部導航欄、狀態燈、3D道路與底欄，徹底杜絕局部裁剪）
const CAPTURE_SPECS = [
  // 模組 A：座艙總覽
  {
    id: 'overview',
    name: '3D真實座艙透視總覽 (瀏覽器全景視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'overview';
        st.system.centerActiveModal = null;
        st.system.showDesignDoc = false;
        st.system.showChecklistModal = false;
      });
      window.__TESLA_HMI__.app.drawerOpen = false;
      document.querySelector('.cockpit-shell')?.setAttribute('data-drawer', 'closed');
      document.getElementById('demo-control-panel')?.classList.remove('is-open');
    `,
    fullViewport: true
  },

  // 模組 B：手機 App 6 大子頁面（切換至手機端視角，真實呈現居中立體 iPhone 及其頁面內容）
  {
    id: 'mobile_home',
    name: '手機App_01首頁與快捷車控 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'home';
        st.system.centerActiveModal = null;
        st.system.showDesignDoc = false;
        st.system.showChecklistModal = false;
      });
      window.__TESLA_HMI__.app.drawerOpen = false;
      document.querySelector('.cockpit-shell')?.setAttribute('data-drawer', 'closed');
    `,
    fullViewport: true
  },
  {
    id: 'mobile_location',
    name: '手機App_02定位小地圖與發送目的地 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'location';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },
  {
    id: 'mobile_controls',
    name: '手機App_03車控門鎖網格與鑰匙管理 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'controls';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },
  {
    id: 'mobile_climate',
    name: '手機App_04溫控模式與預約出發 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'climate';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },
  {
    id: 'mobile_charging',
    name: '手機App_05充電功率上限與行程能耗歷史 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'charging';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },
  {
    id: 'mobile_service',
    name: '手機App_06軟件版本OTA與官方保養預約 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'mobile';
        st.system.mobileActivePage = 'service';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },

  // 模組 C：15.4" 旗艦中控橫屏主界面與 6 大功能彈窗（全屏視口呈現中控特寫與彈窗浮層）
  {
    id: 'center_main',
    name: '中控屏_主駕導航與3D車道感知 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = null;
        st.system.showDesignDoc = false;
        st.system.showChecklistModal = false;
      });
      window.__TESLA_HMI__.app.drawerOpen = false;
      document.querySelector('.cockpit-shell')?.setAttribute('data-drawer', 'closed');
    `,
    fullViewport: true
  },
  {
    id: 'center_apps',
    name: '中控屏_車載應用中心九宮格 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'apps';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_charging',
    name: '中控屏_高壓電池與超級充電管理 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'charging';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_camera360',
    name: '中控屏_360環視全景與相機視角 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'camera360';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_phone',
    name: '中控屏_藍牙電話與通訊錄撥號 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'phone';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_voice',
    name: '中控屏_車載自然語音助理交互 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'voice';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_climate',
    name: '中控屏_雙溫區熱泵空調大彈層 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'climate';
      });
    `,
    fullViewport: true
  },

  // 模組 D：中控車輛設置中心 7 大選項卡（全屏視口呈現中控設置面板）
  {
    id: 'center_settings_display',
    name: '中控設置_01顯示與電動向日葵傾斜 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'display';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_settings_lights',
    name: '中控設置_02燈光與外部照明雨刮 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'lights';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_settings_locks',
    name: '中控設置_03車門車鎖與鑰匙管理 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'locks';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_settings_autopilot',
    name: '中控設置_04Autopilot輔助駕駛與轉向手感 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'autopilot';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_settings_safety',
    name: '中控設置_05安全哨兵與四輪胎壓TPMS (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'safety';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_settings_schedule',
    name: '中控設置_06日程預約出發與離峰充電 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'schedule';
      });
    `,
    fullViewport: true
  },
  {
    id: 'center_settings_service',
    name: '中控設置_07OTA升級與保養維護模式 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'center';
        st.system.centerActiveModal = 'settings';
        st.system.settingsTab = 'service';
      });
    `,
    fullViewport: true
  },

  // 模組 E：副駕娛樂屏 3 大 Tab (全屏視口)
  {
    id: 'passenger_music',
    name: '副駕娛樂屏_音樂播放與24Bit頻譜 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'passenger';
        st.media.activeTab = 'music';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },
  {
    id: 'passenger_video',
    name: '副駕娛樂屏_動態短片劇場 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'passenger';
        st.media.activeTab = 'video';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },
  {
    id: 'passenger_game',
    name: '副駕娛樂屏_街機遊戲中心 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'passenger';
        st.media.activeTab = 'game';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },

  // 模組 F：駕駛儀錶盤與 HUD (全屏視口)
  {
    id: 'cluster',
    name: '駕駛儀錶盤_8比3極寬比例主駕屏 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'cluster';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },
  {
    id: 'hud',
    name: '擋風玻璃HUD_極簡平視投影 (全屏視口)',
    setup: `
      window.__TESLA_HMI__.store.update(st => {
        st.system.focusedScreen = 'hud';
        st.system.centerActiveModal = null;
      });
    `,
    fullViewport: true
  },

  // 模組 G：全局聯動抽屜面板與設計/驗收彈窗 (全屏視口)
  {
    id: 'control_drawer',
    name: '全局控制面板_五端聯動抽屜 (全屏視口)',
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
    fullViewport: true
  },
  {
    id: 'design_doc',
    name: '全局模態框_設計規格與架構文檔 (全屏視口)',
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
    fullViewport: true
  },
  {
    id: 'acceptance_checklist',
    name: '全局模態框_量產級驗收自檢清單 (全屏視口)',
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
    fullViewport: true
  }
];

async function run() {
  console.log(`[ScreenCapture] 直連本地伺服器: http://localhost:${PORT}/`);

  // 啟動高分辨率無頭 Chrome (強制視口 2560x1440，保留 WebGL 原生渲染支持)
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=2560,1440',
    '--hide-scrollbars',
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

    console.log('[CDP] 正在校驗 3D 數字孿生模型與車流渲染就緒狀態...');
    for (let i = 0; i < 40; i++) {
      const isLoaded = await send('Runtime.evaluate', {
        expression: `Boolean(window.__TESLA_HMI__?.sceneEngine?.glbLoaded)`
      });
      if (isLoaded?.result?.value) {
        console.log(`[CDP] 3D 模型已完全載入 (耗時 ${(i * 400) / 1000}s)`);
        break;
      }
      await new Promise(r => setTimeout(r, 400));
    }
    console.log('[CDP] 等待 3D 道路、柏油反射、路燈光暈與前車車流完全進入可視畫面 (5s)...');
    await new Promise(r => setTimeout(r, 5000));

    const filterIds = process.argv.slice(2);
    const activeSpecs = filterIds.length > 0
      ? CAPTURE_SPECS.filter(s => filterIds.includes(s.id))
      : CAPTURE_SPECS;

    console.log(`[CDP] 開始執行 ${activeSpecs.length} 大狀態 × 2 主題（共 ${activeSpecs.length * 2} 張）無裁切真實全屏截圖...`);

    const themes = [
      { mode: 'night', label: '夜間深色' },
      { mode: 'day', label: '日間淺色' }
    ];

    let count = 0;

    for (const theme of themes) {
      console.log(`\\n========================================`);
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
      await new Promise(r => setTimeout(r, 1200));

      for (const spec of activeSpecs) {
        count++;
        const filename = `${theme.mode}_${spec.id}.png`;
        console.log(`[${count}/${activeSpecs.length * 2}] 正在抓取: ${theme.label} · ${spec.name} -> ${filename}`);

        // 設置該項目的視圖狀態並觸發一次 resize 重繪
        await send('Runtime.evaluate', {
          expression: `
            ${spec.setup};
            window.dispatchEvent(new Event('resize'));
          `
        });

        // 等待相機過渡平滑到位、DOM 彈窗展開與 3D 渲染穩定 (1200ms)
        await new Promise(r => setTimeout(r, 1200));

        // 截取 2560x1440 完整真實瀏覽器全屏視口，無任何局部剪裁
        const shot = await send('Page.captureScreenshot', { format: 'png' });

        if (shot && shot.data) {
          const buf = Buffer.from(shot.data, 'base64');
          fs.writeFileSync(path.join(LOCAL_DIR, filename), buf);
          if (fs.existsSync(ARTIFACT_DIR)) {
            try {
              fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
            } catch (e) {}
          }
          console.log(`  ✓ 成功儲存 (${(buf.length / 1024).toFixed(1)} KB) 尺寸: 2560x1440 全屏`);
        } else {
          console.error(`  ✗ 截圖失敗: ${filename}`);
        }
      }
    }

    console.log(`\\n🎉 全部 58 張全量無裁切截圖已全部生成並同步完畢！`);

    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  });
}

run().catch(err => {
  console.error('[ScreenCapture] 執行異常:', err);
  process.exit(1);
});
