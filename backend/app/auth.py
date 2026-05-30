"""Sistema de auth simples: username + senha bcrypt, tokens opacos em JSON.

- users.json: lista de usuários (id, username, password_hash, role, created_at)
- sessions.json: { token: {user_id, created_at} }

Sem e-mail, sem recuperação. Admin reseta senha pelo painel.
"""
from __future__ import annotations

import json
import os
import secrets
import threading
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel

from .config import ROOT_DIR, ensure_dirs

Role = Literal["admin", "user"]

USERS_FILE = ROOT_DIR / "users.json"
SESSIONS_FILE = ROOT_DIR / "sessions.json"

_lock = threading.Lock()


# ---------- models ----------
class User(BaseModel):
    id: str
    username: str
    role: Role
    created_at: str


class UserWithHash(User):
    password_hash: str


class LoginInput(BaseModel):
    username: str
    password: str


class CreateUserInput(BaseModel):
    username: str
    password: str
    role: Role = "user"


class UpdateUserInput(BaseModel):
    password: Optional[str] = None
    role: Optional[Role] = None


class LoginResponse(BaseModel):
    token: str
    user: User


# ---------- storage ----------
def _read(path) -> dict:
    ensure_dirs()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def _write(path, data: dict) -> None:
    ensure_dirs()
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


# ---------- password helpers ----------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------- user CRUD ----------
def list_users() -> list[User]:
    with _lock:
        raw = _read(USERS_FILE)
    return [User(**{k: v for k, v in u.items() if k != "password_hash"}) for u in raw.values()]


def get_user_by_username(username: str) -> UserWithHash | None:
    with _lock:
        raw = _read(USERS_FILE)
    for u in raw.values():
        if u["username"].lower() == username.lower():
            return UserWithHash(**u)
    return None


def get_user(user_id: str) -> UserWithHash | None:
    with _lock:
        raw = _read(USERS_FILE)
    data = raw.get(user_id)
    return UserWithHash(**data) if data else None


def create_user(username: str, password: str, role: Role = "user") -> User:
    if get_user_by_username(username):
        raise HTTPException(409, "username já existe")
    if len(password) < 6:
        raise HTTPException(400, "senha precisa ter pelo menos 6 caracteres")
    user = UserWithHash(
        id=f"u_{uuid.uuid4().hex[:8]}",
        username=username,
        role=role,
        password_hash=hash_password(password),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    with _lock:
        raw = _read(USERS_FILE)
        raw[user.id] = json.loads(user.model_dump_json())
        _write(USERS_FILE, raw)
    return User(**user.model_dump(exclude={"password_hash"}))


def update_user(user_id: str, password: Optional[str], role: Optional[Role]) -> User:
    with _lock:
        raw = _read(USERS_FILE)
        if user_id not in raw:
            raise HTTPException(404, "usuário não encontrado")
        if password:
            if len(password) < 6:
                raise HTTPException(400, "senha precisa ter pelo menos 6 caracteres")
            raw[user_id]["password_hash"] = hash_password(password)
        if role:
            raw[user_id]["role"] = role
        _write(USERS_FILE, raw)
        u = UserWithHash(**raw[user_id])
    return User(**u.model_dump(exclude={"password_hash"}))


def delete_user(user_id: str) -> None:
    with _lock:
        raw = _read(USERS_FILE)
        if user_id not in raw:
            raise HTTPException(404, "usuário não encontrado")
        del raw[user_id]
        _write(USERS_FILE, raw)

    # remove sessões desse user
    with _lock:
        s = _read(SESSIONS_FILE)
        s = {tok: meta for tok, meta in s.items() if meta.get("user_id") != user_id}
        _write(SESSIONS_FILE, s)


# ---------- sessões ----------
def create_session(user_id: str) -> str:
    token = secrets.token_hex(32)
    with _lock:
        s = _read(SESSIONS_FILE)
        s[token] = {"user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()}
        _write(SESSIONS_FILE, s)
    return token


def revoke_session(token: str) -> None:
    with _lock:
        s = _read(SESSIONS_FILE)
        s.pop(token, None)
        _write(SESSIONS_FILE, s)


def session_user(token: str) -> UserWithHash | None:
    with _lock:
        s = _read(SESSIONS_FILE)
    meta = s.get(token)
    if not meta:
        return None
    return get_user(meta["user_id"])


# ---------- bootstrap admin ----------
def bootstrap_admin() -> None:
    """Cria o admin inicial se ainda não existir nenhum usuário."""
    if list_users():
        return
    username = os.environ.get("ADMIN_USERNAME", "axis")
    pwd = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD")
    if not pwd:
        pwd = secrets.token_urlsafe(12)
        print("=" * 60)
        print(f"  ⚡ Admin criado: usuário '{username}'  senha: {pwd}")
        print(f"  Anote essa senha — ela não vai aparecer de novo.")
        print(f"  (defina ADMIN_BOOTSTRAP_PASSWORD pra escolher a sua)")
        print("=" * 60)
    create_user(username, pwd, "admin")


# ---------- FastAPI dependencies ----------
def _token_from_request(request: Request) -> str | None:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    # fallback: query param (útil pra <video src=... > acessar /media com token)
    return request.query_params.get("token")


def require_user(request: Request) -> User:
    token = _token_from_request(request)
    if not token:
        raise HTTPException(401, "Não autenticado", headers={"WWW-Authenticate": "Bearer"})
    user = session_user(token)
    if not user:
        raise HTTPException(401, "Token inválido", headers={"WWW-Authenticate": "Bearer"})
    return User(**user.model_dump(exclude={"password_hash"}))


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Apenas admin")
    return user