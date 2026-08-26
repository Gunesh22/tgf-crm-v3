import React from "react";

export function ReassignModal({
  showReassignModal,
  setShowReassignModal,
  reassignProgId,
  setReassignProgId,
  programs,
  reassignFromId,
  setReassignFromId,
  reassignToId,
  setReassignToId,
  attenders,
  reassignStatus,
  setReassignStatus,
  reassignCount,
  setReassignCount,
  reassigning,
  handleReassign
}) {
  if (!showReassignModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg">Workload Reassignment Panel</h3>
            <p className="text-xs text-indigo-100 mt-0.5">Transfer contacts from one attender to another or to the pool</p>
          </div>
          <button onClick={() => setShowReassignModal(false)} className="text-white hover:text-indigo-200 font-bold text-sm">Cancel</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">1. Select Sheet / Tag</label>
            <select value={reassignProgId} onChange={e => setReassignProgId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">-- Select Sheet / Tag --</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">2. From Attender</label>
              <select value={reassignFromId} onChange={e => setReassignFromId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">-- Source --</option>
                {attenders.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">3. Target Attender</label>
              <select value={reassignToId} onChange={e => setReassignToId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">🌟 GENERAL POOL (Unassigned)</option>
                {attenders.filter(a => a.id !== reassignFromId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">4. Reassign Mode</label>
              <select value={reassignStatus} onChange={e => setReassignStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="Pending">Only Pending / Uncalled</option>
                <option value="Callbacks">Only Callbacks / Due</option>
                <option value="All">All Active Contacts</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">5. Number of Contacts</label>
              <input type="number" min={1} max={500} value={reassignCount} onChange={e => setReassignCount(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={() => setShowReassignModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold text-sm rounded-xl">Cancel</button>
          <button onClick={handleReassign} disabled={reassigning}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition disabled:opacity-50">
            {reassigning ? "Processing..." : "Confirm Reassignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
