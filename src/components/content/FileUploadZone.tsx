import { useState, useCallback } from 'react';
import { Upload, X, Image, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FileUploadZoneProps {
  onUploadComplete: (file: {
    name: string;
    type: 'image' | 'video';
    url: string;
    thumbnailUrl: string;
    fileSize: number;
    duration: number;
  }) => void;
  onClose: () => void;
}

export function FileUploadZone({ onUploadComplete, onClose }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [contentName, setContentName] = useState('');
  const [duration, setDuration] = useState('10');
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = (selectedFile: File) => {
    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image or video file.',
        variant: 'destructive',
      });
      return;
    }

    const MAX_SIZE = 300 * 1024 * 1024; // 300MB
    if (selectedFile.size > MAX_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 300MB.',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setContentName(selectedFile.name.replace(/\.[^/.]+$/, ''));

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);

    // Get video duration if it's a video
    if (isVideo) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setDuration(Math.round(video.duration).toString());
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(selectedFile);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !contentName) {
      toast({
        title: 'Error',
        description: 'Please select a file and enter a name.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('content')
        .upload(filePath, file, {
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('content')
        .getPublicUrl(filePath);

      const fileType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';

      onUploadComplete({
        name: contentName,
        type: fileType,
        url: publicUrl,
        thumbnailUrl: publicUrl,
        fileSize: file.size,
        duration: parseInt(duration),
      });

      toast({
        title: 'Uploaded!',
        description: 'Content uploaded successfully.',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setContentName('');
    setDuration('10');
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-secondary/50"
          )}
        >
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">
              Drag & drop your file here
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports: JPG, PNG, GIF, WEBP, MP4, WEBM (max 300MB)
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-secondary">
            {file.type.startsWith('video/') ? (
              <video
                src={preview || undefined}
                className="w-full h-full object-contain"
                controls
              />
            ) : (
              <img
                src={preview || undefined}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            )}
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={clearFile}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="absolute top-2 left-2">
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-background/80 backdrop-blur text-sm">
                {file.type.startsWith('video/') ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <Image className="h-4 w-4" />
                )}
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Content Name</Label>
              <Input
                value={contentName}
                onChange={(e) => setContentName(e.target.value)}
                placeholder="Enter content name"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Duration (seconds)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="1"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                'Upload'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}