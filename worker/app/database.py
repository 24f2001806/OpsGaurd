import psycopg
from psycopg.rows import dict_row

from app.config import settings

# NOTE: the backend (FastAPI) creates all tables. The worker only reads and
# writes rows, so there is no CREATE TABLE here.

GET_ENDPOINT = """
    SELECT id, url, check_interval, fast_check_interval, enabled,
           current_state, consecutive_failures
    FROM monitored_endpoints
    WHERE id = %s
"""

INSERT_RESULT = """
    INSERT INTO monitoring_results (
        endpoint_id, is_success, status_code, response_time_ms, error
    )
    VALUES (%s, %s, %s, %s, %s)
"""

UPDATE_ENDPOINT_STATE = """
    UPDATE monitored_endpoints
    SET current_state = %s,
        consecutive_failures = %s,
        last_check_at = NOW(),
        last_success_at = CASE WHEN %s THEN NOW() ELSE last_success_at END,
        last_failure_at = CASE WHEN %s THEN last_failure_at ELSE NOW() END
    WHERE id = %s
"""

OPEN_INCIDENT = """
    INSERT INTO incidents (endpoint_id, status)
    SELECT %s, 'OPEN'
    WHERE NOT EXISTS (
        SELECT 1 FROM incidents WHERE endpoint_id = %s AND status = 'OPEN'
    )
"""

RESOLVE_INCIDENTS = """
    UPDATE incidents
    SET resolved_at = NOW(), status = 'RESOLVED'
    WHERE endpoint_id = %s AND status = 'OPEN'
"""


def get_endpoint(endpoint_id: int) -> dict | None:
    """Read one website's settings and last known state. None if it was deleted."""
    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(GET_ENDPOINT, (endpoint_id,))
            return cursor.fetchone()


def record_check(
    endpoint_id: int,
    is_success: bool,
    status_code: int | None,
    response_time_ms: float | None,
    error: str | None,
    state: str,
    consecutive_failures: int,
    became_down: bool,
    recovered: bool,
) -> None:
    """Save everything about one check in ONE transaction:
    the result row, the website's new state, and its incident (if any).
    Either all of it is saved, or none of it."""
    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                INSERT_RESULT,
                (endpoint_id, is_success, status_code, response_time_ms, error),
            )
            cursor.execute(
                UPDATE_ENDPOINT_STATE,
                (state, consecutive_failures, is_success, is_success, endpoint_id),
            )
            if became_down:
                cursor.execute(OPEN_INCIDENT, (endpoint_id, endpoint_id))
            if recovered:
                cursor.execute(RESOLVE_INCIDENTS, (endpoint_id,))