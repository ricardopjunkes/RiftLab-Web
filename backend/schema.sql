CREATE TABLE IF NOT EXISTS compositions (
  code CHAR(12) PRIMARY KEY,
  title VARCHAR(60) NOT NULL DEFAULT 'Composição do RiftLab',
  ally JSONB NOT NULL,
  enemy JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS compositions_created_at_idx ON compositions (created_at DESC);
