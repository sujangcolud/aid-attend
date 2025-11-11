-- Create centers table
CREATE TABLE IF NOT EXISTS public.centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_name TEXT NOT NULL,
  address TEXT,
  contact_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'center');

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'center',
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create chapter_teachings table for tracking when chapters are taught
CREATE TABLE IF NOT EXISTS public.chapter_teachings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  students_present JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add center_id to existing tables
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE;

-- Add file storage fields to tests table
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS uploaded_file_url TEXT;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Enable RLS on new tables
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_teachings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for centers
CREATE POLICY "Allow all operations on centers"
ON public.centers
FOR ALL
USING (true)
WITH CHECK (true);

-- Create RLS policies for users
CREATE POLICY "Allow all operations on users"
ON public.users
FOR ALL
USING (true)
WITH CHECK (true);

-- Create RLS policies for chapter_teachings
CREATE POLICY "Allow all operations on chapter_teachings"
ON public.chapter_teachings
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_center ON public.users(center_id);
CREATE INDEX IF NOT EXISTS idx_students_center ON public.students(center_id);
CREATE INDEX IF NOT EXISTS idx_chapters_center ON public.chapters(center_id);
CREATE INDEX IF NOT EXISTS idx_tests_center ON public.tests(center_id);
CREATE INDEX IF NOT EXISTS idx_chapter_teachings_chapter ON public.chapter_teachings(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_teachings_date ON public.chapter_teachings(date);

-- Note: Admin user is created via the init-admin Edge Function which properly hashes the password
-- Do not insert placeholder data here as invalid hashes will cause authentication failures
