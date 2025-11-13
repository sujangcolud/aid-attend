import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Key, CheckCircle2, AlertCircle } from "lucide-react";

// Helper function to hash password
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ChangePassword() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong" | null>(null);

  // Calculate password strength
  const calculateStrength = (password: string) => {
    if (password.length === 0) return null;
    if (password.length < 8) return "weak";
    if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)) return "strong";
    if (password.length >= 8 && /[A-Z]/.test(password)) return "medium";
    return "weak";
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setPasswordStrength(calculateStrength(value));
  };

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error("All fields are required");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match");
      }

      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      if (newPassword === currentPassword) {
        throw new Error("New password must be different from current password");
      }

      // Call Supabase function to change password
      const { data, error } = await supabase.functions.invoke("change-password", {
        body: {
          currentPassword,
          newPassword,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to change password");
      return data;
    },
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      // Logout user after password change for security
      setTimeout(() => {
        logout();
        toast.success("Please login again with your new password");
        navigate("/login");
      }, 1500);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to change password");
    },
  });

  const isFormValid =
    currentPassword &&
    newPassword &&
    confirmPassword &&
    newPassword === confirmPassword &&
    newPassword.length >= 8 &&
    newPassword !== currentPassword;

  const strengthColors = {
    weak: "text-red-600",
    medium: "text-yellow-600",
    strong: "text-green-600",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-6 w-6" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              changePasswordMutation.mutate();
            }}
            className="space-y-4"
          >
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password *</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  disabled={changePasswordMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password *</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => handleNewPasswordChange(e.target.value)}
                  placeholder="Enter a new password (min 8 characters)"
                  disabled={changePasswordMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1 h-1">
                    <div
                      className={`flex-1 rounded-full ${
                        passwordStrength ? "bg-red-600" : "bg-muted"
                      }`}
                    />
                    <div
                      className={`flex-1 rounded-full ${
                        passwordStrength === "medium" || passwordStrength === "strong"
                          ? "bg-yellow-600"
                          : "bg-muted"
                      }`}
                    />
                    <div
                      className={`flex-1 rounded-full ${
                        passwordStrength === "strong" ? "bg-green-600" : "bg-muted"
                      }`}
                    />
                  </div>
                  <p className={`text-xs ${strengthColors[passwordStrength || "weak"]}`}>
                    Strength: {passwordStrength ? passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1) : "N/A"}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password *</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  disabled={changePasswordMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Passwords match
                </p>
              )}
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Passwords do not match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={!isFormValid || changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? "Changing Password..." : "Change Password"}
            </Button>

            {/* Info Box */}
            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Security Note:</strong> You will be logged out after changing your password. Please login again with your new password.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
