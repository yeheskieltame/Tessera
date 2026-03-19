import { useState } from 'react'
import GlassCard from '../components/GlassCard'
import DataTable from '../components/DataTable'
import LoadingSpinner from '../components/LoadingSpinner'
import { getEpochAnalysis } from '../api'

export default function AnalyzeEpoch() {
  const [epoch, setEpoch] = useState(5)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAnalyze = () => {
    setLoading(true)
    setError(null)
    setData(null)
    getEpochAnalysis(epoch)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  const projectColumns = [
    { header: 'Project', key: 'name' },
    { header: 'Score', key: 'compositeScore', render: r => (r.compositeScore ?? r.score ?? '-').toString().slice(0, 5) },
    { header: 'Cluster', key: 'cluster', render: r => r.cluster ?? '-' },
    { header: 'Allocated (ETH)', key: 'allocated', render: r => r.allocated ?? r.totalAllocated ?? '-' },
    { header: 'Matched (ETH)', key: 'matched', render: r => r.matched ?? r.totalMatched ?? '-' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Epoch Analysis</h1>
        <p className="text-sm text-white/50">Quantitative analysis: K-means clustering, composite scoring, anomaly detection.</p>
      </div>

      <GlassCard hover={false}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Epoch</label>
            <input
              type="number"
              min={1}
              max={10}
              value={epoch}
              onChange={e => setEpoch(Number(e.target.value))}
              className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </GlassCard>

      {loading && <LoadingSpinner text={`Analyzing epoch ${epoch}...`} />}
      {error && (
        <GlassCard hover={false}>
          <p className="text-red-300 text-sm">Error: {error}</p>
        </GlassCard>
      )}

      {data && (
        <>
          {data.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Projects', value: data.summary.totalProjects ?? data.projects?.length ?? '-' },
                { label: 'Total Allocated', value: data.summary.totalAllocated ?? '-' },
                { label: 'Total Matched', value: data.summary.totalMatched ?? '-' },
                { label: 'Clusters', value: data.summary.numClusters ?? '-' },
              ].map(s => (
                <GlassCard key={s.label} hover={false} className="py-4 text-center">
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-white/50 mt-1">{s.label}</div>
                </GlassCard>
              ))}
            </div>
          )}

          <GlassCard hover={false}>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Projects</h2>
            <DataTable
              columns={projectColumns}
              data={data.projects || data.results || []}
              emptyMessage="No projects found in this epoch."
            />
          </GlassCard>

          {data.anomalies && data.anomalies.length > 0 && (
            <GlassCard hover={false}>
              <h2 className="text-sm font-semibold text-amber-300/80 uppercase tracking-wider mb-3">Anomalies Detected</h2>
              <div className="space-y-2">
                {data.anomalies.map((a, i) => (
                  <div key={i} className="text-sm text-white/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
                    <span className="font-medium text-amber-300">{a.project || a.name}:</span>{' '}
                    {a.reason || a.description}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}
