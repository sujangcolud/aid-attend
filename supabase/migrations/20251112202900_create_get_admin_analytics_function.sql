CREATE OR REPLACE FUNCTION get_admin_analytics()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_centers', (SELECT COUNT(*) FROM centers),
    'total_students', (SELECT COUNT(*) FROM students),
    'total_attendance_records', (SELECT COUNT(*) FROM attendance),
    'total_tests_conducted', (SELECT COUNT(*) FROM tests),
    'center_wise_overview', (
      SELECT json_agg(
        json_build_object(
          'center_name', c.center_name,
          'num_students', (SELECT COUNT(*) FROM students WHERE center_id = c.id),
          'attendance_rate', (
            SELECT AVG(CASE WHEN status = 'Present' THEN 100 ELSE 0 END)
            FROM attendance
            WHERE center_id = c.id
          ),
          'avg_fee_payment_percentage', (
            SELECT AVG(CASE WHEN status = 'Paid' THEN 100 ELSE 0 END)
            FROM fees
            WHERE center_id = c.id
          ),
          'last_active_date', (SELECT MAX(last_login) FROM users WHERE center_id = c.id)
        )
      )
      FROM centers c
    ),
    'monthly_attendance_trends', (
      SELECT json_agg(
        json_build_object(
          'month', to_char(month, 'YYYY-MM'),
          'attendance', COUNT(*)
        )
      )
      FROM (
        SELECT date_trunc('month', date) AS month
        FROM attendance
      ) AS monthly_attendance
      GROUP BY month
    ),
    'fee_collection_trends', (
      SELECT json_agg(
        json_build_object(
          'month', to_char(month, 'YYYY-MM'),
          'paid', COUNT(*) FILTER (WHERE status = 'Paid'),
          'pending', COUNT(*) FILTER (WHERE status = 'Pending')
        )
      )
      FROM (
        SELECT date_trunc('month', month) AS month, status
        FROM fees
      ) AS monthly_fees
      GROUP BY month
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
