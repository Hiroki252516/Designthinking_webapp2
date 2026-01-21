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
有効:
- 2027
- 2028
- 2029
- 2030
- 2031
- 2032
- 2033
- 2034
- 2035

※ 当選/ハズレは抽選 (1回のみ有効)

## 仕様メモ
- 署名付きトークン (HMAC) をQR化
- 識別番号は単回のみ有効 (再入力は無効扱い)
- 引換後のトークンは二重引換不可
