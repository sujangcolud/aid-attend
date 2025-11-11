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
import { toast } from "sonner";
import { Trash2, Users } from "lucide-react";
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

  // Fetch chapters with students
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

  // Add chapter mutation with multi-student support
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      // First, create the chapter
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
      
      // Then, link to selected students
      const studentChapters = selectedStudentIds.map(studentId => ({
        student_id: studentId,
        chapter_id: chapterData.id,
        completed: true,
        date_completed: date,
      }));
      
      const { error: linkError } = await supabase
        .from("student_chapters")
        .insert(studentChapters);
      
      if (linkError) throw linkError;
      
      return chapterData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      toast.success("Chapter recorded for selected students");
      setSelectedStudentIds([]);
      setSubject("");
      setChapterName("");
      setNotes("");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Chapter already assigned to one or more selected students");
      } else {
        toast.error("Failed to record chapter");
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Chapters Tracking</h1>

      <Card>
        <CardHeader>
          <CardTitle>Record Chapter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

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
            disabled={selectedStudentIds.length === 0 || !subject || !chapterName || addChapterMutation.isPending}
            className="w-full"
          >
            Record Chapter for {selectedStudentIds.length} Student(s)
          </Button>
        </CardContent>
      </Card>

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
