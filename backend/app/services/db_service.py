import os
import json
import sqlite3
import uuid
from datetime import datetime
from app.config import SUPABASE_URL, SUPABASE_KEY

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DB_FILE = Path(os.getenv("DB_PATH", str(_BACKEND_DIR / "saksham.db")))

_client = None


class SQLiteResult:
    def __init__(self, data):
        self.data = data or []


class SQLiteQueryBuilder:
    def __init__(self, conn, table_name):
        self.conn = conn
        self.table_name = table_name
        self._select_fields = "*"
        self._where_clauses = []
        self._params = []
        self._order_by = None
        self._desc = False
        self._insert_data = None

    def insert(self, data):
        self._insert_data = data
        return self

    def select(self, fields="*"):
        self._select_fields = fields
        return self

    def eq(self, column, value):
        self._where_clauses.append(f"{column} = ?")
        self._params.append(value)
        return self

    def order(self, column, desc=False):
        self._order_by = column
        self._desc = desc
        return self

    def execute(self):
        cursor = self.conn.cursor()
        try:
            if self._insert_data is not None:
                data = dict(self._insert_data)
                if "id" not in data or not data["id"]:
                    data["id"] = str(uuid.uuid4())
                if "created_at" not in data:
                    data["created_at"] = datetime.utcnow().isoformat() + "Z"
                for k, v in data.items():
                    if isinstance(v, (dict, list)):
                        data[k] = json.dumps(v)
                cols = list(data.keys())
                placeholders = ", ".join(["?"] * len(cols))
                sql = f"INSERT INTO {self.table_name} ({', '.join(cols)}) VALUES ({placeholders})"
                cursor.execute(sql, list(data.values()))
                self.conn.commit()

                cursor.execute(f"SELECT * FROM {self.table_name} WHERE id = ?", (data["id"],))
                row = cursor.fetchone()
                return SQLiteResult([self._row_to_dict(cursor, row)])

            sql = f"SELECT {self._select_fields} FROM {self.table_name}"
            if self._where_clauses:
                sql += " WHERE " + " AND ".join(self._where_clauses)
            if self._order_by:
                direction = "DESC" if self._desc else "ASC"
                sql += f" ORDER BY {self._order_by} {direction}"
            cursor.execute(sql, self._params)
            rows = cursor.fetchall()
            return SQLiteResult([self._row_to_dict(cursor, r) for r in rows])
        finally:
            self.conn.close()

    def _row_to_dict(self, cursor, row):
        if not row:
            return None
        col_names = [d[0] for d in cursor.description]
        d = dict(zip(col_names, row))
        if "indicators_found" in d and isinstance(d["indicators_found"], str):
            try:
                d["indicators_found"] = json.loads(d["indicators_found"])
            except Exception:
                pass
        return d


class LocalDatabase:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        return conn

    def _init_db(self):
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                class_section TEXT NOT NULL,
                age_years INTEGER,
                created_at TEXT NOT NULL
            )
        """)
        # Graceful migration: add age_years to existing databases
        try:
            cur.execute("ALTER TABLE students ADD COLUMN age_years INTEGER")
        except Exception:
            pass  # Column already exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                image_url TEXT,
                indicators_found TEXT,
                indicator_count INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES students(id)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                scan_id TEXT NOT NULL,
                pdf_url TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (scan_id) REFERENCES scans(id)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS model_metadata (
                id TEXT PRIMARY KEY,
                version TEXT,
                validation_accuracy REAL,
                validation_precision REAL,
                validation_recall REAL,
                dataset_description TEXT,
                trained_at TEXT
            )
        """)
        conn.commit()

        # Seed initial sample student if table is empty
        cur.execute("SELECT COUNT(*) FROM students")
        if cur.fetchone()[0] == 0:
            demo_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat() + "Z"
            cur.execute(
                "INSERT INTO students (id, name, class_section, created_at) VALUES (?, ?, ?, ?)",
                (demo_id, "Aarav Sharma", "Class 3-B", now)
            )
            conn.commit()
        conn.close()

    def table(self, table_name: str):
        return SQLiteQueryBuilder(self._get_conn(), table_name)


def get_db():
    global _client
    if _client is not None:
        return _client

    if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL.startswith("http"):
        try:
            from supabase import create_client
            _client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("[db_service] Connected to Supabase")
            return _client
        except Exception as e:
            print(f"[db_service] Supabase init failed ({e}), falling back to local SQLite")

    _client = LocalDatabase(DB_FILE)
    print(f"[db_service] Using SQLite database at {DB_FILE}")
    return _client
