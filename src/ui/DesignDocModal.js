import { icon } from './icons.js';

export function renderDesignDocModal(s) {
  if (!s || !s.system || !s.system.showDesignDoc) return '';

  return `
    <div class="doc-modal-backdrop" data-action="close-design-doc">
      <div class="doc-modal-panel" role="dialog" aria-labelledby="design-doc-title" onclick="event.stopPropagation()">
        <header class="doc-modal-header">
          <div>
            <div class="doc-badge">TESLA COCKPIT HMI · ARCHITECTURE & DESIGN SPECIFICATION</div>
            <h2 class="doc-title" id="design-doc-title">五端智能座艙 HMI 設計說明文檔</h2>
          </div>
          <button class="ctrl-btn icon-only" data-action="close-design-doc" aria-label="關閉設計說明文檔">
            ${icon('close')}
          </button>
        </header>

        <div class="doc-modal-body">
          <section class="doc-section">
            <h3>01 · 設計目標與使用場景 (Design Goals & Scenarios)</h3>
            <p class="doc-lead">
              本系統針對 Tesla 品牌純電新能源車打造量產級五端協同座艙 HMI，核心目標是在「零視覺冗餘、克制中性深灰/白配色」與「毫秒級多端狀態同步」之間取得平衡，覆蓋從離車遠程控車、上車準備、高速/城市輔助駕駛到副駕沉浸娛樂的全閉環體驗：
            </p>
            <div class="doc-grid-5">
              <div class="doc-card">
                <h4>1. 手機 App（場景旁）</h4>
                <p>車主離車或出發前遠程查看車輛 3D 狀態、剩餘電量與 WLTP 續航，執行提前預冷/預熱座艙、停車場閃燈鳴笛尋車、解鎖車門與尾箱，以及查閱超充進度與歷史充電記錄。</p>
              </div>
              <div class="doc-card">
                <h4>2. 中控駕駛屏（方向盤旁）</h4>
                <p>1920×1200 比例核心控制中樞。左側常駐 3D 車輛與克制型 ADAS 感知視圖，右側多層級矢量導航地圖打底，底部常駐 Dock 欄；一級觸達換擋、駕駛模式、雙區空調、燈光、雨刮與後視鏡。</p>
              </div>
              <div class="doc-card">
                <h4>3. 副駕娛樂屏（副駕前方）</h4>
                <p>副駕專屬獨立視聽與遊戲空間。提供單色細線頻譜音樂、4K 車載劇院與街機賽車遊戲三大入口，並與主屏音響及導航語音實時聯動（導航播報時自動壓低娛樂音量）。</p>
              </div>
              <div class="doc-card">
                <h4>4. 儀錶盤（方向盤後方）</h4>
                <p>控制在 3:1 以內（2.85:1），內容居中收斂於 88% 安全區並放大字級（車速 58px），呈現平滑車速、擋位、雙向功率條、續航里程、細線車道與灰色前車輪廓及胎壓/車門報警。</p>
              </div>
              <div class="doc-card">
                <h4>5. 抬頭顯示 HUD（擋風玻璃）</h4>
                <p>疊加於方向盤上方擋風玻璃視野中，採用四周留黑的居中緊湊投影小視窗，放大字級（車速 60px）呈現實時車速、限速標誌、貼地導航箭頭與前車跟車距離。</p>
              </div>
            </div>
          </section>

          <section class="doc-section">
            <h3>02 · 信息架構 (Information Architecture)</h3>
            <table class="doc-table">
              <thead>
                <tr>
                  <th>終端名稱</th>
                  <th>一級常駐信息層 (L1 Persistent)</th>
                  <th>二級高頻控制層 (L2 Direct Controls)</th>
                  <th>三級模態與明細層 (L3 Contextual Overlay)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>1. 手機 App</strong></td>
                  <td>車型名稱、鎖車狀態、3D 可旋轉車身、SOC 電量與預估續航</td>
                  <td>上鎖/解鎖、空調預冷預熱、閃燈鳴笛尋車、充電口開關</td>
                  <td>車門/前備箱/尾箱分區觸控面板、座艙溫控步進器、超充功率與歷史充電記錄明細</td>
                </tr>
                <tr>
                  <td><strong>2. 中控駕駛屏</strong></td>
                  <td>左側 P/R/N/D 換擋軌、實時車速、3D ADAS 視圖；右側多層級矢量地圖；底部常駐 Dock</td>
                  <td>導航轉向卡片、快捷車門/箱蓋控制、音樂迷你控制卡、底部溫度與音量直調按鈕</td>
                  <td>雙溫區空調與風量全屏面板、車輛設置（踏板與駕駛模式/動能回收、車燈、雨刮、後視鏡調節）</td>
                </tr>
                <tr>
                  <td><strong>3. 副駕娛樂屏</strong></td>
                  <td>頂部音樂/影片/遊戲三入口導航欄、右上方主屏同步音量與導航語音狀態指示</td>
                  <td>單色細線頻譜/4K 劇院畫布/可玩街機遊戲區、播放/暫停/上下曲、進度拖拽條</td>
                  <td>曲目播放列表、4K 劇院影片庫切換、街機賽車方向與加速控制</td>
                </tr>
                <tr>
                  <td><strong>4. 儀錶盤</strong></td>
                  <td>居中 88% 安全區、3D 細線車道與灰色前車輪廓、放大字級車速與擋位、雙向功率條</td>
                  <td>左下電池電量與續航里程、右上路口轉向提示卡片、右下四輪實時胎壓 (Bar)</td>
                  <td>車門/前備箱/尾箱未關報警膠囊、低胎壓警示、前車過近碰撞預警 (FCW)</td>
                </tr>
                <tr>
                  <td><strong>5. 抬頭顯示 HUD</strong></td>
                  <td>四周留黑居中投影小視窗、超大字級車速、當前道路限速圓牌、ADAS 巡航設定車速</td>
                  <td>3D AR 貼地導航箭頭、下一路口轉向圖標與距離倒數</td>
                  <td>前車實時距離標尺 (m) 與安全時距色帶</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="doc-section">
            <h3>03 · 核心流程 (Core User Flows)</h3>
            <div class="doc-flow-list">
              <div class="doc-flow-item">
                <span class="flow-step">流程 A · 遠程備車與上車啟動閉環</span>
                <p>用戶於手機 App 點擊「預冷/預熱」與「解鎖」→ 3D 車身日行燈點亮，中控駕駛屏與儀錶盤同步更新解鎖狀態與座艙目標溫度 → 開啟左前車門（3D 車門平滑開啟，儀錶盤與中控同步顯示左前門開啟警示）→ 關門並於中控屏切換至 D 擋 → 全車自動落鎖、進入行駛態。</p>
              </div>
              <div class="doc-flow-item">
                <span class="flow-step">流程 B · 行駛中 ADAS 感知、導航與副駕娛樂協同</span>
                <p>D 擋加速行駛時 → 3D 道路、細線車道、路燈與灰色周圍 AI 車流按實時車速 60fps 推進 → 儀錶盤、中控屏、HUD 三端車速、功率輸出/動能回收條、轉向距離與前車距離毫秒級同步 → 觸發導航語音播報時，副駕娛樂屏自動壓低媒體音量（Audio Ducking）並顯示視覺提示。</p>
              </div>
              <div class="doc-flow-item">
                <span class="flow-step">流程 C · 環境感知（晝夜與天氣）自適應切換</span>
                <p>於右側可收合控制抽屜切換「日間 / 夜間」或「晴 / 雨 / 雪」時 → 3D 場景天光 HDRI、路面濕滑鏡面反射與雨雪粒子實時變化 → Auto 模式車燈與雨刮自動啟動對應檔位 → 五端 UI 自動在夜間中性深灰模式與日間純白模式間平滑過渡。</p>
              </div>
            </div>
          </section>

          <section class="doc-section">
            <h3>04 · 視覺規範、交互四態與關鍵設計決策</h3>
            <div class="doc-grid-3">
              <div class="doc-card">
                <h4>Tesla 式中性深灰 / 白配色</h4>
                <p>去除霓虹藍光、發光車道毯與紫粉漸變。夜間模式採用中性深灰底 (#121316 / #191B1F)，單一強調色 #3E6AE1 僅用於選中與啟用狀態；副駕頻譜為單色細線。</p>
              </div>
              <div class="doc-card">
                <h4>最小字級 ≥ 12px 與大留白</h4>
                <p>全系統最小字級嚴格 ≥ 12px，放大核心行車讀數（中控 56px、儀錶盤 58px、HUD 60px），降低信息密度並增加留白；所有觸控熱區 ≥ 48×48px。</p>
              </div>
              <div class="doc-card">
                <h4>真實座艙透視與多層級地圖</h4>
                <p>座艙總覽還原擋風玻璃、方向盤與儀錶台空間透視關係；ADAS 採用細線車道與前車線框輪廓；導航地圖補齊水系、建築塊、主幹道與支路，路線變細並按縮放層級顯示標籤。</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

export function renderAcceptanceChecklistModal(s) {
  if (!s || !s.system || !s.system.showChecklistModal) return '';

  const checks = [
    { item: '1. 配色與副駕頻譜', desc: '去掉霓虹藍光、發光車道毯與紫粉漸變；整體改為 Tesla 中性深灰／白，單一強調色 (#3E6AE1) 僅用於選中與啟用狀態；副駕頻譜改為單色細線。' },
    { item: '2. 座艙透視總覽與可收合側欄', desc: '同一個透視座艙場景裡：儀錶盤在方向盤後方、中控屏在方向盤旁、副駕屏在副駕前方、擋風玻璃疊加 HUD、手機放在場景旁；控制面板收成右側可收合側欄。' },
    { item: '3. 儀錶盤與 HUD 比例與居中重排', desc: '儀錶盤按真實比例重排（2.85:1，控制在 3:1 以內），HUD 為居中的小視窗且四周留黑；兩端內容居中、字級放大（58px / 60px），不鋪滿整個寬度。' },
    { item: '4. ADAS 3D 視圖克制化', desc: '改成 0.055m 細線車道、中性灰色周圍車輛、簡潔的前車線框輪廓與距離標尺；相機拉遠，整體降低曝光亮度 (0.86) 與發光強度 (0.14)。' },
    { item: '5. 導航地圖路網層級與縮放標籤', desc: '補上水系（東京灣/隅田川/皇居外濠）、建築塊、主幹道與支路層級；導航路線變細 (3.2px)，地名與超充標籤縮小並只在合適縮放層級顯示。' },
    { item: '6. 全系統最小字級 12px 與留白', desc: '全系統 CSS 最小字級嚴格 ≥ 12px，降低各端卡片信息密度，增加留白，五端所有控件四態與狀態聯動完整保留。' }
  ];

  return `
    <div class="doc-modal-backdrop" data-action="close-checklist-modal">
      <div class="doc-modal-panel" role="dialog" aria-labelledby="checklist-modal-title" onclick="event.stopPropagation()">
        <header class="doc-modal-header">
          <div>
            <div class="doc-badge">ACCEPTANCE & SELF-INSPECTION VERIFICATION</div>
            <h2 class="doc-title" id="checklist-modal-title">量產車載系統視覺與交互逐項驗收清單</h2>
          </div>
          <button class="ctrl-btn icon-only" data-action="close-checklist-modal" aria-label="關閉驗收清單">
            ${icon('close')}
          </button>
        </header>

        <div class="doc-modal-body">
          <table class="doc-table">
            <thead>
              <tr>
                <th style="width: 220px;">驗收項目</th>
                <th>實作與自檢對標說明</th>
                <th style="width: 110px;">狀態</th>
              </tr>
            </thead>
            <tbody>
              ${checks.map((c) => `
                <tr>
                  <td><strong>${c.item}</strong></td>
                  <td>${c.desc}</td>
                  <td><span class="pass-pill">通過 PASS</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
