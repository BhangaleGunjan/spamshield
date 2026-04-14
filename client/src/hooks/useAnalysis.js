import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 20; // ~30 seconds

export function useAnalysis() {
  const [state, setState] = useState({
    status: 'idle', // idle | submitting | pending | complete | failed
    id: null,
    result: null,
    error: null,
    cached: false,
  });

  const pollRef = useRef(null);
  const pollCount = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollResult = useCallback((id) => {
    pollCount.current = 0;

    pollRef.current = setInterval(async () => {
      pollCount.current++;

      if (pollCount.current > MAX_POLLS) {
        stopPolling();
        setState((s) => ({ ...s, status: 'failed', error: 'Analysis timed out. Please try again.' }));
        return;
      }

      try {
        const { data } = await axios.get(`${API_BASE}/api/result/${id}`);

        if (data.status === 'complete') {
          stopPolling();
          setState({
            status: 'complete',
            id,
            result: data.result,
            error: null,
            cached: false,
          });
        } else if (data.status === 'failed') {
          stopPolling();
          setState({
            status: 'failed',
            id,
            result: null,
            error: data.error || 'Analysis failed.',
            cached: false,
          });
        }
        // If still 'pending' or 'processing', keep polling
      } catch (err) {
        stopPolling();
        setState((s) => ({
          ...s,
          status: 'failed',
          error: err.response?.data?.error || 'Failed to fetch result.',
        }));
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const analyze = useCallback(async (url) => {
    stopPolling();
    setState({ status: 'submitting', id: null, result: null, error: null, cached: false });

    try {
      const { data } = await axios.post(`${API_BASE}/api/analyze`, { url });

      if (data.status === 'complete') {
        setState({
          status: 'complete',
          id: data.id,
          result: data.result,
          error: null,
          cached: data.cached || false,
        });
      } else {
        setState((s) => ({ ...s, status: 'pending', id: data.id }));
        pollResult(data.id);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit URL for analysis.';
      setState({ status: 'failed', id: null, result: null, error: msg, cached: false });
    }
  }, [pollResult]);

  const reset = useCallback(() => {
    stopPolling();
    setState({ status: 'idle', id: null, result: null, error: null, cached: false });
  }, []);

  return { ...state, analyze, reset };
}
