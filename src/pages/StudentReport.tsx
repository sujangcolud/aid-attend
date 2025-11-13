import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Download, Brain, Loader2, BookOpen, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export default function StudentReport() {
  const { user } = useAuth();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [aiSummary, setAiSummary] = useState<string>("");

  // Frontend-only fee info
  const [studentFee, setStudentFee] = useState<{
    joiningDate: string;
    monthlyFee: number;
    paid: Record<string, boolean>;
  }>({
    joiningDate: "",
    monthlyFee: 0,
    paid: {},
  });

  // Fetch students filtered by center for non-admin
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Update frontend fee info when student changes
  useEffect(() => {
    if (!selectedStudentId) return;
    const student = students.find(s => s.id === selectedStudentId);
    if (student) {
      setStudentFee({
        joiningDate: student.joiningDate || "",
        monthlyFee: student.monthlyFee || 0,
        paid: student.paid || {},
      });
    }
  }, [selectedStudentId, students]);

  // Fetch attendance for selected student
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["student-attendance", selectedStudentId, dateRange],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", dateRange.from.toISOString().split("T")[0])
        .lte("date", dateRange.to.toISOString().split("T")[0])
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Fetch student chapters (filter in JS for subject)
  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["student-chapters", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("student_chapters")
        .select("*, chapters(*)")
        .eq("student_id", selectedStudentId)
        .order("date_completed", { ascending: false });
      if (error) throw error;
      if (subjectFilter === "all") return data;
      return data.filter((c: any) => c.chapters?.subject === subjectFilter);
    },
    enabled: !!selectedStudentId,
  });

  // Fetch all chapters
  const { data: allChapters = [] } = useQuery({
    queryKey: ["all-chapters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch test results
  const { data: testResults = [] } = useQuery({
    queryKey: ["student-test-results", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("test_results")
        .select("*, tests(*)")
        .eq("student_id", selectedStudentId)
        .order("date_taken", { ascending: false });
      if (error) throw error;
      if (subjectFilter === "all") return data;
      return data.filter((t: any) => t.tests?.subject === subjectFilter);
    },
    enabled: !!selectedStudentId,
  });

  // Stats
  const totalDays = attendanceData.length;
  const presentDays = attendanceData.filter(a => a.status === "Present").length;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const totalTests = testResults.length;
  const totalMarksObtained = testResults.reduce((sum, r) => sum + r.marks_obtained, 0);
  const totalMaxMarks = testResults.reduce((sum, r) => sum + (r.tests?.total_marks || 0), 0);
  const averagePercentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;

  const completedChaptersCount = chapterProgress.filter(cp => cp.completed).length;
  const totalChaptersCount = allChapters.length;
  const chapterCompletionPercentage = totalChaptersCount > 0
    ? Math.round((completedChaptersCount / totalChaptersCount) * 100)
    : 0;

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Generate CSV
  const exportToCSV = () => {
    if (!selectedStudent) return;
    const csvContent = [
      ["Student Report"],
      ["Name", selectedStudent.name],
      ["Grade", selectedStudent.grade],
      ["Joining Date", studentFee.joiningDate],
      ["Monthly Fee", studentFee.monthlyFee],
      [""],
      ["Attendance Summary"],
      ["Total Days", totalDays],
      ["Present", presentDays],
      ["Absent", totalDays - presentDays],
      ["Percentage", attendancePercentage + "%"],
      [""],
      ["Test Results"],
      ["Test Name", "Subject", "Marks Obtained", "Total Marks", "Date"],
      ...testResults.map(r => [
        r.tests?.name,
        r.tests?.subject,
        r.marks_obtained,
        r.tests?.total_marks,
        format(new Date(r.date_taken), "PPP")
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedStudent.name}_report.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Student Report</h1>
        {selectedStudentId && (
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Student Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Student</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name} - Grade {student.grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedStudent && (
        <>
          {/* Fee Info */}
          <Card>
            <CardHeader>
              <CardTitle>Fee Details (Frontend Only)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={studentFee.joiningDate}
                  onChange={(e) => setStudentFee({ ...studentFee, joiningDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Monthly Fee</Label>
                <Input
                  type="number"
                  value={studentFee.monthlyFee}
                  onChange={(e) => setStudentFee({ ...studentFee, monthlyFee: Number(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Attendance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Total Days: {totalDays}</p>
              <p>Present: {presentDays}</p>
              <p>Absent: {totalDays - presentDays}</p>
              <p>Percentage: {attendancePercentage}%</p>
            </CardContent>
          </Card>

          {/* Chapter Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Chapters Studied</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Completed: {completedChaptersCount} / {totalChaptersCount}</p>
              <p>Completion: {chapterCompletionPercentage}%</p>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Total Tests: {totalTests}</p>
              <p>Average Percentage: {averagePercentage}%</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
