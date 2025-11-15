import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Download, Brain, Loader2, BookOpen, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export default function StudentReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [subjectFilterTests, setSubjectFilterTests] = useState<string>("all");
  const [subjectFilterChapters, setSubjectFilterChapters] = useState<string>("all");
  const [aiSummary, setAiSummary] = useState<string>("");

  // Fetch students (with grade filter)
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id, selectedGrade],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      if (selectedGrade !== "all") query = query.eq("grade", selectedGrade);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

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

  // Fetch all chapters
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

  // Fetch chapter progress
  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["student-chapters", selectedStudentId, subjectFilterChapters],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase
        .from("student_chapters")
        .select("*, chapters(*)")
        .eq("student_id", selectedStudentId);

      if (subjectFilterChapters !== "all") query = query.eq("chapters.subject", subjectFilterChapters);
      const { data, error } = await query.order("date_completed", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Fetch test results including uploaded answersheets
  const { data: testResults = [] } = useQuery({
    queryKey: ["student-test-results", selectedStudentId, subjectFilterTests],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase
        .from("test_results")
        .select("*, tests(*)")
        .eq("student_id", selectedStudentId);

      if (subjectFilterTests !== "all") query = query.eq("tests.subject", subjectFilterTests);

      const { data, error } = await query.order("date_taken", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Compute statistics
  const totalDays = attendanceData.length;
  const presentDays = attendanceData.filter((a) => a.status === "Present").length;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const totalTests = testResults.length;
  const totalMarksObtained = testResults.reduce((sum, r) => sum + r.marks_obtained, 0);
  const totalMaxMarks = testResults.reduce((sum, r) => sum + (r.tests?.total_marks || 0), 0);
  const averagePercentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;

  const completedChaptersCount = chapterProgress.filter(cp => cp.completed).length;
  const totalChaptersCount = allChapters.filter(c => subjectFilterChapters === "all" || c.subject === subjectFilterChapters).length;
  const chapterCompletionPercentage = totalChaptersCount > 0
    ? Math.round((completedChaptersCount / totalChaptersCount) * 100)
    : 0;

  const subjectsTests = Array.from(new Set(testResults.map(t => t.tests?.subject).filter(Boolean)));
  const subjectsChapters = Array.from(new Set(chapterProgress.map(c => c.chapters?.subject).filter(Boolean)));

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
      toast.error("Failed to generate AI summary");
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
      ["Test Name", "Subject", "Marks Obtained", "Total Marks", "Date", "Answersheet URL"],
      ...testResults.map(r => [
        r.tests?.name,
        r.tests?.subject,
        r.marks_obtained,
        r.tests?.total_marks,
        format(new Date(r.date_taken), "PPP"),
        r.answersheet_url || ""
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

      {/* Grade & Student Selector */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger>
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {[...new Set(students.map(s => s.grade))].map((grade) => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

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
      </div>

      {selectedStudent && (
        <>
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <Label>Filter Test Results by Subject</Label>
                <Select value={subjectFilterTests} onValueChange={setSubjectFilterTests}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjectsTests.map(subj => (
                      <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Label>Filter Chapters by Subject</Label>
                <Select value={subjectFilterChapters} onValueChange={setSubjectFilterChapters}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjectsChapters.map(subj => (
                      <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Attendance, Chapters, Test Results, AI Summary */}
          {/* Similar structure as previous code, but now using correct filtered queries */}
          {/* Test Results: display marks + uploaded answersheet */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.length === 0 && <p className="text-center text-muted-foreground py-8">No test results</p>}
              {testResults.map(result => (
                <div key={result.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">{result.tests?.name}</p>
                    <p className="text-sm text-muted-foreground">{result.tests?.subject} • {format(new Date(result.date_taken), "PPP")}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold">{result.marks_obtained}/{result.tests?.total_marks}</p>
                    <p>{Math.round((result.marks_obtained / (result.tests?.total_marks || 1)) * 100)}%</p>
                    {result.answersheet_url && (
                      <a
                        href={`${supabase.storage.from("answersheets").getPublicUrl(result.answersheet_url).publicUrl}`}
                        target="_blank"
                        className="text-blue-600 underline text-sm block"
                        rel="noreferrer"
                      >
                        View Answersheet
                      </a>
                    )}
                  </div>
                </div>
              ))}
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
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                <div>Total Chapters: {totalChaptersCount}</div>
                <div>Completed: {completedChaptersCount}</div>
                <div>Progress: {chapterCompletionPercentage}%</div>
              </div>
              {chapterProgress.map(cp => (
                <div key={cp.id} className="flex justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">{cp.chapters?.chapter_name}</p>
                    <p className="text-sm text-muted-foreground">{cp.chapters?.subject} • {format(new Date(cp.date_completed), "PPP")}</p>
                  </div>
                  <div>{cp.completed ? "Completed" : "In Progress"}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => generateSummaryMutation.mutate()} disabled={generateSummaryMutation.isLoading}>
                {generateSummaryMutation.isLoading ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : "Generate Summary"}
              </Button>
              <Textarea value={aiSummary} readOnly placeholder="AI summary will appear here..." />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
