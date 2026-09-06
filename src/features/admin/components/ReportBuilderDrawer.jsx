import React, { useState, useEffect } from "react";
import { 
  X, 
  ChevronRight, 
  ArrowLeft, 
  TrendingUp, 
  Globe, 
  Clock, 
  AlertCircle, 
  Sliders, 
  Check, 
  ChevronDown,
  Sparkles
} from "lucide-react";
import { 
  evaluatePresetRule, 
  saveCustomPresets, 
  loadCustomPresets,
  createReportFromSimpleInputs 
} from "../../../utils/presetEngine.js";

const TEMPLATES = [
  {
    id: "conversion",
    title: "Program Conversion",
    description: "See how leads move from one program to another.",
    icon: TrendingUp
  },
  {
    id: "sources",
    title: "Lead Sources",
    description: "See where your leads originally came from.",
    icon: Globe
  },
  {
    id: "pending",
    title: "Pending Leads",
    description: "Find leads that still need attention.",
    icon: Clock
  },
  {
    id: "performance",
    title: "Call Performance",
    description: "See calls, outcomes and conversions.",
    icon: AlertCircle
  },
  {
    id: "custom",
    title: "Start From Scratch",
    description: "Build a custom report with your choice of filters.",
    icon: Sliders
  }
];

export function ReportBuilderDrawer({
  reportToEdit = null,
  contacts = [],
  programs = [],
  attenders = [],
  settingsOptions = {},
  onClose,
  onSaved
}) {
  const [step, setStep] = useState(reportToEdit ? 2 : 1);
  const [selectedTemplate, setSelectedTemplate] = useState("custom");

  // Form Fields State
  const [reportTitle, setReportTitle] = useState("");
  const [fromProgram, setFromProgram] = useState("Any");
  const [toProgram, setToProgram] = useState("Any");
  const [leadOrigin, setLeadOrigin] = useState("Any");
  const [currentSource, setCurrentSource] = useState("Any");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activityFilter, setActivityFilter] = useState("ALL");
  const [attenderId, setAttenderId] = useState("ALL");

  // Advanced Filters (Collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [excludePriorProgramQuery, setExcludePriorProgramQuery] = useState("");
  const [callDirection, setCallDirection] = useState("ALL");
  const [customRegexSource, setCustomRegexSource] = useState("");
  const [customRegexPrior, setCustomRegexPrior] = useState("");
  const [customRegexTarget, setCustomRegexTarget] = useState("");

  // Populate choices when editing an existing report
  useEffect(() => {
    if (reportToEdit) {
      setReportTitle(reportToEdit.title || "");
      setSelectedTemplate(reportToEdit.templateType || "custom");
      setFromProgram(reportToEdit.fromProgram || "Any");
      setToProgram(reportToEdit.toProgram || "Any");
      setLeadOrigin(reportToEdit.leadOrigin || reportToEdit.originalSource || "Any");
      setCurrentSource(reportToEdit.currentSource || reportToEdit.leadSource || "Any");
      setStatusFilter(reportToEdit.statusFilter || "ALL");
      setActivityFilter(reportToEdit.activityFilter || "ALL");
      setAttenderId(reportToEdit.attenderId || "ALL");
      
      setTagQuery(reportToEdit.tagQuery || "");
      setExcludePriorProgramQuery(reportToEdit.excludePriorProgramQuery || "");
      setCallDirection(reportToEdit.callDirection || "ALL");
      setCustomRegexSource(reportToEdit.sourceQuery || "");
      setCustomRegexPrior(reportToEdit.priorProgramQuery || "");
      setCustomRegexTarget(reportToEdit.targetProgramQuery || "");

      if (reportToEdit.tagQuery || reportToEdit.excludePriorProgramQuery || reportToEdit.callDirection !== "ALL") {
        setShowAdvanced(true);
      }
    }
  }, [reportToEdit]);

  // Options for Dropdowns
  const programList = Array.from(new Set([
    ...programs.map(p => p.name || p.title || p.id),
    ...(settingsOptions?.calledForOptions || [])
  ])).filter(Boolean).sort();

  const sourceList = Array.from(new Set([
    "Facebook",
    "Instagram",
    "YouTube",
    "Website",
    "Referral",
    "Organic",
    ...(settingsOptions?.sourceOptions || []),
    ...(contacts || []).map(c => getContactLeadOrigin(c)).filter(Boolean)
  ])).filter(Boolean).sort();

  const tagList = Array.from(new Set([
    ...(contacts || []).flatMap(c => {
      if (Array.isArray(c.tags)) return c.tags;
      if (typeof c.tags === "string") return c.tags.split(",");
      if (typeof c.Tags === "string") return c.Tags.split(",");
      return [];
    }),
    ...(settingsOptions?.tagOptions || [])
  ])).map(t => String(t).trim()).filter(Boolean).sort();

  const attenderList = attenders.map(a => ({ id: a.id, name: a.name }));

  // Evaluate live matching rule object
  const currentRuleObj = createReportFromSimpleInputs({
    title: reportTitle,
    templateType: selectedTemplate,
    fromProgram,
    toProgram,
    leadOrigin,
    originalSource: leadOrigin,
    currentSource,
    leadSource: currentSource,
    statusFilter,
    activityFilter,
    attenderId,
    tagQuery,
    excludePriorProgramQuery,
    callDirection,
    customRegexSource,
    customRegexPrior,
    customRegexTarget
  });

  // Calculate live matching count
  const liveMatchCount = Array.isArray(contacts)
    ? contacts.filter(c => evaluatePresetRule(c, currentRuleObj)).length
    : 0;

  const handleSelectTemplate = (tmplId) => {
    setSelectedTemplate(tmplId);
    if (tmplId === "conversion") {
      setFromProgram("CBT Basic");
      setToProgram("CBT Advanced");
      setLeadOrigin("Facebook");
    } else if (tmplId === "sources") {
      setLeadOrigin("Facebook");
    } else if (tmplId === "pending") {
      setActivityFilter("UNCALLED");
    } else if (tmplId === "performance") {
      setStatusFilter("Reg.Done");
    }
    setStep(2);
  };

  const handleSave = () => {
    const reportObj = {
      ...currentRuleObj,
      id: reportToEdit ? reportToEdit.id : `custom_report_${Date.now()}`
    };

    const existingCustom = loadCustomPresets();
    let updated;
    const index = existingCustom.findIndex(p => p.id === reportObj.id);

    if (index >= 0) {
      updated = [...existingCustom];
      updated[index] = reportObj;
    } else {
      updated = [...existingCustom, reportObj];
    }

    saveCustomPresets(updated);
    if (onSaved) onSaved(reportObj);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-xl bg-white h-full flex flex-col shadow-2xl border-l border-slate-200 overflow-hidden animate-tab-fade-in">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            {step === 2 && !reportToEdit && (
              <button
                onClick={() => setStep(1)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
                title="Back to templates"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {reportToEdit ? "Edit Report" : step === 1 ? "Create Report" : "Configure Report Filters"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 1 ? "What would you like to analyze?" : "Select simple filters to get answers instantly"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {/* STEP 1: Select Template */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Choose a Template
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {TEMPLATES.map(tmpl => {
                  const IconComp = tmpl.icon;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white rounded-lg text-slate-600 transition-colors shrink-0">
                          <IconComp size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-950">
                            {tmpl.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {tmpl.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Configure Simple Filters */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Report Title */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Report Title <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBT Basic → CBT Advanced (Facebook)"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Template Specific / Program Conversion Dropdowns */}
              {selectedTemplate === "conversion" ? (
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Program Conversion Flow
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">From Program</label>
                      <select
                        value={fromProgram}
                        onChange={e => setFromProgram(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Any">Any Program</option>
                        {programList.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">To Program</label>
                      <select
                        value={toProgram}
                        onChange={e => setToProgram(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Any">Any Program</option>
                        {programList.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Lead Origin</label>
                      <select
                        value={leadOrigin}
                        onChange={e => setLeadOrigin(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Any">Any Lead Origin</option>
                        {sourceList.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Current Source (Tag)</label>
                      <select
                        value={currentSource}
                        onChange={e => setCurrentSource(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Any">Any Current Tag</option>
                        {tagList.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* Custom / General Filters */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Target Program</label>
                      <select
                        value={toProgram}
                        onChange={e => setToProgram(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Any">Any Program</option>
                        {programList.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Previous Program</label>
                      <select
                        value={fromProgram}
                        onChange={e => setFromProgram(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Any">Any Previous Program</option>
                        {programList.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Lead Origin</label>
                      <select
                        value={leadOrigin}
                        onChange={e => setLeadOrigin(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Any">Any Lead Origin</option>
                        {sourceList.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Current Source (Tag)</label>
                      <select
                        value={currentSource}
                        onChange={e => setCurrentSource(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Any">Any Current Tag</option>
                        {tagList.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Call Status</label>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="Reg.Done">Reg.Done (Registered)</option>
                        <option value="Interested">Interested</option>
                        <option value="Info Given">Info Given</option>
                        <option value="Not Interested">Not Interested</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Call Activity</label>
                      <select
                        value={activityFilter}
                        onChange={e => setActivityFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="ALL">All Activity Levels</option>
                        <option value="UNCALLED">Uncalled (0 Calls)</option>
                        <option value="CALLED">Called (1+ Calls)</option>
                        <option value="MULTI_CALLED">Unresponsive (3+ Calls)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Attender</label>
                    <select
                      value={attenderId}
                      onChange={e => setAttenderId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      <option value="ALL">All Attenders</option>
                      {attenderList.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Live Matching Lead Badge */}
              <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Sparkles size={15} className="text-indigo-600" /> Live Match Counter
                </span>
                <span className="text-sm font-bold text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                  {liveMatchCount} matching leads
                </span>
              </div>

              {/* Collapsible Advanced Filters */}
              <div className="pt-2 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                >
                  <ChevronRight size={14} className={`transition-transform ${showAdvanced ? "rotate-90 text-indigo-600" : ""}`} />
                  <span>Advanced filters</span>
                  <span className="text-[10px] font-normal text-slate-400">(Tags, Custom Regex)</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-tab-fade-in">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Tags Matching</label>
                      <input
                        type="text"
                        placeholder="e.g. VIP or High Intent"
                        value={tagQuery}
                        onChange={e => setTagQuery(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Call Direction</label>
                      <select
                        value={callDirection}
                        onChange={e => setCallDirection(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
                      >
                        <option value="ALL">All Directions (Incoming & Outgoing)</option>
                        <option value="INCOMING">Incoming Calls Only</option>
                        <option value="OUTGOING">Outgoing Calls Only</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Custom Source Regex</label>
                      <input
                        type="text"
                        placeholder="e.g. Facebook|FB|Meta"
                        value={customRegexSource}
                        onChange={e => setCustomRegexSource(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>

          {step === 2 && (
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-2xs cursor-pointer"
            >
              <Check size={15} /> Save Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
