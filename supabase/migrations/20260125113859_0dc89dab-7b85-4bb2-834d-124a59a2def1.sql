-- Create branches table
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create screen_groups table
CREATE TABLE public.screen_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create screens table
CREATE TABLE public.screens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  orientation TEXT NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
  resolution TEXT NOT NULL DEFAULT '1920x1080',
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create screen_group_assignments (many-to-many relationship)
CREATE TABLE public.screen_group_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.screen_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(screen_id, group_id)
);

-- Create content table
CREATE TABLE public.content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER NOT NULL DEFAULT 10,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create content_assignments (assign content to screens)
CREATE TABLE public.content_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('screen', 'group', 'branch')),
  target_id UUID NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(content_id, target_type, target_id)
);

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('screen', 'group', 'branch')),
  target_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '00:00',
  end_time TIME NOT NULL DEFAULT '23:59',
  priority INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for admin users
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users (admin access)
CREATE POLICY "Authenticated users can manage branches" ON public.branches
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage screen_groups" ON public.screen_groups
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage screens" ON public.screens
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage screen_group_assignments" ON public.screen_group_assignments
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage content" ON public.content
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage content_assignments" ON public.content_assignments
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage schedules" ON public.schedules
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR ALL USING (auth.uid() = user_id);

-- Public read access for display pages (screens need to fetch their content)
CREATE POLICY "Public can read screens" ON public.screens
  FOR SELECT USING (true);

CREATE POLICY "Public can read content" ON public.content
  FOR SELECT USING (true);

CREATE POLICY "Public can read content_assignments" ON public.content_assignments
  FOR SELECT USING (true);

CREATE POLICY "Public can read schedules" ON public.schedules
  FOR SELECT USING (true);

CREATE POLICY "Public can read branches" ON public.branches
  FOR SELECT USING (true);

CREATE POLICY "Public can read screen_groups" ON public.screen_groups
  FOR SELECT USING (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_screen_groups_updated_at BEFORE UPDATE ON public.screen_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_screens_updated_at BEFORE UPDATE ON public.screens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for screens (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.screens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_assignments;