import { MonitoringData } from '../types/monitoring';

export class DataSimulator {
  private time = 0;
  private state: MonitoringData['state'] = 'NORMAL';
  private phase = 0;

  generateData(): MonitoringData {
    this.time += 1;

    let heart_rate = 72;
    let skin_temp = 34.5;
    let sweat_level = 820;
    const baseline_hr = 72;
    const baseline_temp = 34.5;
    const baseline_sweat = 820;

    if (this.time < 30) {
      this.state = 'NORMAL';
      heart_rate = 72 + Math.random() * 4 - 2;
      skin_temp = 34.5 + Math.random() * 0.2 - 0.1;
      sweat_level = 820 + Math.random() * 40 - 20;
    } else if (this.time < 60) {
      this.state = 'SHIFT';
      heart_rate = 72 + (this.time - 30) * 0.8 + Math.random() * 4;
      skin_temp = 34.5 - (this.time - 30) * 0.08 + Math.random() * 0.2;
      sweat_level = 820 - (this.time - 30) * 13 + Math.random() * 40;
    } else if (this.time < 90) {
      this.state = 'ALERT';
      heart_rate = 96 + Math.random() * 6;
      skin_temp = 32.1 + Math.random() * 0.3;
      sweat_level = 420 + Math.random() * 50;
    } else if (this.time < 120) {
      this.state = 'RECOVERY';
      heart_rate = 96 - (this.time - 90) * 0.8 + Math.random() * 4;
      skin_temp = 32.1 + (this.time - 90) * 0.08 + Math.random() * 0.2;
      sweat_level = 420 + (this.time - 90) * 13 + Math.random() * 40;
    } else {
      this.time = 0;
      this.state = 'NORMAL';
    }

    return {
      time: this.time,
      heart_rate: Math.round(heart_rate),
      skin_temp: Math.round(skin_temp * 10) / 10,
      sweat_level: Math.round(sweat_level),
      baseline_hr,
      baseline_temp,
      baseline_sweat,
      state: this.state,
    };
  }
}
