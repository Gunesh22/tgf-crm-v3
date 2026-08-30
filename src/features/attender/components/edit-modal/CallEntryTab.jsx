import React, { useRef, useMemo, useState } from "react";
import {
  Phone, Tag, CheckCircle2, AlertCircle, MessageSquare,
  CalendarDays, Flame, HelpCircle, Bell, ArrowRightLeft, Shield, Info
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
import { evaluatePipeline, getPipelineStageConfig, getEffectiveStage, shouldShowConvertToSales } from "../../../../utils/pipelineEngine";

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
  getCallbackDateStr
}) => {
  const newNoteRef = useRef(null);

  // Compute active Call Purpose (SALES, QUERY, REMINDER)
  const activePurpose = (edited.callPurpose || "SALES").toUpperCase();
  
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
      queryStatus: edited.queryStatus
    }
  );

  // Direct DB pipeline stage display for modal header (previews evalResult stage only when user selects today's outcome)
  const dbStage = getEffectiveStage(edited, selectedProgram) || edited.pipelineStage || row.pipelineStage;
  const displayStage = (edited.status && edited.callStatus) ? evalResult.pipelineStage : dbStage;
  const stageConfig = getPipelineStageConfig(displayStage);

  // Whether this contact qualifies for "Convert to Sales" (only for new/query-only contacts)
  const showConvertToSales = useMemo(() => shouldShowConvertToSales(edited), [edited]);

  const setCallPurpose = (purpose) => {
    setEdited(prev => {
      const next = { ...prev, callPurpose: purpose };
      if (purpose === "QUERY") {
        if (!["Query", "Pending", "Solved"].includes(prev.status)) {
          next.status = "";
        }
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
          next.status = "Invalid No";
        } else if (cStatus === "Not Picked Up" || cStatus === "Not Connected") {
          if (!["Not Picked Up", "NA", "Busy", "Call Cut", "switched off", "no answer", "Not Attended", "No Network"].includes(prev.status)) {
            next.status = "Not Picked Up";
          }
        }
      } else if (prev.callStatus !== "Connected") {
        next.status = "";
      }
      return next;
    });
  };

  // Determine primary Call Result (Connected, Not Connected, Invalid Number, or Blank)
  const isInvalid = edited.callStatus === "Invalid Number" || edited.status === "Invalid No";
  const isUnconnectedReason = ["Not Picked Up", "NA", "Busy", "Call Cut", "switched off", "no answer", "Not Attended", "No Network"].includes(edited.status);
  
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
        if (isUnconnectedReason || prev.status === "Invalid No") {
          next.status = "";
        }
      } else if (res === "Not Connected") {
        next.status = isUnconnectedReason ? prev.status : "Not Picked Up";
      } else if (res === "Invalid Number") {
        next.status = "Invalid No";
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Shield size={14} className="text-indigo-600 shrink-0" />
          <span>Current Stage:</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${stageConfig.badge}`}>
            {stageConfig.label}
          </span>
          <button
            type="button"
            onClick={() => setShowStageInfoModal(true)}
            className="w-5 h-5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[11px] border border-indigo-200 shadow-2xs transition-all cursor-pointer hover:scale-105 shrink-0"
            title="Click for information about all pipeline stages"
          >
            i
          </button>
        </div>

        {lastCall ? (
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
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">No previous call history</span>
        )}
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
            selected={activePurpose === "QUERY" ? "Query" : activePurpose === "REMINDER" ? "Reminder" : "Sales"}
            onChange={val => {
              if (val) setCallPurpose(val.toUpperCase());
            }}
            placeholder="Select Call Purpose..."
            colorClass="indigo"
          />
        </div>
      </div>

      {/* 2. PROGRAM & ORIGINAL SOURCE (SALES MODE) */}
      {activePurpose === "SALES" && (
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
              selected={String(edited[sourceField] || edited.Source || edited.source || edited.original_source || row.original_source || edited.originalSource || "")}
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

      {/* QUERY: Program selector (which program is this query about?) */}
      {activePurpose === "QUERY" && (
        <div className="space-y-1.5 relative z-30 animate-fade-in">
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
            </div>
          )}

          {/* CONNECTED QUERY OUTCOME */}
          {activePrimaryResult === "Connected" && activePurpose === "QUERY" && (
            <div className="space-y-2 animate-fade-in">
              <label className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                Query Status <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="flex gap-2">
                {QUERY_STATUS_OPTIONS.map(qs => (
                  <button
                    key={qs}
                    type="button"
                    onClick={() => handleChange("queryStatus", qs)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      edited.queryStatus === qs
                        ? qs === "Pending"
                          ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                          : "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {qs === "Pending" ? "⏳ Pending" : "✓ Solved"}
                  </button>
                ))}
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

          {/* UNCONNECTED REASON SELECTOR */}
          {activePrimaryResult === "Not Connected" && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[11px] font-extrabold text-rose-900 uppercase tracking-wider flex items-center gap-1">
                Unanswered Reason <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["Not Picked Up", "Busy", "Call Cut", "switched off", "No Network", "no answer", "NA"].map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => handleChange("status", reason)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      (edited.status || "Not Picked Up").toLowerCase() === reason.toLowerCase()
                        ? "bg-rose-600 text-white border-rose-600 shadow-2xs font-bold"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {reason === "switched off" ? "Switched Off" : reason === "no answer" ? "No Answer" : reason}
                  </button>
                ))}
              </div>
            </div>
          )}


        </div>
      </div>

      {/* Query Details (What was asked) - full width below if Query mode */}
      {activePrimaryResult === "Connected" && activePurpose === "QUERY" && (
        <div className="space-y-1.5 animate-fade-in pt-1">
          <label className="text-[11px] font-bold text-slate-700">Query Details (What was asked)</label>
          <textarea
            value={edited.queryDetails || ""}
            onChange={e => handleChange("queryDetails", e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition text-slate-800"
            placeholder="Summarise the question or inquiry..."
          />
        </div>
      )}

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
        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <MessageSquare size={13} className="text-slate-400" /> Call Notes
          {mergedHistory && mergedHistory.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-semibold">
              {mergedHistory.length} past
            </span>
          )}
        </label>

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
            <CalendarDays size={14} className={edited.callbackDate ? "text-amber-600" : "text-slate-400"} />
            <span>Follow-up</span>
          </div>

          {!edited.callbackDate ? (
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                handleChange("callbackDate", today);
                handleChange("callbackStatus", "pending");
              }}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-xs hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
            >
              + Schedule Follow-up
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { handleChange("callbackDate", null); handleChange("callbackStatus", null); }}
              className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-md text-[11px] hover:bg-rose-100 transition cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>

        {edited.callbackDate && (
          <div className="space-y-2 pt-2 border-t border-slate-200/60 animate-fade-in">
            <div className="flex gap-2">
              <input
                type="date"
                value={getCallbackDateStr()}
                onChange={e => {
                  handleChange("callbackDate", e.target.value);
                  if (e.target.value && !edited.callbackStatus) handleChange("callbackStatus", "pending");
                }}
                className="flex-1 px-3.5 py-2 bg-amber-50 border border-amber-300 text-amber-900 font-bold rounded-lg text-xs focus:outline-none"
              />
              <input
                type="time"
                value={edited.callbackTime || ""}
                onChange={e => handleChange("callbackTime", e.target.value)}
                className="w-28 px-3 py-2 bg-amber-50 border border-amber-300 text-amber-900 font-bold rounded-lg text-xs focus:outline-none"
                placeholder="HH:MM"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: "pending", label: "⏳ Pending", activeClass: "bg-amber-500 text-white border-amber-500 shadow-2xs font-bold", inactiveClass: "bg-white text-amber-700 border-amber-200 hover:bg-amber-100" },
                { value: "done", label: "✓ Completed", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold", inactiveClass: "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
                { value: "rescheduled", label: "↺ Rescheduled", activeClass: "bg-sky-600 text-white border-sky-600 shadow-2xs font-bold", inactiveClass: "bg-white text-sky-700 border-sky-200 hover:bg-sky-100" },
                { value: "cancelled", label: "✕ Cancelled", activeClass: "bg-rose-600 text-white border-rose-600 shadow-2xs font-bold", inactiveClass: "bg-white text-rose-700 border-rose-200 hover:bg-rose-100" }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChange("callbackStatus", opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    (edited.callbackStatus || "pending") === opt.value
                      ? opt.activeClass
                      : opt.inactiveClass
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
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
