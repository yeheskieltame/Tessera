import { useState, useRef, useCallback } from 'react'
import GlassCard from '../components/GlassCard'
import DataTable from '../components/DataTable'
import ProgressStepper from '../components/ProgressStepper'
import { streamSimulation, getSimulation } from '../api'

const SIM_STEPS = [
  { id: 'load', label: 'Loading Epoch Data' },
  { id: 'baseline', label: 'Running Baseline (Quadratic)' },
  { id: 'scenarios', label: 'Running Alternative Scenarios' },
  { id: 'ai', label: 'AI Comparison Analysis' },
]

export default function Simulate() {
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

  const handleRun = () => {
    setRunning(true)
    setError(null)
    setResult(null)

    if (!useStreaming) {
      getSimulation(epoch)
        .then(setResult)
        .catch(err => setError(err.message))
        .finally(() => setRunning(false))
      return
    }

    const initialSteps = SIM_STEPS.map((d, i) => ({
      ...d,
      status: i === 0 ? 'running' : 'pending',
      summary: i === 0 ? 'Running...' : 'Pending',
      content: null,
    }))
    setSteps(initialSteps)

    cleanupRef.current = streamSimulation(
      epoch,
      {},
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

  const scenarioColumns = [
    { header: 'Mechanism', key: 'mechanism' },
    { header: 'Total Distributed', key: 'totalDistributed' },
    { header: 'Gini', key: 'gini', render: r => r.gini?.toFixed(3) ?? '-' },
    { header: 'Top Project Share', key: 'topShare', render: r => r.topShare ? `${(r.topShare * 100).toFixed(1)}%` : '-' },
    { header: 'Projects Funded', key: 'projectsFunded' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Mechanism Simulator</h1>
        <p className="text-sm text-white/50">Compare funding mechanisms: quadratic, linear, and custom parameters.</p>
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
            <button onClick={handleRun} disabled={running} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
              Run Simulation
            </button>
          )}
        </div>
      </GlassCard>

      {useStreaming && steps.length > 0 && (
        <GlassCard hover={false}>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Simulation Progress</h2>
          <ProgressStepper steps={steps} />
        </GlassCard>
      )}

      {!useStreaming && running && (
        <div className="flex flex-col items-center py-12">
          <div className="w-8 h-8 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
          <p className="text-white/50 text-sm mt-3">Running simulation...</p>
        </div>
      )}

      {error && (
        <GlassCard hover={false}>
          <p className="text-red-300 text-sm">{error}</p>
        </GlassCard>
      )}

      {result && (
        <>
          <GlassCard hover={false}>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Scenario Comparison</h2>
            <DataTable
              columns={scenarioColumns}
              data={result.scenarios || []}
              emptyMessage="No simulation results."
            />
          </GlassCard>

          {result.projectImpact && result.projectImpact.length > 0 && (
            <GlassCard hover={false}>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Project Impact Comparison</h2>
              <DataTable
                columns={[
                  { header: 'Project', key: 'name' },
                  { header: 'Quadratic', key: 'quadratic' },
                  { header: 'Linear', key: 'linear' },
                  { header: 'Delta', key: 'delta', render: r => (
                    <span className={r.delta > 0 ? 'text-emerald-300' : r.delta < 0 ? 'text-red-300' : 'text-white/50'}>
                      {r.delta > 0 ? '+' : ''}{r.delta}
                    </span>
                  )},
                ]}
                data={result.projectImpact}
              />
            </GlassCard>
          )}

          {result.aiAnalysis && (
            <GlassCard hover={false}>
              <h2 className="text-sm font-semibold text-blue-300/80 uppercase tracking-wider mb-3">AI Analysis</h2>
              <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{result.aiAnalysis}</pre>
            </GlassCard>
          )}

          {!result.scenarios && !result.aiAnalysis && (
            <GlassCard hover={false}>
              <pre className="text-xs text-white/60 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}
