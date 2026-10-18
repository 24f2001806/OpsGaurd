
from unittest.mock import MagicMock, patch

from app.database import save_check_result


@patch("app.database.psycopg.connect")
def test_save_check_result_executes_insert(mock_connect):
    connection = MagicMock()
    cursor = MagicMock()

    mock_connect.return_value.__enter__.return_value = connection
    connection.cursor.return_value.__enter__.return_value = cursor

    save_check_result(
        monitor_id="monitor-1",
        url="https://example.com",
        is_success=True,
        status_code=200,
        response_time_ms=123.4,
        error=None,
        state="HEALTHY",
    )

    cursor.execute.assert_called_once()
    assert "INSERT INTO monitoring_results" in (
        cursor.execute.call_args.args[0]
    )
