const colors = {
  green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  red: 'bg-red-500/20 text-red-300 border-red-500/30',
  yellow: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  gray: 'bg-white/10 text-white/60 border-white/20',
}

export default function StatusBadge({ color = 'gray', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        color === 'green' ? 'bg-emerald-400' :
        color === 'red' ? 'bg-red-400' :
        color === 'yellow' ? 'bg-amber-400' :
        color === 'blue' ? 'bg-blue-400' : 'bg-white/50'
      }`} />
      {children}
    </span>
  )
}
