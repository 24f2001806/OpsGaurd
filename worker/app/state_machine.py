
from dataclasses import dataclass
from enum import Enum


class MonitorState(str, Enum):
    UNKNOWN = "UNKNOWN"
    HEALTHY = "HEALTHY"
    SUSPECTED_DOWN = "SUSPECTED_DOWN"
    DOWN = "DOWN"


@dataclass
class StateUpdate:
    previous_state: MonitorState
    current_state: MonitorState
    consecutive_failures: int
    became_down: bool
    recovered: bool


class MonitorStateMachine:
    def __init__(self, failures_before_down: int = 2):
        if failures_before_down < 1:
            raise ValueError("failures_before_down must be at least 1")

        self.failures_before_down = failures_before_down
        self.state = MonitorState.UNKNOWN
        self.consecutive_failures = 0

    def update(self, is_success: bool) -> StateUpdate:
        previous = self.state
        became_down = False
        recovered = False

        if is_success:
            recovered = self.state in (
                MonitorState.SUSPECTED_DOWN,
                MonitorState.DOWN,
            )
            self.state = MonitorState.HEALTHY
            self.consecutive_failures = 0
        else:
            self.consecutive_failures += 1

            if self.consecutive_failures >= self.failures_before_down:
                became_down = self.state != MonitorState.DOWN
                self.state = MonitorState.DOWN
            else:
                self.state = MonitorState.SUSPECTED_DOWN

        return StateUpdate(
            previous_state=previous,
            current_state=self.state,
            consecutive_failures=self.consecutive_failures,
            became_down=became_down,
            recovered=recovered,
        )
