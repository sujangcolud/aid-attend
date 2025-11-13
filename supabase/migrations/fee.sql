-- Create monthly fees table
CREATE TABLE IF NOT EXISTS public.monthly_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  fee_amount DECIMAL(10, 2) NOT NULL,
  month_year TEXT NOT NULL, -- Format: "2025-01" for January 2025
  due_date INTEGER NOT NULL CHECK (due_date >= 1 AND due_date <= 30),
  paid BOOLEAN NOT NULL DEFAULT false,
  payment_date DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, month_year)
);

-- Enable RLS on monthly_fees
ALTER TABLE public.monthly_fees ENABLE ROW LEVEL SECURITY;

-- Create policy for monthly_fees
CREATE POLICY "Allow all operations on monthly_fees" 
ON public.monthly_fees 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create feature toggles table
CREATE TABLE IF NOT EXISTS public.feature_toggles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on feature_toggles
ALTER TABLE public.feature_toggles ENABLE ROW LEVEL SECURITY;

-- Create policy for feature_toggles
CREATE POLICY "Allow all operations on feature_toggles" 
ON public.feature_toggles 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert default feature toggles
INSERT INTO public.feature_toggles (feature_name, description, enabled) VALUES
  ('attendance', 'Attendance tracking module', true),
  ('finance', 'Fee management module', true),
  ('student_report', 'Student report module', true),
  ('attendance_report', 'Attendance report module', true),
  ('chapter_progress', 'Chapter progress tracking', true),
  ('parent_login', 'Parent login access', true),
  ('tests_marks', 'Tests and marks module', true)
ON CONFLICT (feature_name) DO NOTHING;

-- Add completed column to student_chapters if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_chapters' AND column_name = 'completed'
  ) THEN
    ALTER TABLE public.student_chapters ADD COLUMN completed BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create index for faster center-based queries
CREATE INDEX IF NOT EXISTS idx_students_center_id ON public.students(center_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_monthly_fees_student_month ON public.monthly_fees(student_id, month_year);
CREATE INDEX IF NOT EXISTS idx_monthly_fees_center_id ON public.monthly_fees(center_id);

-- Create trigger for updating updated_at on monthly_fees
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monthly_fees_updated_at
    BEFORE UPDATE ON public.monthly_fees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_toggles_updated_at
    BEFORE UPDATE ON public.feature_toggles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
