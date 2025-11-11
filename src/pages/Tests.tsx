import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileUp, Plus, Trash2, Edit, Users, X, FileText } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import OCRModal from "@/components/OCRModal";
import BulkMarksEntry from "@/components/BulkMarksEntry";
import QuestionPaperViewer from "@/components/QuestionPaperViewer";

export default function Tests() {
  const queryClient = useQueryClient();
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [extractedTestContent, setExtractedTestContent] = useState("");

  // Form states for new test
  const [testName, setTestName] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [totalMarks, setTotalMarks] = useState("");
  const [grade, setGrade] = useState("");

  // States for entering marks
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [marksObtained, setMarksObtained] = useState("");
  const [resultDate, setResultDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resultNotes, setResultNotes] = useState("");

  // Fetch tests
  const { data: tests = [] } = useQuery({
    queryKey: ["tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch test results for selected test
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

  // Create test mutation
  const createTestMutation = useMutation({
    mutationFn: async () => {
      let uploadedFileUrl = null;

      // Upload file if present
      if (uploadedFile) {
        const fileExt = uploadedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("test-files")
          .upload(fileName, uploadedFile);

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
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      toast.success("Test created successfully");
      setIsAddingTest(false);
      setTestName("");
      setTestSubject("");
      setTotalMarks("");
      setGrade("");
      setUploadedFile(null);
    },
    onError: (error: any) => {
      console.error("Error creating test:", error);
      toast.error("Failed to create test");
    },
  });

  // Add test result mutation
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
      setSelectedStudentId("");
      setMarksObtained("");
      setResultNotes("");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Marks already recorded for this student");
      } else {
        toast.error("Failed to record marks");
      }
    },
  });

  // Bulk marks entry mutation
  const bulkMarksMutation = useMutation({
    mutationFn: async (marks: Array<{ studentId: string; marks: number }>) => {
      const records = marks.map((m) => ({
        test_id: selectedTest,
        student_id: m.studentId,
        marks_obtained: m.marks,
        date_taken: format(new Date(), "yyyy-MM-dd"),
      }));

      // Delete existing records for these students and test
      const studentIds = marks.map((m) => m.studentId);
      await supabase
        .from("test_results")
        .delete()
        .eq("test_id", selectedTest)
        .in("student_id", studentIds);

      // Insert new records
      const { error } = await supabase.from("test_results").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Bulk marks saved successfully");
    },
    onError: () => {
      toast.error("Failed to save bulk marks");
    },
  });

  // Delete test result
  const deleteResultMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const { error } = await supabase
        .from("test_results")
        .delete()
        .eq("id", resultId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Result deleted");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const selectedTestData = tests.find((t) => t.id === selectedTest);
  const testsWithFiles = tests.filter((t) => t.uploaded_file_url);

  return (
    <div className="space-y-6">
      {testsWithFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Available Question Papers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testsWithFiles.map((test) => (
                <div
                  key={test.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 flex-shrink-0">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm line-clamp-2">{test.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {test.subject} • {format(new Date(test.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <QuestionPaperViewer
                    testId={test.id}
                    testName={test.name}
                    fileName={test.uploaded_file_url}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowOCRModal(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Upload Test Paper (OCR)
          </Button>
          <Dialog open={isAddingTest} onOpenChange={setIsAddingTest}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Test
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Test</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Test Name</Label>
                <Input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g., Mid-term Math Exam"
                />
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Total Marks</Label>
                  <Input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="100"
                  />
                </div>
              </div>
              <div>
                <Label>Grade (Optional)</Label>
                <Input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g., 10th"
                />
              </div>
              <div>
                <Label>Upload Test File (Optional)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                />
                {uploadedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {uploadedFile.name}
                  </p>
                )}
              </div>
              <Button
                onClick={() => createTestMutation.mutate()}
                disabled={!testName || !testSubject || !totalMarks || createTestMutation.isPending}
                className="w-full"
              >
                Create Test
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>All Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tests.map((test) => (
                <button
                  key={test.id}
                  onClick={() => setSelectedTest(test.id)}
                  className={`w-full text-left p-4 border rounded-lg transition-colors ${
                    selectedTest === test.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <div className="font-medium">{test.name}</div>
                  <div className="text-sm opacity-80">
                    {test.subject} • {format(new Date(test.date), "PPP")} • {test.total_marks} marks
                  </div>
                </button>
              ))}
              {tests.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  No tests created yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedTest && selectedTestData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Enter Marks - {selectedTestData.name}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkEntry(true)}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Bulk Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} - Grade {student.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marks Obtained (out of {selectedTestData.total_marks})</Label>
                <Input
                  type="number"
                  value={marksObtained}
                  onChange={(e) => setMarksObtained(e.target.value)}
                  max={selectedTestData.total_marks}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Test Date</Label>
                <Input
                  type="date"
                  value={resultDate}
                  onChange={(e) => setResultDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
              <Button
                onClick={() => addResultMutation.mutate()}
                disabled={!selectedStudentId || !marksObtained || addResultMutation.isPending}
                className="w-full"
              >
                Save Marks
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedTest && selectedTestData && selectedTestData.uploaded_file_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Question Paper
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Question Paper Available</p>
                    <p className="text-sm text-gray-600">
                      Uploaded: {format(new Date(selectedTestData.created_at), "PPP")}
                    </p>
                  </div>
                </div>
                <QuestionPaperViewer
                  testId={selectedTest}
                  testName={selectedTestData.name}
                  fileName={selectedTestData.uploaded_file_url}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTest && testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Student</th>
                    <th className="px-4 py-2 text-left">Grade</th>
                    <th className="px-4 py-2 text-right">Marks</th>
                    <th className="px-4 py-2 text-right">Percentage</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((result) => (
                    <tr key={result.id} className="border-t">
                      <td className="px-4 py-2">{result.students?.name}</td>
                      <td className="px-4 py-2">{result.students?.grade}</td>
                      <td className="px-4 py-2 text-right">
                        {result.marks_obtained}/{selectedTestData?.total_marks}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {Math.round((result.marks_obtained / (selectedTestData?.total_marks || 1)) * 100)}%
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteResultMutation.mutate(result.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <OCRModal
        open={showOCRModal}
        onOpenChange={setShowOCRModal}
        onSave={(text) => {
          setExtractedTestContent(text);
          toast.success("Test content extracted! You can now use this for reference.");
        }}
      />

      {selectedTest && selectedTestData && (
        <BulkMarksEntry
          open={showBulkEntry}
          onOpenChange={setShowBulkEntry}
          students={students}
          testId={selectedTest}
          totalMarks={selectedTestData.total_marks}
          onSave={(marks) => bulkMarksMutation.mutate(marks)}
        />
      )}
    </div>
  );
}
