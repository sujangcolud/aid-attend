import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  grade: string;
}

export default function TakeAttendance() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, grade")
        .order("name");
      if (error) throw error;
      return data as Student[];
    },
  });

  const { data: existingAttendance } = useQuery({
    queryKey: ["attendance", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("date", dateStr);
      if (error) throw error;
      return data;
    },
    enabled: !!dateStr,
  });

  // Initialize attendance state when data is loaded
  useState(() => {
    if (existingAttendance && students) {
      const newAttendance: Record<string, boolean> = {};
      students.forEach((student) => {
        const record = existingAttendance.find((a) => a.student_id === student.id);
        newAttendance[student.id] = record?.status === "Present";
      });
      setAttendance(newAttendance);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!students) return;

      // Delete existing attendance for this date
      await supabase.from("attendance").delete().eq("date", dateStr);

      // Insert new attendance records
      const records = students.map((student) => ({
        student_id: student.id,
        date: dateStr,
        status: attendance[student.id] ? "Present" : "Absent",
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

  const handleToggle = (studentId: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const markAllPresent = () => {
    if (!students) return;
    const newAttendance: Record<string, boolean> = {};
    students.forEach((student) => {
      newAttendance[student.id] = true;
    });
    setAttendance(newAttendance);
  };

  const markAllAbsent = () => {
    if (!students) return;
    const newAttendance: Record<string, boolean> = {};
    students.forEach((student) => {
      newAttendance[student.id] = false;
    });
    setAttendance(newAttendance);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Take Attendance</h2>
        <p className="text-muted-foreground">Mark students as present or absent</p>
      </div>

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
                className={cn(
                  "w-full justify-start text-left font-normal md:w-[280px]",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
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
        </CardContent>
      </Card>

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
          {students && students.length > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={student.id}
                        checked={attendance[student.id] || false}
                        onCheckedChange={() => handleToggle(student.id)}
                      />
                      <Label
                        htmlFor={student.id}
                        className="cursor-pointer font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {student.name}
                      </Label>
                    </div>
                    <span className="text-sm text-muted-foreground">{student.grade}</span>
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full">
                Save Attendance
              </Button>
            </form>
          ) : (
            <p className="text-center text-muted-foreground">
              No students registered yet. Please register students first.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
