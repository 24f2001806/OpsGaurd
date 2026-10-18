import os
from pathlib import Path


def _database_url_from_env_file():
    """Read DATABASE_URL from backend/.env so the test driver matches the app's."""
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


# ---- Must happen BEFORE importing anything from "app" ----------------------
_explicit = os.environ.get("TEST_DATABASE_URL")
_from_env = _database_url_from_env_file()
if _explicit:
    TEST_DATABASE_URL = _explicit
elif _from_env:
    # same server, user and driver as the real app, but the TEST database
    TEST_DATABASE_URL = _from_env.rsplit("/", 1)[0] + "/opsguard_test_db"
else:
    TEST_DATABASE_URL = "postgresql://opsguard_user:opsguard_password@localhost:5432/opsguard_test_db"

_db_name = TEST_DATABASE_URL.rsplit("/", 1)[-1]
assert _db_name.startswith("opsguard_test"), (
    f"Refusing to run tests on database '{_db_name}'. "
    "The test database name must start with 'opsguard_test'."
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-used-only-by-pytest")
# -----------------------------------------------------------------------------

from datetime import datetime, timedelta, timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402,F401  (registers all tables)
from app.database.base import Base  # noqa: E402
from app.database.session import SessionLocal, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from app.models import Incident, MonitoredEndpoint, MonitoringResult  # noqa: E402

PASSWORD = "testpassword123"


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Build fresh tables in the TEST database once, remove them at the end."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_tables():
    """Empty every table before each test so tests don't affect each other."""
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    yield


@pytest.fixture(autouse=True)
def enqueued_jobs(monkeypatch):
    """Tests must not need Redis. Record 'enqueued' endpoint ids instead."""
    jobs = []
    monkeypatch.setattr(
        "app.services.queue_service.enqueue_first_check",
        lambda endpoint: jobs.append(endpoint.id),
    )
    return jobs


@pytest.fixture
def client():
    return TestClient(fastapi_app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def register_and_login(client, email, name="Test User"):
    r = client.post("/auth/signup", json={"name": name, "email": email, "password": PASSWORD})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def headers_a(client):
    return register_and_login(client, "usera@example.com", "User A")


@pytest.fixture
def headers_b(client):
    return register_and_login(client, "userb@example.com", "User B")


@pytest.fixture
def create_endpoint(client):
    def _create(headers, name="Demo", url="https://example.com", **extra):
        r = client.post("/endpoints", headers=headers, json={"name": name, "url": url, **extra})
        assert r.status_code == 201, r.text
        return r.json()

    return _create


@pytest.fixture
def seed_history():
    """Insert 30 checks (4 failures in a row) and 1 resolved 4-minute incident."""

    def _seed(db, endpoint_id):
        now = datetime.now(timezone.utc)
        endpoint = db.get(MonitoredEndpoint, endpoint_id)
        endpoint.current_state = "HEALTHY"
        for i in range(30):
            failed = 20 <= i < 24
            db.add(
                MonitoringResult(
                    endpoint_id=endpoint_id,
                    checked_at=now - timedelta(minutes=30 - i),
                    is_success=not failed,
                    status_code=None if failed else 200,
                    response_time_ms=None if failed else 200.0,
                    error="Timeout" if failed else None,
                )
            )
        db.add(
            Incident(
                endpoint_id=endpoint_id,
                started_at=now - timedelta(minutes=10),
                resolved_at=now - timedelta(minutes=6),
                status="RESOLVED",
            )
        )
        db.commit()

    return _seed