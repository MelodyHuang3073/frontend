# 使用 Create React App 快速開始

本專案以 [Create React App](https://github.com/facebook/create-react-app) 建立。

## 可用指令

在專案目錄中可執行下列指令：

### `npm install`

安裝專案依賴套件。\
首次執行專案前必須執行此指令。

```bash
npm install
```

### `npm start`

啟動開發模式。\
開啟 [http://localhost:3000](http://localhost:3000) 在瀏覽器中查看。

儲存檔案後頁面會自動重新載入，\
並在主控台顯示任何 ESLint 錯誤。

### `npm test`

以互動式監看模式啟動測試工具。\
更多資訊請參考 [Running Tests](https://facebook.github.io/create-react-app/docs/running-tests)。

### `npm run build`

以生產模式建置，輸出到 `build` 資料夾。\
React 會在生產模式下打包並最佳化效能。

建置結果已最小化，檔名包含雜湊值。\
應用程式已可部署！

部署相關說明請見 [Deployment](https://facebook.github.io/create-react-app/docs/deployment)。


## 系統簡介與內容

本前端專案為「請假管理系統」，提供使用者進行登入/註冊、申請請假、審核請假、瀏覽請假清單與個人資料維護，並可查看學生課表以避免衝堂。系統採用 React + TypeScript，並整合 Firebase 服務（驗證、儲存等）以支援雲端資料與檔案上傳。

## 主要功能

- 帳號驗證：支援註冊、登入、登出與基本身分驗證流程（範例頁面於 `src/pages/Login.tsx`、`src/pages/Register.tsx`）。
- 儀表板總覽：在 `src/pages/Dashboard.tsx` 提供系統入口與重要資訊總覽。
- 請假申請：`src/pages/LeaveApplication.tsx` 可建立請假申請，填寫事由與期間；上傳附件時請參考下方 CORS 設定。
- 請假審核：管理者可於 `src/pages/LeaveApproval.tsx` 審核（核准/駁回）待處理申請。
- 請假清單：`src/pages/LeaveList.tsx` 提供依狀態/日期等條件檢視與過濾申請記錄。
- 學生課表：`src/pages/StudentSchedule.tsx` 顯示課表資訊，協助使用者避開課程時間。
- 個人檔案：`src/pages/Profile.tsx` 檢視或更新個人基本資料。

## 頁面導覽

- 登入：`src/pages/Login.tsx`
- 註冊：`src/pages/Register.tsx`
- 儀表板：`src/pages/Dashboard.tsx`
- 請假申請：`src/pages/LeaveApplication.tsx`
- 請假審核（管理者）：`src/pages/LeaveApproval.tsx`
- 請假清單：`src/pages/LeaveList.tsx`
- 學生課表：`src/pages/StudentSchedule.tsx`
- 個人檔案：`src/pages/Profile.tsx`

## 技術架構（前端）

- React + TypeScript：以 Create React App 建置（見 `src/` 與 `tsconfig.json`）。
- Firebase（前端設定）：`src/firebase/` 放置設定檔（如 `config.ts`、`index.ts`）。
- 服務層：`src/services/` 提供資料與業務邏輯封裝（如 `authService.ts`、`leaveService.ts`）。
- 型別定義：`src/types/`
- 版面與模組化元件：`src/components/`（含 `Auth/`、`Layout/`）

## 設定 Firebase Storage 的 CORS

若你在本機開發伺服器（http://localhost:3000）上傳檔案至 Firebase Storage，必須在對應的 GCS Bucket（Firebase 專案實際使用的 Bucket）設定 CORS。Bucket 名稱在 `src/firebase/config.ts` 的 `storageBucket` 欄位中定義。

正確的 gsutil 設定範例（PowerShell）：

```powershell
gsutil cors set .\cors.json gs://software-engineering-edc96.appspot.com
```

此外，本儲存庫提供一個便利腳本，會從 `src/firebase/config.ts` 或環境變數 `BUCKET_NAME` 讀取 Bucket 名稱並設定 CORS：

```powershell
# 安裝相依套件並執行（請先將 GOOGLE_APPLICATION_CREDENTIALS 設為具備 Storage Admin 權限的服務帳戶金鑰）
npm install @google-cloud/storage
node ./scripts/set-cors.js

# 或明確指定要設定的 Bucket
$env:BUCKET_NAME = 'software-engineering-edc96.appspot.com'
node ./scripts/set-cors.js
```

提醒：若你曾在名稱為 `*.firebasestorage.app` 的 Bucket 設定 CORS，這對 Firebase Storage 是不正確的，且不會影響到上傳。請改用正確的 `*.appspot.com` Bucket 名稱。