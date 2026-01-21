# Test Plan (Localhost Demo)

## 想定環境
- Backend: FastAPI (http://localhost:8002)
- Frontend: Backend 静的配信 (http://localhost:8002/)

## ケース
1. invalid
   - 入力: 0000
   - 期待: status=invalid / メッセージ表示

2. play (valid)
   - 入力: 2027
   - 期待: status=win または lose / ルーレット表示 / win の場合は QR 表示

3. reuse (invalid)
   - 2 の後に同じコードを再入力
   - 期待: status=invalid / 入力画面でエラーメッセージ / ルーレット非表示

4. play (valid 2)
   - 入力: 2035
   - 期待: status=win または lose / ルーレット表示 / win の場合は QR 表示

5. redeem ok
   - 2 または 4 で発行したトークンを /redeem に入力
   - 期待: status=ok

6. redeem 二重引換
   - 5 のトークンを再入力
   - 期待: status=already_redeemed

7. redeem expired
   - exp を過去にしたトークン (手動) を入力
   - 期待: status=expired
