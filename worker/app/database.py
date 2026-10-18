
import psycopg

from app.config import settings


CREATE_RESULTS_TABLE = """
CREATE TABLE IF NOT EXISTS monitoring_results (
    id BIGSERIAL PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    url TEXT NOT NULL,
    is_success BOOLEAN NOT NULL,
    status_code INTEGER,
    response_time_ms DOUBLE PRECISION NOT NULL,
    error TEXT,
    state TEXT NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


def initialize_database() -> None:
    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(CREATE_RESULTS_TABLE)


def save_check_result(
    monitor_id: str,
    url: str,
    is_success: bool,
    status_code: int | None,
    response_time_ms: float,
    error: str | None,
    state: str,
) -> None:
    query = """
        INSERT INTO monitoring_results (
            monitor_id, url, is_success, status_code,
            response_time_ms, error, state
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """

    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (
                    monitor_id,
                    url,
                    is_success,
                    status_code,
                    response_time_ms,
                    error,
                    state,
                ),
            )
