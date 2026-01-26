-- ======================================
-- إضافة حقول البث المباشر للشاشات
-- Adding live stream fields to screens table
-- ======================================

-- حقل رابط البث المباشر
ALTER TABLE public.screens 
ADD COLUMN IF NOT EXISTS live_stream_url TEXT DEFAULT NULL;

-- حقل تفعيل البث المباشر
ALTER TABLE public.screens 
ADD COLUMN IF NOT EXISTS live_stream_enabled BOOLEAN DEFAULT FALSE;

-- تعليقات توضيحية على الأعمدة
COMMENT ON COLUMN public.screens.live_stream_url IS 'رابط البث المباشر HLS/m3u8';
COMMENT ON COLUMN public.screens.live_stream_enabled IS 'تفعيل البث المباشر بدلاً من Playlist - عند التفعيل يأخذ الأولوية';

-- ======================================
-- إنشاء جدول أدوار المستخدمين
-- Creating user roles table
-- ======================================

-- إنشاء ENUM للأدوار بطريقة آمنة
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- إنشاء جدول الأدوار
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- تفعيل RLS على جدول الأدوار
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ======================================
-- دوال التحقق من الأدوار
-- Role checking functions (SECURITY DEFINER)
-- ======================================

-- دالة للتحقق من دور معين
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- دالة للتحقق إذا كان المستخدم admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- ======================================
-- سياسات RLS لجدول الأدوار
-- RLS Policies for user_roles table
-- ======================================

-- السماح للمستخدمين برؤية دورهم فقط
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- السماح للـ Admin برؤية جميع الأدوار
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- السماح للـ Admin بإضافة أدوار
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- السماح للـ Admin بتعديل الأدوار
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- السماح للـ Admin بحذف الأدوار
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));