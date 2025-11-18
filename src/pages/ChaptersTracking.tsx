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

  // Fetch chapters
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

      // Filter by center
      let filtered = data.filter((chapter: any) =>
        chapter.student_chapters.some((sc: any) => sc.students.center_id === user?.center_id)
      );

      // Filter by student
      if (filterStudent !== "all") {
        filtered = filtered.filter((chapter: any) =>
          chapter.student_chapters.some((sc: any) => sc.student_id === filterStudent)
        );
      }

      // Filter by grade
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

  // Fetch present students for selected date
  const { data: presentToday = [] } = useQuery({
    queryKey: ["present-students", date, user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id")
        .eq("date", date)
        .eq("status", "Present");
      if (error) throw error;
      return data.map((d: any) => d.student_id);
    },
  });

  // Auto-select present students on date change without removing manual selections
  useEffect(() => {
    if (!presentToday) return;
    setSelectedStudentIds(prev => {
      const combined = new Set([...prev, ...presentToday]);
      return Array.from(combined);
    });
  }, [presentToday]);

  // Add chapter mutation
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      let chapterId: string;
      if (selectedChapterId) {
        const selectedChapter = uniqueChapters.find(c => c.id === selectedChapterId);
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

      const studentChapters = selectedStudentIds.map(studentId => ({
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
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  // Select students based on current grade filter only
  const selectAllStudents = () => {
    const filtered = students.filter(s => filterGrade === "all" || s.grade === filterGrade);
    setSelectedStudentIds(filtered.map(s => s.id));
  };

  const subjects = Array.from(new Set(chapters.map(c => c.subject)));
  const grades = Array.from(new Set(students.map(s => s.grade)));

  return (
    <div className="space-y-6">
      {/* Dialog and inputs */}
      {/* Keep all your previous dialog and chapter creation code exactly the same */}

      {/* Student selection */}
      <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
        {students
          .filter(s => filterGrade === "all" || s.grade === filterGrade)
          .map(student => {
            const isPresentToday = presentToday.includes(student.id);
            return (
              <div key={student.id} className={`flex items-center space-x-2 p-1 rounded ${isPresentToday ? "bg-green-100" : ""}`}>
                <Checkbox
                  id={student.id}
                  checked={selectedStudentIds.includes(student.id)}
                  onCheckedChange={() => toggleStudentSelection(student.id)}
                />
                <label htmlFor={student.id} className="text-sm font-medium cursor-pointer">
                  {student.name} - Grade {student.grade}
                  {isPresentToday && <span className="ml-2 text-green-600 text-xs">(Present Today)</span>}
                </label>
              </div>
            );
          })}
      </div>

      {/* Chapters table */}
      {/* Keep all your previous chapters table code as-is */}
    </div>
  );
}
