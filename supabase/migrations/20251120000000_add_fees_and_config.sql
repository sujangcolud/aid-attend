-- Create student_fees table for monthly fee tracking
CREATE TABLE IF NOT EXISTS public.student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  month TEXT NOT NULL, -- Format: "2024-11" for November 2024
  due_date INTEGER NOT NULL DEFAULT 1, -- Day of month (1-30)
  payment_status TEXT NOT NULL DEFAULT 'Unpaid', -- 'Paid' or 'Unpaid'
  paid_date TIMESTAMP WITH TIME ZONE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create index for faster fee lookups
CREATE INDEX IF NOT EXISTS idx_student_fees_student_id ON public.student_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_center_id ON public.student_fees(center_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_month ON public.student_fees(month);

-- Create system_config table for admin feature toggles
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Insert default configuration values for modules
INSERT INTO public.system_config (key, description) VALUES
  ('attendance_enabled', 'Enable/disable attendance tracking for all non-admin users'),
  ('finance_enabled', 'Enable/disable fee/finance management for all non-admin users'),
  ('student_report_enabled', 'Enable/disable student reports for all non-admin users'),
  ('attendance_report_enabled', 'Enable/disable attendance reports for all non-admin users'),
  ('chapter_progress_enabled', 'Enable/disable chapter progress tracking for all non-admin users'),
  ('parent_login_enabled', 'Enable/disable parent login access for all non-admin users'),
  ('tests_enabled', 'Enable/disable tests and marks for all non-admin users')
ON CONFLICT (key) DO NOTHING;

-- Add completed_on column to student_chapters for manual marking
ALTER TABLE public.student_chapters ADD COLUMN IF NOT EXISTS completed_on TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all operations on student_fees"
ON public.student_fees
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on system_config"
ON public.system_config
FOR ALL
USING (true)
WITH CHECK (true);
