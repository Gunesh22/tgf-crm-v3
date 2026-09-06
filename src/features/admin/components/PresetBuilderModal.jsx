import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  Trash2, 
  Sliders, 
  TrendingUp, 
  Zap, 
  Globe, 
  MessageSquare, 
  PhoneOff, 
  AlertCircle, 
  Clock,
  Sparkles,
  Check
} from "lucide-react";
import { evaluatePresetRule, saveCustomPresets, loadCustomPresets } from "../../../utils/presetEngine.js";

const AVAILABLE_ICONS = [
  { name: "TrendingUp", label: "Upsell", icon: TrendingUp },
  { name: "Zap", label: "Direct", icon: Zap },
  { name: "Globe", label: "Ad Lead", icon: Globe },
  { name: "MessageSquare", label: "Social DM", icon: MessageSquare },
  { name: "PhoneOff", label: "Unresponsive", icon: PhoneOff },
  { name: "AlertCircle", label: "Objection", icon: AlertCircle },
  { name: "Clock", label: "Pending", icon: Clock },
  { name: "Sliders", label: "Filter", icon: Sliders }
];

export function PresetBuilderModal({
  presetToEdit = null,
  contacts = [],
  onClose,
  onSaved
}) {
  const [formData, setFormData] = useState({
    id: `custom_preset_${Date.now()}`,
    title: "",
    category: "Custom",
    description: "",
    iconName: "Sliders",
    sourceQuery: "",
    tagQuery: "",
    priorProgramQuery: "",
    targetProgramQuery: "",
    excludePriorProgramQuery: "",
    statusFilter: "ALL",
    activityFilter: "ALL",
    callDirection: "ALL",
    attenderId: "ALL",
    isBuiltIn: false
  });

  useEffect(() => {
    if (presetToEdit) {
      setFormData({
        id: presetToEdit.id || `custom_preset_${Date.now()}`,
        title: presetToEdit.title || "",
        category: presetToEdit.category || "Custom",
        description: presetToEdit.description || "",
        iconName: presetToEdit.iconName || "Sliders",
        sourceQuery: presetToEdit.sourceQuery || "",
        tagQuery: presetToEdit.tagQuery || "",
        priorProgramQuery: presetToEdit.priorProgramQuery || "",
        targetProgramQuery: presetToEdit.targetProgramQuery || "",
        excludePriorProgramQuery: presetToEdit.excludePriorProgramQuery || "",
        statusFilter: presetToEdit.statusFilter || "ALL",
        activityFilter: presetToEdit.activityFilter || "ALL",
        callDirection: presetToEdit.callDirection || "ALL",
        attenderId: presetToEdit.attenderId || "ALL",
        isBuiltIn: !!presetToEdit.isBuiltIn
      });
    }
  }, [presetToEdit]);

  // Live match counter evaluation
  const liveMatchCount = Array.isArray(contacts)
    ? contacts.filter(c => evaluatePresetRule(c, formData)).length
    : 0;

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert("Please provide a name for this custom preset.");
      return;
    }

    const existingCustom = loadCustomPresets();
    let updated;
    const index = existingCustom.findIndex(p => p.id === formData.id);

    if (index >= 0) {
      updated = [...existingCustom];
      updated[index] = formData;
    } else {
      updated = [...existingCustom, formData];
    }

    saveCustomPresets(updated);
    if (onSaved) onSaved(formData);
    onClose();
  };

  const handleDelete = () => {
    if (formData.isBuiltIn) return;
    if (!confirm("Are you sure you want to delete this custom preset?")) return;

    const existingCustom = loadCustomPresets();
    const updated = existingCustom.filter(p => p.id !== formData.id);
    saveCustomPresets(updated);
    if (onSaved) onSaved(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {presetToEdit ? "Edit Custom Preset Rule" : "Create Universal Preset Rule"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Define dynamic matching rules with client-side JS regex logic (100% customizable)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{liveMatchCount} Leads Matching</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-200">
          {/* General Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Preset Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., CBT Basic to Advanced Upsell"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Preset Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Upsell & Progression">Upsell & Progression</option>
                <option value="Lead Origins">Lead Origins</option>
                <option value="Dropouts & Risk">Dropouts & Risk</option>
                <option value="Custom">Custom Category</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Description / Notes</label>
            <input
              type="text"
              placeholder="e.g. Tracks Facebook leads who took basic program and upgraded"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-slate-400 font-medium mb-1.5">Preset Icon</label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {AVAILABLE_ICONS.map(({ name, label, icon: IconComp }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFormData({ ...formData, iconName: name })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    formData.iconName === name
                      ? "bg-indigo-600 text-white border-indigo-400"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-800/80 my-2" />

          {/* Dynamic Rule Matchers */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Rule Matching Conditions (Regex & Logic)
            </h4>

            {/* Row 1: Source & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Source / Origin Regex Pattern
                </label>
                <input
                  type="text"
                  placeholder="e.g. Facebook|FB|Meta"
                  value={formData.sourceQuery}
                  onChange={(e) => setFormData({ ...formData, sourceQuery: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Matches original lead source field</span>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Lead Tags Regex Pattern
                </label>
                <input
                  type="text"
                  placeholder="e.g. High Intent|VIP"
                  value={formData.tagQuery}
                  onChange={(e) => setFormData({ ...formData, tagQuery: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Matches tags array or string</span>
              </div>
            </div>

            {/* Row 2: Prior Program & Target Program */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Prior Program Alumni History Regex
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBT.*Basic|Basic"
                  value={formData.priorProgramQuery}
                  onChange={(e) => setFormData({ ...formData, priorProgramQuery: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Matches past programs in lead history</span>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Target Program Regex
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBT.*Adv|Advanced"
                  value={formData.targetProgramQuery}
                  onChange={(e) => setFormData({ ...formData, targetProgramQuery: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Matches current "Called For" program</span>
              </div>
            </div>

            {/* Row 3: Exclude Prior Program & Pipeline Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Exclude Prior Program Regex (Direct Enrolls)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBT.*Basic|Basic"
                  value={formData.excludePriorProgramQuery}
                  onChange={(e) => setFormData({ ...formData, excludePriorProgramQuery: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Excludes leads who took this program</span>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Pipeline Status Filter</label>
                <input
                  type="text"
                  placeholder="e.g. Reg.Done or Not Interested"
                  value={formData.statusFilter}
                  onChange={(e) => setFormData({ ...formData, statusFilter: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Use ALL, Reg.Done, or custom status regex</span>
              </div>
            </div>

            {/* Row 4: Call Activity & Call Direction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Call Attempt Activity Filter</label>
                <select
                  value={formData.activityFilter}
                  onChange={(e) => setFormData({ ...formData, activityFilter: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Call Activity Levels</option>
                  <option value="UNCALLED">Uncalled (0 Calls Made)</option>
                  <option value="CALLED">Called (1+ Attempts Made)</option>
                  <option value="MULTI_CALLED">Unresponsive Risk (3+ Attempts Made)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Call Direction Filter</label>
                <select
                  value={formData.callDirection}
                  onChange={(e) => setFormData({ ...formData, callDirection: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Directions (Incoming & Outgoing)</option>
                  <option value="INCOMING font-semibold text-emerald-400">Incoming Calls Only</option>
                  <option value="OUTGOING font-semibold text-sky-400">Outgoing Calls Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {!formData.isBuiltIn && presetToEdit ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Preset</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer border border-indigo-500/40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Preset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
