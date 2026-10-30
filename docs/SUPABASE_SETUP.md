# Supabase Setup Guide - SHM Chiefs Portal

This guide explains how to set up the database tables in your Supabase project for the SHM Chiefs Portal.

## Prerequisites

- Supabase account at https://supabase.com
- Project already created
- Credentials configured in `.env`

## SQL Migrations

Run the following SQL commands in your Supabase SQL Editor (https://app.supabase.com/project/[YOUR_PROJECT_ID]/sql):

### 1. Create chef_profiles table

```sql
CREATE TABLE chef_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  cin VARCHAR(20) NOT NULL UNIQUE,
  can VARCHAR(20) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chef_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can read their own profile" 
ON chef_profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON chef_profiles FOR UPDATE 
USING (auth.uid() = id);
```

### 2. Create members table

```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  branch VARCHAR(100),
  patrol VARCHAR(100),
  role VARCHAR(100),
  tutor_name VARCHAR(100),
  tutor_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Allow chiefs to read members
CREATE POLICY "Chiefs can read members" 
ON members FOR SELECT 
USING (auth.uid() = user_id);

-- Allow chiefs to insert members
CREATE POLICY "Chiefs can insert members" 
ON members FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

### 3. Create reports table

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  patrol VARCHAR(100),
  activity VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Allow chiefs to read their reports
CREATE POLICY "Chiefs can read their reports" 
ON reports FOR SELECT 
USING (auth.uid() = user_id);

-- Allow chiefs to insert reports
CREATE POLICY "Chiefs can insert reports" 
ON reports FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

### 4. Create sessions table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  location VARCHAR(255),
  responsible VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow chiefs to read sessions
CREATE POLICY "Chiefs can read sessions" 
ON sessions FOR SELECT 
USING (auth.uid() = user_id);

-- Allow chiefs to insert sessions
CREATE POLICY "Chiefs can insert sessions" 
ON sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

### 5. Create ideas table

```sql
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Allow chiefs to read ideas
CREATE POLICY "Chiefs can read ideas" 
ON ideas FOR SELECT 
USING (auth.uid() = user_id);

-- Allow chiefs to insert ideas
CREATE POLICY "Chiefs can insert ideas" 
ON ideas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow chiefs to update ideas
CREATE POLICY "Chiefs can update ideas" 
ON ideas FOR UPDATE 
USING (auth.uid() = user_id);
```

## Steps to Apply

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy and paste each SQL block above
5. Click "Run" to execute each query
6. Verify the tables appear in the "Table Editor" section

## Verification

After running the migrations:

1. Go to the "Table Editor" in Supabase
2. You should see these tables:
   - `chef_profiles`
   - `members`
   - `reports`
   - `sessions`
   - `ideas`

3. Each table should have RLS (Row Level Security) enabled

## Testing

To test your setup:

1. Start the dev server: `pnpm dev`
2. Navigate to http://localhost:8081/signup
3. Fill out the registration form
4. Click "Créer un compte"
5. Check your Supabase database to verify the profile was created
6. Try logging in with your credentials
