import React, { useState, useMemo } from "react";
import { 
  Sliders, 
  Plus, 
  Search, 
  Download, 
  Users, 
  PhoneCall, 
  CheckCircle2, 
  PhoneIncoming, 
  PhoneOutgoing, 
  ArrowRight,
  X,
  FileSpreadsheet
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  getAllPresets, 
  evaluatePresetRule, 
  evaluatePresetSummary,
  saveCustomPresets,
  loadCustomPresets
} from "../../../utils/presetEngine.js";
import { determineCallType } from "../../../utils/registrationEngine.js";
import { ReportBuilderDrawer } from "./ReportBuilderDrawer.jsx";

export default function FunnelReportsTab({
  callLogs = [],
  programs = [],
  attenders = [],
  settingsOptions = {}
}) {
  const [reports, setReports] = useState(() => getAllPresets());
  const [activeReportId, setActiveReportId] = useState(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [reportToEdit, setReportToEdit] = useState(null);

  // Table Sub-tabs & Search
  const [leadTab, setLeadTab] = useState("ALL");
  const [leadSearch, setLeadSearch] = useState("");

  const activeReport = useMemo(() => {
    return reports.find(r => r.id === activeReportId) || null;
  }, [reports, activeReportId]);

  // Compute metrics for active report
  const summary = useMemo(() => {
    if (!activeReport) return null;
    return evaluatePresetSummary(callLogs, activeReport);
  }, [callLogs, activeReport]);

  const totalDatasetCount = callLogs.length;
  const matchPct = summary && totalDatasetCount > 0 ? ((summary.totalCount / totalDatasetCount) * 100).toFixed(1) : "0.0";
  const contactRate = summary && summary.totalCount > 0 ? ((summary.calledCount / summary.totalCount) * 100).toFixed(1) : "0.0";
  const conversionRate = summary && summary.totalCount > 0 ? ((summary.convertedCount / summary.totalCount) * 100).toFixed(1) : "0.0";

  // Filtered leads in main inspection table
  const displayedLeads = useMemo(() => {
    if (!summary) return [];
    let list = summary.matchingContacts;
    if (leadTab === "CALLED") list = summary.calledContacts;
    if (leadTab === "UNCALLED") list = summary.uncalledContacts;
    if (leadTab === "CONVERTED") list = summary.convertedContacts;

    if (leadSearch.trim()) {
      const q = leadSearch.toLowerCase();
      list = list.filter(c => {
        const name = (c.Name || c.name || "").toLowerCase();
        const phone = (c.Phone || c.phone || "").toLowerCase();
        const src = (c.leadOrigin || c.original_source || c.originalSource || c.Source || c.source || "").toLowerCase();
        const prog = (c.calledFor || c["Called For"] || c.programName || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || src.includes(q) || prog.includes(q);
      });
    }

    return list;
  }, [summary, leadTab, leadSearch]);

  const handleExportExcel = () => {
    if (!summary || summary.matchingContacts.length === 0) return;

    const data = summary.matchingContacts.map((c, idx) => {
      const callDir = determineCallType(c, c);
      const tagsStr = Array.isArray(c.tags) ? c.tags.join(", ") : (c.tags || c.Tags || "N/A");
      return {
        "S.No": idx + 1,
        "Lead Name": c.Name || c.name || "N/A",
        "Phone": c.Phone || c.phone || "N/A",
        "Lead Origin": c.leadOrigin || c.original_source || c.originalSource || c.Source || c.source || "N/A",
        "Current Source": tagsStr,
        "Target Program": c["Called For"] || c.calledFor || c.programName || "N/A",
        "Pipeline Stage": c.status || c.pipelineStage || "N/A",
        "Call Attempts": c.attemptCount || (c.history ? c.history.length : 0),
        "Call Direction": callDir === "incoming" ? "Incoming (In)" : "Outgoing (Out)",
        "Assigned Owner": Array.isArray(c.assignedTo) ? c.assignedTo.join(", ") : (c.leadOwner || "Unassigned")
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    const sheetName = activeReport ? activeReport.title.substring(0, 30) : "Report_Leads";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName.replace(/[^a-zA-Z0-9]/g, "_")}_Export.xlsx`);
  };

  const handleDeleteReport = (reportId, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this custom report?")) return;
    const existingCustom = loadCustomPresets();
    const updated = existingCustom.filter(p => p.id !== reportId);
    saveCustomPresets(updated);
    setReports(getAllPresets());
    if (activeReportId === reportId) setActiveReportId(null);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Funnel Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create and save simple reports to understand your leads, calls and conversions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setReportToEdit(null);
              setIsBuilderOpen(true);
            }}
            className="flex items-center gap-1.5 h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Plus size={15} /> New Report
          </button>
        </div>
      </div>

      {/* Saved Reports Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Saved Reports
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map(report => {
            const isActive = activeReportId === report.id;
            const rSummary = evaluatePresetSummary(callLogs, report);

            return (
              <div
                key={report.id}
                onClick={() => setActiveReportId(report.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? "bg-indigo-50/70 border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-2xs"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`text-xs font-bold ${isActive ? "text-indigo-950" : "text-slate-900"}`}>
                      {report.title}
                    </h4>
                    {!report.isBuiltIn && (
                      <button
                        onClick={(e) => handleDeleteReport(report.id, e)}
                        className="text-slate-400 hover:text-rose-600 text-[11px] font-medium"
                        title="Delete custom report"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {report.description || report.category || "Custom report filter"}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-slate-600">
                    {rSummary.totalCount} leads · {rSummary.calledCount} called · {rSummary.uncalledCount} pending · {rSummary.convertedCount} converted
                  </div>

                  <span className={`text-xs font-bold flex items-center gap-1 ${isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}>
                    Open <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Opened Active Report Focus View */}
      {activeReport && summary && (
        <div className="space-y-4 animate-tab-fade-in">
          {/* Active Report Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-xl shadow-md">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Active Report View
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                {activeReport.title}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">{activeReport.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!activeReport.isBuiltIn && (
                <button
                  onClick={() => {
                    setReportToEdit(activeReport);
                    setIsBuilderOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer border border-slate-700"
                >
                  Edit Report
                </button>
              )}

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition cursor-pointer"
              >
                <Download size={14} /> Export Excel ({summary.totalCount})
              </button>

              <button
                onClick={() => setActiveReportId(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Close report view"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matching Leads</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h4 className="text-2xl font-bold text-slate-900">{summary.totalCount}</h4>
                  <span className="text-xs font-medium text-slate-400">({matchPct}% of dataset)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Filtered out of {totalDatasetCount} CRM contacts</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users size={20} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Call Contact Rate</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h4 className="text-2xl font-bold text-sky-600">{contactRate}%</h4>
                  <span className="text-xs font-medium text-slate-500">({summary.calledCount} called)</span>
                </div>
                <p className="text-[11px] text-amber-600 font-medium mt-1">
                  {summary.uncalledCount} pending first call
                </p>
              </div>
              <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                <PhoneCall size={20} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reg.Done Admissions</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h4 className="text-2xl font-bold text-emerald-600">{summary.convertedCount}</h4>
                  <span className="text-xs font-medium text-emerald-700">({conversionRate}%)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Confirmed student registrations</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </div>

          {/* Integrated Lead Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                {[
                  { key: "ALL", label: `All (${summary.totalCount})` },
                  { key: "CALLED", label: `Called (${summary.calledCount})` },
                  { key: "UNCALLED", label: `Uncalled (${summary.uncalledCount})` },
                  { key: "CONVERTED", label: `Converted (${summary.convertedCount})` }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setLeadTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      leadTab === tab.key
                        ? "bg-white text-indigo-600 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search lead name, phone, program..."
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Lead Name & Contact</th>
                    <th className="py-3 px-4">Lead Origin</th>
                    <th className="py-3 px-4">Current Source</th>
                    <th className="py-3 px-4">Target Program</th>
                    <th className="py-3 px-4 text-center">Calls</th>
                    <th className="py-3 px-4">Direction</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Owner / Attender</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {displayedLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs font-medium">
                        No leads match this filter criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedLeads.map((c, idx) => {
                      const callDir = determineCallType(c, c);
                      const isReg = String(c.status || c.pipelineStage || "").toLowerCase().includes("reg");
                      const attempts = c.attemptCount || (c.history ? c.history.length : 0);
                      const tagsDisplay = Array.isArray(c.tags) ? c.tags.join(", ") : (c.tags || c.Tags || "—");

                      return (
                        <tr key={c.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-800">
                            <div>{c.Name || c.name || "Unknown Lead"}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.Phone || c.phone || "—"}</div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium border border-slate-200">
                              {c.leadOrigin || c.original_source || c.originalSource || c.Source || c.source || "Direct"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 font-medium">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-mono border border-indigo-100">
                              {tagsDisplay}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-700">
                            {c["Called For"] || c.calledFor || c.programName || "General"}
                          </td>
                          <td className="py-2.5 px-4 text-center font-bold text-slate-700 font-mono">
                            {attempts}
                          </td>
                          <td className="py-2.5 px-4">
                            {callDir === "incoming" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                                <PhoneIncoming size={11} /> Inc
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 rounded">
                                <PhoneOutgoing size={11} /> Out
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                                isReg
                                  ? "bg-emerald-100 text-emerald-800 font-bold"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {c.status || c.pipelineStage || "New Lead"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {Array.isArray(c.assignedTo) ? c.assignedTo.join(", ") : (c.leadOwner || "Unassigned")}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report Builder Drawer */}
      {isBuilderOpen && (
        <ReportBuilderDrawer
          reportToEdit={reportToEdit}
          contacts={callLogs}
          programs={programs}
          attenders={attenders}
          settingsOptions={settingsOptions}
          onClose={() => {
            setIsBuilderOpen(false);
            setReportToEdit(null);
          }}
          onSaved={() => {
            setReports(getAllPresets());
            setIsBuilderOpen(false);
            setReportToEdit(null);
          }}
        />
      )}
    </div>
  );
}
