import { useState } from 'react'
import GlassCard from '../components/GlassCard'
import DataTable from '../components/DataTable'
import LoadingSpinner from '../components/LoadingSpinner'
import StatusBadge from '../components/StatusBadge'
import { analyzeProject, getReportUrl } from '../api'

const fundingColumns = [
  { header: 'Epoch', key: 'epoch' },
  { header: 'Allocated (ETH)', render: row => (row.allocated ?? 0).toFixed(4) },
  { header: 'Matched (ETH)', render: row => (row.matched ?? 0).toFixed(4) },
  { header: 'Donors', key: 'donor_count' },
  { header: 'Score', render: row => (row.score ?? 0).toFixed(2) },
]

const mechanismColumns = [
  { header: 'Mechanism', key: 'name' },
  { header: 'Funding (ETH)', render: row => (row.funding ?? 0).toFixed(4) },
  { header: 'Change', render: row => {
    const pct = (row.change_pct ?? 0)
    const color = pct > 0 ? 'text-emerald-300' : pct < 0 ? 'text-red-300' : 'text-white/50'
    return <span className={color}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
  }},
]

export default function AnalyzeProject() {
  const [address, setAddress] = useState('')
  const [epoch, setEpoch] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleAnalyze() {
    if (!address.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeProject(address.trim(), epoch ? Number(epoch) : undefined)
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
        <h1 className="text-3xl font-bold text-white mb-2">Analyze Project</h1>
        <p className="text-white/50">
          Deep-dive analysis of individual project funding, trust, and mechanism impact
        </p>
      </div>

      <GlassCard hover={false}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">
              Project Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 placeholder:text-white/30"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1">
              Epoch (optional)
            </label>
            <input
              type="number"
              min={1}
              placeholder="All"
              value={epoch}
              onChange={e => setEpoch(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white w-28 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 placeholder:text-white/30"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !address.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl px-6 py-2.5 font-medium transition-colors"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </GlassCard>

      {loading && <LoadingSpinner text="Analyzing project..." />}

      {error && (
        <GlassCard hover={false} className="border-red-500/30 bg-red-500/10">
          <p className="text-red-300">{error}</p>
        </GlassCard>
      )}

      {data && !loading && (
        <>
          {/* Project header */}
          <GlassCard hover={false}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{data.name || 'Unknown Project'}</h2>
                <p className="text-white/50 text-sm font-mono">{data.address}</p>
              </div>
              {data.report_file && (
                <a
                  href={getReportUrl(data.report_file)}
                  download
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 font-medium transition-colors no-underline text-sm"
                >
                  Download PDF Report
                </a>
              )}
            </div>
          </GlassCard>

          {/* Trust profile */}
          {data.trust && (
            <GlassCard hover={false}>
              <h2 className="text-lg font-semibold text-white mb-4">Trust Profile</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider">Donors</div>
                  <div className="text-xl font-bold text-white">{data.trust.donor_count ?? '--'}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider">Diversity</div>
                  <div className="text-xl font-bold text-white">{(data.trust.diversity_score ?? 0).toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider">Whale Dep.</div>
                  <div className="text-xl font-bold text-white">{(data.trust.whale_dependency ?? 0).toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider">Flags</div>
                  <div className="mt-1">
                    {(data.trust.flags || []).length === 0 ? (
                      <StatusBadge color="green">Clean</StatusBadge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {data.trust.flags.map((f, i) => (
                          <StatusBadge key={i} color="red">{f}</StatusBadge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Funding history */}
          {data.funding_history && data.funding_history.length > 0 && (
            <GlassCard hover={false}>
              <h2 className="text-lg font-semibold text-white mb-4">Funding History</h2>
              <DataTable columns={fundingColumns} data={data.funding_history} />
            </GlassCard>
          )}

          {/* Mechanism impact */}
          {data.mechanism_impact && data.mechanism_impact.length > 0 && (
            <GlassCard hover={false}>
              <h2 className="text-lg font-semibold text-white mb-4">Mechanism Impact</h2>
              <DataTable columns={mechanismColumns} data={data.mechanism_impact} />
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}
