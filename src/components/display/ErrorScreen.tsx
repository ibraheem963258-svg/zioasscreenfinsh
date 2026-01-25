import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorScreenProps {
  title: string;
  message: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

export function ErrorScreen({ title, message, showRetry = false, onRetry }: ErrorScreenProps) {
  return (
    <div className="display-fullscreen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="text-center text-white max-w-md px-8">
        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-lg opacity-70 mb-8">{message}</p>
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
