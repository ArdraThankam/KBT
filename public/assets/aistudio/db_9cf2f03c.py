"""Tiny MySQL helper. The web app only ever reads: every connection is opened read-only."""
import pymysql
from pymysql.cursors import DictCursor

import config


class DB:
    """Use as:  with DB() as db:  rows = db.all("SELECT ... WHERE x = %s", (1,))"""

    def __enter__(self):
        c = config.DB
        self.conn = pymysql.connect(
            host=c["host"], port=c["port"], user=c["user"], password=c["password"], database=c["database"],
            charset="utf8mb4", cursorclass=DictCursor, autocommit=True,
            connect_timeout=8, read_timeout=180,
        )
        with self.conn.cursor() as cur:
            cur.execute("SET SESSION TRANSACTION READ ONLY")
        return self

    def __exit__(self, *exc):
        self.conn.close()

    def all(self, sql, params=()):
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())

    def one(self, sql, params=()):
        rows = self.all(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql, params=()):
        row = self.one(sql, params)
        return next(iter(row.values())) if row else None
