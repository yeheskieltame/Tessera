const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// --- Quick operations (regular fetch) ---

export async function getStatus() {
  return fetch(`${API}/api/status`).then(r => r.json());
}

export async function getProjects(epoch) {
  return fetch(`${API}/api/projects?epoch=${epoch || 5}`).then(r => r.json());
}

export async function getEpochAnalysis(epoch) {
  return fetch(`${API}/api/analyze-epoch?epoch=${epoch}`).then(r => r.json());
}

export async function getReports() {
  return fetch(`${API}/api/reports`).then(r => r.json());
}

export function getReportUrl(filename) {
  return `${API}/api/reports/${filename}`;
}

// --- Long operations (SSE streaming) ---

export function streamAnalyzeProject(address, epoch, onProgress, onDone, onError) {
  const params = new URLSearchParams({ address });
  if (epoch) params.set('epoch', epoch);

  const source = new EventSource(`${API}/api/analyze-project/stream?${params}`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.step === 'done') {
        onDone(data.result);
        source.close();
      } else {
        onProgress(data);
      }
    } catch (err) {
      onError(err);
      source.close();
    }
  };

  source.onerror = (err) => {
    onError(err);
    source.close();
  };

  return () => source.close();
}

export function streamTrustGraph(epoch, onProgress, onDone, onError) {
  const params = new URLSearchParams({ epoch: String(epoch) });

  const source = new EventSource(`${API}/api/trust-graph/stream?${params}`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.step === 'done') {
        onDone(data.result);
        source.close();
      } else {
        onProgress(data);
      }
    } catch (err) {
      onError(err);
      source.close();
    }
  };

  source.onerror = (err) => {
    onError(err);
    source.close();
  };

  return () => source.close();
}

export function streamSimulation(epoch, params, onProgress, onDone, onError) {
  const searchParams = new URLSearchParams({ epoch: String(epoch), ...params });

  const source = new EventSource(`${API}/api/simulate/stream?${searchParams}`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.step === 'done') {
        onDone(data.result);
        source.close();
      } else {
        onProgress(data);
      }
    } catch (err) {
      onError(err);
      source.close();
    }
  };

  source.onerror = (err) => {
    onError(err);
    source.close();
  };

  return () => source.close();
}

// --- Fallback fetch versions (for non-streaming endpoints) ---

export async function getTrustGraph(epoch) {
  return fetch(`${API}/api/trust-graph?epoch=${epoch}`).then(r => r.json());
}

export async function getSimulation(epoch) {
  return fetch(`${API}/api/simulate?epoch=${epoch}`).then(r => r.json());
}

export async function analyzeProject(address, epoch) {
  return fetch(`${API}/api/analyze-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, epoch })
  }).then(r => r.json());
}
