import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

// Helper function to hash password using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password, role } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user by username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, centers(center_name), students(name)')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      console.log('Attempted username:', username);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Role-based access control
    if (role && user.role !== role) {
      console.log(`Role mismatch for user: ${username}. Expected ${role}, but got ${user.role}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. Incorrect role.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('User found:', user.username, 'Role:', user.role);

    // Verify password
    const passwordHash = await hashPassword(password);
    console.log('Generated hash:', passwordHash);
    console.log('Stored hash:', user.password_hash);
    const passwordMatch = await verifyPassword(password, user.password_hash);
    console.log('Password match result:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('Password verification failed for user:', username);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Return user data (excluding password_hash)
    const userData = {
      id: user.id,
      username: user.username,
      role: user.role,
      center_id: user.center_id,
      center_name: user.centers?.center_name || null,
      student_id: user.student_id,
      student_name: user.students?.name || null
    };

    return new Response(
      JSON.stringify({ success: true, user: userData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
