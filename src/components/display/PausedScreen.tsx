import { Pause } from 'lucide-react';

interface PausedScreenProps {
  screenName: string;
}

export function PausedScreen({ screenName }: PausedScreenProps) {
  return (
    <div className="display-fullscreen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="text-center text-white">
        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-white/10 flex items-center justify-center">
          <Pause className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{screenName}</h1>
        <p className="text-lg opacity-60">Content playback is paused</p>
      </div>
    </div>
  );
}
