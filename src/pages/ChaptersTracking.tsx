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
  const [filterGrade, setFilterGrade] = useState("all");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // Fetch students for the center
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("center_id", user.center_id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Present students for the selected date
  const { data: presentToday = [] } = useQuery({
    queryKey: ["present-students", date, user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id")
        .eq("date", date)
        .eq("status", "Present")
        .in("student_id", students.map(s => s.id));
      if (error) throw error;
      return data.map(d => d.student_id);
    },
  });

  // Auto-select present students filtered by grade
  useEffect(() => {
    if (!presentToday) return;
    const filtered = students
      .filter(s => (filterGrade === "all" || s.grade === filterGrade) && presentToday.includes(s.id))
      .map(s => s.id);
    setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filtered])));
  }, [presentToday, filterGrade, students]);

  // Unique previous chapters for the center
  const { data: uniqueChapters = [] } = useQuery({
    queryKey: ["unique-chapters", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("chapters")
        .select("id, subject, chapter_name, student_chapters(student_id, students(center_id))");
      if (error) throw error;
      // Only chapters from this center
      return data.filter(ch =>
        ch.student_chapters?.some((sc: any) => sc.students.center_id === user.center_id)
      );
    },
  });

  // All chapters for display table
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("chapters")
        .select("*, student_chapters(*, students(name, grade, center_id))")
        .order("date_taught", { ascending: false });
      if (error) throw error;
      return data.filter(ch =>
        ch.student_chapters?.some((sc: any) => sc.students.center_id === user.center_id)
      );
    },
  });

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };
  const selectAllStudents = () => {
    const filtered = students.filter(s => filterGrade === "all" || s.grade === filterGrade);
    setSelectedStudentIds(filtered.map(s => s.id));
  };
  const deselectAllStudents = () => setSelectedStudentIds([]);

  const toggleChapterExpand = (id: string) => {
    setExpandedChapters(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Add chapter mutation with onConflict handling
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      let chapter_id: string;

      if (selectedChapterId) {
        // Previous chapter selected
        chapter_id = selectedChapterId;
      } else if (subject && chapterName) {
        const { data: chapterData, error } = await supabase
          .from("chapters")
          .insert({ subject, chapter_name: chapterName, date_taught: date, notes: notes || null })
          .select()
          .single();
        if (error) throw error;
        chapter_id = chapterData.id;
      } else {
        throw new Error("Select previous chapter or create new one");
      }

      // Link students (allow multiple dates)
      const studentChapters = selectedStudentIds.map(id => ({
        student_id: id,
        chapter_id,
        completed: true,
        date_completed: date
      }));

      const { error } = await supabase.from("student_chapters").insert(studentChapters, {
        onConflict: ["student_id", "chapter_id", "date_completed"], // Prevent exact duplicate only
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["chapters"]);
      queryClient.invalidateQueries(["unique-chapters"]);
      toast.success("Chapter recorded successfully");
      setSelectedStudentIds([]);
      setSubject("");
      setChapterName("");
      setNotes("");
      setSelectedChapterId("");
      setIsDialogOpen(false);
    },
    onError: (error: any) => toast.error(error.message || "Failed to record chapter"),
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["chapters"]);
      toast.success("Chapter deleted");
    },
    onError: () => toast.error("Failed to delete chapter"),
  });

  const grades = Array.from(new Set(students.map(s => s.grade)));

  return (
    <div className="space-y-6">
      {/* Header + Dialog */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Chapter Tracking</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2"/> Record Chapter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Chapter</DialogTitle>
              <DialogDescription>Select previous chapter or create new one</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>

              {/* Previous chapters */}
              <div className="space-y-3 border rounded-lg p-4">
                <Label>Previous Chapters (Center Only)</Label>
                <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
                  <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {uniqueChapters.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.subject} - {c.chapter_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t"/></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* New chapter */}
              <div className="space-y-3 border rounded-lg p-4">
                <Label>Create New Chapter</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
                  <Input value={chapterName} onChange={e => setChapterName(e.target.value)} placeholder="Chapter Name" />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes..." />
              </div>

              {/* Student selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="flex items-center gap-2"><Users className="h-4 w-4"/> Students ({selectedStudentIds.length})</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={selectAllStudents}>Select All</Button>
                    <Button size="sm" variant="outline" onClick={deselectAllStudents}>Deselect All</Button>
                  </div>
                </div>

                <div className="mt-2">
                  <Label>Filter by Grade</Label>
                  <Select value={filterGrade} onValueChange={setFilterGrade}>
                    <SelectTrigger><SelectValue placeholder="All Grades"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg p-2 max-h-48 overflow-y-auto">
                  {students
                    .filter(s => filterGrade === "all" || s.grade === filterGrade)
                    .map(s => {
                      const present = presentToday.includes(s.id);
                      return (
                        <div key={s.id} className={`flex items-center gap-2 p-1 rounded ${present ? "bg-green-100" : ""}`}>
                          <Checkbox checked={selectedStudentIds.includes(s.id)} onCheckedChange={() => toggleStudentSelection(s.id)} id={s.id}/>
                          <label htmlFor={s.id} className="text-sm">{s.name} - Grade {s.grade} {present && "(Present Today)"}</label>
                        </div>
                      );
                    })}
                </div>
              </div>

              <Button
                onClick={() => addChapterMutation.mutate()}
                disabled={selectedStudentIds.length === 0 || (!selectedChapterId && (!subject || !chapterName))}
                className="w-full"
              >
                Record Chapter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chapters Taught */}
      <Card>
        <CardHeader><CardTitle>Chapters Taught</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chapters.map(chapter => {
              const expanded = expandedChapters[chapter.id] || false;
              return (
                <div key={chapter.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{chapter.chapter_name}</h3>
                        <Button size="sm" variant="outline" onClick={() => toggleChapterExpand(chapter.id)}>
                          {expanded ? <ChevronUp/> : <ChevronDown/>}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{chapter.subject} | Date: {format(new Date(chapter.date_taught), "PPP")}</p>
                      {chapter.notes && <p className="text-sm mb-2">{chapter.notes}</p>}
                      {expanded && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {chapter.student_chapters.map((sc: any) => (
                            <span key={sc.id} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${presentToday.includes(sc.student_id) ? "bg-green-100 text-green-800" : "bg-primary/10 text-primary"}`}>
                              {sc.students?.name} - Grade {sc.students?.grade} {presentToday.includes(sc.student_id) && "(Present)"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteChapterMutation.mutate(chapter.id)}>
                      <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>
                </div>
              );
            })}
            {chapters.length === 0 && <p className="text-muted-foreground text-center py-8">No chapters recorded yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
