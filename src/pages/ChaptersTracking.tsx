import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Users, Plus } from "lucide-react";
import { format } from "date-fns";

export default function ChaptersTracking() {
  const queryClient = useQueryClient();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [subject, setSubject] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [notes, setNotes] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  // Fetch all chapters taught (history)
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", filterSubject, filterStudent],
    queryFn: async () => {
      let query = supabase
        .from("chapters")
        .select("*, student_chapters(*, students(name, grade))")
        .order("date_taught", { ascending: false });

      if (filterSubject !== "all") {
        query = query.eq("subject", filterSubject);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by student if needed
      if (filterStudent !== "all") {
        return data.filter(chapter =>
          chapter.student_chapters.some((sc: any) => sc.student_id === filterStudent)
        );
      }

      return data;
    },
  });

  // Fetch unique chapters (master list) for selection
  const { data: uniqueChapters = [] } = useQuery({
    queryKey: ["unique-chapters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, subject, chapter_name")
        .order("subject, chapter_name");

      if (error) throw error;

      // Remove duplicates by creating a map
      const seen = new Set<string>();
      const unique = [];
      for (const chapter of data) {
        const key = `${chapter.subject}|${chapter.chapter_name}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(chapter);
        }
      }
      return unique;
    },
  });

  // Add chapter mutation with multi-student support
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      let chapterId: string;

      if (isCreatingNew) {
        // Create new chapter
        const { data: chapterData, error: chapterError } = await supabase
          .from("chapters")
          .insert({
            subject,
            chapter_name: chapterName,
            date_taught: date,
            notes: notes || null,
          })
          .select()
          .single();

        if (chapterError) throw chapterError;
        chapterId = chapterData.id;
      } else if (selectedChapterId) {
        // Use selected chapter - create a new instance with the selected date
        const selectedChapter = uniqueChapters.find(c => c.id === selectedChapterId);
        if (!selectedChapter) throw new Error("Chapter not found");

        const { data: chapterData, error: chapterError } = await supabase
          .from("chapters")
          .insert({
            subject: selectedChapter.subject,
            chapter_name: selectedChapter.chapter_name,
            date_taught: date,
            notes: notes || null,
          })
          .select()
          .single();

        if (chapterError) throw chapterError;
        chapterId = chapterData.id;
      } else {
        throw new Error("Please select a chapter or create a new one");
      }

      // Link to selected students
      const studentChapters = selectedStudentIds.map(studentId => ({
        student_id: studentId,
        chapter_id: chapterId,
        completed: true,
        date_completed: date,
      }));

      const { error: linkError } = await supabase
        .from("student_chapters")
        .insert(studentChapters);

      if (linkError) throw linkError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      queryClient.invalidateQueries({ queryKey: ["unique-chapters"] });
      toast.success("Chapter recorded for selected students");
      setSelectedStudentIds([]);
      setSubject("");
      setChapterName("");
      setNotes("");
      setSelectedChapterId("");
      setIsCreatingNew(false);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Chapter already assigned to one or more selected students on this date");
      } else {
        toast.error(error.message || "Failed to record chapter");
      }
    },
  });

  // Delete chapter mutation
  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      toast.success("Chapter deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete chapter");
    },
  });

  // Toggle student selection
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Mark all present students
  const selectAllStudents = () => {
    setSelectedStudentIds(students.map(s => s.id));
  };

  // Get unique subjects
  const subjects = Array.from(new Set(chapters.map(c => c.subject)));

  const uniqueSubjects = Array.from(new Set(uniqueChapters.map(c => c.subject)));
  const filteredChapters = selectedChapterId === ""
    ? uniqueChapters
    : uniqueChapters.filter(c => c.id === selectedChapterId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chapters Tracking</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Record Chapter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record Chapter</DialogTitle>
              <DialogDescription>
                Select a previously taught chapter or create a new one
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
                <Label className="text-base font-semibold">Select from Previous Chapters</Label>
                {uniqueChapters.length > 0 ? (
                  <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a chapter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueChapters.map((chapter) => (
                        <SelectItem key={chapter.id} value={chapter.id}>
                          {chapter.subject} - {chapter.chapter_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No previous chapters found. Create a new one below.</p>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {isCreatingNew && (
                <div className="space-y-3 border rounded-lg p-4">
                  <Label className="text-base font-semibold">Create New Chapter</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Subject</Label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g., Mathematics"
                      />
                    </div>
                    <div>
                      <Label>Chapter Name</Label>
                      <Input
                        value={chapterName}
                        onChange={(e) => setChapterName(e.target.value)}
                        placeholder="e.g., Algebra"
                      />
                    </div>
                  </div>
                </div>
              )}

              {!isCreatingNew && selectedChapterId === "" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsCreatingNew(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Chapter
                </Button>
              )}

              {isCreatingNew && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setSubject("");
                    setChapterName("");
                  }}
                >
                  Back to Selection
                </Button>
              )}

              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Select Students ({selectedStudentIds.length} selected)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllStudents}
                  >
                    Select All
                  </Button>
                </div>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={student.id}
                        checked={selectedStudentIds.includes(student.id)}
                        onCheckedChange={() => toggleStudentSelection(student.id)}
                      />
                      <label
                        htmlFor={student.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {student.name} - Grade {student.grade}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => addChapterMutation.mutate()}
                disabled={
                  selectedStudentIds.length === 0 ||
                  (isCreatingNew && (!subject || !chapterName)) ||
                  (!isCreatingNew && !selectedChapterId) ||
                  addChapterMutation.isPending
                }
                className="w-full"
              >
                Record Chapter for {selectedStudentIds.length} Student(s)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chapters Taught</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <Label>Filter by Subject</Label>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subj) => (
                    <SelectItem key={subj} value={subj}>
                      {subj}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Student</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chapters.map((chapter: any) => (
              <div key={chapter.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{chapter.chapter_name}</h3>
                      <span className="text-sm text-muted-foreground">
                        {chapter.subject}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Date Taught: {format(new Date(chapter.date_taught), "PPP")}
                    </p>
                    {chapter.notes && (
                      <p className="text-sm mb-2">{chapter.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {chapter.student_chapters?.map((sc: any) => (
                        <span
                          key={sc.id}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
                        >
                          {sc.students?.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteChapterMutation.mutate(chapter.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {chapters.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                No chapters recorded yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
