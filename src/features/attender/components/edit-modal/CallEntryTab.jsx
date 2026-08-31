import React, { useRef, useMemo, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Phone, Tag, CheckCircle2, AlertCircle, MessageSquare,
  CalendarDays, Flame, HelpCircle, Bell, ArrowRightLeft, Shield, Info, History, RotateCw, Loader, X, Check, Plus, Undo2
} from "lucide-react";
import SearchableDropdown from "./SearchableDropdown";
import HistoryTimeline from "./HistoryTimeline";
import StageInfoModal from "./StageInfoModal";
import {
  CALL_DIRECTION_OPTIONS,
  CALL_PURPOSE_OPTIONS,
  CALL_STATUS_OPTIONS,
  SALES_OUTCOME_OPTIONS,
  QUERY_STATUS_OPTIONS,
  REMINDER_OUTCOME_OPTIONS,
  CALLED_FOR_OPTIONS,
  SOURCE_OPTIONS,
  CALL_SOURCE_OPTIONS,
  OBJECTION_REASONS
} from "../../utils";
import { evaluatePipeline, getPipelineStageConfig, getEffectiveStage, shouldShowConvertToSales, PIPELINE_STAGES } from "../../../../utils/pipelineEngine";
import { overridePipelineStage } from "../../../../lib/db";

const CORE_OVERRIDE_STAGES = [
  PIPELINE_STAGES.NEW_LEAD,
  PIPELINE_STAGES.ATTEMPTING,
  PIPELINE_STAGES.INFO_GIVEN,
  PIPELINE_STAGES.NURTURE_INTERESTED,
  PIPELINE_STAGES.FUTURE_POOL,
  PIPELINE_STAGES.REGISTERED_WON,
  PIPELINE_STAGES.CLOSED_LOST,
  PIPELINE_STAGES.CLOSED_INVALID,
];

export const CallEntryTab = ({
  edited,
  row,
  callTheme,
  calledForField,
  sourceField,
  getEditable,
  handleChange,
  handleCallTypeChange,
  getOtherValuesForField,
  mergedHistory,
  setShowCalledForPrompt,
  setPromptSelection,
  setPendingSave,
  setShowUndoStatusPrompt,
  setEdited,
  getCallbackDateStr,
  onShowEditHistory,
  activeAttenderId = "attender",
  activeAttenderName = "Attender",
  isAdmin = false,
  onRefreshLead
}) => {
  const newNoteRef = useRef(null);

  // Stage Override states
  const [showStageOverridePicker, setShowStageOverridePicker] = useState(false);
  const [selectedTargetStage, setSelectedTargetStage] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Follow-up reschedule & add next states
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isAddingNext, setIsAddingNext] = useState(false);
  const [tempDate, setTempDate] = useState("");
  const [tempTime, setTempTime] = useState("");
  const [prevFollowupState, setPrevFollowupState] = useState(null);

  const saveFollowupSnapshot = () => {
    setPrevFollowupState({
      callbackDate: edited.callbackDate || "",
      callbackTime: edited.callbackTime || "",
      callbackStatus: edited.callbackStatus || "pending"
    });
  };

  const handleUndoFollowup = () => {
    if (prevFollowupState) {
      handleChange("callbackDate", prevFollowupState.callbackDate);
      handleChange("callbackTime", prevFollowupState.callbackTime);
      handleChange("callbackStatus", prevFollowupState.callbackStatus);
      setPrevFollowupState(null);
      setIsRescheduling(false);
      setIsAddingNext(false);
      toast.success("Follow-up action undone");
    } else {
      handleChange("callbackStatus", "pending");
      setIsRescheduling(false);
      setIsAddingNext(false);
      toast.success("Restored follow-up to Pending");
    }
  };

  const formatFollowupDateStr = (dateVal) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const currentCbStatus = edited.callbackStatus || "pending";
  const hasActivePendingFollowup = !!edited.callbackDate && (currentCbStatus === "pending" || currentCbStatus === "rescheduled");
  const isFollowupCompleted = currentCbStatus === "done" || currentCbStatus === "completed";
  const isFollowupCancelled = currentCbStatus === "cancelled";

  // Reset override state & follow-up mode states whenever active contact changes
  const activeContactId = edited._id || edited.id || row._id || row.id;
  useEffect(() => {
    setShowStageOverridePicker(false);
    setSelectedTargetStage(null);
    setOverrideReason("");
    setIsRescheduling(false);
    setIsAddingNext(false);
    setTempDate("");
    setTempTime("");
    setPrevFollowupState(null);
  }, [activeContactId]);

  const handleConfirmStageOverride = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    if (!selectedTargetStage) return;

    setIsSubmittingOverride(true);
    try {
      const contactId = edited._id || edited.id || row._id || row.id;
      const res = await overridePipelineStage(
        contactId,
        selectedTargetStage,
        activeAttenderId,
        activeAttenderName,
        isAdmin ? "admin" : "attender",
        overrideReason
      );
      if (res && res.success) {
        toast.success(`Pipeline stage updated to "${res.newStage}"`);
        setEdited(prev => ({
          ...prev,
          pipelineStage: res.newStage,
          closedReason: res.contact?.closedReason ?? prev.closedReason,
          history: res.auditHistoryItem ? [res.auditHistoryItem, ...(prev.history || [])] : prev.history
        }));
        if (typeof onRefreshLead === "function") {
          onRefreshLead();
        }
        setShowStageOverridePicker(false);
        setSelectedTargetStage(null);
        setOverrideReason("");
      } else {
        toast.error(res?.error || "Failed to override pipeline stage");
      }
    } catch (err) {
      console.error("[Stage Override Error]", err);
      toast.error(err.message || "Failed to override pipeline stage");
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Compute active Call Purpose (SALES, QUERY, REMINDER)
  const activePurpose = String(edited.callPurpose || "SALES").toUpperCase();
  
  // Compute active Call Status (Connected vs Unconnected vs blank)
  const activeCallStatus = edited.callStatus || "";

  // Filter Sales Called For options (exclude Query/Reminder)
  const salesCalledForOptions = CALLED_FOR_OPTIONS.filter(o => o !== "Reminder" && o !== "Query");

  const selectedProgram = String(edited[calledForField] || "").trim();

  const evalResult = evaluatePipeline(
    edited,
    {
      callPurpose: activePurpose,
      callStatus: activeCallStatus,
      purposeOutcome: edited.status,
      queryStatus: edited.queryStatus,
      calledFor: selectedProgram
    }
  );

  // Direct DB pipeline stage display for modal header (previews evalResult stage only when user selects today's outcome)
  const dbStage = getEffectiveStage(edited, selectedProgram) || edited.pipelineStage || row.pipelineStage;
  const displayStage = (edited.status && edited.callStatus) ? evalResult.pipelineStage : dbStage;
  const stageConfig = getPipelineStageConfig(displayStage);

  // Whether this contact qualifies for "Convert to Sales" (only for new/query-only contacts)
  const showConvertToSales = useMemo(() => shouldShowConvertToSales(edited), [edited]);

  const programRegInfo = useMemo(() => {
    const rawProgram = selectedProgram || String(edited[calledForField] || "").trim();
    if (!rawProgram) return { exists: false, program: "" };
    const progArr = rawProgram.split(",").map(p => p.trim()).filter(Boolean);
    const targetProg = progArr[0] || rawProgram;
    const targetKey = targetProg.toLowerCase().replace(/[^a-z0-9]/g, "-");
    
    // Check programRelationships
    const rels = Array.isArray(edited.programRelationships) ? edited.programRelationships : Array.isArray(row.programRelationships) ? row.programRelationships : [];
    const foundRel = rels.find(p => {
      if (!p) return false;
      const pStr = typeof p === "string" ? p : (p.calledForKey || p.calledFor || p.program || p["Called For"] || "");
      const pKey = String(pStr).toLowerCase().replace(/[^a-z0-9]/g, "-");
      const pStat = typeof p === "string" ? "" : String(p.status || "").toLowerCase();
      return pKey === targetKey && (pStat.includes("registered") || pStat.includes("reg_done") || pStat.includes("alumni"));
    });
    if (foundRel) {
      return { exists: true, registrationId: foundRel.registrationId || null, program: targetProg };
    }

    // Check registrations
    const regs = Array.isArray(edited.registrations) ? edited.registrations : Array.isArray(row.registrations) ? row.registrations : [];
    const foundReg = regs.find(r => {
      if (!r) return false;
      const rStr = typeof r === "string" ? r : (r.calledForKey || r.calledFor || r.program || r["Called For"] || "");
      const rKey = String(rStr).toLowerCase().replace(/[^a-z0-9]/g, "-");
      return rKey === targetKey;
    });
    if (foundReg) {
      return { exists: true, registrationId: foundReg.registrationId || null, program: targetProg };
    }

    // Check call history for past Reg.Done calls for THIS EXACT program
    const hist = Array.isArray(mergedHistory) ? mergedHistory : Array.isArray(edited.history) ? edited.history : Array.isArray(row.history) ? row.history : [];
    const foundHistReg = hist.find(h => {
      if (!h) return false;
      const hStatus = String(h?.status || h?.Status || "").trim().toLowerCase();
      if (hStatus !== "reg.done" && hStatus !== "registered") return false;
      const hProg = String(h?.calledFor || h?.calledForKey || h?.program || h?.["Called For"] || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
      return hProg === targetKey;
    });
    if (foundHistReg) {
      return { exists: true, registrationId: null, program: targetProg };
    }

    return { exists: false, program: targetProg };
  }, [selectedProgram, edited, row, calledForField, mergedHistory]);

  const setCallPurpose = (purpose) => {
    setEdited(prev => {
      const next = { ...prev, callPurpose: purpose };
      const isUnconnected = ["Not Connected", "Not Picked Up", "NA", "Busy", "Call Cut", "switched off", "no answer", "Not Attended", "No Network", "Invalid Number", "Invalid No"].includes(prev.status) || (prev.callStatus && prev.callStatus !== "Connected");

      if (isUnconnected) {
        if (!next.status) next.status = "Not Connected";
      } else if (purpose === "QUERY") {
        next.status = "Query";
        if (!next.queryStatus) next.queryStatus = "Pending";
      } else if (purpose === "REMINDER") {
        if (!REMINDER_OUTCOME_OPTIONS.includes(prev.status)) {
          next.status = "";
        }
      } else {
        if (["Reminder Given", "Reminder Confirmed", "Asked Question", "Needs Assistance", "Query"].includes(next.status)) {
          next.status = "";
        }
      }
      return next;
    });
  };

  const handleCallStatusClick = (cStatus) => {
    setEdited(prev => {
      const next = { ...prev, callStatus: cStatus };
      if (cStatus !== "Connected") {
        if (cStatus === "Invalid Number") {
          next.status = "Invalid Number";
        } else if (cStatus === "Not Picked Up" || cStatus === "Not Connected") {
          if (!["Not Connected", "Not Picked Up", "NA", "Busy", "Call Cut", "switched off", "no answer", "Not Attended", "No Network"].includes(prev.status)) {
            next.status = "Not Connected";
          }
        }
      } else if (prev.callStatus !== "Connected") {
        next.status = "";
      }
      return next;
    });
  };

  // Determine primary Call Result (Connected, Not Connected, Invalid Number, or Blank)
  const isInvalid = edited.callStatus === "Invalid Number" || edited.status === "Invalid Number" || edited.status === "Invalid No";
  const isUnconnectedReason = ["Not Connected", "Not Picked Up", "NA", "Busy", "Call Cut", "switched off", "no answer", "Not Attended", "No Network"].includes(edited.status);
  
  const activePrimaryResult = edited.callStatus === "Connected"
    ? "Connected"
    : edited.callStatus === "Not Connected" || (edited.callStatus !== "" && isUnconnectedReason)
    ? "Not Connected"
    : isInvalid
    ? "Invalid Number"
    : "";

  const handlePrimaryResultChange = (res) => {
    setEdited(prev => {
      const next = { ...prev, callStatus: res };
      if (res === "Connected") {
        if (isUnconnectedReason || prev.status === "Invalid Number" || prev.status === "Invalid No") {
          next.status = "";
        }
      } else if (res === "Not Connected") {
        next.status = isUnconnectedReason ? prev.status : "Not Connected";
      } else if (res === "Invalid Number") {
        next.status = "Invalid Number";
      }
      return next;
    });
  };

  const lastCall = useMemo(() => {
    if (!mergedHistory || !Array.isArray(mergedHistory) || mergedHistory.length === 0) return null;
    const sorted = [...mergedHistory].sort((a, b) => {
      const getMs = (val) => {
        if (!val) return 0;
        if (val instanceof Date) return val.getTime();
        if (typeof val === "string") return new Date(val).getTime() || 0;
        if (val.toDate && typeof val.toDate === "function") return val.toDate().getTime() || 0;
        if (typeof val === "object" && val.seconds !== undefined) return val.seconds * 1000;
        return 0;
      };
      return getMs(b.timestamp) - getMs(a.timestamp); // Newest first
    });
    return sorted[0];
  }, [mergedHistory]);

  const lastCallTime = lastCall?.timestamp
    ? new Date(lastCall.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : (row.lastCalledAt || row.updatedAt ? new Date(row.lastCalledAt || row.updatedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : null);

  const primaryCallStatus = lastCall?.callStatus || lastCall?.status || "";
  const secondaryCallStatus = (lastCall?.status && String(lastCall.status).trim().toLowerCase() !== String(primaryCallStatus).trim().toLowerCase())
    ? lastCall.status
    : null;

  console.log("ACTUAL CURRENT STAGE BADGE:", {
    rowPipelineStage: row?.pipelineStage,
    editedPipelineStage: edited?.pipelineStage,
    dbStage,
    displayStage,
    stageConfigLabel: stageConfig?.label
  });

  const [showStageInfoModal, setShowStageInfoModal] = useState(false);

  return (
    <div className="space-y-5 md:space-y-6 text-xs bg-white">
      
      {/* 0. READ-ONLY HEADER: PIPELINE STAGE & LAST CALL CONTEXT */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/80 border border-slate-200/60 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Shield size={14} className="text-indigo-600 shrink-0" />
          <span>Current Stage:</span>
          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${stageConfig.badge}`}>
            {stageConfig.label}
          </span>
          <button
            type="button"
            onClick={() => setShowStageInfoModal(true)}
            className="w-5 h-5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[11px] border border-indigo-200 transition-all cursor-pointer hover:scale-105 shrink-0"
            title="Click for information about all pipeline stages"
          >
            i
          </button>

          {/* Compact Change Stage Popover */}
          <div className="relative inline-block ml-1">
            <button
              type="button"
              onClick={() => {
                setShowStageOverridePicker(prev => !prev);
                setSelectedTargetStage(null);
                setOverrideReason("");
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Manually change or reopen contact pipeline stage"
            >
              <RotateCw size={11} className={showStageOverridePicker ? "rotate-180 transition-transform" : ""} />
              <span>{showStageOverridePicker ? "Close" : "Change Stage"}</span>
            </button>

            {/* POPOVER DROPDOWN */}
            {showStageOverridePicker && (
              <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-50 animate-fade-in text-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 text-xs">
                  <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                    <Shield size={14} className="text-indigo-600" />
                    <span>Change Stage {isAdmin ? "(Admin)" : ""}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStageOverridePicker(false);
                      setSelectedTargetStage(null);
                      setOverrideReason("");
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-medium mb-2 flex items-center gap-1.5">
                  <span>Current Stage:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${stageConfig.badge}`}>
                    {stageConfig.label}
                  </span>
                </div>

                {/* Stage List Options */}
                <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5 mb-2.5">
                  {CORE_OVERRIDE_STAGES.map((stageName) => {
                    const cfg = getPipelineStageConfig(stageName);
                    const isCurrent = stageConfig.label === cfg.label || displayStage === stageName;
                    const isSelected = selectedTargetStage === stageName;

                    if (isCurrent) {
                      return (
                        <div
                          key={stageName}
                          type="button"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100/80 text-slate-400 text-xs font-semibold flex items-center justify-between opacity-60 cursor-not-allowed select-none"
                        >
                          <span className="font-bold">{cfg.label}</span>
                          <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Current</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={stageName}
                        type="button"
                        onClick={() => setSelectedTargetStage(stageName)}
                        className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "ring-2 ring-indigo-600 bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs"
                            : `${cfg.bg} ${cfg.border} ${cfg.text} hover:opacity-90 hover:scale-[1.005]`
                        }`}
                      >
                        <span>{cfg.label}</span>
                        {isSelected && <Check size={14} className="text-indigo-600 font-black" />}
                      </button>
                    );
                  })}
                </div>

                {selectedTargetStage && (
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2.5 animate-slide-up">
                    <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span>{stageConfig.label}</span>
                      <span className="text-indigo-600 font-black">→</span>
                      <span className="text-indigo-700 font-black">{getPipelineStageConfig(selectedTargetStage).label}</span>
                    </div>

                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Reason / remark (optional)..."
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />

                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTargetStage(null);
                          setOverrideReason("");
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingOverride}
                        onClick={handleConfirmStageOverride}
                        className="px-3.5 py-1.5 text-[11px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingOverride ? <Loader size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                        <span>Move to {getPipelineStageConfig(selectedTargetStage).label.split(". ")[1] || getPipelineStageConfig(selectedTargetStage).label}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activePrimaryResult ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs animate-fade-in">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>Call Attempted ✓ ({activePrimaryResult} • {activePurpose})</span>
            </div>
          ) : lastCall ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Last Call:</span>
              <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] uppercase border ${
                primaryCallStatus === "Connected" || lastCall.status === "Info Given"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}>
                {primaryCallStatus}
              </span>
              {secondaryCallStatus && (
                <span className="text-slate-700 font-semibold">• {secondaryCallStatus}</span>
              )}
              {lastCallTime && (
                <span className="text-slate-400 font-normal">({lastCallTime})</span>
              )}
              {mergedHistory && mergedHistory.length > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">
                  {mergedHistory.length} calls total
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">No previous call history</span>
          )}
        </div>
      </div>


      {/* 1. CALL DIRECTION & CALL PURPOSE ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center relative z-20">
        {/* Call Direction */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Call Direction
          </label>
          <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60">
            {["outgoing", "incoming"].map(opt => {
              const isSelected = (edited.callType || "outgoing").toLowerCase().startsWith(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleCallTypeChange(opt)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer capitalize ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-transparent text-slate-600 border-transparent hover:text-slate-900"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Call Purpose Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Call Purpose <span className="text-rose-500 font-bold">*</span>
          </label>
          <SearchableDropdown
            options={["Sales", "Query", "Reminder"]}
            selected={activePurpose === "QUERY" ? "Query" : activePurpose === "REMINDER" ? "Reminder" : activePurpose === "SALES" ? "Sales" : ""}
            onChange={val => {
              setCallPurpose(val ? val.toUpperCase() : "");
            }}
            placeholder="Select Call Purpose..."
            colorClass="indigo"
          />
        </div>
      </div>

      {/* 2. PROGRAM & ORIGINAL SOURCE (SALES MODE / UNSELECTED) */}
      {(activePurpose === "SALES" || activePurpose === "") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-30 animate-fade-in">
          {/* Program (Called For) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Program (Called For) <span className="text-rose-500 font-bold">*</span>
            </label>
            <SearchableDropdown
              options={salesCalledForOptions}
              selected={String(edited[calledForField] || "")}
              onChange={val => handleChange(calledForField, val)}
              placeholder="Select program..."
              isMulti={true}
              colorClass="indigo"
              disabled={!getEditable(calledForField)}
            />
          </div>

          {/* Call Source (Current Call) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Call Source (Current Call) <span className="text-rose-500 font-bold">*</span>
              </label>
              {(edited.original_source || row.original_source || edited.originalSource) && (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200" title="Permanent Original Acquisition Source">
                  Orig: <strong className="text-slate-700 font-bold">{edited.original_source || row.original_source || edited.originalSource}</strong>
                </span>
              )}
            </div>
            <SearchableDropdown
              options={CALL_SOURCE_OPTIONS}
              selected={String(edited[sourceField] || edited.Source || edited.source || "")}
              onChange={val => handleChange(sourceField, val)}
              placeholder="Select call source..."
              colorClass="amber"
              disabled={!getEditable(sourceField)}
            />
          </div>
        </div>
      )}

      {/* --- QUERY CONTEXT BANNER --- */}
      {activePurpose === "QUERY" && (
        <div className="p-3 bg-orange-50/70 border border-orange-200/80 rounded-xl flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-orange-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-orange-950 text-xs">Query / Helpdesk Mode</span>
              <p className="text-[11px] text-orange-800 leading-tight mt-0.5">
                Pipeline stage is preserved. Select the program this query concerns.
              </p>
            </div>
          </div>
          {/* Only show Convert-to-Sales for NEW / query-only contacts (rank < Info Given) */}
          {showConvertToSales && (
            <button
              type="button"
              onClick={() => setCallPurpose("SALES")}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 flex items-center gap-1 transition cursor-pointer shadow-2xs shrink-0"
            >
              <ArrowRightLeft size={12} /> Convert to Sales
            </button>
          )}
        </div>
      )}

      {/* --- REMINDER CONTEXT BANNER — NO Convert-to-Sales button --- */}
      {activePurpose === "REMINDER" && (
        <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl flex items-center gap-3 animate-fade-in">
          <Bell size={16} className="text-sky-600 shrink-0" />
          <div>
            <span className="font-bold text-sky-950 text-xs">Event / Shivir Reminder Mode</span>
            <p className="text-[11px] text-sky-800 leading-tight">
              {edited[calledForField] ? `Program: ${edited[calledForField]}` : "Pipeline stage is preserved. No sales conversion from Reminder."}
            </p>
          </div>
        </div>
      )}

      {/* QUERY: Program & Call Source grid (2-column) */}
      {activePurpose === "QUERY" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-30 animate-fade-in">
          {/* Query About (Program / Context) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Query About (Program / Context)
            </label>
            <SearchableDropdown
              options={salesCalledForOptions}
              selected={String(edited[calledForField] || "")}
              onChange={val => handleChange(calledForField, val)}
              placeholder="Which program is this query about?"
              colorClass="orange"
              disabled={!getEditable(calledForField)}
            />
          </div>

          {/* Call Source (Current Call) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Call Source (Current Call) <span className="text-rose-500 font-bold">*</span>
              </label>
              {(edited.original_source || row.original_source || edited.originalSource) && (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200" title="Permanent Original Acquisition Source">
                  Orig: <strong className="text-slate-700 font-bold">{edited.original_source || row.original_source || edited.originalSource}</strong>
                </span>
              )}
            </div>
            <SearchableDropdown
              options={CALL_SOURCE_OPTIONS}
              selected={String(edited[sourceField] || edited.Source || edited.source || edited.original_source || row.original_source || edited.originalSource || "")}
              onChange={val => handleChange(sourceField, val)}
              placeholder="Select call source..."
              colorClass="amber"
              disabled={!getEditable(sourceField)}
            />
          </div>
        </div>
      )}

      {/* 3. CALL RESULT & OUTCOME (2-COLUMN GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start relative z-10">
        {/* Call Result Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            Call Result <span className="text-rose-500 font-bold">*</span>
          </label>
          <SearchableDropdown
            options={["Connected", "Not Connected", "Invalid Number"]}
            selected={activePrimaryResult || ""}
            onChange={val => {
              if (val) handlePrimaryResultChange(val);
            }}
            placeholder="[ Select Call Result... ]"
            colorClass="indigo"
          />
        </div>

        {/* Outcome Selector Column */}
        <div>
          {/* CONNECTED SALES OUTCOME DROPDOWN */}
          {activePrimaryResult === "Connected" && activePurpose === "SALES" && (
            <div className="space-y-1.5 relative z-20 animate-fade-in">
              <label className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                Connected Outcome <span className="text-rose-500 font-bold">*</span>
              </label>
              <SearchableDropdown
                options={SALES_OUTCOME_OPTIONS}
                selected={edited.status || ""}
                onChange={val => {
                  if (!val) return;
                  if (val === "Reg.Done") {
                    const calledForVal = edited[calledForField] || "";
                    const selectedArr = calledForVal.split(",").map(x => x.trim()).filter(Boolean);
                    if (selectedArr.length !== 1 && CALLED_FOR_OPTIONS.length > 1) {
                      setPromptSelection("");
                      setPendingSave(false);
                      setShowCalledForPrompt(true);
                      return;
                    }
                  }
                  handleChange("status", val);
                }}
                placeholder="[ Select outcome... ]"
                colorClass="indigo"
              />

              {/* Registration Status Indicator Banner */}
              {programRegInfo.program && (programRegInfo.exists || edited.status === "Reg.Done") && (
                <div className={`mt-2 p-2.5 rounded-xl border flex items-start gap-2 animate-fade-in shadow-2xs ${
                  programRegInfo.exists 
                    ? "bg-sky-50/90 border-sky-300/80 text-sky-950" 
                    : "bg-emerald-50/90 border-emerald-300/80 text-emerald-950"
                }`}>
                  {programRegInfo.exists ? (
                    <Info size={16} className="text-sky-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span>{programRegInfo.exists ? "🔵 Existing Registration" : "🟢 New Registration"}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        programRegInfo.exists 
                          ? "bg-sky-200/80 text-sky-900 border-sky-300" 
                          : "bg-emerald-200/80 text-emerald-900 border-emerald-300"
                      }`}>
                        {programRegInfo.program}
                      </span>
                    </div>
                    <div className={`text-[11px] font-medium mt-0.5 leading-tight ${
                      programRegInfo.exists ? "text-sky-800" : "text-emerald-800"
                    }`}>
                      {programRegInfo.exists ? (
                        <>Already registered for <strong>{programRegInfo.program}</strong>. This call will be logged as a call/update against the existing registration. <strong>No new registration record will be created.</strong></>
                      ) : (
                        <>No existing registration for <strong>{programRegInfo.program}</strong>. Saving will create 1 new registration record.</>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONNECTED QUERY OUTCOME */}
          {activePrimaryResult === "Connected" && activePurpose === "QUERY" && (
            <div className="space-y-2 animate-fade-in">
              <label className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                Query Status <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="flex gap-2">
                {QUERY_STATUS_OPTIONS.map(qs => {
                  const currentQueryStatus = edited.queryStatus || "Pending";
                  return (
                    <button
                      key={qs}
                      type="button"
                      onClick={() => handleChange("queryStatus", qs)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        currentQueryStatus === qs
                          ? qs === "Pending"
                            ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                            : "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {qs === "Pending" ? "⏳ Pending" : "✓ Solved"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CONNECTED REMINDER OUTCOME */}
          {activePrimaryResult === "Connected" && activePurpose === "REMINDER" && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[11px] font-extrabold text-sky-900 uppercase tracking-wider flex items-center gap-1">
                Reminder Result <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_OUTCOME_OPTIONS.map(ro => (
                  <button
                    key={ro}
                    type="button"
                    onClick={() => handleChange("status", ro)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      edited.status === ro
                        ? "bg-sky-600 text-white border-sky-600 shadow-2xs font-bold"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {ro}
                  </button>
                ))}
              </div>
            </div>
          )}




        </div>
      </div>

      {/* Objection Reason for Not Interested - full width below */}
      {activePrimaryResult === "Connected" && (edited.status?.toLowerCase() === "not interested") && (
        <div className="space-y-2 p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl animate-slide-up">
          <label className="text-xs font-bold text-rose-800 flex items-center gap-1">
            <AlertCircle size={13} /> Reason for Not Interested:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {OBJECTION_REASONS.map(reason => (
              <button
                key={reason}
                type="button"
                onClick={() => handleChange("objectionReason", edited.objectionReason === reason ? "" : reason)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  edited.objectionReason === reason
                    ? "bg-rose-600 text-white border-rose-600 shadow-2xs font-bold"
                    : "bg-white text-rose-700 border-rose-200 hover:bg-rose-100"
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6. CALL NOTES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <MessageSquare size={13} className="text-slate-400" /> Call Notes
            {mergedHistory && mergedHistory.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-semibold">
                {mergedHistory.length} past
              </span>
            )}
          </label>
          {onShowEditHistory && (
            <button
              type="button"
              onClick={onShowEditHistory}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <History size={12} /> Edit Call Logs
            </button>
          )}
        </div>

        <HistoryTimeline
          mergedHistory={mergedHistory}
          historyList={edited.history}
          onChangeHistory={updated => handleChange("history", updated)}
        />

        <div className="relative">
          <textarea
            value={edited.remark || ""}
            onChange={e => {
              handleChange("remark", e.target.value);
              e.target.style.height = 'inherit';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            ref={el => {
              newNoteRef.current = el;
              if (el) {
                setTimeout(() => {
                  el.style.height = 'inherit';
                  el.style.height = `${el.scrollHeight}px`;
                }, 0);
              }
            }}
            rows={2}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition leading-relaxed text-slate-800 min-h-[65px]"
            placeholder="Add note for today's call..."
          />
        </div>
      </div>

      {/* 7. ACTION-DRIVEN FOLLOW-UP SCHEDULER */}
      <div className="space-y-2 p-3 bg-slate-50/70 border border-slate-100 rounded-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
            <CalendarDays size={14} className={hasActivePendingFollowup ? "text-amber-600" : isFollowupCompleted ? "text-emerald-600" : "text-slate-400"} />
            <span>Follow-up</span>
          </div>

          {edited.callbackDate && !isRescheduling && !isAddingNext && (
            <button
              type="button"
              onClick={() => {
                handleChange("callbackDate", null);
                handleChange("callbackStatus", null);
                setIsRescheduling(false);
                setIsAddingNext(false);
              }}
              className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded text-[10px] hover:bg-rose-100 transition cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>

        {/* CASE A: Active Pending Follow-up */}
        {hasActivePendingFollowup && (
          <>
            {/* Mode 1: Rescheduling Mode */}
            {isRescheduling ? (
              <div className="space-y-3 p-3.5 bg-sky-50/90 border border-sky-200 rounded-xl shadow-2xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 border border-sky-300 text-sky-800 flex items-center justify-center shrink-0">
                    <RotateCw size={15} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-sky-950">
                      Rescheduling Follow-up
                    </div>
                    <div className="text-[10px] text-sky-700 font-medium">
                      Current: {formatFollowupDateStr(edited.callbackDate)} {edited.callbackTime ? `· ${edited.callbackTime}` : ""}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-sky-200/80 space-y-1.5">
                  <label className="text-[11px] font-extrabold text-sky-900 block">Choose new date & time:</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={tempDate}
                      onChange={e => setTempDate(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-sky-300 text-sky-950 font-bold rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="time"
                      value={tempTime}
                      onChange={e => setTempTime(e.target.value)}
                      className="w-28 px-3 py-1.5 bg-white border border-sky-300 text-sky-950 font-bold rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="HH:MM"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-sky-200/80 flex justify-end items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!tempDate) {
                        toast.error("Please pick a valid date");
                        return;
                      }
                      saveFollowupSnapshot();
                      handleChange("callbackDate", tempDate);
                      handleChange("callbackTime", tempTime);
                      handleChange("callbackStatus", "rescheduled");
                      setIsRescheduling(false);
                      toast.success(`Rescheduled to ${formatFollowupDateStr(tempDate)}`);
                    }}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Confirm Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRescheduling(false)}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Mode 2: Normal Pending Mode */
              <div className="space-y-3 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl shadow-2xs animate-fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                      <CalendarDays size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                        <span>📅 {formatFollowupDateStr(edited.callbackDate)}</span>
                        {edited.callbackTime && <span className="text-amber-800">· 🕒 {edited.callbackTime}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300/60">
                          ⏳ {edited.callbackStatus === "rescheduled" ? "Rescheduled" : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/80 flex justify-end items-center gap-2 flex-wrap">
                  {(prevFollowupState || edited.callbackStatus === "rescheduled") && (
                    <button
                      type="button"
                      onClick={handleUndoFollowup}
                      className="py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Undo previous follow-up action"
                    >
                      <Undo2 size={13} /> Undo
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      saveFollowupSnapshot();
                      handleChange("callbackStatus", "done");
                      setIsRescheduling(false);
                      toast.success("Follow-up marked as completed ✓");
                    }}
                    className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Complete
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTempDate(getCallbackDateStr());
                      setTempTime(edited.callbackTime || "");
                      setIsRescheduling(true);
                    }}
                    className="py-1.5 px-3 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCw size={13} /> Reschedule
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      saveFollowupSnapshot();
                      handleChange("callbackStatus", "cancelled");
                      setIsRescheduling(false);
                      toast("Follow-up cancelled");
                    }}
                    className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <X size={13} /> Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* CASE B: Completed Follow-up */}
        {isFollowupCompleted && (
          <div className="space-y-3 p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl shadow-2xs animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-emerald-950">
                    ✓ Completed — {formatFollowupDateStr(edited.callbackDate) || "Follow-up"}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium">
                    No active follow-up pending.
                  </div>
                </div>
              </div>
            </div>

            {isAddingNext ? (
              <div className="pt-2 border-t border-emerald-200/80 space-y-2.5 animate-fade-in">
                <div className="text-[11px] font-bold text-emerald-900">Choose date & time for next follow-up:</div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={tempDate}
                    onChange={e => setTempDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-950 font-bold rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="time"
                    value={tempTime}
                    onChange={e => setTempTime(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-950 font-bold rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="HH:MM"
                  />
                </div>
                <div className="flex justify-end items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!tempDate) {
                        toast.error("Please pick a valid date");
                        return;
                      }
                      saveFollowupSnapshot();
                      handleChange("callbackDate", tempDate);
                      handleChange("callbackTime", tempTime);
                      handleChange("callbackStatus", "pending");
                      setIsAddingNext(false);
                      toast.success(`Next follow-up scheduled for ${formatFollowupDateStr(tempDate)}`);
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Confirm New Follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNext(false)}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-emerald-200/80 flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndoFollowup}
                  className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  title="Undo completion and restore follow-up"
                >
                  <Undo2 size={13} /> Undo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setTempDate(today);
                    setTempTime("");
                    setIsAddingNext(true);
                  }}
                  className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} /> ＋ Add Next Follow-up
                </button>
              </div>
            )}
          </div>
        )}

        {/* CASE C: Cancelled Follow-up */}
        {isFollowupCancelled && (
          <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                  <X size={15} />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-700">
                    ✕ Cancelled — {formatFollowupDateStr(edited.callbackDate) || "Follow-up"}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Follow-up cancelled.
                  </div>
                </div>
              </div>
            </div>

            {isAddingNext ? (
              <div className="pt-2 border-t border-slate-200 space-y-2.5 animate-fade-in">
                <div className="text-[11px] font-bold text-slate-700">Choose date & time for new follow-up:</div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={tempDate}
                    onChange={e => setTempDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-900 font-bold rounded-lg text-xs"
                  />
                  <input
                    type="time"
                    value={tempTime}
                    onChange={e => setTempTime(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-white border border-slate-300 text-slate-900 font-bold rounded-lg text-xs"
                    placeholder="HH:MM"
                  />
                </div>
                <div className="flex justify-end items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!tempDate) {
                        toast.error("Please pick a valid date");
                        return;
                      }
                      saveFollowupSnapshot();
                      handleChange("callbackDate", tempDate);
                      handleChange("callbackTime", tempTime);
                      handleChange("callbackStatus", "pending");
                      setIsAddingNext(false);
                      toast.success(`New follow-up set for ${formatFollowupDateStr(tempDate)}`);
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Confirm New Follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNext(false)}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200 flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndoFollowup}
                  className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  title="Undo cancellation and restore follow-up"
                >
                  <Undo2 size={13} /> Undo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setTempDate(today);
                    setTempTime("");
                    setIsAddingNext(true);
                  }}
                  className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} /> ＋ Add Next Follow-up
                </button>
              </div>
            )}
          </div>
        )}

        {/* CASE D: No Follow-up set */}
        {!edited.callbackDate && !edited.callbackStatus && (
          <>
            {isAddingNext ? (
              <div className="space-y-3 p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl animate-fade-in">
                <div className="text-xs font-extrabold text-indigo-950">Schedule Follow-up</div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={tempDate}
                    onChange={e => setTempDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-indigo-300 text-indigo-950 font-bold rounded-lg text-xs"
                  />
                  <input
                    type="time"
                    value={tempTime}
                    onChange={e => setTempTime(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-white border border-indigo-300 text-indigo-950 font-bold rounded-lg text-xs"
                    placeholder="HH:MM"
                  />
                </div>
                <div className="flex justify-end items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!tempDate) {
                        toast.error("Please pick a valid date");
                        return;
                      }
                      handleChange("callbackDate", tempDate);
                      handleChange("callbackTime", tempTime);
                      handleChange("callbackStatus", "pending");
                      setIsAddingNext(false);
                      toast.success(`Follow-up set for ${formatFollowupDateStr(tempDate)}`);
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Confirm Follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNext(false)}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setTempDate(today);
                    setTempTime("");
                    setIsAddingNext(true);
                  }}
                  className="py-2 px-3.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <CalendarDays size={14} className="text-indigo-600" />
                  <span>＋ Schedule Follow-up</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 8. CONTEXTUAL REGISTRATION DETAILS (ONLY WHEN REGISTERED) */}
      {(edited.status === "Reg.Done" || row.status === "Reg.Done" || edited.pipelineStage === "6. Registered / Won") && (
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
            <Flame size={15} className="text-amber-500" fill="currentColor" /> Abhivyakti Registration
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-lg font-bold bg-emerald-600 text-white flex items-center gap-1 text-xs">
              <CheckCircle2 size={14} /> Registered
            </span>
            <button
              type="button"
              onClick={() => setShowUndoStatusPrompt(true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-lg text-xs transition cursor-pointer"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* STAGE INFO MODAL */}
      <StageInfoModal
        isOpen={showStageInfoModal}
        onClose={() => setShowStageInfoModal(false)}
      />
    </div>
  );
};

export default CallEntryTab;
