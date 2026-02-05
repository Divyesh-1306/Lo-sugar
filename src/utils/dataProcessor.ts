import { MonitoringData, Event, DataPoint } from '../types/monitoring';

export function parseCSVLine(line: string): MonitoringData | null {
  const parts = line.trim().split(',');

  if (parts.length !== 8) {
    return null;
  }

  return {
    time: parseInt(parts[0]),
    heart_rate: parseInt(parts[1]),
    skin_temp: parseFloat(parts[2]),
    sweat_level: parseInt(parts[3]),
    baseline_hr: parseInt(parts[4]),
    baseline_temp: parseFloat(parts[5]),
    baseline_sweat: parseInt(parts[6]),
    state: parts[7].trim() as 'NORMAL' | 'SHIFT' | 'ALERT' | 'RECOVERY',
  };
}

export function detectEvents(
  current: MonitoringData,
  previous: MonitoringData | null
): Event[] {
  const events: Event[] = [];

  if (!previous) return events;

  if (current.state !== previous.state) {
    events.push({
      id: `state-${current.time}`,
      timestamp: current.time,
      type: 'state_change',
      message: `Health state changed to ${current.state}`,
    });
  }

  const sweatIncrease = current.sweat_level - previous.sweat_level;
  if (sweatIncrease > 100) {
    events.push({
      id: `sweat-${current.time}`,
      timestamp: current.time,
      type: 'sweat_spike',
      message: `Sweat spike detected (+${sweatIncrease})`,
    });
  }

  const hrDeviation = Math.abs(current.heart_rate - current.baseline_hr);
  const prevHrDeviation = Math.abs(previous.heart_rate - previous.baseline_hr);

  if (hrDeviation > 20 && prevHrDeviation <= 20) {
    events.push({
      id: `hr-${current.time}`,
      timestamp: current.time,
      type: 'hr_deviation',
      message: `Heart rate deviation detected (${hrDeviation} BPM from baseline)`,
    });
  }

  if (current.state === 'ALERT' && previous.state !== 'ALERT') {
    events.push({
      id: `alert-${current.time}`,
      timestamp: current.time,
      type: 'alert',
      message: 'ALERT triggered - Multiple stress indicators detected',
    });
  }

  if (current.state === 'RECOVERY' && previous.state !== 'RECOVERY') {
    events.push({
      id: `recovery-${current.time}`,
      timestamp: current.time,
      type: 'recovery',
      message: 'Recovery started - Vitals returning to baseline',
    });
  }

  return events;
}

export function createDataPoint(data: MonitoringData, type: 'hr' | 'temp' | 'sweat'): DataPoint {
  switch (type) {
    case 'hr':
      return {
        time: data.time,
        value: data.heart_rate,
        baseline: data.baseline_hr,
      };
    case 'temp':
      return {
        time: data.time,
        value: data.skin_temp,
        baseline: data.baseline_temp,
      };
    case 'sweat':
      return {
        time: data.time,
        value: data.sweat_level,
        baseline: data.baseline_sweat,
      };
  }
}
