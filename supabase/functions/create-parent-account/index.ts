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
    console.log('Create parent account request:', { username, studentId, centerId });

    if (!username || !password || !studentId || !centerId) {
      console.error('Missing required fields:', { username: !!username, password: !!password, studentId: !!studentId, centerId: !!centerId });
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
      console.error('Username already exists:', username);
      return new Response(
        JSON.stringify({ success: false, error: 'Username already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify student exists (with more flexible center_id check)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, center_id, name')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      console.error('Student not found:', studentId, studentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Student not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('Student found:', { id: student.id, name: student.name, center_id: student.center_id });

    // If student's center_id is NULL, update it to the provided centerId
    if (!student.center_id) {
      console.log('Student has NULL center_id, updating to:', centerId);
      const { error: updateError } = await supabase
        .from('students')
        .update({ center_id: centerId })
        .eq('id', studentId);

      if (updateError) {
        console.error('Failed to update student center_id:', updateError);
        throw new Error('Failed to assign student to center');
      }
      console.log('Student center_id updated successfully');
    } else if (student.center_id !== centerId) {
      // If student belongs to a different center, deny access
      console.error('Student belongs to different center:', { student_center: student.center_id, requested_center: centerId });
      return new Response(
        JSON.stringify({ success: false, error: 'Student belongs to a different tuition center' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Hash the password
    const passwordHash = await hashPassword(password);
    console.log('Password hashed successfully');

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

    if (error) {
      console.error('Failed to create parent user:', error);
      throw error;
    }

    console.log('Parent user created successfully:', { userId: parentUser.id, username: parentUser.username, studentId });

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
