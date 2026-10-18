from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt
from sqlalchemy import select

from app.core.config import settings
from app.models.user import User

PASSWORD = "testpassword123"


def assert_error(r, status):
    assert r.status_code == status, r.text
    assert r.json()["error"]["status"] == status


def make_token(sub, secret=None, minutes=60):
    payload = {"sub": sub, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}
    return jwt.encode(payload, secret or settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ---------------- signup ----------------

def test_signup_success(client):
    r = client.post("/auth/signup", json={"name": "Alice", "email": "Alice@Example.com", "password": PASSWORD})
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "alice@example.com"
    assert body["name"] == "Alice"
    assert "password" not in body and "password_hash" not in body


def test_signup_duplicate_email(client):
    payload = {"name": "Alice", "email": "alice@example.com", "password": PASSWORD}
    assert client.post("/auth/signup", json=payload).status_code == 201
    r = client.post("/auth/signup", json=payload)
    assert_error(r, 409)
    assert r.json()["error"]["message"] == "Email already registered"


def test_signup_duplicate_email_different_case(client):
    client.post("/auth/signup", json={"name": "A", "email": "alice@example.com", "password": PASSWORD})
    r = client.post("/auth/signup", json={"name": "A", "email": "ALICE@example.com", "password": PASSWORD})
    assert_error(r, 409)


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "A", "email": "a@example.com", "password": "short"},
        {"name": "A", "email": "not-an-email", "password": PASSWORD},
        {"name": "", "email": "a@example.com", "password": PASSWORD},
        {"name": "A", "email": "a@example.com", "password": "x" * 73},
        {"name": "A", "email": "a@example.com"},
    ],
)
def test_signup_rejects_invalid_data(client, payload):
    assert_error(client.post("/auth/signup", json=payload), 422)


def test_password_is_stored_hashed(client, db_session):
    client.post("/auth/signup", json={"name": "A", "email": "a@example.com", "password": PASSWORD})
    user = db_session.scalar(select(User).where(User.email == "a@example.com"))
    assert user.password_hash != PASSWORD
    assert user.password_hash.startswith("$2")  # bcrypt hash


# ---------------- login ----------------

def test_login_success(client):
    client.post("/auth/signup", json={"name": "A", "email": "a@example.com", "password": PASSWORD})
    r = client.post("/auth/login", json={"email": "a@example.com", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"
    assert len(r.json()["access_token"]) > 20


def test_login_is_case_insensitive_for_email(client):
    client.post("/auth/signup", json={"name": "A", "email": "a@example.com", "password": PASSWORD})
    r = client.post("/auth/login", json={"email": "A@EXAMPLE.COM", "password": PASSWORD})
    assert r.status_code == 200


def test_login_wrong_password(client):
    client.post("/auth/signup", json={"name": "A", "email": "a@example.com", "password": PASSWORD})
    r = client.post("/auth/login", json={"email": "a@example.com", "password": "wrongpassword"})
    assert_error(r, 401)
    assert r.json()["error"]["message"] == "Incorrect email or password"


def test_login_unknown_email_gives_same_message(client):
    r = client.post("/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert_error(r, 401)
    assert r.json()["error"]["message"] == "Incorrect email or password"


# ---------------- JWT ----------------

def test_me_with_valid_token(client, headers_a):
    r = client.get("/auth/me", headers=headers_a)
    assert r.status_code == 200
    assert r.json()["email"] == "usera@example.com"


def test_me_without_token(client):
    r = client.get("/auth/me")
    assert_error(r, 401)
    assert r.json()["error"]["message"] == "Not authenticated"


def test_me_with_fake_token(client):
    r = client.get("/auth/me", headers={"Authorization": "Bearer faketoken"})
    assert_error(r, 401)


def test_me_with_expired_token(client, headers_a):
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {make_token('1', minutes=-5)}"})
    assert_error(r, 401)


def test_me_with_token_signed_by_wrong_secret(client, headers_a):
    token = make_token("1", secret="a-different-secret")
    assert_error(client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}), 401)


def test_me_with_token_for_nonexistent_user(client):
    token = make_token("999999")
    assert_error(client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}), 401)


def test_me_with_non_numeric_subject(client):
    token = make_token("abc")
    assert_error(client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}), 401)