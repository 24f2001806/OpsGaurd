
import time
from dataclasses import dataclass
from typing import Optional

import httpx


@dataclass
class CheckResult:
    url: str
    is_success: bool
    status_code: Optional[int]
    response_time_ms: float
    error: Optional[str]


def check_url(
    url: str,
    timeout_seconds: float = 10.0,
) -> CheckResult:
    """Check a website or API and return its monitoring result."""
    start_time = time.perf_counter()

    try:
        response = httpx.get(
            url,
            timeout=timeout_seconds,
            follow_redirects=True,
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return CheckResult(
            url=url,
            is_success=200 <= response.status_code < 400,
            status_code=response.status_code,
            response_time_ms=round(elapsed_ms, 2),
            error=None if response.status_code < 400 else (
                f"HTTP {response.status_code}"
            ),
        )

    except httpx.TimeoutException:
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return CheckResult(
            url=url,
            is_success=False,
            status_code=None,
            response_time_ms=round(elapsed_ms, 2),
            error="Request timed out",
        )

    except httpx.RequestError as exc:
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return CheckResult(
            url=url,
            is_success=False,
            status_code=None,
            response_time_ms=round(elapsed_ms, 2),
            error=str(exc),
        )
