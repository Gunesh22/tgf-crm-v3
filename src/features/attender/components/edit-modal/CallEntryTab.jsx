import React, { useRef, useMemo } from "react";
import {
  Phone, Tag, CheckCircle2, AlertCircle, MessageSquare,
  CalendarDays, Flame, HelpCircle, Bell, ArrowRightLeft, Shield
} from "lucide-react";
import SearchableDropdown from "./SearchableDropdown";
import HistoryTimeline from "./HistoryTimeline";
import {
  CALL_DIRECTION_OPTIONS,
  CALL_PURPOSE_OPTIONS,
  CALL_STATUS_OPTIONS,
  SALES_OUTCOME_OPTIONS,
  QUERY_STATUS_OPTIONS,
  REMINDER_OUTCOME_OPTIONS,
  CALLED_FOR_OPTIONS,
  SOURCE_OPTIONS,
  OBJECTION_REASONS
} from "../../utils";
import { evaluatePipeline, getPipelineStageConfig, shouldShowConvertToSales } from "../../../../utils/pipelineEngine";

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
  const activePurpose = (edited.callPurpose || (edited.status === "Query" ? "QUERY" : String(edited[calledForField] || "").toLowerCase().includes("reminder") ? "REMINDER" : "SALES")).toUpperCase();
  
  // Compute active Call Status (Connected vs Unconnected)
  const activeCallStatus = edited.callStatus || (["NA", "Busy", "Call Cut", "switched off", "Invalid No", "no answer", "Not Attended"].includes(edited.status) ? "Not Picked Up" : "Connected");

  // Filter Sales Called For options (exclude Query/Reminder)
  const salesCalledForOptions = CALLED_FOR_OPTIONS.filter(o => o !== "Reminder" && o !== "Query");

  // Determine current pipeline stage preview
  const evalResult = evaluatePipeline(
    edited,
    {
      callPurpose: activePurpose,
      callStatus: activeCallStatus,
      purposeOutcome: edited.status,
      queryStatus: edited.queryStatus
    }
  );
  const stageConfig = getPipelineStageConfig(evalResult.pipelineStage);

  // Whether this contact qualifies for "Convert to Sales" (only for new/query-only contacts)
  const showConvertToSales = useMemo(() => shouldShowConvertToSales(edited), [edited]);

  const setCallPurpose = (purpose) => {
    setEdited(prev => {
      const next = { ...prev, callPurpose: purpose };
      if (purpose === "QUERY") {
        // IMPORTANT: Do NOT force calledFor to "Query".
        // The attender selects which program/context this query concerns.
        // Keep calledFor as-is (or blank for a new contact).
        next.queryStatus = prev.queryStatus || "Pending";
        // Only reset status if it was a non-query status
        if (!["Query", "Pending", "Solved"].includes(prev.status)) {
          next.status = "Pending";
        }
      } else if (purpose === "REMINDER") {
        // Keep calledFor as-is for reminder; just reset status to reminder outcome
        next.status = "Reminder Given";
      } else {
        // SALES — clean up if previously in Reminder mode
        if (["Reminder Given", "Reminder Confirmed", "Asked Question", "Needs Assistance"].includes(next.status)) {
          next.status = "Info Given";
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
        } else {
          next.status = cStatus;
        }
      } else if (prev.callStatus !== "Connected") {
        next.status = activePurpose === "SALES" ? "Info Given" : activePurpose === "QUERY" ? "Query" : "Reminder Given";
      }
      return next;
    });
  };

  // Determine primary Call Result (Connected, Not Connected, Invalid Number)
  const isInvalid = edited.callStatus === "Invalid Number" || edited.status === "Invalid No";
  const isUnconnectedReason = ["Not Picked Up", "NA", "Busy", "Call Cut", "switched off", "no answer", "Not Attended", "No Network"].includes(edited.status);
  
  const activePrimaryResult = edited.callStatus === "Connected"
    ? "Connected"
    : edited.callStatus === "Not Connected" || isUnconnectedReason
    ? "Not Connected"
    : isInvalid
    ? "Invalid Number"
    : "Connected";

  const handlePrimaryResultChange = (res) => {
    setEdited(prev => {
      const next = { ...prev, callStatus: res };
      if (res === "Connected") {
        next.status = activePurpose === "SALES" ? (["Info Given", "Interested", "Next Time", "Not Interested", "Reg.Done", "Already Reg.d", "Shivir done", "Wrong No", "Called by mistake", "Not possible"].includes(prev.status) ? prev.status : "Info Given") : activePurpose === "QUERY" ? "Query" : "Reminder Given";
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

  return (
    <div className="space-y-3.5 text-xs bg-white">
      
      {/* 0. READ-ONLY HEADER: PIPELINE STAGE & LAST CALL CONTEXT */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Shield size={13} className="text-indigo-600 shrink-0" />
          <span>Current Stage:</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${stageConfig.badge}`}>
            {stageConfig.label}
          </span>
        </div>

        {lastCall ? (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span>Last Call:</span>
            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border ${
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

      {/* RECORD NEW CALL BANNER */}
      <div className="flex items-center gap-2 pt-0.5 pb-0.5 border-b border-slate-100">
        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
        <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
          Record New Call Entry
        </h4>
      </div>

      {/* 1. CALL DIRECTION & CALL PURPOSE ROW */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center relative z-20">
        {/* Call Direction */}
        <div className="md:col-span-5 space-y-1">
          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Call Direction
          </label>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {["outgoing", "incoming"].map(opt => {
              const isSelected = (edited.callType || "outgoing").toLowerCase().startsWith(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleCallTypeChange(opt)}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer capitalize ${
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

        {/* Call Purpose Switcher */}
        <div className="md:col-span-7 space-y-1">
          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Call Purpose <span className="text-rose-500 font-bold">*</span>
          </label>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {[
              { id: "SALES", label: "Sales" },
              { id: "QUERY", label: "Query" },
              { id: "REMINDER", label: "Reminder" }
            ].map(p => {
              const isSelected = activePurpose === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCallPurpose(p.id)}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? p.id === "SALES"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                        : p.id === "QUERY"
                        ? "bg-orange-600 text-white border-orange-600 shadow-2xs"
                        : "bg-sky-600 text-white border-sky-600 shadow-2xs"
                      : "bg-transparent text-slate-600 border-transparent hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. PROGRAM & ORIGINAL SOURCE (SALES MODE) */}
      {activePurpose === "SALES" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-30 animate-fade-in">
          {/* Program (Called For) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">
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

          {/* Original Source */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">
              Original Source
            </label>
            {(edited.original_source || edited[sourceField]) ? (
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>{edited.original_source || edited[sourceField]}</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">(Read-Only)</span>
              </div>
            ) : (
              <SearchableDropdown
                options={SOURCE_OPTIONS}
                selected=""
                onChange={val => {
                  handleChange("original_source", val);
                  handleChange(sourceField, val);
                }}
                placeholder="Acquisition source..."
                colorClass="amber"
              />
            )}
          </div>
        </div>
      )}

      {/* --- QUERY CONTEXT BANNER --- */}
      {activePurpose === "QUERY" && (
        <div className="p-2.5 bg-orange-50/70 border border-orange-200/80 rounded-xl flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <HelpCircle size={15} className="text-orange-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-orange-950 text-xs">Query / Helpdesk Mode</span>
              <p className="text-[11px] text-orange-800 leading-tight mt-0.5">
                Pipeline stage is preserved. Select the program this query concerns.
              </p>
            </div>
          </div>
          {/* Only show Convert-to-Sales for NEW / query-only contacts (rank &lt; Info Given) */}
          {showConvertToSales && (
            <button
              type="button"
              onClick={() => setCallPurpose("SALES")}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 hover:bg-indigo-50 flex items-center gap-1 transition cursor-pointer shadow-2xs shrink-0"
            >
              <ArrowRightLeft size={11} /> Convert to Sales
            </button>
          )}
        </div>
      )}

      {/* --- REMINDER CONTEXT BANNER — NO Convert-to-Sales button --- */}
      {activePurpose === "REMINDER" && (
        <div className="p-2.5 bg-sky-50/70 border border-sky-200/80 rounded-xl flex items-center gap-3 animate-fade-in">
          <Bell size={15} className="text-sky-600 shrink-0" />
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
        <div className="space-y-1 relative z-30 animate-fade-in">
          <label className="text-[11px] font-bold text-slate-700">
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

      {/* 3. CALL RESULT (SIMPLIFIED 3-BUTTON SELECTOR) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
          Call Result <span className="text-rose-500 font-bold">*</span>
        </label>
        <div className="flex gap-2">
          {[
            { id: "Connected", label: "Connected", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold" },
            { id: "Not Connected", label: "Not Connected", activeClass: "bg-rose-600 text-white border-rose-600 shadow-2xs font-bold" },
            { id: "Invalid Number", label: "Invalid Number", activeClass: "bg-slate-900 text-white border-slate-900 shadow-2xs font-bold" }
          ].map(res => (
            <button
              key={res.id}
              type="button"
              onClick={() => handlePrimaryResultChange(res.id)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activePrimaryResult === res.id
                  ? res.activeClass
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {res.label}
            </button>
          ))}
        </div>
      </div>


      {/* 5. CALL OUTCOME (SHOWN ONLY WHEN CONNECTED) */}
      {activePrimaryResult === "Connected" && (
        <div className="space-y-2.5 animate-fade-in">
          
          {/* SALES OUTCOME DROPDOWN */}
          {activePurpose === "SALES" && (
            <div className="space-y-1 relative z-20">
              <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                Call Outcome <span className="text-rose-500 font-bold">*</span>
              </label>
              <SearchableDropdown
                options={[
                  "Info Given",
                  "Interested",
                  "Next Time",
                  "Not Interested",
                  "Reg.Done",
                  "Already Reg.d",
                  "Shivir done",
                  "Invalid No",
                  "Wrong No",
                  "Called by mistake",
                  "Not possible"
                ]}
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

          {/* QUERY OUTCOME */}
          {activePurpose === "QUERY" && (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  Query Status <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="flex gap-2 max-w-sm">
                  {QUERY_STATUS_OPTIONS.map(qs => (
                    <button
                      key={qs}
                      type="button"
                      onClick={() => handleChange("queryStatus", qs)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        (edited.queryStatus || "Pending") === qs
                          ? qs === "Pending"
                            ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                            : "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {qs === "Pending" ? "⏳ Pending Query" : "✓ Query Solved"}
                    </button>
                  ))}
                </div>
              </div>
              {/* Query details / what was asked */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Query Details (What was asked)</label>
                <textarea
                  value={edited.queryDetails || ""}
                  onChange={e => handleChange("queryDetails", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition text-slate-800"
                  placeholder="Summarise the question or inquiry..."
                />
              </div>
            </div>
          )}

          {/* REMINDER OUTCOME */}
          {activePurpose === "REMINDER" && (
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                Reminder Result <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_OUTCOME_OPTIONS.map(ro => (
                  <button
                    key={ro}
                    type="button"
                    onClick={() => handleChange("status", ro)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      (edited.status || "Reminder Given") === ro
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

          {/* Objection Reason for Not Interested */}
          {(edited.status?.toLowerCase() === "not interested") && (
            <div className="space-y-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl animate-slide-up">
              <label className="text-xs font-bold text-rose-800 flex items-center gap-1">
                <AlertCircle size={12} /> Reason for Not Interested:
              </label>
              <div className="flex flex-wrap gap-1">
                {OBJECTION_REASONS.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => handleChange("objectionReason", edited.objectionReason === reason ? "" : reason)}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer ${
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

        </div>
      )}

      {/* 6. CALL NOTES */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
          <MessageSquare size={12} className="text-slate-400" /> Call Notes
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
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-normal resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition leading-relaxed text-slate-800"
            placeholder="Add note for today's call..."
          />
        </div>
      </div>

      {/* 7. ACTION-DRIVEN FOLLOW-UP SCHEDULER */}
      <div className="space-y-1.5 p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            <CalendarDays size={13} className={edited.callbackDate ? "text-amber-600" : "text-slate-400"} />
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
              className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-xs hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
            >
              + Schedule Follow-up
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { handleChange("callbackDate", null); handleChange("callbackStatus", null); }}
              className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-md text-[11px] hover:bg-rose-100 transition cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>

        {edited.callbackDate && (
          <div className="space-y-2 pt-1 border-t border-slate-200/60 animate-fade-in">
            <div className="flex gap-2">
              <input
                type="date"
                value={getCallbackDateStr()}
                onChange={e => {
                  handleChange("callbackDate", e.target.value);
                  if (e.target.value && !edited.callbackStatus) handleChange("callbackStatus", "pending");
                }}
                className="flex-1 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 font-bold rounded-lg text-xs focus:outline-none"
              />
              <input
                type="time"
                value={edited.callbackTime || ""}
                onChange={e => handleChange("callbackTime", e.target.value)}
                className="w-28 px-2 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 font-bold rounded-lg text-xs focus:outline-none"
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
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
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
        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
            <Flame size={14} className="text-amber-500" fill="currentColor" /> Abhivyakti Registration
          </div>
          <div className="flex gap-1.5">
            <span className="px-2.5 py-1 rounded-lg font-bold bg-emerald-600 text-white flex items-center gap-1 text-xs">
              <CheckCircle2 size={13} /> Registered
            </span>
            <button
              type="button"
              onClick={() => setShowUndoStatusPrompt(true)}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-lg text-xs transition cursor-pointer"
            >
              Undo
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default CallEntryTab;
