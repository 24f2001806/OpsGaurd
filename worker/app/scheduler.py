
from app.state_machine import MonitorState


def interval_for_state(
    state: MonitorState,
    default_interval: int = 60,
    fast_interval: int = 10,
) -> int:
    if default_interval < 1 or fast_interval < 1:
        raise ValueError("Intervals must be positive")

    if state in (
        MonitorState.SUSPECTED_DOWN,
        MonitorState.DOWN,
    ):
        return min(default_interval, fast_interval)

    return default_interval
