import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface StudentFee {
  id: string;
  student_id: string;
  month: string;
  amount: number;
  due_date: number;
  payment_status: "Paid" | "Unpaid";
  paid_date: string | null;
  remarks: string | null;
  student?: { name: string; grade: string };
}

export default function FeeManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [editingFee, setEditingFee] = useState<StudentFee | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    dueDate: "1",
    paymentStatus: "Unpaid",
    remarks: "",
  });

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("id, name, grade").order("name");

      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch fees for selected student and month
  const { data: fees = [] } = useQuery({
    queryKey: ["student-fees", selectedStudentId, selectedMonth, user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("student_fees")
        .select("*, students(name, grade)")
        .eq("month", selectedMonth);

      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }

      if (selectedStudentId) {
        query = query.eq("student_id", selectedStudentId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as StudentFee[];
    },
  });

  // Create/Update fee mutation
  const saveFeeeMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        amount: parseFloat(formData.amount),
        due_date: parseInt(formData.dueDate),
        payment_status: formData.paymentStatus,
        remarks: formData.remarks || null,
        paid_date: formData.paymentStatus === "Paid" ? new Date().toISOString() : null,
        student_id: selectedStudentId,
        center_id: user?.center_id,
        month: selectedMonth,
      };

      if (editingFee) {
        const { error } = await supabase
          .from("student_fees")
          .update(payload)
          .eq("id", editingFee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("student_fees").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      toast.success(editingFee ? "Fee updated successfully" : "Fee created successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save fee");
    },
  });

  // Delete fee mutation
  const deleteFeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student_fees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      toast.success("Fee deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete fee");
    },
  });

  const resetForm = () => {
    setEditingFee(null);
    setFormData({
      amount: "",
      dueDate: "1",
      paymentStatus: "Unpaid",
      remarks: "",
    });
    setIsDialogOpen(false);
  };

  const handleEdit = (fee: StudentFee) => {
    setEditingFee(fee);
    setFormData({
      amount: fee.amount.toString(),
      dueDate: fee.due_date.toString(),
      paymentStatus: fee.payment_status,
      remarks: fee.remarks || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedStudentId || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }
    saveFeeeMutation.mutate();
  };

  // Calculate fee statistics
  const paidCount = fees.filter((f) => f.payment_status === "Paid").length;
  const unpaidCount = fees.filter((f) => f.payment_status === "Unpaid").length;
  const totalAmount = fees.reduce((sum, f) => sum + f.amount, 0);
  const paidAmount = fees
    .filter((f) => f.payment_status === "Paid")
    .reduce((sum, f) => sum + f.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Fee Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Fee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingFee ? "Edit Fee" : "Add New Fee"}</DialogTitle>
              <DialogDescription>
                {editingFee
                  ? "Update the fee details"
                  : "Create a new monthly fee entry for a student"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="student">Student *</Label>
                <Select
                  value={selectedStudentId}
                  onValueChange={setSelectedStudentId}
                  disabled={!!editingFee}
                >
                  <SelectTrigger id="student">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} (Grade {student.grade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="month">Month *</Label>
                <Input
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={!!editingFee}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (Day of Month) *</Label>
                <Select value={formData.dueDate} onValueChange={(val) => setFormData({ ...formData, dueDate: val })}>
                  <SelectTrigger id="dueDate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Payment Status *</Label>
                <Select
                  value={formData.paymentStatus}
                  onValueChange={(val) => setFormData({ ...formData, paymentStatus: val })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks (Optional)</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>

              <Button onClick={handleSave} className="w-full" disabled={saveFeeeMutation.isPending}>
                {saveFeeeMutation.isPending ? "Saving..." : editingFee ? "Update Fee" : "Create Fee"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & View</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="filter-student">Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger id="filter-student">
                  <SelectValue placeholder="All students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All students</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-month">Month</Label>
              <Input
                id="filter-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {fees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fee Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Fees</p>
                <p className="text-2xl font-bold">₹{totalAmount.toFixed(2)}</p>
              </div>
              <div className="space-y-1 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">Paid Amount</p>
                <p className="text-2xl font-bold text-green-600">₹{paidAmount.toFixed(2)}</p>
              </div>
              <div className="space-y-1 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-green-600">{paidCount}</p>
              </div>
              <div className="space-y-1 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">⚠️ {unpaidCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fee Records</CardTitle>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No fee records found for the selected filters
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium">{fee.student?.name || "-"}</TableCell>
                      <TableCell>{fee.student?.grade || "-"}</TableCell>
                      <TableCell>{format(new Date(fee.month + "-01"), "MMM yyyy")}</TableCell>
                      <TableCell className="font-semibold">₹{fee.amount.toFixed(2)}</TableCell>
                      <TableCell>{fee.due_date}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {fee.payment_status === "Paid" ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">✅ Paid</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-yellow-600" />
                              <span className="text-yellow-600 font-medium">⚠️ Pending</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fee.remarks || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(fee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteFeeMutation.mutate(fee.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
