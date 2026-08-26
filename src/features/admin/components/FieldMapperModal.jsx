import React from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { STANDARD_TARGETS } from "../utils.jsx";

export function FieldMapperModal({
  showMapModal,
  setShowMapModal,
  excelHeaders,
  fieldMapping,
  setFieldMapping,
  handleConfirmImport,
  importing
}) {
  if (!showMapModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg">Excel Columns Field Mapper</h3>
            <p className="text-xs text-indigo-100 mt-0.5">Map Excel columns to database fields to prevent duplicate entries</p>
          </div>
          <button onClick={() => setShowMapModal(false)} className="text-white hover:text-indigo-200 font-bold text-sm">Cancel</button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center gap-2 p-3.5 bg-amber-50 text-amber-800 text-xs font-semibold rounded-2xl">
            <AlertTriangle size={16} className="shrink-0" />
            <span>Columns mapped to <b>Phone</b> or <b>Mobile</b> are verified against duplicates on import.</span>
          </div>

          <div className="grid grid-cols-2 gap-4 font-bold text-xs text-gray-400 border-b border-gray-100 pb-2">
            <span>EXCEL COLUMN HEADER</span>
            <span>TARGET DATABASE FIELD</span>
          </div>

          <div className="space-y-3">
            {excelHeaders.map(hdr => (
              <div key={hdr} className="grid grid-cols-2 items-center gap-4 border-b border-gray-50 pb-2">
                <span className="font-bold text-sm text-gray-700 truncate">{hdr}</span>
                <select value={fieldMapping[hdr]} onChange={e => setFieldMapping({ ...fieldMapping, [hdr]: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {STANDARD_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={() => setShowMapModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold text-sm rounded-xl">Cancel</button>
          <button onClick={handleConfirmImport} disabled={importing}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition disabled:opacity-50">
            {importing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Start Importing Contacts
          </button>
        </div>
      </div>
    </div>
  );
}
