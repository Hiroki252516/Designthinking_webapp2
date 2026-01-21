# AGENTS.md

## 目的
識別番号入力画面で「確認」を押した時点で、既に使用済み/無効な番号の場合は画面遷移せず、入力画面にエラーメッセージを表示する。

## 期待する挙動
- 入力画面のまま `#input-error` に「無効な番号です」を表示する。
- `screen-result` への遷移は「未使用・有効」な番号のみ。
- 通信失敗時も入力画面にエラーを表示し遷移しない。

## 実装メモ
- Backend: `/api/validate` 等の検証用エンドポイントを追加する。
  - request: `{ "lid_code": "2027" }`
  - response: `{ "status": "ok" }` または `{ "status": "invalid", "message": "無効な番号です" }`
  - 判定条件: 4桁かつ VALID_CODES に含まれ、かつ `lid_codes.status == 'new'`
  - **プレイ結果・status・outcome は更新しない**（抽選は `/api/play` のみで実施）
- Frontend (`frontend/app.js`):
  - `confirmCode()` で検証エンドポイントを呼ぶ。
  - 検証中は `submitBtn` を disable にして二重送信を防ぐ。
  - `ok` のときだけ `pendingCode` をセットして `resetResultScreen()` → `switchScreen('result')`
  - `invalid` / 通信エラーは `setInputError(...)` を表示し画面遷移しない。
- VALID_CODES の範囲はフロント/バックで必ず一致させる（要件が 2026-2035 なら両方更新）。
