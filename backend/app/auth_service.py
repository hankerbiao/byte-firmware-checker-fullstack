import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import HTTPException, status

from app.core.config import settings


class AuthService:
    def __init__(self, db: Any) -> None:
        self.db = db

    @staticmethod
    def _base64url_decode(value: str) -> bytes:
        padding = "=" * (-len(value) % 4)
        return base64.urlsafe_b64decode(value + padding)

    def _decode_and_verify_jwt(self, token: str, secret: str) -> dict:
        try:
            header_b64, payload_b64, signature_b64 = token.split(".")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token format",
            )

        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()

        try:
            sig_bytes = self._base64url_decode(signature_b64)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token signature encoding",
            )

        if not hmac.compare_digest(expected_sig, sig_bytes):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token signature",
            )

        try:
            payload_bytes = self._base64url_decode(payload_b64)
            payload = json.loads(payload_bytes)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token payload",
            )

        exp = payload.get("exp")
        if exp is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token missing exp",
            )

        now_ts = datetime.now(timezone.utc).timestamp()
        if now_ts > float(exp):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token has expired",
            )

        return payload

    def handle_oa_callback(self, status_value: str, payload_token: str, next_url: str | None) -> dict:
        if status_value != "success":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OA login failed",
            )

        if not settings.OA_JWT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OA JWT secret not configured",
            )

        decoded = self._decode_and_verify_jwt(payload_token, settings.OA_JWT_SECRET)

        itcode = decoded.get("itcode")
        if not itcode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token missing itcode",
            )

        now = datetime.now(timezone.utc)

        self.db["users"].update_one(
            {"itcode": itcode},
            {
                "$set": {
                    "itcode": itcode,
                    "profile": decoded,
                    "updatedAt": now.isoformat(),
                },
                "$setOnInsert": {
                    "createdAt": now.isoformat(),
                },
            },
            upsert=True,
        )

        session_id = self._create_session(itcode, now)

        return {
            "ok": True,
            "user": decoded,
            "next": next_url,
            "token": session_id,
        }

    def _create_session(self, itcode: str, now: datetime) -> str:
        from uuid import uuid4

        session_id = uuid4().hex
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        self.db["sessions"].insert_one(
            {
                "sessionId": session_id,
                "itcode": itcode,
                "createdAt": now.isoformat(),
                "expiresAt": expires_at.isoformat(),
            }
        )

        return session_id

    def require_login(self, token: str | None) -> dict:
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing session token",
            )

        session = self.db["sessions"].find_one({"sessionId": token})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token",
            )

        expires_at = session.get("expiresAt")
        if expires_at is not None:
            try:
                exp_dt = datetime.fromisoformat(expires_at)
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            except Exception:
                exp_dt = None
            if exp_dt is not None and datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired",
                )

        user = self.db["users"].find_one({"itcode": session.get("itcode")}) or {}
        return {
            "sessionId": token,
            "itcode": session.get("itcode"),
            "user": user.get("profile") or {},
        }
