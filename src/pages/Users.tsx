/**
 * ======================================
 * صفحة إدارة المستخدمين (Admin فقط)
 * User Management Page (Admin Only)
 * ======================================
 * 
 * الوظيفة: إنشاء وإدارة حسابات المستخدمين
 * الصلاحيات: Admin فقط
 */

import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { UserPlus, Trash2, Shield, User, Loader2, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// ======================================
// واجهة بيانات المستخدم
// User Data Interface
// ======================================
interface UserWithRole {
  id: string;
  email: string;
  fullName: string | null;
  role: 'admin' | 'user';
  createdAt: Date;
}

export default function Users() {
  // ======================================
  // الحالات
  // States
  // ======================================
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // حالات نموذج إنشاء مستخدم جديد
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [isCreating, setIsCreating] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  // ======================================
  // التحقق من صلاحيات Admin
  // Check Admin Permissions
  // ======================================
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .rpc('is_admin', { _user_id: user.id });

      if (!error && data) {
        setIsAdmin(true);
        fetchUsers();
      } else {
        setIsAdmin(false);
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  // ======================================
  // جلب قائمة المستخدمين
  // Fetch Users List
  // ======================================
  const fetchUsers = async () => {
    try {
      // جلب البروفايلات مع الأدوار
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // جلب الأدوار
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // دمج البيانات
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: profile.email || '',
          fullName: profile.full_name,
          role: (userRole?.role as 'admin' | 'user') || 'user',
          createdAt: new Date(profile.created_at),
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('فشل جلب المستخدمين:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في جلب قائمة المستخدمين',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ======================================
  // إنشاء مستخدم جديد
  // Create New User
  // ======================================
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // إنشاء المستخدم عبر Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: {
            full_name: newFullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('فشل إنشاء المستخدم');

      // إضافة الدور
      if (newRole === 'admin') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: 'admin',
          });

        if (roleError) {
          console.error('فشل إضافة دور Admin:', roleError);
        }
      }

      toast({
        title: 'تم بنجاح',
        description: `تم إنشاء حساب ${newEmail}`,
      });

      // إعادة تعيين النموذج
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('user');
      setIsCreateDialogOpen(false);
      
      // تحديث القائمة
      fetchUsers();
    } catch (error: any) {
      console.error('فشل إنشاء المستخدم:', error);
      toast({
        title: 'فشل الإنشاء',
        description: error.message || 'حدث خطأ أثناء إنشاء المستخدم',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // ======================================
  // تغيير دور المستخدم
  // Change User Role
  // ======================================
  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      if (newRole === 'admin') {
        // إضافة دور admin
        const { error } = await supabase
          .from('user_roles')
          .upsert({
            user_id: userId,
            role: 'admin',
          });
        if (error) throw error;
      } else {
        // إزالة دور admin
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (error) throw error;
      }

      toast({
        title: 'تم التحديث',
        description: 'تم تغيير صلاحيات المستخدم',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل في تغيير صلاحيات المستخدم',
        variant: 'destructive',
      });
    }
  };

  // ======================================
  // فلترة المستخدمين
  // Filter Users
  // ======================================
  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ======================================
  // التحقق من تسجيل الدخول
  // Check Authentication
  // ======================================
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ======================================
  // عرض رسالة عدم الصلاحية
  // Show Unauthorized Message
  // ======================================
  if (!isLoading && !isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">غير مصرح</h1>
          <p className="text-muted-foreground">
            ليس لديك صلاحية للوصول إلى هذه الصفحة
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // ======================================
  // العرض الرئيسي
  // Main Render
  // ======================================
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
            <p className="text-muted-foreground">
              إنشاء وإدارة حسابات المستخدمين
            </p>
          </div>
          
          {/* زر إنشاء مستخدم جديد */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                مستخدم جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
                <DialogDescription>
                  أدخل بيانات المستخدم الجديد
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">الاسم الكامل</Label>
                  <Input
                    id="fullName"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="أدخل الاسم الكامل"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">الصلاحية</Label>
                  <Select value={newRole} onValueChange={(v: 'admin' | 'user') => setNewRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">مستخدم عادي</SelectItem>
                      <SelectItem value="admin">مدير (Admin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        جاري الإنشاء...
                      </>
                    ) : (
                      'إنشاء المستخدم'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* البحث */}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث عن مستخدم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* جدول المستخدمين */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الصلاحية</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      لا يوجد مستخدمين
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {u.role === 'admin' ? (
                              <Shield className="h-4 w-4 text-primary" />
                            ) : (
                              <User className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="font-medium">{u.fullName || 'بدون اسم'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role === 'admin' ? 'مدير' : 'مستخدم'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.createdAt.toLocaleDateString('ar-SA')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={u.role}
                          onValueChange={(v: 'admin' | 'user') => handleRoleChange(u.id, v)}
                          disabled={u.id === user?.id}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">مستخدم</SelectItem>
                            <SelectItem value="admin">مدير</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
