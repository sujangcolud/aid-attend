import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: studentsCount } = useQuery({
    queryKey: ["students-count", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*", { count: "exact", head: true });

      // Filter by center_id if user is not admin
      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }

      const { count } = await query;
      return count || 0;
    },
  });

  const { data: todayAttendance } = useQuery({
    queryKey: ["today-attendance", today, user?.center_id],
    queryFn: async () => {
      // First, get student IDs for this center
      let studentQuery = supabase
        .from("students")
        .select("id");

      if (user?.role !== 'admin' && user?.center_id) {
        studentQuery = studentQuery.eq('center_id', user.center_id);
      }

      const { data: students } = await studentQuery;
      if (!students || students.length === 0) return [];

      const studentIds = students.map(s => s.id);
      const { data } = await supabase
        .from("attendance")
        .select("status")
        .eq("date", today)
        .in("student_id", studentIds);
      return data || [];
    },
  });

  const presentCount = todayAttendance?.filter((a) => a.status === "Present").length || 0;
  const absentCount = todayAttendance?.filter((a) => a.status === "Absent").length || 0;
  const attendanceRate = studentsCount ? Math.round((presentCount / studentsCount) * 100) : 0;

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back! Here's today's attendance overview.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get you started</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <a
            href="/register"
            className="group rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
          >
            <h3 className="font-semibold group-hover:text-primary">Register New Student</h3>
            <p className="text-sm text-muted-foreground">Add a new student to the system</p>
          </a>
          <a
            href="/attendance"
            className="group rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
          >
            <h3 className="font-semibold group-hover:text-primary">Take Attendance</h3>
            <p className="text-sm text-muted-foreground">Mark today's attendance</p>
          </a>
          <a
            href="/summary"
            className="group rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
          >
            <h3 className="font-semibold group-hover:text-primary">View Summary</h3>
            <p className="text-sm text-muted-foreground">Check attendance statistics</p>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
