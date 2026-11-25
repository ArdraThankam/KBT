# Building Tax (KBT) viewer – Python + MySQL

The Smart Office design from your demo, now running on real tables from your MySQL database.
Pages: **Overview** (dashboard), **Applications** (search and filters), **Application detail**.
Every other menu link opens a "not built yet" placeholder.

## Run it (Windows)

1. Install Python 3.10+ from python.org (tick "Add to PATH").
2. In this folder, open a terminal and run:

   ```
   py -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   copy .env.example .env
   ```

   If PowerShell blocks `activate`, first run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned`
3. Open `.env` in a text editor and set `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` for your **local** MySQL.
4. Start it: `python app.py`, then open http://127.0.0.1:8000

No data in your local database yet? Load the small `districts`, `taluks`, `villages` dumps in MySQL Workbench, then run
`python tools/seed_demo_data.py --rows 3000` to add **fake** applications (it refuses to run on anything but localhost).

## Safety

- **Read-only:** every connection is opened read-only; the app has no code that writes.
- **Local only:** it listens on 127.0.0.1, so only your own computer can open it. There is **no login yet**,
  so do not put it on a network or server as it is.
- **Personal data:** the table holds citizens' details. By default the screen shows the name, a masked phone number
  (`90******01`) and a masked email, and hides addresses. `SHOW_PII=true` in `.env` turns that off.
- For the live database, use a read-only MySQL user (`sql/002_readonly_user.sql`) and keep `.env` private.

## What is assumed (please confirm; each is one setting)

| Assumption | Where to change it |
|---|---|
| Luxury = plinth area above **300 sq m** | `LUXURY_THRESHOLD_SQM` in `.env` |
| Area = `appln_PA_cnstrcted_res` + `appln_PA_cnstrcted_other` (the detail page shows all area columns) | `LUXURY_AREA_COLUMNS` in `.env` |
| `appln_delete = 0` means an active application; `1` in the `*_yesno` columns means Yes | `queries.py`, `app.py` |
| Kerala districts have `district_state_sl = 16` | `STATE_SL` in `.env` |
| Codes (`appln_status`, `appln_pointer`) show as "Status 3", "Stage 2" until named | `labels.json` |

Dates stored as `0000-00-00` show as "—".

## Files

```
app.py          pages and routes          queries.py   every SQL statement (the part to port to Laravel)
config.py       settings from .env        labels.json  names for status / stage codes
db.py           read-only connection      menu.json    left icon bar and sidebar
templates/      Jinja pages               static/      the demo's CSS / JS / images
sql/            optional indexes, read-only user       tests/   python -m unittest discover tests
```

## Speed

The table has no indexes on district, taluk or status, so the dashboard reads all ~675,000 rows once
(then caches the result for 5 minutes; `/?refresh=1` forces a refresh). `sql/001_recommended_indexes.sql`
adds indexes; try it on your local copy first. The list uses Previous/Next with no total count, to stay fast.

## Moving to Laravel later

- `queries.py` -> `DB::select(...)` or the query builder (same SQL). Put the primary key `appln_id` and table name in the model.
- `templates/*.html` (Jinja) -> Blade: `{% extends %}` -> `@extends`, `{% block %}` -> `@section`, `{{ x }}` -> `{{ $x }}`,
  `{% for %}` -> `@foreach`. The HTML and CSS classes stay the same.
- `labels.json`, `menu.json`, the luxury settings -> a `config/kbt.php` file.
- Dates of `0000-00-00` and NOT NULL columns without defaults: select explicit columns for reads, and turn off strict mode
  or supply every column for writes.
