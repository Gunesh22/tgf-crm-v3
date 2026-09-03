import React from "react";
import { Flame, Clock, RotateCw, Users, Loader } from "lucide-react";
import { normalizePhone } from "../../../lib/db";
import { getFieldWithFallback, isUnansweredCallback, getCanonicalStatus, getSharedAttenders, getAttenderStatus, getAttenderRemark, getContactView, parseTimestamp } from "../utils";
import { getPipelineStageConfig } from "../../../utils/pipelineEngine";
import LottieAnimation from "../../../components/ui/LottieAnimation";
import customerServiceAnimation from "../../../assets/customer_service.json";

function CollapsedTags({ tags }) {
  const [expanded, setExpanded] = React.useState(false);

  if (tags.length === 0) {
    return <span className="text-gray-400">—</span>;
  }

  // If there are 2 or fewer tags, just render them
  if (tags.length <= 2) {
    return (
      <div className="flex flex-col gap-1 items-start">
        {tags.map((t, idx) => (
          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
            #{t}
          </span>
        ))}
      </div>
    );
  }

  // If expanded, show all with a "show less" toggle
  if (expanded) {
    return (
      <div 
        className="flex flex-col gap-1 items-start" 
        onClick={(e) => {
          e.stopPropagation(); // Prevent opening EditModal
          setExpanded(false);
        }}
      >
        {tags.map((t, idx) => (
          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
            #{t}
          </span>
        ))}
        <button className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold underline mt-0.5 transition-colors">
          Show Less
        </button>
      </div>
    );
  }

  // Otherwise, show first 2 and a "+X more" trigger
  const visibleTags = tags.slice(0, 2);
  const remaining = tags.length - 2;

  return (
    <div className="flex flex-col gap-1 items-start">
      {visibleTags.map((t, idx) => (
        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
          #{t}
        </span>
      ))}
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent opening EditModal
          setExpanded(true);
        }}
        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 transition-colors whitespace-nowrap"
      >
        +{remaining} more
      </button>
    </div>
  );
}

export function ContactTable({
  isLoadingProgram = false,
  scrollRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  dynamicCols,
  hiddenColumns,
  paginated,
  page,
  rowsPerPage,
  duplicatePhoneMap,
  didDrag,
  setEditingRow,
  onRefreshLead,
  onClearFilters,
  callLogs,
  attenderId,
  attenderName
}) {
  const getStatusBadge = (log, activeAttenderCtx) => {
    let rawStatus = getAttenderStatus(log, activeAttenderCtx);
    const status = getCanonicalStatus(rawStatus || "");

    if (isUnansweredCallback(log)) {
      return { bg: "bg-amber-100 border border-amber-300/80", text: "text-amber-800 font-extrabold", label: status || "Unanswered Callback" };
    }
    if (status && status !== "Pending" && status !== "Call Log Added") {
      if (status === "Reg.Done") return { bg: "bg-emerald-100", text: "text-emerald-700", label: status };
      if (status === "Interested") return { bg: "bg-blue-100", text: "text-blue-700", label: status };
      if (status === "Info given") return { bg: "bg-purple-100", text: "text-purple-700", label: status };
      if (["NA", "Busy", "Call Cut", "switched off", "Not interested", "Invalid No", "no answer", "Not Attended"].includes(status)) {
        return { bg: "bg-red-100", text: "text-red-600", label: status };
      }
      return { bg: "bg-indigo-100", text: "text-indigo-700", label: status };
    }
    const hasAttempt = log.callbackDate || log.remark || log.Remark || log.remarks || (Array.isArray(log.history) && log.history.length > 0);
    if (hasAttempt) {
      return { bg: "bg-amber-50 border border-amber-200", text: "text-amber-700 font-semibold", label: status || "NA" };
    }
    return { bg: "bg-gray-100", text: "text-gray-400", label: "Pending" };
  };

  const getCallbackStr = (log) => {
    if (!log.callbackDate) return "";
    const d = parseTimestamp(log.callbackDate);
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : "";
  };

  const isColHidden = (c) => hiddenColumns.includes(c) || hiddenColumns.some(h => h.toLowerCase().replace(/[\s_-]/g, "") === c.toLowerCase().replace(/[\s_-]/g, ""));

  const visibleCount = 1 + dynamicCols.filter(col => !isColHidden(col)).length
    + (!hiddenColumns.includes("Type") ? 1 : 0)
    + (!hiddenColumns.includes("Status") ? 1 : 0)
    + (!hiddenColumns.includes("Remark") ? 1 : 0)
    + (!hiddenColumns.includes("Callback") ? 1 : 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        className="flex-1 overflow-auto cursor-grab [scrollbar-gutter:stable]"
        style={{ userSelect: "none" }}
      >
        <table className="table-auto w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase w-10 text-center">#</th>
              {dynamicCols.map(col => {
                if (col === "Calls Done" || isColHidden(col)) return null;
                return (
                  <th key={col} className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase min-w-[130px] whitespace-nowrap">
                    {col}
                  </th>
                );
              })}
              {!hiddenColumns.includes("Type") && (
                <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase min-w-[80px]">Type</th>
              )}
              {!hiddenColumns.includes("Status") && (
                <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase min-w-[120px]">Status</th>
              )}
              {!hiddenColumns.includes("Remark") && (
                <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase min-w-[280px]">Remark</th>
              )}
              {!hiddenColumns.includes("Callback") && (
                <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase min-w-[110px]">Callback</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginated.map((log, idx) => {
              const activeAttenderCtx = attenderId || attenderName;
              const view = getContactView(log, activeAttenderCtx);

              const cbStatus = String(view.callbackStatus || log.callbackStatus || "").trim().toLowerCase();
              const isDoneOrCancelled = cbStatus === "done" || cbStatus === "completed" || cbStatus === "cancelled";
              const isDue = log._callbackDue && !isDoneOrCancelled;
              const isHot = log.isHotLead;
              const hasFollowup = !isDoneOrCancelled && (view.callbackDate || view.status === "reminder" || view.status === "Next time" || log.callbackDate);
              const isUnanswered = isUnansweredCallback(log);
              const isCalled = !!(view.status || view.callbackDate || view.remark);

              let statusBorder = "border-l-2 border-l-transparent";
              if (isDue) {
                statusBorder = "border-l-4 border-l-rose-500";
              } else if (isHot) {
                statusBorder = "border-l-4 border-l-amber-500";
              } else if (hasFollowup) {
                statusBorder = "border-l-4 border-l-sky-500";
              } else if (isUnanswered) {
                statusBorder = "border-l-4 border-l-indigo-400";
              } else if (isCalled) {
                statusBorder = "border-l-4 border-l-emerald-500";
              }

              return (
                <tr
                  key={`${log.id || 'log'}_${idx}`}
                  className={`cursor-pointer transition-colors bg-white hover:bg-slate-50 border-b border-slate-100 ${statusBorder}`}
                  onClick={() => {
                    if (!didDrag.current) {
                      console.log("[DEBUG] Selected Row:", log);
                      setEditingRow(log);
                    }
                  }}
                >
                  <td className="py-2 px-3 text-[11px] font-medium text-slate-400 text-center align-top">
                    {(page - 1) * rowsPerPage + idx + 1}
                  </td>
                  {dynamicCols.map((col, ci) => {
                    if (col === "Calls Done" || isColHidden(col)) return null;

                    const getVal = (item, column) => {
                      const standardOrder = ["Name", "Phone", "Mobile", "Email", "City", "State", "Khoji", "Tags", "Source", "Called For"];
                      if (standardOrder.includes(column)) {
                        return getFieldWithFallback(item, column, activeAttenderCtx);
                      }
                      let rawVal = item[column];
                      if (rawVal === undefined || rawVal === null) {
                        const keys = Object.keys(item);
                        const matchingKey = keys.find(k => k.toLowerCase() === column.toLowerCase());
                        if (matchingKey) rawVal = item[matchingKey];
                      }
                      if (rawVal === undefined || rawVal === null) return "";
                      if (typeof rawVal === "object") {
                        if (Array.isArray(rawVal)) {
                          return rawVal.map(x => (typeof x === "object" ? (x.name || x.program || x.stage || JSON.stringify(x)) : String(x))).join(", ");
                        }
                        return rawVal.name || rawVal.program || rawVal.stage || "";
                      }
                      return String(rawVal);
                    };
                    const val = getVal(log, col);
                    const isName = col.toLowerCase().includes("name") || col.toLowerCase().includes("lead");

                    const logKeys = Object.keys(log);
                    const phoneKey = logKeys.find(k => ["phone", "mobile", "whatsapp", "phone number", "whatsapp number", "whatsappno"].includes(k.toLowerCase()))
                      || logKeys.find(k => k.toLowerCase().includes("phone") || k.toLowerCase().includes("mobile") || k.toLowerCase().includes("whatsapp"));
                    const phone = phoneKey ? normalizePhone(log[phoneKey]) : "";
                    const isDupInProg = isName && phone && duplicatePhoneMap[log.programId || "incoming"]?.[phone] > 1;

                    if (col === "Tags") {
                      let rawTags = [];
                      if (Array.isArray(log.tags)) {
                        rawTags = log.tags;
                      } else if (log.Tags) {
                        rawTags = [log.Tags];
                      } else if (log.tag) {
                        rawTags = [log.tag];
                      } else {
                        const fallbackVal = getFieldWithFallback(log, "Tags", activeAttenderCtx);
                        if (fallbackVal) {
                          rawTags = [fallbackVal];
                        }
                      }

                      const seen = new Set();
                      rawTags.forEach(t => {
                        if (typeof t === "string") {
                          t.split(",").map(x => x.trim()).filter(Boolean).forEach(x => seen.add(x));
                        } else if (t) {
                          seen.add(String(t).trim());
                        }
                      });
                      const tagsArr = Array.from(seen).sort();

                      if (tagsArr.length === 0) {
                        return <td key={col} className="py-2 px-3 text-xs text-slate-300 align-top">—</td>;
                      }

                      return (
                        <td key={col} className="py-2 px-3 text-xs text-slate-700 min-w-[130px] align-top">
                          <CollapsedTags tags={tagsArr} />
                        </td>
                      );
                    }

                    const sharedList = getSharedAttenders(log);
                    const isShared = sharedList.length > 1;

                    return (
                      <td key={col} title={typeof val === "string" ? val : undefined} className={`py-2 px-3 text-xs ${isName ? "font-semibold text-slate-900" : "text-slate-700"} min-w-[120px] max-w-[200px] break-words align-top`}>
                        {ci === 0 && log.isHotLead && <Flame size={14} className="text-amber-500 shrink-0 inline mr-1" fill="currentColor" />}
                        {val || "\u2014"}
                        {isName && isShared && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRefreshLead) onRefreshLead(log);
                            }}
                            title={`Shared Lead with: ${sharedList.join(", ")} | Click to sync latest team updates`}
                            className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition"
                          >
                            <Users size={9} /> Shared ({sharedList.length}) <RotateCw size={9} className="hover:rotate-180 transition-transform" />
                          </span>
                        )}
                        {isDupInProg && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            Same Person
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {!hiddenColumns.includes("Type") && (
                    <td className="py-2 px-3 align-top">
                      <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.2 rounded border ${view.callType === "incoming" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                        {view.callType || "outgoing"}
                      </span>
                    </td>
                  )}
                  {!hiddenColumns.includes("Status") && (
                    <td className="py-2 px-3 align-top">
                      {(() => {
                        const stageToUse = view.pipelineStage;
                        const rawQ = String(view.queryStatus || "").trim();
                        const isQueryActive = (rawQ === "Pending" || rawQ === "Query Pending" || rawQ === "Attempting Query") && (String(view.callPurpose || "").toUpperCase() === "QUERY" || view.status === "Query" || stageToUse === "Query Desk");
                        const isQuerySolved = rawQ === "Query Solved" || rawQ === "Solved";

                        if (stageToUse && stageToUse !== "Query Desk" && stageToUse !== "Reminder Desk") {
                          const pConfig = getPipelineStageConfig(stageToUse);
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${pConfig.badge}`}>
                                {log.isHotLead && <Flame size={10} className="inline text-amber-500 mr-0.5" fill="currentColor" />}
                                {pConfig.label}
                              </span>
                              {isQueryActive && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                                  ❓ Query Pending
                                </span>
                              )}
                              {isQuerySolved && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                                  ✓ Query Solved
                                </span>
                              )}
                              {view.status && !isQueryActive && !isQuerySolved && (
                                <span className="text-[9px] text-slate-500 font-medium ml-0.5">
                                  Outcome: {view.status}
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (stageToUse === "Query Desk" || isQueryActive) {
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                ❓ Query Pending
                              </span>
                              {view.status && (
                                <span className="text-[9px] text-slate-500 font-medium ml-0.5">
                                  Outcome: {view.status}
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (stageToUse === "Reminder Desk" || String(view.callPurpose || "").toUpperCase() === "REMINDER") {
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300">
                                ⏰ Reminder Scheduled
                              </span>
                              {view.status && (
                                <span className="text-[9px] text-slate-500 font-medium ml-0.5">
                                  Outcome: {view.status}
                                </span>
                              )}
                            </div>
                          );
                        }

                        const badge = getStatusBadge(log, activeAttenderCtx);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                            {log.isHotLead && <Flame size={10} className="inline text-amber-500" fill="currentColor" />}
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  {!hiddenColumns.includes("Remark") && (
                    <td className="py-2 px-3 text-slate-700 text-xs leading-relaxed min-w-[200px] max-w-[320px] break-words align-top">
                      {(() => {
                        const remarkVal = view.remark;
                        if (remarkVal) return remarkVal;
                        return <span className="text-slate-300">—</span>;
                      })()}
                    </td>
                  )}
                  {!hiddenColumns.includes("Callback") && (
                    <td className="py-2 px-3 align-top whitespace-nowrap">
                      {(() => {
                        const rawCb = view.callbackDate || log.callbackDate;
                        const parsedDate = parseTimestamp(rawCb) || parseTimestamp(log.callbackDate);
                        const cbStr = parsedDate ? parsedDate.toLocaleDateString("en-IN") : "";
                        const cbStatus = view.callbackStatus || log.callbackStatus;
                        if (cbStr) {
                          return (
                            <div className="flex flex-col gap-0.5">
                              {isDue ? (
                                <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                                  <Clock size={12} className="animate-pulse" /> {cbStr}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-amber-700">{cbStr}</span>
                              )}
                              {cbStatus && (
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded w-fit border ${
                                  cbStatus === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  cbStatus === "rescheduled" ? "bg-sky-50 text-sky-700 border-sky-200" :
                                  cbStatus === "cancelled" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  {cbStatus === "done" ? "✓ Done" : cbStatus === "rescheduled" ? "↺ Rescheduled" : cbStatus === "cancelled" ? "✕ Cancelled" : "⏳ Pending"}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return <span className="text-slate-300">—</span>;
                      })()}
                    </td>
                  )}
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={visibleCount}>
                  <div className="py-16 text-center bg-slate-50/50 flex flex-col items-center justify-center p-6">
                    {isLoadingProgram && callLogs.length === 0 ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 border border-indigo-100">
                          <Loader size={22} className="animate-spin" />
                        </div>
                        <p className="text-sm font-bold text-slate-800">Loading contacts from database…</p>
                        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                          Please wait while your call sheet is syncing.
                        </p>
                      </>
                    ) : callLogs.length === 0 ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2 border border-slate-200">
                          <Users size={20} />
                        </div>
                        <p className="text-sm font-bold text-slate-700">No contacts assigned yet</p>
                        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                          Select a tag above and click 'Get Numbers' to start calling, or add an incoming call.
                        </p>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4">
                        <LottieAnimation animationData={customerServiceAnimation} className="w-28 h-28 sm:w-36 sm:h-36 mb-1" />
                        <p className="text-sm font-bold text-slate-800">No matching contacts found</p>
                        <p className="text-xs text-slate-500 max-w-sm mt-0.5 mb-3 leading-relaxed">
                          No contacts match your active search query or filter criteria.
                        </p>
                        {onClearFilters && (
                          <button
                            type="button"
                            onClick={onClearFilters}
                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 font-bold text-xs rounded-lg transition border border-indigo-200 cursor-pointer shadow-2xs"
                          >
                            Clear Search & Filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
