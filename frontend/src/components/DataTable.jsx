export default function DataTable({ columns, data, emptyMessage = 'No data available' }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-white/50 py-12">{emptyMessage}</div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-white/15">
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-3 text-white/70 font-semibold text-xs uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              {columns.map((col, j) => (
                <td key={j} className="px-4 py-3 text-white/90">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
