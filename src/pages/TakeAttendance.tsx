import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface MiniDayNote {
  holiday: boolean;
  note: string;
}

export default function TakeAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [attendanceDates, setAttendanceDates] = useState<string[]>([]);
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [miniCalendarMonth, setMiniCalendarMonth] = useState<Date>(new Date());
  const [miniCalendar, setMiniCalendar] = useState<Record<string, MiniDayNote>>({});

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  /* --------------------------------------------------------------------------
    1️⃣ FETCH STUDENTS (CENTER FILTER ALREADY BUILT-IN)
  -------------------------------------------------------------------------- */
  const { data: students } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("id, name, grade").order("name");

      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
  });

  const centerStudentIds = students?.map((s) => s.id) || [];

  /* --------------------------------------------------------------------------
    2️⃣ FETCH ATTENDANCE — ISOLATED BY CENTER STUDENT IDS
  -------------------------------------------------------------------------- */
  const { data: existingAttendance } = useQuery({
    queryKey: ["attendance", dateStr, centerStudentIds.join(",")],
    queryFn: async () => {
      if (!centerStudentIds.length) return [];

      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status, time_in, time_out, date")
        .eq("date", dateStr)
        .in("student_id", centerStudentIds); // ⬅ FIX HERE

      if (error) throw error;
      return data;
    },
    enabled: !!dateStr && centerStudentIds.length > 0,
  });

  /* --------------------------------------------------------------------------
    3️⃣ FETCH ALL ATTENDANCE DATES (CENTER-ONLY)
  -------------------------------------------------------------------------- */
  useEffect(() => {
    async function fetchAttendanceDates() {
      if (!centerStudentIds.length) return;

      const { data, error } = await supabase
        .from("attendance")
        .select("date")
        .in("student_id", centerStudentIds)
        .order("date", { ascending: false });

      if (!error && data) {
        const uniqueDates = Array.from(new Set(data.map((d: any) => d.date)));
        setAttendanceDates(uniqueDates);
      }
    }

    fetchAttendanceDates();
  }, [centerStudentIds.join(",")]);

  /* --------------------------------------------------------------------------
    4️⃣ INITIALIZE ATTENDANCE UI STATE
  -------------------------------------------------------------------------- */
  useEffect(() => {
    if (students) {
      const newAttendance: Record<string, AttendanceRecord> = {};

      students.forEach((student) => {
        const record = existingAttendance?.find((a) => a.student_id === student.id);

        newAttendance[student.id] = {
          present: record?.status === "Present",
          timeIn: record?.time_in || "",
          timeOut: record?.time_out || "",
          studentId: student.id,
        };
      });

      setAttendance(newAttendance);
    }
  }, [students, existingAttendance]);

  /* --------------------------------------------------------------------------
    5️⃣ SAVE ATTENDANCE (DELETE + INSERT) — CENTER SAFE
  -------------------------------------------------------------------------- */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!centerStudentIds.length) return;

      // 🔥 Delete only attendance of this center (does not affect others)
      await supabase
        .from("attendance")
        .delete()
        .eq("date", dateStr)
        .in("student_id", centerStudentIds);

      // Prepare insert records
      const records = students!.map((student) => ({
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
      toast.success("Attendance saved successfully!");
    },
    onError: () => toast.error("Failed to save attendance"),
  });

  /* --------------------------------------------------------------------------
    6️⃣ UI HELPERS
  -------------------------------------------------------------------------- */
  const handleToggle = (studentId: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], present: !prev[studentId]?.present },
    }));
  };

  const handleTimeChange = (studentId: string, field: "timeIn" | "timeOut", value: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const markAllPresent = () => {
    if (!students) return;
    const updated: Record<string, AttendanceRecord> = {};

    students.forEach((student) => {
      updated[student.id] = { ...attendance[student.id], present: true };
    });

    setAttendance(updated);
  };

  const markAllAbsent = () => {
    if (!students) return;
    const updated: Record<string, AttendanceRecord> = {};

    students.forEach((student) => {
      updated[student.id] = {
        ...attendance[student.id],
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

  /* --------------------------------------------------------------------------
    7️⃣ FILTER STUDENTS BY GRADE
  -------------------------------------------------------------------------- */
  const filteredStudents =
    gradeFilter === "all" ? students : students?.filter((s) => s.grade === gradeFilter);

  /* --------------------------------------------------------------------------
    8️⃣ MINI CALENDAR (UNCHANGED)
  -------------------------------------------------------------------------- */
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(miniCalendarMonth),
    end: endOfMonth(miniCalendarMonth),
  });

  const toggleMiniHoliday = (date: string) => {
    setMiniCalendar((prev) => ({
      ...prev,
      [date]: {
        holiday: !prev[date]?.holiday,
        note: prev[date]?.note || "",
      },
    }));
  };

  const updateMiniNote = (date: string, note: string) => {
    setMiniCalendar((prev) => ({
      ...prev,
      [date]: {
        holiday: prev[date]?.holiday || false,
        note,
      },
    }));
  };

  /* --------------------------------------------------------------------------
    9️⃣ RETURN UI (UNCHANGED)
  -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Take Attendance</h2>
        <p className="text-muted-foreground">Mark students as present or absent</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-4 items-end">
          {/* Select Date */}
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !selectedDate && "text-muted-foreground"
                  )}
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
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Grade Filter */}
          <div className="flex-1 min-w-[120px]">
            <Label className="text-xs">Filter by Grade</Label>
            <select
              className="border p-2 rounded w-full"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
            >
              <option value="all">All Grades</option>
              {students &&
                Array.from(new Set(students.map((s) => s.grade))).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
            </select>
          </div>

          {/* Past Attendance */}
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Past Attendance</Label>
            <select
              className="border p-2 rounded w-full"
              value={dateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
            >
              {attendanceDates.map((d) => (
                <option key={d} value={d}>
                  {format(new Date(d), "PPP")}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Mini Calendar */}
          <div className="flex-1 min-w-[150px] mt-4">
            <Button variant="outline" onClick={() => setShowMiniCalendar((prev) => !prev)}>
              {showMiniCalendar ? "Hide Mini Calendar" : "Show Mini Calendar"}{" "}
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mini Calendar */}
      {showMiniCalendar && (
        <Card>
          <CardHeader>
            <CardTitle>Mini Month Calendar</CardTitle>
            <CardDescription>Mark holidays & add notes (local only)</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex gap-2 mb-2 items-center">
              <Label className="text-xs">Select Month:</Label>
              <input
                type="month"
                value={format(miniCalendarMonth, "yyyy-MM")}
                onChange={(e) => {
                  const [year, month] = e.target.value.split("-");
                  setMiniCalendarMonth(new Date(parseInt(year), parseInt(month) - 1));
                }}
                className="border p-1 rounded"
              />
            </div>

            <div className="grid grid-cols-7 gap-2">
              {daysInMonth.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const dayData =
                  miniCalendar[dayStr] || {
                    holiday: false,
                    note: "",
                  };

                return (
                  <div key={dayStr} className="flex flex-col items-center border rounded p-1">
                    <button
                      className={`w-full rounded text-sm mb-1 ${
                        dayData.holiday ? "bg-red-500 text-white" : "bg-gray-100"
                      }`}
                      onClick={() => toggleMiniHoliday(dayStr)}
                    >
                      {format(day, "d")}
                    </button>

                    <Input
                      type="text"
                      value={dayData.note}
                      onChange={(e) => updateMiniNote(dayStr, e.target.value)}
                      placeholder="Note"
                      className="text-xs p-1 w-full"
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Student Attendance</CardTitle>
              <CardDescription>Check the box for students who are present</CardDescription>
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
          {filteredStudents && filteredStudents.length > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={student.id}
                        checked={attendance[student.id]?.present || false}
                        onCheckedChange={() => handleToggle(student.id)}
                      />
                      <Label htmlFor={student.id} className="cursor-pointer font-medium">
                        {student.name}
                      </Label>
                    </div>

                    <span className="text-sm text-muted-foreground">{student.grade}</span>
                  </div>

                  <div className="flex gap-4 ml-7">
                    {/* Time In */}
                    <div className="flex-1">
                      <Label
                        htmlFor={`time-in-${student.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        Time In
                      </Label>
                      <Input
                        id={`time-in-${student.id}`}
                        type="time"
                        value={attendance[student.id]?.timeIn || ""}
                        onChange={(e) => handleTimeChange(student.id, "timeIn", e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    {/* Time Out */}
                    <div className="flex-1">
                      <Label
                        htmlFor={`time-out-${student.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        Time Out
                      </Label>
                      <Input
                        id={`time-out-${student.id}`}
                        type="time"
                        value={attendance[student.id]?.timeOut || ""}
                        onChange={(e) => handleTimeChange(student.id, "timeOut", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button type="submit" className="w-full">
                Save Attendance
              </Button>
            </form>
          ) : (
            <p className="text-center text-muted-foreground">No students registered yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
