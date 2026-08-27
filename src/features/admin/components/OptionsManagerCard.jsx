import React, { useState } from "react";
import { Search, X, Trash2, Plus, Edit2, Check, AlertTriangle, Layers } from "lucide-react";

export function OptionsManagerCard({ title, icon: Icon, options, onAdd, onDelete, onRename }) {
  const [search, setSearch] = useState("");
  const [editingOpt, setEditingOpt] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirmOpt, setDeleteConfirmOpt] = useState(null);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatchExists = options.some(opt =>
    opt.toLowerCase() === search.trim().toLowerCase()
  );

  const startEditing = (opt) => {
    setEditingOpt(opt);
    setEditValue(opt);
  };

  const cancelEditing = () => {
    setEditingOpt(null);
    setEditValue("");
  };

  const saveEditing = (opt) => {
    if (!editValue || !editValue.trim()) {
      return;
    }
    const trimmed = editValue.trim();
    if (trimmed !== opt && onRename) {
      onRename(opt, trimmed);
    }
    setEditingOpt(null);
    setEditValue("");
  };

  const confirmDelete = () => {
    if (deleteConfirmOpt && onDelete) {
      onDelete(deleteConfirmOpt);
    }
    setDeleteConfirmOpt(null);
  };

  return (
    <>
      <div className="bg-white rounded-[10px] border border-[#E4E7EC] shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.02)] overflow-hidden flex flex-col h-[460px] transition-all duration-150 ease-out hover:shadow-[0_4px_12px_rgba(16,24,40,0.06)]">
        {/* Header Section */}
        <div className="px-4 py-3 bg-[#FAFBFD] border-b border-[#E4E7EC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-50 border border-blue-100 rounded-md flex items-center justify-center text-blue-600 shadow-2xs">
              <Icon size={14} />
            </div>
            <h3 className="font-semibold text-xs text-[#172033] tracking-wider uppercase">{title}</h3>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-[#667085] border border-slate-200">
            {options.length} items
          </span>
        </div>

        {/* Search Bar Section */}
        <div className="p-3 bg-white border-b border-[#E4E7EC] shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Filter or create options...`}
              className="w-full h-9 pl-9 pr-8 bg-white border border-[#DDE2EA] rounded-[7px] text-xs font-medium text-[#172033] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-150"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#172033] p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable List Section */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80 py-1">
          {filteredOptions.map((opt) => (
            <div
              key={opt}
              className="flex items-center justify-between px-3.5 py-2 text-xs text-[#172033] font-medium hover:bg-[#F8FAFC] transition-colors duration-150 group min-h-[38px] border-l-2 border-transparent hover:border-blue-600"
            >
              {editingOpt === opt ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") saveEditing(opt);
                      if (e.key === "Escape") cancelEditing();
                    }}
                    autoFocus
                    className="flex-1 bg-white border border-blue-500 px-2 py-1 rounded text-xs font-medium text-[#172033] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => saveEditing(opt)}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition shrink-0 cursor-pointer"
                    title="Save name"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="p-1 text-[#98A2B3] hover:bg-slate-100 rounded transition shrink-0 cursor-pointer"
                    title="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="truncate flex-1 pr-2">{opt}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      type="button"
                      onClick={() => startEditing(opt)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                      title={`Rename ${opt}`}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpt(opt)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition cursor-pointer"
                      title={`Delete ${opt}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {filteredOptions.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-[#98A2B3] mb-2">
                <Layers size={16} />
              </div>
              <p className="text-xs font-semibold text-[#172033]">No matching options</p>
              <p className="text-[11px] text-[#667085] mt-0.5">Try searching another term or create new option</p>
            </div>
          )}
        </div>

        {/* Bottom add bar if input has value and is unique */}
        {search.trim() && !exactMatchExists && (
          <button
            type="button"
            onClick={() => {
              onAdd(search.trim());
              setSearch("");
            }}
            className="p-3 border-t border-[#E4E7EC] bg-blue-50/50 hover:bg-blue-50 text-blue-600 font-semibold text-xs text-left transition flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus size={14} className="text-blue-600" />
            <span>Create "{search.trim()}" option</span>
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[10px] shadow-xl overflow-hidden border border-[#E4E7EC] p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-rose-50 border border-rose-100 rounded-md flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-[#172033] text-sm">Delete Option?</h3>
                <p className="text-xs text-[#667085] mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium bg-[#FAFBFD] p-3 rounded-md border border-[#E4E7EC]">
              Are you sure you want to delete <span className="font-semibold text-[#172033]">"{deleteConfirmOpt}"</span> from <span className="font-semibold text-blue-600">{title}</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpt(null)}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-[#172033] font-medium text-xs rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={12} />
                Delete Option
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
