import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { CalendarIcon, Download, Brain, BookOpen, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export default function StudentReport() {
  const { user } = useAuth();

  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [chapterSubjectFilter, setChapterSubjectFilter] = useState<string>("all");
  const [aiSummary, setAiSummary] = useState<string>("");

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch students
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
    queryKey: ["attendance", selectedStudentId, dateRange],
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
    queryKey: ["chapters", selectedStudentId, chapterSubjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase
        .from("student_chapters")
        .select("*, chapters(*)")
        .eq("student_id", selectedStudentId);
      if (chapterSubjectFilter !== "all") query = query.eq("chapters.subject", chapterSubjectFilter);
      const { data, error } = await query.order("date_completed", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Fetch all chapters for stats
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

  // Fetch test results with answersheet URLs
  const { data: testResults = [] } = useQuery({
    queryKey: ["test-results", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase
        .from("test_results")
        .select("*, tests(*)")
        .eq("student_id", selectedStudentId);
      if (subjectFilter !== "all") query = query.eq("tests.subject", subjectFilter);
      const { data, error } = await query.order("date_taken", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

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

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Subjects for filters
  const chapterSubjects = Array.from(new Set(chapterProgress.map(c => c.chapters?.subject).filter(Boolean)));
  const testSubjects = Array.from(new Set(testResults.map(t => t.tests?.subject).filter(Boolean)));

  // AI Summary
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
      toast.success("AI summary generated");
    },
    onError: () => toast.error("Failed to generate AI summary"),
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
      ["Test Name", "Subject", "Marks Obtained", "Total Marks", "Date", "Answer Sheet"],
      ...testResults.map(r => {
        let fileUrl = "";
        if (r.answersheet_url) {
          fileUrl = supabase.storage.from("test-files").getPublicUrl(r.answersheet_url).publicUrl;
        }
        return [
          r.tests?.name,
          r.tests?.subject,
          r.marks_obtained,
          r.tests?.total_marks,
          format(new Date(r.date_taken), "PPP"),
          fileUrl
        ];
      })
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
        {selectedStudentId && <Button onClick={exportToCSV}>Export CSV</Button>}
      </div>

      {/* Grade & Student Select */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Select Grade</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {[...new Set(students.map(s => s.grade))].map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Select Student</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} - Grade {s.grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {selectedStudent && (
        <>
          {/* Attendance */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" />Attendance</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div><p>Total Days</p><p>{totalDays}</p></div>
                <div><p>Present</p><p>{presentDays}</p></div>
                <div><p>Absent</p><p>{totalDays - presentDays}</p></div>
                <div><p>Attendance %</p><p>{attendancePercentage}%</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Chapter Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Chapter Progress</CardTitle>
              <div className="mt-2">
                <Label>Filter by Subject</Label>
                <Select value={chapterSubjectFilter} onValueChange={setChapterSubjectFilter}>
                  <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {chapterSubjects.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <p>Total Chapters: {totalChaptersCount}</p>
              <p>Completed: {completedChaptersCount}</p>
              <p>Progress: {chapterCompletionPercentage}%</p>
              {chapterProgress.map(cp => (
                <div key={cp.id} className="flex justify-between border p-2 my-1">
                  <div>{cp.chapters?.chapter_name} ({cp.chapters?.subject})</div>
                  <div>{cp.completed ? "Completed" : "In Progress"}</div>
                </div>
              ))}
              {chapterProgress.length === 0 && <p>No chapters recorded</p>}
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Test Results</CardTitle>
              <div className="mt-2">
                <Label>Filter by Subject</Label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {testSubjects.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {testResults.map(r => {
                const { publicUrl } = r.answersheet_url ? supabase.storage.from("test-files").getPublicUrl(r.answersheet_url) : { publicUrl: "" };
                return (
                  <div key={r.id} className="flex justify-between border p-2 my-1">
                    <div>
                      <p>{r.tests?.name} ({r.tests?.subject})</p>
                      <p>{format(new Date(r.date_taken), "PPP")}</p>
                    </div>
                    <div className="text-right">
                      <p>{r.marks_obtained}/{r.tests?.total_marks}</p>
                      {publicUrl && <a href={publicUrl} target="_blank" className="text-blue-600 underline">View Sheet</a>}
                    </div>
                  </div>
                );
              })}
              {testResults.length === 0 && <p>No test results recorded</p>}
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI Summary</CardTitle></CardHeader>
            <CardContent>
              <Button onClick={() => generateSummaryMutation.mutate()} className="mb-2">Generate AI Summary</Button>
              <Textarea readOnly value={aiSummary} placeholder="AI summary will appear here..." />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
