import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import GlassCard from '../components/GlassCard'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import { getStatus } from '../api'

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { to: '/analyze-epoch', title: 'Epoch Analysis', desc: 'Quantitative analysis with K-means clustering, composite scoring, and anomaly detection across Octant epochs.' },
    { to: '/analyze-project', title: 'Project Deep-Dive', desc: 'Comprehensive project evaluation with funding history, trust profiling, and AI-powered qualitative analysis.' },
    { to: '/trust-graph', title: 'Trust Graph', desc: 'Visualize donor-project relationships, whale concentration, and sybil risk indicators.' },
    { to: '/simulate', title: 'Mechanism Simulator', desc: 'Run what-if scenarios on funding mechanisms: quadratic, linear, and custom parameter tweaks.' },
  ]

  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
          Tessera
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto">
          AI-powered public goods evaluation agent for the Ethereum ecosystem.
          Quantitative analytics, trust profiling, and qualitative AI assessment.
        </p>
      </div>

      <GlassCard hover={false}>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">System Status</h2>
        {loading ? (
          <LoadingSpinner size="sm" text="Checking connections..." />
        ) : error ? (
          <div className="text-red-300 text-sm">Failed to connect: {error}</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {status?.providers && (
              <StatusBadge color="green">
                {status.providers.filter(p => p.available).length} AI Providers
              </StatusBadge>
            )}
            {status?.dataSources && Object.entries(status.dataSources).map(([name, ok]) => (
              <StatusBadge key={name} color={ok ? 'green' : 'red'}>
                {name}
              </StatusBadge>
            ))}
            {!status?.providers && !status?.dataSources && (
              <StatusBadge color="green">Backend Connected</StatusBadge>
            )}
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(card => (
          <Link key={card.to} to={card.to} className="no-underline">
            <GlassCard className="h-full">
              <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{card.desc}</p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  )
}
