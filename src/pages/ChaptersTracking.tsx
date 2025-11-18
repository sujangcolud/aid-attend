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
import { Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

export default function ChaptersTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [subject, setSubject] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [notes, setNotes] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [filterGrade, setFilterGrade] = useState("all");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [popupGradeFilter, setPopupGradeFilter] = useState("all");
  const [showPresentOnly, setShowPresentOnly] = useState(true);

  // ----------------------------
  // Fetch students
  // ----------------------------
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const grades = Array.from(new Set(students.map((s: any) => s.grade))).filter(Boolean);

  // ----------------------------
  // Fetch attendance for selected date
  // ----------------------------
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", user?.center_id, date],
    queryFn: async () => {
      if (!user?.center_id || !date) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("center_id", user.center_id)
        .eq("date", date);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.center_id && !!date,
  });

  // ----------------------------
  // Auto-select students present on selected date
  // ----------------------------
  useEffect(() => {
    if (!students.length) return;

    const presentStudentIds = new Set(
      attendance.filter((a: any) => a.status === "Present").map((a: any) => a.student_id)
    );

    const filteredStudents = students
      .filter((s: any) => {
        if (popupGradeFilter !== "all" && s.grade !== popupGradeFilter) return false;
        return showPresentOnly ? presentStudentIds.has(s.id) : true;
      })
      .map((s: any) => s.id);

    setSelectedStudentIds(filteredStudents);
  }, [attendance, students, popupGradeFilter, showPresentOnly]);

  // ----------------------------
  // Fetch chapters for center
  // ----------------------------
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", filterSubject, filterStudent, filterGrade, user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      let query = supabase
        .from("chapters")
        .select("*, student_chapters(*, students(name, grade, center_id))")
        .eq("center_id", user?.center_id)
        .order("date_taught", { ascending: false });

      if (filterSubject !== "all") query = query.eq("subject", filterSubject);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];
      if (filterStudent !== "all") filtered = filtered.filter((c: any) => c.student_chapters?.some((sc: any) => sc.student_id === filterStudent));
      if (filterGrade !== "all") filtered = filtered.filter((c: any) => c.student_chapters?.some((sc: any) => sc.students?.grade === filterGrade));

      return filtered;
    },
    staleTime: 1000 * 30,
  });

  // ----------------------------
  // Unique chapters
  // ----------------------------
  const { data: uniqueChapters = [] } = useQuery({
    queryKey: ["unique-chapters", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("chapters")
        .select("id, subject, chapter_name")
        .eq("center_id", user?.center_id);
      if (error) throw error;

      const seen = new Set<string>();
      const unique: any[] = [];
      for (const chapter of data || []) {
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

  // ----------------------------
  // Add chapter mutation
  // ----------------------------
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentIds.length) throw new Error("Select at least one student");
      if (!selectedChapterId && (!subject || !chapterName)) throw new Error("Select a previous chapter or enter a new one");

      let chapterId = selectedChapterId;

      if (!chapterId) {
        const { data: chapterData, error } = await supabase
          .from("chapters")
          .insert({ subject, chapter_name: chapterName, date_taught: date, notes: notes || null, center_id: user?.center_id })
          .select()
          .single();
        if (error) throw error;
        chapterId = chapterData.id;
      }

      const studentChapters = selectedStudentIds.map((studentId) => ({
        student_id: studentId,
        chapter_id: chapterId,
        completed: true,
        date_completed: date,
      }));
      const { error: linkError } = await supabase.from("student_chapters").insert(studentChapters);
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
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record chapter");
    },
  });

  // ----------------------------
  // Delete chapter
  // ----------------------------
  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      toast.success("Chapter deleted successfully");
    },
    onError: () => toast.error("Failed to delete chapter"),
  });

  // ----------------------------
  // Student selection helpers
  // ----------------------------
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
  };

  const selectAllStudents = () => {
    const filtered = students
      .filter((s: any) => popupGradeFilter === "all" || s.grade === popupGradeFilter)
      .filter((s: any) => !showPresentOnly || attendance.some(a => a.student_id === s.id && format(new Date(a.date), "yyyy-MM-dd") === date && a.status === "Present"));
    setSelectedStudentIds(filtered.map((s: any) => s.id));
  };

  const deselectAllStudents = () => setSelectedStudentIds([]);

  const subjects = Array.from(new Set(chapters.map((c: any) => c.subject))).filter(Boolean);

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chapters Tracking</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2"/>Record Chapter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Chapter</DialogTitle>
              <DialogDescription>Select a previous chapter or create a new one</DialogDescription>
            </DialogHeader>

            {/* Date */}
            <div className="py-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {/* Previous Chapter */}
            <div className={`space-y-3 border rounded-lg p-4 ${selectedChapterId ? "border-primary" : ""}`}>
              <Label className="text-base font-semibold">Select Previous Chapter</Label>
              {uniqueChapters.length ? (
                <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a chapter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueChapters.map(c => <SelectItem key={c.id} value={c.id}>{c.subject} - {c.chapter_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <p className="text-sm text-muted-foreground">No previous chapters found.</p>}
            </div>

            {/* New Chapter */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
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
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes..." />
            </div>

            {/* Grade & Present Only */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-2">
                <Label>Filter by Grade</Label>
                <Select value={popupGradeFilter} onValueChange={setPopupGradeFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="All Grades"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Checkbox checked={showPresentOnly} onCheckedChange={() => setShowPresentOnly(!showPresentOnly)} />
                <Label>Present Only</Label>
              </div>
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" onClick={selectAllStudents}>Select All</Button>
                <Button size="sm" variant="outline" onClick={deselectAllStudents}>Deselect All</Button>
              </div>
            </div>

            {/* Students list */}
            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {students
                .filter(s => popupGradeFilter === "all" || s.grade === popupGradeFilter)
                .filter(s => !showPresentOnly || attendance.some(a => a.student_id === s.id && format(new Date(a.date), "yyyy-MM-dd") === date && a.status === "Present"))
                .map(s => (
                  <div key={s.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={s.id}
                      checked={selectedStudentIds.includes(s.id)}
                      onCheckedChange={() => toggleStudentSelection(s.id)}
                    />
                    <label htmlFor={s.id} className="text-sm font-medium cursor-pointer">{s.name} - Grade {s.grade}</label>
                  </div>
              ))}
            </div>

            <Button
              className="w-full mt-3"
              onClick={() => addChapterMutation.mutate()}
              disabled={selectedStudentIds.length === 0 || (!selectedChapterId && (!subject || !chapterName))}
            >
              Record Chapter for {selectedStudentIds.length} Student(s)
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters & Chapter List */}
      <Card>
        <CardHeader>
          <CardTitle>Chapters Taught</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <Label>Filter by Subject</Label>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(subj => <SelectItem key={subj} value={subj}>{subj}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Student</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Grade</Label>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chapters.length > 0 ? chapters.map((chapter: any) => (
              <div key={chapter.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{chapter.chapter_name}</h3>
                      <span className="text-sm text-muted-foreground">{chapter.subject}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Date Taught: {format(new Date(chapter.date_taught), "PPP")}</p>
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
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </div>
              </div>
            )) : <p className="text-center text-muted-foreground py-8">No chapters recorded yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
