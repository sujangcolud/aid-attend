import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle2, XCircle, TrendingUp, BookOpen, FileText, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd
  const centerId = user?.center_id;
  const role = user?.role;

  const [gradeFilterAbsentToday, setGradeFilterAbsentToday] = useState("all");
  const [gradeFilterHighestAbsent, setGradeFilterHighestAbsent] = useState("all");
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);

  // ---------------------------
  // 1️⃣ Students Data
  // ---------------------------
  const { data: students = [] } = useQuery({
    queryKey: ["students", centerId],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (role !== "admin") query = query.eq("center_id", centerId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const studentIds = students.map((s) => s.id);

  // ---------------------------
  // 2️⃣ Attendance Today
  // ---------------------------
  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["today-attendance", today, centerId],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today)
        .in("student_id", studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: studentIds.length > 0,
  });

  const presentCount = todayAttendance.filter((a) => a.status === "Present").length;
  const absentCount = Math.max(0, (students?.length || 0) - presentCount);
  const absentRate = students?.length ? Math.round((absentCount / students.length) * 100) : 0;

  // ---------------------------
  // 3️⃣ Stats Cards
  // ---------------------------
  const stats = [
    {
      title: "Total Students",
      value: students.length || 0,
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
      title: "Absent Rate",
      value: `${absentRate}%`,
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  // ---------------------------
  // 4️⃣ Absent Students Today Table
  // ---------------------------
  const absentStudentsToday = students
    .map((student) => {
      const attendance = todayAttendance.find((a) => a.student_id === student.id);
      return {
        ...student,
        status: attendance?.status || "Absent",
      };
    })
    .filter((s) => s.status === "Absent")
    .filter((s) => gradeFilterAbsentToday === "all" || s.grade === gradeFilterAbsentToday);

  // ---------------------------
  // 5️⃣ Highest Absentee Students
  // ---------------------------
  const { data: allAttendance = [] } = useQuery({
    queryKey: ["all-attendance", centerId],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: studentIds.length > 0,
  });

  const highestAbsentStudents = students
    .map((student) => {
      const studentAttendance = allAttendance.filter((a) => a.student_id === student.id);
      const total = studentAttendance.length;
      const absent = studentAttendance.filter((a) => a.status === "Absent").length;
      const percentage = total > 0 ? Math.round((absent / total) * 100) : 0;
      return { ...student, total, absent, percentage };
    })
    .filter((s) => gradeFilterHighestAbsent === "all" || s.grade === gradeFilterHighestAbsent)
    .sort((a, b) => b.percentage - a.percentage);

  if (loading) return <p>Loading dashboard...</p>;

  const grades = Array.from(new Set(students.map((s) => s.grade)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back! Here's today's attendance overview.</p>
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

      {/* 1️⃣ Absent Today Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Absent Students Today</CardTitle>
          </div>
          <Select value={gradeFilterAbsentToday} onValueChange={setGradeFilterAbsentToday}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {absentStudentsToday.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedStudentForModal(s)}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.grade}</TableCell>
                  <TableCell>{s.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 2️⃣ Highest Absentee Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Highest Absentee Students</CardTitle>
          </div>
          <Select value={gradeFilterHighestAbsent} onValueChange={setGradeFilterHighestAbsent}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Total Days</TableHead>
                <TableHead>Absent Days</TableHead>
                <TableHead>Absent %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {highestAbsentStudents.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedStudentForModal(s)}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.grade}</TableCell>
                  <TableCell>{s.total}</TableCell>
                  <TableCell>{s.absent}</TableCell>
                  <TableCell>{s.percentage}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal for Student Report */}
      {selectedStudentForModal && (
        <Dialog open={!!selectedStudentForModal} onOpenChange={() => setSelectedStudentForModal(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedStudentForModal.name} - Grade {selectedStudentForModal.grade}</DialogTitle>
            </DialogHeader>
            <StudentReportModalContent student={selectedStudentForModal} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Modal Content Component
function StudentReportModalContent({ student }) {
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["attendance", student.id],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("student_id", student.id).order("date");
      return data;
    },
  });

  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["student-chapters", student.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_chapters").select("*, chapters(*)").eq("student_id", student.id);
      return data;
    },
  });

  const { data: testResults = [] } = useQuery({
    queryKey: ["student-test-results", student.id],
    queryFn: async () => {
      const { data } = await supabase.from("test_results").select("*, tests(*)").eq("student_id", student.id);
      return data;
    },
  });

  const totalDays = attendanceData.length;
  const presentDays = attendanceData.filter((a) => a.status === "Present").length;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const totalChapters = chapterProgress.length;
  const completedChapters = chapterProgress.filter(cp => cp.completed).length;
  const chapterCompletionPercentage = totalChapters ? Math.round((completedChapters / totalChapters) * 100) : 0;

  const totalTests = testResults.length;
  const totalMarksObtained = testResults.reduce((sum, r) => sum + r.marks_obtained, 0);
  const totalMaxMarks = testResults.reduce((sum, r) => sum + (r.tests?.total_marks || 0), 0);
  const averagePercentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Total Days: {totalDays}</p>
          <p>Present: {presentDays}</p>
          <p>Absent: {totalDays - presentDays}</p>
          <p>Attendance %: {attendancePercentage}%</p>
        </CardContent>
      </Card>

      {/* Chapters */}
      <Card>
        <CardHeader>
          <CardTitle>Chapter Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Total Chapters: {totalChapters}</p>
          <p>Completed: {completedChapters}</p>
          <p>Progress: {chapterCompletionPercentage}%</p>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {testResults.map((r) => (
            <div key={r.id} className="p-2 border rounded">
              <p><strong>{r.tests?.name}</strong> ({r.tests?.subject})</p>
              <p>{r.marks_obtained} / {r.tests?.total_marks} ({Math.round((r.marks_obtained / (r.tests?.total_marks || 1)) * 100)}%)</p>
            </div>
          ))}
          {testResults.length === 0 && <p className="text-muted-foreground">No test results recorded</p>}
        </CardContent>
      </Card>
    </div>
  );
}
