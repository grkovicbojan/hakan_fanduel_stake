CREATE EXTENSION IF NOT EXISTS timescaledb;

-- id is BIGSERIAL for ordering/reference but not the sole primary key (Timescale + your convention).
-- Hypertables only where unique constraints include the partition column (see alert_infos).

CREATE TABLE IF NOT EXISTS website_infos (
  id BIGSERIAL NOT NULL,
  url TEXT NOT NULL,
  type CHAR(1) NOT NULL DEFAULT 'B' CHECK (type IN ('B', 'C')),
  scrape_interval INTEGER NOT NULL DEFAULT 10,
  refresh_interval INTEGER NOT NULL DEFAULT 300,
  comparison_website_list TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (url)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_website_infos_id ON website_infos (id);

CREATE TABLE IF NOT EXISTS match_infos (
  id BIGSERIAL NOT NULL,
  baseline_url TEXT NOT NULL,
  comparison_url TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  baseline_match_url TEXT NOT NULL DEFAULT '',
  comparison_match_url TEXT NOT NULL DEFAULT '',
  status SMALLINT NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (baseline_url, comparison_url, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_infos_id ON match_infos (id);
CREATE INDEX IF NOT EXISTS idx_match_infos_status_timestamp
  ON match_infos (status, timestamp DESC);

CREATE TABLE IF NOT EXISTS match_website_infos (
  id BIGSERIAL NOT NULL,
  website TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (website, url)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_website_infos_id ON match_website_infos (id);
CREATE INDEX IF NOT EXISTS idx_match_website_infos_website_timestamp
  ON match_website_infos (website, timestamp DESC);

CREATE TABLE IF NOT EXISTS odd_infos (
  id BIGSERIAL NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (url, category)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_odd_infos_id ON odd_infos (id);
CREATE INDEX IF NOT EXISTS idx_odd_infos_timestamp ON odd_infos (timestamp DESC);

CREATE TABLE IF NOT EXISTS scraped_infos (
  id BIGSERIAL NOT NULL,
  url TEXT NOT NULL,
  result TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (url)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scraped_infos_id ON scraped_infos (id);
CREATE INDEX IF NOT EXISTS idx_scraped_infos_timestamp ON scraped_infos (timestamp DESC);

CREATE TABLE IF NOT EXISTS compared_infos (
  id BIGSERIAL NOT NULL,
  name TEXT NOT NULL,
  baseline_match_url TEXT NOT NULL,
  comparison_match_url TEXT NOT NULL,
  category TEXT NOT NULL,
  baseline_value DOUBLE PRECISION NOT NULL,
  comparison_value DOUBLE PRECISION NOT NULL,
  arbitrage DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (name, baseline_match_url, comparison_match_url, category)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_compared_infos_id ON compared_infos (id);
CREATE INDEX IF NOT EXISTS idx_compared_infos_timestamp_arbitrage
  ON compared_infos (timestamp DESC, arbitrage DESC);

-- Hypertable: PK includes partition column "timestamp" (required by TimescaleDB).
CREATE TABLE IF NOT EXISTS alert_infos (
  id BIGSERIAL NOT NULL,
  alert_data JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (timestamp, id)
);

-- Legacy DBs may still have PRIMARY KEY (id) from an older schema; IF NOT EXISTS leaves that in place,
-- which breaks create_hypertable. Repoint the primary key when it does not include "timestamp".
DO $$
BEGIN
  IF to_regclass('public.alert_infos') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.alert_infos'::regclass
      AND c.contype = 'p'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS ck(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ck.attnum
        WHERE a.attname = 'timestamp'
      )
  ) THEN
    ALTER TABLE alert_infos DROP CONSTRAINT alert_infos_pkey;
    ALTER TABLE alert_infos ADD PRIMARY KEY (timestamp, id);
  END IF;
END $$;

-- No UNIQUE(id) alone here: Timescale hypertables require unique indexes to include "timestamp".

SELECT create_hypertable('alert_infos', 'timestamp', if_not_exists => TRUE);
