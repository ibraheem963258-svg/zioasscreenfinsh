import { MonitorOff } from 'lucide-react';

interface IdleScreenProps {
  screenName: string;
  message?: string;
}

export function IdleScreen({ screenName, message = 'No active playlist' }: IdleScreenProps) {
  return (
    <div className="display-fullscreen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="text-center text-white">
        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <MonitorOff className="w-12 h-12 text-yellow-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{screenName}</h1>
        <p className="text-lg opacity-60">{message}</p>
        <p className="text-sm opacity-40 mt-4">Waiting for content...</p>
      </div>
    </div>
  );
}
