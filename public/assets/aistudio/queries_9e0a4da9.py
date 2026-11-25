"""Every SQL statement the app runs, in one place.
They are plain MySQL, so each one can be copied into Laravel almost unchanged (DB::select(...))."""
import config

T = "kbt_form2_appln_verified"
# plinth area used for the luxury rule, e.g. "a.`appln_PA_cnstrcted_res` + a.`appln_PA_cnstrcted_other`"
AREA = " + ".join(f"a.`{c}`" for c in config.LUXURY_AREA_COLUMNS)


def like(text):
    """Escape % and _ so the visitor's text is matched literally."""
    return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


# ---------- lookups ----------
def districts(db):
    return db.all("SELECT id, district_name AS name FROM districts WHERE district_state_sl = %s ORDER BY district_name",
                  (config.STATE_SL,))


def taluks_of(db, district_id):
    return db.all("SELECT id, taluk_name AS name FROM taluks WHERE taluk_district_id = %s AND `del` = 0 ORDER BY taluk_name",
                  (district_id,))


def villages_of(db, taluk_id):
    return db.all("SELECT id, vill_name AS name FROM villages WHERE vill_taluksl = %s AND `del` = 0 ORDER BY vill_name",
                  (taluk_id,))


def location_counts(db):
    return {
        "districts": db.scalar("SELECT COUNT(*) FROM districts WHERE district_state_sl = %s", (config.STATE_SL,)),
        "taluks": db.scalar("SELECT COUNT(*) FROM taluks WHERE `del` = 0"),
        "villages": db.scalar("SELECT COUNT(*) FROM villages WHERE `del` = 0"),
    }


# ---------- dashboard: ONE pass over the big table ----------
def dashboard_groups(db):
    return db.all(f"""
        SELECT a.appln_dist AS dist, a.appln_status AS status, a.appln_pointer AS pointer,
               (a.appln_delete <> 0) AS is_deleted, (({AREA}) > %s) AS is_luxury, COUNT(*) AS n
        FROM {T} a
        GROUP BY a.appln_dist, a.appln_status, a.appln_pointer, (a.appln_delete <> 0), (({AREA}) > %s)
    """, (config.LUXURY_THRESHOLD_SQM, config.LUXURY_THRESHOLD_SQM))


# ---------- applications list ----------
def search(db, f, limit, offset):
    where, params = [], []
    if not f["include_deleted"]:
        where.append("a.appln_delete = 0")
    for key, col in (("district", "appln_dist"), ("taluk", "appln_taluk"), ("village", "appln_village"),
                     ("status", "appln_status"), ("pointer", "appln_pointer")):
        if f[key] is not None:
            where.append(f"a.{col} = %s")
            params.append(f[key])
    if f["luxury"]:
        where.append(f"(({AREA}) > %s)")
        params.append(config.LUXURY_THRESHOLD_SQM)
    if f["q"]:
        where.append("(a.appln_no = %s OR a.appln_form2_no = %s OR a.appln_name LIKE %s OR a.appln_survey_no LIKE %s)")
        params += [f["q"], f["q"], like(f["q"]), like(f["q"])]
    sql = f"""
        SELECT a.appln_id, a.appln_no, a.appln_year, a.appln_name, a.appln_status, a.appln_pointer, a.appln_delete,
               ({AREA}) AS area, d.district_name, t.taluk_name, v.vill_name
        FROM {T} a
        LEFT JOIN districts d ON d.id = a.appln_dist
        LEFT JOIN taluks    t ON t.id = a.appln_taluk
        LEFT JOIN villages  v ON v.id = a.appln_village
        {"WHERE " + " AND ".join(where) if where else ""}
        ORDER BY a.appln_id DESC
        LIMIT %s OFFSET %s
    """
    return db.all(sql, params + [limit, offset])


# ---------- one application ----------
def application(db, appln_id):
    return db.one(f"""
        SELECT a.*, ({AREA}) AS luxury_area, d.district_name, t.taluk_name, v.vill_name
        FROM {T} a
        LEFT JOIN districts d ON d.id = a.appln_dist
        LEFT JOIN taluks    t ON t.id = a.appln_taluk
        LEFT JOIN villages  v ON v.id = a.appln_village
        WHERE a.appln_id = %s
    """, (appln_id,))
