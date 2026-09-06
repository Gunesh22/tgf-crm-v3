import React, { useState, useMemo } from "react";
import { 
  Sliders, 
  TrendingUp, 
  Zap, 
  Globe, 
  MessageSquare, 
  PhoneOff, 
  AlertCircle, 
  Clock, 
  Plus, 
  Search, 
  Download, 
  Users, 
  PhoneCall, 
  CheckCircle2, 
  Eye, 
  PhoneIncoming, 
  PhoneOutgoing,
  Filter,
  XCircle,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  getAllPresets, 
  evaluatePresetRule, 
  evaluatePresetSummary 
} from "../../../utils/presetEngine.js";
import { determineCallType } from "../../../utils/registrationEngine.js";
import { PresetBuilderModal } from "./PresetBuilderModal.jsx";

const ICON_MAP = {
  TrendingUp,
  Zap,
  Globe,
  MessageSquare,
  PhoneOff,
  AlertCircle,
  Clock,
  Sliders
};

export default function PresetsTab({ callLogs = [] }) {
  const [presets, setPresets] = useState(() => getAllPresets());
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [activePresetId, setActivePresetId] = useState("preset_upsell_cbt");
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [presetToEdit, setPresetToEdit] = useState(null);

  // Modal sub-tab state for inspecting lead list
  const [leadTab, setLeadTab] = useState("ALL");
  const [leadSearch, setLeadSearch] = useState("");

  const categories = ["ALL", "Upsell & Progression", "Lead Origins", "Dropouts & Risk", "Custom"];

  const activePreset = useMemo(() => {
    return presets.find(p => p.id === activePresetId) || presets[0] || null;
  }, [presets, activePresetId]);

  const filteredPresets = useMemo(() => {
    return presets.filter(p => {
      if (selectedCategory === "ALL") return true;
      if (selectedCategory === "Custom") return !p.isBuiltIn;
      return p.category === selectedCategory;
    });
  }, [presets, selectedCategory]);

  // Compute metrics for active preset
  const summary = useMemo(() => {
    if (!activePreset) return null;
    return evaluatePresetSummary(callLogs, activePreset);
  }, [callLogs, activePreset]);

  const totalDatasetCount = callLogs.length;
  const matchPct = summary && totalDatasetCount > 0 ? ((summary.totalCount / totalDatasetCount) * 100).toFixed(1) : "0.0";
  const contactRate = summary && summary.totalCount > 0 ? ((summary.calledCount / summary.totalCount) * 100).toFixed(1) : "0.0";
  const conversionRate = summary && summary.totalCount > 0 ? ((summary.convertedCount / summary.totalCount) * 100).toFixed(1) : "0.0";

  // Leads matching the active sub-tab search inside table
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
        const src = (c.original_source || c.Source || "").toLowerCase();
        const prog = (c["Called For"] || c.calledFor || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || src.includes(q) || prog.includes(q);
      });
    }

    return list;
  }, [summary, leadTab, leadSearch]);

  const handleExportExcel = () => {
    if (!summary || summary.matchingContacts.length === 0) return;

    const data = summary.matchingContacts.map((c, idx) => {
      const callDir = determineCallType(c, c);
      return {
        "S.No": idx + 1,
        "Lead Name": c.Name || c.name || "N/A",
        "Phone": c.Phone || c.phone || "N/A",
        "Original Source": c.original_source || c.Source || "N/A",
        "Target Program": c["Called For"] || c.calledFor || c.programName || "N/A",
        "Pipeline Stage": c.status || c.pipelineStage || "N/A",
        "Call Attempts": c.attemptCount || (c.history ? c.history.length : 0),
        "Call Direction": callDir === "incoming" ? "Incoming (In)" : "Outgoing (Out)",
        "Assigned Owner": Array.isArray(c.assignedTo) ? c.assignedTo.join(", ") : (c.leadOwner || "Unassigned")
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    const sheetName = activePreset ? activePreset.title.substring(0, 30) : "Preset_Leads";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName.replace(/[^a-zA-Z0-9]/g, "_")}_Export.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
              <Sliders className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Funnel Presets & Smart Intelligence Engine
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            1-tap analysis for upsells, Facebook/Instagram ad conversion, objection dropouts, and uncalled leads.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setPresetToEdit(null);
              setIsBuilderOpen(true);
            }}
            className="flex items-center gap-1.5 h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Plus size={15} /> Create Custom Rule
          </button>
        </div>
      </div>

      {/* Category Pills & Preset Selector Cards */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2 shrink-0 flex items-center gap-1">
            <Filter size={13} /> Filter Category:
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}
        </div>

        {/* Presets List Grid with Full Non-Truncated Names */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPresets.map(preset => {
            const isActive = activePresetId === preset.id;
            const IconComp = ICON_MAP[preset.iconName] || Sliders;
            const matchCount = callLogs.filter(c => evaluatePresetRule(c, preset)).length;

            return (
              <div
                key={preset.id}
                onClick={() => setActivePresetId(preset.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? "bg-indigo-50/70 border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-xs"
                    : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-lg shrink-0 ${
                        isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div>
                      {/* FULL NAME - NO TRUNCATION */}
                      <h4 className={`text-xs font-bold ${isActive ? "text-indigo-950" : "text-slate-800"}`}>
                        {preset.title}
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {preset.category}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 text-xs font-bold rounded-md shrink-0 ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : matchCount > 0
                        ? "bg-slate-100 text-slate-700"
                        : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    {matchCount} leads
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                  {preset.description}
                </p>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400">
                    {preset.isBuiltIn ? "System Built-in" : "Custom Rule"}
                  </span>
                  {!preset.isBuiltIn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPresetToEdit(preset);
                        setIsBuilderOpen(true);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:underline"
                    >
                      Edit Rule
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Preset Executive Analytics Banner & Cards */}
      {activePreset && summary && (
        <div className="space-y-4">
          {/* Preset Active Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-xl shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-indigo-500/30 text-indigo-300 rounded border border-indigo-400/30">
                  Active Analysis Rule
                </span>
                <span className="text-xs text-slate-300 font-medium">{activePreset.category}</span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                {activePreset.title}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">{activePreset.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition cursor-pointer"
              >
                <Download size={14} /> Export Excel ({summary.totalCount})
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Matching Leads */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matching Leads</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h4 className="text-2xl font-bold text-slate-900">{summary.totalCount}</h4>
                  <span className="text-xs font-medium text-slate-400">({matchPct}% of total)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Filtered out of {totalDatasetCount} CRM contacts</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users size={22} />
              </div>
            </div>

            {/* Call Contact Rate */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Call Contact Rate</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h4 className="text-2xl font-bold text-sky-600">{contactRate}%</h4>
                  <span className="text-xs font-medium text-slate-500">({summary.calledCount} called)</span>
                </div>
                <p className="text-[11px] text-amber-600 font-medium mt-1">
                  {summary.uncalledCount} pending first call attempt
                </p>
              </div>
              <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                <PhoneCall size={22} />
              </div>
            </div>

            {/* Reg.Done Conversions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reg.Done Admissions</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h4 className="text-2xl font-bold text-emerald-600">{summary.convertedCount}</h4>
                  <span className="text-xs font-medium text-emerald-700">({conversionRate}%)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Confirmed registrations</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </div>

          {/* Full Lead List Table Right on Page */}
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
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Lead Name & Contact</th>
                    <th className="py-3 px-4">Original Source</th>
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
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No leads match this filter criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedLeads.map((c, idx) => {
                      const callDir = determineCallType(c, c);
                      const isReg = String(c.status || c.pipelineStage || "").toLowerCase().includes("reg");
                      const attempts = c.attemptCount || (c.history ? c.history.length : 0);

                      return (
                        <tr key={c.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-800">
                            <div>{c.Name || c.name || "Unknown Lead"}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.Phone || c.phone || "—"}</div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium border border-slate-200">
                              {c.original_source || c.Source || "Direct"}
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

      {/* Preset Builder Modal */}
      {isBuilderOpen && (
        <PresetBuilderModal
          presetToEdit={presetToEdit}
          contacts={callLogs}
          onClose={() => {
            setIsBuilderOpen(false);
            setPresetToEdit(null);
          }}
          onSaved={() => {
            setPresets(getAllPresets());
            setIsBuilderOpen(false);
            setPresetToEdit(null);
          }}
        />
      )}
    </div>
  );
}
