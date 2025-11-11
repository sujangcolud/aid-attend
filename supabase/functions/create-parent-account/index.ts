import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Helper function to hash password using bcrypt
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
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
    const { username, password, studentId, centerId } = await req.json();

    if (!username || !password || !studentId || !centerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'All fields are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify student exists and belongs to the center
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, center_id')
      .eq('id', studentId)
      .eq('center_id', centerId)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ success: false, error: 'Student not found or access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create parent user
    const { data: parentUser, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        role: 'parent',
        center_id: centerId,
        student_id: studentId,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Parent user created successfully for student:', studentId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Parent account created successfully',
        user: {
          id: parentUser.id,
          username: parentUser.username,
          role: parentUser.role
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Create parent account error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
