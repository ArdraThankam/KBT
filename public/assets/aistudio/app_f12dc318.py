"""Building Tax (KBT) application viewer - Flask + MySQL.

Run:  python app.py      then open http://127.0.0.1:8000
"""
import re
import time
from datetime import datetime
from urllib.parse import urlencode

import pymysql
from flask import Flask, abort, jsonify, render_template, request, send_from_directory, url_for

import config
import queries
from db import DB

app = Flask(__name__, static_folder="static", template_folder="templates")
PAGE_SIZE = 25


# ------------------------------------------------------------------ helpers
def asset(path):
    """url for a file in static/, keeping any ?ver=... query string."""
    base, _, query = path.partition("?")
    return url_for("static", filename=base) + ("?" + query if query else "")


LABEL_PREFIX = {"status": "Status", "pointer": "Stage", "nature": "Nature"}


def label(kind, code):
    """Readable name for a numeric code (see labels.json); falls back to 'Status 3' / 'Stage 2'."""
    name = config.LABELS.get(kind, {}).get(str(code))
    if name:
        return name
    return f"{LABEL_PREFIX.get(kind, kind.title())} {code}"


def fmt_int(v):
    return "—" if v is None else f"{int(v):,}"


def fmt_area(v):
    return "—" if v is None else f"{float(v):,.2f}"


def fmt_money(v):
    return "—" if v is None else f"₹ {float(v):,.2f}"


def fmt_date(v):
    """MySQL zero dates ('0000-00-00') come back as text; show them as a dash."""
    if not v or str(v).startswith("0000"):
        return "—"
    return v.strftime("%d %b %Y") if hasattr(v, "strftime") else str(v)


def fmt_yesno(v):
    return {1: "Yes", 0: "No"}.get(v, "—" if v is None else str(v))


def fmt_text(v):
    return "—" if v is None or str(v).strip() == "" else str(v)


def mask_phone(v):
    v = (v or "").strip()
    return "—" if not v else (v if config.SHOW_PII else v[:2] + "*" * max(len(v) - 4, 0) + v[-2:])


def mask_email(v):
    v = (v or "").strip()
    if not v:
        return "—"
    if config.SHOW_PII or "@" not in v:
        return v if config.SHOW_PII else "hidden"
    name, domain = v.split("@", 1)
    return name[:1] + "***@" + domain


def hide(v):
    return fmt_text(v) if config.SHOW_PII else ("hidden" if (v or "").strip() else "—")


def to_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


_cache = {}


def cached(key, ttl, fn, refresh=False):
    hit = _cache.get(key)
    if hit and not refresh and time.monotonic() - hit[0] < ttl:
        return hit[1]
    value = fn()
    _cache[key] = (time.monotonic(), value)
    return value


@app.context_processor
def inject():
    return {"site": config.SITE, "user": config.USER, "menu": config.MENU, "asset": asset, "label": label,
            "fmt_int": fmt_int, "fmt_area": fmt_area, "fmt_date": fmt_date,
            "threshold": config.LUXURY_THRESHOLD_SQM}


# ------------------------------------------------------------------ dashboard
def build_overview():
    with DB() as db:
        groups = queries.dashboard_groups(db)
        names = {r["id"]: r["name"] for r in queries.districts(db)}
        loc = queries.location_counts(db)
    total = sum(g["n"] for g in groups)
    active = [g for g in groups if not g["is_deleted"]]
    n_active = sum(g["n"] for g in active)
    n_lux = sum(g["n"] for g in active if g["is_luxury"])

    def bucket(key):
        out = {}
        for g in active:
            out[g[key]] = out.get(g[key], 0) + g["n"]
        return out

    def rows(counter, namer):
        return [{"code": k, "name": namer(k), "n": n, "pct": (100 * n / n_active) if n_active else 0}
                for k, n in sorted(counter.items(), key=lambda kv: -kv[1])]

    by_dist = {}
    for g in active:
        d = by_dist.setdefault(g["dist"], {"n": 0, "lux": 0})
        d["n"] += g["n"]
        d["lux"] += g["n"] if g["is_luxury"] else 0
    districts = [{"code": k, "name": names.get(k, f"District {k} (not in list)"), "n": v["n"], "lux": v["lux"],
                  "pct": (100 * v["n"] / n_active) if n_active else 0}
                 for k, v in sorted(by_dist.items(), key=lambda kv: -kv[1]["n"])]
    return {
        "total": total, "active": n_active, "deleted": total - n_active, "luxury": n_lux, "other": n_active - n_lux,
        "districts": districts,
        "statuses": rows(bucket("status"), lambda c: label("status", c)),
        "pointers": rows(bucket("pointer"), lambda c: label("pointer", c)),
        "loc": loc, "generated": datetime.now(),
    }


@app.route("/")
def overview():
    ov = cached("overview", 300, build_overview, refresh=request.args.get("refresh") == "1")
    return render_template("dashboard.html", ov=ov)


# ------------------------------------------------------------------ applications list
def read_filters():
    a = request.args
    return {
        "district": to_int(a.get("district")), "taluk": to_int(a.get("taluk")), "village": to_int(a.get("village")),
        "status": to_int(a.get("status")), "pointer": to_int(a.get("pointer")),
        "luxury": a.get("luxury") == "1", "include_deleted": a.get("deleted") == "1",
        "q": (a.get("q") or "").strip()[:60],
    }


@app.route("/applications")
def applications():
    f = read_filters()
    page = max(to_int(request.args.get("page")) or 1, 1)
    note = None
    if f["q"] and len(f["q"]) < 3:
        note, f["q"] = "Type at least 3 characters to search.", ""
    with DB() as db:
        rows = queries.search(db, f, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE)
        districts = queries.districts(db)
        taluks = queries.taluks_of(db, f["district"]) if f["district"] else []
        villages = queries.villages_of(db, f["taluk"]) if f["taluk"] else []
    has_next = len(rows) > PAGE_SIZE
    rows = rows[:PAGE_SIZE]

    ov = cached("overview", 300, build_overview)  # reuse the dashboard numbers for the dropdowns
    statuses = sorted({r["code"] for r in ov["statuses"]} | {int(k) for k in config.LABELS.get("status", {}) if k.isdigit()})
    pointers = sorted({r["code"] for r in ov["pointers"]} | {int(k) for k in config.LABELS.get("pointer", {}) if k.isdigit()})

    keep = {k: v for k, v in request.args.items() if k != "page" and v}

    def page_url(p):
        return url_for("applications") + "?" + urlencode({**keep, "page": p})

    return render_template("applications.html", rows=rows, f=f, page=page, note=note,
                           prev_url=page_url(page - 1) if page > 1 else None,
                           next_url=page_url(page + 1) if has_next else None,
                           districts=districts, taluks=taluks, villages=villages,
                           statuses=statuses, pointers=pointers, offset=(page - 1) * PAGE_SIZE)


# ------------------------------------------------------------------ one application
def detail_sections(a):
    area = a["luxury_area"] or 0
    PA = lambda key: fmt_area(a[key])  # noqa: E731
    return [
        {"title": "Application", "rows": [
            ("Application no. / year", f"{fmt_text(a['appln_no'])} / {a['appln_year']}"),
            ("Form 2 no.", fmt_text(a["appln_form2_no"])), ("Form 2 date", fmt_date(a["appln_form2_date"])),
            ("Form 2 submitted", fmt_yesno(a["appln_form2_submited_yesno"])),
            ("Building permit no.", fmt_text(a["appln_building_permit_no"])),
            ("Status", label("status", a["appln_status"])), ("Stage (pointer)", label("pointer", a["appln_pointer"])),
            ("Assessment order status", fmt_text(a["appln_assess_order_status"])),
            ("Demand notice status", fmt_text(a["appln_demand_notice_status"])),
            ("Appeal status", fmt_text(a["appln_appeal_status"])),
            ("Created on", fmt_date(a["appln_createdon"])), ("Closed on", fmt_date(a["close_on"]))]},
        {"title": "Applicant", "rows": [
            ("Name", fmt_text(a["appln_name"])), ("Contact no.", mask_phone(a["appln_contactno"])),
            ("Email", mask_email(a["appln_mailid"])), ("Address", hide(a["appln_addr"])),
            ("Communication address", hide(a["appln_communication_addr"])),
            ("Different owners", fmt_yesno(a["appln_diff_owner_yesno"]))]},
        {"title": "Location", "rows": [
            ("District", fmt_text(a["district_name"])), ("Taluk", fmt_text(a["taluk_name"])),
            ("Village", fmt_text(a["vill_name"])), ("Survey no.", fmt_text(a["appln_survey_no"])),
            ("Block no.", fmt_text(a["appln_block_no"])), ("Sub division", fmt_text(a["appln_sub_dvsn"])),
            ("Thandaperu no.", fmt_text(a["appln_thandapperu_no"])), ("Land type (code)", fmt_text(a["appln_landtype"])),
            ("LSG type (code)", fmt_text(a["appln_lsgtype"])), ("Floors", fmt_text(a["appln_noof_floors"])),
            ("Flat", fmt_yesno(a["appln_flat_yesno"]))]},
        {"title": "Tax and payment", "rows": [
            ("Tax exempt", fmt_yesno(a["appln_tax_exempt_yesno"])), ("Reduced rate", fmt_yesno(a["appln_reduced_rate_yesno"])),
            ("Lump sum tax", fmt_money(a["appln_tax_lump"])), ("Solar", fmt_yesno(a["appln_solar"])),
            ("Exemption misuse", fmt_yesno(a["appln_tax_excemption_misuse"])),
            ("Previously paid", fmt_yesno(a["appln_prev_paid"])), ("Previous amount", fmt_money(a["prev_paid_amount"])),
            ("Previous payment date", fmt_date(a["prev_paid_date"])), ("Previous file no.", fmt_text(a["prev_paid_filenumber"]))]},
        {"title": "Dates", "rows": [
            ("Completion", fmt_date(a["appln_compltn_dt"])), ("Occupation", fmt_date(a["appln_occupation_dt"]))]},
        {"title": "Remarks", "rows": [
            ("Remarks", fmt_text(a["appln_remarks"])), ("Comments", fmt_text(a["comments"])),
            ("Description", fmt_text(a["appln_description"]))]},
    ], {
        "table": [("Approved", PA("appln_PA_approved_res"), PA("appln_PA_approved_other")),
                  ("Constructed", PA("appln_PA_cnstrcted_res"), PA("appln_PA_cnstrcted_other")),
                  ("Recommended", PA("appln_PA_recommended_res"), PA("appln_PA_recommended_other"))],
        "totals": [("Approved (stored total)", PA("appln_PA_aprvd")), ("Constructed (stored total)", PA("appln_PA_cnstrcted"))],
        "luxury_area": fmt_area(area), "is_luxury": area > config.LUXURY_THRESHOLD_SQM,
    }


@app.route("/applications/<int:appln_id>")
def application(appln_id):
    with DB() as db:
        a = queries.application(db, appln_id)
    if not a:
        abort(404)
    sections, plinth = detail_sections(a)
    return render_template("application_detail.html", a=a, sections=sections, plinth=plinth,
                           luxury_columns=", ".join(config.LUXURY_AREA_COLUMNS))


# ------------------------------------------------------------------ small JSON endpoints for the filters
@app.route("/api/taluks")
def api_taluks():
    d = to_int(request.args.get("district"))
    with DB() as db:
        return jsonify(queries.taluks_of(db, d) if d else [])


@app.route("/api/villages")
def api_villages():
    t = to_int(request.args.get("taluk"))
    with DB() as db:
        return jsonify(queries.villages_of(db, t) if t else [])


# ------------------------------------------------------------------ placeholders for menu links not built yet
def _known_slugs():
    slugs = {it["href"].strip("/") for it in config.MENU["apps"] if it.get("href")}
    header = (config.BASE_DIR / "templates/partials/header.html").read_text(encoding="utf-8")
    slugs |= set(re.findall(r'href="/([a-z0-9][a-z0-9-]*)"', header))
    return slugs - {"", "applications"}


SLUGS = _known_slugs()


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "favicon.ico")


@app.route("/<slug>")
def placeholder(slug):
    if slug not in SLUGS:
        abort(404)
    return render_template("stub.html", title=slug.replace("-", " ").title())


# ------------------------------------------------------------------ errors
@app.errorhandler(404)
def not_found(_e):
    return render_template("error.html", title="Page not found", message="That page doesn't exist."), 404


@app.errorhandler(pymysql.MySQLError)
def db_error(e):
    app.logger.error("Database error: %s", e)
    return render_template("error.html", title="Can't reach the database",
                           message="Check the DB_* values in your .env file and that MySQL is running.",
                           detail=str(e)), 503


if __name__ == "__main__":
    print(f"Open http://{config.APP_HOST}:{config.APP_PORT}   (Ctrl+C to stop)")
    app.run(host=config.APP_HOST, port=config.APP_PORT, debug=config.APP_DEBUG)
