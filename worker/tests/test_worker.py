
from unittest.mock import Mock, patch

from app.redis_client import RedisWorker
from app.scheduler import interval_for_state
from app.state_machine import MonitorState


@patch("app.redis_client.redis.Redis.from_url")
def test_push_job(mock_redis):
    fake_client = Mock()
    mock_redis.return_value = fake_client

    worker = RedisWorker("redis://localhost:6379/0", "jobs")
    worker.push_job({"url": "https://example.com"})

    fake_client.rpush.assert_called_once()


@patch("app.redis_client.redis.Redis.from_url")
def test_no_job(mock_redis):
    fake_client = Mock()
    fake_client.blpop.return_value = None
    mock_redis.return_value = fake_client

    worker = RedisWorker("redis://localhost:6379/0", "jobs")

    assert worker.get_job() is None


def test_healthy_monitor_uses_default_interval():
    assert interval_for_state(
        MonitorState.HEALTHY, 60, 10
    ) == 60


def test_down_monitor_uses_fast_interval():
    assert interval_for_state(
        MonitorState.DOWN, 60, 10
    ) == 10
