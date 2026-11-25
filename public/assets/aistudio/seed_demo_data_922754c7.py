"""Fill the LOCAL test database with FAKE applications so you can try the app without real citizen data.

    python tools/seed_demo_data.py --rows 3000

Safety: it only runs against localhost, and asks you to type YES first (or pass --yes).
Needs the districts / taluks / villages tables to be filled already (they hold public place names).
Never run this against a database with real data.
"""
import argparse
import os
import random
import sys
from datetime import date, datetime, timedelta

import pymysql

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import config  # noqa: E402

TABLE = "kbt_form2_appln_verified"
INT_TYPES = {"int", "tinyint", "smallint", "mediumint", "bigint"}
NUM_TYPES = {"float", "double", "decimal"}
TEXT_TYPES = {"varchar", "char", "text", "tinytext", "mediumtext", "longtext"}


def rnd_date(a=2014, b=2025):
    d = date(a, 1, 1) + timedelta(days=random.randint(0, (date(b, 12, 28) - date(a, 1, 1)).days))
    return d.isoformat()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=3000)
    ap.add_argument("--yes", action="store_true", help="skip the confirmation question")
    args = ap.parse_args()
    c = config.DB
    if c["host"] not in ("127.0.0.1", "localhost", "::1"):
        sys.exit(f"Refusing to write fake data to a non-local database ({c['host']}).")
    if not args.yes and input(f"Add {args.rows} FAKE rows to {c['database']} on {c['host']}? Type YES: ").strip() != "YES":
        sys.exit("Cancelled.")

    conn = pymysql.connect(host=c["host"], port=c["port"], user=c["user"], password=c["password"],
                           database=c["database"], charset="utf8mb4", autocommit=False)
    cur = conn.cursor()
    cur.execute("SET SESSION sql_mode = ''")  # the real table uses zero dates

    cur.execute("SELECT COLUMN_NAME, DATA_TYPE, EXTRA FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY ORDINAL_POSITION", (c["database"], TABLE))
    cols = [(n, t.lower()) for n, t, extra in cur.fetchall() if "auto_increment" not in (extra or "")]
    if not cols:
        sys.exit(f"Table {TABLE} not found in {c['database']}.")

    cur.execute("SELECT v.id, v.vill_taluksl, t.taluk_district_id FROM villages v JOIN taluks t ON t.id = v.vill_taluksl")
    places = cur.fetchall()
    if not places:
        sys.exit("The villages and taluks tables are empty - load them first.")

    cur.execute(f"SELECT COALESCE(MAX(appln_id), 0) FROM {TABLE}")
    start = cur.fetchone()[0]

    def blank(dtype):
        if dtype in INT_TYPES or dtype in NUM_TYPES:
            return 0
        if dtype in TEXT_TYPES:
            return ""
        if dtype == "date":
            return "0000-00-00"
        if dtype in ("datetime", "timestamp"):
            return "0000-00-00 00:00:00"
        return None

    rows = []
    for i in range(1, args.rows + 1):
        n = start + i
        vill, taluk, dist = random.choice(places)
        res = round(random.lognormvariate(5, 0.5), 2)
        oth = round(random.uniform(8, 60), 2) if random.random() < 0.3 else 0
        year = random.randint(2014, 2025)
        v = {name: blank(dt) for name, dt in cols}
        v.update({
            "user_id": random.randint(1, 50), "appln_appln_id": n, "vo_repno": random.randint(1, 500), "vo_rep_year": year,
            "vo_curdate": rnd_date(year, year), "appln_file_sl": n, "appln_no": str(random.randint(1, 9999)), "appln_year": year,
            "appln_name": f"Test Applicant {n:06d}", "appln_addr": f"Test House {n}, Demo Road",
            "appln_contactno": f"90000{n % 100000:05d}", "appln_mailid": f"test{n}@example.com",
            "appln_survey_no": f"{random.randint(1, 900)}/{random.randint(1, 20)}", "appln_block_no": str(random.randint(1, 60)),
            "appln_dist": dist, "appln_taluk": taluk, "appln_village": vill,
            "appln_compltn_dt": rnd_date(year - 2, year), "appln_occupation_dt": rnd_date(year - 1, year),
            "appln_PA_approved_res": res, "appln_PA_cnstrcted_res": round(res * random.uniform(0.95, 1.1), 2),
            "appln_PA_recommended_res": res, "appln_PA_approved_other": oth, "appln_PA_cnstrcted_other": oth,
            "appln_PA_recommended_other": oth, "appln_PA_aprvd": res + oth, "appln_PA_cnstrcted": res + oth,
            "appln_tax_lump": random.choice([0, 0, 0, random.randint(5, 80) * 1000]),
            "appln_status": random.choices([1, 2, 3, 4], [10, 25, 50, 15])[0],
            "appln_pointer": random.choices([1, 2, 3, 4, 5], [30, 25, 20, 15, 10])[0],
            "appln_delete": 1 if random.random() < 0.03 else 0, "appln_noof_floors": random.randint(1, 3),
            "appln_form2_no": f"F2/{year}/{n}", "appln_form2_date": rnd_date(year, year),
            "appln_form2_submited_yesno": 1, "appln_createdon": f"{rnd_date(year, year)} 10:00:00",
            "appln_remarks": "Demo data", "comments": "",
        })
        if "created_at" in v:
            v["created_at"] = None
            v["updated_at"] = None
            v["created_by"] = None
            v["updated_by"] = None
        rows.append([v[name] for name, _ in cols])

    names = ", ".join(f"`{n}`" for n, _ in cols)
    marks = ", ".join(["%s"] * len(cols))
    for s in range(0, len(rows), 500):
        cur.executemany(f"INSERT INTO {TABLE} ({names}) VALUES ({marks})", rows[s:s + 500])
    conn.commit()
    print(f"Added {len(rows)} fake applications to {c['database']}.")


if __name__ == "__main__":
    main()
