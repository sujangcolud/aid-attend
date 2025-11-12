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
import { format } from "date-fns";

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

  const { data: students } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*")
        .order("name");
      
      // Filter by center_id if user is not admin
      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: allAttendance } = useQuery({
    queryKey: ["all-attendance", user?.center_id],
    queryFn: async () => {
      // Get student IDs for this center first
      const studentIds = students?.map(s => s.id) || [];
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", studentIds);
      if (error) throw error;
      return data;
    },
    enabled: (students?.length || 0) > 0,
  });

  const grades = [...new Set(students?.map((s) => s.grade) || [])];

  const summaryData: StudentSummary[] =
    students
      ?.map((student) => {
        const studentAttendance = allAttendance?.filter((a) => a.student_id === student.id) || [];
        const present = studentAttendance.filter((a) => a.status === "Present").length;
        const absent = studentAttendance.filter((a) => a.status === "Absent").length;
        const total = present + absent;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        const absentDates = studentAttendance
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
    if (!summaryData || summaryData.length === 0) return;

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filter by Grade</CardTitle>
              <CardDescription>Select a grade to filter students</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export Summary
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student Statistics</CardTitle>
          <CardDescription>Detailed attendance breakdown per student</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryData.length > 0 ? (
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
                          className={
                            student.percentage >= 75 ? "bg-secondary hover:bg-secondary/80" : ""
                          }
                        >
                          {student.percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {student.absentDates.length > 0
                          ? student.absentDates.map((date) => format(new Date(date), "MMM d")).join(", ")
                          : "None"}
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
