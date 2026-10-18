import pytest
from sqlalchemy import func, inspect, select
from sqlalchemy.exc import IntegrityError

from app.database.session import engine
from app.models import (
    AlertConfiguration,
    Incident,
    MonitoredEndpoint,
    MonitoringResult,
    User,
)


def count(db, model):
    return db.scalar(select(func.count()).select_from(model))


def make_user(db, email="db@example.com"):
    user = User(name="DB User", email=email, password_hash="not-a-real-hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_endpoint(db, user_id):
    ep = MonitoredEndpoint(user_id=user_id, name="Site", url="https://example.com/")
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep


def test_all_five_tables_exist():
    tables = set(inspect(engine).get_table_names())
    assert {"users", "monitored_endpoints", "monitoring_results", "incidents", "alert_configurations"} <= tables


def test_endpoint_default_values(db_session):
    ep = make_endpoint(db_session, make_user(db_session).id)
    assert ep.current_state == "UNKNOWN"
    assert ep.check_interval == 60
    assert ep.fast_check_interval == 10
    assert ep.consecutive_failures == 0
    assert ep.enabled is True
    assert ep.last_check_at is None
    assert ep.created_at is not None


def test_incident_default_status_is_open(db_session):
    ep = make_endpoint(db_session, make_user(db_session).id)
    incident = Incident(endpoint_id=ep.id)
    db_session.add(incident)
    db_session.commit()
    db_session.refresh(incident)
    assert incident.status == "OPEN"
    assert incident.started_at is not None
    assert incident.resolved_at is None


def test_duplicate_email_is_rejected_by_database(db_session):
    make_user(db_session, "same@example.com")
    db_session.add(User(name="Other", email="same@example.com", password_hash="x"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_only_one_alert_config_per_endpoint(db_session):
    ep = make_endpoint(db_session, make_user(db_session).id)
    db_session.add(AlertConfiguration(endpoint_id=ep.id))
    db_session.commit()
    db_session.add(AlertConfiguration(endpoint_id=ep.id))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_endpoint_needs_an_existing_user(db_session):
    db_session.add(MonitoredEndpoint(user_id=999999, name="Orphan", url="https://example.com/"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_deleting_user_cascades_to_everything(db_session):
    user = make_user(db_session)
    ep = make_endpoint(db_session, user.id)
    db_session.add_all(
        [
            MonitoringResult(endpoint_id=ep.id, is_success=True, status_code=200, response_time_ms=100.0),
            Incident(endpoint_id=ep.id),
            AlertConfiguration(endpoint_id=ep.id),
        ]
    )
    db_session.commit()
    assert count(db_session, MonitoringResult) == 1

    db_session.delete(user)
    db_session.commit()

    assert count(db_session, User) == 0
    assert count(db_session, MonitoredEndpoint) == 0
    assert count(db_session, MonitoringResult) == 0
    assert count(db_session, Incident) == 0
    assert count(db_session, AlertConfiguration) == 0


def test_deleting_endpoint_via_api_removes_its_history_and_alerts(
    client, headers_a, create_endpoint, db_session, seed_history
):
    ep = create_endpoint(headers_a)
    seed_history(db_session, ep["id"])
    client.get(f"/endpoints/{ep['id']}/alerts", headers=headers_a)  # creates the alert config row
    assert count(db_session, MonitoringResult) == 30
    assert count(db_session, AlertConfiguration) == 1

    assert client.delete(f"/endpoints/{ep['id']}", headers=headers_a).status_code == 204

    assert count(db_session, MonitoringResult) == 0
    assert count(db_session, Incident) == 0
    assert count(db_session, AlertConfiguration) == 0