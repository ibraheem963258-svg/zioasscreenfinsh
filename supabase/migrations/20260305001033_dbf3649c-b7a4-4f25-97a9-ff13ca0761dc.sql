
-- Enable Realtime for all tables that display screens need to watch
ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content;
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.screens;
