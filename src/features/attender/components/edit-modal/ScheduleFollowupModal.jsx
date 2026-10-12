import React, { useState } from "react";
import { CalendarDays, CheckCircle2, X } from "lucide-react";
import { CustomDateTimePicker } from "./CustomDateTimePicker";
import { getLocalDateString } from "../../utils";

export const ScheduleFollowupModal = ({
  isOpen,
  stageName = "",
  leadName = "",
  initialDate = "",
  initialTime = "",
  onClose,
  onSkipAndSave,
  onScheduleAndSave
}) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialDate) return initialDate;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getLocalDateString(tomorrow);
  });
  const [selectedTime, setSelectedTime] = useState(initialTime || "");

  if (!isOpen) return null;

  const handleQuickOffset = (days) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setSelectedDate(getLocalDateString(target));
  };

  const handleConfirm = () => {
    if (!selectedDate) {
      return;
    }
    onScheduleAndSave(selectedDate, selectedTime);
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200 flex flex-col space-y-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <CalendarDays size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Schedule Follow-up Call
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {leadName ? `${leadName} · ` : ""}
                {stageName ? `${stageName}` : "Active Follow-up"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 leading-relaxed">
          Leads in this stage benefit from a scheduled callback. You can pick a date below or choose to skip.
        </div>

        {/* Quick Date Presets */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Quick Suggestions
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Tomorrow", days: 1 },
              { label: "In 2 Days", days: 2 },
              { label: "In 3 Days", days: 3 },
              { label: "Next Week", days: 7 }
            ].map(preset => {
              const target = new Date();
              target.setDate(target.getDate() + preset.days);
              const targetStr = getLocalDateString(target);
              const isSelected = selectedDate === targetStr;

              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleQuickOffset(preset.days)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer text-center truncate ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Date & Time Picker */}
        <div className="pt-1">
          <CustomDateTimePicker
            dateValue={selectedDate}
            timeValue={selectedTime}
            onDateChange={setSelectedDate}
            onTimeChange={setSelectedTime}
            dateLabel="Callback Date"
            timeLabel="Callback Time (Optional)"
            themeColor="indigo"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkipAndSave}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Skip and Save
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              disabled={!selectedDate}
            >
              <CheckCircle2 size={14} />
              Schedule and Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
