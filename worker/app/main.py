from app.alerts import notify_endpoint
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from app.checker import check_url
from app.config import settings
from app.database import get_endpoint, record_check
from app.health import run_health_server
from app.redis_client import RedisWorker
from app.scheduler import interval_for_state
from app.state_machine import MonitorState, MonitorStateMachine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("opsguard.worker")


def build_next_job(monitor_id: int, url: str, delay_seconds: float) -> dict:
    due = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
    return {
        "monitor_id": monitor_id,
        "url": url,
        "check_type": "scheduled",
        "scheduled_time": due.isoformat(),
    }


def process_job(job: dict, redis_worker: RedisWorker) -> None:
    """Handle one monitoring job: check the website, save everything,
    and schedule the next check."""
    if not isinstance(job, dict):
        logger.error("Skipping invalid job: expected JSON object")
        return

    # monitor_id in the job is the website's id (endpoint_id in the database)
    try:
        monitor_id = int(job.get("monitor_id"))
    except (TypeError, ValueError):
        logger.error("Skipping job: monitor_id must be a number")
        return

    # Always use the website's CURRENT settings from the database, so edits,
    # pausing and deleting take effect straight away.
    endpoint = get_endpoint(monitor_id)
    if endpoint is None:
        logger.info("Monitor %s no longer exists, dropping job", monitor_id)
        return
    if not endpoint["enabled"]:
        logger.info("Monitor %s is paused, dropping job", monitor_id)
        return

    url = endpoint["url"]
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        logger.error("Monitor %s has an invalid URL, dropping job", monitor_id)
        return

    # Rebuild the state machine from the database, so the worker can be
    # restarted (or run several times) without forgetting anything.
    machine = MonitorStateMachine(settings.failures_before_down)
    try:
        machine.state = MonitorState(endpoint["current_state"])
    except ValueError:
        machine.state = MonitorState.UNKNOWN
    machine.consecutive_failures = endpoint["consecutive_failures"] or 0

    result = check_url(url, timeout_seconds=settings.request_timeout)
    update = machine.update(result.is_success)

    interval = interval_for_state(
        update.current_state,
        default_interval=endpoint["check_interval"],
        fast_interval=endpoint["fast_check_interval"],
    )

    try:
        record_check(
            endpoint_id=monitor_id,
            is_success=result.is_success,
            status_code=result.status_code,
            response_time_ms=result.response_time_ms,
            error=result.error,
            state=update.current_state.value,
            consecutive_failures=update.consecutive_failures,
            became_down=update.became_down,
            recovered=update.recovered,
        )
    except Exception:
        logger.exception("Could not save result for monitor %s", monitor_id)

    # Always schedule the next check, even if saving failed, so the
    # monitoring of this website never silently stops.
    redis_worker.schedule_job(build_next_job(monitor_id, url, interval), interval)

    logger.info(
        "monitor=%s url=%s success=%s state=%s status=%s response_ms=%.2f next_in=%ss",
        monitor_id,
        url,
        result.is_success,
        update.current_state.value,
        result.status_code,
        result.response_time_ms,
        interval,
    )

        # Notify only when the endpoint changes state.
    if update.became_down:
        logger.warning("Monitor %s entered DOWN state", monitor_id)
        notify_endpoint(
            endpoint_id=monitor_id,
            url=url,
            event="DOWN",
        )

    if update.recovered:
        logger.info("Monitor %s recovered", monitor_id)
        notify_endpoint(
            endpoint_id=monitor_id,
            url=url,
            event="RECOVERED",
        )

def run_scheduler(redis_worker: RedisWorker) -> None:
    """Every second, move jobs whose time has come into the queue."""
    while True:
        try:
            redis_worker.promote_due_jobs()
        except Exception:
            logger.exception("Could not move scheduled jobs")
        time.sleep(1)


def run_worker() -> None:
    redis_worker = RedisWorker(
        redis_url=settings.redis_url,
        queue_name=settings.redis_queue,
    )

    threading.Thread(
        target=run_scheduler,
        args=(redis_worker,),
        daemon=True,
        name="worker-scheduler",
    ).start()

    logger.info("Starting OpsGuard worker: %s", settings.worker_id)

    while True:
        try:
            job = redis_worker.get_job(timeout=5)
            if job is None:
                continue
            process_job(job, redis_worker)
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
        run_worker()
    except KeyboardInterrupt:
        logger.info("Worker shutdown requested")
    except Exception:
        logger.exception("Worker could not start")
        raise