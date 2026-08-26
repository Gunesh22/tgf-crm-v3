import React from "react";
import { Download } from "lucide-react";

export function AttenderSheetModal({
  showSheetModal,
  setShowSheetModal,
  viewingAttender,
  setViewingAttender,
  viewingProgramId,
  setViewingProgramId,
  programs,
  viewSearch,
  setViewSearch,
  viewStatus,
  setViewStatus,
  handleExportSheet,
  sortedViewLogs
}) {
  if (!showSheetModal || !viewingAttender) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg">{viewingAttender.name}'s Assigned Worksheets</h3>
            <p className="text-xs text-indigo-100 mt-0.5">Filter sheets by Sheet / Tag, search logs, and export to spreadsheet</p>
          </div>
          <button onClick={() => { setShowSheetModal(false); setViewingAttender(null); }} className="text-white hover:text-indigo-200 font-bold text-sm">Close</button>
        </div>
        
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-3 items-center">
          <select value={viewingProgramId} onChange={e => setViewingProgramId(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">-- Select Sheet / Tag --</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {viewingProgramId && (
            <>
              <input type="text" placeholder="Search by name, phone, city..." value={viewSearch} onChange={e => setViewSearch(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              
              <select value={viewStatus} onChange={e => setViewStatus(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Call Statuses</option>
                <option value="Pending">Pending / Uncalled</option>
                <option value="Info given">Info given</option>
                <option value="Interested">Interested</option>
                <option value="Reg.Done">Reg.Done</option>
                <option value="Busy">Busy</option>
                <option value="Call Cut">Call Cut</option>
                <option value="switched off">switched off</option>
                <option value="no answer">no answer</option>
              </select>

              <button onClick={handleExportSheet} disabled={!sortedViewLogs.length}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50">
                <Download size={14} /> Export Sheet
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {!viewingProgramId ? (
            <div className="h-full flex items-center justify-center text-gray-400 font-medium py-20">Select a sheet or tag to load worksheet logs.</div>
          ) : sortedViewLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 font-medium py-20">No matching contacts in this sheet.</div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">Lead Details</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Remarks & Timeline</th>
                  <th className="px-6 py-3">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedViewLogs.map((log, idx) => {
                  const logName = Object.keys(log).find(k => k.toLowerCase().includes("name") || k.toLowerCase().includes("lead"));
                  const contactName = logName ? log[logName] : "Unknown";
                  return (
                    <tr key={`${log.id || 'log'}_${idx}`} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm text-gray-800">{contactName}</p>
                        <p className="text-gray-400 mt-0.5">{log.Phone || log.Mobile || "No Phone"}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <p>{log.City || "—"}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{log.State || "—"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-lg font-black uppercase text-[10px] ${log.status === "Reg.Done" ? "bg-emerald-100 text-emerald-700" :
                          log.status === "Interested" ? "bg-blue-100 text-blue-700" :
                            log.status === "Info given" ? "bg-purple-100 text-purple-700" :
                              !log.status || log.status === "Pending" ? "bg-amber-100 text-amber-700" :
                                "bg-gray-100 text-gray-600"
                          }`}>{log.status || "Pending"}</span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="font-bold text-gray-700 truncate">{log.remark || "—"}</p>
                        {log.history && log.history.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                            History: {log.history.map(h => `${h.status}(${h.remark || ""})`).join(" → ")}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {log.updatedAt?.toDate ? log.updatedAt.toDate().toLocaleString("en-IN") : log.updatedAt ? new Date(log.updatedAt).toLocaleString("en-IN") : "Never"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
