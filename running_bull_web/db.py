"""数据库抽象层：默认 SQLite（本地开发），配置环境变量后切换到 MySQL。

配置方式（任选其一）：
  DB_URL=mysql://user:pass@host:3306/running_bull
  或 DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME
  不配置时使用 SQLite 文件：SQLITE_PATH（默认 ./data/running_bull.db）
业务代码统一用 ? 作占位符，MySQL 模式下自动转换成 %s。
"""
import os, re, sqlite3, threading
from urllib.parse import urlparse, unquote

HERE = os.path.dirname(os.path.abspath(__file__))


def _mysql_conf():
    url = os.environ.get('DB_URL', '')
    if url.startswith('mysql'):
        u = urlparse(url)
        return dict(host=u.hostname or '127.0.0.1', port=u.port or 3306,
                    user=unquote(u.username or ''), password=unquote(u.password or ''),
                    database=u.path.lstrip('/'))
    if os.environ.get('DB_HOST'):
        return dict(host=os.environ['DB_HOST'], port=int(os.environ.get('DB_PORT', 3306)),
                    user=os.environ.get('DB_USER', ''), password=os.environ.get('DB_PASS', ''),
                    database=os.environ.get('DB_NAME', 'running_bull'))
    return None


def _sqlite_schema():
    """把 MySQL 表结构转换成 SQLite 能执行的语句（同一份 schema，两种库）。"""
    sql = open(os.path.join(HERE, 'schema.mysql.sql'), encoding='utf-8').read()
    sql = re.sub(r'--[^\n]*', '', sql)
    sql = sql.replace('INT AUTO_INCREMENT PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')
    sql = re.sub(r'\)\s*ENGINE=[^;]*;', ');', sql)
    sql = re.sub(r',\s*INDEX \w+ \([^)]*\)', '', sql)
    return sql


class DB:
    def __init__(self):
        self.lock = threading.RLock()
        conf = _mysql_conf()
        if conf:
            import pymysql  # pip install pymysql
            self.kind = 'mysql'
            self.conf = conf
            self.conn = None
            self._connect()
            stmts = re.sub(r'--[^\n]*', '', open(os.path.join(HERE, 'schema.mysql.sql'), encoding='utf-8').read())
            for s in stmts.split(';'):
                if s.strip():
                    self.execute(s)
            self.commit()
        else:
            self.kind = 'sqlite'
            path = os.environ.get('SQLITE_PATH', os.path.join(HERE, 'data', 'running_bull.db'))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            self.conn = sqlite3.connect(path, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            self.conn.executescript(_sqlite_schema())
            self.conn.commit()
            self.where = path
        self.migrate()

    def _column_names(self, table):
        if not re.fullmatch(r'[A-Za-z0-9_]+', table):
            raise ValueError('bad table')
        if self.kind == 'sqlite':
            return {r['name'] for r in self.all('PRAGMA table_info(%s)' % table)}
        rows = self.all(
            'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
            (table,))
        return {r['name'] for r in rows}

    def ensure_column(self, table, column, definition):
        """给已经建好的表补列。新库的 CREATE TABLE 里已经有这些列时会直接跳过。"""
        if not re.fullmatch(r'[A-Za-z0-9_]+', table) or not re.fullmatch(r'[A-Za-z0-9_]+', column):
            raise ValueError('bad identifier')
        if column in self._column_names(table):
            return
        self.execute('ALTER TABLE %s ADD COLUMN %s %s' % (table, column, definition))

    def migrate(self):
        # 旧库只有 CREATE TABLE IF NOT EXISTS，不会自己长出新列。这里按列补。
        for col, ddl in (
            ('board', "VARCHAR(16) NOT NULL DEFAULT ''"),
            ('mode', "VARCHAR(16) NOT NULL DEFAULT ''"),
            ('hero', "VARCHAR(16) NOT NULL DEFAULT ''"),
            ('distance', 'INT NOT NULL DEFAULT 0'),
            ('play_ms', 'INT NOT NULL DEFAULT 0'),
            ('wx_openid', "VARCHAR(64) NOT NULL DEFAULT ''"),
        ):
            self.ensure_column('runs', col, ddl)
        self.commit()

    def _connect(self):
        import pymysql
        self.conn = pymysql.connect(charset='utf8mb4', autocommit=False,
                                    cursorclass=pymysql.cursors.DictCursor, **self.conf)
        self.where = '%s@%s:%s/%s' % (self.conf['user'], self.conf['host'], self.conf['port'], self.conf['database'])

    def execute(self, sql, args=()):
        if self.kind == 'mysql':
            self.conn.ping(reconnect=True)
            cur = self.conn.cursor()
            cur.execute(sql.replace('?', '%s'), args)
            return cur
        return self.conn.execute(sql, args)

    def one(self, sql, args=()):
        r = self.execute(sql, args).fetchone()
        return dict(r) if r else None

    def all(self, sql, args=()):
        return [dict(r) for r in self.execute(sql, args).fetchall()]

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()
