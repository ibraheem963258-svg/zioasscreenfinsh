
-- =====================================================
-- إصلاح دالة estimate_monthly_egress
-- المشكلة: المعادلة كانت تضرب initialLoad × عدد الشاشات مرة كاملة
-- وهذا يشمل تحميل الصور والفيديو في كل مرة — لكن الكاش يمنع ذلك
--
-- المعادلة الصحيحة مع حماية IndexedDB + ETag HEAD checks:
--
-- Android/TV Box (IndexedDB يبقى بعد إيقاف الجهاز):
--   • تحميل أولي: content_size × عدد الشاشات (مرة واحدة فقط)
--   • كل تحديث: HEAD request (≈1KB) + تحميل الملفات المتغيرة فقط
--   • نفترض 30% من المحتوى يتغير في كل تحديث
--   • مجموع شهري = initial + (content × 0.30 × updates_per_month) × screens
--
-- Samsung Smart TV (Tizen يمسح الكاش يومياً):
--   • كل يوم = تحميل كامل للمحتوى
--   • مجموع شهري = content_size × 30 × عدد الشاشات
--
-- ملاحظة: الدالة تدعم تمرير حجم محتوى مخصص (للتخطيط المستقبلي)
-- عندما يكون p_custom_content_bytes = 0، تستخدم البيانات الفعلية من DB
-- =====================================================
CREATE OR REPLACE FUNCTION public.estimate_monthly_egress(
  p_android_screens      INTEGER DEFAULT 0,
  p_samsung_screens      INTEGER DEFAULT 0,
  p_updates_per_month    INTEGER DEFAULT 4,
  p_custom_content_bytes BIGINT  DEFAULT 0   -- 0 = استخدم البيانات الفعلية من DB
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_video_bytes   BIGINT;
  v_total_image_bytes   BIGINT;
  v_content_bytes       BIGINT;  -- الحجم المستخدم في الحساب
  v_android_initial     BIGINT;
  v_android_updates     BIGINT;
  v_android_monthly     BIGINT;
  v_samsung_monthly     BIGINT;
  v_total_monthly       BIGINT;
  v_budget_bytes        BIGINT := 268435456000; -- 250 GB بالضبط
  v_change_rate         NUMERIC := 0.30;        -- 30% من المحتوى يتغير عند كل تحديث
BEGIN
  -- جلب الأحجام الفعلية من DB
  SELECT
    COALESCE(SUM(file_size) FILTER (WHERE type = 'video'), 0),
    COALESCE(SUM(file_size) FILTER (WHERE type = 'image'), 0)
  INTO v_total_video_bytes, v_total_image_bytes
  FROM public.content
  WHERE file_size IS NOT NULL AND file_size > 0;

  -- استخدام حجم مخصص أو البيانات الفعلية
  IF p_custom_content_bytes > 0 THEN
    v_content_bytes := p_custom_content_bytes;
  ELSE
    v_content_bytes := v_total_video_bytes + v_total_image_bytes;
  END IF;

  -- ---- Android/TV Box ----
  -- التحميل الأولي: مرة واحدة لكل شاشة
  v_android_initial := v_content_bytes * p_android_screens;
  -- التحديثات: 30% من المحتوى × عدد التحديثات × عدد الشاشات
  v_android_updates := ROUND(v_content_bytes * v_change_rate * p_updates_per_month * p_android_screens);
  v_android_monthly := v_android_initial + v_android_updates;

  -- ---- Samsung Smart TV ----
  -- تحميل يومي كامل × 30 يوماً
  v_samsung_monthly := v_content_bytes * 30 * p_samsung_screens;

  v_total_monthly := v_android_monthly + v_samsung_monthly;

  RETURN json_build_object(
    -- إحصائيات المحتوى
    'db_content_gb',       ROUND((v_total_video_bytes + v_total_image_bytes)::numeric / (1024*1024*1024), 3),
    'used_content_gb',     ROUND(v_content_bytes::numeric / (1024*1024*1024), 3),
    'custom_size_used',    p_custom_content_bytes > 0,

    -- تفصيل الـ Egress
    'android_initial_gb',  ROUND(v_android_initial::numeric / (1024*1024*1024), 2),
    'android_updates_gb',  ROUND(v_android_updates::numeric / (1024*1024*1024), 2),
    'android_monthly_gb',  ROUND(v_android_monthly::numeric / (1024*1024*1024), 2),
    'samsung_monthly_gb',  ROUND(v_samsung_monthly::numeric / (1024*1024*1024), 2),
    'total_monthly_gb',    ROUND(v_total_monthly::numeric / (1024*1024*1024), 2),

    -- تقييم الميزانية
    'budget_gb',           250,
    'within_budget',       v_total_monthly <= v_budget_bytes,
    'budget_used_pct',     ROUND(v_total_monthly::numeric / NULLIF(v_budget_bytes, 0) * 100, 1),
    'overage_gb',          GREATEST(0, ROUND((v_total_monthly - v_budget_bytes)::numeric / (1024*1024*1024), 2)),
    'overage_cost_usd',    GREATEST(0, ROUND((v_total_monthly - v_budget_bytes)::numeric / (1024*1024*1024) * 0.09, 2))
  );
END;
$$;
