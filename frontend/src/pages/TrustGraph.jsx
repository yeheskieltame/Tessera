import { useState, useRef, useCallback } from 'react'
import GlassCard from '../components/GlassCard'
import DataTable from '../components/DataTable'
import ProgressStepper from '../components/ProgressStepper'
import { streamTrustGraph, getTrustGraph } from '../api'

const TRUST_STEPS = [
  { id: 'fetch', label: 'Fetching Allocation Data' },
  { id: 'graph', label: 'Building Trust Graph' },
  { id: 'metrics', label: 'Computing Trust Metrics' },
  { id: 'ai', label: 'AI Risk Analysis' },
]

export default function TrustGraph() {
  const [epoch, setEpoch] = useState(5)
  const [useStreaming, setUseStreaming] = useState(true)
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const cleanupRef = useRef(null)

  const updateStep = useCallback((stepId, updates) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s))
  }, [])

  const setNextRunning = useCallback((afterStepId) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === afterStepId)
      if (idx >= 0 && idx + 1 < prev.length) {
        return prev.map((s, i) => i === idx + 1 ? { ...s, status: 'running' } : s)
      }
      return prev
    })
  }, [])

  const handleAnalyze = () => {
    setRunning(true)
    setError(null)
    setResult(null)

    if (!useStreaming) {
      getTrustGraph(epoch)
        .then(setResult)
        .catch(err => setError(err.message))
        .finally(() => setRunning(false))
      return
    }

    const initialSteps = TRUST_STEPS.map((d, i) => ({
      ...d,
      status: i === 0 ? 'running' : 'pending',
      summary: i === 0 ? 'Running...' : 'Pending',
      content: null,
    }))
    setSteps(initialSteps)

    cleanupRef.current = streamTrustGraph(
      epoch,
      (progress) => {
        const { step, status, summary, data } = progress
        if (step && status) {
          updateStep(step, {
            status,
            summary: summary || undefined,
            content: data ? (
              <pre className="text-xs text-white/60 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
            ) : undefined,
          })
          if (status === 'done') setNextRunning(step)
        }
      },
      (res) => {
        setResult(res)
        setRunning(false)
        setSteps(prev => prev.map(s => s.status !== 'done' ? { ...s, status: 'done', summary: 'Complete' } : s))
      },
      (err) => {
        setError(typeof err === 'string' ? err : 'Connection lost.')
        setRunning(false)
        setSteps(prev => prev.map(s =>
          s.status === 'running' ? { ...s, status: 'error', summary: 'Error' } : s
        ))
      }
    )
  }

  const handleCancel = () => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    setRunning(false)
  }

  const nodeColumns = [
    { header: 'Project', key: 'name', render: r => r.name || r.address?.slice(0, 12) + '...' },
    { header: 'Donors', key: 'donors' },
    { header: 'Whale %', key: 'whalePercent', render: r => r.whalePercent != null ? `${(r.whalePercent * 100).toFixed(1)}%` : '-' },
    { header: 'Diversity', key: 'diversity', render: r => r.diversity?.toFixed(3) ?? '-' },
    { header: 'Risk', key: 'risk', render: r => (
      <span className={r.risk === 'high' ? 'text-red-300' : r.risk === 'medium' ? 'text-amber-300' : 'text-emerald-300'}>
        {r.risk ?? '-'}
      </span>
    )},
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Trust Graph</h1>
        <p className="text-sm text-white/50">Donor-project trust relationships, whale detection, and sybil risk analysis.</p>
      </div>

      <GlassCard hover={false}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Epoch</label>
            <input
              type="number"
              min={1} max={10}
              value={epoch}
              onChange={e => setEpoch(Number(e.target.value))}
              disabled={running}
              className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/60 pb-2">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={e => setUseStreaming(e.target.checked)}
              className="rounded"
            />
            Stream progress
          </label>
          {running ? (
            <button onClick={handleCancel} className="bg-red-500/80 hover:bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
          ) : (
            <button onClick={handleAnalyze} disabled={running} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
              Build Graph
            </button>
          )}
        </div>
      </GlassCard>

      {useStreaming && steps.length > 0 && (
        <GlassCard hover={false}>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Progress</h2>
          <ProgressStepper steps={steps} />
        </GlassCard>
      )}

      {!useStreaming && running && (
        <div className="flex flex-col items-center py-12">
          <div className="w-8 h-8 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
          <p className="text-white/50 text-sm mt-3">Building trust graph...</p>
        </div>
      )}

      {error && (
        <GlassCard hover={false}>
          <p className="text-red-300 text-sm">{error}</p>
        </GlassCard>
      )}

      {result && (
        <>
          {result.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Nodes', value: result.summary.totalNodes },
                { label: 'Total Edges', value: result.summary.totalEdges },
                { label: 'Avg Diversity', value: result.summary.avgDiversity?.toFixed(3) },
                { label: 'High Risk', value: result.summary.highRiskCount },
              ].filter(s => s.value != null).map(s => (
                <GlassCard key={s.label} hover={false} className="py-4 text-center">
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-white/50 mt-1">{s.label}</div>
                </GlassCard>
              ))}
            </div>
          )}

          <GlassCard hover={false}>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Project Trust Profiles</h2>
            <DataTable
              columns={nodeColumns}
              data={result.nodes || result.projects || []}
              emptyMessage="No trust data available."
            />
          </GlassCard>

          {result.aiAnalysis && (
            <GlassCard hover={false}>
              <h2 className="text-sm font-semibold text-blue-300/80 uppercase tracking-wider mb-3">AI Risk Analysis</h2>
              <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{result.aiAnalysis}</pre>
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}
