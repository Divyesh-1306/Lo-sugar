import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Heart, LogOut, ShieldCheck, Signal } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import LiveStatusPanel from '../components/LiveStatusPanel';
import TrendGraph from '../components/TrendGraph';
import EventTimeline from '../components/EventTimeline';
import { MonitoringData, Event, DataPoint } from '../types/monitoring';
import { createDataPoint } from '../utils/dataProcessor';
import { supabase } from '../utils/supabaseClient';

interface DashboardProps {
  user?: User;
}

type LatestHealthRow = {
  heart_rate: number | null;
  skin_temp: number | null;
  sweat_level: string | null;
  state: string | null;
  created_at: string | null;
};

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
  const [currentUser, setCurrentUser] = useState<User | null>(user ?? null);
  const [currentData, setCurrentData] = useState<MonitoringData | null>(null);
  const [hrData, setHrData] = useState<DataPoint[]>([]);
  const [tempData, setTempData] = useState<DataPoint[]>([]);
  const [sweatData, setSweatData] = useState<DataPoint[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [latestData, setLatestData] = useState<LatestHealthRow | null>(null);
  const [recentReadings, setRecentReadings] = useState<LatestHealthRow[]>([]);
  const [isLatestLoading, setIsLatestLoading] = useState(true);
  const [latestError, setLatestError] = useState<string | null>(null);

  const previousDataRef = useRef<MonitoringData | null>(null);
  const lastAlertSentRef = useRef<number | null>(null);
  const lastDbStateRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setCurrentUser(data.user ?? user ?? null);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const patientName = useMemo(() => {
    return currentUser?.email || 'Shared Dashboard';
  }, [currentUser]);

  const deviceId = import.meta.env.VITE_DEVICE_ID || 'ESP32-EDGE-001';

  useEffect(() => {
    let isMounted = true;

    const fetchInitialData = async () => {
      setIsLatestLoading(true);
      setLatestError(null);

      const { data, error } = await supabase
        .from('health_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('Fetched data:', data);
      console.log('Fetch error:', error);

      if (!isMounted) return;

      if (error) {
        setLatestError(error.message);
        setLatestData(null);
        setRecentReadings([]);
      } else {
        const rows = (data ?? []) as LatestHealthRow[];
        setRecentReadings(rows);
        setLatestData(rows[0] ?? null);
      }

      setIsLatestLoading(false);
    };

    void fetchInitialData();

    const channel = supabase
      .channel('health-data-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'health_data' },
        (payload) => {
          const newRow = payload.new as LatestHealthRow;
          setRecentReadings((prev) => [newRow, ...prev].slice(0, 20));
          setLatestData(newRow);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!latestData) return;

    const derived: MonitoringData = {
      heart_rate: latestData.heart_rate ?? 0,
      skin_temp: latestData.skin_temp ?? 0,
      sweat_level: Number(latestData.sweat_level) || 0,
      state: (latestData.state as MonitoringData['state']) || 'NORMAL',
      time: latestData.created_at ? new Date(latestData.created_at).getTime() : Date.now(),
      baseline_hr: 70,
      baseline_temp: 36.5,
      baseline_sweat: 0,
    };

    setCurrentData(derived);
    setHrData((prevData) => [...prevData, createDataPoint(derived, 'hr')].slice(-100));
    setTempData((prevData) => [...prevData, createDataPoint(derived, 'temp')].slice(-100));
    setSweatData((prevData) => [...prevData, createDataPoint(derived, 'sweat')].slice(-100));

    const nextState = latestData.state ?? 'NORMAL';
    if (lastDbStateRef.current && lastDbStateRef.current !== nextState) {
      setEvents((prevEvents) => [
        {
          id: `${Date.now()}-${nextState}`,
          timestamp: Date.now(),
          type: 'STATE_CHANGE',
          message: `State changed to ${nextState}`,
        },
        ...prevEvents,
      ].slice(0, 50));
    }
    lastDbStateRef.current = nextState;
  }, [latestData]);

  const sendAlertEmail = async (payload: MonitoringData, detectedEvents: Event[]) => {
    if (!currentUser?.email) return;

    const now = new Date();
    const alertData = {
      to: currentUser.email,
      timestamp: now.toISOString(),
      state: payload.state,
      heart_rate: payload.heart_rate,
      skin_temp: payload.skin_temp,
      sweat_level: payload.sweat_level,
      events: detectedEvents.map((event) => event.message),
      disclaimer: 'This alert is generated by a research dashboard and is not a medical diagnosis.',
    };

    const { error } = await supabase.functions.invoke('send-alert-email', {
      body: alertData,
    });

    if (error) {
      setEmailStatus('Alert email failed to send.');
    } else {
      setEmailStatus('Alert email sent.');
    }
  };

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
                onClick={() => supabase.auth.signOut()}
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
                    {latestData.created_at
                      ? new Date(latestData.created_at).toLocaleString()
                      : '—'}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Live Stream</h3>
              <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {recentReadings.length === 0 ? (
                  <div className="text-slate-500">Waiting for incoming data...</div>
                ) : (
                  <div className="space-y-2">
                    {recentReadings.map((row, index) => (
                      <div key={`${row.created_at ?? 'row'}-${index}`} className="flex flex-wrap gap-3">
                        <span className="text-slate-500">
                          {row.created_at ? new Date(row.created_at).toLocaleTimeString() : '—'}
                        </span>
                        <span>HR: {row.heart_rate ?? '—'} BPM</span>
                        <span>Temp: {row.skin_temp ?? '—'} °C</span>
                        <span>Sweat: {row.sweat_level ?? '—'}</span>
                        <span>State: {row.state ?? '—'}</span>
                      </div>
                    ))}
                  </div>
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

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-slate-900"></div>
              Live Physiological Metrics
            </h2>
            <LiveStatusPanel data={currentData} />
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
            <h3 className="text-lg font-semibold text-slate-800">Alert & Notification System</h3>
            <p className="text-sm text-slate-600 mt-2">
              When the system enters the ALERT state, an email notification is sent to the logged-in user via Supabase SMTP.
            </p>
            <div className="mt-3 text-sm text-slate-700">
              Status: {emailStatus || 'Standing by'}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Safety disclaimer: This system does not provide medical diagnosis. It visualizes physiological response patterns associated with hypoglycemia risk.
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
