import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function FeeManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any>(null);
  const [formData, setFormData] = useState({
    student_id: "",
    amount: "",
    month: format(new Date(), "yyyy-MM"),
    due_date: "",
    status: "Unpaid",
    remarks: "",
  });

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*")
        .order("name");

      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch fees
  const { data: fees = [], isLoading } = useQuery({
    queryKey: ["fees", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("fees")
        .select("*, students(name, grade)")
        .order("month", { ascending: false });

      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Create or update fee mutation
  const saveFeeMutation = useMutation({
    mutationFn: async (feeData: any) => {
      if (editingFee) {
        const { error } = await supabase
          .from("fees")
          .update(feeData)
          .eq("id", editingFee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fees").insert({
          ...feeData,
          center_id: user?.center_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success(`Fee record ${editingFee ? "updated" : "created"} successfully`);
      setIsDialogOpen(false);
      setEditingFee(null);
    },
    onError: (error: any) => {
      toast.error(error.message || `Failed to ${editingFee ? "update" : "create"} fee record`);
    },
  });

  // Delete fee mutation
  const deleteFeeMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("fees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success("Fee record deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete fee record");
    },
  });

  const handleOpenDialog = (fee = null) => {
    setEditingFee(fee);
    if (fee) {
      setFormData({
        student_id: fee.student_id,
        amount: fee.amount,
        month: format(new Date(fee.month), "yyyy-MM"),
        due_date: format(new Date(fee.due_date), "yyyy-MM-dd"),
        status: fee.status,
        remarks: fee.remarks || "",
      });
    } else {
      setFormData({
        student_id: "",
        amount: "",
        month: format(new Date(), "yyyy-MM"),
        due_date: "",
        status: "Unpaid",
        remarks: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    saveFeeMutation.mutate({
      ...formData,
      month: `${formData.month}-01`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Fee Management</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Fee Record
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFee ? "Edit" : "Add"} Fee Record</DialogTitle>
            <DialogDescription>
              Fill in the details to {editingFee ? "update" : "add"} a fee record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select
                value={formData.student_id}
                onValueChange={(value) => setFormData({ ...formData, student_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g., 1000"
                />
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Input
                  type="month"
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="e.g., Late fee"
              />
            </div>
            <Button onClick={handleSubmit} disabled={saveFeeMutation.isPending} className="w-full">
              {saveFeeMutation.isPending ? "Saving..." : "Save Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Fee Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading fees...</p>
          ) : fees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No fee records found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">{fee.students?.name}</TableCell>
                    <TableCell>{fee.amount}</TableCell>
                    <TableCell>{format(new Date(fee.month), "MMMM yyyy")}</TableCell>
                    <TableCell>{format(new Date(fee.due_date), "PPP")}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          fee.status === "Paid"
                            ? "bg-green-100 text-green-800"
                            : fee.status === "Unpaid"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {fee.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(fee)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
