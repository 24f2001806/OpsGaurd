from datetime import datetime

from app.models import Incident, MonitoredEndpoint


def assert_error(r, status):
    assert r.status_code == status, r.text
    assert r.json()["error"]["status"] == status


def parse(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


# ---------------- history ----------------

def test_history_is_newest_first(client, headers_a, create_endpoint, db_session, seed_history):
    ep = create_endpoint(headers_a)
    seed_history(db_session, ep["id"])
    r = client.get(f"/endpoints/{ep['id']}/history", headers=headers_a)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 30
    times = [parse(x["checked_at"]) for x in rows]
    assert times == sorted(times, reverse=True)


def test_history_failed_rows_have_error_and_no_response_time(client, headers_a, create_endpoint, db_session, seed_history):
    ep = create_endpoint(headers_a)
    seed_history(db_session, ep["id"])
    rows = client.get(f"/endpoints/{ep['id']}/history", headers=headers_a).json()
    failed = [x for x in rows if not x["is_success"]]
    assert len(failed) == 4
    assert all(x["error"] == "Timeout" and x["response_time_ms"] is None for x in failed)
    ok = [x for x in rows if x["is_success"]]
    assert all(x["status_code"] == 200 and x["response_time_ms"] == 200.0 for x in ok)


def test_history_limit(client, headers_a, create_endpoint, db_session, seed_history):
    ep = create_endpoint(headers_a)
    seed_history(db_session, ep["id"])
    r = client.get(f"/endpoints/{ep['id']}/history?limit=5", headers=headers_a)
    assert len(r.json()) == 5


def test_history_limit_out_of_range_is_422(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    assert_error(client.get(f"/endpoints/{ep['id']}/history?limit=0", headers=headers_a), 422)
    assert_error(client.get(f"/endpoints/{ep['id']}/history?limit=1001", headers=headers_a), 422)


def test_history_empty_for_new_endpoint(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    assert client.get(f"/endpoints/{ep['id']}/history", headers=headers_a).json() == []


def test_history_of_another_users_endpoint_is_404(client, headers_a, headers_b, create_endpoint):
    ep = create_endpoint(headers_a)
    assert_error(client.get(f"/endpoints/{ep['id']}/history", headers=headers_b), 404)


# ---------------- incidents ----------------

def test_endpoint_incidents(client, headers_a, create_endpoint, db_session, seed_history):
    ep = create_endpoint(headers_a, name="Demo")
    seed_history(db_session, ep["id"])
    r = client.get(f"/endpoints/{ep['id']}/incidents", headers=headers_a)
    assert r.status_code == 200
    assert len(r.json()) == 1
    inc = r.json()[0]
    assert inc["status"] == "RESOLVED"
    assert inc["duration_seconds"] == 240
    assert inc["endpoint_name"] == "Demo"


def test_all_incidents_and_status_filter(client, headers_a, create_endpoint, db_session, seed_history):
    ep = create_endpoint(headers_a)
    seed_history(db_session, ep["id"])
    assert len(client.get("/incidents", headers=headers_a).json()) == 1
    assert client.get("/incidents?status=OPEN", headers=headers_a).json() == []
    assert len(client.get("/incidents?status=resolved", headers=headers_a).json()) == 1


def test_open_incident_has_no_duration(client, headers_a, create_endpoint, db_session):
    ep = create_endpoint(headers_a)
    db_session.add(Incident(endpoint_id=ep["id"], status="OPEN"))
    db_session.commit()
    inc = client.get("/incidents?status=OPEN", headers=headers_a).json()[0]
    assert inc["resolved_at"] is None
    assert inc["duration_seconds"] is None


def test_incidents_are_private_to_their_owner(client, headers_a, headers_b, create_endpoint, db_session, seed_history):
    ep = create_endpoint(headers_a)
    seed_history(db_session, ep["id"])
    assert client.get("/incidents", headers=headers_b).json() == []
    assert_error(client.get(f"/endpoints/{ep['id']}/incidents", headers=headers_b), 404)


# ---------------- dashboard summary ----------------

def test_dashboard_summary_values(client, headers_a, create_endpoint, db_session, seed_history):
    ep = create_endpoint(headers_a)
    seed_history(db_session, ep["id"])
    s = client.get("/dashboard/summary", headers=headers_a).json()
    assert s["total_monitored"] == 1
    assert s["healthy"] == 1
    assert s["down"] == 0
    assert s["total_incidents"] == 1
    assert s["active_incidents"] == 0
    assert s["overall_uptime_percent"] == 86.67  # 26 of 30 checks succeeded
    assert s["average_response_time_ms"] == 200.0


def test_dashboard_counts_down_endpoint_and_active_incident(client, headers_a, create_endpoint, db_session):
    ep = create_endpoint(headers_a)
    db_session.get(MonitoredEndpoint, ep["id"]).current_state = "DOWN"
    db_session.add(Incident(endpoint_id=ep["id"], status="OPEN"))
    db_session.commit()
    s = client.get("/dashboard/summary", headers=headers_a).json()
    assert s["down"] == 1
    assert s["healthy"] == 0
    assert s["active_incidents"] == 1


def test_dashboard_summary_for_new_user_is_empty(client, headers_a):
    s = client.get("/dashboard/summary", headers=headers_a).json()
    assert s["total_monitored"] == 0
    assert s["total_incidents"] == 0
    assert s["overall_uptime_percent"] is None
    assert s["average_response_time_ms"] is None


def test_dashboard_summary_ignores_other_users_data(client, headers_a, headers_b, create_endpoint, db_session, seed_history):
    ep = create_endpoint(headers_a)
    seed_history(db_session, ep["id"])
    s = client.get("/dashboard/summary", headers=headers_b).json()
    assert s["total_monitored"] == 0
    assert s["overall_uptime_percent"] is None


# ---------------- alert settings ----------------

def test_alert_defaults_are_all_off(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    r = client.get(f"/endpoints/{ep['id']}/alerts", headers=headers_a)
    assert r.status_code == 200
    assert r.json()["email_enabled"] is False
    assert r.json()["slack_enabled"] is False
    assert r.json()["email_address"] is None


def test_alert_settings_are_saved(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    url = f"/endpoints/{ep['id']}/alerts"
    r = client.put(url, headers=headers_a, json={"email_enabled": True, "email_address": "me@example.com"})
    assert r.status_code == 200
    saved = client.get(url, headers=headers_a).json()
    assert saved["email_enabled"] is True
    assert saved["email_address"] == "me@example.com"


def test_alert_slack_webhook_is_saved(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    url = f"/endpoints/{ep['id']}/alerts"
    hook = "https://hooks.slack.com/services/T000/B000/XXXX"
    assert client.put(url, headers=headers_a, json={"slack_enabled": True, "slack_webhook": hook}).status_code == 200
    saved = client.get(url, headers=headers_a).json()
    assert saved["slack_enabled"] is True
    assert saved["slack_webhook"].startswith("https://hooks.slack.com/services/")


def test_alert_disabling_clears_the_value(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    url = f"/endpoints/{ep['id']}/alerts"
    client.put(url, headers=headers_a, json={"email_enabled": True, "email_address": "me@example.com"})
    client.put(url, headers=headers_a, json={"email_enabled": False})
    assert client.get(url, headers=headers_a).json()["email_address"] is None


def test_alert_slack_enabled_without_webhook_is_422(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    r = client.put(f"/endpoints/{ep['id']}/alerts", headers=headers_a, json={"slack_enabled": True})
    assert_error(r, 422)


def test_alert_email_enabled_without_address_is_422(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    r = client.put(f"/endpoints/{ep['id']}/alerts", headers=headers_a, json={"email_enabled": True})
    assert_error(r, 422)


def test_alert_invalid_email_is_422(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    r = client.put(
        f"/endpoints/{ep['id']}/alerts", headers=headers_a, json={"email_enabled": True, "email_address": "nope"}
    )
    assert_error(r, 422)


def test_alert_settings_of_another_user_are_404(client, headers_a, headers_b, create_endpoint):
    ep = create_endpoint(headers_a)
    assert_error(client.get(f"/endpoints/{ep['id']}/alerts", headers=headers_b), 404)
    assert_error(client.put(f"/endpoints/{ep['id']}/alerts", headers=headers_b, json={}), 404)