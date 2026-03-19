import { useState, useRef, useCallback } from 'react'
import GlassCard from '../components/GlassCard'
import DataTable from '../components/DataTable'
import ProgressStepper from '../components/ProgressStepper'
import { streamAnalyzeProject } from '../api'

const STEP_DEFS = [
  { id: 'funding', label: 'Funding History' },
  { id: 'quantitative', label: 'Quantitative Analysis' },
  { id: 'trust', label: 'Trust Profile' },
  { id: 'mechanism', label: 'Mechanism Simulation' },
  { id: 'oso', label: 'OSO Signals' },
  { id: 'ai', label: 'AI Evaluation' },
]

function renderStepContent(stepId, data) {
  if (!data) return null

  switch (stepId) {
    case 'funding':
      if (data.epochs && data.epochs.length > 0) {
        return (
          <DataTable
            columns={[
              { header: 'Epoch', key: 'epoch' },
              { header: 'Allocated (ETH)', key: 'allocated' },
              { header: 'Matched (ETH)', key: 'matched' },
              { header: 'Donors', key: 'donors' },
            ]}
            data={data.epochs}
          />
        )
      }
      return <p className="text-sm text-white/50">No funding history found.</p>

    case 'quantitative':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Rank', value: data.rank },
            { label: 'Score', value: typeof data.score === 'number' ? data.score.toFixed(1) : data.score },
            { label: 'Cluster', value: data.cluster },
            { label: 'Percentile', value: data.percentile },
          ].filter(s => s.value != null).map(s => (
            <div key={s.label} className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </div>
          ))}
        </div>
      )

    case 'trust':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Diversity Index', value: data.diversityIndex },
            { label: 'Whale Concentration', value: data.whaleConcentration ? `${(data.whaleConcentration * 100).toFixed(1)}%` : data.whalePercent },
            { label: 'Unique Donors', value: data.uniqueDonors },
            { label: 'Sybil Risk', value: data.sybilRisk },
            { label: 'Gini Coefficient', value: data.gini },
          ].filter(s => s.value != null).map(s => (
            <div key={s.label} className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{String(s.value)}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </div>
          ))}
        </div>
      )

    case 'mechanism':
      if (data.scenarios) {
        return (
          <div className="space-y-2">
            {data.scenarios.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2 text-sm">
                <span className="text-white/70">{s.name || s.mechanism}</span>
                <span className="text-white font-medium">{s.funding ?? s.result}</span>
              </div>
            ))}
          </div>
        )
      }
      return <pre className="text-xs text-white/60 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>

    case 'oso':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(data).filter(([, v]) => v != null).slice(0, 9).map(([k, v]) => (
            <div key={k} className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{typeof v === 'number' ? v.toLocaleString() : String(v)}</div>
              <div className="text-xs text-white/40">{k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      )

    case 'ai':
      return (
        <div className="space-y-3">
          {data.dimensions && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {data.dimensions.map((d, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-blue-300">{d.score}/10</div>
                  <div className="text-xs text-white/40">{d.name}</div>
                </div>
              ))}
            </div>
          )}
          {data.summary && (
            <p className="text-sm text-white/70 leading-relaxed">{data.summary}</p>
          )}
          {data.overallScore != null && (
            <div className="text-center bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-300">{data.overallScore}/100</div>
              <div className="text-xs text-white/40 mt-1">Overall AI Score</div>
            </div>
          )}
          {!data.dimensions && !data.summary && (
            <pre className="text-xs text-white/60 whitespace-pre-wrap">{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>
          )}
        </div>
      )

    default:
      return <pre className="text-xs text-white/60 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
  }
}

export default function AnalyzeProject() {
  const [address, setAddress] = useState('')
  const [epoch, setEpoch] = useState('')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState([])
  const [finalResult, setFinalResult] = useState(null)
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

  const handleStart = () => {
    if (!address.trim()) return
    setRunning(true)
    setError(null)
    setFinalResult(null)

    const initialSteps = STEP_DEFS.map((d, i) => ({
      ...d,
      status: i === 0 ? 'running' : 'pending',
      summary: i === 0 ? 'Running...' : 'Pending',
      content: null,
      data: null,
    }))
    setSteps(initialSteps)

    cleanupRef.current = streamAnalyzeProject(
      address.trim(),
      epoch || undefined,
      (progress) => {
        const { step, status, summary, data } = progress
        if (step && status) {
          updateStep(step, {
            status,
            summary: summary || (status === 'running' ? 'Running...' : undefined),
            data: data || undefined,
            content: data ? renderStepContent(step, data) : undefined,
          })
          if (status === 'done') {
            setNextRunning(step)
          }
        }
      },
      (result) => {
        setFinalResult(result)
        setRunning(false)
        setSteps(prev => prev.map(s => s.status !== 'done' ? { ...s, status: 'done', summary: s.summary || 'Complete' } : s))
      },
      (err) => {
        setError(typeof err === 'string' ? err : 'Connection lost. The analysis may still be running on the server.')
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Analyze Project</h1>
        <p className="text-sm text-white/50">Deep-dive evaluation with real-time progress streaming.</p>
      </div>

      <GlassCard hover={false}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-white/50 mb-1">Project Address / Name</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="0x... or project name"
              disabled={running}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Epoch (optional)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={epoch}
              onChange={e => setEpoch(e.target.value)}
              placeholder="Latest"
              disabled={running}
              className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-400"
            />
          </div>
          {running ? (
            <button
              onClick={handleCancel}
              className="bg-red-500/80 hover:bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={!address.trim()}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Analyze
            </button>
          )}
        </div>
      </GlassCard>

      {steps.length > 0 && (
        <GlassCard hover={false}>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Analysis Progress</h2>
          <ProgressStepper steps={steps} />
        </GlassCard>
      )}

      {error && (
        <GlassCard hover={false}>
          <p className="text-red-300 text-sm">{error}</p>
        </GlassCard>
      )}

      {finalResult && (
        <GlassCard hover={false}>
          <h2 className="text-sm font-semibold text-blue-300/80 uppercase tracking-wider mb-3">Complete Analysis</h2>
          {finalResult.overallScore != null && (
            <div className="text-center mb-4">
              <div className="text-5xl font-bold text-blue-300">{finalResult.overallScore}</div>
              <div className="text-xs text-white/40 mt-1">Overall Score</div>
            </div>
          )}
          {finalResult.report && (
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="text-xs text-white/70 whitespace-pre-wrap bg-white/5 rounded-lg p-4">{finalResult.report}</pre>
            </div>
          )}
          {!finalResult.overallScore && !finalResult.report && (
            <pre className="text-xs text-white/60 whitespace-pre-wrap">{JSON.stringify(finalResult, null, 2)}</pre>
          )}
        </GlassCard>
      )}
    </div>
  )
}
