export function AdminTable({ 
  headers, 
  data, 
  onRowClick, 
  onEdit, 
  onDelete 
}: any) {
  return (
    <div className="overflow-x-auto bg-slate-800 rounded-lg border border-slate-700">
      <table className="w-full text-left">
        <thead className="bg-slate-900/50 text-slate-400 text-sm uppercase">
          <tr>
            {headers.map((h: string) => <th key={h} className="p-4">{h}</th>)}
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {data.map((row: any) => (
            <tr 
              key={row.id} 
              onClick={() => onRowClick(row.id)}
              className="hover:bg-slate-700/50 cursor-pointer transition-colors"
            >
              {/* Dynamic Cells based on headers */}
              {headers.map((h: string) => (
                <td key={h} className="p-4">{row[h.toLowerCase()]}</td>
              ))}
              <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                 <button className="p-2 hover:bg-slate-600 rounded">...</button>
                 {/* Menu logic goes here */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}