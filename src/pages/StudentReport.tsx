import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download, Printer } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

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

  // Fetch students
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
    queryKey: ["student-chapters", selectedStudentId, subjectFilter, dateRange],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase.from("student_chapters").select("*, chapters(*)").eq("student_id", selectedStudentId)
        .gte("date_completed", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date_completed", format(dateRange.to, "yyyy-MM-dd"));
      if (subjectFilter !== "all") query = query.eq("chapters.subject", subjectFilter);
      const { data, error } = await query.order("date_completed", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Fetch all chapters for completion %
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
    queryKey: ["student-test-results", selectedStudentId, subjectFilter, dateRange],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase.from("test_results").select("*, tests(*)").eq("student_id", selectedStudentId)
        .gte("date_taken", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date_taken", format(dateRange.to, "yyyy-MM-dd"));
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

  // Print
  const handlePrint = () => {
    const content = document.getElementById("printable-report");
    if (content) {
      const newWindow = window.open("", "_blank");
      newWindow?.document.write(`
        <html>
          <head>
            <title>Student Report - ${selectedStudent?.name}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1, h2, h3 { margin: 0 0 10px 0; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            ${content.innerHTML}
          </body>
        </html>
      `);
      newWindow?.document.close();
      newWindow?.focus();
      newWindow?.print();
      newWindow?.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Print/Export */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Student Report</h1>
        {selectedStudentId && (
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={handlePrint} variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {Array.from(new Set(students.map(s => s.grade))).map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Student" />
          </SelectTrigger>
          <SelectContent>
            {filteredStudents.map((student) => (
              <SelectItem key={student.id} value={student.id}>
                {student.name} - Grade {student.grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedStudent && (
        <div id="printable-report">
          {/* Attendance Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>Total Days: {totalDays}</div>
                <div>Present: {presentDays}</div>
                <div>Absent: {totalDays - presentDays}</div>
                <div>Attendance %: {attendancePercentage}%</div>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1">Date</th>
                      <th className="border px-2 py-1">Status</th>
                      <th className="border px-2 py-1">Time In</th>
                      <th className="border px-2 py-1">Time Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map((record) => (
                      <tr key={record.id}>
                        <td className="border px-2 py-1">{format(new Date(record.date), "PPP")}</td>
                        <td className="border px-2 py-1">{record.status}</td>
                        <td className="border px-2 py-1">{record.time_in || "-"}</td>
                        <td className="border px-2 py-1">{record.time_out || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Chapter Progress with Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Chapter Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1">Chapter</th>
                      <th className="border px-2 py-1">Subject</th>
                      <th className="border px-2 py-1">Date Completed</th>
                      <th className="border px-2 py-1">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chapterProgress.map((cp) => (
                      <tr key={cp.id}>
                        <td className="border px-2 py-1">{cp.chapters?.chapter_name}</td>
                        <td className="border px-2 py-1">{cp.chapters?.subject}</td>
                        <td className="border px-2 py-1">{format(new Date(cp.date_completed), "PPP")}</td>
                        <td className="border px-2 py-1">{cp.chapters?.notes || "-"}</td>
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
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1">Test Name</th>
                      <th className="border px-2 py-1">Subject</th>
                      <th className="border px-2 py-1">Marks Obtained</th>
                      <th className="border px-2 py-1">Total Marks</th>
                      <th className="border px-2 py-1">Percentage</th>
                      <th className="border px-2 py-1">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((t) => (
                      <tr key={t.id}>
                        <td className="border px-2 py-1">{t.tests?.name}</td>
                        <td className="border px-2 py-1">{t.tests?.subject}</td>
                        <td className="border px-2 py-1">{t.marks_obtained}</td>
                        <td className="border px-2 py-1">{t.tests?.total_marks}</td>
                        <td className="border px-2 py-1">{Math.round((t.marks_obtained / (t.tests?.total_marks || 1)) * 100)}%</td>
                        <td className="border px-2 py-1">{format(new Date(t.date_taken), "PPP")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader>
              <CardTitle>AI Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {aiSummary ? (
                <Textarea value={aiSummary} onChange={e => setAiSummary(e.target.value)} rows={12} className="resize-none" />
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  Click "Generate AI Summary" to get insights
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
