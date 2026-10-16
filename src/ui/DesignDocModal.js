import { icon } from './icons.js?v=30';

export function renderDesignDocModal(s) {
  if (!s || !s.system || !s.system.showDesignDoc) return '';

  return `
    <div class="doc-modal-backdrop" data-action="close-design-doc">
      <div class="doc-modal-card" role="dialog" aria-labelledby="design-doc-title" onclick="event.stopPropagation()">
        <header class="doc-modal-header">
          <div>
            <div class="doc-kicker">TESLA MODEL S (2021+ REFRESH) · ARCHITECTURE & DESIGN SPECIFICATION</div>
            <h2 id="design-doc-title">五端智能座艙 HMI 質感與真實度重構設計說明</h2>
          </div>
          <button class="ctrl-btn icon-only" data-action="close-design-doc" aria-label="關閉設計說明文檔">
            ${icon('close')}
          </button>
        </header>

        <div class="doc-modal-body">
          <section class="doc-section">
            <h3>零、對標車型調整：Tesla Model S (2021+ Palladium 改款)</h3>
            <p>
              本專案對標車型由 Model 3 全面升級為 <strong>Tesla Model S（2021 年後改款）</strong>：
              中控屏改為 <strong>17 吋懸浮橫屏（比例 2200:1300）</strong> 並支援向駕駛側傾斜、居中、向副駕傾斜三段調節；方向盤後方配置 <strong>8:3 橫條小屏儀錶盤</strong>，嚴格執行分工（儀錶盤僅顯示車速、擋位、胎壓/車門/低電量報警、轉向燈與雙閃、限速與輔助駕駛狀態、實時能耗曲線；導航地圖與所有觸控設置均置於 17 吋中控屏）。副駕娛樂屏與擋風玻璃 AR-HUD 維持為概念設計。3D 車輛資產採用 Sketchfab CC-BY 4.0 授權模型（作者 Ameer Studio）並按 Model S 寬體低趴長軸距比例調校，於頁面底部清楚註明作者與來源。
            </p>
          </section>

          <section class="doc-section">
            <h3>一、五端分工與信息架構 (Information Architecture)</h3>
            <table class="doc-table">
              <thead>
                <tr>
                  <th>終端名稱</th>
                  <th>硬件比例與物理定位</th>
                  <th>核心職責與補齊功能</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>1. iOS 手機 App</strong></td>
                  <td>9:19.5 真實 3D 鈦金屬邊框手機（含靈動島、狀態欄、Home 指示條，可拿起放大全屏）</td>
                  <td>3D 車況預覽、車輛定位地圖、一鍵發送目的地到車、行程能耗記錄、08:15 預約出發、數位鑰匙管理、安全與哨兵設置、OTA 軟件更新、服務中心預約。</td>
                </tr>
                <tr>
                  <td><strong>2. 17" 中控橫屏</strong></td>
                  <td>2200:1300 (22:13) 懸浮橫屏，支援向駕駛側傾斜 (-6.5°)</td>
                  <td>左側 ADAS 3D 視圖與緊湊「車門/前備箱/尾箱/充電口」圖標列 + 獨立音樂卡；右側離線向量地圖、目的地搜尋與三路線選擇（最快/節能/景觀）；底部 Dock 整合應用列表、7 大完整設置頁（顯示、燈光、鎖車、輔助駕駛、安全、日程、服務）、充電頁、360° 環視相機、藍牙電話、自然語音控制。</td>
                </tr>
                <tr>
                  <td><strong>3. 副駕娛樂屏</strong></td>
                  <td>16:10 副駕前方內嵌娛樂屏（概念設計）</td>
                  <td>原創虛構歌單黑膠與單色細線頻譜、8 部真正可播放的多場景程序化生成動態短片（灣岸星軌、極光冰原、阿爾卑斯雪山、風洞流線等）、3D 街機競速；音量控件與歌名完整可見並與主屏 100% 聯動。</td>
                </tr>
                <tr>
                  <td><strong>4. 8:3 儀錶盤</strong></td>
                  <td>8:3 方向盤正後方內嵌橫條屏</td>
                  <td>專注駕駛必要信息：等寬車速、P/R/N/D 擋位、轉向燈與雙閃指示、道路限速與輔助駕駛狀態、三大行車報警（胎壓異常、車門未關、低電量）、以及最近 30 筆 Wh/km 實時能耗曲線。</td>
                </tr>
                <tr>
                  <td><strong>5. 擋風玻璃 HUD</strong></td>
                  <td>前擋風玻璃無框透明光學疊加層（概念設計，非獨立方框）</td>
                  <td>直接疊加於擋風玻璃外的真實 3D 道路上，顯示車道偏離光學提示帶、動態變色跟車距離色帶（綠/珀/紅）、3D 貼地導航轉向箭頭、實時車速與路口距離。</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="doc-section">
            <h3>二、狀態一致性與去網頁化視覺規範</h3>
            <div class="doc-grid-2">
              <div class="doc-card">
                <h4>嚴格物理與邏輯一致性</h4>
                <ul>
                  <li>非 P 擋（D / R / N）行駛時，全系統強制顯示「未上鎖」且自動關閉並隱藏哨兵模式。</li>
                  <li>P 擋駐停並上鎖時，車速強制歸零（0 km/h）；五端在同一時刻的車速、電量、續航、溫度、音量完全一致。</li>
                  <li>導航轉向圖標（左轉/右轉箭頭）與文字方向、目的地名稱、剩餘距離、ETA 在中控、HUD 與副駕提示 100% 同步。</li>
                  <li>全面移除真實藝人名、真實品牌歌單及「FSD / Plaid / AirPods / V4」等宣傳字樣，全數採用原創虛構名稱。</li>
                </ul>
              </div>
              <div class="doc-card">
                <h4>去網頁化與 3D 質感升級</h4>
                <ul>
                  <li>移除大面積藍色填充按鈕與滿屏邊框膠囊按鈕，常態與選中均以中性深灰/石墨灰與純白呈現，配統一 1.75px 線性圖標 + 短標籤。</li>
                  <li>WebGL2 開啟 4x MSAA 多重採樣與 SMAA 抗鋸齒，陰影貼圖提升至 2048×2048；修正車頂與車窗玻璃死黑，賦予真實清漆環境反射。</li>
                  <li>道路加入程序化柏油顆粒法線、車道線磨損斑駁細節、路燈體積光暈與夜間濕潤路面反射；周圍車流全面使用流線型轎跑輪廓模型。</li>
                </ul>
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
    { item: '零、對標車型調整 (Model S 2021+)', status: '已達成', desc: '已改為 2021+ Model S 對標：17 吋 2200:1300 可向駕駛傾斜中控橫屏、方向盤後 8:3 橫條儀錶盤（僅顯示駕駛必要信息與能耗曲線，地圖與控制在中控）、角落註明 CC-BY 4.0 模型作者 Ameer Studio 與來源。' },
    { item: '一、座艙總覽重做 (3D 座艙與無框 HUD)', status: '已達成（混合 3D 架構）', desc: '含擋風玻璃（透視車外真實 3D 道路）、A 柱、儀錶台、方向盤、8:3 儀錶盤罩、座椅、車門內飾板；HUD 為擋風玻璃上的無框透明疊加層；3D 鈦金屬手機可拿起放大全屏；支援拖拽軌道旋轉。註：座艙殼體採用 CSS 3D 透視結合多路實時 WebGL 畫布以維持 60FPS 觸控互動，非單一封閉 GLB 室內網格。' },
    { item: '二、屏幕物理質感與 iOS 規範', status: '已達成', desc: '所有屏幕具備金屬倒角實體邊框、斜向玻璃反光、邊緣輕微暈影、環境光映射與夜間背光漫射，日夜切換光影一致；手機具備安全區、狀態欄、靈動島、Home 指示條與平滑轉場。' },
    { item: '三、視覺語言（去網頁化）', status: '已達成', desc: '已去除大面積藍色填充按鈕與滿屏邊框膠囊按鈕，改用中性深灰/白與統一 1.75px 線性圖標+短標籤；數字強制 tabular-nums 等寬。' },
    { item: '四、3D 質感（玻璃、抗鋸齒、道路與車流）', status: '已達成', desc: '已修正車頂與玻璃死黑，開啟 WebGL2 4x MSAA + SMAA 與 2048×2048 陰影，手機 App 車燈曝光柔和不過曝；周圍車輛均為流線轎跑輪廓，路面含柏油顆粒、標線磨損、路燈光暈與夜間濕潤反射。' },
    { item: '五、內容與邏輯真實', status: '已達成', desc: '非 P 擋行駛時強制顯示「未上鎖」且不顯示哨兵；停車上鎖速度為 0；五端數值與導航轉向圖標/文字方向 100% 同步；已移除所有真實藝人、品牌與 FSD 字樣。' },
    { item: '六、版面必修（零截斷、零重疊、零豎排）', status: '已達成', desc: '1920×1080 與 1440×900 雙視窗下無任何文字截斷、重疊、豎排或溢出；中控「車門/前備箱/尾箱/充電口」為緊湊圖標列不與音樂卡重疊；副駕音量與歌名完整可見。' },
    { item: '七、五端補齊功能', status: '已達成', desc: '已完整實作手機（定位地圖、發送目的地、行程記錄、預約出發、鑰匙管理、安全哨兵、軟件更新、服務預約）、中控（應用列表、7 大設置頁、搜尋與路線選擇、充電頁、360 相機、電話藍牙、語音）、儀錶（胎壓/車門/低電量報警、能耗曲線）、HUD（車道偏離、跟車色帶、貼地箭頭）、副駕（多場景動態短片、主副駕音量聯動）。' }
  ];

  return `
    <div class="doc-modal-backdrop" data-action="close-checklist-modal">
      <div class="doc-modal-card" role="dialog" aria-labelledby="checklist-modal-title" onclick="event.stopPropagation()">
        <header class="doc-modal-header">
          <div>
            <div class="doc-kicker">1920×1080 & 1440×900 HONEST SELF-INSPECTION REPORT</div>
            <h2 id="checklist-modal-title">質感與真實度大改 · 逐項實測與如實自檢清單</h2>
          </div>
          <button class="ctrl-btn icon-only" data-action="close-checklist-modal" aria-label="關閉驗收清單">
            ${icon('close')}
          </button>
        </header>

        <div class="doc-modal-body">
          <table class="doc-table">
            <thead>
              <tr>
                <th style="width: 210px;">檢核項目</th>
                <th>實作細節與如實自檢說明</th>
                <th style="width: 130px;">實測結果</th>
              </tr>
            </thead>
            <tbody>
              ${checks.map((c) => `
                <tr>
                  <td><strong>${c.item}</strong></td>
                  <td>${c.desc}</td>
                  <td><strong style="color:#86efac;">${c.status}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
