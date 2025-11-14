// ... Keep all imports and useAuth hook as before
import { Pencil } from "lucide-react"; // For edit button

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
  const [editChapterId, setEditChapterId] = useState<string | null>(null);

  // Students, chapters, uniqueChapters queries remain unchanged
  // ... same as previous code ...

  // Add or update chapter mutation
  const saveChapterMutation = useMutation({
    mutationFn: async () => {
      let chapterId: string;

      if (editChapterId) {
        // Updating existing chapter
        chapterId = editChapterId;

        // Update chapter details
        const { error } = await supabase
          .from("chapters")
          .update({
            subject,
            chapter_name: chapterName,
            date_taught: date,
            notes: notes || null,
          })
          .eq("id", chapterId);
        if (error) throw error;

        // Delete existing student_chapters links
        const { error: delError } = await supabase
          .from("student_chapters")
          .delete()
          .eq("chapter_id", chapterId);
        if (delError) throw delError;

      } else {
        // Adding new chapter
        if (selectedChapterId) {
          const selectedChapter = uniqueChapters.find(c => c.id === selectedChapterId);
          if (!selectedChapter) throw new Error("Chapter not found");

          const { data: chapterData, error } = await supabase
            .from("chapters")
            .insert({
              subject: selectedChapter.subject,
              chapter_name: selectedChapter.chapter_name,
              date_taught: date,
              notes: notes || null,
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
            })
            .select()
            .single();
          if (error) throw error;
          chapterId = chapterData.id;
        } else {
          throw new Error("Select a previous chapter or enter a new one");
        }
      }

      // Insert student_chapters links
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
      toast.success(editChapterId ? "Chapter updated successfully" : "Chapter recorded successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save chapter");
    },
  });

  const resetForm = () => {
    setSelectedStudentIds([]);
    setSubject("");
    setChapterName("");
    setNotes("");
    setSelectedChapterId("");
    setEditChapterId(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (chapter: any) => {
    setEditChapterId(chapter.id);
    setDate(format(new Date(chapter.date_taught), "yyyy-MM-dd"));
    setSubject(chapter.subject);
    setChapterName(chapter.chapter_name);
    setNotes(chapter.notes || "");
    setSelectedStudentIds(chapter.student_chapters.map((sc: any) => sc.student_id));
    setIsDialogOpen(true);
  };

  // toggleStudentSelection, selectAllStudents, subjects, grades remain same

  return (
    <div className="space-y-6">
      {/* Dialog for Add/Edit Chapter */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editChapterId ? "Edit Chapter" : "Record Chapter"}</DialogTitle>
            <DialogDescription>
              {editChapterId ? "Update chapter details and assigned students" : "Select a previously taught chapter or create a new one"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

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
                <Button type="button" variant="outline" size="sm" onClick={selectAllStudents}>Select All</Button>
              </div>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {students.map((student) => (
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
              onClick={() => saveChapterMutation.mutate()}
              disabled={selectedStudentIds.length === 0 || !subject || !chapterName || saveChapterMutation.isPending}
              className="w-full"
            >
              {editChapterId ? "Update Chapter" : `Record Chapter for ${selectedStudentIds.length} Student(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chapters List */}
      <Card>
        <CardHeader>
          <CardTitle>Chapters Taught</CardTitle>
          {/* Filters remain same */}
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
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(chapter)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteChapterMutation.mutate(chapter.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {chapters.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No chapters recorded yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
