import json
import os
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class TestMember4Config(unittest.TestCase):
    def test_prometheus_config_exists(self):
        self.assertTrue(
            os.path.exists(os.path.join(ROOT, "monitoring", "prometheus", "prometheus.yml"))
        )

    def test_grafana_dashboard_json(self):
        path = os.path.join(ROOT, "monitoring", "grafana", "dashboards", "opsguard-dashboard.json")
        self.assertTrue(os.path.exists(path))
        with open(path) as f:
            data = json.load(f)
        self.assertIn("panels", data)


if __name__ == "__main__":
    unittest.main()