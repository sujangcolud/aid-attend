import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileUp, Plus, Trash2, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import OCRModal from "@/components/OCRModal";
import QuestionPaperViewer from "@/components/QuestionPaperViewer";

// BulkMarksEntry with answersheet upload
function BulkMarksEntry({ open, onOpenChange, students, testId, totalMarks, onSave }: any) {
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [marksState, setMarksState] = useState<Record<string, { marks: string; file?: File }>>({});

  const gradesList = Array.from(new Set(students.map((s: any) => s.grade).filter(Boolean)));
  const filteredStudents = students.filter((s: any) => selectedGrade === "all" || s.grade === selectedGrade);

  const handleMarksChange = (studentId: string, value: string) => {
    setMarksState(prev => ({ ...prev, [studentId]: { ...prev[studentId], marks: value } }));
  };

  const handleFileChange = (studentId: string, file?: File) => {
    setMarksState(prev => ({ ...prev, [studentId]: { ...prev[studentId], file } }));
  };

  const handleSave = () => {
    const marksArray = Object.entries(marksState).map(([studentId, data]) => ({
      studentId,
      marks: parseInt(data.marks),
      file: data.file,
    }));
    onSave(marksArray);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk Marks Entry</DialogTitle>
        </DialogHeader>

        <div className="mb-4">
          <Label>Filter by Grade</Label>
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {gradesList.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {filteredStudents.map((student: any) => (
            <div key={student.id} className="flex items-center gap-4 mb-3 border rounded p-2">
              <div className="flex-1">
                <p className="font-medium">{student.name}</p>
                <p className="text-sm text-muted-foreground">Grade {student.grade}</p>
              </div>
              <div>
                <Label>Marks</Label>
                <Input
                  type="number"
                  min={0}
                  max={totalMarks}
                  value={marksState[student.id]?.marks || ""}
                  onChange={e => handleMarksChange(student.id, e.target.value)}
                  placeholder={`0-${totalMarks}`}
                />
              </div>
              <div>
                <Label>Answer Sheet (Optional)</Label>
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange(student.id, e.target.files?.[0])} />
                {marksState[student.id]?.file && (
                  <p className="text-xs text-muted-foreground mt-1">{marksState[student.id].file?.name}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button className="mt-4 w-full" onClick={handleSave}>Save All</Button>
      </DialogContent>
    </Dialog>
  );
}

// Main Tests Page
export default function Tests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);

  // Form states
  const [testName, setTestName] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [totalMarks, setTotalMarks] = useState("");
  const [grade, setGrade] = useState("");

  // Student marks states
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [marksObtained, setMarksObtained] = useState("");
  const [resultDate, setResultDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resultNotes, setResultNotes] = useState("");

  // Filters for test list
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");

  // Fetch tests
  const { data: tests = [] } = useQuery({
    queryKey: ["tests", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("tests").select("*").order("date", { ascending: false });
      if (user?.role !== "admin" && user?.center_id) query = query.eq('center_id', user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq('center_id', user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch test results
  const { data: testResults = [] } = useQuery({
    queryKey: ["test-results", selectedTest],
    queryFn: async () => {
      if (!selectedTest) return [];
      const { data, error } = await supabase
        .from("test_results")
        .select("*, students(name, grade)")
        .eq("test_id", selectedTest)
        .order("marks_obtained", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTest,
  });

  const createTestMutation = useMutation({
    mutationFn: async () => {
      let uploadedFileUrl = null;
      if (uploadedFile) {
        const fileExt = uploadedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("test-files").upload(fileName, uploadedFile);
        if (uploadError) throw uploadError;
        uploadedFileUrl = fileName;
      }
      const { data, error } = await supabase.from("tests").insert({
        name: testName,
        subject: testSubject,
        date: testDate,
        total_marks: parseInt(totalMarks),
        grade: grade || null,
        uploaded_file_url: uploadedFileUrl,
        center_id: user?.center_id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      toast.success("Test created successfully");
      setIsAddingTest(false);
      setTestName(""); setTestSubject(""); setTotalMarks(""); setGrade(""); setUploadedFile(null);
    },
    onError: (error: any) => {
      toast.error("Failed to create test");
    },
  });

  const addResultMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("test_results").insert({
        test_id: selectedTest,
        student_id: selectedStudentId,
        marks_obtained: parseInt(marksObtained),
        date_taken: resultDate,
        notes: resultNotes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Marks recorded successfully");
      setSelectedStudentId(""); setMarksObtained(""); setResultNotes("");
    },
    onError: (error: any) => {
      toast.error("Failed to record marks");
    },
  });

  const bulkMarksMutation = useMutation({
    mutationFn: async (marks: Array<{ studentId: string; marks: number; file?: File }>) => {
      for (const m of marks) {
        // delete existing
        await supabase.from("test_results").delete().eq("test_id", selectedTest).eq("student_id", m.studentId);
        // upload file if exists
        let fileUrl = null;
        if (m.file) {
          const fileExt = m.file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          await supabase.storage.from("test-files").upload(fileName, m.file);
          fileUrl = fileName;
        }
        await supabase.from("test_results").insert({
          test_id: selectedTest,
          student_id: m.studentId,
          marks_obtained: m.marks,
          date_taken: format(new Date(), "yyyy-MM-dd"),
          answersheet_url: fileUrl,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Bulk marks saved successfully");
    },
    onError: () => toast.error("Failed to save bulk marks"),
  });

  const deleteTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const test = tests.find(t => t.id === testId);
      if (!test) throw new Error("Test not found");
      if (user?.role !== 'admin' && test.center_id !== user?.center_id) throw new Error("No permission");
      if (test.uploaded_file_url) await supabase.storage.from("test-files").remove([test.uploaded_file_url]);
      await supabase.from("test_results").delete().eq("test_id", testId);
      await supabase.from("tests").delete().eq("id", testId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tests"] }); setSelectedTest(""); toast.success("Test deleted"); },
    onError: (error: any) => toast.error(error.message || "Failed to delete test"),
  });

  const deleteResultMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const { error } = await supabase.from("test_results").delete().eq("id", resultId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["test-results"] }); toast.success("Result deleted"); },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setUploadedFile(e.target.files[0]);
  };

  // Grade & Subject filters for test list
  const filteredTests = tests.filter(t => 
    (filterGrade === "all" || t.grade === filterGrade) &&
    (filterSubject === "all" || t.subject === filterSubject)
  );

  const selectedTestData = tests.find(t => t.id === selectedTest);

  const subjectsList = Array.from(new Set(tests.map(t => t.subject).filter(Boolean)));
  const gradesListTests = Array.from(new Set(tests.map(t => t.grade).filter(Boolean)));

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Test Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowOCRModal(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Upload Test Paper (OCR)
          </Button>
          <Dialog open={isAddingTest} onOpenChange={setIsAddingTest}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Test
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Test</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Test Name" value={testName} onChange={e => setTestName(e.target.value)} />
                <Input placeholder="Subject" value={testSubject} onChange={e => setTestSubject(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <Input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} />
                  <Input type="number" placeholder="Total Marks" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
                </div>
                <Input placeholder="Grade" value={grade} onChange={e => setGrade(e.target.value)} />
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
                {uploadedFile && <p>{uploadedFile.name}</p>}
                <Button onClick={() => createTestMutation.mutate()}>Create Test</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters for test list */}
      <div className="flex gap-4">
        <Select value={filterGrade} onValueChange={setFilterGrade}>
          <SelectTrigger><SelectValue placeholder="Grade Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {gradesListTests.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger><SelectValue placeholder="Subject Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjectsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tests List */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>All Tests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {filteredTests.map(test => (
              <div key={test.id} className="flex items-center gap-2">
                <button onClick={() => setSelectedTest(test.id)} className="flex-1 text-left p-4 border rounded-lg hover:bg-accent">
                  <div>{test.name}</div>
                  <div className="text-sm">{test.subject} • {format(new Date(test.date), "PPP")} • {test.total_marks} marks</div>
                </button>
                <Button variant="ghost" onClick={() => deleteTestMutation.mutate(test.id)}><Trash2 /></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {selectedTest && selectedTestData && (
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>Bulk Marks Entry - {selectedTestData.name}</CardTitle>
              <Button onClick={() => setShowBulkEntry(true)} variant="outline"><Users className="mr-2 h-4 w-4" />Bulk Entry</Button>
            </CardHeader>
          </Card>
        )}
      </div>

      {showBulkEntry && selectedTest && selectedTestData && (
        <BulkMarksEntry
          open={showBulkEntry}
          onOpenChange={setShowBulkEntry}
          students={students}
          testId={selectedTest}
          totalMarks={selectedTestData.total_marks}
          onSave={(marks) => bulkMarksMutation.mutate(marks)}
        />
      )}

      <OCRModal
        open={showOCRModal}
        onOpenChange={setShowOCRModal}
        onSave={(text) => toast.success("OCR Text Extracted!")}
      />
    </div>
  );
}
