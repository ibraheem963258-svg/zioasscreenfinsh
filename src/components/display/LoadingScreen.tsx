import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="display-fullscreen flex items-center justify-center bg-black">
      <div className="text-center text-white">
        <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-white/60" />
        <p className="text-xl">{message}</p>
      </div>
    </div>
  );
}
