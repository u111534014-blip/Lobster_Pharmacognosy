# 龍蝦藥植（藥用植物學讀書工具）

直接用瀏覽器打開 `index.html` 就能使用，不需要安裝。答題記錄存在該瀏覽器的 localStorage。

## 檔案結構
- `index.html`：頁面入口，依序載入資料、核心與功能模組
- `css/style.css`：樣式（淺色／深色主題）
- `js/data/families.js`：科名資料（來自 科名對照.xlsx，56 科），要增修科名改這裡
- `js/core.js`：模組註冊、畫面切換、本機儲存
- `js/modules/family-quiz.js`：科名配對（自訂 5–20 題、錯題本、錯題複習、答題記錄）
- `js/quiz-engine.js`：共用的測驗畫面（設定、作答、結果、記錄）。每個練習用 `App.quizModule({...})` 描述題庫怎麼出題；「題幹 → 選出所有內容」的練習用 `App.factModule({...})`。
- `js/modules/`：科名配對、科名與植物特徵、植物個論（plants.js）、概論/通則（concepts.js）、植物構造-花（flowers.js）、圖片配對（image-match.js）、綜合練習（mixed.js，各練習輪流抽題，答錯記回原練習的錯題本）
- `icons/`：app icon（龍蝦盆栽），由原圖縮成各尺寸

## 新增功能
在 `js/modules/` 新增檔案並呼叫 `App.registerModule({ id, title, subtitle, status: 'ready', render(el) {...} })`，
再到 `index.html` 加一行 `<script>`，首頁就會出現新卡片。

## 手機網頁 app（PWA）
- `manifest.webmanifest`：app 名稱、顏色、icon
- `sw.js`：離線快取。改過任何檔案後，把 `VERSION` 加 1；新增模組檔案時也要加進 `FILES`
- 必須放在 https 網址（例如 GitHub Pages）才能「加到主畫面」並離線使用
- 換 icon：用新圖重新產生 icons/ 內的 favicon-64.png、icon-192.png、icon-512.png、icon-maskable-512.png（圖案縮在中間 80%，四周補背景色）、apple-touch-icon.png（180×180，不透明），再把 sw.js 的 VERSION 加 1

## 題庫後台（Google 試算表）

- `js/config.js` 的 `sheetUrl` 填入試算表網址（共用設定：知道連結的任何人可檢視）。留空就用內建的 `js/data/families.js`。
- 工作表「科名」：欄位 `中文科名`、`英文科名1`、`英文科名2`…（至少 4 科）。工作表「植物特徵」：`中文科名`、`特徵`、`備註`，一個特徵一列。
- 「科名與植物特徵」練習（js/modules/family-traits.js）用「植物特徵」工作表出題：至少 4 科有特徵才會開放；同一特徵在不同科用同樣寫法就會被當成共同特徵（看特徵選科名時要全選）。
- 工作表「植物個論」：第一欄 `中文植物名`，其他欄（學名、科別、英文科名1、藥用功效1…、植物特徵）都會變成選項。工作表「概論通則」：第一欄 `名詞`，其他欄 `內容1`、`內容2`…。工作表「花」：第一欄 `名詞`（寫成 `名詞/圖示` 也可以），其他欄是內容。各至少 4 列才會開放。
- 工作表「圖片」：`分組`、`名詞`、`圖片`（檔名，空白就用「名詞.png」；同一名詞有多張圖可加 `圖片2`、`圖片3` 欄）、`說明`。看圖選名詞，選項只從同一分組出；設定畫面可以選練哪一組。
- 題目圖片：上傳到 `images/`，試算表格子寫檔名（例如 `花托.jpg`）。第一欄是圖片 → 看圖選內容；其他欄（或「圖示」「圖片」欄）是圖片 → 該題一半機會改成看圖選名詞。
- App 每次開啟會讀一次試算表，成功就存在本機；讀不到時用上次存的題庫。首頁有「立即更新」。
- 讀取方式在 `js/sheet-sync.js`（gviz CSV 端點）。
