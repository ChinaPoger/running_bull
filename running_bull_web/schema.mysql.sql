-- 大角牛快跑 · MySQL 表结构（MySQL 5.7+/8.0，utf8mb4）
-- 用法：mysql -u bull -p running_bull < schema.mysql.sql
-- （server.py 在 MySQL 模式下启动时也会自动执行本文件里的 CREATE TABLE IF NOT EXISTS）
-- 已有库不会因为 CREATE TABLE IF NOT EXISTS 而加列。runs 的 board/mode/hero/distance/play_ms/wx_openid
-- 以及 users.client_hint 由 db.py 的 migrate() 在启动时 ALTER TABLE 补上（SQLite 和 MySQL 都是）。
-- client_hint 是 UA/屏幕的短哈希，只作旁路记录，不能用来查找账号。新库直接用下面的建表语句。

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL UNIQUE,
  nickname VARCHAR(32) NOT NULL DEFAULT '',
  coins INT NOT NULL DEFAULT 0,
  best INT NOT NULL DEFAULT 0,
  invite_code VARCHAR(16) NOT NULL UNIQUE,
  invited_by INT NULL,
  reg_ip VARCHAR(64) NOT NULL DEFAULT '',
  equipped_char VARCHAR(32) NOT NULL DEFAULT 'bull',
  equipped_bg VARCHAR(32) NOT NULL DEFAULT 'farm',
  created_at BIGINT NOT NULL,
  client_hint VARCHAR(64) NOT NULL DEFAULT '',
  INDEX idx_best (best)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory (
  user_id INT NOT NULL,
  item_id VARCHAR(32) NOT NULL,
  qty INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS runs (
  id VARCHAR(32) PRIMARY KEY,
  user_id INT NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT NULL,
  finished INT NOT NULL DEFAULT 0,
  revived INT NOT NULL DEFAULT 0,
  shield INT NOT NULL DEFAULT 0,
  dbl INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  coins INT NOT NULL DEFAULT 0,
  board VARCHAR(16) NOT NULL DEFAULT '',
  mode VARCHAR(16) NOT NULL DEFAULT '',
  hero VARCHAR(16) NOT NULL DEFAULT '',
  distance INT NOT NULL DEFAULT 0,
  play_ms INT NOT NULL DEFAULT 0,
  wx_openid VARCHAR(64) NOT NULL DEFAULT '',
  INDEX idx_runs_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ads (
  id VARCHAR(32) PRIMARY KEY,
  user_id INT NOT NULL,
  run_id VARCHAR(32) NOT NULL,
  started_at BIGINT NOT NULL,
  used INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(32) PRIMARY KEY,
  user_id INT NOT NULL,
  package_id VARCHAR(32) NOT NULL,
  price_cents INT NOT NULL,
  coins INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inviter_id INT NOT NULL,
  invitee_id INT NOT NULL UNIQUE,
  reward INT NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_inviter (inviter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coin_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  delta INT NOT NULL,
  reason VARCHAR(32) NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_log_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- 账号登录（昵称 + 4 位 PIN；XBuilder 版没有本地存储，靠它找回同一个账号）----------
CREATE TABLE IF NOT EXISTS accounts (
  user_id INT PRIMARY KEY,
  login_name VARCHAR(32) NOT NULL UNIQUE,
  pin_salt VARCHAR(64) NOT NULL,
  pin_hash VARCHAR(128) NOT NULL,
  fail_count INT NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  INDEX idx_sess_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- XBuilder 版自己的装备选择（XBuilder 的角色和网页版不同，分开存，免得网页版装备到它没有的角色）
CREATE TABLE IF NOT EXISTS xb_prefs (
  user_id INT PRIMARY KEY,
  xb_char INT NOT NULL DEFAULT 0,
  xb_map INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 微信公众号网页授权（openid 绑定到 users.id，和游客钱包是同一个账号）
CREATE TABLE IF NOT EXISTS wechat_users (
  openid VARCHAR(64) PRIMARY KEY,
  unionid VARCHAR(64) NOT NULL DEFAULT '',
  user_id INT NOT NULL,
  nickname VARCHAR(64) NOT NULL DEFAULT '',
  avatar VARCHAR(512) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_wx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 网页授权的 state，10 分钟内有效，用过即删
CREATE TABLE IF NOT EXISTS oauth_states (
  state VARCHAR(64) PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL DEFAULT '',
  invite_code VARCHAR(16) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
