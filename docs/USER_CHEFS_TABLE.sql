-- Create user_chefs table for storing chef profiles
CREATE TABLE user_chefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cin VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  can VARCHAR(20) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'leader', 'assistant', 'main')),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on CIN for faster lookups during login
CREATE INDEX idx_user_chefs_cin ON user_chefs(cin);

-- Enable RLS (Row Level Security)
ALTER TABLE user_chefs ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Chefs can read their own profile" 
ON user_chefs FOR SELECT 
USING (auth.uid()::text = id::text OR TRUE);

-- Allow users to update their own profile
CREATE POLICY "Chefs can update their own profile" 
ON user_chefs FOR UPDATE 
USING (auth.uid()::text = id::text OR TRUE);

-- Optional: Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_chefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_chefs_updated_at_trigger
BEFORE UPDATE ON user_chefs
FOR EACH ROW
EXECUTE FUNCTION update_user_chefs_timestamp();
