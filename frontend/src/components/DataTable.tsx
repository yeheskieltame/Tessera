"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Column {
  key: string;
  header: string;
  render?: (row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  emptyMessage?: string;
}

export default function DataTable({
  columns,
  data,
  emptyMessage = "No data available",
}: DataTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-blue-100/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b border-blue-50/50 hover:bg-blue-50/30 transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 text-slate-700">
                  {col.render
                    ? col.render(row)
                    : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
