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
  currentAttenderId,
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

  // CRITICAL RULE: NEVER use `edited` (unsaved modal state) to determine the Shared Banner.
  // The current form is what the VIEWER is editing. The banner shows the OTHER PERSON'S previous activity.
  const baseLead = freshSharedLead || globalDup?.first || row;
  if (!baseLead) return null;

  const cId = String(currentAttenderId || "").trim().toLowerCase();
  const cName = String(currentAttenderName || "").trim().toLowerCase();

  const isCurrentAttender = (val) => {
    if (!val) return false;
    const v = String(val).trim().toLowerCase();
    if (cId && v === cId) return true;
    if (cName && v === cName) return true;
    return false;
  };

  const sharedList = getSharedAttenders(baseLead);
  const otherAttenders = sharedList.filter(name => !isCurrentAttender(name));

  const isDuplicateMatch = !!globalDup?.first;
  const isShared = (sharedList.length > 1 && otherAttenders.length > 0) || isDuplicateMatch || (isLeadShared(baseLead, currentAttenderName) && otherAttenders.length > 0);

  if (!isShared || otherAttenders.length === 0) return null;

  // Identify Lead Owner vs Shared Attender target
  const leadOwnerId = String(baseLead.leadOwner || baseLead.leadOwnerId || "").trim();
  const leadOwnerName = String(baseLead.leadOwnerName || "").trim();
  const isViewerOwner = isCurrentAttender(leadOwnerId) || isCurrentAttender(leadOwnerName);

  let otherName = "";
  let otherProgram = "";

  if (!isViewerOwner) {
    // Current viewer is Shared Attender B -> Target MUST be Lead Owner A (Test)
    otherName = leadOwnerName || "Lead Owner";
    let ownerState = null;

    if (baseLead.attenderStates && typeof baseLead.attenderStates === "object") {
      if (leadOwnerId && baseLead.attenderStates[leadOwnerId]) {
        ownerState = baseLead.attenderStates[leadOwnerId];
      } else if (leadOwnerName && baseLead.attenderStates[leadOwnerName]) {
        ownerState = baseLead.attenderStates[leadOwnerName];
      } else {
        ownerState = Object.values(baseLead.attenderStates).find(st => {
          if (!st) return false;
          const stId = String(st.attenderId || "").trim().toLowerCase();
          const stName = String(st.attenderName || st.name || "").trim().toLowerCase();
          return (leadOwnerId && stId === leadOwnerId.toLowerCase()) || (leadOwnerName && stName === leadOwnerName.toLowerCase());
        });
      }
    }

    if (ownerState) {
      otherName = ownerState.attenderName || ownerState.name || otherName;
      otherProgram = ownerState.calledFor || ownerState["Called For"] || ownerState.program || "";
    } else {
      otherProgram = baseLead["Called For"] || baseLead.calledFor || "";
    }

    if (!otherProgram && Array.isArray(baseLead.history)) {
      const ownerHist = [...baseLead.history].reverse().find(h => {
        if (!h) return false;
        const hId = String(h.attenderId || "").trim().toLowerCase();
        const hName = String(h.attenderName || h.name || "").trim().toLowerCase();
        return (leadOwnerId && hId === leadOwnerId.toLowerCase()) || (leadOwnerName && hName === leadOwnerName.toLowerCase());
      });
      if (ownerHist) {
        otherProgram = ownerHist.calledFor || ownerHist["Called For"] || ownerHist.program || "";
      }
    }
  } else {
    // Current viewer is Lead Owner A -> Target MUST be Shared Attender B (Manisha)
    let sharedState = null;
    if (baseLead.attenderStates && typeof baseLead.attenderStates === "object") {
      sharedState = Object.values(baseLead.attenderStates).find(st => {
        if (!st) return false;
        const stId = String(st.attenderId || "").trim().toLowerCase();
        const stName = String(st.attenderName || st.name || "").trim().toLowerCase();
        return !isCurrentAttender(stId) && !isCurrentAttender(stName);
      });
    }

    if (sharedState) {
      otherName = sharedState.attenderName || sharedState.name || "";
      otherProgram = sharedState.calledFor || sharedState["Called For"] || sharedState.program || "";
    }

    if (!otherName && Array.isArray(baseLead.history)) {
      const sharedHist = [...baseLead.history].reverse().find(h => {
        if (!h) return false;
        const hId = String(h.attenderId || "").trim().toLowerCase();
        const hName = String(h.attenderName || h.name || "").trim().toLowerCase();
        return !isCurrentAttender(hId) && !isCurrentAttender(hName);
      });
      if (sharedHist) {
        otherName = sharedHist.attenderName || sharedHist.name || "";
        otherProgram = sharedHist.calledFor || sharedHist["Called For"] || sharedHist.program || "";
      }
    }

    if (!otherName) {
      otherName = otherAttenders[0] || "Team member";
    }
  }

  const displayProgram = String(otherProgram || (isViewerOwner ? "" : (baseLead?.["Called For"] || baseLead?.calledFor || ""))).trim();

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
            <span key="activity-summary-wrapper" className="inline-flex items-center gap-1">
              <span>{otherName}</span>
              <span>has previous activity</span>
              {displayProgram && <span>for {displayProgram}</span>}
            </span>
            <span key="stage-badge-wrapper" className="text-[11px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200 inline-flex items-center gap-1">
              <span>Current stage:</span>
              <span>{prevStageDisplay}</span>
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
