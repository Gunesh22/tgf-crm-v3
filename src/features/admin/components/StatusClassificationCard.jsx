import React from "react";
import { Sliders, Search, X, PhoneCall, PhoneOff, HelpCircle, GripVertical } from "lucide-react";

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
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-indigo-600" />
            <h3 className="font-bold text-gray-900 text-base">Status Call Classification (Drag & Drop)</h3>
          </div>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Drag & drop status items across the 3 columns below to control which call statuses count as Connected, Not Connected, or Not Assigned.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={classificationSearch}
            onChange={e => setClassificationSearch(e.target.value)}
            placeholder="Search status options..."
            className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-400"
          />
          {classificationSearch && (
            <button
              onClick={() => setClassificationSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Table 1: Connected Calls */}
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
          className={`rounded-2xl border transition-all duration-200 p-4 space-y-3 ${
            dragOverCategory === "connected"
              ? "bg-emerald-50/80 border-emerald-400 shadow-md ring-2 ring-emerald-400/20"
              : "bg-emerald-50/20 border-emerald-100"
          }`}
        >
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <PhoneCall size={15} />
              </div>
              <div>
                <h4 className="font-bold text-emerald-950 text-sm">Connected Calls</h4>
                <p className="text-[10px] text-emerald-700 font-medium">Answered / Actionable</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-extrabold">
              {displayConnectedList.length} / {connectedList.length}
            </span>
          </div>

          <div className="space-y-2 min-h-[220px] max-h-[420px] overflow-y-auto pr-1">
            {displayConnectedList.map((st) => (
              <div
                key={st}
                draggable
                onDragStart={(e) => {
                  setDraggedItem({ status: st, fromCategory: "connected" });
                  e.dataTransfer.setData("text/plain", JSON.stringify({ status: st, fromCategory: "connected" }));
                }}
                className="bg-white p-3 rounded-xl border border-emerald-100/80 shadow-xs flex items-center justify-between group hover:border-emerald-300 transition-all cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                  <span className="text-xs font-bold text-gray-800">{st}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMoveStatus(st, "connected", "notConnected")}
                    title="Move to Not Connected"
                    className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
                  >
                    → Not Connected
                  </button>
                  <button
                    onClick={() => handleMoveStatus(st, "connected", "unassigned")}
                    title="Unassign"
                    className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                  >
                    Unassign
                  </button>
                </div>
              </div>
            ))}

            {displayConnectedList.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-emerald-200/60 rounded-xl text-center p-4">
                <p className="text-xs font-bold text-emerald-800">
                  {classificationSearch ? "No matching statuses" : "No Connected Statuses"}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  {classificationSearch ? "Try a different search query" : "Drag status here"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Table 2: Not Connected Calls */}
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
          className={`rounded-2xl border transition-all duration-200 p-4 space-y-3 ${
            dragOverCategory === "notConnected"
              ? "bg-rose-50/80 border-rose-400 shadow-md ring-2 ring-rose-400/20"
              : "bg-rose-50/20 border-rose-100"
          }`}
        >
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
                <PhoneOff size={15} />
              </div>
              <div>
                <h4 className="font-bold text-rose-950 text-sm">Not Connected Calls</h4>
                <p className="text-[10px] text-rose-700 font-medium">Unanswered / Missed</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-xs font-extrabold">
              {displayNotConnectedList.length} / {notConnectedList.length}
            </span>
          </div>

          <div className="space-y-2 min-h-[220px] max-h-[420px] overflow-y-auto pr-1">
            {displayNotConnectedList.map((st) => (
              <div
                key={st}
                draggable
                onDragStart={(e) => {
                  setDraggedItem({ status: st, fromCategory: "notConnected" });
                  e.dataTransfer.setData("text/plain", JSON.stringify({ status: st, fromCategory: "notConnected" }));
                }}
                className="bg-white p-3 rounded-xl border border-rose-100/80 shadow-xs flex items-center justify-between group hover:border-rose-300 transition-all cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-gray-300 group-hover:text-rose-500 transition-colors" />
                  <span className="text-xs font-bold text-gray-800">{st}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMoveStatus(st, "notConnected", "connected")}
                    title="Move to Connected"
                    className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                  >
                    → Connected
                  </button>
                  <button
                    onClick={() => handleMoveStatus(st, "notConnected", "unassigned")}
                    title="Unassign"
                    className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                  >
                    Unassign
                  </button>
                </div>
              </div>
            ))}

            {displayNotConnectedList.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-rose-200/60 rounded-xl text-center p-4">
                <p className="text-xs font-bold text-rose-800">
                  {classificationSearch ? "No matching statuses" : "No Not-Connected Statuses"}
                </p>
                <p className="text-[10px] text-rose-600 mt-0.5">
                  {classificationSearch ? "Try a different search query" : "Drag status here"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Table 3: Not Assigned */}
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
          className={`rounded-2xl border transition-all duration-200 p-4 space-y-3 ${
            dragOverCategory === "unassigned"
              ? "bg-slate-100 border-slate-400 shadow-md ring-2 ring-slate-400/20"
              : "bg-gray-50/50 border-gray-100"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-200/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gray-200 flex items-center justify-center text-gray-700">
                <HelpCircle size={15} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Not Assigned</h4>
                <p className="text-[10px] text-gray-400 font-medium">Uncategorized / Other</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-gray-200 text-gray-800 rounded-full text-xs font-extrabold">
              {displayUnassignedList.length} / {unassignedList.length}
            </span>
          </div>

          <div className="space-y-2 min-h-[220px] max-h-[420px] overflow-y-auto pr-1">
            {displayUnassignedList.map((st) => (
              <div
                key={st}
                draggable
                onDragStart={(e) => {
                  setDraggedItem({ status: st, fromCategory: "unassigned" });
                  e.dataTransfer.setData("text/plain", JSON.stringify({ status: st, fromCategory: "unassigned" }));
                }}
                className="bg-white p-3 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between group hover:border-gray-400 transition-all cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-gray-300 group-hover:text-gray-600 transition-colors" />
                  <span className="text-xs font-bold text-gray-800">{st}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMoveStatus(st, "unassigned", "connected")}
                    title="Move to Connected"
                    className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                  >
                    → Connected
                  </button>
                  <button
                    onClick={() => handleMoveStatus(st, "unassigned", "notConnected")}
                    title="Move to Not Connected"
                    className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
                  >
                    → Not Connected
                  </button>
                </div>
              </div>
            ))}

            {displayUnassignedList.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-center p-4">
                <p className="text-xs font-bold text-gray-400">
                  {classificationSearch ? "No matching statuses" : "All Statuses Assigned"}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {classificationSearch ? "Try a different search query" : "Every status is categorized!"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
