import React from "react";
import { SlidersHorizontal, Search, X, PhoneCall, PhoneOff, HelpCircle, GripVertical, Check, Layers } from "lucide-react";

export function StatusClassificationCard({
  classificationSearch,
  setClassificationSearch,
  dragOverCategory,
  setDragOverCategory,
  draggedItem,
  setDraggedItem,
  handleMoveStatus,
  displayConnectedList,
  connectedList,
  displayNotConnectedList,
  notConnectedList,
  displayUnassignedList,
  unassignedList
}) {
  return (
    <div className="space-y-4">
      {/* Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#172033] tracking-tight">
              Call Classification & Reporting Rules
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Drag & drop statuses across columns to categorize calls into Connected, Not Connected, or Unassigned.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="text"
            value={classificationSearch}
            onChange={e => setClassificationSearch(e.target.value)}
            placeholder="Search classification statuses..."
            className="w-full h-9 pl-9 pr-8 bg-white border border-[#DDE2EA] rounded-[7px] text-xs font-medium text-[#172033] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-150 shadow-[0_1px_2px_rgba(16,24,40,0.02)]"
          />
          {classificationSearch && (
            <button
              onClick={() => setClassificationSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#172033] p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Unified Elevated 3-Column Container */}
      <div className="bg-white rounded-[10px] border border-[#E4E7EC] shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.02)] overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#E4E7EC] grid md:grid-cols-3">
        {/* Column 1: Connected */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverCategory("connected"); }}
          onDragLeave={() => setDragOverCategory(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverCategory(null);
            if (draggedItem) {
              handleMoveStatus(draggedItem.status, draggedItem.fromCategory, "connected");
              setDraggedItem(null);
            }
          }}
          className={`flex flex-col transition-colors duration-150 ${
            dragOverCategory === "connected" ? "bg-emerald-50/40" : "bg-white"
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-[#E4E7EC] bg-[#FAFBFD] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall size={14} className="text-emerald-600 shrink-0" />
              <h4 className="font-semibold text-xs text-[#172033]">Connected</h4>
              <span className="text-[11px] text-[#667085]">(Answered)</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-md font-mono text-[11px] font-semibold">
              {displayConnectedList.length}
            </span>
          </div>

          {/* Body */}
          <div className="p-2.5 space-y-1.5 min-h-[220px] max-h-[400px] overflow-y-auto">
            {displayConnectedList.map((st) => (
              <div
                key={st}
                draggable
                onDragStart={(e) => {
                  setDraggedItem({ status: st, fromCategory: "connected" });
                  e.dataTransfer.setData("text/plain", JSON.stringify({ status: st, fromCategory: "connected" }));
                }}
                className="h-10 px-3 rounded-md border border-[#E4E7EC] bg-white hover:bg-[#F8FAFC] flex items-center justify-between group transition-all duration-150 cursor-grab active:cursor-grabbing text-xs shadow-2xs hover:shadow-[0_2px_6px_rgba(16,24,40,0.04)]"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <GripVertical size={13} className="text-[#98A2B3] opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
                  <span className="font-medium text-[#172033] truncate text-[13px]">{st}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleMoveStatus(st, "connected", "notConnected")}
                    title="Move to Not Connected"
                    className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60 rounded transition-colors cursor-pointer"
                  >
                    → Not Conn
                  </button>
                  <button
                    onClick={() => handleMoveStatus(st, "connected", "unassigned")}
                    title="Unassign"
                    className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-[#667085] hover:bg-slate-200 border border-slate-200/80 rounded transition-colors cursor-pointer"
                  >
                    Unassign
                  </button>
                </div>
              </div>
            ))}

            {displayConnectedList.length === 0 && (
              <div className="h-36 flex flex-col items-center justify-center border border-dashed border-[#E4E7EC] rounded-md text-center p-3">
                <p className="text-xs font-semibold text-[#172033]">
                  {classificationSearch ? "No matching statuses" : "No Connected Statuses"}
                </p>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  {classificationSearch ? "Try a different search" : "Drag status items here"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Not Connected */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverCategory("notConnected"); }}
          onDragLeave={() => setDragOverCategory(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverCategory(null);
            if (draggedItem) {
              handleMoveStatus(draggedItem.status, draggedItem.fromCategory, "notConnected");
              setDraggedItem(null);
            }
          }}
          className={`flex flex-col transition-colors duration-150 ${
            dragOverCategory === "notConnected" ? "bg-rose-50/40" : "bg-white"
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-[#E4E7EC] bg-[#FAFBFD] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneOff size={14} className="text-rose-600 shrink-0" />
              <h4 className="font-semibold text-xs text-[#172033]">Not Connected</h4>
              <span className="text-[11px] text-[#667085]">(Missed)</span>
            </div>
            <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200/80 rounded-md font-mono text-[11px] font-semibold">
              {displayNotConnectedList.length}
            </span>
          </div>

          {/* Body */}
          <div className="p-2.5 space-y-1.5 min-h-[220px] max-h-[400px] overflow-y-auto">
            {displayNotConnectedList.map((st) => (
              <div
                key={st}
                draggable
                onDragStart={(e) => {
                  setDraggedItem({ status: st, fromCategory: "notConnected" });
                  e.dataTransfer.setData("text/plain", JSON.stringify({ status: st, fromCategory: "notConnected" }));
                }}
                className="h-10 px-3 rounded-md border border-[#E4E7EC] bg-white hover:bg-[#F8FAFC] flex items-center justify-between group transition-all duration-150 cursor-grab active:cursor-grabbing text-xs shadow-2xs hover:shadow-[0_2px_6px_rgba(16,24,40,0.04)]"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <GripVertical size={13} className="text-[#98A2B3] opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
                  <span className="font-medium text-[#172033] truncate text-[13px]">{st}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleMoveStatus(st, "notConnected", "connected")}
                    title="Move to Connected"
                    className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 rounded transition-colors cursor-pointer"
                  >
                    → Connected
                  </button>
                  <button
                    onClick={() => handleMoveStatus(st, "notConnected", "unassigned")}
                    title="Unassign"
                    className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-[#667085] hover:bg-slate-200 border border-slate-200/80 rounded transition-colors cursor-pointer"
                  >
                    Unassign
                  </button>
                </div>
              </div>
            ))}

            {displayNotConnectedList.length === 0 && (
              <div className="h-36 flex flex-col items-center justify-center border border-dashed border-[#E4E7EC] rounded-md text-center p-3">
                <p className="text-xs font-semibold text-[#172033]">
                  {classificationSearch ? "No matching statuses" : "No Not-Connected Statuses"}
                </p>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  {classificationSearch ? "Try a different search" : "Drag status items here"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Not Assigned */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverCategory("unassigned"); }}
          onDragLeave={() => setDragOverCategory(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverCategory(null);
            if (draggedItem) {
              handleMoveStatus(draggedItem.status, draggedItem.fromCategory, "unassigned");
              setDraggedItem(null);
            }
          }}
          className={`flex flex-col transition-colors duration-150 ${
            dragOverCategory === "unassigned" ? "bg-slate-100/60" : "bg-white"
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-[#E4E7EC] bg-[#FAFBFD] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle size={14} className="text-[#667085] shrink-0" />
              <h4 className="font-semibold text-xs text-[#172033]">Not Assigned</h4>
              <span className="text-[11px] text-[#667085]">(Uncategorized)</span>
            </div>
            <span className="px-2 py-0.5 bg-slate-100 text-[#172033] border border-slate-200 rounded-md font-mono text-[11px] font-semibold">
              {displayUnassignedList.length}
            </span>
          </div>

          {/* Body */}
          <div className="p-2.5 space-y-1.5 min-h-[220px] max-h-[400px] overflow-y-auto">
            {displayUnassignedList.map((st) => (
              <div
                key={st}
                draggable
                onDragStart={(e) => {
                  setDraggedItem({ status: st, fromCategory: "unassigned" });
                  e.dataTransfer.setData("text/plain", JSON.stringify({ status: st, fromCategory: "unassigned" }));
                }}
                className="h-10 px-3 rounded-md border border-[#E4E7EC] bg-white hover:bg-[#F8FAFC] flex items-center justify-between group transition-all duration-150 cursor-grab active:cursor-grabbing text-xs shadow-2xs hover:shadow-[0_2px_6px_rgba(16,24,40,0.04)]"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <GripVertical size={13} className="text-[#98A2B3] opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
                  <span className="font-medium text-[#172033] truncate text-[13px]">{st}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleMoveStatus(st, "unassigned", "connected")}
                    title="Move to Connected"
                    className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 rounded transition-colors cursor-pointer"
                  >
                    → Connected
                  </button>
                  <button
                    onClick={() => handleMoveStatus(st, "unassigned", "notConnected")}
                    title="Move to Not Connected"
                    className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60 rounded transition-colors cursor-pointer"
                  >
                    → Not Conn
                  </button>
                </div>
              </div>
            ))}

            {displayUnassignedList.length === 0 && (
              <div className="h-36 flex flex-col items-center justify-center border border-dashed border-[#E4E7EC] rounded-md text-center p-3">
                <p className="text-xs font-semibold text-[#172033] flex items-center gap-1">
                  {classificationSearch ? "No matching statuses" : <><Check size={13} className="text-emerald-600" /> All Statuses Categorized</>}
                </p>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  {classificationSearch ? "Try a different search" : "Every status has been classified."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
