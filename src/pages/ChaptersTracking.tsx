import { useState } from "react";
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

  const centerId = user?.center_id;

  // -------------------------------
  // FETCH TODAY'S PRESENT STUDENTS
  // -------------------------------
  const today = new Date().toISOString().split("T")[0];

  const { data: attendanceToday = [] } = useQuery({
    queryKey: ["attendance-today", centerId],
    queryFn: async () => {
      let query = supabase
        .from("attendance")
        .select("student_id, status")
        .eq("date", today);

      if (user?.role !== "admin") query = query.eq("center_id", centerId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const presentStudents = new Set(
    attendanceToday.filter(a => a.status === "Present").map(a => a.student_id)
  );

  // -------------------------------
  // FETCH STUDENTS
  // -------------------------------
  const { data: students = [] } = useQuery({
    queryKey: ["students", centerId],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");

      if (user?.role !== "admin") query = query.eq("center_id", centerId);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // -------------------------------
  // FETCH CHAPTERS DISPLAY LIST
  // -------------------------------
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", filterSubject, filterStudent, filterGrade, centerId],
    queryFn: async () => {
      let query = supabase
        .from("chapters")
        .select("*, student_chapters(*, students(name, grade, center_id))")
        .order("date_taught", { ascending: false });

      if (filterSubject !== "all") query = query.eq("subject", filterSubject);

      const { data, error } = await query;
      if (error) throw error;

      // 🔥 Filter chapters belonging to this center
      let filtered = data.filter((c) =>
        c.student_chapters.some((sc: any) => sc.students.center_id === centerId)
      );

      if (filterStudent !== "all") {
        filtered = filtered.filter((c) =>
          c.student_chapters.some((sc: any) => sc.student_id === filterStudent)
        );
      }

      if (filterGrade !== "all") {
        filtered = filtered.filter((c) =>
          c.student_chapters.some((sc: any) => sc.students.grade === filterGrade)
        );
      }

      return filtered;
    },
  });

  // -------------------------------
  // UNIQUE CHAPTERS (CENTER-SPECIFIC)
  // -------------------------------
  const { data: uniqueChapters = [] } = useQuery({
    queryKey: ["unique-chapters", centerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, subject, chapter_name, student_chapters(*, students(center_id))");

      if (error) throw error;

      // Only chapters belonging to this center
      const centerChapters = data.filter((c: any) =>
        c.student_chapters.some((sc: any) => sc.students.center_id === centerId)
      );

      // Unique by subject + chapter_name
      const seen = new Set();
      const unique: any[] = [];

      for (const chapter of centerChapters) {
        const key = `${chapter.subject}|${chapter.chapter_name}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(chapter);
        }
      }

      return unique;
    },
  });

  const grades = Array.from(new Set(students.map(s => s.grade)));
  const subjects = Array.from(new Set(chapters.map(c => c.subject)));

  // -------------------------------
  // SELECT / REMOVE STUDENTS
  // -------------------------------
  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudentIds(students.map(s => s.id));
  };

  // -------------------------------
  // ADD CHAPTER
  // -------------------------------
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      let chapterId: string;

      // If selecting existing chapter
      if (selectedChapterId) {
        const selected = uniqueChapters.find(c => c.id === selectedChapterId);
        if (!selected) throw new Error("Chapter not found");

        const { data, error } = await supabase
          .from("chapters")
          .insert({
            subject: selected.subject,
            chapter_name: selected.chapter_name,
            date_taught: date,
            notes: notes || null
          })
          .select()
          .single();

        if (error) throw error;
        chapterId = data.id;
      }

      // Creating new chapter manually
      else if (subject && chapterName) {
        const { data, error } = await supabase
          .from("chapters")
          .insert({
            subject,
            chapter_name: chapterName,
            date_taught: date,
            notes: notes || null
          })
          .select()
          .single();

        if (error) throw error;
        chapterId = data.id;
      }

      else throw new Error("Please select or create a chapter");

      // Insert links for students
      const studentChapters = selectedStudentIds.map(sid => ({
        student_id: sid,
        chapter_id: chapterId,
        completed: true,
        date_completed: date,
      }));

      const { error: scError } = await supabase
        .from("student_chapters")
        .insert(studentChapters);

      if (scError) throw scError;
    },
    onSuccess: () => {
      toast.success("Chapter recorded");
      queryClient.invalidateQueries();

      setSelectedChapterId("");
      setSubject("");
      setChapterName("");
      setNotes("");
      setSelectedStudentIds([]);
      setIsDialogOpen(false);
    }
  });

  // -------------------------------
  // DELETE CHAPTER
  // -------------------------------
  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chapter deleted");
      queryClient.invalidateQueries();
    }
  });

  // -------------------------------------
  // UI
  // -------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Chapters Tracking</h1>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Record Chapter
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Chapter</DialogTitle>
              <DialogDescription>Select or create a chapter</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">

              {/* DATE */}
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              {/* PREVIOUS CHAPTERS */}
              <div className="border rounded-lg p-4 space-y-2">
                <Label className="font-semibold">Select Previous Chapter</Label>

                <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
                  <SelectTrigger><SelectValue placeholder="Choose a chapter..." /></SelectTrigger>
                  <SelectContent>
                    {uniqueChapters.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.subject} — {c.chapter_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* OR DIVIDER */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* CREATE NEW CHAPTER */}
              <div className="border rounded-lg p-4 space-y-3">
                <Label className="font-semibold">Create New Chapter</Label>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Subject</Label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>

                  <div>
                    <Label>Chapter Name</Label>
                    <Input value={chapterName} onChange={(e) => setChapterName(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* NOTES */}
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {/* STUDENTS */}
              <div className="space-y-3">
                <Label className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Select Students ({selectedStudentIds.length})
                </Label>

                <Button variant="outline" size="sm" onClick={selectAllStudents}>
                  Select All
                </Button>

                {/* Grade Filter */}
                <div>
                  <Label>Filter by Grade</Label>
                  <Select value={filterGrade} onValueChange={setFilterGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {grades.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* STUDENT LIST */}
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {students
                    .filter(s => filterGrade === "all" || s.grade === filterGrade)
                    .map(s => (
                      <div
                        key={s.id}
                        className={`flex items-center space-x-2 p-1 rounded-md 
                          ${presentStudents.has(s.id) ? "bg-green-100" : ""}
                        `}
                      >
                        <Checkbox
                          checked={selectedStudentIds.includes(s.id)}
                          onCheckedChange={() => toggleStudentSelection(s.id)}
                          id={s.id}
                        />
                        <label htmlFor={s.id} className="cursor-pointer text-sm">
                          {s.name} — Grade {s.grade}
                        </label>
                      </div>
                    ))}
                </div>
              </div>

              <Button
                disabled={
                  selectedStudentIds.length === 0 ||
                  (!selectedChapterId && (!subject || !chapterName))
                }
                onClick={() => addChapterMutation.mutate()}
                className="w-full"
              >
                Save for {selectedStudentIds.length} Student(s)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* CHAPTER LIST */}
      <Card>
        <CardHeader>
          <CardTitle>Chapters Taught</CardTitle>

          {/* Filters */}
          <div className="grid grid-cols-3 gap-4 mt-4">

            <div>
              <Label>Subject</Label>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Student</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Grade</Label>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {grades.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
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
                  <div>
                    <h3 className="font-semibold">{chapter.chapter_name}</h3>
                    <p className="text-sm text-muted-foreground">{chapter.subject}</p>
                    <p className="text-sm mt-2">
                      Date Taught: {format(new Date(chapter.date_taught), "PPP")}
                    </p>
                    {chapter.notes && (
                      <p className="text-sm mt-2">{chapter.notes}</p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
                      {chapter.student_chapters?.map((sc: any) => (
                        <span
                          key={sc.id}
                          className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                        >
                          {sc.students?.name} — Grade {sc.students?.grade}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteChapterMutation.mutate(chapter.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {chapters.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No chapters recorded yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
