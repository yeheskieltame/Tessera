import { useState, useEffect } from 'react'

const statusIcon = {
  pending: (
    <span className="w-6 h-6 rounded-full border-2 border-white/20 flex items-center justify-center text-xs text-white/30">
      -
    </span>
  ),
  running: (
    <span className="w-6 h-6 rounded-full border-2 border-blue-400 flex items-center justify-center">
      <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </span>
  ),
  done: (
    <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white font-bold">
      &#10003;
    </span>
  ),
  error: (
    <span className="w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center text-xs text-white font-bold">
      !
    </span>
  ),
}

export default function ProgressStepper({ steps }) {
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    const lastDone = [...steps].reverse().find(s => s.status === 'done')
    if (lastDone) setExpandedId(lastDone.id)
  }, [steps])

  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const isExpanded = expandedId === step.id
        const isDone = step.status === 'done'
        const isRunning = step.status === 'running'

        return (
          <div key={step.id} className="group">
            <button
              onClick={() => isDone && setExpandedId(isExpanded ? null : step.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-300 ${
                isRunning
                  ? 'bg-blue-500/10 border border-blue-500/30'
                  : isDone
                    ? 'bg-white/5 border border-white/10 hover:bg-white/8 cursor-pointer'
                    : 'bg-white/3 border border-white/5 opacity-60'
              }`}
              disabled={!isDone}
            >
              {statusIcon[step.status]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40 font-mono">[{i + 1}]</span>
                  <span className={`text-sm font-medium ${isDone || isRunning ? 'text-white' : 'text-white/50'}`}>
                    {step.label}
                  </span>
                </div>
                {step.summary && (
                  <p className={`text-xs mt-0.5 ml-7 ${isDone ? 'text-blue-300/80' : 'text-white/40'}`}>
                    {step.summary}
                  </p>
                )}
              </div>
              {isDone && (
                <svg
                  className={`w-4 h-4 text-white/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                isExpanded ? 'max-h-[2000px] opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'
              }`}
            >
              {step.content && (
                <div className="ml-4 pl-6 border-l-2 border-blue-500/30 py-3 pr-4">
                  {step.content}
                </div>
              )}
            </div>

            {i < steps.length - 1 && (
              <div className="flex justify-start ml-6 -my-0.5">
                <div className={`w-0.5 h-2 ${isDone ? 'bg-blue-500/40' : 'bg-white/10'}`} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
