# Cup Ramen Lottery Demo (Localhost)

## 起動
Docker:
```
docker compose -f Docker-compose.yml up --build
```

ローカル (Python 3.11):
```
python -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8002
```

アクセス:
- ユーザー画面: http://localhost:8002/
- 店舗画面: http://localhost:8002/redeem

## デモ用 識別番号 (4桁)
当たり:
- 7777
- 5555

ハズレ:
- 1234
- 4321
- 2468
- 1357
- 8080
- 9999
- 3141
- 2718

## 仕様メモ
- 署名付きトークン (HMAC) をQR化
- 当選済みのコードは同一トークン再表示
- 引換後のトークンは二重引換不可
