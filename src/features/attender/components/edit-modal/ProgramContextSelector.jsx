import React from 'react';
import { Layers, Check, Phone, Tag, Award, Sparkles } from 'lucide-react';
import { getProgramContext } from '../../utils/programContextHelper';
import { getPipelineStageConfig } from '../../../../utils/pipelineEngine';

/**
 * ProgramContextSelector Component
 * Redesigned to be clean, compact, and program-contextual.
 * Displays program chips (without embedded stage tags) and a single active program context bar.
 */
export default function ProgramContextSelector({
  contact = {},
  programsList = [],
  activeProgram = "",
  onSelectProgram = () => {},
  attenderId = null,
  disabled = false,
}) {
  if (!Array.isArray(programsList) || programsList.length <= 1) {
    return null;
  }

  const isMultiProgram = programsList.length > 1;

  // Active program context details
  const activeProgName = activeProgram || programsList[0] || "";
  const activeCtx = getProgramContext(contact, activeProgName, attenderId);

  return (
    <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 shadow-2xs transition-all">
      {/* SECTION TITLE & PROGRAM CHIPS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <Layers size={13} className="text-slate-500 shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
            PROGRAMS FOR THIS CONTACT
          </span>
        </div>

        {/* Compact Program Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {programsList.map(progName => {
            const isActive = String(progName).trim().toLowerCase() === String(activeProgName).trim().toLowerCase();

            return (
              <button
                key={progName}
                type="button"
                disabled={disabled}
                onClick={() => onSelectProgram(progName)}
                className={`py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white border border-indigo-600 shadow-2xs font-extrabold"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 font-semibold"
                }`}
              >
                {isActive && <Check size={13} className="text-white shrink-0 stroke-[3]" />}
                <span>{progName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
