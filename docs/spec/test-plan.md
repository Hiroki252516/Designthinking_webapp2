# Test Plan (Localhost Demo)

## 想定環境
- Backend: FastAPI (http://localhost:8002)
- Frontend: Backend 静的配信 (http://localhost:8002/)

## ケース
1. invalid
   - 入力: 0000
   - 期待: status=invalid / メッセージ表示

2. lose
   - 入力: 1234
   - 期待: status=lose / ルーレット非当選 / QR非表示

3. win
   - 入力: 7777
   - 期待: status=win / ルーレット 777 / QR表示 / トークン表示

4. win 再表示
   - 3 の後に同じコードを再入力
   - 期待: 同一トークン再表示

5. redeem ok
   - 3 で発行したトークンを /redeem に入力
   - 期待: status=ok

6. redeem 二重引換
   - 5 のトークンを再入力
   - 期待: status=already_redeemed

7. redeem expired
   - exp を過去にしたトークン (手動) を入力
   - 期待: status=expired
