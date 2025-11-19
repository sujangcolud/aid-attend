import { useState } from "react";
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
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [aiSummary, setAiSummary] = useState<string>("");

  // Fetch students (center-specific)
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Filter students by grade
  const filteredStudents = students.filter(s => gradeFilter === "all" || s.grade === gradeFilter);

  // Fetch attendance
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["student-attendance", selectedStudentId, dateRange],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .order("date");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Fetch chapter progress with date range
  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["student-chapters", selectedStudentId, subjectFilter, dateRange],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase.from("student_chapters").select("*, chapters(*)").eq("student_id", selectedStudentId);
      if (subjectFilter !== "all") query = query.eq("chapters.subject", subjectFilter);
      query = query.gte("date_completed", format(dateRange.from, "yyyy-MM-dd")).lte("date_completed", format(dateRange.to, "yyyy-MM-dd"));
      const { data, error } = await query.order("date_completed", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Fetch all chapters (center-specific)
  const { data: allChapters = [] } = useQuery({
    queryKey: ["all-chapters", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("chapters").select("*");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch test results
  const { data: testResults = [] } = useQuery({
    queryKey: ["student-test-results", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase.from("test_results").select("*, tests(*)").eq("student_id", selectedStudentId);
      if (subjectFilter !== "all") query = query.eq("tests.subject", subjectFilter);
      const { data, error } = await query.order("date_taken", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Statistics
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

  const subjects = Array.from(new Set([
    ...chapterProgress.map(c => c.chapters?.subject).filter(Boolean),
    ...testResults.map(t => t.tests?.subject).filter(Boolean)
  ]));

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // AI Summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-student-summary", {
        body: { studentId: selectedStudentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAiSummary(data.summary);
      toast.success("AI summary generated successfully");
    },
    onError: (error: any) => {
      console.error("Error generating summary:", error);
      if (error.message?.includes("429")) toast.error("Rate limit exceeded");
      else if (error.message?.includes("402")) toast.error("AI credits depleted");
      else toast.error("Failed to generate AI summary");
    },
  });

  // Export CSV
  const exportToCSV = () => {
    if (!selectedStudent) return;

    const csvContent = [
      ["Student Report"],
      ["Name", selectedStudent.name],
      ["Grade", selectedStudent.grade],
      [""],
      ["Attendance Summary"],
      ["Total Days", totalDays],
      ["Present", presentDays],
      ["Absent", totalDays - presentDays],
      ["Percentage", attendancePercentage + "%"],
      [""],
      ["Chapter Progress"],
      ["Chapter", "Subject", "Date Completed", "Status"],
      ...chapterProgress.map(c => [
        c.chapters?.chapter_name,
        c.chapters?.subject,
        format(new Date(c.date_completed), "PPP"),
        c.completed ? "Completed" : "In Progress"
      ]),
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Student Report</h1>
        {selectedStudentId && (
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Grade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {Array.from(new Set(students.map(s => s.grade))).map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Student" /></SelectTrigger>
          <SelectContent>
            {filteredStudents.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name} - Grade {s.grade}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            type="date"
            value={format(dateRange.from, "yyyy-MM-dd")}
            onChange={e => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
          />
          <Input
            type="date"
            value={format(dateRange.to, "yyyy-MM-dd")}
            onChange={e => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
          />
        </div>
      </div>

      {selectedStudent && (
        <>
          {/* Attendance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Attendance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <div>Total Days: {totalDays}</div>
                <div className="text-green-600">Present: {presentDays}</div>
                <div className="text-red-600">Absent: {totalDays - presentDays}</div>
                <div>Attendance %: {attendancePercentage}%</div>
              </div>
              <div className="overflow-x-auto max-h-64 border rounded">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Time In</th>
                      <th className="px-4 py-2">Time Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map(record => (
                      <tr key={record.id} className="border-t">
                        <td className="px-4 py-2">{format(new Date(record.date), "PPP")}</td>
                        <td className={`px-4 py-2 ${record.status === "Present" ? "text-green-600" : "text-red-600"}`}>{record.status}</td>
                        <td className="px-4 py-2">{record.time_in || "-"}</td>
                        <td className="px-4 py-2">{record.time_out || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Chapters Studied Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Chapters Studied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-64 border rounded">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2">Chapter</th>
                      <th className="px-4 py-2">Subject</th>
                      <th className="px-4 py-2">Date Completed</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chapterProgress.map(cp => (
                      <tr key={cp.id} className="border-t">
                        <td className="px-4 py-2">{cp.chapters?.chapter_name}</td>
                        <td className="px-4 py-2">{cp.chapters?.subject}</td>
                        <td className="px-4 py-2">{format(new Date(cp.date_completed), "PPP")}</td>
                        <td className={`px-4 py-2 ${cp.completed ? "text-green-600" : "text-yellow-600"}`}>
                          {cp.completed ? "Completed" : "In Progress"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div>Total Tests: {totalTests}</div>
                <div>Average Score: {averagePercentage}%</div>
                <div>Total Marks: {totalMarksObtained}/{totalMaxMarks}</div>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader className="flex justify-between">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Performance Summary
              </CardTitle>
              <Button onClick={() => generateSummaryMutation.mutate()} size="sm">
                {generateSummaryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Generate"
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {aiSummary ? (
                <Textarea value={aiSummary} rows={12} className="resize-none" onChange={e => setAiSummary(e.target.value)} />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Click "Generate AI Summary" to get insights about this student's performance
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
