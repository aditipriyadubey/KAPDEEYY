"""Create a consistent, portable backup of the local wardrobe data.

Uses SQLite's online backup API so the copy includes everything still sitting in
the -wal file (a plain file copy can silently miss recent writes). The uploads
folder is copied alongside it.

Usage (from backend/):
    python scripts/backup_data.py                  # -> data/backups/<timestamp>/
    python scripts/backup_data.py --out D:/backup  # explicit destination

Restore (with the backend stopped):
    copy kapdeeyy.db into the configured SQLITE_PATH
    copy uploads/  into the configured UPLOADS_PATH
"""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Back up KAPDEEYY SQLite + uploads")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    settings = get_settings()
    source_db = Path(settings.sqlite_file)
    source_uploads = Path(settings.uploads_dir)

    if not source_db.is_file():
        print(f"Database not found: {source_db}")
        return 1

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target = (args.out or (BACKEND_DIR / "data" / "backups")) / stamp
    target.mkdir(parents=True, exist_ok=True)

    destination = target / "kapdeeyy.db"
    src = sqlite3.connect(str(source_db), timeout=30)
    dst = sqlite3.connect(str(destination))
    try:
        src.backup(dst)
        integrity = dst.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        dst.close()
        src.close()

    counts = sqlite3.connect(str(destination))
    try:
        tables = [
            row[0]
            for row in counts.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
        row_counts = {
            table: counts.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            for table in tables
        }
    finally:
        counts.close()

    if source_uploads.is_dir():
        shutil.copytree(source_uploads, target / "uploads", dirs_exist_ok=True)

    manifest = {
        "created_at": stamp,
        "database": str(destination),
        "uploads": str(target / "uploads"),
        "integrity_check": integrity,
        "row_counts": row_counts,
    }
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Backup written to {target}")
    print(f"integrity_check: {integrity}")
    print(json.dumps(row_counts, indent=2))
    return 0 if integrity == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
