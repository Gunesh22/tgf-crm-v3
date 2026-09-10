import React, { useState } from "react";
import { 
  Users, 
  PhoneCall, 
  CheckCircle2, 
  Eye, 
  Download, 
  X, 
  ArrowUpRight, 
  Search, 
  PhoneIncoming, 
  PhoneOutgoing,
  ShieldCheck,
  Calendar,
  Filter
} from "lucide-react";
import * as XLSX from "xlsx";
import { evaluatePresetSummary } from "../../../utils/presetEngine.js";
import { determineCallType } from "../../../utils/registrationEngine.js";

export function PresetSummaryCards({
  activePreset,
  contacts = [],
  onClosePreset
}) {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  if (!activePreset) return null;

  const summary = evaluatePresetSummary(contacts, activePreset);
  const totalDatasetCount = contacts.length;
  const matchPct = totalDatasetCount > 0 ? ((summary.totalCount / totalDatasetCount) * 100).toFixed(1) : "0.0";
  const contactRate = summary.totalCount > 0 ? ((summary.calledCount / summary.totalCount) * 100).toFixed(1) : "0.0";
  const conversionRate = summary.totalCount > 0 ? ((summary.convertedCount / summary.totalCount) * 100).toFixed(1) : "0.0";

  // Filter contacts inside modal based on tab and search
  const getModalContacts = () => {
    let list = summary.matchingContacts;
    if (activeTab === "CALLED") list = summary.calledContacts;
    if (activeTab === "UNCALLED") list = summary.uncalledContacts;
    if (activeTab === "CONVERTED") list = summary.convertedContacts;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c => {
        const name = (c.Name || c.name || "").toLowerCase();
        const phone = (c.Phone || c.phone || "").toLowerCase();
        const src = (c.leadOrigin || c.original_source || c.originalSource || c.Source || c.source || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || src.includes(q);
      });
    }

    return list;
  };

  const modalContacts = getModalContacts();

  // Export matching preset contacts to Excel (.xlsx)
  const handleExportExcel = () => {
    if (summary.matchingContacts.length === 0) return;

    const data = summary.matchingContacts.map((c, idx) => {
      const callDir = determineCallType(c, c);
      return {
        "S.No": idx + 1,
        "Lead Name": c.Name || c.name || "N/A",
        "Phone": c.Phone || c.phone || "N/A",
        "Original Source": c.leadOrigin || c.original_source || c.originalSource || c.Source || c.source || "N/A",
        "Called For Program": c["Called For"] || c.calledFor || c.programName || "N/A",
        "Pipeline Stage": c.status || c.pipelineStage || "N/A",
        "Call Attempts": c.attemptCount || (c.history ? c.history.length : 0),
        "Call Direction": callDir === "incoming" ? "Incoming (In)" : "Outgoing (Out)",
        "Assigned Owner": Array.isArray(c.assignedTo) ? c.assignedTo.join(", ") : (c.leadOwner || "Unassigned"),
        "Registration Date": c.registeredAt ? new Date(c.registeredAt).toLocaleDateString("en-IN") : "N/A"
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activePreset.title.substring(0, 30));
    
    const fileName = `${activePreset.title.replace(/[^a-zA-Z0-9]/g, "_")}_Export.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Banner Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3.5 px-4 text-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
              Active Preset Intelligence Rule
            </span>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              {activePreset.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-lg transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Inspect Leads ({summary.totalCount})</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={onClosePreset}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            title="Clear Active Preset"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Matching */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Matching Leads</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h4 className="text-2xl font-bold text-white tracking-tight">{summary.totalCount}</h4>
              <span className="text-xs text-slate-400 font-medium">({matchPct}% of total)</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 truncate">Filtered out of {totalDatasetCount} records</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Contacted vs Uncalled */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Call Contact Rate</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h4 className="text-2xl font-bold text-sky-400 tracking-tight">{contactRate}%</h4>
              <span className="text-xs text-slate-400">({summary.calledCount} called)</span>
            </div>
            <p className="text-[10px] text-amber-400/90 mt-1 font-medium">
              {summary.uncalledCount} pending first call
            </p>
          </div>
          <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
            <PhoneCall className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Conversion Rate */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Reg.Done Admissions</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h4 className="text-2xl font-bold text-emerald-400 tracking-tight">{summary.convertedCount}</h4>
              <span className="text-xs text-emerald-400/90 font-medium">({conversionRate}%)</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Confirmed student registrations</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Action / Deep Dive */}
        <div 
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-lg flex items-center justify-between cursor-pointer hover:border-indigo-500/60 transition-all group"
        >
          <div>
            <p className="text-xs font-medium text-indigo-300">Deep Funnel Inspection</p>
            <h4 className="text-sm font-semibold text-white mt-1 group-hover:text-indigo-200 flex items-center gap-1">
              View All Leads <ArrowUpRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">Filter by called, uncalled & conversions</p>
          </div>
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <Eye className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Inspect Leads Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white">
                    {activePreset.title} — Lead Inspection
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full">
                    {summary.totalCount} Leads Matched
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{activePreset.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Filter Tabs & Search Bar */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
                {[
                  { key: "ALL", label: `All (${summary.totalCount})` },
                  { key: "CALLED", label: `Called (${summary.calledCount})` },
                  { key: "UNCALLED", label: `Uncalled (${summary.uncalledCount})` },
                  { key: "CONVERTED", label: `Converted (${summary.convertedCount})` },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      activeTab === t.key
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search name, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>

            {/* Modal Lead Table */}
            <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
              {modalContacts.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No leads match this filter criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-[11px] font-semibold text-slate-400 uppercase bg-slate-950/60 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Lead Name</th>
                        <th className="py-2.5 px-3">Original Source</th>
                        <th className="py-2.5 px-3">Program</th>
                        <th className="py-2.5 px-3 text-center">Calls</th>
                        <th className="py-2.5 px-3">Direction</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Owner / Attender</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {modalContacts.map((c, i) => {
                        const callDir = determineCallType(c, c);
                        const isReg = String(c.status || c.pipelineStage || "").toLowerCase().includes("reg");
                        const attempts = c.attemptCount || (c.history ? c.history.length : 0);

                        return (
                          <tr key={c.id || i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-white">
                              <div>{c.Name || c.name || "Unknown"}</div>
                              <div className="text-[10px] text-slate-500">{c.Phone || c.phone || "N/A"}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700/60 text-[10px]">
                                {c.leadOrigin || c.original_source || c.originalSource || c.Source || c.source || "Direct"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {c["Called For"] || c.calledFor || c.programName || "General"}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-200">
                              {attempts}
                            </td>
                            <td className="py-2.5 px-3">
                              {callDir === "incoming" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                  <PhoneIncoming className="w-3 h-3" /> Inc
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded">
                                  <PhoneOutgoing className="w-3 h-3" /> Out
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                                  isReg
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-slate-800 text-slate-300 border border-slate-700"
                                }`}
                              >
                                {c.status || c.pipelineStage || "New Lead"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {Array.isArray(c.assignedTo) ? c.assignedTo.join(", ") : (c.leadOwner || "Unassigned")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
