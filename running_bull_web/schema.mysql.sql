-- 大角牛快跑 · MySQL 表结构（MySQL 5.7+/8.0，utf8mb4）
-- 用法：mysql -u bull -p running_bull < schema.mysql.sql
-- （server.py 在 MySQL 模式下启动时也会自动执行本文件里的 CREATE TABLE IF NOT EXISTS）

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
