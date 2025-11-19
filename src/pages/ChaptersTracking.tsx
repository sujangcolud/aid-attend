import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users } from "lucide-react";

export default function RecordChapterPopup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // --- UI states ---
  const [open, setOpen] = useState(false);
  const [popupGradeFilter, setPopupGradeFilter] = useState("all");
  const [showPresentOnly, setShowPresentOnly] = useState(false);
  const [autoSelectPresent, setAutoSelectPresent] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");

  // -----------------------
  //   FETCH STUDENTS
  // -----------------------
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("center_id", user?.center_id)
        .order("name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const grades = [...new Set(students.map(s => s.grade))];

  // -----------------------------
  //   FETCH PRESENT STUDENTS FOR ANY DATE
  // -----------------------------
  const { data: presentStudents = [] } = useQuery({
    queryKey: ["present-students", selectedDate, user?.center_id],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id")
        .eq("date", selectedDate)
        .eq("center_id", user?.center_id)
        .eq("status", "present");

      if (error) throw error;
      return data.map(r => r.student_id);
    },
    enabled: !!selectedDate,
  });

  // -----------------------------------------
  // AUTO-SELECT PRESENT STUDENTS WHEN DATE CHANGES
  // -----------------------------------------
  useEffect(() => {
    if (autoSelectPresent && presentStudents.length > 0) {
      setSelectedStudentIds(presentStudents);
    }
  }, [presentStudents, autoSelectPresent]);

  // ---------------------------------------
  // SELECT ALL — respects filters
  // ---------------------------------------
  const handleSelectAll = () => {
    const filtered = students
      .filter(s => popupGradeFilter === "all" || s.grade === popupGradeFilter)
      .filter(s => !showPresentOnly || presentStudents.includes(s.id));

    setSelectedStudentIds(filtered.map(s => s.id));
  };

  const handleToggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Record Chapter</Button>

      {open && (
        <div className="p-4 border rounded-lg bg-white w-full max-w-lg mx-auto mt-4">
          <h2 className="text-lg font-semibold mb-3">Record Chapter</h2>

          {/* DATE PICKER */}
          <Label>Date</Label>
          <Input
            type="date"
            className="mt-1 mb-3"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedStudentIds([]); // reset selection on date change
            }}
          />

          {/* AUTO SELECT PRESENT */}
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
              checked={autoSelectPresent}
              onCheckedChange={() => setAutoSelectPresent(!autoSelectPresent)}
            />
            <Label>Auto-select present students</Label>
          </div>

          {/* SHOW PRESENT ONLY FILTER */}
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              checked={showPresentOnly}
              onCheckedChange={() => setShowPresentOnly(!showPresentOnly)}
            />
            <Label>Show present students only</Label>
          </div>

          {/* GRADE FILTER */}
          <Label>Filter by Grade</Label>
          <Select value={popupGradeFilter} onValueChange={setPopupGradeFilter}>
            <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {grades.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* SELECT ALL */}
          <Button className="w-full mt-3" onClick={handleSelectAll}>
            Select All (Filtered)
          </Button>

          {/* STUDENT LIST */}
          <div className="border rounded-lg p-3 max-h-64 overflow-y-auto mt-3">
            {students
              .filter(s => popupGradeFilter === "all" || s.grade === popupGradeFilter)
              .filter(s => !showPresentOnly || presentStudents.includes(s.id))
              .map(student => (
                <div key={student.id} className="flex items-center gap-3 py-1">
                  <Checkbox
                    checked={selectedStudentIds.includes(student.id)}
                    onCheckedChange={() => handleToggleStudent(student.id)}
                  />
                  <span>{student.name} — Grade {student.grade}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
