import React, { useState } from "react";
import { 
  TrendingUp, 
  Zap, 
  Globe, 
  MessageSquare, 
  PhoneOff, 
  AlertCircle, 
  Clock, 
  Sliders, 
  Plus, 
  XCircle, 
  ChevronRight,
  Filter
} from "lucide-react";
import { evaluatePresetRule } from "../../../utils/presetEngine.js";

// Map icon names to Lucide Icon Components (No emojis used anywhere)
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

export function PresetBarWidget({
  allPresets = [],
  activePresetId = null,
  onSelectPreset,
  onOpenBuilder,
  contacts = []
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const categories = ["ALL", "Upsell & Progression", "Lead Origins", "Dropouts & Risk", "Custom"];

  const filteredPresets = allPresets.filter(p => {
    if (selectedCategory === "ALL") return true;
    if (selectedCategory === "Custom") return !p.isBuiltIn;
    return p.category === selectedCategory;
  });

  // Calculate live count badge for a preset
  const getPresetCount = (preset) => {
    if (!Array.isArray(contacts) || contacts.length === 0) return 0;
    return contacts.filter(c => evaluatePresetRule(c, preset)).length;
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl mb-6 transition-all duration-300">
      {/* Widget Header & Category Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100 tracking-tight">
                Funnel Presets & Deep Analysis
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                1-Tap Smart Rules
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Instantly analyze upsells, ad origin conversion, uncalled leads, and objection dropouts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {activePresetId && (
            <button
              onClick={() => onSelectPreset(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-rose-500/10 border border-slate-700/60 hover:border-rose-500/30 rounded-xl transition-all"
              title="Clear Active Preset Filter"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Clear Preset</span>
            </button>
          )}

          <button
            onClick={() => onOpenBuilder(null)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition-all border border-indigo-500/40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom Preset</span>
          </button>
        </div>
      </div>

      {/* Category Selection Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-3 no-scrollbar border-b border-slate-800/40">
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1 mr-1.5 shrink-0">
          <Filter className="w-3 h-3" /> Category:
        </span>
        {categories.map(cat => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all shrink-0 cursor-pointer ${
                isActive
                  ? "bg-slate-800 text-indigo-300 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          );
        })}
      </div>

      {/* Presets Pill Carousel / Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 mt-3.5">
        {filteredPresets.map(preset => {
          const isActive = activePresetId === preset.id;
          const IconComp = ICON_MAP[preset.iconName] || Sliders;
          const matchCount = getPresetCount(preset);

          return (
            <div
              key={preset.id}
              onClick={() => onSelectPreset(isActive ? null : preset.id)}
              className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo-600/20 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                  : "bg-slate-950/40 hover:bg-slate-800/50 border-slate-800/80 hover:border-slate-700/80"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div
                  className={`p-2 rounded-lg shrink-0 transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800/80 text-slate-300 group-hover:bg-slate-700 group-hover:text-white"
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4
                      className={`text-xs font-medium truncate ${
                        isActive ? "text-indigo-200 font-semibold" : "text-slate-200 group-hover:text-white"
                      }`}
                    >
                      {preset.title}
                    </h4>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {preset.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                    isActive
                      ? "bg-indigo-500/30 text-indigo-200 border-indigo-400/40"
                      : matchCount > 0
                      ? "bg-slate-800 text-slate-300 border-slate-700"
                      : "bg-slate-900/60 text-slate-500 border-slate-800"
                  }`}
                >
                  {matchCount}
                </span>

                {!preset.isBuiltIn && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenBuilder(preset);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition-all"
                    title="Edit Custom Preset"
                  >
                    <Sliders className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
