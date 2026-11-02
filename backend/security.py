from hashlib import sha256
from secrets import token_urlsafe
from time import time

from pwdlib import PasswordHash


password_hasher = PasswordHash.recommended()
# Unknown and legacy accounts still perform a password verification.
DUMMY_PASSWORD_HASH = password_hasher.hash(token_urlsafe(32))
SESSION_TTL_SECONDS = 3600


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def token_digest(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def create_session(sessions: dict, user_id: int) -> str:
    # Called under the shared mutation lock. Never retain raw bearer tokens.
    now = time()
    for digest, session in list(sessions.items()):
        if session["expires_at"] <= now:
            del sessions[digest]
    token = token_urlsafe(32)
    sessions[token_digest(token)] = {
        "user_id": user_id,
        "expires_at": now + SESSION_TTL_SECONDS,
    }
    return token
