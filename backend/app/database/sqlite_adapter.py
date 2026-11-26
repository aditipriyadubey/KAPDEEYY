"""PostgREST-compatible SQLite adapter for local-first mode.

Mirrors the async interface of `app.database.supabase_rest.UserDB` so existing
route handlers work unchanged, while every query is scoped by the authenticated
user_id (replacing PostgREST Row Level Security for local mode).

Connection lifecycle
--------------------
One connection per database file is shared by the whole process and every
statement is serialised with a re-entrant lock. Opening a connection per request
(and never closing it) leaked connections that kept a write transaction open,
which made SQLite answer later requests with "database is locked" and surfaced
in the browser as "Network Error" / "can't reach the server". Schema creation
and migrations also used to run on every request; they now run exactly once.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import Settings

_USER_SCOPED_TABLES = {
    "profiles", "wardrobe_items", "outfits", "outfit_items",
    "saved_outfits", "outfit_feedback", "outfit_wear_history",
}

# One connection per absolute database path, plus a process-wide lock so two
# requests can never interleave a transaction on the same connection.
_CONNECTIONS: dict[str, sqlite3.Connection] = {}
_CONNECTIONS_LOCK = threading.RLock()
_DB_LOCK = threading.RLock()
_INITIALISED: set[str] = set()

# Only these tables define the timestamp columns. Adding `created_at` to every
# insert (the previous behaviour) made outfit_items / saved_outfits /
# outfit_feedback / outfit_wear_history fail with "no column named created_at",
# which broke registering, saving and marking outfits as worn.
_CREATED_AT_TABLES = {"users", "profiles", "wardrobe_items", "outfits"}
_UPDATED_AT_TABLES = {"profiles", "wardrobe_items"}

# Column definitions shared by the initial CREATE and the CHECK-constraint
# rebuild so the two can never drift apart.
_WARDROBE_ITEM_COLUMNS_DDL = """
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_name TEXT NOT NULL CHECK (LENGTH(item_name) BETWEEN 1 AND 80),
        category TEXT NOT NULL CHECK (category IN ('Tops','Bottoms','Dresses','Outerwear','Shoes','Bags','Other')),
        subcategory TEXT, colour TEXT,
        colour_hex TEXT CHECK (
            colour_hex IS NULL OR (
                LENGTH(colour_hex) = 7
                AND SUBSTR(colour_hex, 1, 1) = '#'
                AND SUBSTR(colour_hex, 2) NOT GLOB '*[^0-9A-Fa-f]*'
            )
        ),
        pattern TEXT, style TEXT,
        suggested_occasions TEXT NOT NULL DEFAULT '[]' CHECK (JSON_VALID(suggested_occasions)),
        season TEXT CHECK (season IN ('Spring','Summer','Autumn','Winter','All-season') OR season IS NULL),
        original_image_path TEXT,
        segmented_image_path TEXT,
        segmentation_status TEXT NOT NULL DEFAULT 'pending' CHECK (segmentation_status IN ('pending','completed','failed','manual')),
        created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
        updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
        times_worn INTEGER NOT NULL DEFAULT 0
"""

_WARDROBE_ITEM_COLUMNS = (
    "id", "user_id", "item_name", "category", "subcategory", "colour",
    "colour_hex", "pattern", "style", "suggested_occasions", "season",
    "original_image_path", "segmented_image_path", "segmentation_status",
    "created_at", "updated_at", "times_worn",
)


def _shared_connection(db_path: Path) -> sqlite3.Connection:
    """Open (or reuse) the single connection for this database file."""
    key = str(db_path.resolve())
    with _CONNECTIONS_LOCK:
        conn = _CONNECTIONS.get(key)
        if conn is None:
            db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(str(db_path), timeout=30, check_same_thread=False)
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA busy_timeout = 30000")
            # WAL is a persistent database property; set it once, not per request.
            conn.execute("PRAGMA journal_mode = WAL")
            conn.row_factory = sqlite3.Row
            _CONNECTIONS[key] = conn
        return conn


class SQLiteUserDB:
    """A PostgREST-compatible async database client backed by local SQLite."""

    def __init__(self, db_path: Path | str, user_id: str, settings: Settings) -> None:
        self._db_path = Path(db_path)
        self._user_id = user_id
        self._settings = settings
        self._key = str(self._db_path.resolve())
        self._conn = _shared_connection(self._db_path)
        self._initialise()

    def _c(self) -> sqlite3.Connection:
        return self._conn

    def _initialise(self) -> None:
        with _DB_LOCK:
            if self._key in _INITIALISED:
                return
            try:
                self._init_schema()
                self._ensure_schema_upgrades()
                self._conn.commit()
            except Exception:
                # Never leave a half-applied transaction behind.
                self._conn.rollback()
                raise
            _INITIALISED.add(self._key)

    def _init_schema(self) -> None:
        script = f"""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
            );
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

            CREATE TABLE IF NOT EXISTS wardrobe_items ({_WARDROBE_ITEM_COLUMNS_DDL});
            CREATE INDEX IF NOT EXISTS idx_wardrobe_user_category ON wardrobe_items(user_id, category);

            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                full_name TEXT NOT NULL DEFAULT '' CHECK (LENGTH(full_name) <= 100),
                email TEXT,
                created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
                updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
            );

            CREATE TABLE IF NOT EXISTS outfits (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                outfit_name TEXT NOT NULL CHECK (LENGTH(outfit_name) BETWEEN 1 AND 120),
                occasion TEXT CHECK (occasion IN ('College','Casual','Dinner','Party') OR occasion IS NULL),
                recommendation_score REAL,
                styling_explanation TEXT,
                combo_key TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
                UNIQUE (user_id, combo_key),
                UNIQUE (id, user_id)
            );

            CREATE TABLE IF NOT EXISTS outfit_items (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT '',
                outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
                wardrobe_item_id TEXT NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
                UNIQUE (outfit_id, wardrobe_item_id)
            );

            CREATE TABLE IF NOT EXISTS saved_outfits (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                outfit_id TEXT NOT NULL,
                saved_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
                UNIQUE (user_id, outfit_id)
            );

            CREATE TABLE IF NOT EXISTS outfit_feedback (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                outfit_id TEXT NOT NULL,
                feedback_type TEXT,
                UNIQUE (user_id, outfit_id, feedback_type)
            );

            CREATE TABLE IF NOT EXISTS outfit_wear_history (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                outfit_id TEXT NOT NULL,
                worn_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
                worn_on TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d', 'NOW')),
                occasion TEXT,
                UNIQUE (user_id, outfit_id, worn_on)
            );

            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
            );
            """
        self._c().executescript(script)

    # -- migrations --------------------------------------------------

    def _table_exists(self, table: str) -> bool:
        row = self._c().execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
        return row is not None

    def _table_sql(self, table: str) -> str:
        row = self._c().execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
        return (row[0] or "") if row else ""

    def _record_migration(self, name: str) -> None:
        self._c().execute(
            "INSERT OR IGNORE INTO schema_migrations (name) VALUES (?)", (name,)
        )

    def _ensure_schema_upgrades(self) -> None:
        self._c().commit()
        self._fix_colour_hex_constraint()
        self._add_outfit_items_user_id()
        self._add_missing_columns()
        self._backfill_identifiers()

    def _fix_colour_hex_constraint(self) -> None:
        """Rebuild wardrobe_items when it has the broken `{6}` GLOB check.

        SQLite's GLOB operator has no `{n}` repetition, so the original
        constraint compared against the literal text `{6}` and rejected every
        valid colour (the /add page's default `#E8D8C4` included). A CHECK
        constraint cannot be altered in place, so this follows SQLite's
        documented table rebuild and copies every existing row across.
        """
        sql = self._table_sql("wardrobe_items")
        if "{6}" not in sql:
            return

        existing = {
            row[1] for row in self._c().execute("PRAGMA table_info(wardrobe_items)")
        }
        columns = [c for c in _WARDROBE_ITEM_COLUMNS if c in existing]
        column_list = ", ".join(f'"{c}"' for c in columns)
        select_list = ", ".join(
            'COALESCE("created_at", STRFTIME(\'%Y-%m-%dT%H:%M:%fZ\', \'NOW\'))'
            if c == "created_at"
            else 'COALESCE("updated_at", STRFTIME(\'%Y-%m-%dT%H:%M:%fZ\', \'NOW\'))'
            if c == "updated_at"
            else f'"{c}"'
            for c in columns
        )

        # PRAGMA foreign_keys is a no-op inside a transaction, so commit first.
        self._c().commit()
        self._c().execute("PRAGMA foreign_keys = OFF")
        try:
            self._c().executescript(
                f"""
                BEGIN;
                CREATE TABLE wardrobe_items_rebuild ({_WARDROBE_ITEM_COLUMNS_DDL});
                INSERT INTO wardrobe_items_rebuild ({column_list})
                    SELECT {select_list} FROM wardrobe_items;
                DROP TABLE wardrobe_items;
                ALTER TABLE wardrobe_items_rebuild RENAME TO wardrobe_items;
                CREATE INDEX IF NOT EXISTS idx_wardrobe_user_category
                    ON wardrobe_items(user_id, category);
                COMMIT;
                """
            )
            self._c().execute(
                "INSERT OR IGNORE INTO schema_migrations (name) VALUES ('fix_colour_hex_check')"
            )
            self._c().commit()
        except Exception:
            self._c().rollback()
            raise
        finally:
            self._c().execute("PRAGMA foreign_keys = ON")

    def _add_outfit_items_user_id(self) -> None:
        """Add outfit_items.user_id and backfill it from the owning outfit.

        The column was missing, so outfit_items could not be scoped per user.
        Rows are kept and attributed to the outfit's owner; unowned legacy rows
        are left blank rather than deleted.
        """
        if not self._table_exists("outfit_items"):
            return
        columns = {
            row[1] for row in self._c().execute("PRAGMA table_info(outfit_items)")
        }
        if "user_id" not in columns:
            self._c().execute(
                "ALTER TABLE outfit_items ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"
            )
        self._c().execute(
            """
            UPDATE outfit_items
            SET user_id = COALESCE(
                (SELECT outfits.user_id FROM outfits WHERE outfits.id = outfit_items.outfit_id),
                ''
            )
            WHERE user_id IS NULL OR user_id = ''
            """
        )
        self._c().execute(
            "CREATE INDEX IF NOT EXISTS idx_outfit_items_user ON outfit_items(user_id)"
        )
        self._record_migration("outfit_items_user_id")

    def _add_missing_columns(self) -> None:
        def add(table: str, col_def: str) -> None:
            if not self._table_exists(table):
                return
            try:
                self._c().execute(f"ALTER TABLE {table} ADD COLUMN {col_def}")
            except sqlite3.OperationalError:
                pass

        add("wardrobe_items", "times_worn INTEGER NOT NULL DEFAULT 0")
        add("profiles", "updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))")
        add("users", "user_id TEXT NOT NULL DEFAULT ''")
        # Older local databases predate these columns. SQLite cannot add a
        # column with a non-constant DEFAULT, so add it nullable and backfill.
        add("users", "created_at TEXT")
        add("profiles", "user_id TEXT NOT NULL DEFAULT ''")

    def _backfill_identifiers(self) -> None:
        now = self._now()
        self._c().execute(
            "UPDATE users SET created_at = ? WHERE created_at IS NULL", (now,)
        )
        # Legacy rows could be inserted without a primary key (SQLite allows a
        # NULL TEXT PRIMARY KEY), which makes login impossible because the JWT
        # subject would be empty. Give each existing account a stable id and
        # keep its data instead of deleting it.
        rows = self._c().execute("SELECT rowid FROM users WHERE id IS NULL").fetchall()
        for (rowid,) in rows:
            self._c().execute(
                "UPDATE users SET id = ? WHERE rowid = ?", (str(uuid.uuid4()), rowid)
            )
        self._c().execute(
            "UPDATE profiles SET user_id = id WHERE user_id IS NULL OR user_id = ''"
        )
        self._c().execute(
            "UPDATE users SET user_id = id WHERE user_id IS NULL OR user_id = ''"
        )

    # -- helpers -----------------------------------------------------

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    @staticmethod
    def _parse_filter(value: str) -> tuple[str, Any]:
        if value.startswith("eq."):
            return "eq", value[3:]
        if value.startswith("in.(") and value.endswith(")"):
            inner = value[4:-1]
            return "in", [v.strip().strip('"') for v in inner.split(",") if v.strip()]
        if value.startswith("like."):
            return "like", value[5:]
        if value.startswith("ilike."):
            return "ilike", value[6:]
        return "eq", value

    @staticmethod
    def _order_clause(order: str | None) -> str:
        if not order:
            return ""
        parts = []
        for token in order.split(","):
            token = token.strip()
            if not token:
                continue
            direction, col = "ASC", token
            if token.endswith(".desc"):
                col, direction = token[:-5], "DESC"
            elif token.endswith(".asc"):
                col, direction = token[:-4], "ASC"
            if col and all(c.isalnum() or c == "_" for c in col):
                parts.append(f'"{col}" {direction}')
        return f" ORDER BY {', '.join(parts)}" if parts else ""

    def _scope_where(self, table: str) -> tuple[str, list[Any]]:
        if table in ("users", "profiles"):
            return '"id" = ?', [self._user_id]
        if table in _USER_SCOPED_TABLES:
            return '"user_id" = ?', [self._user_id]
        return "1=1", []

    def _build_where(self, table: str, params: dict[str, str], scoped: bool = True) -> tuple[str, list[Any]]:
        parts: list[str] = []
        bind: list[Any] = []
        if scoped:
            scope_sql, scope_bind = self._scope_where(table)
            parts.append(scope_sql)
            bind.extend(scope_bind)
        for key, raw in params.items():
            if key in {"select", "order", "limit", "offset"} or raw is None:
                continue
            op, value = self._parse_filter(str(raw))
            col = f'"{key}"'
            if op == "eq":
                parts.append(f"{col} = ?")
                bind.append(value)
            elif op == "in":
                if not value:
                    parts.append("0=1")
                else:
                    parts.append(f"{col} IN ({', '.join(['?'] * len(value))})")
                    bind.extend(value)
            elif op == "like":
                parts.append(f"{col} LIKE ?")
                bind.append(value)
            elif op == "ilike":
                parts.append(f"LOWER({col}) LIKE LOWER(?)")
                bind.append(value)
        return (" WHERE " + " AND ".join(parts)) if parts else "", bind

    async def select_unscoped(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        """Select without ownership scoping. Used only for auth lookups by email."""
        with _DB_LOCK:
            cur = self._c().cursor()
            cols = params.get("select") or "*"
            where_sql, bind = self._build_where(table, params, scoped=False)
            sql = f'SELECT {cols} FROM "{table}"{where_sql}'
            limit = params.get("limit")
            if limit is not None:
                try:
                    sql += f" LIMIT {int(limit)}"
                except (TypeError, ValueError):
                    pass
            cur.execute(sql, bind)
            names = [d[0] for d in cur.description] if cur.description else []
            return [self._normalize(table, dict(zip(names, r))) for r in cur.fetchall()]

    @staticmethod
    def _normalize(table: str, row: dict[str, Any]) -> dict[str, Any]:
        if table == "wardrobe_items":
            occ = row.get("suggested_occasions")
            if isinstance(occ, str):
                try:
                    row["suggested_occasions"] = json.loads(occ)
                except Exception:
                    row["suggested_occasions"] = []
            elif occ is None:
                row["suggested_occasions"] = []
            if row.get("times_worn") is None:
                row["times_worn"] = 0
        return row

    def _prepare(self, table: str, values: dict[str, Any], insert: bool) -> dict[str, Any]:
        out = dict(values)
        now = self._now()
        if insert and not out.get("id"):
            out["id"] = str(uuid.uuid4())
        if insert and table in _USER_SCOPED_TABLES:
            out.setdefault("user_id", self._user_id)
        if insert and table == "profiles":
            out.setdefault("id", self._user_id)
        if insert and table == "users":
            out.setdefault("user_id", out.get("id", self._user_id))
        if table == "wardrobe_items" and "suggested_occasions" in out:
            occ = out["suggested_occasions"]
            if isinstance(occ, (list, tuple)):
                out["suggested_occasions"] = json.dumps(list(occ))
        if insert:
            if table in _CREATED_AT_TABLES:
                out.setdefault("created_at", now)
            if table in _UPDATED_AT_TABLES:
                out.setdefault("updated_at", now)
            if table == "saved_outfits":
                # The original table declares saved_at NOT NULL without a default.
                out.setdefault("saved_at", now)
        elif table in _UPDATED_AT_TABLES:
            out["updated_at"] = now
        return out

    # -- PostgREST-compatible async API ------------------------------

    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        with _DB_LOCK:
            cur = self._c().cursor()
            cols = params.get("select") or "*"
            where_sql, bind = self._build_where(table, params)
            sql = f'SELECT {cols} FROM "{table}"{where_sql}{self._order_clause(params.get("order"))}'
            limit = params.get("limit")
            if limit is not None:
                try:
                    sql += f" LIMIT {int(limit)}"
                except (TypeError, ValueError):
                    pass
            cur.execute(sql, bind)
            names = [d[0] for d in cur.description] if cur.description else []
            return [self._normalize(table, dict(zip(names, r))) for r in cur.fetchall()]

    async def insert(self, table: str, values: dict[str, Any]) -> list[dict[str, Any]]:
        with _DB_LOCK:
            conn = self._c()
            cur = conn.cursor()
            row = self._prepare(table, values, insert=True)
            cols = ", ".join(f'"{c}"' for c in row)
            marks = ", ".join(["?"] * len(row))
            try:
                cur.execute(f'INSERT INTO "{table}" ({cols}) VALUES ({marks})', list(row.values()))
                conn.commit()
            except Exception:
                # Leaving the implicit transaction open would hold the write lock
                # for every other request (the old "database is locked" failure).
                conn.rollback()
                raise
            if row.get("id") is not None:
                cur.execute(f'SELECT * FROM "{table}" WHERE "id" = ?', [row["id"]])
                names = [d[0] for d in cur.description] if cur.description else []
                fetched = cur.fetchall()
                if fetched:
                    return [self._normalize(table, dict(zip(names, fetched[0])))]
            return [self._normalize(table, row)]

    async def update(self, table: str, params: dict[str, str], values: dict[str, Any]) -> list[dict[str, Any]]:
        with _DB_LOCK:
            conn = self._c()
            cur = conn.cursor()
            row = self._prepare(table, values, insert=False)
            if not row:
                return []
            where_sql, bind = self._build_where(table, params)
            try:
                cur.execute(f'SELECT id FROM "{table}"{where_sql}', bind)
                ids = [r[0] for r in cur.fetchall()]
                if not ids:
                    return []
                sets = ", ".join(f'"{c}" = ?' for c in row)
                cur.execute(f'UPDATE "{table}" SET {sets}{where_sql}', list(row.values()) + bind)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            marks = ", ".join(["?"] * len(ids))
            cur.execute(f'SELECT * FROM "{table}" WHERE "id" IN ({marks})', ids)
            names = [d[0] for d in cur.description] if cur.description else []
            return [self._normalize(table, dict(zip(names, r))) for r in cur.fetchall()]

    async def delete(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        with _DB_LOCK:
            conn = self._c()
            cur = conn.cursor()
            where_sql, bind = self._build_where(table, params)
            try:
                cur.execute(f'SELECT * FROM "{table}"{where_sql}', bind)
                names = [d[0] for d in cur.description] if cur.description else []
                rows = [self._normalize(table, dict(zip(names, r))) for r in cur.fetchall()]
                cur.execute(f'DELETE FROM "{table}"{where_sql}', bind)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            return rows


def _make_sqlite_db(db_path: Path, user_id: str, settings: Settings) -> SQLiteUserDB:
    return SQLiteUserDB(db_path, user_id, settings)
