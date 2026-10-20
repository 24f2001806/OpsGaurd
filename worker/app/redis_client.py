import json
import time
from typing import Optional

import redis


class RedisWorker:
    def __init__(self, redis_url: str, queue_name: str):
        self.queue_name = queue_name
        # Jobs waiting for their time live in a sorted set (score = due time)
        self.scheduled_key = f"{queue_name}:scheduled"
        self.client = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
        )

    def get_job(self, timeout: int = 5) -> Optional[dict]:
        """
        Wait for a monitoring job.
        Returns None if no job arrives.
        """

        result = self.client.blpop(
            self.queue_name,
            timeout=timeout,
        )

        if result is None:
            return None

        _, job_json = result
        return json.loads(job_json)

    def push_job(self, job: dict):
        """
        Put a job in the queue right now.
        """

        self.client.rpush(
            self.queue_name,
            json.dumps(job),
        )

    def schedule_job(self, job: dict, delay_seconds: float) -> None:
        """Put a job in the queue after `delay_seconds`."""
        due_at = time.time() + delay_seconds
        self.client.zadd(self.scheduled_key, {json.dumps(job): due_at})

    def promote_due_jobs(self, limit: int = 100) -> int:
        """Move jobs whose time has come into the real queue.
        Returns how many were moved."""
        due = self.client.zrangebyscore(
            self.scheduled_key, "-inf", time.time(), start=0, num=limit
        )
        moved = 0
        for member in due:
            # zrem returns 1 only for the worker that removed it, so even with
            # several workers a job is never queued twice.
            if self.client.zrem(self.scheduled_key, member):
                self.client.rpush(self.queue_name, member)
                moved += 1
        return moved