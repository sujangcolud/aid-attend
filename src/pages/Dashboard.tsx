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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle2, XCircle, TrendingUp, CalendarIcon, BookOpen, FileText } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Student {
  id: string;
  name: string;
  grade: string;
  total?: number;
  present?: number;
  absent?: number;
  percentage?: number;
  status?: string;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  const [gradeFilterAbsentToday, setGradeFilterAbsentToday] = useState<string>("all");
  const [gradeFilterHighestAbsent, setGradeFilterHighestAbsent] = useState<string>("all");
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);

  const centerId = user?.center_id;
  const role = user?.role;

  // ---------------------------
  // 1️⃣ TOTAL STUDENTS COUNT
  // ---------------------------
  const { data: students } = useQuery({
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

  const grades = [...new Set(students?.map((s) => s.grade))];

  // ---------------------------
  // 2️⃣ TODAY'S ATTENDANCE
  // ---------------------------
  const { data: attendance } = useQuery({
    queryKey: ["attendance-today", today, centerId],
    queryFn: async () => {
      let query = supabase.from("attendance").select("*").eq("date", today);
      if (role !== "admin" && centerId) query = query.eq("center_id", centerId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!students,
  });

  const studentsWithStatus = students?.map((s) => {
    const todayAttendance = attendance?.find((a) => a.student_id === s.id);
    return {
      ...s,
      status: todayAttendance?.status || "Absent",
    };
  }) || [];

  const absentStudentsToday = studentsWithStatus
    .filter((s) => gradeFilterAbsentToday === "all" || s.grade === gradeFilterAbsentToday)
    .filter((s) => s.status === "Absent");

  const presentStudentsToday = studentsWithStatus.filter((s) => s.status === "Present");

  // ---------------------------
  // 3️⃣ HIGHEST ABSENT RATE
  // ---------------------------
  const { data: allAttendance } = useQuery({
    queryKey: ["all-attendance", centerId],
    queryFn: async () => {
      const studentIds = students?.map((s) => s.id) || [];
      if (!studentIds.length) return [];
      const { data, error } = await supabase.from("attendance").select("*").in("student_id", studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!students,
  });

  const highestAbsentStudents = students
    ?.map((s) => {
      const studentAttendance = allAttendance?.filter((a) => a.student_id === s.id) || [];
      const present = studentAttendance.filter((a) => a.status === "Present").length;
      const absent = studentAttendance.filter((a) => a.status === "Absent").length;
      const total = present + absent;
      const percentage = total > 0 ? Math.round((absent / total) * 100) : 0;
      return { ...s, total, present, absent, percentage };
    })
    .filter((s) => gradeFilterHighestAbsent === "all" || s.grade === gradeFilterHighestAbsent)
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

  // ---------------------------
  // 4️⃣ CARDS DATA
  // ---------------------------
  const totalStudents = students?.length || 0;
  const presentCount = presentStudentsToday.length;
  const absentCount = absentStudentsToday.length;
  const absentRate = totalStudents ? Math.round((absentCount / totalStudents) * 100) : 0;

  const stats = [
    { title: "Total Students", value: totalStudents, icon: Users, color: "text-primary", bgColor: "bg-primary/10" },
    { title: "Present Today", value: presentCount, icon: CheckCircle2, color: "text-secondary", bgColor: "bg-secondary/10" },
    { title: "Absent Today", value: absentCount, icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10" },
    { title: "Absent Rate", value: `${absentRate}%`, icon: TrendingUp, color: "text-accent", bgColor: "bg-accent/10" },
  ];

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Here's today's attendance overview.</p>
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

      {/* Tables side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Absent Today */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Absent Students Today</CardTitle>
            <Select value={gradeFilterAbsentToday} onValueChange={setGradeFilterAbsentToday}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[400px]">
            <Table className="w-full">
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

        {/* Highest Absentee */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Highest Absentee Students</CardTitle>
            <Select value={gradeFilterHighestAbsent} onValueChange={setGradeFilterHighestAbsent}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[400px]">
            <Table className="w-full">
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
      </div>

      {/* Student Details Modal */}
      <Dialog open={!!selectedStudentForModal} onOpenChange={() => setSelectedStudentForModal(null)}>
        <DialogContent className="max-w-3xl">
          {selectedStudentForModal && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedStudentForModal.name} - Grade {selectedStudentForModal.grade}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Days</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedStudentForModal.total || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Present</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedStudentForModal.present || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Absent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedStudentForModal.absent || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Absent %</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedStudentForModal.percentage || 0}%</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
