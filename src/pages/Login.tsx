/**
 * ======================================
 * صفحة تسجيل الدخول
 * Login Page
 * ======================================
 */

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Tv2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const { login, signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = await signup(email, password, fullName);
        if (result.success) {
          toast({
            title: 'تم إنشاء الحساب!',
            description: 'تم تسجيلك بنجاح.',
          });
          navigate('/dashboard');
        } else {
          toast({
            title: 'فشل التسجيل',
            description: result.error || 'حدث خطأ أثناء التسجيل.',
            variant: 'destructive',
          });
        }
      } else {
        const result = await login(email, password);
        if (result.success) {
          toast({
            title: 'مرحباً!',
            description: 'تم تسجيل الدخول بنجاح.',
          });
          navigate('/dashboard');
        } else {
          toast({
            title: 'فشل تسجيل الدخول',
            description: result.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-background to-background items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="flex justify-center mb-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Tv2 className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold gradient-text mb-4">SignageHub</h1>
          <p className="text-lg text-muted-foreground mb-8">
            نظام إدارة اللافتات الرقمية الاحترافي للشركات الحديثة.
            تحكم في شاشاتك ومحتواك وجداولك من منصة واحدة قوية.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-card/50 border border-border">
              <p className="text-2xl font-bold text-primary">70+</p>
              <p className="text-sm text-muted-foreground">شاشة</p>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border">
              <p className="text-2xl font-bold text-success">99.9%</p>
              <p className="text-sm text-muted-foreground">وقت التشغيل</p>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border">
              <p className="text-2xl font-bold text-warning">24/7</p>
              <p className="text-sm text-muted-foreground">دعم</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login/Signup form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
                <Tv2 className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold gradient-text">SignageHub</h1>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-foreground">
                {isSignUp ? 'إنشاء حساب جديد' : 'مرحباً بعودتك'}
              </h2>
              <p className="text-muted-foreground">
                {isSignUp ? 'أدخل بياناتك لإنشاء حساب' : 'سجل دخولك للمتابعة'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">الاسم الكامل</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="يوسف طرادة"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="yousef@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isSignUp ? 'جاري التسجيل...' : 'جاري تسجيل الدخول...'}
                  </>
                ) : (
                  isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول'
                )}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-primary hover:underline"
              >
                {isSignUp ? 'لديك حساب؟ سجل دخولك' : 'ليس لديك حساب؟ أنشئ حساب جديد'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
