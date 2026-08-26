import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  UserPlus, Trash2, Edit, ClipboardList, ArrowRightLeft, Key, Copy, Check, Eye, EyeOff, RotateCcw
} from "lucide-react";
import {
  createAttender, updateAttender, deleteAttender, generateRandomPassword,
  reassignContactsToPool, reassignContactsBetweenAttenders,
  subscribeToCallLogs, getAttenderContactCount
} from "../../../lib/db";
import { cleanExportRow } from "../utils.jsx";
import { AdminPasswordCard } from "./AdminPasswordCard";
import { AttenderSheetModal } from "./AttenderSheetModal";
import { ReassignModal } from "./ReassignModal";

export default function AttendersTab({ programs, attenders, onReloadAttenders }) {

  const [newAttenderName, setNewAttenderName] = useState("");
  const [editingAttender, setEditingAttender] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null);

  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Sheet View Modal
  const [viewingAttender, setViewingAttender] = useState(null);
  const [viewingProgramId, setViewingProgramId] = useState("");
  const [viewLogs, setViewLogs] = useState([]);
  const [viewStatus, setViewStatus] = useState("");
  const [viewSearch, setViewSearch] = useState("");
  const [showSheetModal, setShowSheetModal] = useState(false);

  // Reassignment Modal States
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignFromId, setReassignFromId] = useState("");
  const [reassignToId, setReassignToId] = useState("");
  const [reassignProgId, setReassignProgId] = useState("");
  const [reassignCount, setReassignCount] = useState(10);
  const [reassignStatus, setReassignStatus] = useState("Pending");
  const [reassigning, setReassigning] = useState(false);

  const unsubRef = React.useRef(null);

  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    if (!viewingAttender || !viewingProgramId) {
      setViewLogs([]);
      return;
    }
    unsubRef.current = subscribeToCallLogs(viewingProgramId, viewingAttender.id, viewingAttender.name, setViewLogs);
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [viewingAttender, viewingProgramId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newAttenderName.trim()) return;
    setCreating(true);
    try {
      const res = await createAttender(newAttenderName.trim());
      setNewAttenderName("");
      setCreatedInfo({ name: newAttenderName.trim(), password: res.password });
      toast.success(`Attender created! Password: ${res.password}`, { duration: 5000 });
      onReloadAttenders();
    } catch (err) {
      toast.error("Failed to create attender: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editingAttender) return;
    try {
      await updateAttender(editingAttender.id, {
        name: editName.trim(),
        password: editPassword.trim() || editingAttender.password || generateRandomPassword()
      });
      setEditingAttender(null);
      setEditName("");
      setEditPassword("");
      toast.success("Attender details updated!");
      onReloadAttenders();
    } catch (err) {
      toast.error("Update failed: " + err.message);
    }
  };

  const handleResetPassword = async (attender) => {
    const newPass = generateRandomPassword();
    try {
      await updateAttender(attender.id, { password: newPass });
      toast.success(`Reset password for ${attender.name}: ${newPass}`, { duration: 6000 });
      onReloadAttenders();
    } catch (err) {
      toast.error("Failed to reset password: " + err.message);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id, name) => {
    let totalAssigned = 0;
    try {
      totalAssigned = await getAttenderContactCount(id);
    } catch (err) {
      toast.error("Could not verify contact assignments: " + err.message);
      return;
    }

    if (totalAssigned > 0) {
      toast.error(
        `"${name}" still has ${totalAssigned} contact(s) assigned. Use the Workload Reassignment Panel to reassign all contacts first before deleting.`,
        { duration: 6000 }
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteAttender(id);
      toast.success("Attender deleted successfully.");
      onReloadAttenders();
    } catch (err) {
      toast.error("Failed to delete attender: " + err.message);
    }
  };

  const handleReassign = async () => {
    if (!reassignProgId) {
      toast.error("Please select a sheet or tag.");
      return;
    }
    if (!reassignFromId) {
      toast.error("Please select a source attender.");
      return;
    }
    if (reassignFromId === reassignToId) {
      toast.error("Source and target attenders cannot be the same!");
      return;
    }

    setReassigning(true);
    try {
      if (reassignToId === "") {
        const count = await reassignContactsToPool(reassignProgId, reassignFromId, reassignCount, reassignStatus);
        toast.success(`Reassigned ${count} contacts back to the general pool!`);
      } else {
        const count = await reassignContactsBetweenAttenders(reassignProgId, reassignFromId, reassignToId, reassignCount, reassignStatus);
        toast.success(`Transferred ${count} contacts directly to target attender!`);
      }
      setShowReassignModal(false);
    } catch (err) {
      toast.error("Reassignment failed: " + err.message);
    } finally {
      setReassigning(false);
    }
  };

  const sortedViewLogs = React.useMemo(() => {
    return viewLogs.filter(log => {
      if (log._deleted) return false;
      if (viewStatus && log.status !== viewStatus) return false;
      if (viewSearch) {
        const query = viewSearch.toLowerCase();
        const contactName = Object.keys(log).find(k => k.toLowerCase().includes("name") || k.toLowerCase().includes("lead"));
        const nameVal = contactName ? String(log[contactName]).toLowerCase() : "";
        const phoneVal = String(log.Phone || log.Mobile || "").toLowerCase();
        const cityVal = String(log.City || "").toLowerCase();
        const remarkVal = String(log.remark || "").toLowerCase();
        return nameVal.includes(query) || phoneVal.includes(query) || cityVal.includes(query) || remarkVal.includes(query);
      }
      return true;
    }).sort((a, b) => {
      const aTime = a.updatedAt?.toDate ? a.updatedAt.toDate() : a.updatedAt ? new Date(a.updatedAt) : 0;
      const bTime = b.updatedAt?.toDate ? b.updatedAt.toDate() : b.updatedAt ? new Date(b.updatedAt) : 0;
      return bTime - aTime;
    });
  }, [viewLogs, viewStatus, viewSearch]);

  const handleExportSheet = () => {
    if (!sortedViewLogs.length) return;
    const rows = sortedViewLogs.map(cleanExportRow);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet");
    XLSX.writeFile(wb, `${viewingAttender.name}_sheet_${new Date().toLocaleDateString("en-CA")}.xlsx`);
    toast.success("Exported!");
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Attenders Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage calling team staff, view their assigned worksheets, and transfer workloads.</p>
        </div>
        <button onClick={() => setShowReassignModal(true)}
          className="flex items-center gap-1.5 h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-md shadow-2xs transition-colors cursor-pointer">
          <ArrowRightLeft size={14} /> Workload Reassignment Panel
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Left Form Column */}
        <div className="space-y-5">
          <AdminPasswordCard highlighted={true} />

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UserPlus size={15} className="text-indigo-600" />
              {editingAttender ? "Edit Attender Profile" : "Add New Attender"}
            </h3>

            {createdInfo && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between text-xs font-medium text-emerald-800">
                <div>
                  <p className="font-semibold">🎉 Created "{createdInfo.name}"</p>
                  <p className="font-mono text-xs mt-0.5">PIN: {createdInfo.password}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdInfo.password, "created-info")}
                  className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
            )}

            {editingAttender ? (
              <form onSubmit={handleUpdate} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required
                    className="w-full h-8 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">6-Digit Password</label>
                  <div className="flex gap-1.5">
                    <input type="text" maxLength={6} value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder={editingAttender.password || "Auto-generated"}
                      className="flex-1 h-8 px-3 bg-white border border-slate-200 rounded-md text-xs font-mono font-medium text-slate-700 tracking-widest focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <button type="button" onClick={() => setEditPassword(generateRandomPassword())}
                      className="h-8 px-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium rounded-md text-xs flex items-center gap-1 transition-colors cursor-pointer">
                      <RotateCcw size={13} /> New
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="flex-1 h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-xs transition-colors cursor-pointer">Update Profile</button>
                  <button type="button" onClick={() => setEditingAttender(null)} className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md text-xs transition-colors cursor-pointer">Cancel</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input type="text" placeholder="Enter full name..." value={newAttenderName} onChange={e => setNewAttenderName(e.target.value)} required
                    className="w-full h-8 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <button type="submit" disabled={creating}
                  className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-xs transition-colors cursor-pointer shadow-2xs">
                  Add Attender (Auto-PIN)
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right List Column */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Attenders List ({attenders.length})</h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
              {attenders.map(a => {
                const isPassVisible = visiblePasswords[a.id];
                const currentPass = a.password || "------";
                return (
                  <div key={a.id} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded flex items-center justify-center font-bold text-indigo-700 text-xs uppercase">
                        {a.name[0]}
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-slate-900">{a.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[11px] font-mono">
                            <Key size={11} className="text-indigo-600" />
                            {isPassVisible ? currentPass : "••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setVisiblePasswords(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            title={isPassVisible ? "Hide password" : "Show password"}
                          >
                            {isPassVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(currentPass, a.id)}
                            className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                            title="Copy password"
                          >
                            {copiedId === a.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleResetPassword(a)}
                        className="h-7 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        title="Generate new random 6-digit password">
                        <RotateCcw size={11} /> Reset PIN
                      </button>
                      <button onClick={() => { setViewingAttender(a); setViewingProgramId(""); setShowSheetModal(true); }}
                        className="flex items-center gap-1 h-7 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded text-xs transition-colors cursor-pointer border border-indigo-100">
                        <ClipboardList size={13} /> Worksheets
                      </button>
                      <button onClick={() => { setEditingAttender(a); setEditName(a.name); setEditPassword(a.password || ""); }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDelete(a.id, a.name)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {attenders.length === 0 && (
                <div className="py-8 text-center text-slate-400 font-medium">No attenders registered.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet Modal */}
      <AttenderSheetModal
        showSheetModal={showSheetModal}
        setShowSheetModal={setShowSheetModal}
        viewingAttender={viewingAttender}
        setViewingAttender={setViewingAttender}
        viewingProgramId={viewingProgramId}
        setViewingProgramId={setViewingProgramId}
        programs={programs}
        viewSearch={viewSearch}
        setViewSearch={setViewSearch}
        viewStatus={viewStatus}
        setViewStatus={setViewStatus}
        handleExportSheet={handleExportSheet}
        sortedViewLogs={sortedViewLogs}
      />

      {/* Workload Reassignment Panel Modal */}
      <ReassignModal
        showReassignModal={showReassignModal}
        setShowReassignModal={setShowReassignModal}
        reassignProgId={reassignProgId}
        setReassignProgId={setReassignProgId}
        programs={programs}
        reassignFromId={reassignFromId}
        setReassignFromId={setReassignFromId}
        reassignToId={reassignToId}
        setReassignToId={setReassignToId}
        attenders={attenders}
        reassignStatus={reassignStatus}
        setReassignStatus={setReassignStatus}
        reassignCount={reassignCount}
        setReassignCount={setReassignCount}
        reassigning={reassigning}
        handleReassign={handleReassign}
      />
    </div>
  );
}
