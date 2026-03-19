import GlassCard from '../components/GlassCard'

export default function About() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">About Tessera</h1>
        <p className="text-sm text-white/50">AI agent for public goods evaluation in the Ethereum ecosystem.</p>
      </div>

      <GlassCard hover={false}>
        <h2 className="text-lg font-semibold text-white mb-3">What is Tessera?</h2>
        <p className="text-sm text-white/70 leading-relaxed mb-4">
          Tessera is an AI-powered CLI and web tool that helps evaluators analyze public goods projects.
          It combines quantitative analytics (K-means clustering, composite scoring, anomaly detection)
          with qualitative AI assessment across 8 evaluation dimensions.
        </p>
        <p className="text-sm text-white/70 leading-relaxed">
          Built for The Synthesis Hackathon, targeting the Octant track for public goods data analysis
          and project evaluation.
        </p>
      </GlassCard>

      <GlassCard hover={false}>
        <h2 className="text-lg font-semibold text-white mb-3">Data Sources</h2>
        <div className="space-y-2">
          {[
            { name: 'Octant API', desc: 'Projects, allocations, rewards, epochs, patrons, budgets' },
            { name: 'Gitcoin Grants Stack', desc: 'Rounds, applications, donations, matching data' },
            { name: 'Open Source Observer', desc: 'GitHub metrics, on-chain activity, ecosystem data' },
          ].map(s => (
            <div key={s.name} className="flex gap-3 text-sm">
              <span className="text-blue-300 font-medium whitespace-nowrap">{s.name}</span>
              <span className="text-white/50">{s.desc}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard hover={false}>
        <h2 className="text-lg font-semibold text-white mb-3">Tech Stack</h2>
        <div className="flex flex-wrap gap-2">
          {['Go', 'React', 'Tailwind CSS', 'Vite', 'Claude Opus 4.6', 'SSE Streaming'].map(t => (
            <span key={t} className="bg-blue-500/15 text-blue-300 border border-blue-500/25 px-3 py-1 rounded-full text-xs font-medium">
              {t}
            </span>
          ))}
        </div>
      </GlassCard>

      <GlassCard hover={false}>
        <h2 className="text-lg font-semibold text-white mb-3">Links</h2>
        <div className="space-y-1.5">
          {[
            { label: 'GitHub Repository', url: 'https://github.com/yeheskieltame/Tessera' },
            { label: 'Hackathon Page', url: 'https://synthesis.devfolio.co' },
            { label: 'Octant Documentation', url: 'https://docs.octant.app/en-EN/how-it-works.html' },
          ].map(l => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-300 hover:text-blue-200 no-underline transition-colors"
            >
              {l.label} &rarr;
            </a>
          ))}
        </div>
      </GlassCard>

      <div className="text-center text-xs text-white/30 py-4">
        Built by Yeheskiel Yunus Rame &amp; Claude Opus 4.6 for The Synthesis Hackathon
      </div>
    </div>
  )
}
