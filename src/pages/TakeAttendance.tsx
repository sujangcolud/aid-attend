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
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
  const [holidayFor, setHolidayFor] = useState<"" | "all" | string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [holidayMap, setHolidayMap] = useState<Record<string, "" | "all" | string>>({});
  const [attendanceDates, setAttendanceDates] = useState<string[]>([]);
  const [miniCalendar, setMiniCalendar] = useState<Record<string, MiniDayNote>>({});

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Fetch students
  const { data: students } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("id, name, grade").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq('center_id', user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
  });

  // Fetch existing attendance for selected date
  const { data: existingAttendance } = useQuery({
    queryKey: ["attendance", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("student_id, status, time_in, time_out, date").eq("date", dateStr);
      if (error) throw error;
      return data;
    },
    enabled: !!dateStr,
  });

  // Fetch all dates with attendance (for past attendance dropdown)
  useEffect(() => {
    async function fetchAttendanceDates() {
      if (!students) return;
      const { data, error } = await supabase
        .from("attendance")
        .select("date")
        .in("student_id", students.map(s => s.id))
        .order("date", { ascending: false });
      if (!error && data) {
        const uniqueDates = Array.from(new Set(data.map((d: any) => d.date)));
        setAttendanceDates(uniqueDates);
      }
    }
    fetchAttendanceDates();
  }, [students]);

  // Initialize attendance state
  useEffect(() => {
    if (students) {
      const newAttendance: Record<string, AttendanceRecord> = {};
      students.forEach((student) => {
        const record = existingAttendance?.find(a => a.student_id === student.id);
        newAttendance[student.id] = {
          present: record?.status === "Present",
          timeIn: record?.time_in || "",
          timeOut: record?.time_out || "",
          studentId: student.id,
        };
      });
      setAttendance(newAttendance);
      setHolidayFor(holidayMap[dateStr] || "");
    }
  }, [students, existingAttendance, dateStr, holidayMap]);

  // Apply holiday automatically whenever holidayFor changes
  useEffect(() => {
    if (!students || !holidayFor) return;
    const newAttendance = { ...attendance };
    students.forEach((student) => {
      if (holidayFor === "all" || student.grade === holidayFor) {
        newAttendance[student.id] = {
          ...newAttendance[student.id],
          present: false,
          timeIn: "",
          timeOut: "",
          studentId: student.id,
        };
      }
    });
    setAttendance(newAttendance);
    setHolidayMap(prev => ({ ...prev, [dateStr]: holidayFor }));
  }, [holidayFor, students, dateStr]);

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
      toast.success("Attendance saved successfully!");
    },
    onError: () => toast.error("Failed to save attendance"),
  });

  const handleToggle = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], present: !prev[studentId]?.present }
    }));
  };

  const handleTimeChange = (studentId: string, field: "timeIn" | "timeOut", value: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const markAllPresent = () => {
    if (!students) return;
    const newAttendance: Record<string, AttendanceRecord> = {};
    students.forEach(student => {
      if (!(holidayFor === "all" || student.grade === holidayFor)) {
        newAttendance[student.id] = { ...attendance[student.id], present: true };
      }
    });
    setAttendance(newAttendance);
  };

  const markAllAbsent = () => {
    if (!students) return;
    const newAttendance: Record<string, AttendanceRecord> = {};
    students.forEach(student => {
      if (!(holidayFor === "all" || student.grade === holidayFor)) {
        newAttendance[student.id] = { ...attendance[student.id], present: false, timeIn: "", timeOut: "" };
      }
    });
    setAttendance(newAttendance);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const isStudentDisabled = (student: Student) => holidayFor === "all" || student.grade === holidayFor;

  const filteredStudents =
    gradeFilter === "all"
      ? students
      : students?.filter((s) => s.grade === gradeFilter);

  // Mini Calendar for the month
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });

  const toggleMiniHoliday = (date: string) => {
    setMiniCalendar(prev => ({
      ...prev,
      [date]: { holiday: !prev[date]?.holiday, note: prev[date]?.note || "" }
    }));
  };

  const updateMiniNote = (date: string, note: string) => {
    setMiniCalendar(prev => ({
      ...prev,
      [date]: { holiday: prev[date]?.holiday || false, note }
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Take Attendance</h2>
        <p className="text-muted-foreground">Mark students as present or absent</p>
      </div>

      {/* Filters Row */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          {/* Past Attendance */}
          <div className="flex-1 min-w-[150px]">
            <Label className="text-xs">Select Past Attendance</Label>
            <select
              className="border p-2 rounded w-full"
              value={dateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
            >
              {attendanceDates.map((d: string) => (
                <option key={d} value={d}>
                  {format(new Date(d), "PPP")}
                </option>
              ))}
            </select>
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
              {students && Array.from(new Set(students.map(s => s.grade))).map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Holiday Selector */}
          <div className="flex-1 min-w-[120px]">
            <Label className="text-xs">Mark Holiday</Label>
            <select
              className="border p-2 rounded w-full"
              value={holidayFor}
              onChange={(e) => setHolidayFor(e.target.value as "" | "all" | string)}
            >
              <option value="">None</option>
              <option value="all">All Grades</option>
              {students && Array.from(new Set(students.map(s => s.grade))).map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {holidayFor && (
            <div className="min-w-[150px]">
              <span className="text-sm text-red-500 block mt-5">
                {holidayFor === "all" ? "All students marked holiday" : `Grade ${holidayFor} marked holiday`}
              </span>
            </div>
          )}

          {/* Date Picker */}
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
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Mini Calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Mini Month Calendar</CardTitle>
          <CardDescription>Mark holidays and add notes (stored locally)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {daysInMonth.map((day) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const dayData = miniCalendar[dayStr] || { holiday: false, note: "" };
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

      {/* Attendance Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Student Attendance</CardTitle>
              <CardDescription>Check the box for students who are present</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={markAllPresent}>Mark All Present</Button>
              <Button variant="outline" size="sm" onClick={markAllAbsent}>Mark All Absent</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents && filteredStudents.length > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {filteredStudents.map(student => (
                <div key={student.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={student.id}
                        checked={attendance[student.id]?.present || false}
                        onCheckedChange={() => handleToggle(student.id)}
                        disabled={isStudentDisabled(student)}
                      />
                      <Label htmlFor={student.id} className="cursor-pointer font-medium">
                        {student.name}
                      </Label>
                    </div>
                    <span className="text-sm text-muted-foreground">{student.grade}</span>
                  </div>
                  <div className="flex gap-4 ml-7">
                    <div className="flex-1">
                      <Label htmlFor={`time-in-${student.id}`} className="text-xs text-muted-foreground">Time In</Label>
                      <Input
                        id={`time-in-${student.id}`}
                        type="time"
                        value={attendance[student.id]?.timeIn || ""}
                        onChange={e => handleTimeChange(student.id, "timeIn", e.target.value)}
                        disabled={isStudentDisabled(student)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor={`time-out-${student.id}`} className="text-xs text-muted-foreground">Time Out</Label>
                      <Input
                        id={`time-out-${student.id}`}
                        type="time"
                        value={attendance[student.id]?.timeOut || ""}
                        onChange={e => handleTimeChange(student.id, "timeOut", e.target.value)}
                        disabled={isStudentDisabled(student)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {isStudentDisabled(student) && <span className="text-sm text-blue-600 ml-7 mt-1 block">Holiday</span>}
                </div>
              ))}
              <Button type="submit" className="w-full">Save Attendance</Button>
            </form>
          ) : (
            <p className="text-center text-muted-foreground">No students registered yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
