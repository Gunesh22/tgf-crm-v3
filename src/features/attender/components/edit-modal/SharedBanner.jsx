import React, { useState } from "react";
import { Users, RotateCw } from "lucide-react";
import { getSharedAttenders } from "../../utils";
import { isLeadShared } from "../../../../lib/db";
import { getEffectiveStage, getPipelineStageConfig } from "../../../../utils/pipelineEngine";
import StageInfoModal from "./StageInfoModal";

export const SharedBanner = ({
  edited,
  row,
  globalDup,
  freshSharedLead,
  currentAttenderName,
  isFetchingShared = false
}) => {
  const [showStageInfo, setShowStageInfo] = useState(false);

  if (isFetchingShared) {
    return (
      <div className="bg-amber-50/90 border border-amber-300/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs my-2 shadow-2xs animate-pulse">
        <RotateCw size={12} className="text-amber-600 animate-spin shrink-0" />
        <span className="font-extrabold text-amber-950 truncate">
          Loading team member activity...
        </span>
      </div>
    );
  }

  const baseLead = freshSharedLead || globalDup?.first || row || edited;
  if (!baseLead) return null;

  const sharedList = getSharedAttenders(baseLead);
  const otherAttenders = currentAttenderName
    ? sharedList.filter(name => name && name.toLowerCase().trim() !== currentAttenderName.toLowerCase().trim())
    : sharedList;

  const isDuplicateMatch = !!globalDup?.first;
  const isShared = (sharedList.length > 1 && otherAttenders.length > 0) || isDuplicateMatch || (isLeadShared(baseLead, currentAttenderName) && otherAttenders.length > 0);

  if (!isShared || otherAttenders.length === 0) return null;

  const otherName = otherAttenders[0] || "Another attender";

  // Resolve program/Called For worked on by the OTHER attender (otherName)
  const getOtherAttenderProgram = () => {
    const oNameLower = (otherName || "").toLowerCase().trim();

    // Check attenderStates for otherName
    if (baseLead.attenderStates && typeof baseLead.attenderStates === "object") {
      const stateObj = Object.values(baseLead.attenderStates).find(st => {
        const name = String(st?.attenderName || st?.name || "").toLowerCase().trim();
        return name && name === oNameLower;
      });
      if (stateObj) {
        const prog = stateObj["Called For"] || stateObj.calledFor || stateObj.program;
        if (prog && String(prog).trim()) return String(prog).trim();
      }
    }

    // Check history for entries by otherName
    if (Array.isArray(baseLead.history)) {
      const histItem = [...baseLead.history].reverse().find(h => {
        const name = String(h?.attenderName || h?.name || "").toLowerCase().trim();
        return name && name === oNameLower && (h?.calledFor || h?.called_for || h?.["Called For"] || h?.program);
      });
      if (histItem) {
        const prog = histItem.calledFor || histItem.called_for || histItem["Called For"] || histItem.program;
        if (prog && String(prog).trim()) return String(prog).trim();
      }
    }

    // Fallback to baseLead's calledFor
    const fallbackProg = baseLead["Called For"] || baseLead.calledFor;
    if (fallbackProg && String(fallbackProg).trim()) return String(fallbackProg).trim();

    return "";
  };

  const otherProgram = getOtherAttenderProgram();
  const displayProgram = otherProgram || String(
    edited?.["Called For"] ||
    edited?.calledFor ||
    row?.["Called For"] ||
    row?.calledFor ||
    ""
  ).trim();

  // Derive stage using canonical pipeline engine for displayProgram
  const rawStage = getEffectiveStage(baseLead, displayProgram);
  const stageConfig = getPipelineStageConfig(rawStage);

  const hasAnyStageRecorded = !!rawStage || !!baseLead.pipelineStage;
  const prevStageDisplay = hasAnyStageRecorded && stageConfig?.label
    ? stageConfig.label
    : "No stage recorded";

  const hasDupNotice = !!globalDup?.showWarning;

  return (
    <>
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs my-2 shadow-2xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Users size={13} className="text-amber-600 shrink-0" />
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-amber-950 font-bold">
            <span>Shared contact</span>
            {hasDupNotice && (
              <span className="text-[10px] font-semibold text-amber-900 bg-amber-200/80 px-1.5 py-0.2 rounded border border-amber-300">
                Match found
              </span>
            )}
            <span className="text-amber-400 font-normal">·</span>
            <span>
              {otherName} has previous activity{displayProgram ? ` for ${displayProgram}` : ""}
            </span>
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
              Current stage: {prevStageDisplay}
              <button
                type="button"
                onClick={() => setShowStageInfo(true)}
                className="w-4 h-4 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-900 flex items-center justify-center font-bold text-[10px] ml-0.5 transition cursor-pointer"
                title="Stage Information"
              >
                i
              </button>
            </span>
          </div>
        </div>
      </div>

      <StageInfoModal
        isOpen={showStageInfo}
        onClose={() => setShowStageInfo(false)}
      />
    </>
  );
};

export default SharedBanner;
