import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Calendar, BookOpen, FileText, LogOut } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useState, useEffect } from 'react';

interface AttendanceNote {
  note: string;
}

const ParentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user || user.role !== 'parent' || !user.student_id) {
    navigate('/login-parent');
    return null;
  }

  // Fetch student
  const { data: student } = useQuery({
    queryKey: ['student', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return null;
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', user.student_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.student_id)
        .order('date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Test results
  const { data: testResults = [] } = useQuery({
    queryKey: ['test-results', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('test_results')
        .select('*, tests(*)')
        .eq('student_id', user.student_id)
        .order('date_taken', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Chapters studied
  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters-studied', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('student_chapters')
        .select('*, chapters(*)')
        .eq('student_id', user.student_id)
        .order('date_completed', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalDays = attendance.length;
  const presentDays = attendance.filter((a: any) => a.status === 'Present').length;
  const absentDays = totalDays - presentDays;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const handleLogout = () => {
    logout();
    navigate('/login-parent');
  };

  // Calendar notes in localStorage
  const localStorageKey = `parentAttendanceNotes-${user.student_id}`;
  const [calendarNotes, setCalendarNotes] = useState<Record<string, AttendanceNote>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const stored = localStorage.getItem(localStorageKey);
    if (stored) setCalendarNotes(JSON.parse(stored));
  }, [localStorageKey]);

  const saveNote = (date: string, note: string) => {
    const updated = { ...calendarNotes, [date]: { note } };
    setCalendarNotes(updated);
    localStorage.setItem(localStorageKey, JSON.stringify(updated));
  };

  // Full mini calendar: all days of current month
  const daysOfMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const attendanceMap: Record<string, 'Present' | 'Absent'> = {};
  attendance.forEach(a => {
    attendanceMap[a.date] = a.status;
  });

  // Filters: get unique subjects from testResults and chapters
  const testSubjects = Array.from(new Set(testResults.map(t => t.tests?.subject).filter(Boolean)));
  const chapterSubjects = Array.from(new Set(chapters.map(c => c.chapters?.subject).filter(Boolean)));

  const [chapterSubjectFilter, setChapterSubjectFilter] = useState('');
  const [chapterMonthFilter, setChapterMonthFilter] = useState('');
  const [testSubjectFilter, setTestSubjectFilter] = useState('');
  const [testMonthFilter, setTestMonthFilter] = useState('');

  const filteredChapters = chapters.filter(c => {
    const subjectMatch = !chapterSubjectFilter || c.chapters?.subject === chapterSubjectFilter;
    const monthMatch = !chapterMonthFilter || (c.date_completed && format(parseISO(c.date_completed), 'yyyy-MM') === chapterMonthFilter);
    return subjectMatch && monthMatch;
  });

  const filteredTests = testResults.filter(t => {
    const subjectMatch = !testSubjectFilter || t.tests?.subject === testSubjectFilter;
    const monthMatch = !testMonthFilter || (t.date_taken && format(parseISO(t.date_taken), 'yyyy-MM') === testMonthFilter);
    return subjectMatch && monthMatch;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Parent Dashboard</h1>
              <p className="text-muted-foreground">Welcome, {user.username}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* STUDENT INFO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold">{student.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grade</p>
                  <p className="font-semibold">{student.grade}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">School</p>
                  <p className="font-semibold">{student.school_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-semibold">{student.contact_number}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No student data available</p>
            )}
          </CardContent>
        </Card>

        {/* ATTENDANCE SUMMARY */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{totalDays}</p>
                <p className="text-sm text-muted-foreground">Total Days</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{presentDays}</p>
                <p className="text-sm text-muted-foreground">Present</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{absentDays}</p>
                <p className="text-sm text-muted-foreground">Absent</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{attendancePercentage}%</p>
                <p className="text-sm text-muted-foreground">Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MINI FULL CALENDAR */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Attendance Calendar
            </CardTitle>
            <div className="flex gap-2 items-center">
              <Button size="sm" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                Prev
              </Button>
              <Button size="sm" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                Next
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-7 gap-1 text-xs">
            {daysOfMonth.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const status = attendanceMap[dateStr];
              return (
                <div
                  key={dateStr}
                  className={`p-1 rounded text-center cursor-pointer text-white ${
                    status === 'Present'
                      ? 'bg-green-700'
                      : status === 'Absent'
                      ? 'bg-red-700'
                      : 'bg-gray-300 text-black'
                  }`}
                  title={calendarNotes[dateStr]?.note || ''}
                  onClick={() => {
                    const note = prompt('Add note:', calendarNotes[dateStr]?.note || '') || '';
                    saveNote(dateStr, note);
                  }}
                >
                  {format(date, 'd')}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* TEST RESULTS */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Test Results
            </CardTitle>
            <div className="flex gap-2 items-center">
              <select
                value={testSubjectFilter}
                onChange={(e) => setTestSubjectFilter(e.target.value)}
                className="border p-1 rounded text-sm"
              >
                <option value="">All Subjects</option>
                {testSubjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="month"
                value={testMonthFilter}
                onChange={(e) => setTestMonthFilter(e.target.value)}
                className="border p-1 rounded text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredTests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No test results available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests.map((result: any) => {
                    const percentage = result.tests?.total_marks
                      ? Math.round((result.marks_obtained / result.tests.total_marks) * 100)
                      : 0;
                    return (
                      <TableRow key={result.id}>
                        <TableCell>{result.tests?.name || '-'}</TableCell>
                        <TableCell>{result.tests?.subject || '-'}</TableCell>
                        <TableCell>{new Date(result.date_taken).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {result.marks_obtained}/{result.tests?.total_marks || 0}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold ${
                              percentage >= 75
                                ? 'text-green-600'
                                : percentage >= 50
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {percentage}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* CHAPTERS STUDIED */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Chapters Studied
            </CardTitle>
            <div className="flex gap-2 items-center">
              <select
                value={chapterSubjectFilter}
                onChange={(e) => setChapterSubjectFilter(e.target.value)}
                className="border p-1 rounded text-sm"
              >
                <option value="">All Subjects</option>
                {chapterSubjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="month"
                value={chapterMonthFilter}
                onChange={(e) => setChapterMonthFilter(e.target.value)}
                className="border p-1 rounded text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredChapters.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No chapters recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Chapter Name</TableHead>
                    <TableHead>Date Completed</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChapters.map((chapter: any) => (
                    <TableRow key={chapter.id}>
                      <TableCell>{chapter.chapters?.subject || '-'}</TableCell>
                      <TableCell>{chapter.chapters?.chapter_name || '-'}</TableCell>
                      <TableCell>
                        {chapter.date_completed
                          ? new Date(chapter.date_completed).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>{chapter.chapters?.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParentDashboard;
