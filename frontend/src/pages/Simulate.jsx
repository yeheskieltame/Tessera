import { useState } from 'react'
import GlassCard from '../components/GlassCard'
import DataTable from '../components/DataTable'
import LoadingSpinner from '../components/LoadingSpinner'
import { getSimulation } from '../api'

const mechanismColumns = [
  { header: 'Mechanism', key: 'name' },
  { header: 'Gini Index', render: row => (row.gini ?? 0).toFixed(4) },
  { header: 'Top 10% Share', render: row => `${((row.top_share ?? 0) * 100).toFixed(1)}%` },
  { header: 'Above Threshold', render: row => row.above_threshold ?? '--' },
]

const projectColumns = [
  { header: 'Project', key: 'name' },
  { header: 'Standard QF', render: row => (row.standard_qf ?? 0).toFixed(4) },
  { header: 'Capped', render: row => (row.capped ?? 0).toFixed(4) },
  { header: 'Equal', render: row => (row.equal ?? 0).toFixed(4) },
  { header: 'Trust-Weighted', render: row => (row.trust_weighted ?? 0).toFixed(4) },
]

export default function Simulate() {
  const [epoch, setEpoch] = useState(5)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSimulate() {
    setLoading(true)
    setError(null)
    try {
      const result = await getSimulation(epoch)
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
        <h1 className="text-3xl font-bold text-white mb-2">Mechanism Simulation</h1>
        <p className="text-white/50">
          Compare funding mechanisms: Standard QF, Capped, Equal, Trust-Weighted
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
            onClick={handleSimulate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl px-6 py-2.5 font-medium transition-colors"
          >
            {loading ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>
      </GlassCard>

      {loading && <LoadingSpinner text="Running simulations..." />}

      {error && (
        <GlassCard hover={false} className="border-red-500/30 bg-red-500/10">
          <p className="text-red-300">{error}</p>
        </GlassCard>
      )}

      {data && !loading && (
        <>
          <GlassCard hover={false}>
            <h2 className="text-lg font-semibold text-white mb-4">Mechanism Comparison</h2>
            <DataTable columns={mechanismColumns} data={data.mechanisms} />
          </GlassCard>

          {data.projects && data.projects.length > 0 && (
            <GlassCard hover={false}>
              <h2 className="text-lg font-semibold text-white mb-4">Per-Project Impact (ETH)</h2>
              <DataTable columns={projectColumns} data={data.projects} />
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}
