/**
 * ======================================
 * مكون إدارة البث المباشر للشاشة
 * Live Stream Management Dialog
 * ======================================
 * 
 * الوظيفة: إدارة رابط البث المباشر للشاشة
 * يدعم: HLS / m3u8 روابط
 */

import { useState, useEffect } from 'react';
import { Radio, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ======================================
// واجهة خصائص المكون
// Component Props Interface
// ======================================
interface LiveStreamDialogProps {
  /** معرف الشاشة */
  screenId: string;
  /** اسم الشاشة */
  screenName: string;
  /** رابط البث الحالي */
  currentUrl?: string | null;
  /** هل البث مفعل */
  isEnabled?: boolean;
  /** العنصر الذي يفتح الـ Dialog */
  trigger: React.ReactNode;
  /** دالة تُستدعى عند التحديث */
  onUpdate?: () => void;
}

export function LiveStreamDialog({
  screenId,
  screenName,
  currentUrl,
  isEnabled: initialEnabled,
  trigger,
  onUpdate,
}: LiveStreamDialogProps) {
  // ======================================
  // الحالات
  // States
  // ======================================
  const [isOpen, setIsOpen] = useState(false);
  const [streamUrl, setStreamUrl] = useState(currentUrl || '');
  const [isEnabled, setIsEnabled] = useState(initialEnabled || false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  // تحديث الحالات عند تغيير القيم الأولية
  useEffect(() => {
    setStreamUrl(currentUrl || '');
    setIsEnabled(initialEnabled || false);
  }, [currentUrl, initialEnabled]);

  // ======================================
  // التحقق من صحة رابط البث
  // Validate Stream URL
  // ======================================
  const validateUrl = (url: string): boolean => {
    if (!url) return true; // فارغ = صالح (تعطيل البث)
    
    // التحقق من أن الرابط يبدأ بـ http:// أو https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('الرابط يجب أن يبدأ بـ http:// أو https://');
      return false;
    }
    
    // التحقق من امتداد m3u8 (اختياري)
    const isHls = url.includes('.m3u8') || url.includes('m3u8');
    if (!isHls) {
      // تحذير فقط، لا نمنع الحفظ
      console.warn('الرابط قد لا يكون بصيغة HLS (.m3u8)');
    }
    
    setError(null);
    return true;
  };

  // ======================================
  // حفظ إعدادات البث المباشر
  // Save Live Stream Settings
  // ======================================
  const handleSave = async () => {
    // التحقق من صحة الرابط
    if (!validateUrl(streamUrl)) return;
    
    // إذا كان البث مفعل ولا يوجد رابط
    if (isEnabled && !streamUrl.trim()) {
      setError('يجب إدخال رابط البث عند التفعيل');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('screens')
        .update({
          live_stream_url: streamUrl.trim() || null,
          live_stream_enabled: isEnabled && !!streamUrl.trim(),
        })
        .eq('id', screenId);

      if (updateError) throw updateError;

      toast({
        title: 'تم الحفظ',
        description: isEnabled 
          ? 'تم تفعيل البث المباشر بنجاح'
          : 'تم تحديث إعدادات البث المباشر',
      });

      onUpdate?.();
      setIsOpen(false);
    } catch (err: any) {
      console.error('خطأ في حفظ البث المباشر:', err);
      setError(err.message || 'فشل في حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  // ======================================
  // العرض
  // Render
  // ======================================
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive" />
            البث المباشر - {screenName}
          </DialogTitle>
          <DialogDescription>
            إدارة رابط البث المباشر للشاشة. عند التفعيل، يأخذ البث المباشر الأولوية على أي Playlist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* تفعيل/تعطيل البث المباشر */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="space-y-0.5">
              <Label className="text-base">تفعيل البث المباشر</Label>
              <p className="text-sm text-muted-foreground">
                عند التفعيل، يتم عرض البث بدلاً من Playlist
              </p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>

          {/* رابط البث */}
          <div className="space-y-2">
            <Label htmlFor="streamUrl">رابط البث (HLS/m3u8)</Label>
            <Input
              id="streamUrl"
              placeholder="https://example.com/live/stream.m3u8"
              value={streamUrl}
              onChange={(e) => {
                setStreamUrl(e.target.value);
                setError(null);
              }}
              dir="ltr"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              أدخل رابط البث المباشر بصيغة HLS (.m3u8)
            </p>
          </div>

          {/* رسالة الخطأ */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* معاينة الرابط */}
          {streamUrl && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">معاينة الرابط:</span>
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  فتح
                </a>
              </div>
              <code className="text-xs break-all block text-foreground/70">
                {streamUrl}
              </code>
            </div>
          )}

          {/* تحذير عند التفعيل */}
          {isEnabled && (
            <Alert>
              <Radio className="h-4 w-4" />
              <AlertDescription>
                <strong>ملاحظة:</strong> عند تفعيل البث المباشر، سيتم إيقاف عرض أي Playlist مخصصة للشاشة وعرض البث المباشر بدلاً منها.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              'حفظ'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
