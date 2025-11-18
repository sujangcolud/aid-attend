import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";

interface StudentSummary {
  id: string;
  name: string;
  grade: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  absentDates: string[];
}

export default function Summary() {
  const { user } = useAuth();
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>(format(new Date(), "yyyy-MM"));

  // Fetch students
  const { data: students } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance
  const { data: allAttendance } = useQuery({
    queryKey: ["all-attendance", user?.center_id],
    queryFn: async () => {
      const studentIds = students?.map((s) => s.id) || [];
      if (!studentIds.length) return [];
      const { data, error } = await supabase.from("attendance").select("*").in("student_id", studentIds);
      if (error) throw error;
      return data;
    },
    enabled: !!students?.length,
  });

  const grades = [...new Set(students?.map((s) => s.grade) || [])];

  const summaryData: StudentSummary[] =
    students
      ?.map((student) => {
        const studentAttendance = allAttendance?.filter((a) => a.student_id === student.id) || [];

        // Apply month filter
        const filteredAttendance = studentAttendance.filter((a) => {
          if (!monthFilter) return true;
          const date = parseISO(a.date);
          const start = startOfMonth(parseISO(monthFilter + "-01"));
          const end = endOfMonth(parseISO(monthFilter + "-01"));
          return isWithinInterval(date, { start, end });
        });

        const present = filteredAttendance.filter((a) => a.status === "Present").length;
        const absent = filteredAttendance.filter((a) => a.status === "Absent").length;
        const total = present + absent;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        const absentDates = filteredAttendance
          .filter((a) => a.status === "Absent")
          .map((a) => a.date)
          .sort();

        return {
          id: student.id,
          name: student.name,
          grade: student.grade,
          present,
          absent,
          total,
          percentage,
          absentDates,
        };
      })
      .filter((s) => gradeFilter === "all" || s.grade === gradeFilter) || [];

  const exportToCSV = () => {
    if (!summaryData || !summaryData.length) return;

    const headers = ["Name", "Grade", "Present", "Absent", "Total Days", "Attendance %", "Absent Dates"];
    const rows = summaryData.map((student) => [
      student.name,
      student.grade,
      student.present,
      student.absent,
      student.total,
      `${student.percentage}%`,
      student.absentDates.join("; "),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-summary-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Attendance Summary</h2>
        <p className="text-muted-foreground">View detailed attendance statistics</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter students by grade and month</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" /> Export Summary
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Select grade" />
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

          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-36 px-2 py-1 border rounded-md"
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Statistics</CardTitle>
          <CardDescription>Detailed attendance breakdown per student</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryData.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Total Days</TableHead>
                    <TableHead className="text-center">Attendance %</TableHead>
                    <TableHead>Absent Dates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.grade}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-secondary hover:bg-secondary/80">
                          {student.present}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive">{student.absent}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{student.total}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={student.percentage >= 75 ? "default" : "destructive"}
                          className={student.percentage >= 75 ? "bg-secondary hover:bg-secondary/80" : ""}
                        >
                          {student.percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs overflow-x-auto">
                        <div className="whitespace-nowrap">
                          {student.absentDates.length > 0
                            ? student.absentDates.map((d) => format(new Date(d), "MMM d")).join(", ")
                            : "None"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No attendance data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
