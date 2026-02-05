import { DataPoint } from '../types/monitoring';

interface TrendGraphProps {
  title: string;
  data: DataPoint[];
  unit: string;
  color: string;
  maxDataPoints?: number;
}

export default function TrendGraph({ title, data, unit, color, maxDataPoints = 50 }: TrendGraphProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  const displayData = data.slice(-maxDataPoints);

  const values = displayData.map(d => d.value);
  const baselines = displayData.map(d => d.baseline);
  const allValues = [...values, ...baselines];

  const minValue = Math.min(...allValues) * 0.95;
  const maxValue = Math.max(...allValues) * 1.05;
  const range = maxValue - minValue;

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 40, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (index: number) => {
    return padding.left + (index / (displayData.length - 1)) * chartWidth;
  };

  const getY = (value: number) => {
    return padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
  };

  const valueLine = displayData
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.value)}`)
    .join(' ');

  const baselineLine = displayData
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.baseline)}`)
    .join(' ');

  const gridLines = 5;
  const yAxisLabels = Array.from({ length: gridLines }, (_, i) => {
    const value = minValue + (range * i) / (gridLines - 1);
    return value;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5" style={{ backgroundColor: color }}></div>
            <span className="text-gray-600">Current</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="32" height="2">
              <line x1="0" y1="1" x2="32" y2="1" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4,4" />
            </svg>
            <span className="text-gray-600">Baseline</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minHeight: '250px' }}>
          {yAxisLabels.map((value, i) => {
            const y = padding.top + chartHeight - (i / (gridLines - 1)) * chartHeight;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#6b7280"
                >
                  {value.toFixed(1)}
                </text>
              </g>
            );
          })}

          <path
            d={baselineLine}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="5,5"
          />

          <path
            d={valueLine}
            fill="none"
            stroke={color}
            strokeWidth="3"
          />

          {displayData.map((point, index) => (
            <circle
              key={index}
              cx={getX(index)}
              cy={getY(point.value)}
              r="3"
              fill={color}
            />
          ))}

          <text
            x={width / 2}
            y={height - 5}
            textAnchor="middle"
            fontSize="12"
            fill="#6b7280"
          >
            Time (s)
          </text>

          <text
            x={padding.left - 35}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill="#6b7280"
            transform={`rotate(-90, ${padding.left - 35}, ${height / 2})`}
          >
            {unit}
          </text>
        </svg>
      </div>
    </div>
  );
}
