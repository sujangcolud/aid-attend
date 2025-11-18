import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Shield, Power, PowerOff, Edit, UserPlus } from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);

  const [editingCenter, setEditingCenter] = useState<any>(null);
  const [selectedCenter, setSelectedCenter] = useState<any>(null);

  const [editedCenterData, setEditedCenterData] = useState({
    centerName: '',
    address: ''
  });

  const [newCenter, setNewCenter] = useState({
    centerName: '',
    address: '',
    contactNumber: '',
    username: '',
    password: ''
  });

  const [newUser, setNewUser] = useState({
    username: '',
    password: ''
  });

  // Redirect if not admin
  if (user?.role !== 'admin') {
    navigate('/');
    return null;
  }

  // Fetch all centers with users
  const { data: centers = [], isLoading } = useQuery({
    queryKey: ['centers-with-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('centers')
        .select('*, users(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // ---------------- CREATE CENTER ----------------
  const createCenterMutation = useMutation({
    mutationFn: async () => {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('admin-create-center', {
        body: newCenter
      });

      if (functionError) throw functionError;
      if (!functionData.success) throw new Error(functionData.error);
      return functionData;
    },
    onSuccess: () => {
      toast({ title: 'Center created', description: 'New center has been created successfully' });
      setIsCreateDialogOpen(false);
      setNewCenter({ centerName: '', address: '', contactNumber: '', username: '', password: '' });
      queryClient.invalidateQueries({ queryKey: ['centers-with-users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create center', description: error.message, variant: 'destructive' });
    }
  });

  const handleCreateCenter = () => {
    if (!newCenter.centerName || !newCenter.username || !newCenter.password) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createCenterMutation.mutate();
  };

  // ---------------- EDIT CENTER ----------------
  const updateCenterMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('centers')
        .update({ center_name: editedCenterData.centerName, address: editedCenterData.address })
        .eq('id', editingCenter.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Center updated', description: 'Center details updated successfully' });
      setIsEditDialogOpen(false);
      setEditingCenter(null);
      queryClient.invalidateQueries({ queryKey: ['centers-with-users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update center', description: error.message, variant: 'destructive' });
    }
  });

  const handleOpenEditDialog = (center: any) => {
    setEditingCenter(center);
    setEditedCenterData({ centerName: center.center_name, address: center.address || '' });
    setIsEditDialogOpen(true);
  };

  const handleUpdateCenter = () => {
    if (!editedCenterData.centerName) {
      toast({ title: 'Missing fields', description: 'Center name is required', variant: 'destructive' });
      return;
    }
    updateCenterMutation.mutate();
  };

  // ---------------- ADD USER ----------------
  const addUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('users').insert([
        {
          username: newUser.username,
          password: newUser.password, // Ideally hashed in backend
          center_id: selectedCenter.id
        }
      ]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'User added', description: 'New user has been added to the center' });
      setIsAddUserDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['centers-with-users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add user', description: error.message, variant: 'destructive' });
    }
  });

  const handleOpenAddUserDialog = (center: any) => {
    setSelectedCenter(center);
    setNewUser({ username: '', password: '' });
    setIsAddUserDialogOpen(true);
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.password) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    addUserMutation.mutate();
  };

  // ---------------- TOGGLE USER STATUS ----------------
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase.from('users').update({ is_active: !isActive }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Status updated', description: 'User status has been updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['centers-with-users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    }
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-destructive" />
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>

          {/* CREATE CENTER DIALOG */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Create Center
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Center</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="centerName">Center Name *</Label>
                  <Input id="centerName" value={newCenter.centerName} onChange={(e) => setNewCenter({ ...newCenter, centerName: e.target.value })} placeholder="Enter center name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={newCenter.address} onChange={(e) => setNewCenter({ ...newCenter, address: e.target.value })} placeholder="Enter address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input id="contactNumber" value={newCenter.contactNumber} onChange={(e) => setNewCenter({ ...newCenter, contactNumber: e.target.value })} placeholder="Enter contact number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input id="username" value={newCenter.username} onChange={(e) => setNewCenter({ ...newCenter, username: e.target.value })} placeholder="Enter username for login" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input id="password" type="password" value={newCenter.password} onChange={(e) => setNewCenter({ ...newCenter, password: e.target.value })} placeholder="Enter password" />
                </div>
                <Button onClick={handleCreateCenter} className="w-full">{createCenterMutation.isPending ? 'Creating...' : 'Create Center'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* EDIT CENTER DIALOG */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Center</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editCenterName">Center Name *</Label>
                <Input id="editCenterName" value={editedCenterData.centerName} onChange={(e) => setEditedCenterData({ ...editedCenterData, centerName: e.target.value })} placeholder="Enter center name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editAddress">Address</Label>
                <Input id="editAddress" value={editedCenterData.address} onChange={(e) => setEditedCenterData({ ...editedCenterData, address: e.target.value })} placeholder="Enter address" />
              </div>
              <Button onClick={handleUpdateCenter} className="w-full">{updateCenterMutation.isPending ? 'Updating...' : 'Update Center'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ADD USER DIALOG */}
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User to {selectedCenter?.center_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input id="username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="Enter username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input id="password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Enter password" />
              </div>
              <Button onClick={handleAddUser} className="w-full">{addUserMutation.isPending ? 'Adding...' : 'Add User'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CENTERS TABLE */}
        <Card>
          <CardHeader>
            <CardTitle>All Centers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading centers...</p>
            ) : centers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No centers registered yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Center Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centers.map((center: any) => (
                    <TableRow key={center.id}>
                      <TableCell className="font-medium">{center.center_name}</TableCell>
                      <TableCell>{center.address || '-'}</TableCell>
                      <TableCell>{center.contact_number || '-'}</TableCell>
                      <TableCell>
                        {center.users && center.users.length > 0 ? (
                          <ul className="space-y-1">
                            {center.users.map((u: any) => (
                              <li key={u.id} className="flex items-center justify-between">
                                <span>{u.username} ({u.is_active ? 'Active' : 'Inactive'})</span>
                                <Button variant="ghost" size="xs" onClick={() => toggleStatusMutation.mutate({ userId: u.id, isActive: u.is_active })}>
                                  {u.is_active ? <><PowerOff className="h-3 w-3 mr-1" /> Deactivate</> : <><Power className="h-3 w-3 mr-1" /> Activate</>}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(center)}><Edit className="h-4 w-4 mr-1" /> Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenAddUserDialog(center)}><UserPlus className="h-4 w-4 mr-1" /> Add User</Button>
                      </TableCell>
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

export default AdminDashboard;
