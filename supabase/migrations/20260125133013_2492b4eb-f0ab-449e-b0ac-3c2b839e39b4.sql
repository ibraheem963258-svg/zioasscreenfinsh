-- Create playlists table for multiple playlists per target
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('screen', 'group', 'branch')),
  target_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlist_items table for playlist content
CREATE TABLE public.playlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create display_settings table for per-target configuration
CREATE TABLE public.display_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('screen', 'group', 'branch')),
  target_id UUID NOT NULL,
  slide_duration INTEGER NOT NULL DEFAULT 10,
  transition_type TEXT NOT NULL DEFAULT 'fade' CHECK (transition_type IN ('none', 'fade', 'slide', 'crossfade')),
  transition_duration INTEGER NOT NULL DEFAULT 500,
  playback_order TEXT NOT NULL DEFAULT 'loop' CHECK (playback_order IN ('loop', 'shuffle')),
  content_scaling TEXT NOT NULL DEFAULT 'fill' CHECK (content_scaling IN ('fit', 'fill', 'stretch')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(target_type, target_id)
);

-- Add current_playlist_id to screens table
ALTER TABLE public.screens ADD COLUMN current_playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playlists
CREATE POLICY "Authenticated users can manage playlists" ON public.playlists FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Public can read playlists" ON public.playlists FOR SELECT USING (true);

-- RLS Policies for playlist_items
CREATE POLICY "Authenticated users can manage playlist_items" ON public.playlist_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Public can read playlist_items" ON public.playlist_items FOR SELECT USING (true);

-- RLS Policies for display_settings
CREATE POLICY "Authenticated users can manage display_settings" ON public.display_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Public can read display_settings" ON public.display_settings FOR SELECT USING (true);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_settings;

-- Create function to deactivate other playlists when one is activated
CREATE OR REPLACE FUNCTION public.deactivate_other_playlists()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.playlists 
    SET is_active = false, updated_at = now()
    WHERE target_type = NEW.target_type 
      AND target_id = NEW.target_id 
      AND id != NEW.id 
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-deactivate other playlists
CREATE TRIGGER deactivate_other_playlists_trigger
BEFORE UPDATE OF is_active ON public.playlists
FOR EACH ROW
WHEN (NEW.is_active = true AND OLD.is_active = false)
EXECUTE FUNCTION public.deactivate_other_playlists();

-- Also trigger on insert
CREATE TRIGGER deactivate_other_playlists_on_insert_trigger
BEFORE INSERT ON public.playlists
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.deactivate_other_playlists();

-- Update triggers for updated_at
CREATE TRIGGER update_playlists_updated_at
BEFORE UPDATE ON public.playlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_display_settings_updated_at
BEFORE UPDATE ON public.display_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();