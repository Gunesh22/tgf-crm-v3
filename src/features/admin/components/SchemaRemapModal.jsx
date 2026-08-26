import React from "react";
import { Loader2 } from "lucide-react";
import { STANDARD_TARGETS } from "../utils.jsx";

export function SchemaRemapModal({
  remapProgram,
  setRemapProgram,
  remapHeaders,
  remapMapping,
  setRemapMapping,
  handleExecuteRemap,
  remapping
}) {
  if (!remapProgram) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg">Remap Existing Program Fields</h3>
            <p className="text-xs text-amber-100 mt-0.5">Change standard mapping fields for existing contact documents in {remapProgram.name}</p>
          </div>
          <button onClick={() => setRemapProgram(null)} className="text-white hover:text-amber-200 font-bold text-sm">Cancel</button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4 font-bold text-xs text-gray-400 border-b border-gray-100 pb-2">
            <span>EXISTING PROPERTY KEY</span>
            <span>TARGET DATABASE FIELD</span>
          </div>

          <div className="space-y-3">
            {remapHeaders.map(hdr => (
              <div key={hdr} className="grid grid-cols-2 items-center gap-4 border-b border-gray-50 pb-2">
                <span className="font-bold text-sm text-gray-700 truncate">{hdr}</span>
                <select value={remapMapping[hdr]} onChange={e => setRemapMapping({ ...remapMapping, [hdr]: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {STANDARD_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={() => setRemapProgram(null)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold text-sm rounded-xl">Cancel</button>
          <button onClick={handleExecuteRemap} disabled={remapping}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-sm transition disabled:opacity-50">
            {remapping ? <Loader2 size={16} className="animate-spin" /> : null} Execute Remap Operation
          </button>
        </div>
      </div>
    </div>
  );
}
