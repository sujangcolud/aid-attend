CREATE OR REPLACE FUNCTION change_password(old_password text, new_password text)
RETURNS void AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_password_hash text;
BEGIN
  SELECT password_hash INTO current_password_hash FROM users WHERE id = current_user_id;

  IF NOT verify(old_password, current_password_hash) THEN
    RAISE EXCEPTION 'Invalid old password';
  END IF;

  UPDATE users
  SET password_hash = crypt(new_password, gen_salt('bf'))
  WHERE id = current_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
