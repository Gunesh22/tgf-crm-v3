import React, { useState } from "react";
import { Search, X, Trash2, Plus, Edit2, Check, AlertTriangle } from "lucide-react";

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
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-4 flex flex-col h-[460px]">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="w-7 h-7 bg-indigo-50 border border-indigo-100 rounded-md flex items-center justify-center text-indigo-600">
            <Icon size={14} />
          </div>
          <h3 className="font-semibold text-slate-900 text-xs tracking-wider uppercase">{title}</h3>
        </div>

        {/* Main search-select container */}
        <div className="flex-1 flex flex-col border border-slate-200 rounded-md overflow-hidden bg-white">
          {/* Search input header */}
          <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search or add options...`}
              className="w-full bg-transparent text-xs text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-0.5">
            {filteredOptions.map((opt) => (
              <div
                key={opt}
                className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 font-medium hover:bg-slate-50 transition group min-h-[36px]"
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
                      className="flex-1 bg-white border border-slate-200 px-2 py-1 rounded text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => saveEditing(opt)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition shrink-0"
                      title="Save name"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="p-1 text-slate-400 hover:bg-slate-100 rounded transition shrink-0"
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="truncate flex-1 pr-2">{opt}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => startEditing(opt)}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition"
                        title={`Rename ${opt}`}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmOpt(opt)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded transition"
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
              <div className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                No matching options found
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
              className="p-2.5 border-t border-slate-200 bg-white text-indigo-600 hover:bg-slate-50 font-medium text-xs text-left transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus size={13} className="text-indigo-600" />
              Create "{search.trim()}"
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg shadow-xl overflow-hidden border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-rose-50 border border-rose-100 rounded-md flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Delete Option?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-2.5 rounded-md border border-slate-200">
              Are you sure you want to delete <span className="font-semibold text-slate-900">"{deleteConfirmOpt}"</span> from <span className="font-semibold text-indigo-600">{title}</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpt(null)}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-md transition-colors cursor-pointer"
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

