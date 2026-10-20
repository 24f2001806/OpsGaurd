import json
from datetime import datetime, timezone

import redis

from app.core.config import settings

# Must match the queue name in M2's worker config
QUEUE_NAME = "opsguard:monitoring:jobs"


def enqueue_first_check(endpoint) -> None:
    job = {
        "monitor_id": endpoint.id,   # M2's worker calls the endpoint id "monitor_id"
        "url": endpoint.url,
        "check_type": "initial",
        "scheduled_time": datetime.now(timezone.utc).isoformat(),
    }
    try:
        client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        client.rpush(QUEUE_NAME, json.dumps(job))
    except redis.RedisError as exc:
        # Creating a website must not fail just because Redis is down
        print(f"[queue] could not enqueue job: {exc}")