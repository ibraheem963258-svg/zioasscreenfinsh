import { useState, useEffect } from 'react';
import { 
  Monitor, 
  Plus, 
  Building2, 
  Layers, 
  Search, 
  Filter,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  ExternalLink,
  Wifi,
  WifiOff,
  Loader2
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  getScreens, 
  getBranches, 
  getScreenGroups, 
  createScreen, 
  createBranch, 
  createScreenGroup,
  deleteScreen,
  deleteBranch,
  deleteScreenGroup
} from '@/lib/api';
import { Screen, Branch, ScreenGroup } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function Screens() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddScreenOpen, setIsAddScreenOpen] = useState(false);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenSlug, setNewScreenSlug] = useState('');
  const [newScreenBranch, setNewScreenBranch] = useState('');
  const [newScreenOrientation, setNewScreenOrientation] = useState('landscape');
  const [newScreenResolution, setNewScreenResolution] = useState('1920x1080');
  
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');
  
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupBranch, setNewGroupBranch] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [screensData, branchesData, groupsData] = await Promise.all([
        getScreens(),
        getBranches(),
        getScreenGroups(),
      ]);
      setScreens(screensData);
      setBranches(branchesData);
      setGroups(groupsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في جلب البيانات',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || 'غير معروف';
  };

  const getGroupNames = (groupIds: string[]) => {
    return groupIds.map(id => groups.find(g => g.id === id)?.name).filter(Boolean);
  };

  const filteredScreens = screens.filter(screen => {
    const matchesSearch = screen.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = filterBranch === 'all' || screen.branchId === filterBranch;
    const matchesStatus = filterStatus === 'all' || screen.status === filterStatus;
    return matchesSearch && matchesBranch && matchesStatus;
  });

  const handlePreview = (screen: Screen) => {
    window.open(`/display/${screen.slug}`, '_blank');
  };

  const handleDeleteScreen = async (screenId: string) => {
    try {
      await deleteScreen(screenId);
      setScreens(prev => prev.filter(s => s.id !== screenId));
      toast({
        title: 'تم الحذف',
        description: 'تم حذف الشاشة بنجاح.',
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في حذف الشاشة.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateScreen = async () => {
    if (!newScreenName || !newScreenSlug || !newScreenBranch) {
      toast({
        title: 'خطأ',
        description: 'الرجاء ملء جميع الحقول المطلوبة.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newScreen = await createScreen(
        newScreenName,
        newScreenSlug,
        newScreenBranch,
        newScreenOrientation,
        newScreenResolution
      );
      setScreens(prev => [newScreen, ...prev]);
      setIsAddScreenOpen(false);
      resetScreenForm();
      toast({
        title: 'تم الإنشاء',
        description: 'تم إنشاء الشاشة بنجاح.',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء الشاشة.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName) {
      toast({
        title: 'خطأ',
        description: 'الرجاء إدخال اسم الفرع.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newBranch = await createBranch(newBranchName, newBranchLocation);
      setBranches(prev => [newBranch, ...prev]);
      setIsAddBranchOpen(false);
      setNewBranchName('');
      setNewBranchLocation('');
      toast({
        title: 'تم الإنشاء',
        description: 'تم إنشاء الفرع بنجاح.',
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في إنشاء الفرع.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName || !newGroupBranch) {
      toast({
        title: 'خطأ',
        description: 'الرجاء ملء جميع الحقول المطلوبة.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newGroup = await createScreenGroup(newGroupName, newGroupDescription, newGroupBranch);
      setGroups(prev => [newGroup, ...prev]);
      setIsAddGroupOpen(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupBranch('');
      toast({
        title: 'تم الإنشاء',
        description: 'تم إنشاء المجموعة بنجاح.',
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في إنشاء المجموعة.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetScreenForm = () => {
    setNewScreenName('');
    setNewScreenSlug('');
    setNewScreenBranch('');
    setNewScreenOrientation('landscape');
    setNewScreenResolution('1920x1080');
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-9 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">إدارة الشاشات</h1>
            <p className="text-muted-foreground mt-1">
              إدارة الشاشات والفروع والمجموعات
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Building2 className="h-4 w-4 mr-2" />
                  إضافة فرع
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة فرع جديد</DialogTitle>
                  <DialogDescription>
                    إنشاء موقع فرع جديد للشاشات.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>اسم الفرع</Label>
                    <Input 
                      placeholder="مثال: الفرع الرئيسي" 
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الموقع</Label>
                    <Input 
                      placeholder="مثال: شارع الملك فهد" 
                      value={newBranchLocation}
                      onChange={(e) => setNewBranchLocation(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateBranch} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  إنشاء الفرع
                </Button>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Layers className="h-4 w-4 mr-2" />
                  إضافة مجموعة
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة مجموعة جديدة</DialogTitle>
                  <DialogDescription>
                    إنشاء مجموعة شاشات لتنظيم العروض.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>اسم المجموعة</Label>
                    <Input 
                      placeholder="مثال: قوائم الطعام" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الوصف</Label>
                    <Input 
                      placeholder="مثال: شاشات عرض القوائم الرقمية" 
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الفرع</Label>
                    <Select value={newGroupBranch} onValueChange={setNewGroupBranch}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateGroup} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  إنشاء المجموعة
                </Button>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddScreenOpen} onOpenChange={setIsAddScreenOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  إضافة شاشة
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>إضافة شاشة جديدة</DialogTitle>
                  <DialogDescription>
                    تكوين شاشة عرض جديدة لشبكة اللافتات.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>اسم الشاشة</Label>
                    <Input 
                      placeholder="مثال: شاشة المدخل الرئيسي" 
                      value={newScreenName}
                      onChange={(e) => setNewScreenName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>معرّف الرابط (Slug)</Label>
                    <Input 
                      placeholder="مثال: main-entrance" 
                      value={newScreenSlug}
                      onChange={(e) => setNewScreenSlug(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الفرع</Label>
                      <Select value={newScreenBranch} onValueChange={setNewScreenBranch}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الفرع" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>الاتجاه</Label>
                      <Select value={newScreenOrientation} onValueChange={setNewScreenOrientation}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="landscape">أفقي</SelectItem>
                          <SelectItem value="portrait">عمودي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>الدقة</Label>
                    <Select value={newScreenResolution} onValueChange={setNewScreenResolution}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الدقة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                        <SelectItem value="1080x1920">1080x1920 (Portrait HD)</SelectItem>
                        <SelectItem value="3840x2160">3840x2160 (4K)</SelectItem>
                        <SelectItem value="2160x3840">2160x3840 (Portrait 4K)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateScreen} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  إنشاء الشاشة
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="screens" className="space-y-4">
          <TabsList>
            <TabsTrigger value="screens" className="gap-2">
              <Monitor className="h-4 w-4" />
              الشاشات ({screens.length})
            </TabsTrigger>
            <TabsTrigger value="branches" className="gap-2">
              <Building2 className="h-4 w-4" />
              الفروع ({branches.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Layers className="h-4 w-4" />
              المجموعات ({groups.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="screens" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في الشاشات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="w-[180px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="online">متصل</SelectItem>
                  <SelectItem value="offline">غير متصل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Screens Grid */}
            {filteredScreens.length === 0 ? (
              <div className="text-center py-12 stat-card">
                <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">لا توجد شاشات</h3>
                <p className="text-muted-foreground mt-1">
                  أنشئ أول شاشة للبدء.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredScreens.map((screen) => (
                  <div key={screen.id} className="stat-card group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          screen.status === 'online' ? 'bg-success/20' : 'bg-destructive/20'
                        )}>
                          <Monitor className={cn(
                            "h-5 w-5",
                            screen.status === 'online' ? 'text-success' : 'text-destructive'
                          )} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{screen.name}</h3>
                          <p className="text-sm text-muted-foreground">{getBranchName(screen.branchId)}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreview(screen)}>
                            <Eye className="h-4 w-4 mr-2" />
                            معاينة
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePreview(screen)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            فتح رابط العرض
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteScreen(screen.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {screen.status === 'online' ? (
                          <Wifi className="h-4 w-4 text-success" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-destructive" />
                        )}
                        <Badge variant={screen.status === 'online' ? 'default' : 'destructive'} className={cn(
                          screen.status === 'online' ? 'bg-success/20 text-success border-success/30' : ''
                        )}>
                          {screen.status === 'online' ? 'متصل' : 'غير متصل'}
                        </Badge>
                        <Badge variant="secondary">
                          {screen.orientation === 'landscape' ? 'أفقي' : 'عمودي'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {getGroupNames(screen.groupIds).map((name, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-border">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">الدقة</span>
                          <span className="text-foreground">{screen.resolution}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">آخر تحديث</span>
                          <span className="text-foreground">
                            {formatDistanceToNow(screen.lastUpdated, { addSuffix: true, locale: ar })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">رابط العرض</span>
                          <span className="text-primary text-xs" dir="ltr">/display/{screen.slug}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="branches" className="space-y-4">
            {branches.length === 0 ? (
              <div className="text-center py-12 stat-card">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">لا توجد فروع</h3>
                <p className="text-muted-foreground mt-1">
                  أنشئ أول فرع للبدء.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branches.map((branch) => {
                  const branchScreens = screens.filter(s => s.branchId === branch.id);
                  const branchGroups = groups.filter(g => g.branchId === branch.id);
                  const onlineCount = branchScreens.filter(s => s.status === 'online').length;
                  
                  return (
                    <div key={branch.id} className="stat-card">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{branch.name}</h3>
                            <p className="text-sm text-muted-foreground">{branch.location}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={async () => {
                              await deleteBranch(branch.id);
                              setBranches(prev => prev.filter(b => b.id !== branch.id));
                              toast({ title: 'تم الحذف', description: 'تم حذف الفرع بنجاح.' });
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{branchScreens.length}</p>
                          <p className="text-xs text-muted-foreground">شاشات</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-success">{onlineCount}</p>
                          <p className="text-xs text-muted-foreground">متصل</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{branchGroups.length}</p>
                          <p className="text-xs text-muted-foreground">مجموعات</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="space-y-4">
            {groups.length === 0 ? (
              <div className="text-center py-12 stat-card">
                <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">لا توجد مجموعات</h3>
                <p className="text-muted-foreground mt-1">
                  أنشئ أول مجموعة للبدء.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group) => {
                  const groupScreens = screens.filter(s => s.groupIds.includes(group.id));
                  
                  return (
                    <div key={group.id} className="stat-card">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                            <Layers className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{group.name}</h3>
                            <p className="text-sm text-muted-foreground">{group.description}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={async () => {
                              await deleteScreenGroup(group.id);
                              setGroups(prev => prev.filter(g => g.id !== group.id));
                              toast({ title: 'تم الحذف', description: 'تم حذف المجموعة بنجاح.' });
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="pt-3 border-t border-border">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">الفرع</span>
                          <Badge variant="secondary">{getBranchName(group.branchId)}</Badge>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-muted-foreground">الشاشات</span>
                          <span className="text-lg font-bold text-foreground">{groupScreens.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
