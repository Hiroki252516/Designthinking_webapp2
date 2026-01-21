import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(APP_ROOT, "frontend")
DB_PATH = os.environ.get("DB_PATH", os.path.join(APP_ROOT, "backend", "app.db"))
COUPON_SECRET = os.environ.get("COUPON_SECRET", "demo-secret-change-me")

VALID_CODE = "2026"
OUTCOME_PENDING = "pending"
OUTCOME_WIN = "win"
OUTCOME_LOSE = "lose"


class PlayRequest(BaseModel):
	lid_code: str


class RedeemRequest(BaseModel):
	coupon_token: str


app = FastAPI()
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


def now_iso() -> str:
	return datetime.now(timezone.utc).isoformat()


def get_conn() -> sqlite3.Connection:
	conn = sqlite3.connect(DB_PATH, check_same_thread=False)
	conn.row_factory = sqlite3.Row
	return conn


def init_db() -> None:
	conn = get_conn()
	try:
		conn.execute(
			"""
			CREATE TABLE IF NOT EXISTS lid_codes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				code TEXT UNIQUE NOT NULL,
				outcome TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'new',
				played_at TEXT,
				won_at TEXT,
				redeemed_at TEXT
			)
			"""
		)
		conn.execute(
			"""
			CREATE TABLE IF NOT EXISTS coupons (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				lid_code_id INTEGER UNIQUE NOT NULL,
				token TEXT UNIQUE NOT NULL,
				issued_at TEXT NOT NULL,
				expires_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'issued',
				redeemed_at TEXT,
				FOREIGN KEY(lid_code_id) REFERENCES lid_codes(id)
			)
			"""
		)
		conn.execute(
			"""
			CREATE TABLE IF NOT EXISTS play_attempts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				lid_code_id INTEGER,
				created_at TEXT NOT NULL,
				result TEXT NOT NULL
			)
			"""
		)
		conn.execute("DELETE FROM lid_codes WHERE code != ?", (VALID_CODE,))
		row = conn.execute("SELECT id, outcome, status FROM lid_codes WHERE code = ?", (VALID_CODE,)).fetchone()
		if row:
			if row["status"] == "new" and row["outcome"] != OUTCOME_PENDING:
				conn.execute(
					"UPDATE lid_codes SET outcome = ? WHERE code = ?",
					(OUTCOME_PENDING, VALID_CODE),
				)
			elif row["outcome"] not in (OUTCOME_WIN, OUTCOME_LOSE, OUTCOME_PENDING):
				conn.execute(
					"UPDATE lid_codes SET outcome = ? WHERE code = ?",
					(OUTCOME_PENDING, VALID_CODE),
				)
		else:
			conn.execute(
				"INSERT INTO lid_codes (code, outcome, status) VALUES (?, ?, 'new')",
				(VALID_CODE, OUTCOME_PENDING),
			)
		conn.execute("DELETE FROM coupons WHERE lid_code_id NOT IN (SELECT id FROM lid_codes)")
		conn.execute(
			"DELETE FROM play_attempts WHERE lid_code_id NOT IN (SELECT id FROM lid_codes) AND lid_code_id IS NOT NULL"
		)
		conn.commit()
	finally:
		conn.close()


def base64url_encode(raw: bytes) -> str:
	return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def base64url_decode(raw: str) -> bytes:
	padding = "=" * (-len(raw) % 4)
	return base64.urlsafe_b64decode(raw + padding)


def sign_token(payload: dict) -> str:
	payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
	payload_b64 = base64url_encode(payload_bytes)
	signature = hmac.new(COUPON_SECRET.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
	sig_b64 = base64url_encode(signature)
	return f"{payload_b64}.{sig_b64}"


def verify_token(token: str) -> dict | None:
	parts = token.split(".")
	if len(parts) != 2:
		return None
	payload_b64, sig_b64 = parts
	expected = hmac.new(
		COUPON_SECRET.encode("utf-8"),
		payload_b64.encode("ascii"),
		hashlib.sha256,
	).digest()
	if not hmac.compare_digest(base64url_encode(expected), sig_b64):
		return None
	try:
		payload = json.loads(base64url_decode(payload_b64))
	except json.JSONDecodeError:
		return None
	return payload


def issue_coupon(code: str) -> tuple[str, str]:
	issued_at = datetime.now(timezone.utc)
	expires_at = issued_at + timedelta(days=7)
	payload = {
		"lid": code,
		"iat": int(issued_at.timestamp()),
		"exp": int(expires_at.timestamp()),
		"nonce": secrets.token_hex(8),
	}
	token = sign_token(payload)
	return token, expires_at.isoformat()


@app.on_event("startup")
def startup() -> None:
	init_db()


@app.get("/health")
def health() -> dict:
	return {"ok": True}


@app.get("/", response_class=HTMLResponse)
def index() -> FileResponse:
	return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/play", response_class=HTMLResponse)
def play_page() -> FileResponse:
	return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/redeem", response_class=HTMLResponse)
def redeem_page() -> FileResponse:
	return FileResponse(os.path.join(FRONTEND_DIR, "redeem.html"))


@app.post("/api/play")
def play(payload: PlayRequest) -> dict:
	code = payload.lid_code.strip()
	if not (code.isdigit() and len(code) == 4):
		return {"status": "invalid", "message": "番号が無効です"}
	if code != VALID_CODE:
		conn = get_conn()
		try:
			conn.execute(
				"INSERT INTO play_attempts (lid_code_id, created_at, result) VALUES (?, ?, ?)",
				(None, now_iso(), "invalid"),
			)
			conn.commit()
		finally:
			conn.close()
		return {"status": "invalid", "message": "番号が無効です"}

	conn = get_conn()
	try:
		row = conn.execute("SELECT * FROM lid_codes WHERE code = ?", (code,)).fetchone()
		if not row:
			conn.execute(
				"INSERT INTO lid_codes (code, outcome, status) VALUES (?, ?, 'new')",
				(VALID_CODE, OUTCOME_PENDING),
			)
			row = conn.execute("SELECT * FROM lid_codes WHERE code = ?", (code,)).fetchone()

		status = row["status"]
		outcome = row["outcome"]
		if status in ("won", "redeemed"):
			coupon = conn.execute(
				"SELECT * FROM coupons WHERE lid_code_id = ?",
				(row["id"],),
			).fetchone()
			message = "当選済みのためクーポンを再表示します。"
			if status == "redeemed":
				message = "この識別番号は引換済みですがクーポンを表示します。"
			if coupon:
				return {
					"status": "win",
					"message": message,
					"coupon_token": coupon["token"],
					"expires_at": coupon["expires_at"],
				}

		outcome_updated = False
		if outcome == OUTCOME_PENDING:
			if status == "new":
				outcome = OUTCOME_WIN if secrets.randbelow(4) == 0 else OUTCOME_LOSE
			else:
				outcome = OUTCOME_LOSE
			conn.execute(
				"UPDATE lid_codes SET outcome = ? WHERE id = ?",
				(outcome, row["id"]),
			)
			outcome_updated = True

		if status == "played" and outcome == OUTCOME_LOSE:
			if outcome_updated:
				conn.commit()
			return {"status": "lose", "message": "残念！ハズレです。"}

		if outcome == OUTCOME_WIN:
			token, expires_at = issue_coupon(code)
			conn.execute(
				"""
				INSERT OR IGNORE INTO coupons (lid_code_id, token, issued_at, expires_at, status)
				VALUES (?, ?, ?, ?, 'issued')
				""",
				(row["id"], token, now_iso(), expires_at),
			)
			conn.execute(
				"""
				UPDATE lid_codes
				SET status = 'won', won_at = ?, played_at = COALESCE(played_at, ?)
				WHERE id = ?
				""",
				(now_iso(), now_iso(), row["id"]),
			)
			conn.execute(
				"INSERT INTO play_attempts (lid_code_id, created_at, result) VALUES (?, ?, ?)",
				(row["id"], now_iso(), OUTCOME_WIN),
			)
			conn.commit()
			return {
				"status": "win",
				"message": "当選しました！",
				"coupon_token": token,
				"expires_at": expires_at,
			}

		conn.execute(
			"UPDATE lid_codes SET status = 'played', played_at = ? WHERE id = ?",
			(now_iso(), row["id"]),
		)
		conn.execute(
			"INSERT INTO play_attempts (lid_code_id, created_at, result) VALUES (?, ?, ?)",
			(row["id"], now_iso(), OUTCOME_LOSE),
		)
		conn.commit()
		return {"status": "lose", "message": "残念！ハズレです。"}
	finally:
		conn.close()


@app.post("/api/redeem")
def redeem(payload: RedeemRequest) -> dict:
	token = payload.coupon_token.strip()
	verified = verify_token(token)
	if not verified:
		return {"status": "invalid", "message": "無効なクーポンです。"}

	exp = verified.get("exp")
	if isinstance(exp, int) and datetime.now(timezone.utc).timestamp() > exp:
		return {"status": "expired", "message": "有効期限が切れています。"}

	conn = get_conn()
	try:
		coupon = conn.execute("SELECT * FROM coupons WHERE token = ?", (token,)).fetchone()
		if not coupon:
			return {"status": "invalid", "message": "無効なクーポンです。"}

		if coupon["status"] == "redeemed":
			return {"status": "already_redeemed", "message": "既に引換済みです。"}

		conn.execute(
			"UPDATE coupons SET status = 'redeemed', redeemed_at = ? WHERE id = ?",
			(now_iso(), coupon["id"]),
		)
		conn.execute(
			"UPDATE lid_codes SET status = 'redeemed', redeemed_at = ? WHERE id = ?",
			(now_iso(), coupon["lid_code_id"]),
		)
		conn.commit()
		return {"status": "ok", "message": "引換完了しました。"}
	finally:
		conn.close()
