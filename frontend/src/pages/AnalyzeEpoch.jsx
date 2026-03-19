import { useState } from 'react'
import GlassCard from '../components/GlassCard'
import DataTable from '../components/DataTable'
import LoadingSpinner from '../components/LoadingSpinner'
import { getEpochAnalysis } from '../api'

const columns = [
  { header: 'Rank', render: (_, i) => i + 1, key: '_rank' },
  { header: 'Project', key: 'name' },
  { header: 'Score', render: row => (row.score ?? 0).toFixed(2) },
  { header: 'Cluster', key: 'cluster' },
  {
    header: 'Allocated (ETH)',
    render: row => (row.allocated ?? 0).toFixed(4),
  },
  {
    header: 'Matched (ETH)',
    render: row => (row.matched ?? 0).toFixed(4),
  },
]

// Fix: DataTable doesn't pass index, so add rank from data
const columnsWithRank = [
  { header: '#', render: row => row._rank },
  { header: 'Project', key: 'name' },
  { header: 'Score', render: row => (row.score ?? 0).toFixed(2) },
  { header: 'Cluster', key: 'cluster' },
  { header: 'Allocated (ETH)', render: row => (row.allocated ?? 0).toFixed(4) },
  { header: 'Matched (ETH)', render: row => (row.matched ?? 0).toFixed(4) },
]

export default function AnalyzeEpoch() {
  const [epoch, setEpoch] = useState(5)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    try {
      const result = await getEpochAnalysis(epoch)
      if (result.error) throw new Error(result.error)
      // Add rank
      const projects = (result.projects || []).map((p, i) => ({ ...p, _rank: i + 1 }))
      setData({ ...result, projects })
    } catch (err) {
      setError(err.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Analyze Epoch</h1>
        <p className="text-white/50">
          Quantitative analysis with K-means clustering and composite scoring
        </p>
      </div>

      <GlassCard hover={false}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">
              Epoch Number
            </label>
            <input
              type="number"
              min={1}
              value={epoch}
              onChange={e => setEpoch(Number(e.target.value))}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white w-28 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl px-6 py-2.5 font-medium transition-colors"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </GlassCard>

      {loading && <LoadingSpinner text="Analyzing epoch data..." />}

      {error && (
        <GlassCard hover={false} className="border-red-500/30 bg-red-500/10">
          <p className="text-red-300">{error}</p>
        </GlassCard>
      )}

      {data && !loading && (
        <GlassCard hover={false}>
          <h2 className="text-lg font-semibold text-white mb-4">
            Epoch {data.epoch} Results
            {data.total_projects && (
              <span className="text-sm text-white/50 font-normal ml-2">
                ({data.total_projects} projects)
              </span>
            )}
          </h2>
          <DataTable columns={columnsWithRank} data={data.projects} />
        </GlassCard>
      )}
    </div>
  )
}
