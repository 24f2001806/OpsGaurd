import json
import redis
from typing import Optional


class RedisWorker:
    def __init__(self, redis_url: str, queue_name: str):
        self.queue_name = queue_name
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
        Helper used during testing.
        """

        self.client.rpush(
            self.queue_name,
            json.dumps(job),
        )