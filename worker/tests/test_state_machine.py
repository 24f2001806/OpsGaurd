
from app.state_machine import MonitorState, MonitorStateMachine


def test_initial_state_is_unknown():
    machine = MonitorStateMachine()
    assert machine.state == MonitorState.UNKNOWN


def test_first_failure_is_suspected_down():
    machine = MonitorStateMachine()

    update = machine.update(False)

    assert update.current_state == MonitorState.SUSPECTED_DOWN
    assert update.became_down is False


def test_second_failure_marks_down():
    machine = MonitorStateMachine()

    machine.update(False)
    update = machine.update(False)

    assert update.current_state == MonitorState.DOWN
    assert update.became_down is True


def test_success_marks_healthy():
    machine = MonitorStateMachine()

    update = machine.update(True)

    assert update.current_state == MonitorState.HEALTHY
    assert update.consecutive_failures == 0


def test_success_after_down_is_recovery():
    machine = MonitorStateMachine()
    machine.update(False)
    machine.update(False)

    update = machine.update(True)

    assert update.current_state == MonitorState.HEALTHY
    assert update.recovered is True
    assert update.consecutive_failures == 0
