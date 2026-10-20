import json
from unittest.mock import MagicMock, patch

from app import main
from app.checker import CheckResult
from app.redis_client import RedisWorker


def endpoint(**overrides):
    row = {
        "id": 7,
        "url": "https://example.com",
        "check_interval": 60,
        "fast_check_interval": 10,
        "enabled": True,
        "current_state": "UNKNOWN",
        "consecutive_failures": 0,
    }
    row.update(overrides)
    return row


def ok():
    return CheckResult("https://example.com", True, 200, 120.0, None)


def fail():
    return CheckResult("https://example.com", False, None, 10000.0, "Request timed out")


def run(job, row, result):
    redis_worker = MagicMock()
    with patch("app.main.get_endpoint", return_value=row), \
         patch("app.main.check_url", return_value=result), \
         patch("app.main.record_check") as record:
        main.process_job(job, redis_worker)
    return redis_worker, record


def test_healthy_check_is_saved_and_next_check_uses_normal_interval():
    redis_worker, record = run({"monitor_id": 7}, endpoint(), ok())

    kwargs = record.call_args.kwargs
    assert kwargs["endpoint_id"] == 7
    assert kwargs["state"] == "HEALTHY"
    assert kwargs["became_down"] is False

    next_job, delay = redis_worker.schedule_job.call_args.args
    assert delay == 60
    assert next_job["monitor_id"] == 7


def test_first_failure_is_suspected_down_and_checked_faster():
    redis_worker, record = run({"monitor_id": 7}, endpoint(current_state="HEALTHY"), fail())

    assert record.call_args.kwargs["state"] == "SUSPECTED_DOWN"
    assert record.call_args.kwargs["became_down"] is False
    assert redis_worker.schedule_job.call_args.args[1] == 10


def test_second_failure_marks_down_and_opens_incident():
    row = endpoint(current_state="SUSPECTED_DOWN", consecutive_failures=1)
    redis_worker, record = run({"monitor_id": 7}, row, fail())

    kwargs = record.call_args.kwargs
    assert kwargs["state"] == "DOWN"
    assert kwargs["consecutive_failures"] == 2
    assert kwargs["became_down"] is True


def test_already_down_does_not_open_a_second_incident():
    row = endpoint(current_state="DOWN", consecutive_failures=5)
    _, record = run({"monitor_id": 7}, row, fail())

    assert record.call_args.kwargs["became_down"] is False


def test_success_after_down_is_recovery():
    row = endpoint(current_state="DOWN", consecutive_failures=3)
    redis_worker, record = run({"monitor_id": 7}, row, ok())

    assert record.call_args.kwargs["state"] == "HEALTHY"
    assert record.call_args.kwargs["recovered"] is True
    assert redis_worker.schedule_job.call_args.args[1] == 60


def test_uses_the_websites_own_intervals():
    row = endpoint(check_interval=300, fast_check_interval=30)
    redis_worker, _ = run({"monitor_id": 7}, row, ok())
    assert redis_worker.schedule_job.call_args.args[1] == 300


def test_deleted_website_job_is_dropped():
    redis_worker, record = run({"monitor_id": 7}, None, ok())
    record.assert_not_called()
    redis_worker.schedule_job.assert_not_called()


def test_paused_website_job_is_dropped():
    redis_worker, record = run({"monitor_id": 7}, endpoint(enabled=False), ok())
    record.assert_not_called()
    redis_worker.schedule_job.assert_not_called()


def test_job_without_a_numeric_monitor_id_is_skipped():
    for bad in ({}, {"monitor_id": "abc"}, {"monitor_id": None}):
        redis_worker, record = run(bad, endpoint(), ok())
        record.assert_not_called()
        redis_worker.schedule_job.assert_not_called()


def test_next_check_is_still_scheduled_if_saving_fails():
    redis_worker = MagicMock()
    with patch("app.main.get_endpoint", return_value=endpoint()), \
         patch("app.main.check_url", return_value=ok()), \
         patch("app.main.record_check", side_effect=RuntimeError("db down")):
        main.process_job({"monitor_id": 7}, redis_worker)

    redis_worker.schedule_job.assert_called_once()


@patch("app.redis_client.redis.Redis.from_url")
def test_schedule_job_puts_job_in_sorted_set(mock_redis):
    client = MagicMock()
    mock_redis.return_value = client

    worker = RedisWorker("redis://localhost:6379/0", "jobs")
    worker.schedule_job({"monitor_id": 7}, 30)

    key, mapping = client.zadd.call_args.args
    assert key == "jobs:scheduled"
    assert json.loads(next(iter(mapping))) == {"monitor_id": 7}


@patch("app.redis_client.redis.Redis.from_url")
def test_promote_due_jobs_moves_each_job_once(mock_redis):
    client = MagicMock()
    client.zrangebyscore.return_value = ["a", "b"]
    client.zrem.side_effect = [1, 0]  # another worker already took "b"
    mock_redis.return_value = client

    worker = RedisWorker("redis://localhost:6379/0", "jobs")
    assert worker.promote_due_jobs() == 1
    client.rpush.assert_called_once_with("jobs", "a")