import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

// Helper function to hash password using native crypto
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
    const { centerName, address, contactNumber, username, password } = await req.json();

    if (!centerName || !username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Center name, username, and password are required' }),
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

    // Create center
    const { data: center, error: centerError } = await supabase
      .from('centers')
      .insert({
        center_name: centerName,
        address: address || null,
        contact_number: contactNumber || null
      })
      .select()
      .single();

    if (centerError) throw centerError;

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        role: 'center',
        center_id: center.id,
        is_active: true
      })
      .select()
      .single();

    if (userError) {
      // Rollback: delete the center if user creation fails
      await supabase.from('centers').delete().eq('id', center.id);
      throw userError;
    }

    console.log('Center created successfully:', center.id);

    return new Response(
      JSON.stringify({ success: true, center, user: { id: user.id, username: user.username } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Create center error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
