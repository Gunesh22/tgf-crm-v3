import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import { UserCheck, Plus, Trash2, Edit2, Shield, Eye, EyeOff, Copy, Check, Users, Search, X } from "lucide-react";
import { createAttender, updateAttender, deleteAttender, generateRandomPassword } from "../../../lib/db";

export default function DataEntryTab({ attenders = [], onReloadAttenders }) {
  // Available regular attenders to assign
  const availableAttenders = useMemo(() => {
    return (attenders || []).filter(a => a.role === "attender" && a.isActive !== false);
  }, [attenders]);

  // Existing operators
  const operators = useMemo(() => {
    return (attenders || []).filter(a => a.role === "data_entry");
  }, [attenders]);

  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedCallerIds, setSelectedCallerIds] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createAttenderSearch, setCreateAttenderSearch] = useState("");

  // Edit State
  const [editingOperator, setEditingOperator] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editCallerIds, setEditCallerIds] = useState([]);
  const [editAttenderSearch, setEditAttenderSearch] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!isCreateModalOpen && !editingOperator) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsCreateModalOpen(false);
        setEditingOperator(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateModalOpen, editingOperator]);

  const filteredCreateAttenders = useMemo(() => {
    if (!createAttenderSearch.trim()) return availableAttenders;
    const q = createAttenderSearch.toLowerCase().trim();
    return availableAttenders.filter(a => (a.name || "").toLowerCase().includes(q));
  }, [availableAttenders, createAttenderSearch]);

  const filteredEditAttenders = useMemo(() => {
    if (!editAttenderSearch.trim()) return availableAttenders;
    const q = editAttenderSearch.toLowerCase().trim();
    return availableAttenders.filter(a => (a.name || "").toLowerCase().includes(q));
  }, [availableAttenders, editAttenderSearch]);

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Password copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) {
      toast.error("Operator name is required");
      return;
    }

    setIsCreating(true);
    try {
      const pass = newPassword.trim() || generateRandomPassword();
      await createAttender(cleanName, pass, {
        role: "data_entry",
        assignedAttenders: selectedCallerIds,
        isActive: true
      });
      toast.success(`Operator "${cleanName}" created successfully`);
      setNewName("");
      setNewPassword("");
      setSelectedCallerIds([]);
      setCreateAttenderSearch("");
      setIsCreateModalOpen(false);
      if (onReloadAttenders) onReloadAttenders();
    } catch (err) {
      toast.error(err.message || "Failed to create operator");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (op) => {
    setEditingOperator(op);
    setEditName(op.name || "");
    setEditPassword(op.password || "");
    setEditCallerIds(Array.isArray(op.assignedAttenders) ? op.assignedAttenders : []);
    setEditAttenderSearch("");
  };

  const handleSaveEdit = async () => {
    if (!editingOperator) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      toast.error("Operator name is required");
      return;
    }

    setIsUpdating(true);
    try {
      await updateAttender(editingOperator.id, {
        name: cleanName,
        password: editPassword.trim(),
        assignedAttenders: editCallerIds,
        role: "data_entry"
      });
      toast.success(`Operator "${cleanName}" updated successfully`);
      setEditingOperator(null);
      if (onReloadAttenders) onReloadAttenders();
    } catch (err) {
      toast.error(err.message || "Failed to update operator");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async (op) => {
    const nextActive = op.isActive === false;
    try {
      await updateAttender(op.id, { isActive: nextActive });
      toast.success(`Operator "${op.name}" is now ${nextActive ? "Active" : "Deactivated"}`);
      if (onReloadAttenders) onReloadAttenders();
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (op) => {
    if (!confirm(`Are you sure you want to permanently delete Operator "${op.name}"?`)) return;
    try {
      await deleteAttender(op.id);
      toast.success(`Operator "${op.name}" deleted`);
      if (onReloadAttenders) onReloadAttenders();
    } catch (err) {
      toast.error(err.message || "Failed to delete operator");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Info Banner with Create Operator Action */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Data Entry Operators</h2>
            <p className="text-xs text-slate-500 mt-1">
              Operators can log in and enter call data on behalf of their assigned attenders. All lead ownership remains with the caller.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewName("");
            setNewPassword("");
            setSelectedCallerIds([]);
            setCreateAttenderSearch("");
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
        >
          <Plus size={15} />
          <span>Create New Operator</span>
        </button>
      </div>

      {/* Operators List Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span>Active & Configured Operators</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {operators.length}
            </span>
          </h3>
        </div>

        {operators.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Users size={28} className="mx-auto text-slate-300 mb-2" />
            No Data Entry Operators configured yet. Click "Create New Operator" above to add an operator.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 min-w-[160px]">Operator Name</th>
                  <th className="py-2.5 px-4 min-w-[150px]">Login Password</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Assigned Attenders</th>
                  <th className="py-2.5 px-4 min-w-[110px]">Status</th>
                  <th className="py-2.5 px-4 text-right min-w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {operators.map(op => {
                  const isVisible = visiblePasswords[op.id];
                  const assignedNames = (op.assignedAttenders || []).map(id => {
                    const found = attenders.find(a => a.id === id);
                    return found ? found.name : id;
                  });

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 text-xs">{op.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-tight">{op.id}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-md px-2 py-1">
                          <span className="font-mono text-[11px] text-slate-700 select-all min-w-[54px]">
                            {isVisible ? (op.password || "—") : "••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(op.id)}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                            title={isVisible ? "Hide Password" : "Show Password"}
                          >
                            {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          {op.password && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(op.id, op.password)}
                              className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                              title="Copy Password"
                            >
                              {copiedId === op.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        {assignedNames.length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">None assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assignedNames.map((name, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(op)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                            op.isActive !== false
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70"
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70"
                          }`}
                          title="Click to toggle status"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${op.isActive !== false ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {op.isActive !== false ? "Active" : "Deactivated"}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(op)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Operator & Assignments"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(op)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Operator"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create New Operator Modal Popup */}
      {isCreateModalOpen && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setIsCreateModalOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 animate-fade-in"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Create New Operator</h3>
                <p className="text-xs text-slate-500 mt-0.5">Set credentials and assign attenders for this operator</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Operator Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Ramesh Data Entry"
                    required
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Password (Leave blank for random)</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Custom password or auto-generated"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-2xs font-mono"
                  />
                </div>

                {/* Assigned Attenders List with Search Bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      Assigned Attenders ({selectedCallerIds.length} of {availableAttenders.length})
                    </label>
                    {availableAttenders.length > 0 && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSelectedCallerIds(availableAttenders.map(a => String(a.id)))}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCallerIds([])}
                          className="font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Search bar */}
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search attenders by name..."
                      value={createAttenderSearch}
                      onChange={e => setCreateAttenderSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    {createAttenderSearch && (
                      <button
                        type="button"
                        onClick={() => setCreateAttenderSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Attenders list view */}
                  {availableAttenders.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center border border-slate-200/80 rounded-xl bg-slate-50/50">
                      No active attenders found to assign.
                    </p>
                  ) : filteredCreateAttenders.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center border border-slate-200/80 rounded-xl bg-slate-50/50">
                      No attenders match "{createAttenderSearch}".
                    </p>
                  ) : (
                    <div className="border border-slate-200/90 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto bg-white">
                      {filteredCreateAttenders.map(att => {
                        const attIdStr = String(att.id);
                        const isChecked = selectedCallerIds.some(id => String(id) === attIdStr);
                        return (
                          <label
                            key={attIdStr}
                            className={`flex items-center justify-between px-3.5 py-2 text-xs cursor-pointer transition-colors select-none ${
                              isChecked
                                ? "bg-indigo-50/70 text-indigo-950 font-semibold"
                                : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedCallerIds(selectedCallerIds.filter(id => String(id) !== attIdStr));
                                  } else {
                                    setSelectedCallerIds([...selectedCallerIds, attIdStr]);
                                  }
                                }}
                                className="sr-only"
                              />
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                isChecked
                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}>
                                {isChecked && <Check size={10} strokeWidth={3} />}
                              </div>
                              <span className="truncate">{att.name}</span>
                            </div>
                            {isChecked && (
                              <span className="text-[10px] text-indigo-600 font-semibold tracking-wider uppercase shrink-0">
                                Assigned
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  {isCreating ? "Creating Operator..." : "Create Operator"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Operator Modal */}
      {editingOperator && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setEditingOperator(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 animate-fade-in"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  Edit Operator: <span className="text-indigo-600">{editingOperator.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Update credentials and assigned callers</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOperator(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Operator Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-2xs font-mono"
                />
              </div>

              {/* Assigned Attenders with search bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Assigned Attenders ({editCallerIds.length} of {availableAttenders.length})
                  </label>
                  {availableAttenders.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setEditCallerIds(availableAttenders.map(a => String(a.id)))}
                        className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setEditCallerIds([])}
                        className="font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search attenders by name..."
                    value={editAttenderSearch}
                    onChange={e => setEditAttenderSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  {editAttenderSearch && (
                    <button
                      type="button"
                      onClick={() => setEditAttenderSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {availableAttenders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3 text-center border border-slate-200/80 rounded-xl bg-slate-50/50">
                    No active attenders found to assign.
                  </p>
                ) : filteredEditAttenders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3 text-center border border-slate-200/80 rounded-xl bg-slate-50/50">
                    No attenders match "{editAttenderSearch}".
                  </p>
                ) : (
                  <div className="border border-slate-200/90 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto bg-white">
                    {filteredEditAttenders.map(att => {
                      const attIdStr = String(att.id);
                      const isChecked = editCallerIds.some(id => String(id) === attIdStr);
                      return (
                        <label
                          key={attIdStr}
                          className={`flex items-center justify-between px-3.5 py-2 text-xs cursor-pointer transition-colors select-none ${
                            isChecked
                              ? "bg-indigo-50/70 text-indigo-950 font-semibold"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setEditCallerIds(editCallerIds.filter(id => String(id) !== attIdStr));
                                } else {
                                  setEditCallerIds([...editCallerIds, attIdStr]);
                                }
                              }}
                              className="sr-only"
                            />
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isChecked
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}>
                              {isChecked && <Check size={10} strokeWidth={3} />}
                            </div>
                            <span className="truncate">{att.name}</span>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] text-indigo-600 font-semibold tracking-wider uppercase shrink-0">
                              Assigned
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setEditingOperator(null)}
                className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
