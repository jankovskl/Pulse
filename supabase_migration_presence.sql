-- Create presence table for real-time user status tracking
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'working_out')),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  workout_data JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all presence data (public leaderboard feature)
CREATE POLICY "Presence is publicly readable"
  ON presence
  FOR SELECT
  USING (true);

-- Policy: Users can only insert/update their own presence
CREATE POLICY "Users can manage their own presence"
  ON presence
  FOR ALL
  USING (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_presence_status ON presence(status);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen);

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_presence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on every update
CREATE TRIGGER presence_updated_at
  BEFORE UPDATE ON presence
  FOR EACH ROW
  EXECUTE FUNCTION update_presence_updated_at();

-- Enable realtime for presence table
ALTER PUBLICATION supabase_realtime ADD TABLE presence;

COMMENT ON TABLE presence IS 'Real-time user presence and workout status tracking';
