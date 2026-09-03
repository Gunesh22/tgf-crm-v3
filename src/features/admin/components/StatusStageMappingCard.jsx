import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Layers,
  Plus,
  Trash2,
  RefreshCw,
  Tag,
  AlertTriangle,
  X,
  CheckCircle2,
  Loader2,
  Target,
  GitFork,
  ArrowDown,
  CornerDownRight,
  Workflow,
  LayoutGrid
} from "lucide-react";
import { toast } from "react-hot-toast";

export const PIPELINE_STAGE_OPTIONS = [
  // Main Sales Funnel (Sequential Stages 1 to 6 & Outcomes)
  "1. New Lead",
  "2. Attempting Contact",
  "3. Information Given",
  "4. Nurture / Interested",
  "5. Future Pool",
  "6. Registered / Won",
  "Closed / Lost",
  "Closed / Invalid",
  // Parallel Workstreams & Desks
  "Query Desk",
  "Reminder Desk",
  "Previous Program Pending",
  "Existing Alumni"
];

const OBSOLETE_STATUSES = new Set([
  "Called by mistake",
  "Registered",
  "Info",
  "Not possible",
  "wrong no.",
  "Pending",
  "NA",
  "Busy",
  "Call Cut",
  "switched off",
  "no answer",
  "Not Attended",
  "Call Log Added",
  "Shivir done",
  "No Network"
]);

export const DEFAULT_STATUS_STAGE_MAPPING = {
  "Reg.Done": "6. Registered / Won",
  "Already Reg.d": "Existing Alumni",
  "Interested": "4. Nurture / Interested",
  "Previous Program Pending": "Previous Program Pending",
  "Info given": "3. Information Given",
  "Next time": "5. Future Pool",
  "reminder": "Reminder Desk",
  "Reminder Given": "Reminder Desk",
  "Reminder Pending": "Reminder Desk",
  "Query": "Query Desk",
  "Not interested": "Closed / Lost",
  "Invalid No": "Closed / Invalid",
  "Not Connected": "2. Attempting Contact"
};

const STAGE_COLORS = {
  "1. New Lead": "border-slate-300 bg-slate-50 text-slate-700",
  "2. Attempting Contact": "border-amber-300 bg-amber-50 text-amber-800",
  "3. Information Given": "border-sky-300 bg-sky-50 text-sky-800",
  "4. Nurture / Interested": "border-indigo-300 bg-indigo-50 text-indigo-800",
  "5. Future Pool": "border-teal-300 bg-teal-50 text-teal-800",
  "6. Registered / Won": "border-emerald-300 bg-emerald-50 text-emerald-800",
  "Closed / Lost": "border-rose-300 bg-rose-50 text-rose-800",
  "Closed / Invalid": "border-zinc-300 bg-zinc-50 text-zinc-800",
  "Previous Program Pending": "border-purple-300 bg-purple-50 text-purple-800",
  "Query Desk": "border-blue-300 bg-blue-50 text-blue-800",
  "Reminder Desk": "border-orange-300 bg-orange-50 text-orange-800",
  "Existing Alumni": "border-violet-300 bg-violet-50 text-violet-800"
};

const MAIN_FUNNEL_ORDER = [
  "1. New Lead",
  "2. Attempting Contact",
  "3. Information Given",
  "4. Nurture / Interested",
  "5. Future Pool",
  "6. Registered / Won"
];

export function StatusStageMappingCard({ options, onSaveMapping }) {
  // State
  const [stages, setStages] = useState(PIPELINE_STAGE_OPTIONS);
  const [mapping, setMapping] = useState({});
  const [customStatuses, setCustomStatuses] = useState([]);
  const [removedStatuses, setRemovedStatuses] = useState([]);
  const [search, setSearch] = useState("");
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [viewMode, setViewMode] = useState("flowchart"); // "flowchart" | "grid"

  // New Stage modal/inline
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");

  // New Status modal/inline
  const [addingStatusTargetStage, setAddingStatusTargetStage] = useState(null);
  const [newStatusName, setNewStatusName] = useState("");

  // Stage Delete Confirmation Modal
  const [stageToDelete, setStageToDelete] = useState(null);

  // Sync options from props
  useEffect(() => {
    const initialMapping = { ...DEFAULT_STATUS_STAGE_MAPPING, ...(options?.statusStageMapping || {}) };
    setMapping(initialMapping);

    if (Array.isArray(options?.pipelineStages) && options.pipelineStages.length > 0) {
      setStages(options.pipelineStages);
    } else {
      setStages(PIPELINE_STAGE_OPTIONS);
    }

    if (Array.isArray(options?.statusOptions)) {
      setCustomStatuses(options.statusOptions.filter(s => Boolean(s) && !OBSOLETE_STATUSES.has(s)));
    }

    if (Array.isArray(options?.removedStatuses)) {
      setRemovedStatuses(options.removedStatuses);
    }
  }, [options]);

  // Unified list of active statuses (excluding explicitly removed ones)
  const statusOptions = useMemo(() => {
    const removedSet = new Set(removedStatuses);
    const fromDefaults = Object.keys(DEFAULT_STATUS_STAGE_MAPPING);
    const fromMapping = Object.keys(mapping);
    const set = new Set([...customStatuses, ...fromDefaults, ...fromMapping]);
    return Array.from(set).filter(st => Boolean(st) && !OBSOLETE_STATUSES.has(st) && !removedSet.has(st));
  }, [customStatuses, mapping, removedStatuses]);

  // Parallel Stages Set
  const PARALLEL_KEYS = useMemo(() => new Set([
    "Query Desk",
    "Reminder Desk",
    "Previous Program Pending",
    "Existing Alumni"
  ]), []);

  const mainStagesList = useMemo(() => {
    return stages.filter(s => !PARALLEL_KEYS.has(s));
  }, [stages, PARALLEL_KEYS]);

  const parallelStagesList = useMemo(() => {
    return stages.filter(s => PARALLEL_KEYS.has(s));
  }, [stages, PARALLEL_KEYS]);

  // Central Autosave Engine
  const triggerAutoSave = useCallback(async (updatedMapping, updatedStages, updatedStatuses, updatedRemoved) => {
    setIsAutosaving(true);
    try {
      const payload = {
        statusStageMapping: updatedMapping,
        pipelineStages: updatedStages,
        statusOptions: updatedStatuses,
        removedStatuses: updatedRemoved !== undefined ? updatedRemoved : removedStatuses
      };
      await onSaveMapping(payload);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error("Autosave error:", err);
      toast.error("Failed to auto-save settings: " + err.message);
    } finally {
      setIsAutosaving(false);
    }
  }, [onSaveMapping, removedStatuses]);

  // Handle stage change for a status
  const handleChangeStage = (status, newStage) => {
    const updatedMapping = { ...mapping, [status]: newStage };
    setMapping(updatedMapping);
    triggerAutoSave(updatedMapping, stages, statusOptions, removedStatuses);
  };

  // Add new stage
  const handleAddStageSubmit = (e) => {
    e?.preventDefault();
    const trimmed = newStageName.trim();
    if (!trimmed) {
      toast.error("Please enter a valid stage name.");
      return;
    }
    if (stages.includes(trimmed)) {
      toast.error("A stage with this name already exists.");
      return;
    }
    const updatedStages = [...stages, trimmed];
    setStages(updatedStages);
    setNewStageName("");
    setIsAddingStage(false);
    toast.success(`Added stage "${trimmed}"`);
    triggerAutoSave(mapping, updatedStages, statusOptions, removedStatuses);
  };

  // Confirm delete stage
  const handleConfirmDeleteStage = () => {
    if (!stageToDelete) return;
    if (stages.length <= 1) {
      toast.error("Cannot delete stage. At least one pipeline stage is required.");
      setStageToDelete(null);
      return;
    }

    const updatedStages = stages.filter(s => s !== stageToDelete);
    const fallbackStage = updatedStages[0] || "1. New Lead";

    // Re-map statuses in deleted stage to fallbackStage
    const updatedMapping = { ...mapping };
    Object.keys(updatedMapping).forEach(st => {
      if (updatedMapping[st] === stageToDelete) {
        updatedMapping[st] = fallbackStage;
      }
    });

    setStages(updatedStages);
    setMapping(updatedMapping);
    setStageToDelete(null);
    toast.success(`Deleted stage "${stageToDelete}". Re-mapped statuses to "${fallbackStage}".`);
    triggerAutoSave(updatedMapping, updatedStages, statusOptions, removedStatuses);
  };

  // Add new status
  const handleAddStatusSubmit = (e) => {
    e?.preventDefault();
    const trimmed = newStatusName.trim();
    if (!trimmed) {
      toast.error("Please enter a valid status name.");
      return;
    }

    const updatedRemoved = removedStatuses.filter(s => s !== trimmed);
    const targetStage = addingStatusTargetStage || stages[0] || "1. New Lead";
    const updatedMapping = { ...mapping, [trimmed]: targetStage };
    const updatedStatuses = Array.from(new Set([...customStatuses, trimmed])).filter(s => !updatedRemoved.includes(s));

    setRemovedStatuses(updatedRemoved);
    setMapping(updatedMapping);
    setCustomStatuses(updatedStatuses);
    setNewStatusName("");
    setAddingStatusTargetStage(null);
    toast.success(`Added status "${trimmed}" under "${targetStage}"`);
    triggerAutoSave(updatedMapping, stages, updatedStatuses, updatedRemoved);
  };

  // Remove status
  const handleRemoveStatus = (statusToRemove) => {
    const updatedRemoved = Array.from(new Set([...removedStatuses, statusToRemove]));
    const updatedMapping = { ...mapping };
    delete updatedMapping[statusToRemove];

    const updatedStatuses = customStatuses.filter(s => s !== statusToRemove);

    setRemovedStatuses(updatedRemoved);
    setMapping(updatedMapping);
    setCustomStatuses(updatedStatuses);
    toast.success(`Removed status "${statusToRemove}"`);
    triggerAutoSave(updatedMapping, stages, updatedStatuses, updatedRemoved);
  };

  // Reset Defaults
  const handleResetDefaults = () => {
    const defaultStages = PIPELINE_STAGE_OPTIONS;
    const defaultMapping = { ...DEFAULT_STATUS_STAGE_MAPPING };
    const defaultStatuses = Object.keys(defaultMapping);

    setStages(defaultStages);
    setMapping(defaultMapping);
    setCustomStatuses(defaultStatuses);
    setRemovedStatuses([]);
    toast.success("Reset to default stages and mappings.");
    triggerAutoSave(defaultMapping, defaultStages, defaultStatuses, []);
  };

  const filteredStatuses = statusOptions.filter(st =>
    st.toLowerCase().includes(search.trim().toLowerCase())
  );

  // Group statuses by Stage
  const stageGroups = stages.reduce((acc, stage) => {
    acc[stage] = [];
    return acc;
  }, {});

  filteredStatuses.forEach(status => {
    const mappedStage = mapping[status] || DEFAULT_STATUS_STAGE_MAPPING[status] || stages[0] || "1. New Lead";
    if (stageGroups[mappedStage]) {
      stageGroups[mappedStage].push(status);
    } else {
      const defaultFallback = stages[0] || "1. New Lead";
      if (!stageGroups[defaultFallback]) stageGroups[defaultFallback] = [];
      stageGroups[defaultFallback].push(status);
    }
  });

  const renderStageNode = (stage, isParallel = false) => {
    const statusesInStage = stageGroups[stage] || [];
    const stageBadgeStyle = STAGE_COLORS[stage] || "border-slate-200 bg-slate-50 text-slate-700";

    return (
      <div
        key={stage}
        className={`relative rounded-xl border shadow-xs overflow-hidden flex flex-col bg-white transition-all hover:shadow-md ${
          statusesInStage.length > 0 ? "border-slate-200/90" : "border-slate-200/60 opacity-80"
        }`}
      >
        {/* Card/Node Header */}
        <div className={`px-3 py-2 border-b flex items-center justify-between gap-1.5 ${stageBadgeStyle}`}>
          <div className="flex items-center gap-1.5 truncate">
            {isParallel ? (
              <GitFork size={13} className="text-purple-600 shrink-0" />
            ) : (
              <Target size={13} className="text-indigo-600 shrink-0" />
            )}
            <span className="font-bold text-xs tracking-tight truncate">{stage}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/90 border border-current/20">
              {statusesInStage.length}
            </span>

            {/* Add status button */}
            <button
              type="button"
              onClick={() => setAddingStatusTargetStage(stage)}
              title={`Add new status to ${stage}`}
              className="p-1 rounded hover:bg-white/60 transition text-current cursor-pointer"
            >
              <Plus size={13} />
            </button>

            {/* Delete Stage button */}
            <button
              type="button"
              onClick={() => setStageToDelete(stage)}
              title={`Delete stage "${stage}"`}
              className="p-1 rounded hover:bg-rose-100 hover:text-rose-700 transition text-current/70 cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Status List */}
        <div className="p-2.5 space-y-1.5 flex-1 min-h-[75px] max-h-[240px] overflow-y-auto">
          {statusesInStage.map(status => (
            <div
              key={status}
              className="p-1.5 bg-slate-50/90 hover:bg-slate-100 border border-slate-200/80 rounded-md flex items-center justify-between gap-1.5 text-xs group transition-all"
            >
              <div className="flex items-center gap-1 truncate flex-1 min-w-0">
                <Tag size={11} className="text-indigo-500 shrink-0" />
                <span className="font-semibold text-[11px] text-[#172033] truncate">{status}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <select
                  value={stage}
                  onChange={(e) => handleChangeStage(status, e.target.value)}
                  title={`Move ${status} to another stage`}
                  className="h-5 px-1 bg-white border border-slate-300 rounded text-[10px] font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[110px]"
                >
                  {stages.map(s => (
                    <option key={s} value={s}>
                      → {s}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleRemoveStatus(status)}
                  title={`Remove status "${status}"`}
                  className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}

          {statusesInStage.length === 0 && (
            <div className="h-12 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg text-center p-1">
              <p className="text-[11px] font-medium text-slate-400">No status</p>
              <button
                onClick={() => setAddingStatusTargetStage(stage)}
                className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <Plus size={10} /> Add Status
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Global Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E7EC] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Workflow size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#172033] tracking-tight">
                Pipeline Stage Flowchart & Mapping
              </h3>
              {/* Autosave status indicator */}
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {isAutosaving ? (
                  <>
                    <Loader2 size={11} className="animate-spin text-indigo-600" />
                    <span className="text-indigo-600 font-semibold">Autosaving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={11} className="text-emerald-600" />
                    <span>Saved automatically {lastSavedTime ? `at ${lastSavedTime}` : ""}</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-[#667085] mt-0.5">
              Visual vertical pipeline flowchart mapping sequential sales steps and parallel workstreams.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode("flowchart")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === "flowchart"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Workflow size={13} /> Flowchart View
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid size={13} /> Card Grid
            </button>
          </div>

          {/* Add New Stage button */}
          <button
            onClick={() => setIsAddingStage(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Plus size={14} /> Add Stage
          </button>

          {/* Add New Status button */}
          <button
            onClick={() => setAddingStatusTargetStage(stages[0] || "1. New Lead")}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Plus size={14} /> Add Status
          </button>

          {/* Reset Defaults button */}
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw size={13} /> Reset Defaults
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAFBFD] p-3 rounded-lg border border-[#E4E7EC]">
        <input
          type="text"
          placeholder="Search statuses across stages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 px-3 bg-white border border-[#DDE2EA] rounded-md text-xs font-medium text-[#172033] placeholder:text-[#98A2B3] focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-72"
        />
        <span className="text-xs text-slate-500 font-medium">
          Mapped {filteredStatuses.length} Statuses across {stages.length} Pipeline Stages
        </span>
      </div>

      {/* Inline Form: Add Stage */}
      {isAddingStage && (
        <form onSubmit={handleAddStageSubmit} className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center gap-2 animate-slide-up">
          <Layers size={16} className="text-indigo-600 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Enter new pipeline stage name..."
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            className="h-8 px-3 bg-white border border-indigo-300 rounded-md text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 transition cursor-pointer"
          >
            Save Stage
          </button>
          <button
            type="button"
            onClick={() => { setIsAddingStage(false); setNewStageName(""); }}
            className="p-1.5 text-slate-500 hover:text-slate-700 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </form>
      )}

      {/* Inline Form: Add Status */}
      {addingStatusTargetStage && (
        <form onSubmit={handleAddStatusSubmit} className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2 animate-slide-up">
          <Tag size={16} className="text-emerald-600 shrink-0" />
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Enter new status name (e.g. Discount Requested)..."
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              className="h-8 px-3 bg-white border border-emerald-300 rounded-md text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1"
            />
            <select
              value={addingStatusTargetStage}
              onChange={(e) => setAddingStatusTargetStage(e.target.value)}
              className="h-8 px-2 bg-white border border-emerald-300 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {stages.map(s => (
                <option key={s} value={s}>Stage: {s}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700 transition cursor-pointer shrink-0"
          >
            Add Status
          </button>
          <button
            type="button"
            onClick={() => { setAddingStatusTargetStage(null); setNewStatusName(""); }}
            className="p-1.5 text-slate-500 hover:text-slate-700 transition cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </form>
      )}

      {/* VIEW MODE 1: VERTICAL LIGHT THEMED FLOWCHART DIAGRAM */}
      {viewMode === "flowchart" && (
        <div className="bg-[#FAFBFD] p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-100/80 text-indigo-700 border border-indigo-200">
                <Workflow size={16} />
              </span>
              <div>
                <h4 className="text-xs font-bold tracking-wide uppercase text-indigo-950">
                  Vertical Pipeline Stage Flowchart
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Sequential Sales Funnel (Top-to-Bottom) & Parallel Auxiliary Desks.
                </p>
              </div>
            </div>
          </div>

          {/* Two-Column Flowchart Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUMN 1: Main Sales Pipeline Vertical Chain (8 cols on lg) */}
            <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Target size={15} className="text-indigo-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  MAIN SALES FUNNEL (Vertical Flow 1 ➔ 6)
                </span>
              </div>

              <div className="flex flex-col items-center space-y-2 py-2">
                {MAIN_FUNNEL_ORDER.filter(s => stages.includes(s)).map((stageName, idx, arr) => (
                  <React.Fragment key={stageName}>
                    <div className="w-full">
                      {renderStageNode(stageName, false)}
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="flex items-center justify-center my-1 text-indigo-500">
                        <div className="flex flex-col items-center">
                          <div className="w-0.5 h-3 bg-indigo-200" />
                          <ArrowDown size={16} className="text-indigo-600 animate-bounce" />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* COLUMN 2: Parallel Workstreams & Closed Outcomes (5 cols on lg) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Parallel Workstreams Container */}
              <div className="bg-white p-4 rounded-xl border border-purple-200/90 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-purple-100">
                  <GitFork size={15} className="text-purple-600" />
                  <span className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                    PARALLEL WORKSTREAMS & DESKS
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Auxiliary workstreams that run in parallel alongside the main sales pipeline.
                </p>

                <div className="space-y-3 pt-1">
                  {["Previous Program Pending", "Existing Alumni", "Query Desk", "Reminder Desk"]
                    .filter(s => stages.includes(s))
                    .map(s => renderStageNode(s, true))}
                </div>
              </div>

              {/* Terminal Closed Outcomes Container */}
              <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
                  <CornerDownRight size={15} className="text-rose-600" />
                  <span className="text-xs font-bold text-rose-950 uppercase tracking-wide">
                    CLOSED TERMINAL OUTCOMES
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {["Closed / Lost", "Closed / Invalid"]
                    .filter(s => stages.includes(s))
                    .map(s => renderStageNode(s, false))}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* VIEW MODE 2: CARD GRID VIEW */}
      {viewMode === "grid" && (
        <div className="space-y-6">
          {/* CATEGORY 1: Main Sales Pipeline Funnel (Stages 1 to 6 & Outcomes) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-indigo-100">
              <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                <Target size={14} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Main Sales Pipeline Funnel (Stages 1–6 & Closed Outcomes)
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Sequential linear sales journey from initial contact to registration or closed status.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mainStagesList.map(s => renderStageNode(s, false))}
            </div>
          </div>

          {/* CATEGORY 2: Parallel Workstreams & Auxiliary Desks */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-100">
              <div className="w-6 h-6 rounded bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                <GitFork size={14} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                  Parallel Workstreams & Auxiliary Desks
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Non-linear parallel streams (Query Desk, Reminder Desk, Pending Programs, Alumni).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {parallelStagesList.map(s => renderStageNode(s, true))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Stage */}
      {stageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete Pipeline Stage</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to delete the stage <span className="font-bold text-rose-700">"{stageToDelete}"</span>?
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed font-medium">
              ⚠️ Any statuses currently assigned to this stage will automatically be moved to <span className="font-bold">"{stages.filter(s => s !== stageToDelete)[0] || '1. New Lead'}"</span>.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStageToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStage}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
              >
                Yes, Delete Stage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
