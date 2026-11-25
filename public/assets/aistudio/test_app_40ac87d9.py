"""Smoke tests. They use the database in your .env, so run them against a LOCAL copy:
    python -m unittest discover tests -v
"""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import app as kbt  # noqa: E402
import config  # noqa: E402
from db import DB  # noqa: E402


class Pages(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = kbt.app.test_client()
        with DB() as db:
            cls.first_id = db.scalar("SELECT MIN(appln_id) FROM kbt_form2_appln_verified WHERE appln_delete = 0")

    def test_pages_load(self):
        for url in ["/", "/applications", "/applications?luxury=1", "/applications?q=abc&page=2", "/offices"]:
            self.assertEqual(self.c.get(url).status_code, 200, url)

    def test_unknown_pages_404(self):
        self.assertEqual(self.c.get("/does-not-exist").status_code, 404)
        self.assertEqual(self.c.get("/applications/0").status_code, 404)

    def test_detail_hides_personal_data_by_default(self):
        if config.SHOW_PII or not self.first_id:
            self.skipTest("SHOW_PII is on or table is empty")
        html = self.c.get(f"/applications/{self.first_id}").get_data(as_text=True)
        self.assertRegex(html, r"Address</span><span class=\"text-end ms-3\">(hidden|—)<")
        phone = re.search(r"Contact no\.</span><span class=\"text-end ms-3\">([^<]*)<", html).group(1)
        self.assertTrue(phone == "—" or "*" in phone)

    def test_luxury_filter_only_returns_luxury(self):
        html = self.c.get("/applications?luxury=1").get_data(as_text=True)
        areas = [float(a.replace(",", "")) for a in re.findall(r'<span class="tb-lead">([\d,]+\.\d\d)</span>', html)]
        self.assertTrue(all(a > config.LUXURY_THRESHOLD_SQM for a in areas))

    def test_cascading_lookups(self):
        self.assertTrue(self.c.get("/api/taluks?district=1614").get_json())
        self.assertEqual(self.c.get("/api/taluks?district=abc").get_json(), [])

    def test_search_text_is_not_treated_as_sql(self):
        self.assertEqual(self.c.get("/applications?q=%27%20OR%201%3D1%20--%20").status_code, 200)

    def test_connection_is_read_only(self):
        with DB() as db:
            with self.assertRaises(Exception):
                db.all("UPDATE districts SET district_name = district_name WHERE id = -1")


if __name__ == "__main__":
    unittest.main()
