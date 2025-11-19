import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon, Download, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: string;
  students: {
    name: string;
    grade: string;
  };
}

export default function ViewRecords() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [gradeFilter, setGradeFilter] = useState<string>("all"); // Grade filter
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Fetch students for this center
  const { data: students = [] } = useQuery({
    queryKey: ['students', user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('id, name, grade')
        .order('name');

      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredStudents = students.filter(s => gradeFilter === "all" || s.grade === gradeFilter);

  // Fetch attendance records for selected date & filtered students
  const { data: records, isLoading } = useQuery({
    queryKey: ["attendance-records", dateStr, gradeFilter, user?.center_id],
    queryFn: async () => {
      const studentIds = filteredStudents.map(s => s.id);
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          student_id,
          status,
          students (
            name,
            grade
          )
        `)
        .in("student_id", studentIds)
        .eq("date", dateStr)
        .order("students(name)");
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: filteredStudents.length > 0,
  });

  const presentCount = records?.filter(r => r.status === "Present").length || 0;
  const absentCount = records?.filter(r => r.status === "Absent").length || 0;

  const exportToCSV = () => {
    if (!records || records.length === 0) return;

    const headers = ["Name", "Grade", "Status"];
    const rows = records.map(r => [r.students.name, r.students.grade, r.status]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${dateStr}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Attendance Records</h2>
          <p className="text-muted-foreground">View past attendance records</p>
        </div>
      </div>

      {/* Filters Row */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          {/* Grade Filter */}
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {Array.from(new Set(students.map(s => s.grade))).map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full md:w-[220px] justify-start text-left font-normal",
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
                onSelect={date => date && setSelectedDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Export / Print */}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attendance for {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
              <CardDescription>
                {presentCount} Present • {absentCount} Absent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading records...</p>
          ) : records && records.length > 0 ? (
            <div className="overflow-x-auto max-h-96 border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.students.name}</TableCell>
                      <TableCell>{r.students.grade}</TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "Present" ? "default" : "destructive"}
                          className={r.status === "Present" ? "bg-secondary hover:bg-secondary/80" : ""}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              No attendance records found for this date
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
