export interface MonitoringData {
  time: number;
  heart_rate: number;
  skin_temp: number;
  sweat_level: number;
  baseline_hr: number;
  baseline_temp: number;
  baseline_sweat: number;
  state: 'NORMAL' | 'SHIFT' | 'ALERT' | 'RECOVERY';
}

export interface Event {
  id: string;
  timestamp: number;
  type: string;
  message: string;
}

export interface DataPoint {
  time: number;
  value: number;
  baseline: number;
}
