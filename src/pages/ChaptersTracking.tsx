import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Core states (original features preserved)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd")); // used for attendance lookup & insertion
  const [subject, setSubject] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [notes, setNotes] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [filterGrade, setFilterGrade] = useState("all");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Popup-specific features requested
  const [popupGradeFilter, setPopupGradeFilter] = useState("all");
  const [showPresentOnly, setShowPresentOnly] = useState(false);
  const [autoSelectPresent, setAutoSelectPresent] = useState(true);

  // ----------------------
  // FETCH STUDENTS (center-scoped)
  // ----------------------
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name", { ascending: true });

      // non-admins only see their center students; admin might want to pass center filter via UI
      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    // keep previous data while refetching for smoother UI
    staleTime: 1000 * 30,
  });

  // ----------------------
  // FETCH PRESENT STUDENTS FOR SELECTED DATE (works for past dates)
  // ----------------------
  const { data: presentStudents = [] } = useQuery({
    queryKey: ["present-students", date, user?.center_id],
    queryFn: async () => {
      if (!date) return [];

      const { data, error } = await supabase
        .from("attendance")
        .select("student_id")
        .eq("date", date)
        .eq("center_id", user?.center_id)
        .eq("status", "present");

      if (error) throw error;
      // return array of student_id strings
      return (data || []).map((r: any) => r.student_id);
    },
    enabled: !!date && !!user?.center_id,
    staleTime: 1000 * 30,
  });

  // If user toggles autoSelectPresent or date/presentStudents change, auto-select present students
  useEffect(() => {
    if (autoSelectPresent) {
      // Only auto select those that also match popup grade filter (so auto selection respects grade filter)
      const autoSelected = students
        .filter((s: any) => presentStudents.includes(s.id))
        .filter((s: any) => popupGradeFilter === "all" || s.grade === popupGradeFilter)
        .map((s: any) => s.id);

      setSelectedStudentIds(autoSelected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentStudents, autoSelectPresent, popupGradeFilter]); // popupGradeFilter included to re-auto-select when grade filter changes

  // ----------------------
  // FETCH CHAPTERS (center-scoped) and apply filters (subject / student / grade)
  // ----------------------
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", filterSubject, filterStudent, filterGrade, user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("chapters")
        .select("*, student_chapters(*, students(name, grade, center_id))")
        .eq("center_id", user?.center_id) // IMPORTANT: restrict chapters to this center
        .order("date_taught", { ascending: false });

      if (filterSubject !== "all") query = query.eq("subject", filterSubject);

      const { data, error } = await query;
      if (error) throw error;
      let filtered = data || [];

      // Filter by student (if set)
      if (filterStudent !== "all") {
        filtered = filtered.filter((chapter: any) =>
          chapter.student_chapters?.some((sc: any) => sc.student_id === filterStudent)
        );
      }

      // Filter by grade (if set)
      if (filterGrade !== "all") {
        filtered = filtered.filter((chapter: any) =>
          chapter.student_chapters?.some((sc: any) => sc.students?.grade === filterGrade)
        );
      }

      return filtered;
    },
    staleTime: 1000 * 30,
  });

  // ----------------------
  // FETCH UNIQUE CHAPTERS (center-scoped)
  // ----------------------
  const { data: uniqueChapters = [] } = useQuery({
    queryKey: ["unique-chapters", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, subject, chapter_name")
        .eq("center_id", user?.center_id);

      if (error) throw error;
      const seen = new Set<string>();
      const unique: any[] = [];
      for (const chapter of (data || [])) {
        const key = `${chapter.subject}|${chapter.chapter_name}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(chapter);
        }
      }
      return unique;
    },
    staleTime: 1000 * 60,
  });

  // ----------------------
  // ADD CHAPTER MUTATION (inserts center_id) - preserves original behavior + center_id
  // ----------------------
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      let chapterId: string;

      if (selectedChapterId) {
        // recording an existing chapter (clone into this center by linking or by creating a new chapter instance)
        // We will create a new chapter record under this center with same subject/name + date/notes
        const selected = uniqueChapters.find((c: any) => c.id === selectedChapterId);
        if (!selected) throw new Error("Chapter not found");

        const { data: chapterData, error } = await supabase
          .from("chapters")
          .insert({
            subject: selected.subject,
            chapter_name: selected.chapter_name,
            date_taught: date,
            notes: notes || null,
            center_id: user?.center_id,
          })
          .select()
          .single();

        if (error) throw error;
        chapterId = chapterData.id;
      } else if (subject && chapterName) {
        const { data: chapterData, error } = await supabase
          .from("chapters")
          .insert({
            subject,
            chapter_name: chapterName,
            date_taught: date,
            notes: notes || null,
            center_id: user?.center_id, // ensure chapter is bound to current center
          })
          .select()
          .single();

        if (error) throw error;
        chapterId = chapterData.id;
      } else {
        throw new Error("Select a previous chapter or enter a new one");
      }

      if (selectedStudentIds.length > 0) {
        const studentChapters = selectedStudentIds.map((studentId) => ({
          student_id: studentId,
          chapter_id: chapterId,
          completed: true,
          date_completed: date,
        }));

        const { error: linkError } = await supabase.from("student_chapters").insert(studentChapters);
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      queryClient.invalidateQueries({ queryKey: ["unique-chapters"] });
      queryClient.invalidateQueries({ queryKey: ["present-students", date, user?.center_id] });
      toast.success("Chapter recorded for selected students");
      // reset popup state
      setSelectedStudentIds([]);
      setSubject("");
      setChapterName("");
      setNotes("");
      setSelectedChapterId("");
      setPopupGradeFilter("all");
      setShowPresentOnly(false);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record chapter");
    },
  });

  // ----------------------
  // DELETE CHAPTER MUTATION (keeps simple behavior of original; only deletes chapter row)
  // ----------------------
  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      // optionally: remove linked student_chapters first to avoid FK issues if any
      // await supabase.from("student_chapters").delete().eq("chapter_id", id);
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

  // ----------------------
  // Helper selection functions
  // ----------------------
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // select all respects popup grade filter & present-only filter
  const selectAllStudents = () => {
    const filtered = (students || [])
      .filter((s: any) => popupGradeFilter === "all" || s.grade === popupGradeFilter)
      .filter((s: any) => !showPresentOnly || presentStudents.includes(s.id));

    setSelectedStudentIds(filtered.map((s: any) => s.id));
  };

  const deselectAllStudents = () => {
    setSelectedStudentIds([]);
  };

  // toggle present-only: when enabling it, auto-select present students (respecting grade filter)
  const handlePresentOnlyToggle = () => {
    const next = !showPresentOnly;
    setShowPresentOnly(next);

    if (next) {
      const filtered = (students || [])
        .filter((s: any) => popupGradeFilter === "all" || s.grade === popupGradeFilter)
        .filter((s: any) => presentStudents.includes(s.id));
      setSelectedStudentIds(filtered.map((s: any) => s.id));
    } else {
      // if disabling present-only, do not change selection (or you may choose to clear)
    }
  };

  // if popupGradeFilter changes, and autoSelectPresent is on, update selectedStudentIds to match present+grade
  useEffect(() => {
    if (autoSelectPresent) {
      const auto = (students || [])
        .filter((s: any) => presentStudents.includes(s.id))
        .filter((s: any) => popupGradeFilter === "all" || s.grade === popupGradeFilter)
        .map((s: any) => s.id);
      setSelectedStudentIds(auto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupGradeFilter, students]);

  const subjects = Array.from(new Set((chapters || []).map((c: any) => c.subject)));
  const grades = Array.from(new Set((students || []).map((s: any) => s.grade)));

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

          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                  onChange={(e) => {
                    setDate(e.target.value);
                    // reset selection on date change to avoid stale selection; auto-select present will kick in via effect
                    setSelectedStudentIds([]);
                  }}
                />
              </div>

              <div className={`space-y-3 border rounded-lg p-4 ${selectedChapterId ? "border-primary" : ""}`}>
                <Label className="text-base font-semibold">Select from Previous Chapters</Label>
                {uniqueChapters.length > 0 ? (
                  <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a chapter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueChapters.map((chapter: any) => (
                        <SelectItem key={chapter.id} value={chapter.id}>
                          {chapter.subject} - {chapter.chapter_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No previous chapters found.</p>
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

              <div className={`space-y-3 border rounded-lg p-4 ${subject && chapterName ? "border-primary" : ""}`}>
                <Label className="text-base font-semibold">Create New Chapter</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Subject</Label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Mathematics" />
                  </div>
                  <div>
                    <Label>Chapter Name</Label>
                    <Input value={chapterName} onChange={(e) => setChapterName(e.target.value)} placeholder="e.g., Algebra" />
                  </div>
                </div>
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Select Students ({selectedStudentIds.length} selected)
                  </Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllStudents}>
                      Select All
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={deselectAllStudents}>
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Grade filter inside popup */}
                <div className="mt-2">
                  <Label>Filter by Grade</Label>
                  <Select value={popupGradeFilter} onValueChange={setPopupGradeFilter}>
                    <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {grades.map((g: any) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Show present only + auto-select toggle */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="presentOnly" checked={showPresentOnly} onCheckedChange={handlePresentOnlyToggle} />
                    <label htmlFor="presentOnly" className="text-sm font-medium leading-none cursor-pointer">
                      Show Present Students Only (for selected date)
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="autoSelect" checked={autoSelectPresent} onCheckedChange={() => setAutoSelectPresent(!autoSelectPresent)} />
                    <label htmlFor="autoSelect" className="text-sm font-medium leading-none cursor-pointer">
                      Auto-select present students
                    </label>
                  </div>
                </div>

                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {students
                    .filter((s: any) => popupGradeFilter === "all" || s.grade === popupGradeFilter)
                    .filter((s: any) => !showPresentOnly || presentStudents.includes(s.id))
                    .map((student: any) => (
                      <div key={student.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={student.id}
                          checked={selectedStudentIds.includes(student.id)}
                          onCheckedChange={() => toggleStudentSelection(student.id)}
                        />
                        <label htmlFor={student.id} className="text-sm font-medium leading-none cursor-pointer">
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
                  (!selectedChapterId && (!subject || !chapterName)) ||
                  addChapterMutation.isLoading
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subj: any) => <SelectItem key={subj} value={subj}>{subj}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Student</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Grade</Label>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {grades.map((g: any) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                      <span className="text-sm text-muted-foreground">{chapter.subject}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Date Taught: {format(new Date(chapter.date_taught), "PPP")}
                    </p>
                    {chapter.notes && <p className="text-sm mb-2">{chapter.notes}</p>}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {chapter.student_chapters?.map((sc: any) => (
                        <span key={sc.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {sc.students?.name} - Grade {sc.students?.grade}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteChapterMutation.mutate(chapter.id)}>
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
