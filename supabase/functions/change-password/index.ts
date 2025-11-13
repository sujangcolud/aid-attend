import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

// Helper function to hash password using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper function to verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "Current password and new password are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "New password must be at least 8 characters long" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user ID from the request headers or auth context
    // In a real scenario, you'd extract this from the JWT token
    // For now, we'll need to pass it in the request body
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "User ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch the user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ success: false, error: "Current password is incorrect" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in database
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: newPasswordHash })
      .eq("id", userId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: "Password changed successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Change password error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
