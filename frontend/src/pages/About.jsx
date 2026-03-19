import GlassCard from '../components/GlassCard'

const commands = [
  { cmd: 'status', desc: 'Check connection to all data sources' },
  { cmd: 'providers', desc: 'View AI provider fallback chain' },
  { cmd: 'list-projects -e 5', desc: 'List Octant projects per epoch' },
  { cmd: 'analyze-epoch -e 5', desc: 'Quantitative analysis (clustering, scoring)' },
  { cmd: 'evaluate "Name" -d "desc"', desc: 'Qualitative AI evaluation' },
  { cmd: 'detect-anomalies -e 5', desc: 'Anomaly detection (funding/sybil)' },
  { cmd: 'gitcoin-rounds -r ID', desc: 'Analyze Gitcoin round' },
  { cmd: 'extract-metrics "text"', desc: 'Extract impact metrics from text' },
  { cmd: 'trust-graph -e 5', desc: 'Build trust graph for epoch' },
  { cmd: 'simulate -e 5', desc: 'Simulate funding mechanisms' },
  { cmd: 'analyze-project ADDR', desc: 'Deep project analysis' },
  { cmd: 'compare -e 5 -p ADDR1 ADDR2', desc: 'Compare projects' },
  { cmd: 'report -e 5', desc: 'Generate full epoch report' },
  { cmd: 'export -e 5 -f csv', desc: 'Export data to CSV/JSON' },
  { cmd: 'serve', desc: 'Start HTTP API server' },
  { cmd: 'serve --port 3000', desc: 'Start server on custom port' },
  { cmd: 'version', desc: 'Show version info' },
]

export default function About() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">About Tessera</h1>
        <p className="text-white/50">
          AI-powered public goods evaluation for the Ethereum ecosystem
        </p>
      </div>

      {/* Setup */}
      <GlassCard hover={false}>
        <h2 className="text-xl font-semibold text-white mb-4">Setup</h2>
        <div className="space-y-4 text-white/80">
          <div>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Prerequisites</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Go 1.21+</li>
              <li>Claude Code (Max plan) or an Anthropic API key</li>
              <li>Optionally: Gemini API key, OpenAI API key</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Build</h3>
            <div className="bg-black/30 rounded-xl p-4 font-mono text-sm space-y-1">
              <p className="text-blue-300">$ git clone https://github.com/yeheskieltame/Tessera.git</p>
              <p className="text-blue-300">$ cd Tessera</p>
              <p className="text-blue-300">$ cp .env.example .env  <span className="text-white/40"># fill in API keys</span></p>
              <p className="text-blue-300">$ go build -o tessera ./cmd/analyst/</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Run the API Server</h3>
            <div className="bg-black/30 rounded-xl p-4 font-mono text-sm">
              <p className="text-blue-300">$ ./tessera serve</p>
            </div>
            <p className="text-sm text-white/50 mt-2">
              Then point this frontend to the API via <code className="text-blue-300 bg-white/10 px-1.5 py-0.5 rounded">VITE_API_URL</code> or use the default proxy at localhost:8080.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* CLI Commands */}
      <GlassCard hover={false}>
        <h2 className="text-xl font-semibold text-white mb-4">CLI Commands</h2>
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/15">
                <th className="px-4 py-2 text-white/60 font-semibold text-xs uppercase tracking-wider">Command</th>
                <th className="px-4 py-2 text-white/60 font-semibold text-xs uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((c, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2 font-mono text-blue-300 text-xs whitespace-nowrap">
                    ./tessera {c.cmd}
                  </td>
                  <td className="px-4 py-2 text-white/80">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Architecture */}
      <GlassCard hover={false}>
        <h2 className="text-xl font-semibold text-white mb-4">Architecture</h2>
        <div className="text-white/80 text-sm space-y-3">
          <p>
            Tessera is a single Go binary (~9MB) with zero runtime dependencies. It features a multi-model AI fallback chain (Claude, Gemini, OpenAI) and pulls data from three sources:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="font-semibold text-blue-300 mb-1">Octant API</div>
              <div className="text-white/50 text-xs">Projects, allocations, rewards, epochs, patrons, budgets</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="font-semibold text-blue-300 mb-1">Gitcoin Grants Stack</div>
              <div className="text-white/50 text-xs">Rounds, applications, donations, matching</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="font-semibold text-blue-300 mb-1">Open Source Observer</div>
              <div className="text-white/50 text-xs">GitHub metrics, on-chain activity, ecosystem data</div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Team & Links */}
      <GlassCard hover={false}>
        <h2 className="text-xl font-semibold text-white mb-4">Team & Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="text-white/60 uppercase tracking-wider text-xs font-semibold mb-2">Team</h3>
            <ul className="space-y-2 text-white/80">
              <li>
                <span className="font-semibold text-white">Yeheskiel Yunus Rame</span>
                <span className="text-white/50"> - Human</span>
              </li>
              <li>
                <span className="font-semibold text-white">Claude Opus 4.6</span>
                <span className="text-white/50"> - AI Agent</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-white/60 uppercase tracking-wider text-xs font-semibold mb-2">Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="https://github.com/yeheskieltame/Tessera" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 no-underline">
                  GitHub Repository
                </a>
              </li>
              <li>
                <a href="https://synthesis.devfolio.co" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 no-underline">
                  The Synthesis Hackathon
                </a>
              </li>
              <li>
                <a href="https://docs.octant.app/en-EN/how-it-works.html" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 no-underline">
                  Octant Documentation
                </a>
              </li>
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
