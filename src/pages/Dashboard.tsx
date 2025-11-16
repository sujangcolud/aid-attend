import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  const centerId = user?.center_id;

  // ---------------------------
  // 1️⃣ Fetch all students for center
  // ---------------------------
  const { data: students = [] } = useQuery({
    queryKey: ["students", centerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id")
        .eq("center_id", centerId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !loading,
  });

  // ---------------------------
  // 2️⃣ Fetch today's attendance
  // ---------------------------
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", centerId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("date", today)
        .eq("center_id", centerId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !loading,
  });

  // ---------------------------
  // 3️⃣ Calculate counts
  // ---------------------------
  const presentCount = attendance.filter(a => a.status === "Present").length;
  const absentCount = students.length - presentCount;
  const attendanceRate = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

  const stats = [
    { title: "Total Students", value: students.length, icon: Users, color: "text-primary", bgColor: "bg-primary/10" },
    { title: "Present Today", value: presentCount, icon: CheckCircle2, color: "text-secondary", bgColor: "bg-secondary/10" },
    { title: "Absent Today", value: absentCount, icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10" },
    { title: "Attendance Rate", value: `${attendanceRate}%`, icon: TrendingUp, color: "text-accent", bgColor: "bg-accent/10" },
  ];

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back! Here's today's attendance overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => {
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
