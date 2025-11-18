import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd
  const centerId = user?.center_id;
  const role = user?.role;
  const navigate = useNavigate();

  const [gradeFilter, setGradeFilter] = useState("all");

  // ---------------------------
  // 1️⃣ FETCH STUDENTS
  // ---------------------------
  const { data: students } = useQuery({
    queryKey: ["students", centerId],
    queryFn: async () => {
      let query = supabase.from("students").select("id, name, grade");
      if (role !== "admin") query = query.eq("center_id", centerId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !loading,
  });

  const filteredStudents = students?.filter(s => gradeFilter === "all" || s.grade === gradeFilter) || [];
  const studentsCount = filteredStudents.length;

  // ---------------------------
  // 2️⃣ FETCH ATTENDANCE TODAY
  // ---------------------------
  const { data: attendanceToday } = useQuery({
    queryKey: ["today-attendance", today, centerId],
    queryFn: async () => {
      if (!filteredStudents || filteredStudents.length === 0) return [];
      const studentIds = filteredStudents.map(s => s.id);
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .in("student_id", studentIds)
        .eq("date", today);
      if (error) throw error;
      return data || [];
    },
    enabled: !!filteredStudents && filteredStudents.length > 0,
  });

  const presentStudents = filteredStudents.filter(s =>
    attendanceToday?.some(a => a.student_id === s.id && a.status === "Present")
  );
  const absentStudents = filteredStudents.filter(s =>
    !attendanceToday?.some(a => a.student_id === s.id && a.status === "Present")
  );

  // ---------------------------
  // 3️⃣ FETCH ALL-TIME ATTENDANCE TO CALCULATE ABSENT RATE
  // ---------------------------
  const { data: allAttendance } = useQuery({
    queryKey: ["all-attendance", centerId],
    queryFn: async () => {
      if (!filteredStudents || filteredStudents.length === 0) return [];
      const studentIds = filteredStudents.map(s => s.id);
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .in("student_id", studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!filteredStudents && filteredStudents.length > 0,
  });

  const absentRates: Record<string, number> = {};
  filteredStudents.forEach(s => {
    const studentAttendance = allAttendance?.filter(a => a.student_id === s.id) || [];
    const total = studentAttendance.length;
    const absentCount = studentAttendance.filter(a => a.status === "Absent").length;
    absentRates[s.id] = total > 0 ? Math.round((absentCount / total) * 100) : 0;
  });

  const overallAbsentRate = studentsCount
    ? Math.round((absentStudents.length / studentsCount) * 100)
    : 0;

  // Students sorted by highest absent rate
  const highestAbsentees = [...filteredStudents].sort(
    (a, b) => (absentRates[b.id] || 0) - (absentRates[a.id] || 0)
  );

  if (loading) return <p>Loading dashboard...</p>;

  const grades = [...new Set(students?.map(s => s.grade))];

  return (
    <div className="space-y-6">
      {/* Dashboard Title */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back! Here's today's attendance overview.
        </p>
      </div>

      {/* Top Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <div className="rounded-lg p-2 bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{studentsCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <div className="rounded-lg p-2 bg-secondary/10">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{presentStudents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
            <div className="rounded-lg p-2 bg-destructive/10">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absentStudents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Rate</CardTitle>
            <div className="rounded-lg p-2 bg-accent/10">
              <TrendingUp className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallAbsentRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Grade Filter */}
      <div className="flex gap-4">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {grades.map(g => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Absent Students Today Table */}
      <Card>
        <CardHeader>
          <CardTitle>Absent Students Today</CardTitle>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto">
          {absentStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Absent Rate %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absentStudents.map(student => (
                  <TableRow
                    key={student.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/student-report?studentId=${student.id}`)}
                  >
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell>{absentRates[student.id]}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground">No absent students today</p>
          )}
        </CardContent>
      </Card>

      {/* Highest Absentee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Highest Absentee Students</CardTitle>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto">
          {highestAbsentees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Absent Rate %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highestAbsentees.map(student => (
                  <TableRow
                    key={student.id}
                    className={`cursor-pointer ${absentRates[student.id] === Math.max(...Object.values(absentRates)) ? "bg-red-100" : ""}`}
                    onClick={() => navigate(`/student-report?studentId=${student.id}`)}
                  >
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell>{absentRates[student.id]}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground">No student data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
