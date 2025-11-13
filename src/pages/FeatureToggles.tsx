import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function FeatureToggles() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: featureToggles = [], isLoading } = useQuery({
    queryKey: ["feature-toggles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_toggles")
        .select("*")
        .order("feature_name");
      if (error) throw error;
      return data;
    },
    enabled: user?.role === "admin",
  });

  const updateToggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number; is_enabled: boolean }) => {
      const { error } = await supabase
        .from("feature_toggles")
        .update({ is_enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-toggles"] });
      toast.success("Feature toggle updated successfully");
    },
    onError: () => {
      toast.error("Failed to update feature toggle");
    },
  });

  if (user?.role !== "admin") {
    return <div>You do not have permission to access this page.</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Toggles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {featureToggles.map((toggle) => (
          <div key={toggle.id} className="flex items-center justify-between p-4 border rounded-lg">
            <Label htmlFor={`toggle-${toggle.id}`} className="text-lg font-medium">
              {toggle.feature_name}
            </Label>
            <Switch
              id={`toggle-${toggle.id}`}
              checked={toggle.is_enabled}
              onCheckedChange={(isChecked) =>
                updateToggleMutation.mutate({ id: toggle.id, is_enabled: isChecked })
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
