import pytest


def assert_error(r, status):
    assert r.status_code == status, r.text
    assert r.json()["error"]["status"] == status


# ---------------- create ----------------

def test_create_endpoint_with_defaults(client, headers_a, enqueued_jobs):
    r = client.post("/endpoints", headers=headers_a, json={"name": "Example", "url": "https://example.com"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Example"
    assert body["url"].startswith("https://example.com")
    assert body["current_state"] == "UNKNOWN"
    assert body["check_interval"] == 60
    assert body["fast_check_interval"] == 10
    assert body["consecutive_failures"] == 0
    assert body["enabled"] is True
    assert enqueued_jobs == [body["id"]]  # first job was queued exactly once


def test_create_endpoint_with_custom_intervals(client, headers_a):
    r = client.post(
        "/endpoints",
        headers=headers_a,
        json={"name": "Api", "url": "https://api.example.com/health", "check_interval": 120, "fast_check_interval": 15},
    )
    assert r.status_code == 201
    assert r.json()["check_interval"] == 120
    assert r.json()["fast_check_interval"] == 15


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "Bad", "url": "not-a-url"},
        {"name": "Bad", "url": "ftp://example.com"},
        {"name": "Bad", "url": "javascript:alert(1)"},
        {"name": "", "url": "https://example.com"},
        {"name": "Bad", "url": "https://example.com", "check_interval": 0},
        {"name": "Bad", "url": "https://example.com", "check_interval": 10, "fast_check_interval": 30},
        {"name": "Bad", "url": "https://example.com", "check_interval": 10, "fast_check_interval": 10},
        {"url": "https://example.com"},
    ],
)
def test_create_rejects_invalid_data(client, headers_a, enqueued_jobs, payload):
    assert_error(client.post("/endpoints", headers=headers_a, json=payload), 422)
    assert enqueued_jobs == []  # nothing queued for a rejected request


# ---------------- list / get ----------------

def test_list_only_returns_my_endpoints(client, headers_a, headers_b, create_endpoint):
    create_endpoint(headers_a, name="A1")
    create_endpoint(headers_a, name="A2")
    create_endpoint(headers_b, name="B1")
    list_a = client.get("/endpoints", headers=headers_a).json()
    list_b = client.get("/endpoints", headers=headers_b).json()
    assert sorted(e["name"] for e in list_a) == ["A1", "A2"]
    assert [e["name"] for e in list_b] == ["B1"]


def test_list_is_empty_for_new_user(client, headers_a):
    assert client.get("/endpoints", headers=headers_a).json() == []


def test_get_one_endpoint(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    r = client.get(f"/endpoints/{ep['id']}", headers=headers_a)
    assert r.status_code == 200
    assert r.json()["id"] == ep["id"]


def test_get_unknown_endpoint_is_404(client, headers_a):
    r = client.get("/endpoints/999999", headers=headers_a)
    assert_error(r, 404)
    assert r.json()["error"]["message"] == "Endpoint not found"


# ---------------- update ----------------

def test_update_changes_only_given_fields(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a, name="Old")
    r = client.put(f"/endpoints/{ep['id']}", headers=headers_a, json={"name": "New"})
    assert r.status_code == 200
    assert r.json()["name"] == "New"
    assert r.json()["check_interval"] == 60
    assert r.json()["url"] == ep["url"]


def test_update_url_and_enabled(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    r = client.put(
        f"/endpoints/{ep['id']}", headers=headers_a, json={"url": "https://other.example.org", "enabled": False}
    )
    assert r.status_code == 200
    assert r.json()["url"].startswith("https://other.example.org")
    assert r.json()["enabled"] is False


@pytest.mark.parametrize("payload", [{"fast_check_interval": 100}, {"check_interval": 5}])
def test_update_breaking_interval_rule_is_400_and_changes_nothing(client, headers_a, create_endpoint, payload):
    ep = create_endpoint(headers_a)  # intervals 60 / 10
    assert_error(client.put(f"/endpoints/{ep['id']}", headers=headers_a, json=payload), 400)
    after = client.get(f"/endpoints/{ep['id']}", headers=headers_a).json()
    assert after["check_interval"] == 60
    assert after["fast_check_interval"] == 10


def test_update_invalid_url_is_422(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    assert_error(client.put(f"/endpoints/{ep['id']}", headers=headers_a, json={"url": "nope"}), 422)


def test_update_unknown_endpoint_is_404(client, headers_a):
    assert_error(client.put("/endpoints/999999", headers=headers_a, json={"name": "X"}), 404)


# ---------------- delete ----------------

def test_delete_endpoint(client, headers_a, create_endpoint):
    ep = create_endpoint(headers_a)
    assert client.delete(f"/endpoints/{ep['id']}", headers=headers_a).status_code == 204
    assert_error(client.get(f"/endpoints/{ep['id']}", headers=headers_a), 404)


def test_delete_unknown_endpoint_is_404(client, headers_a):
    assert_error(client.delete("/endpoints/999999", headers=headers_a), 404)


# ---------------- authorization ----------------

def test_user_b_cannot_touch_user_a_endpoint(client, headers_a, headers_b, create_endpoint):
    ep = create_endpoint(headers_a, name="Private")
    url = f"/endpoints/{ep['id']}"
    assert_error(client.get(url, headers=headers_b), 404)
    assert_error(client.put(url, headers=headers_b, json={"name": "Hacked"}), 404)
    assert_error(client.delete(url, headers=headers_b), 404)
    # and it is still intact for A
    r = client.get(url, headers=headers_a)
    assert r.status_code == 200
    assert r.json()["name"] == "Private"


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/endpoints"),
        ("post", "/endpoints"),
        ("get", "/endpoints/1"),
        ("put", "/endpoints/1"),
        ("delete", "/endpoints/1"),
        ("get", "/endpoints/1/history"),
        ("get", "/endpoints/1/incidents"),
        ("get", "/endpoints/1/alerts"),
        ("put", "/endpoints/1/alerts"),
        ("get", "/incidents"),
        ("get", "/dashboard/summary"),
    ],
)
def test_protected_routes_need_a_token(client, method, path):
    r = client.request(method, path, json={})
    assert_error(r, 401)