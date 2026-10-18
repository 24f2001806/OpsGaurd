
import logging
import threading
import time

from app.config import settings
from app.database import initialize_database, save_check_result
from app.checker import check_url
from app.health import run_health_server
from app.redis_client import RedisWorker
from app.scheduler import interval_for_state
from app.state_machine import MonitorStateMachine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("opsguard.worker")


def run_worker():
    redis_worker = RedisWorker(
        redis_url=settings.redis_url,
        queue_name=settings.redis_queue,
    )

    # In-memory states are per monitor and per worker process.
    state_machines = {}

    logger.info("Starting OpsGuard worker: %s", settings.worker_id)

    while True:
        try:
            job = redis_worker.get_job(timeout=5)

            if job is None:
                continue

            if not isinstance(job, dict):
                logger.error("Skipping invalid job: expected JSON object")
                continue

            url = job.get("url")
            monitor_id = job.get("monitor_id")

            if not isinstance(url, str) or not url.startswith(
                ("http://", "https://")
            ):
                logger.error("Skipping job with invalid URL")
                continue

            if monitor_id is None:
                logger.error("Skipping job without monitor_id")
                continue

            monitor_id = str(monitor_id)

            machine = state_machines.setdefault(
                monitor_id,
                MonitorStateMachine(settings.failures_before_down),
            )

            result = check_url(
                url,
                timeout_seconds=settings.request_timeout,
            )
            update = machine.update(result.is_success)

            try:
                save_check_result(
                    monitor_id=monitor_id,
                    url=url,
                    is_success=result.is_success,
                    status_code=result.status_code,
                    response_time_ms=result.response_time_ms,
                    error=result.error,
                    state=update.current_state.value,
                )
            except Exception:
                # Do not silently discard a result if persistence fails.
                logger.exception(
                    "Could not save result for monitor %s",
                    monitor_id,
                )
                # Stop processing so the database issue is visible.
                # A durable retry mechanism can be added during integration.
                time.sleep(2)
                continue

            interval = interval_for_state(
                update.current_state,
                default_interval=settings.default_interval,
                fast_interval=settings.fast_interval,
            )

            logger.info(
                "monitor=%s url=%s success=%s state=%s "
                "status=%s response_ms=%.2f next_interval=%ss",
                monitor_id,
                url,
                result.is_success,
                update.current_state.value,
                result.status_code,
                result.response_time_ms,
                interval,
            )

            if update.became_down:
                logger.warning("Monitor %s entered DOWN state", monitor_id)

            if update.recovered:
                logger.info("Monitor %s recovered", monitor_id)

        except Exception:
            logger.exception("Unexpected worker error")
            time.sleep(2)


if __name__ == "__main__":
    threading.Thread(
        target=run_health_server,
        daemon=True,
        name="worker-health",
    ).start()

    try:
        initialize_database()
        run_worker()
    except KeyboardInterrupt:
        logger.info("Worker shutdown requested")
    except Exception:
        logger.exception("Worker could not start")
        raise
