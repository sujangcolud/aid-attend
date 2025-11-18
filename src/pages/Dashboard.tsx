import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CalendarIcon,
  BookOpen,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const centerId = user?.center_id;
  const role = user?.role;

  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", centerId],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (role !== "admin" && centerId) query = query.eq("center_id", centerId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !loading,
  });

  const filteredStudents = students.filter(
    (s) => gradeFilter === "all" || s.grade === gradeFilter
  );

  const grades = [...new Set(students.map((s) => s.grade))];

  // Fetch attendance
  const { data: allAttendance = [] } = useQuery({
    queryKey: ["attendance", centerId],
    queryFn: async () => {
      const studentIds = students.map((s) => s.id);
      if (!studentIds.length) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: students.length > 0,
  });

  // Statistics
  const presentToday = students.filter((student) =>
    allAttendance.some(
      (att) =>
        att.student_id === student.id &&
        att.date === today &&
        att.status === "Present"
    )
  );

  const absentToday = students.filter((student) =>
    allAttendance.some(
      (att) =>
        att.student_id === student.id &&
        att.date === today &&
        att.status === "Absent"
    )
  );

  const totalStudents = students.length;
  const presentCount = presentToday.length;
  const absentCount = absentToday.length;
  const absentRate = totalStudents
    ? Math.round((absentCount / totalStudents) * 100)
    : 0;

  const studentAttendanceSummary = students.map((student) => {
    const studentAttendance = allAttendance.filter(
      (a) => a.student_id === student.id
    );
    const present = studentAttendance.filter((a) => a.status === "Present")
      .length;
    const absent = studentAttendance.filter((a) => a.status === "Absent").length;
    const total = present + absent;
    const percentage = total > 0 ? Math.round((absent / total) * 100) : 0;
    return { ...student, present, absent, total, percentage };
  });

  const highestAbsentees = [...studentAttendanceSummary]
    .sort((a, b) => b.percentage - a.percentage)
    .filter((s) => gradeFilter === "all" || s.grade === gradeFilter);

  // Student-specific data
  const studentId = selectedStudent?.id;

  const { data: attendanceData = [] } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", studentId)
        .order("date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });

  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["student-chapters", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("student_chapters")
        .select("*, chapters(*)")
        .eq("student_id", studentId)
        .order("date_completed", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });

  const { data: testResults = [] } = useQuery({
    queryKey: ["student-test-results", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("test_results")
        .select("*, tests(*)")
        .eq("student_id", studentId)
        .order("date_taken", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });

  const totalDays = attendanceData.length;
  const presentDays = attendanceData.filter((a) => a.status === "Present")
    .length;
  const attendancePercentage =
    totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const totalChaptersCount = chapterProgress.length;
  const completedChaptersCount = chapterProgress.filter((c) => c.completed)
    .length;
  const chapterCompletionPercentage =
    totalChaptersCount > 0
      ? Math.round((completedChaptersCount / totalChaptersCount) * 100)
      : 0;

  const totalTests = testResults.length;
  const totalMarksObtained = testResults.reduce(
    (sum, r) => sum + r.marks_obtained,
    0
  );
  const totalMaxMarks = testResults.reduce(
    (sum, r) => sum + (r.tests?.total_marks || 0),
    0
  );
  const averagePercentage =
    totalMaxMarks > 0
      ? Math.round((totalMarksObtained / totalMaxMarks) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back! Here's today's attendance overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: "Total Students", value: totalStudents, icon: Users, color: "text-primary", bgColor: "bg-primary/10" },
          { title: "Present Today", value: presentCount, icon: CheckCircle2, color: "text-secondary", bgColor: "bg-secondary/10" },
          { title: "Absent Today", value: absentCount, icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10" },
          { title: "Absent Rate", value: `${absentRate}%`, icon: TrendingUp, color: "text-accent", bgColor: "bg-accent/10" },
        ].map((stat) => {
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

      {/* Grade Filter */}
      <div className="flex gap-4 items-center">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {grades.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tables side by side */}
      <div className="flex gap-6 overflow-x-auto">
        {/* Absent Today */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Absent Today</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-center">Absent Today</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absentToday.map((student) => (
                  <TableRow
                    key={student.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell className="text-center">
                      {allAttendance.filter(
                        (a) =>
                          a.student_id === student.id &&
                          a.date === today &&
                          a.status === "Absent"
                      ).length}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Highest Absentee */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Highest Absentee</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-center">Absent %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highestAbsentees.map((student) => (
                  <TableRow
                    key={student.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell className="text-center">{student.percentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Student Report Modal */}
      {selectedStudent && (
        <Dialog
          open={!!selectedStudent}
          onOpenChange={() => setSelectedStudent(null)}
        >
          <DialogContent className="max-w-5xl w-full h-[90vh] overflow-auto">
            <DialogHeader className="sticky top-0 bg-background z-10">
              <DialogTitle className="text-2xl font-bold">
                {selectedStudent.name} - Grade {selectedStudent.grade}
              </DialogTitle>
            </DialogHeader>

            {/* Attendance Overview */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Attendance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Days</p>
                    <p className="text-2xl font-bold">{totalDays}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Present</p>
                    <p className="text-2xl font-bold text-green-600">{presentDays}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Absent</p>
                    <p className="text-2xl font-bold text-red-600">{totalDays - presentDays}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Attendance %</p>
                    <p className="text-2xl font-bold">{attendancePercentage}%</p>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceData.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{format(new Date(record.date), "PPP")}</TableCell>
                          <TableCell>
                            <Badge variant={record.status === "Present" ? "success" : "destructive"}>
                              {record.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Chapter Progress */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Chapter Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Chapters</p>
                    <p className="text-2xl font-bold">{totalChaptersCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{completedChaptersCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Progress %</p>
                    <p className="text-2xl font-bold">{chapterCompletionPercentage}%</p>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {chapterProgress.map((cp) => (
                    <Card key={cp.id} className="p-2">
                      <CardContent>
                        <p className="font-medium">{cp.chapters?.chapter_name}</p>
                        <p className="text-sm text-muted-foreground">{cp.chapters?.subject}</p>
                        <Badge variant={cp.completed ? "success" : "secondary"}>
                          {cp.completed ? "Completed" : "In Progress"}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Test Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Test Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tests</p>
                    <p className="text-2xl font-bold">{totalTests}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Average %</p>
                    <p className="text-2xl font-bold">{averagePercentage}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Marks</p>
                    <p className="text-2xl font-bold">{totalMarksObtained}/{totalMaxMarks}</p>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {testResults.map((result) => (
                    <Card key={result.id} className="p-2">
                      <CardContent>
                        <p className="font-medium">{result.tests?.name}</p>
                        <p className="text-sm text-muted-foreground">{result.tests?.subject}</p>
                        <p>{result.marks_obtained}/{result.tests?.total_marks}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
