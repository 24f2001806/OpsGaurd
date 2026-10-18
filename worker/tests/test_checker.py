from unittest.mock import MagicMock, patch

from app.database import record_check


@patch("app.database.psycopg.connect")
def test_record_check_saves_result_state_and_incident(mock_connect):
    connection = MagicMock()
    cursor = MagicMock()

    mock_connect.return_value.__enter__.return_value = connection
    connection.cursor.return_value.__enter__.return_value = cursor

    record_check(
        endpoint_id=1,
        is_success=False,
        status_code=None,
        response_time_ms=10000.0,
        error="Request timed out",
        state="DOWN",
        consecutive_failures=2,
        became_down=True,
        recovered=False,
    )

    queries = [call.args[0] for call in cursor.execute.call_args_list]
    assert "INSERT INTO monitoring_results" in queries[0]
    assert "UPDATE monitored_endpoints" in queries[1]
    assert "INSERT INTO incidents" in queries[2]
    # the result row: endpoint_id is a number, and there is no url or state
    assert cursor.execute.call_args_list[0].args[1] == (
        1, False, None, 10000.0, "Request timed out",
    )


@patch("app.database.psycopg.connect")
def test_record_check_resolves_incident_on_recovery(mock_connect):
    connection = MagicMock()
    cursor = MagicMock()

    mock_connect.return_value.__enter__.return_value = connection
    connection.cursor.return_value.__enter__.return_value = cursor

    record_check(
        endpoint_id=1,
        is_success=True,
        status_code=200,
        response_time_ms=120.0,
        error=None,
        state="HEALTHY",
        consecutive_failures=0,
        became_down=False,
        recovered=True,
    )

    queries = [call.args[0] for call in cursor.execute.call_args_list]
    assert any("SET resolved_at" in q for q in queries)
    assert not any("INSERT INTO incidents" in q for q in queries)