-- Add student_id column to users table for parent role
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE;

-- Update the app_role enum to include parent
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'parent';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_center_id ON users(center_id);

-- Comment for clarity
COMMENT ON COLUMN users.student_id IS 'Links parent users to their child student record';