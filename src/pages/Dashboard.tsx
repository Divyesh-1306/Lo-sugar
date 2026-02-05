import { useEffect, useRef, useState } from 'react';
import { Activity, Heart, LogOut, ShieldCheck, Signal } from 'lucide-react';
import type { User } from 'firebase/auth';
import LiveStatusPanel from '../components/LiveStatusPanel';
import TrendGraph from '../components/TrendGraph';
import EventTimeline from '../components/EventTimeline';
import { MonitoringData, Event, DataPoint } from '../types/monitoring';
import { createDataPoint, detectEvents } from '../utils/dataProcessor';
import { auth, rtdb } from '../utils/firebaseClient';
import { signOut } from 'firebase/auth';
import { ref as dbRef, onValue, query as dbQuery, limitToLast, orderByChild } from 'firebase/database';

interface DashboardProps {
  user?: User;
}

type LatestHealthRow = {
  heart_rate: number | null;
  skin_temp: number | null;
  sweat_level: number | null;
  state: string | null;
  created_at: Date | null;
};

type BaselineValues = {
  hr: number;
  temp: number;
  sweat: number;
};

type DeviationStatus = 'higher' | 'lower' | 'normal';

const stateBadgeStyles: Record<MonitoringData['state'], string> = {
  NORMAL: 'bg-green-600 text-white',
  SHIFT: 'bg-yellow-500 text-slate-900',
  ALERT: 'bg-red-600 text-white',
  RECOVERY: 'bg-blue-600 text-white',
};

const stateLabels: Record<MonitoringData['state'], string> = {
  NORMAL: 'NORMAL',
  SHIFT: 'PHYSIOLOGICAL SHIFT',
  ALERT: 'ALERT – Hypoglycemia Risk',
  RECOVERY: 'RECOVERY',
};

export default function Dashboard({ user }: DashboardProps) {
  const [currentData, setCurrentData] = useState<MonitoringData | null>(null);
  const [hrData, setHrData] = useState<DataPoint[]>([]);
  const [tempData, setTempData] = useState<DataPoint[]>([]);
  const [sweatData, setSweatData] = useState<DataPoint[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [latestData, setLatestData] = useState<LatestHealthRow | null>(null);
  const [recentReadings, setRecentReadings] = useState<LatestHealthRow[]>([]);
  const [isLatestLoading, setIsLatestLoading] = useState(true);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<BaselineValues | null>(null);
  const [baselineCount, setBaselineCount] = useState(0);
  const [baselineStatus, setBaselineStatus] = useState<'waiting' | 'learning' | 'ready'>('waiting');
  const [deviations, setDeviations] = useState<{
    hr: DeviationStatus;
    temp: DeviationStatus;
    sweat: DeviationStatus;
  } | null>(null);

  const previousDataRef = useRef<MonitoringData | null>(null);
  const baselineBufferRef = useRef<BaselineValues[]>([]);
  const normalStreakRef = useRef(0);
  const lastComputedStateRef = useRef<MonitoringData['state']>('NORMAL');

  const BASELINE_WINDOW = 15;
  const MILD_THRESHOLD = 0.1;
  const STRONG_THRESHOLD = 0.25;
  const NORMAL_ADAPT_START = 10;
  const BASELINE_BLEND = 0.1;

  const patientName = user?.email || 'Shared Dashboard';

  const deviceId = import.meta.env.VITE_DEVICE_ID || 'ESP32-EDGE-001';

  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object' && value && 'toDate' in value) {
      const candidate = value as { toDate?: () => Date };
      return typeof candidate.toDate === 'function' ? candidate.toDate() : null;
    }
    return null;
  };

  const computeAverageBaseline = (samples: BaselineValues[]): BaselineValues | null => {
    if (samples.length === 0) return null;
    const totals = samples.reduce(
      (acc, sample) => ({
        hr: acc.hr + sample.hr,
        temp: acc.temp + sample.temp,
        sweat: acc.sweat + sample.sweat,
      }),
      { hr: 0, temp: 0, sweat: 0 }
    );
    return {
      hr: totals.hr / samples.length,
      temp: totals.temp / samples.length,
      sweat: totals.sweat / samples.length,
    };
  };

  const getDeviation = (value: number, base: number): { status: DeviationStatus; magnitude: number } => {
    const denominator = base === 0 ? 1 : base;
    const diff = value - base;
    const pct = diff / denominator;
    if (Math.abs(pct) < MILD_THRESHOLD) {
      return { status: 'normal', magnitude: Math.abs(pct) };
    }
    return { status: pct > 0 ? 'higher' : 'lower', magnitude: Math.abs(pct) };
  };

  const formatSerialLines = (row: LatestHealthRow): string[] => {
    const timeLabel = row.created_at ? row.created_at.toLocaleTimeString() : '—';
    const hr = row.heart_rate ?? '—';
    const temp = row.skin_temp ?? '—';
    const sweat = row.sweat_level ?? '—';
    const state = row.state ?? '—';
    return [
      `ESP32 > [${timeLabel}] ---- BODY SENSOR DATA ----`,
      `ESP32 > Heart Rate: ${hr} BPM`,
      `ESP32 > Temperature: ${temp} C`,
      `ESP32 > Sweat ADC: ${sweat}`,
      `ESP32 > State: ${state}`,
      `ESP32 > ---------------------------`,
    ];
  };

  useEffect(() => {
    setIsLatestLoading(true);
    setLatestError(null);

    const healthQuery = dbQuery(
      dbRef(rtdb, 'health_data'),
      orderByChild('timestamp'),
      limitToLast(10)
    );

    const unsubscribe = onValue(
      healthQuery,
      (snapshot) => {
        const value = snapshot.val();
        const rows = value
          ? Object.values(value).map((data) => ({
              heart_rate: toNumber((data as any).heart_rate),
              skin_temp: toNumber((data as any).skin_temp),
              sweat_level: toNumber((data as any).sweat_level),
              state: (data as any).state ?? null,
              created_at: toDate((data as any).created_at ?? (data as any).timestamp),
            }))
          : [];

        rows.sort((a, b) => {
          const aTime = a.created_at ? a.created_at.getTime() : 0;
          const bTime = b.created_at ? b.created_at.getTime() : 0;
          return bTime - aTime;
        });

        if (baselineBufferRef.current.length === 0 && !baseline) {
          [...rows].reverse().forEach((row) => {
            if (baselineBufferRef.current.length >= BASELINE_WINDOW) return;
            if (row.heart_rate === null || row.skin_temp === null || row.sweat_level === null) return;
            baselineBufferRef.current.push({
              hr: row.heart_rate,
              temp: row.skin_temp,
              sweat: row.sweat_level,
            });
          });
          const count = baselineBufferRef.current.length;
          setBaselineCount(count);
          if (count > 0) {
            setBaselineStatus(count >= BASELINE_WINDOW ? 'ready' : 'learning');
          }
          if (count >= BASELINE_WINDOW) {
            setBaseline(computeAverageBaseline(baselineBufferRef.current));
          }
        }

        setRecentReadings(rows);
        setLatestData(rows[0] ?? null);
        setIsLatestLoading(false);
      },
      (error) => {
        setLatestError(error.message);
        setLatestData(null);
        setRecentReadings([]);
        setIsLatestLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!latestData) {
      setBaselineStatus('waiting');
      setDeviations(null);
      return;
    }

    const heartRate = latestData.heart_rate ?? 0;
    const skinTemp = latestData.skin_temp ?? 0;
    const sweatLevel = latestData.sweat_level ?? 0;

    if (!baseline && baselineBufferRef.current.length < BASELINE_WINDOW) {
      if (latestData.heart_rate !== null && latestData.skin_temp !== null && latestData.sweat_level !== null) {
        baselineBufferRef.current.push({
          hr: latestData.heart_rate,
          temp: latestData.skin_temp,
          sweat: latestData.sweat_level,
        });
        const count = baselineBufferRef.current.length;
        setBaselineCount(count);
        setBaselineStatus(count >= BASELINE_WINDOW ? 'ready' : 'learning');
        if (count >= BASELINE_WINDOW) {
          setBaseline(computeAverageBaseline(baselineBufferRef.current));
        }
      }
    }

    const learningBaseline = baseline ?? computeAverageBaseline(baselineBufferRef.current);
    if (!baseline && learningBaseline) {
      setBaselineStatus('learning');
    }

    const activeBaseline = baseline ?? learningBaseline ?? { hr: 70, temp: 36.5, sweat: 0 };

    const hrDeviation = getDeviation(heartRate, activeBaseline.hr);
    const tempDeviation = getDeviation(skinTemp, activeBaseline.temp);
    const sweatDeviation = getDeviation(sweatLevel, activeBaseline.sweat);

    const maxDeviation = Math.max(hrDeviation.magnitude, tempDeviation.magnitude, sweatDeviation.magnitude);
    let computedState: MonitoringData['state'] = 'NORMAL';
    if (maxDeviation >= STRONG_THRESHOLD) {
      computedState = 'ALERT';
    } else if (maxDeviation >= MILD_THRESHOLD) {
      computedState = 'SHIFT';
    }

    if (computedState === 'NORMAL' && lastComputedStateRef.current === 'ALERT') {
      computedState = 'RECOVERY';
    }

    if (baseline) {
      setDeviations({
        hr: hrDeviation.status,
        temp: tempDeviation.status,
        sweat: sweatDeviation.status,
      });
    } else {
      setDeviations(null);
    }

    const derived: MonitoringData = {
      heart_rate: heartRate,
      skin_temp: skinTemp,
      sweat_level: sweatLevel,
      state: computedState,
      time: latestData.created_at ? latestData.created_at.getTime() : Date.now(),
      baseline_hr: activeBaseline.hr,
      baseline_temp: activeBaseline.temp,
      baseline_sweat: activeBaseline.sweat,
    };

    setCurrentData(derived);
    setHrData((prevData) => [...prevData, createDataPoint(derived, 'hr')].slice(-100));
    setTempData((prevData) => [...prevData, createDataPoint(derived, 'temp')].slice(-100));
    setSweatData((prevData) => [...prevData, createDataPoint(derived, 'sweat')].slice(-100));

    const newEvents = detectEvents(derived, previousDataRef.current);
    if (newEvents.length > 0) {
      setEvents((prevEvents) => [...newEvents, ...prevEvents].slice(0, 50));
    }

    if (baseline && computedState === 'NORMAL') {
      normalStreakRef.current += 1;
      if (normalStreakRef.current >= NORMAL_ADAPT_START) {
        setBaseline((prev) => {
          if (!prev) return prev;
          return {
            hr: prev.hr * (1 - BASELINE_BLEND) + heartRate * BASELINE_BLEND,
            temp: prev.temp * (1 - BASELINE_BLEND) + skinTemp * BASELINE_BLEND,
            sweat: prev.sweat * (1 - BASELINE_BLEND) + sweatLevel * BASELINE_BLEND,
          };
        });
      }
    } else {
      normalStreakRef.current = 0;
    }

    lastComputedStateRef.current = computedState;
    previousDataRef.current = derived;
  }, [latestData]);

  useEffect(() => {
    setIsConnected(true);
  }, []);

  const currentState = currentData?.state || 'NORMAL';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-md border-b-4 border-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-10 h-10 text-slate-900" strokeWidth={2.5} />
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Lo</span>
                  <Heart className="w-7 h-7 text-red-500 animate-heartbeat" aria-hidden="true" />
                  <span>Sugar</span>
                </h1>
                <p className="text-sm text-slate-600 font-medium">Real-Time Physiological Monitoring</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-semibold">
                <Signal className="w-4 h-4" />
                {isConnected ? 'ESP32 Connected' : 'Disconnected'}
              </div>
              <button
                onClick={() => signOut(auth)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <section className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Latest Health Data</h2>
            <p className="text-sm text-slate-500 mb-4">
              Live monitoring from the shared dashboard feed
            </p>

            {isLatestLoading ? (
              <div className="text-slate-600">Loading health data...</div>
            ) : latestError ? (
              <div className="text-red-600">{latestError}</div>
            ) : !latestData ? (
              <div className="text-slate-600">Waiting for incoming data...</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm text-slate-500">Heart Rate</div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {latestData.heart_rate ?? '—'} BPM
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm text-slate-500">Skin Temp</div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {latestData.skin_temp ?? '—'} °C
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm text-slate-500">Sweat Level</div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {latestData.sweat_level ?? '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm text-slate-500">State</div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {latestData.state ?? '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm text-slate-500">Timestamp</div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {latestData.created_at ? latestData.created_at.toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Live Stream</h3>
              <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-xs text-emerald-200">
                {recentReadings.length === 0 ? (
                  <div className="text-emerald-300">Waiting for incoming data...</div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono">
                    {recentReadings
                      .flatMap((row) => formatSerialLines(row))
                      .join('\n')}
                  </pre>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-slate-500">Patient Overview</p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">{patientName}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>Device ID: {deviceId}</span>
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    {isConnected ? 'Wearable Online' : 'Wearable Offline'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${stateBadgeStyles[currentState]}`}>
                  <ShieldCheck className="w-4 h-4" />
                  {stateLabels[currentState]}
                </span>
                <span className="text-xs text-slate-500">System state updated in real time</span>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-slate-500">Personal Baseline (Normal)</p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">Baseline Profile</h2>
                <div className="mt-2 text-sm text-slate-600">
                  {baselineStatus === 'waiting' && 'Waiting for incoming data...'}
                  {baselineStatus === 'learning' && `Learning baseline... (${baselineCount}/${BASELINE_WINDOW})`}
                  {baselineStatus === 'ready' && 'Baseline established'}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Baseline HR</div>
                  <div className="text-xl font-semibold text-slate-900">
                    {baseline ? baseline.hr.toFixed(0) : '—'} BPM
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Baseline Temp</div>
                  <div className="text-xl font-semibold text-slate-900">
                    {baseline ? baseline.temp.toFixed(1) : '—'} °C
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Baseline Sweat</div>
                  <div className="text-xl font-semibold text-slate-900">
                    {baseline ? baseline.sweat.toFixed(0) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-slate-900"></div>
              Live Physiological Metrics
            </h2>
            <LiveStatusPanel data={currentData} deviations={deviations} />
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-slate-900"></div>
              Trend Visualization
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <TrendGraph
                title="Heart Rate vs Time"
                data={hrData}
                unit="BPM"
                color="#ef4444"
              />
              <TrendGraph
                title="Skin Temperature vs Time"
                data={tempData}
                unit="°C"
                color="#f97316"
              />
              <TrendGraph
                title="Sweat Level vs Time"
                data={sweatData}
                unit="Conductivity"
                color="#3b82f6"
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-slate-900"></div>
              Explainability Event Timeline
            </h2>
            <EventTimeline events={events} />
          </section>

          <section className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-slate-800">Safety Disclaimer</h3>
            <p className="text-sm text-slate-600 mt-2">
              This system does not provide medical diagnosis. It visualizes physiological response patterns associated with hypoglycemia risk.
            </p>
          </section>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-slate-600">
          <p className="font-medium inline-flex items-center justify-center gap-2">
            <span>Lo</span>
            <Heart className="w-4 h-4 text-red-500 animate-heartbeat" aria-hidden="true" />
            <span>Sugar Edge Intelligence System</span>
          </p>
          <p className="text-slate-500 mt-1">
            Demonstrating personalized baselines and explainable system behavior
          </p>
        </div>
      </footer>
    </div>
  );
}
