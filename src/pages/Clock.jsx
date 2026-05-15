import { useEffect, useState, useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { api } from '../utils/api';

const STATUS_META = {
  'clocked-in':   { label: 'Clocked in',     color: 'bg-emerald-500' },
  'on-break':     { label: 'On break',       color: 'bg-amber-500'   },
  'clocked-out':  { label: 'Clocked out',    color: 'bg-gray-400'    },
  'not-clocked-in': { label: 'Not clocked in', color: 'bg-gray-400'  },
};

export default function Clock() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/clock/user/status');
      setStatus(data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function clockIn() {
    setActing(true);
    setError('');
    try {
      await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      await api.post('/clock/user/in', { workType: 'office' });
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Clock in failed');
    } finally {
      setActing(false);
    }
  }

  async function clockOut() {
    setActing(true);
    setError('');
    try {
      await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      await api.post('/clock/user/out', {});
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Clock out failed');
    } finally {
      setActing(false);
    }
  }

  const currentStatus = status?.status || 'not-clocked-in';
  const meta = STATUS_META[currentStatus] || STATUS_META['not-clocked-in'];
  const isActive = currentStatus === 'clocked-in' || currentStatus === 'on-break';

  const elapsed = status?.clockIn && isActive
    ? formatElapsed(now - new Date(status.clockIn).getTime())
    : null;

  return (
    <div className="flex h-full flex-col">
      <header className="bg-brand px-4 pb-6 pt-4 text-white">
        <h1 className="text-xl font-semibold">Time Clock</h1>
      </header>

      <div className="-mt-4 flex-1 px-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {loading ? (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.color}`} />
                <span className="text-sm font-medium text-gray-700">{meta.label}</span>
              </div>

              <div className="mt-6 text-center">
                <div className="text-5xl font-bold tabular-nums tracking-tight text-gray-900">
                  {elapsed || '00:00:00'}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {status?.clockIn
                    ? `Since ${new Date(status.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Tap below to start your shift'}
                </div>
              </div>

              <div className="mt-8">
                {isActive ? (
                  <button
                    onClick={clockOut}
                    disabled={acting}
                    className="w-full rounded-xl bg-red-500 py-4 text-base font-semibold text-white shadow-sm transition active:bg-red-600 disabled:opacity-60"
                  >
                    {acting ? 'Clocking out…' : 'Clock out'}
                  </button>
                ) : (
                  <button
                    onClick={clockIn}
                    disabled={acting}
                    className="w-full rounded-xl bg-brand py-4 text-base font-semibold text-white shadow-sm transition active:bg-brand-dark disabled:opacity-60"
                  >
                    {acting ? 'Clocking in…' : 'Clock in'}
                  </button>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
