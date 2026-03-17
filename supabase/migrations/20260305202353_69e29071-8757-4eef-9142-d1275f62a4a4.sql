
-- =====================================================
-- 1. دالة لحساب الإجمالي الحقيقي لحجم الملفات (Egress) من DB
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_content_storage_stats()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_files',     COUNT(*),
    'total_bytes',     COALESCE(SUM(file_size), 0),
    'total_gb',        ROUND(COALESCE(SUM(file_size), 0)::numeric / (1024*1024*1024), 3),
    'video_files',     COUNT(*) FILTER (WHERE type = 'video'),
    'video_bytes',     COALESCE(SUM(file_size) FILTER (WHERE type = 'video'), 0),
    'image_files',     COUNT(*) FILTER (WHERE type = 'image'),
    'image_bytes',     COALESCE(SUM(file_size) FILTER (WHERE type = 'image'), 0),
    'avg_video_bytes', COALESCE(AVG(file_size) FILTER (WHERE type = 'video'), 0)
  )
  FROM public.content
  WHERE file_size IS NOT NULL AND file_size > 0;
$$;

-- =====================================================
-- 2. دالة لحساب الـ Egress المتوقع شهرياً بناءً على عدد الشاشات
-- =====================================================
CREATE OR REPLACE FUNCTION public.estimate_monthly_egress(
  p_android_screens   INTEGER DEFAULT 0,
  p_samsung_screens   INTEGER DEFAULT 0,
  p_updates_per_month INTEGER DEFAULT 4
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_video_bytes BIGINT;
  v_total_image_bytes BIGINT;
  v_initial_load_bytes BIGINT;
  v_android_monthly   BIGINT;
  v_samsung_monthly   BIGINT;
  v_total_monthly     BIGINT;
  v_budget_bytes      BIGINT := 268435456000;
BEGIN
  SELECT
    COALESCE(SUM(file_size) FILTER (WHERE type = 'video'), 0),
    COALESCE(SUM(file_size) FILTER (WHERE type = 'image'), 0)
  INTO v_total_video_bytes, v_total_image_bytes
  FROM public.content
  WHERE file_size IS NOT NULL AND file_size > 0;

  v_initial_load_bytes := v_total_video_bytes + v_total_image_bytes;

  -- Android/TV Box: IndexedDB يبقى → تحميل أولي + 30% تحديث لكل update
  v_android_monthly := (
    (v_initial_load_bytes * p_android_screens) +
    (v_total_video_bytes * 3 / 10 * p_android_screens * p_updates_per_month)
  );

  -- Samsung Smart TV: كاش يومي → تحميل كامل كل يوم
  v_samsung_monthly := (
    v_initial_load_bytes * p_samsung_screens * 30
  );

  v_total_monthly := v_android_monthly + v_samsung_monthly;

  RETURN json_build_object(
    'total_content_gb',   ROUND(v_initial_load_bytes::numeric / (1024*1024*1024), 3),
    'android_monthly_gb', ROUND(v_android_monthly::numeric / (1024*1024*1024), 2),
    'samsung_monthly_gb', ROUND(v_samsung_monthly::numeric / (1024*1024*1024), 2),
    'total_monthly_gb',   ROUND(v_total_monthly::numeric / (1024*1024*1024), 2),
    'budget_gb',          250,
    'within_budget',      v_total_monthly <= v_budget_bytes,
    'budget_used_pct',    ROUND(v_total_monthly::numeric / NULLIF(v_budget_bytes, 0) * 100, 1)
  );
END;
$$;

-- =====================================================
-- 3. دالة موحّدة لحساب الـ status الدقيق للشاشة مباشرة من السيرفر
--    تعتمد على last_heartbeat بدون pg_cron lag
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_screens_with_status()
RETURNS TABLE (
  id                      UUID,
  name                    TEXT,
  slug                    TEXT,
  branch_id               UUID,
  orientation             TEXT,
  resolution              TEXT,
  computed_status         TEXT,
  is_playing              BOOLEAN,
  is_active               BOOLEAN,
  last_heartbeat          TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ,
  current_playlist_id     UUID,
  live_stream_url         TEXT,
  live_stream_enabled     BOOLEAN,
  force_refresh_at        TIMESTAMPTZ,
  minutes_since_heartbeat NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.slug,
    s.branch_id,
    s.orientation,
    s.resolution,
    CASE
      WHEN s.last_heartbeat IS NULL
        THEN 'offline'
      WHEN EXTRACT(EPOCH FROM (now() - s.last_heartbeat)) / 60 > 2
        THEN 'offline'
      WHEN s.is_playing = false
        THEN 'idle'
      WHEN s.current_playlist_id IS NULL
        THEN 'idle'
      ELSE 'online'
    END AS computed_status,
    s.is_playing,
    s.is_active,
    s.last_heartbeat,
    s.updated_at,
    s.current_playlist_id,
    s.live_stream_url,
    s.live_stream_enabled,
    s.force_refresh_at,
    ROUND(EXTRACT(EPOCH FROM (now() - s.last_heartbeat)) / 60, 1) AS minutes_since_heartbeat
  FROM public.screens s;
$$;
