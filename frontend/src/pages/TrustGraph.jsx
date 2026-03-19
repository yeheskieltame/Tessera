import { useState } from 'react'
import GlassCard from '../components/GlassCard'
import DataTable from '../components/DataTable'
import LoadingSpinner from '../components/LoadingSpinner'
import StatusBadge from '../components/StatusBadge'
import { getTrustGraph } from '../api'

const columns = [
  {
    header: 'Address',
    render: row => (
      <span className="font-mono text-xs">
        {row.address ? `${row.address.slice(0, 8)}...${row.address.slice(-6)}` : '--'}
      </span>
    ),
  },
  { header: 'Donors', render: row => row.donor_count ?? '--' },
  { header: 'Diversity', render: row => (row.diversity_score ?? 0).toFixed(3) },
  { header: 'Whale Dep.', render: row => (row.whale_dependency ?? 0).toFixed(3) },
  { header: 'Coord. Risk', render: row => (row.coordination_risk ?? 0).toFixed(3) },
  {
    header: 'Flags',
    render: row => {
      const flags = row.flags || []
      if (flags.length === 0) return <StatusBadge color="green">Clean</StatusBadge>
      return (
        <div className="flex flex-wrap gap-1">
          {flags.map((f, i) => (
            <StatusBadge key={i} color="red">{f}</StatusBadge>
          ))}
        </div>
      )
    },
  },
]

export default function TrustGraph() {
  const [epoch, setEpoch] = useState(5)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleFetch() {
    setLoading(true)
    setError(null)
    try {
      const result = await getTrustGraph(epoch)
      if (result.error) throw new Error(result.error)
      setData(result)
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
        <h1 className="text-3xl font-bold text-white mb-2">Trust Graph</h1>
        <p className="text-white/50">
          Sybil detection and trust profiling for Octant projects
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
            onClick={handleFetch}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl px-6 py-2.5 font-medium transition-colors"
          >
            {loading ? 'Loading...' : 'Fetch Trust Graph'}
          </button>
        </div>
      </GlassCard>

      {loading && <LoadingSpinner text="Building trust profiles..." />}

      {error && (
        <GlassCard hover={false} className="border-red-500/30 bg-red-500/10">
          <p className="text-red-300">{error}</p>
        </GlassCard>
      )}

      {data && !loading && (
        <GlassCard hover={false}>
          <h2 className="text-lg font-semibold text-white mb-4">
            Trust Profiles
            {data.profiles && (
              <span className="text-sm text-white/50 font-normal ml-2">
                ({data.profiles.length} projects)
              </span>
            )}
          </h2>
          <DataTable columns={columns} data={data.profiles} />
        </GlassCard>
      )}
    </div>
  )
}
