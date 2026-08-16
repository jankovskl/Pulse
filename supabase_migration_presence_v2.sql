-- Create presence table for real-time user status tracking
-- This version handles existing objects gracefully

-- Create table if it doesn't exist
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

-- Drop existing policies if they exist, then recreate them
DO $$
BEGIN
    -- Drop and recreate "Presence is publicly readable" policy
    DROP POLICY IF EXISTS "Presence is publicly readable" ON presence;
    CREATE POLICY "Presence is publicly readable"
      ON presence
      FOR SELECT
      USING (true);

    -- Drop and recreate "Users can manage their own presence" policy
    DROP POLICY IF EXISTS "Users can manage their own presence" ON presence;
    CREATE POLICY "Users can manage their own presence"
      ON presence
      FOR ALL
      USING (auth.uid() = user_id);
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_presence_status ON presence(status);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen);

-- Create or replace function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_presence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS presence_updated_at ON presence;
CREATE TRIGGER presence_updated_at
  BEFORE UPDATE ON presence
  FOR EACH ROW
  EXECUTE FUNCTION update_presence_updated_at();

-- Enable realtime for presence table (safe to run multiple times)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE presence;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore error
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Presence table migration completed successfully!';
END $$;
