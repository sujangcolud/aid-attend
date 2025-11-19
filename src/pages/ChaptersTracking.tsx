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
  const [gradeFilter, setGradeFilter] = useState<string>("all"); // Added grade filter
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

  // Fetch chapter progress
  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["student-chapters", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase.from("student_chapters").select("*, chapters(*)").eq("student_id", selectedStudentId);
      if (subjectFilter !== "all") query = query.eq("chapters.subject", subjectFilter);
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
  const presentDays = attendanceData.filter((a) => a.status === "Present").length;
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

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

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

      {/* Grade Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Grade</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {Array.from(new Set(students.map(s => s.grade))).map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Student Selector */}
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
              {filteredStudents.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name} - Grade {student.grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Sections visible only when student selected */}
      {selectedStudent && (
        <>
          {/* Date Range & Subject Filter */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <Label>Date Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={format(dateRange.from, "yyyy-MM-dd")}
                    onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
                  />
                  <Input
                    type="date"
                    value={format(dateRange.to, "yyyy-MM-dd")}
                    onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Label>Filter by Subject</Label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Attendance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Days</p>
                  <p className="text-2xl font-bold">{totalDays}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Present</p>
                  <p className="text-2xl font-bold text-green-600">{presentDays}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="text-2xl font-bold text-red-600">{totalDays - presentDays}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Attendance %</p>
                  <p className="text-2xl font-bold">{attendancePercentage}%</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Recent Attendance</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Time In</th>
                        <th className="px-4 py-2 text-left">Time Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.slice(0, 10).map((record) => (
                        <tr key={record.id} className="border-t">
                          <td className="px-4 py-2">{format(new Date(record.date), "PPP")}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                record.status === "Present"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">{record.time_in || "-"}</td>
                          <td className="px-4 py-2">{record.time_out || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chapter Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Chapter Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3 mb-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Chapters</p>
                    <p className="text-2xl font-bold">{totalChaptersCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{completedChaptersCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="text-2xl font-bold">{chapterCompletionPercentage}%</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {chapterProgress.map((progress) => (
                    <div
                      key={progress.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{progress.chapters?.chapter_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {progress.chapters?.subject} • {format(new Date(progress.date_completed), "PPP")}
                        </p>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          progress.completed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {progress.completed ? "Completed" : "In Progress"}
                      </div>
                    </div>
                  ))}
                  {chapterProgress.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No chapters recorded yet
                    </p>
                  )}
                </div>
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
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Tests</p>
                  <p className="text-2xl font-bold">{totalTests}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold">{averagePercentage}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Marks</p>
                  <p className="text-2xl font-bold">
                    {totalMarksObtained}/{totalMaxMarks}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {testResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{result.tests?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {result.tests?.subject} • {format(new Date(result.date_taken), "PPP")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {result.marks_obtained}/{result.tests?.total_marks}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round((result.marks_obtained / (result.tests?.total_marks || 1)) * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
                {testResults.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    No test results recorded yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Performance Summary
                </CardTitle>
                <Button
                  onClick={() => generateSummaryMutation.mutate()}
                  disabled={generateSummaryMutation.isPending}
                  size="sm"
                >
                  {generateSummaryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Generate AI Summary
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {aiSummary ? (
                <Textarea
                  value={aiSummary}
                  onChange={(e) => setAiSummary(e.target.value)}
                  rows={12}
                  className="resize-none"
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Click "Generate AI Summary" to get AI-powered insights about this student's performance
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
