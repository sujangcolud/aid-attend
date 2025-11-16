import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectContent,
  SelectValue,
} from "@/components/ui/select"; // ⭐ ADDED

interface Student {
  id: string;
  name: string;
  grade: string;
}

interface AttendanceRecord {
  studentId: string;
  present: boolean;
  timeIn: string;
  timeOut: string;
}

export default function TakeAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});

  // ⭐ ADDED – grade filter
  const [gradeFilter, setGradeFilter] = useState("all");

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Fetch students
  const { data: students } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("id, name, grade")
        .order("name");

      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
  });

  // ⭐ ADDED – extract unique grades
  const uniqueGrades = students
    ? ["all", ...Array.from(new Set(students.map((s) => s.grade)))]
    : ["all"];

  // Filter displayed students
  const filteredStudents = students
    ? gradeFilter === "all"
      ? students
      : students.filter((s) => s.grade === gradeFilter)
    : [];

  // Fetch existing attendance
  const { data: existingAttendance } = useQuery({
    queryKey: ["attendance", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status, time_in, time_out")
        .eq("date", dateStr);

      if (error) throw error;
      return data;
    },
    enabled: !!dateStr,
  });

  // Initialize attendance states
  useEffect(() => {
    if (existingAttendance && students) {
      const newAttendance: Record<string, AttendanceRecord> = {};
      students.forEach((student) => {
        const record = existingAttendance.find((a) => a.student_id === student.id);
        newAttendance[student.id] = {
          present: record?.status === "Present",
          timeIn: record?.time_in || "",
          timeOut: record?.time_out || "",
          studentId: student.id,
        };
      });
      setAttendance(newAttendance);
    }
  }, [existingAttendance, students]);

  // Save attendance
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!students) return;

      await supabase.from("attendance").delete().eq("date", dateStr);

      const records = students.map((student) => ({
        student_id: student.id,
        date: dateStr,
        status: attendance[student.id]?.present ? "Present" : "Absent",
        time_in: attendance[student.id]?.timeIn || null,
        time_out: attendance[student.id]?.timeOut || null,
      }));

      const { error } = await supabase.from("attendance").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      toast.success("Attendance saved successfully!");
    },
    onError: () => {
      toast.error("Failed to save attendance");
    },
  });

  // Toggle present/absent
  const handleToggle = (studentId: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        present: !prev[studentId]?.present,
      },
    }));
  };

  const handleTimeChange = (studentId: string, field: "timeIn" | "timeOut", value: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const markAllPresent = () => {
    if (!filteredStudents) return;
    const updated = { ...attendance };
    filteredStudents.forEach((s) => {
      updated[s.id] = {
        ...updated[s.id],
        present: true,
      };
    });
    setAttendance(updated);
  };

  const markAllAbsent = () => {
    if (!filteredStudents) return;
    const updated = { ...attendance };
    filteredStudents.forEach((s) => {
      updated[s.id] = {
        ...updated[s.id],
        present: false,
        timeIn: "",
        timeOut: "",
      };
    });
    setAttendance(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Take Attendance</h2>
        <p className="text-muted-foreground">Mark students as present or absent</p>
      </div>

      {/* Date Picker */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
          <CardDescription>Choose the date for attendance recording</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left md:w-[280px]")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* ⭐ ADDED — Grade Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter By Grade</CardTitle>
          <CardDescription>Display students by selected grade</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select Grade" />
            </SelectTrigger>
            <SelectContent>
              {uniqueGrades.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {grade === "all" ? "All Grades" : grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Student List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Student Attendance</CardTitle>
              <CardDescription>Select students present today</CardDescription>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={markAllPresent}>
                Mark All Present
              </Button>
              <Button variant="outline" size="sm" onClick={markAllAbsent}>
                Mark All Absent
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredStudents.length > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="rounded-lg border p-4 hover:bg-muted/50 transition"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={student.id}
                          checked={attendance[student.id]?.present || false}
                          onCheckedChange={() => handleToggle(student.id)}
                        />
                        <Label htmlFor={student.id}>
                          {student.name}
                        </Label>
                      </div>
                      <span className="text-sm text-muted-foreground">{student.grade}</span>
                    </div>

                    <div className="flex gap-4 ml-7">
                      <div className="flex-1">
                        <Label className="text-xs">Time In</Label>
                        <Input
                          type="time"
                          value={attendance[student.id]?.timeIn || ""}
                          onChange={(e) =>
                            handleTimeChange(student.id, "timeIn", e.target.value)
                          }
                        />
                      </div>

                      <div className="flex-1">
                        <Label className="text-xs">Time Out</Label>
                        <Input
                          type="time"
                          value={attendance[student.id]?.timeOut || ""}
                          onChange={(e) =>
                            handleTimeChange(student.id, "timeOut", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="submit" className="w-full">
                Save Attendance
              </Button>
            </form>
          ) : (
            <p className="text-muted-foreground text-center">
              No students found for this grade.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
