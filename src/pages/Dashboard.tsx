import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();

  const centerId = user?.center_id;
  const role = user?.role;
  const today = new Date().toISOString().split("T")[0];

  // ---------------------------
  // 1️⃣ TOTAL STUDENTS COUNT
  // ---------------------------
  const { data: studentsCount } = useQuery({
    queryKey: ["students-count", centerId],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*", { count: "exact", head: true });

      // Admin sees all centers
      if (role !== "admin") {
        query = query.eq("center_id", centerId);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user,
  });

  // ---------------------------
  // 2️⃣ TODAY'S ATTENDANCE
  // ---------------------------
  const { data: todayAttendance } = useQuery({
    queryKey: ["today-attendance", today, centerId],
    queryFn: async () => {
      let query = supabase
        .from("attendance")
        .select("status")
        .eq("date", today);

      if (role !== "admin") {
        query = query.eq("center_id", centerId);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  const presentCount = todayAttendance?.filter((a) => a.status === "present").length || 0;
  const absentCount = todayAttendance?.filter((a) => a.status === "absent").length || 0;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Students */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" /> Total Students
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{studentsCount ?? 0}</p>
        </CardContent>
      </Card>

      {/* Present Today */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-green-600">
            <CheckCircle2 className="w-5 h-5" /> Present Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{presentCount}</p>
        </CardContent>
      </Card>

      {/* Absent Today */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-red-600">
            <XCircle className="w-5 h-5" /> Absent Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{absentCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}
