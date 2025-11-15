import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * CenterDashboard
 * This component is for tuition center users to view their own center's data.
 * Displays total students, today's attendance, and attendance rate in cards.
 * All queries are filtered by the center_id of the logged-in user.
 */

export default function CenterDashboard() {
  const { user, loading } = useAuth();

  // ---------------------------
  // Role / Access check
  // ---------------------------
  if (!user) return <p>Loading user info...</p>;
  if (user.role === "admin") return <p>Admins should use the Admin Dashboard.</p>;

  const centerId = user.center_id;

  // ---------------------------
  // Date helpers
  // ---------------------------
  const today = new Date();
  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const todayString = formatDate(today);

  // ---------------------------
  // State for debugging/logging
  // ---------------------------
  const [debugAttendance, setDebugAttendance] = useState<any[]>([]);

  // ---------------------------
  // 1️⃣ Fetch total students
  // ---------------------------
  const { data: studentsCount, isLoading: loadingStudents } = useQuery({
    queryKey: ["students-count", centerId],
    queryFn: async () => {
      if (!centerId) return 0;
      const { count, error } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("center_id", centerId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!centerId && !loading,
  });

  // ---------------------------
  // 2️⃣ Fetch today's attendance
  // ---------------------------
  const { data: todayAttendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ["today-attendance", todayString, centerId],
    queryFn: async () => {
      if (!centerId) return [];

      // Handle timestamp vs date safely
      const startOfDay = new Date(todayString + "T00:00:00.000Z").toISOString();
      const endOfDay = new Date(todayString + "T23:59:59.999Z").toISOString();

      const { data, error } = await supabase
        .from("attendance")
        .select("status")
        .gte("date", startOfDay)
        .lte("date", endOfDay)
        .eq("center_id", centerId);

      if (error) throw error;

      setDebugAttendance(data || []);
      return data || [];
    },
    enabled: !!centerId && !loading,
  });

  // ---------------------------
  // 3️⃣ Calculate counts
  // ---------------------------
  const presentCount = todayAttendance?.filter(a => a.status === "Present").length || 0;
  const absentCount = todayAttendance?.filter(a => a.status === "Absent").length || 0;
  const attendanceRate = studentsCount ? Math.round((presentCount / studentsCount) * 100) : 0;

  // ---------------------------
  // 4️⃣ Stats cards setup
  // ---------------------------
  const stats = [
    {
      title: "Total Students",
      value: studentsCount || 0,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Present Today",
      value: presentCount,
      icon: CheckCircle2,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "Absent Today",
      value: absentCount,
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Attendance Rate",
      value: `${attendanceRate}%`,
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  // ---------------------------
  // 5️⃣ Loading check
  // ---------------------------
  if (loading || loadingStudents || loadingAttendance) return <p>Loading dashboard...</p>;

  // ---------------------------
  // 6️⃣ Debug / optional log
  // ---------------------------
  useEffect(() => {
    console.log("Today Attendance Data:", debugAttendance);
  }, [debugAttendance]);

  // ---------------------------
  // 7️⃣ Render
  // ---------------------------
  return (
    <div className="space-y-6 min-h-screen bg-background p-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Center Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back! Here's today's attendance overview for your center.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
