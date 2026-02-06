import { MonitoringData } from '../types/monitoring';
import { Heart, Thermometer, Droplets } from 'lucide-react';

interface LiveStatusPanelProps {
  data: MonitoringData | null;
}

const getSweatLabel = (level: number): string => {
  if (level < 400) return 'Low';
  if (level < 700) return 'Medium';
  return 'High';
};

export default function LiveStatusPanel({ data }: LiveStatusPanelProps) {
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center text-gray-400">Waiting for data...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
          <Heart className="w-12 h-12 text-red-500 mb-3" />
          <div className="text-sm text-gray-600 mb-1">Heart Rate</div>
          <div className="text-4xl font-bold text-gray-900">{data.heart_rate}</div>
          <div className="text-sm text-gray-500 mt-1">BPM</div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
          <Thermometer className="w-12 h-12 text-orange-500 mb-3" />
          <div className="text-sm text-gray-600 mb-1">Skin Temperature</div>
          <div className="text-4xl font-bold text-gray-900">{data.skin_temp.toFixed(1)}</div>
          <div className="text-sm text-gray-500 mt-1">°C</div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
          <Droplets className="w-12 h-12 text-blue-500 mb-3" />
          <div className="text-sm text-gray-600 mb-1">Sweat Level</div>
          <div className="text-4xl font-bold text-gray-900">{getSweatLabel(data.sweat_level)}</div>
          <div className="text-sm text-gray-500 mt-1">({data.sweat_level})</div>
        </div>
      </div>
    </div>
  );
}
