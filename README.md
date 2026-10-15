# Tesla 品牌新能源車 · 五端全場景智能座艙 HMI 實時系統

> **概念設計，非官方產品 (Concept Design, Non-Official Product)**

本專案為可直接於桌面瀏覽器實時運行的產品級座艙 HMI 演示系統，採用 **Three.js (WebGL2)** 為 3D 渲染核心，配備完整後處理管線（**UnrealBloom 輝光、ACESFilmic 色調映射、SSAO 環境光遮蔽、SMAA 抗鋸齒**）、程序化 HDRI 環境光反射、高精度 PBR 清漆車漆（含金屬片與微橘皮法線貼圖），以及毫秒級同步的中央車輛狀態總線。

---

## 一、五端涵蓋範圍

1. **手機 App（遠程連接車輛）**：iPhone 16 Pro 物理外框與靈動島狀態欄；首頁 360° 交互式 3D 車輛視圖、電量與 WLTP 續航、上鎖／解鎖、閃燈鳴笛尋車、遠程預冷／預熱、充電狀態與歷史充電記錄明細、車門／前備箱／尾箱／充電口獨立控制；具備自然頁面切換動效。
2. **方向盤旁的中控駕駛屏（1920×1200 比例）**：左側 3D 車輛與 ADAS 感知視圖、P/R/N/D 觸控換擋軌、實時車速與雙向功率條、迷你媒體卡；右側大尺寸自繪矢量導航地圖打底（路線流光、轉向預告、超充站點擊導航、路況圖層）；底部常駐 Dock 欄；完整實作駕駛模式、動能回收、雙溫區空調與風量、車燈、雨刮、後視鏡調節與折疊、車輛設置模態窗；每個控件支援 **按下（Active）、啟用（Enabled）、禁用（Disabled）、載入（Loading）** 四種狀態。
3. **副駕娛樂屏**：音樂廳、劇院影片、街機遊戲（內建可實際遊玩的《Cyber OutRun: Tokyo C1》）三個入口；播放控制、進度拖拽、音量調節、播放列表切換；與主屏音量及導航語音播報狀態即時聯動（導航播報時自動執行 Audio Ducking 壓低媒體音量）。
4. **儀錶盤**：方向盤後超寬視野；實時平滑過渡車速、擋位、功率輸出與動能回收雙向動態條、預估續航、輔助駕駛 3D 場景（車道居中引導毯、前車距離鎖定、碰撞預警）、下一路口導航轉向提示、四輪實時胎壓（Bar）與車門未關報警。
5. **抬頭顯示 HUD**：模擬擋風玻璃前向 AR 透視投影（含透視傾角、光學微發光與距離感）；顯示實時車速、道路限速標誌、轉向提示、3D 貼地流動導航箭頭、前車距離（m）。

---

## 二、快速運行說明 (How to Run)

由於專案使用原生 ES Modules (`<script type="importmap">`) 與本地 GLB 3D 模型 (`./assets/models/tesla-model-3.glb`)，請透過任意本地靜態 HTTP 伺服器啟動（避免 `file://` 協議下的 CORS 限制）：

### 方式 1：使用 Python 3 內建伺服器（推薦，免安裝額外工具）
```bash
cd "/Users/usagi/Documents/ Tesla HMI Gemini4"
python3 -m http.server 8080
```
接著在桌面瀏覽器（Chrome / Edge / Safari）開啟：
**[http://localhost:8080](http://localhost:8080)**

### 方式 2：使用 Node.js `npx http-server`
```bash
cd "/Users/usagi/Documents/ Tesla HMI Gemini4"
npx http-server -p 8080 -c-1
```
接著開啟 **[http://localhost:8080](http://localhost:8080)**。

---

## 三、3D 車身模型來源與授權署名

- **模型名稱**：[Tesla 2018 Model 3](https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f)
- **作者**：Ameer Studio (發佈於 Sketchfab)
- **授權條款**：CC Attribution 4.0 International (CC-BY 4.0)
- **本專案工程重構**：重構全車 PBR 清漆材質（新增程序化金屬片與微橘皮法線貼圖）、高透光全景玻璃、橡膠輪胎、拉絲鋁飾條，並綁定四扇車門、前備箱、電動尾箱、左後電動充電口蓋（含呼吸狀態燈與超充槍）、雨刮、車輪滾動與全車燈組（日行燈、遠近光、轉向燈、剎車燈、倒車燈）實時動畫。
