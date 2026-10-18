
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    redis_url: str = os.getenv(
        "REDIS_URL", "redis://localhost:6379/0"
    )
    redis_queue: str = os.getenv(
        "REDIS_QUEUE", "opsguard:monitoring:jobs"
    )
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/opsguard",
    )
    worker_id: str = os.getenv("WORKER_ID", "worker-1")
    health_host: str = os.getenv("HEALTH_HOST", "0.0.0.0")
    health_port: int = int(os.getenv("HEALTH_PORT", "8081"))
    request_timeout: float = float(
        os.getenv("REQUEST_TIMEOUT_SECONDS", "10")
    )
    default_interval: int = int(
        os.getenv("DEFAULT_CHECK_INTERVAL_SECONDS", "60")
    )
    fast_interval: int = int(
        os.getenv("FAST_CHECK_INTERVAL_SECONDS", "10")
    )
    failures_before_down: int = int(
        os.getenv("FAILURES_BEFORE_DOWN", "2")
    )


settings = Settings()
