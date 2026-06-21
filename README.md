# 田徑競賽紀錄系統

本系統提供報名匯入、田賽／徑賽／接力分類、記錄員分權、自動分組分道、成績登錄及多輪次晉級編排。

## 上線前設定

1. 安裝 Node.js 20 以上版本及 MongoDB。
2. 將 `server/.env.example` 複製為 `server/.env`。
3. 設定：
   - `MONGO_URI`：正式 MongoDB 連線字串。
   - `JWT_SECRET`：至少 32 字元的隨機密鑰。
   - `CORS_ORIGINS`：允許的管理平台網址，多個網址以逗號分隔。
4. 不可將 `server/.env` 提交到版本控制。

## 建置與啟動

```powershell
cd client
npm install
npm run build

cd ..\server
npm install
npm run build
npm start
```

後端會同時提供 `client/dist/client/browser` 的前端檔案，預設網址為
`http://伺服器位址:3000`，健康檢查為 `/api/health`。

若透過 Nginx 子路徑部署，可使用 Angular 的 `--base-href`，例如：

```powershell
npm run build -- --base-href /track-system/
```

前端 API 使用相對路徑，會自動跟隨 `/track-system/` 呼叫
`/track-system/api`。

## GitHub Codespaces 公開測試

儲存庫已包含 `.devcontainer` 設定。建立 Codespace 後會自動安裝依賴、
建置前後端、啟動 MongoDB 與平台，並轉送公開的 3000 埠。

Codespaces 僅供短期測試；停止 Codespace 後公開網址將無法使用。

開發模式可分別執行 `server/npm run dev` 與 `client/npm start`；Angular 已設定
`/api` 代理到本機 3000 埠。

## 首次登入

空資料庫第一次進入登入畫面時，可使用「初始化管理員」建立第一位管理員。
系統存在任何帳號後，此入口會永久拒絕再次初始化。後續記錄員必須由管理員建立。

## 報名匯入格式

建議使用 [import-template.csv](D:/website_data/track-system/import-template.csv) 的欄位：

- 組別
- 項目
- 號碼
- 姓名
- 單位
- 最佳成績

時間可輸入 `12.34` 或 `1:02.34`；田賽成績使用數值。系統會跳過同一項目內
重複的選手編號，並在匯入結果回報成功、略過及失敗筆數。

## 權限

- `admin`：賽事、項目、匯入、帳號及分派管理。
- `recorder`：只能讀寫管理員分派的競賽組別。
- `viewer`：僅能登入，目前不提供競賽資料存取。

權限由後端 API 強制檢查，前端隱藏按鈕僅用於改善操作介面。

## 賽制規則

- 徑賽與接力使用蛇形分組及中央道優先。
- 可針對項目設定 1–12 道及每組優先晉級人數。
- 晉級先取每組名次，再依所有剩餘成績擇優。
- 截止成績同成績者會一併晉級，API 會回報是否擴增名額。
- 田賽使用出場順序，不配置跑道，成績由高至低排序。
