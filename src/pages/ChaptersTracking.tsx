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
import { Trash2, Users, Plus, ChevronDown, ChevronUp } from "lucide-react";
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
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // Fetch students for this center
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*")
        .order("name");
      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance for the selected date
  const { data: presentToday = [] } = useQuery({
    queryKey: ["present-students", date, user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id")
        .eq("date", date)
        .eq("status", "present");
      if (error) throw error;
      return data.map((d: any) => d.student_id);
    },
  });

  // Auto select present students whenever date or grade changes
  const filteredStudents = students.filter(
    (s) => (filterGrade === "all" || s.grade === filterGrade)
  );

  // Update selectedStudentIds to include present students
  const autoSelectPresent = () => {
    const presentIds = filteredStudents
      .filter((s) => presentToday.includes(s.id))
      .map((s) => s.id);
    setSelectedStudentIds(presentIds);
  };

  // Call autoSelectPresent whenever date or grade changes
  useState(() => {
    autoSelectPresent();
  }, [date, filterGrade, students, presentToday]);

  // Fetch chapters for this center
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", filterSubject, filterStudent, filterGrade, user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("chapters")
        .select("*, student_chapters(*, students(name, grade, center_id))")
        .order("date_taught", { ascending: false });

      if (filterSubject !== "all") query = query.eq("subject", filterSubject);
      const { data, error } = await query;
      if (error) throw error;

      let filtered = data.filter((chapter: any) =>
        chapter.student_chapters.some((sc: any) => sc.students.center_id === user?.center_id)
      );

      if (filterStudent !== "all") {
        filtered = filtered.filter((chapter: any) =>
          chapter.student_chapters.some((sc: any) => sc.student_id === filterStudent)
        );
      }

      if (filterGrade !== "all") {
        filtered = filtered.filter((chapter: any) =>
          chapter.student_chapters.some((sc: any) => sc.students.grade === filterGrade)
        );
      }

      return filtered;
    },
  });

  // Fetch unique chapters
  const { data: uniqueChapters = [] } = useQuery({
    queryKey: ["unique-chapters", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("chapters").select("id, subject, chapter_name");
      const { data, error } = await query;
      if (error) throw error;
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

  // Add chapter
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      let chapterId: string;
      if (selectedChapterId) {
        const selectedChapter = uniqueChapters.find((c) => c.id === selectedChapterId);
        if (!selectedChapter) throw new Error("Chapter not found");
        const { data: chapterData, error } = await supabase
          .from("chapters")
          .insert({ subject: selectedChapter.subject, chapter_name: selectedChapter.chapter_name, date_taught: date, notes: notes || null })
          .select()
          .single();
        if (error) throw error;
        chapterId = chapterData.id;
      } else if (subject && chapterName) {
        const { data: chapterData, error } = await supabase
          .from("chapters")
          .insert({ subject, chapter_name, date_taught: date, notes: notes || null })
          .select()
          .single();
        if (error) throw error;
        chapterId = chapterData.id;
      } else {
        throw new Error("Select a previous chapter or enter a new one");
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

  // Delete chapter
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

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudentIds(filteredStudents.map((s) => s.id));
  };

  const toggleChapterExpand = (chapterId: string) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const subjects = Array.from(new Set(chapters.map((c) => c.subject)));
  const grades = Array.from(new Set(students.map((s) => s.grade)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chapters Tracking</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Record Chapter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Chapter</DialogTitle>
              <DialogDescription>
                Select a previously taught chapter or create a new one
              </DialogDescription>
            </DialogHeader>

            {/* Form */}
            <div className="space-y-4 py-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className={`space-y-3 border rounded-lg p-4 ${selectedChapterId ? "border-primary" : ""}`}>
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

              {/* Students + Grade Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Select Students ({selectedStudentIds.length} selected)
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={selectAllStudents}>
                    Select All
                  </Button>
                </div>

                <div className="mt-2">
                  <Label>Filter by Grade</Label>
                  <Select value={filterGrade} onValueChange={setFilterGrade}>
                    <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={student.id}
                        checked={selectedStudentIds.includes(student.id)}
                        onCheckedChange={() => toggleStudentSelection(student.id)}
                      />
                      <label htmlFor={student.id} className="text-sm font-medium leading-none cursor-pointer">
                        {student.name} - Grade {student.grade}
                        {presentToday.includes(student.id) && <span className="ml-2 text-green-600 text-xs">(Present Today)</span>}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => addChapterMutation.mutate()}
                disabled={selectedStudentIds.length === 0 || (!selectedChapterId && (!subject || !chapterName)) || addChapterMutation.isPending}
                className="w-full"
              >
                Record Chapter for {selectedStudentIds.length} Student(s)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chapters Taught */}
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
                  {subjects.map((subj) => <SelectItem key={subj} value={subj}>{subj}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Student</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Grade</Label>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {chapters.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                No chapters recorded yet
              </p>
            )}
            {chapters.map((chapter: any) => {
              const isExpanded = expandedChapters[chapter.id] || false;
              return (
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

                      <Button
                        variant="outline"
                        size="sm"
                        className="mb-2"
                        onClick={() => toggleChapterExpand(chapter.id)}
                        icon={isExpanded ? <ChevronUp /> : <ChevronDown />}
                      >
                        {isExpanded ? "Hide Students" : "Show Students"}
                      </Button>

                      {isExpanded && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {chapter.student_chapters?.map((sc: any) => (
                            <span
                              key={sc.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
                            >
                              {sc.students?.name} - Grade {sc.students?.grade}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => deleteChapterMutation.mutate(chapter.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
