import { MonitoringData } from '../types/monitoring';
import { Heart, Thermometer, Droplets, Activity } from 'lucide-react';

interface LiveStatusPanelProps {
  data: MonitoringData | null;
  deviations?: {
    hr: 'higher' | 'lower' | 'normal';
    temp: 'higher' | 'lower' | 'normal';
    sweat: 'higher' | 'lower' | 'normal';
  } | null;
}

const getSweatLabel = (level: number): string => {
  if (level < 400) return 'Low';
  if (level < 700) return 'Medium';
  return 'High';
};

const stateColors = {
  NORMAL: 'bg-green-500',
  SHIFT: 'bg-yellow-500',
  ALERT: 'bg-red-500',
  RECOVERY: 'bg-blue-500',
};

const stateTextColors = {
  NORMAL: 'text-green-600',
  SHIFT: 'text-yellow-600',
  ALERT: 'text-red-600',
  RECOVERY: 'text-blue-600',
};

const hypoglycemiaStages = [
  { code: 0, name: 'NORMAL', meaning: 'Stable physiology' },
  { code: 1, name: 'PHYSIOLOGICAL SHIFT', meaning: 'Early stress response' },
  { code: 2, name: 'HYPOGLYCEMIA RISK (ALERT)', meaning: 'Strong correlated response' },
  { code: 3, name: 'RECOVERY', meaning: 'Return toward baseline' },
];

const deviationStyles: Record<'higher' | 'lower' | 'normal', { label: string; className: string }> = {
  higher: { label: 'Higher', className: 'text-red-600' },
  lower: { label: 'Lower', className: 'text-blue-600' },
  normal: { label: 'Normal', className: 'text-green-600' },
};

const DeviationLabel = ({ value }: { value: 'higher' | 'lower' | 'normal' | null }) => {
  if (!value) {
    return <div className="text-xs text-gray-400">Baseline learning</div>;
  }

  const style = deviationStyles[value];
  return <div className={`text-xs font-semibold ${style.className}`}>{style.label}</div>;
};

export default function LiveStatusPanel({ data, deviations }: LiveStatusPanelProps) {
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center text-gray-400">Waiting for data...</div>
      </div>
    );
  }

  const state = data.state || 'NORMAL';

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
          <Heart className="w-12 h-12 text-red-500 mb-3" />
          <div className="text-sm text-gray-600 mb-1">Heart Rate</div>
          <div className="text-4xl font-bold text-gray-900">{data.heart_rate}</div>
          <div className="text-sm text-gray-500 mt-1">BPM</div>
          <DeviationLabel value={deviations?.hr ?? null} />
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
          <Thermometer className="w-12 h-12 text-orange-500 mb-3" />
          <div className="text-sm text-gray-600 mb-1">Skin Temperature</div>
          <div className="text-4xl font-bold text-gray-900">{data.skin_temp.toFixed(1)}</div>
          <div className="text-sm text-gray-500 mt-1">°C</div>
          <DeviationLabel value={deviations?.temp ?? null} />
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
          <Droplets className="w-12 h-12 text-blue-500 mb-3" />
          <div className="text-sm text-gray-600 mb-1">Sweat Level</div>
          <div className="text-4xl font-bold text-gray-900">{getSweatLabel(data.sweat_level)}</div>
          <div className="text-sm text-gray-500 mt-1">({data.sweat_level})</div>
          <DeviationLabel value={deviations?.sweat ?? null} />
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border-4" style={{ borderColor: `var(--state-color-${state})` }}>
          <Activity className={`w-12 h-12 mb-3 ${stateTextColors[state]}`} />
          <div className="text-sm text-gray-600 mb-1">Health State</div>
          <div className={`text-3xl font-bold ${stateTextColors[state]}`}>{state}</div>
          <div className={`mt-3 px-4 py-1 rounded-full text-sm font-semibold text-white ${stateColors[state]}`}>
            {state}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-lg font-semibold text-gray-800 mb-4">Official Hypoglycemia System Stages</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hypoglycemiaStages.map((stage) => (
            <div key={stage.code} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700">Stage {stage.code}</div>
                <span className="text-xs uppercase tracking-wide text-gray-500">{stage.name}</span>
              </div>
              <div className="mt-2 text-gray-800 font-medium">{stage.name}</div>
              <div className="mt-1 text-sm text-gray-600">{stage.meaning}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
