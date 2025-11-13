import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Edit } from 'recharts';

interface AttendanceStats {
  studentId: string;
  studentName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendancePercentage: number;
}

export default function AttendanceSummary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    status: 'Present',
    time_in: '',
    time_out: ''
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('attendance')
        .update(editFormData)
        .eq('id', editingRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['all-time-attendance'] });
      toast.success('Attendance record updated successfully');
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update attendance record');
    }
  });

  // Fetch all students
  const { data: students = [] } = useQuery({
    queryKey: ['students', user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('id, name, grade')
        .order('name');
      
      // Filter by center_id if user is not admin
      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance records
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance-summary', selectedMonth.toISOString().slice(0, 7), user?.center_id],
    queryFn: async () => {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      let query = supabase
        .from('attendance')
        .select('*, students(name, grade)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      } else {
        // For admin, if no center is selected, this could fetch all.
        // If you have a center filter for admin, you would apply it here.
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id || user?.role === "admin",
  });

  // Calculate statistics
  const calculateStats = (): AttendanceStats[] => {
    const statsMap = new Map<string, AttendanceStats>();

    attendanceData.forEach((record: any) => {
      const key = record.student_id;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          studentId: key,
          studentName: record.students?.name || 'Unknown',
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          attendancePercentage: 0,
        });
      }

      const stats = statsMap.get(key)!;
      stats.totalDays += 1;
      if (record.status === 'Present') {
        stats.presentDays += 1;
      } else {
        stats.absentDays += 1;
      }
    });

    // Calculate percentage
    statsMap.forEach((stats) => {
      stats.attendancePercentage = stats.totalDays > 0 
        ? Math.round((stats.presentDays / stats.totalDays) * 100)
        : 0;
    });

    return Array.from(statsMap.values());
  };

  // Get monthly calendar data
  const getMonthlyCalendarData = () => {
    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    const selectedStudentId = selectedStudent === 'all' ? null : selectedStudent;
    const stats = calculateStats();
    const filteredStats = selectedStudentId 
      ? stats.filter(s => s.studentId === selectedStudentId)
      : stats;

    return {
      daysInMonth,
      stats: filteredStats,
    };
  };

  // Get overall statistics across all months
  const { data: allTimeAttendance = [] } = useQuery({
    queryKey: ['all-time-attendance', user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from('attendance')
        .select('*, students(name, grade)')
        .order('date');

      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id || user?.role === "admin",
  });

  const calculateAllTimeStats = (): AttendanceStats[] => {
    const statsMap = new Map<string, AttendanceStats>();

    allTimeAttendance.forEach((record: any) => {
      const key = record.student_id;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          studentId: key,
          studentName: record.students?.name || 'Unknown',
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          attendancePercentage: 0,
        });
      }

      const stats = statsMap.get(key)!;
      stats.totalDays += 1;
      if (record.status === 'Present') {
        stats.presentDays += 1;
      } else {
        stats.absentDays += 1;
      }
    });

    statsMap.forEach((stats) => {
      stats.attendancePercentage = stats.totalDays > 0 
        ? Math.round((stats.presentDays / stats.totalDays) * 100)
        : 0;
    });

    return Array.from(statsMap.values());
  };

  const { daysInMonth, stats } = getMonthlyCalendarData();
  const allTimeStats = calculateAllTimeStats();

  const getAttendanceStatus = (date: string, studentId: string): 'present' | 'absent' | 'none' => {
    const record = attendanceData.find(
      (a: any) => format(new Date(a.date), 'yyyy-MM-dd') === date && a.student_id === studentId
    );
    if (!record) return 'none';
    return record.status === 'Present' ? 'present' : 'absent';
  };

  const colors = {
    present: '#22c55e',
    absent: '#ef4444',
    none: '#e5e7eb',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Attendance Summary</h2>
        <p className="text-muted-foreground">View attendance history and statistics</p>
      </div>

      {/* Month and Student Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label>Month</Label>
            <input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-');
                setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1));
              }}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex-1">
            <Label>Student</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
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
        </CardContent>
      </Card>

      {/* Monthly History Calendar */}
      {selectedStudent !== 'all' && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly History - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {daysInMonth.map((date) => {
                const status = getAttendanceStatus(format(date, 'yyyy-MM-dd'), selectedStudent);
                return (
                  <div
                    key={format(date, 'yyyy-MM-dd')}
                    className="aspect-square rounded-lg flex items-center justify-center text-sm font-medium"
                    style={{
                      backgroundColor:
                        status === 'present'
                          ? colors.present
                          : status === 'absent'
                          ? colors.absent
                          : colors.none,
                      color: status !== 'none' ? 'white' : 'inherit',
                    }}
                    title={`${format(date, 'MMM d')} - ${status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : 'No record'}`}
                  >
                    {format(date, 'd')}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Statistics */}
      {stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Statistics - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {stats.map((stat) => (
                <div key={stat.studentId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{stat.studentName}</h3>
                      <p className="text-sm text-muted-foreground">Attendance Rate: {stat.attendancePercentage}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{stat.presentDays}</p>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{stat.totalDays}</p>
                      <p className="text-xs text-muted-foreground">Total Days</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{stat.presentDays}</p>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{stat.absentDays}</p>
                      <p className="text-xs text-muted-foreground">Absent</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 transition-all duration-300"
                      style={{ width: `${stat.attendancePercentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-4">Student Name</th>
                  <th className="text-right py-2 px-4">Date</th>
                  <th className="text-right py-2 px-4">Status</th>
                  <th className="text-right py-2 px-4">Time In</th>
                  <th className="text-right py-2 px-4">Time Out</th>
                  <th className="text-right py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allTimeAttendance.map((record: any) => (
                  <tr key={record.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{record.students?.name}</td>
                    <td className="text-right py-3 px-4">{format(new Date(record.date), "PPP")}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-semibold ${
                        record.status === 'Present' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">{record.time_in || '-'}</td>
                    <td className="text-right py-3 px-4">{record.time_out || '-'}</td>
                    <td className="text-right py-3 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingRecord(record);
                          setEditFormData({
                            status: record.status,
                            time_in: record.time_in || '',
                            time_out: record.time_out || ''
                          });
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Update the attendance record for {editingRecord?.students?.name} on {editingRecord ? format(new Date(editingRecord.date), "PPP") : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Time In</Label>
                <Input
                  type="time"
                  value={editFormData.time_in}
                  onChange={(e) => setEditFormData({ ...editFormData, time_in: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time Out</Label>
                <Input
                  type="time"
                  value={editFormData.time_out}
                  onChange={(e) => setEditFormData({ ...editFormData, time_out: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={() => updateAttendanceMutation.mutate()} disabled={updateAttendanceMutation.isPending} className="w-full">
              {updateAttendanceMutation.isPending ? 'Updating...' : 'Update Record'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
