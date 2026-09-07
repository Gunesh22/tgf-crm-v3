import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { parseTimeTo3Boxes, normalizeTypedTime } from "./EasyTimePicker";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Custom Date & Time Picker Component matching uploaded UI layout:
 * - Left card: Month calendar picker with weekday headers, selection highlight, Cancel/OK buttons.
 * - Right card: Time picker with ^/v steppers for Hour & Min, AM/PM toggle, formatted preview, Cancel/OK buttons.
 * - Time is optional: user can select a date with or without a time string.
 */
export const CustomDateTimePicker = ({
  dateValue = "",
  timeValue = "",
  onDateChange,
  onTimeChange,
  dateLabel = "Follow-up Date",
  timeLabel = "Follow-up Time (Optional)",
  themeColor = "blue" // "blue" | "sky" | "indigo" | "emerald"
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Parse initial or fallback date (YYYY-MM-DD)
  const initialDateObj = useMemo(() => {
    if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const [y, m, d] = dateValue.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [dateValue]);

  const [currentYear, setCurrentYear] = useState(initialDateObj.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDateObj.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(dateValue || "");

  const parsedInitialTime = useMemo(() => parseTimeTo3Boxes(timeValue), [timeValue]);
  const [hour, setHour] = useState(parsedInitialTime.hour || "10");
  const [minute, setMinute] = useState(parsedInitialTime.minute || "00");
  const [period, setPeriod] = useState(parsedInitialTime.period || "AM");
  const [hasTimeSelected, setHasTimeSelected] = useState(!!timeValue);

  const resetDateToProp = () => {
    setSelectedDateStr(dateValue || "");
    if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const [y, m] = dateValue.split("-").map(Number);
      setCurrentYear(y);
      setCurrentMonth(m - 1);
    }
  };

  const resetTimeToProp = () => {
    const p = parseTimeTo3Boxes(timeValue);
    if (timeValue) {
      setHour(p.hour || "10");
      setMinute(p.minute || "00");
      setPeriod(p.period || "AM");
      setHasTimeSelected(true);
    } else {
      setHour("10");
      setMinute("00");
      setPeriod("AM");
      setHasTimeSelected(false);
    }
  };

  // Synchronize when dateValue prop changes from parent
  useEffect(() => {
    resetDateToProp();
  }, [dateValue]);

  // Synchronize when timeValue prop changes from parent
  useEffect(() => {
    resetTimeToProp();
  }, [timeValue]);

  // Ref for closing popovers on outside click
  const containerRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (showDatePicker) resetDateToProp();
        if (showTimePicker) resetTimeToProp();
        setShowDatePicker(false);
        setShowTimePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDatePicker, showTimePicker, dateValue, timeValue]);

  // Calendar Grid Generator
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const grid = [];
    // Previous month trailing days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      grid.push({
        day: daysInPrevMonth - i,
        monthOffset: -1,
        dateStr: null
      });
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const fullDateStr = `${currentYear}-${monthStr}-${dayStr}`;
      grid.push({
        day: d,
        monthOffset: 0,
        dateStr: fullDateStr
      });
    }
    // Next month leading days to complete 35 or 42 cells
    const remaining = (7 - (grid.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      grid.push({
        day: d,
        monthOffset: 1,
        dateStr: null
      });
    }
    return grid;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (dateStr) => {
    if (!dateStr) return;
    setSelectedDateStr(dateStr);
  };

  const handleConfirmDate = () => {
    if (selectedDateStr) {
      onDateChange(selectedDateStr);
    }
    setShowDatePicker(false);
  };

  const handleCancelDate = () => {
    resetDateToProp();
    setShowDatePicker(false);
  };

  // Time Stepper Logic
  const handleHourStep = (delta) => {
    let hNum = parseInt(hour || "10", 10) + delta;
    if (hNum > 12) hNum = 1;
    if (hNum < 1) hNum = 12;
    setHour(String(hNum));
    setHasTimeSelected(true);
  };

  const handleMinuteStep = (delta) => {
    let mNum = parseInt(minute || "00", 10) + delta;
    if (mNum > 59) mNum = 0;
    if (mNum < 0) mNum = 59;
    setMinute(String(mNum).padStart(2, "0"));
    setHasTimeSelected(true);
  };

  const formattedTimePreview = useMemo(() => {
    if (!hasTimeSelected) return "No time set";
    let hNum = parseInt(hour, 10);
    if (isNaN(hNum) || hNum < 0) hNum = 10;
    let targetPeriod = period;
    if (hNum >= 12) {
      if (hNum > 12) hNum = hNum % 12;
      targetPeriod = "PM";
    }
    if (hNum === 0) hNum = 12;

    let mNum = parseInt(minute, 10);
    if (isNaN(mNum) || mNum < 0 || mNum > 59) mNum = 0;
    return `${String(hNum).padStart(2, "0")}:${String(mNum).padStart(2, "0")} ${targetPeriod}`;
  }, [hour, minute, period, hasTimeSelected]);

  const handleConfirmTime = () => {
    if (hasTimeSelected) {
      onTimeChange(formattedTimePreview);
    } else {
      onTimeChange("");
    }
    setShowTimePicker(false);
  };

  const handleClearTime = () => {
    setHasTimeSelected(false);
    onTimeChange("");
    setShowTimePicker(false);
  };

  // Format date display (e.g., "24 Oct 2026" or "Pick date")
  const formattedDateDisplay = useMemo(() => {
    if (!dateValue) return "Select date";
    const [y, m, d] = dateValue.split("-").map(Number);
    if (!y || !m || !d) return dateValue;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }, [dateValue]);

  // Color theme classes matching CRM primary colors
  const primaryBgClass = themeColor === "indigo" ? "bg-indigo-600 hover:bg-indigo-700" :
                         themeColor === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" :
                         themeColor === "sky" ? "bg-sky-600 hover:bg-sky-700" :
                         "bg-blue-600 hover:bg-blue-700";

  const primaryTextClass = themeColor === "indigo" ? "text-indigo-600" :
                           themeColor === "emerald" ? "text-emerald-600" :
                           themeColor === "sky" ? "text-sky-600" :
                           "text-blue-600";

  const primaryBorderClass = themeColor === "indigo" ? "border-indigo-500" :
                             themeColor === "emerald" ? "border-emerald-500" :
                             themeColor === "sky" ? "border-sky-500" :
                             "border-blue-500";

  return (
    <div ref={containerRef} className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 items-end w-full">
      {/* DATE CONTROL CARD / FIELD */}
      <div className="space-y-1 relative">
        <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
          {dateLabel}
        </label>
        <button
          type="button"
          onClick={() => {
            const nextState = !showDatePicker;
            if (!nextState) resetDateToProp();
            setShowDatePicker(nextState);
            setShowTimePicker(false);
          }}
          className={`w-full h-9 px-3 bg-white border border-slate-300 text-slate-900 font-bold rounded-md text-xs flex items-center justify-between shadow-2xs hover:border-blue-400 focus:outline-none transition-colors cursor-pointer ${showDatePicker ? primaryBorderClass : ""}`}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon size={14} className={primaryTextClass} />
            <span>{formattedDateDisplay}</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">▼</span>
        </button>

        {/* CUSTOM DATE PICKER CARD MODAL (LEFT CARD IN IMAGE) */}
        {showDatePicker && (
          <div className="absolute bottom-full mb-1 left-0 z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200/90 p-3 space-y-3 animate-fade-in">
            {/* Header: < October 2023 > */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer transition-colors"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="text-xs font-extrabold text-slate-800">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Weekday Headers: Su Mo Tu We Th Fr Sa */}
            <div className="grid grid-cols-7 text-center">
              {WEEKDAY_NAMES.map(day => (
                <div key={day} className="text-[10px] font-bold text-slate-400 py-0.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {calendarGrid.map((cell, idx) => {
                if (cell.monthOffset !== 0) {
                  return (
                    <div key={idx} className="h-7 w-7 mx-auto flex items-center justify-center text-[11px] text-slate-300 font-medium select-none">
                      {cell.day}
                    </div>
                  );
                }

                const isSelected = cell.dateStr === selectedDateStr;
                const todayStr = new Date().toISOString().split("T")[0];
                const isToday = cell.dateStr === todayStr;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(cell.dateStr)}
                    className={`h-7 w-7 mx-auto rounded-md flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                      isSelected
                        ? `${primaryBgClass} text-white shadow-xs scale-105`
                        : isToday
                        ? "border border-blue-500 text-blue-600 font-extrabold bg-blue-50/50 hover:bg-blue-100"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Bottom Action Bar: Cancel / OK */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelDate}
                className="flex-1 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-md transition cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDate}
                className={`flex-1 py-1.5 ${primaryBgClass} text-white font-extrabold text-xs rounded-md shadow-xs transition cursor-pointer text-center`}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TIME CONTROL CARD / FIELD */}
      <div className="space-y-1 relative">
        <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
          {timeLabel}
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const nextState = !showTimePicker;
              setShowTimePicker(nextState);
              if (nextState) {
                setHasTimeSelected(true);
              } else {
                resetTimeToProp();
              }
              setShowDatePicker(false);
            }}
            className={`w-full h-9 px-3 bg-white border border-slate-300 text-slate-900 font-bold rounded-md text-xs flex items-center justify-between shadow-2xs hover:border-blue-400 focus:outline-none transition-colors cursor-pointer ${showTimePicker ? primaryBorderClass : ""}`}
          >
            <span className="flex items-center gap-2 truncate">
              <Clock size={14} className={timeValue ? primaryTextClass : "text-slate-400"} />
              <span className={timeValue ? "text-slate-900 font-bold" : "text-slate-500 italic font-normal"}>
                {timeValue ? normalizeTypedTime(timeValue) : "No time (Optional)"}
              </span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">▼</span>
          </button>

          {timeValue && (
            <button
              type="button"
              onClick={handleClearTime}
              title="Clear time (keep optional date only)"
              className="h-9 px-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 text-slate-500 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-center shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* CUSTOM TIME PICKER CARD MODAL (RIGHT CARD IN IMAGE) */}
        {showTimePicker && (
          <div className="absolute bottom-full mb-1 right-0 z-50 w-56 bg-white rounded-xl shadow-xl border border-slate-200/90 p-3 space-y-3 animate-fade-in">
            {/* Header: Time */}
            <div className="text-xs font-extrabold text-slate-800 text-center uppercase tracking-wider">
              Time
            </div>

            <div className="border-t border-slate-100 pt-2">
              {/* Steppers Row: Hour & Min */}
              <div className="flex items-center justify-center gap-4">
                {/* HOUR STEPPER */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleHourStep(1)}
                    className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer transition-colors active:scale-95"
                  >
                    <ChevronUp size={14} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={hour}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      if (v.length > 2) v = v.slice(-2);
                      setHour(v);
                      setHasTimeSelected(true);
                    }}
                    onBlur={() => {
                      let hNum = parseInt(hour, 10);
                      if (isNaN(hNum) || hNum < 1) {
                        setHour("10");
                      } else if (hNum > 12) {
                        if (hNum <= 24) {
                          const converted = hNum % 12 || 12;
                          setHour(String(converted));
                          setPeriod("PM");
                        } else {
                          setHour("12");
                        }
                      } else {
                        setHour(String(hNum));
                      }
                    }}
                    placeholder="10"
                    maxLength={2}
                    className="w-10 h-7 text-center text-base font-extrabold text-slate-900 bg-transparent focus:outline-none"
                  />
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">hour</span>

                  <button
                    type="button"
                    onClick={() => handleHourStep(-1)}
                    className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer transition-colors active:scale-95"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <span className="text-slate-300 font-extrabold text-base select-none pb-3">:</span>

                {/* MINUTE STEPPER */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMinuteStep(5)}
                    className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer transition-colors active:scale-95"
                  >
                    <ChevronUp size={14} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={minute}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      if (v.length > 2) v = v.slice(-2);
                      setMinute(v);
                      setHasTimeSelected(true);
                    }}
                    onBlur={() => {
                      let mNum = parseInt(minute, 10);
                      if (isNaN(mNum) || mNum < 0) {
                        setMinute("00");
                      } else if (mNum > 59) {
                        setMinute("59");
                      } else {
                        setMinute(String(mNum).padStart(2, "0"));
                      }
                    }}
                    placeholder="30"
                    maxLength={2}
                    className="w-10 h-7 text-center text-base font-extrabold text-slate-900 bg-transparent focus:outline-none"
                  />
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">min</span>

                  <button
                    type="button"
                    onClick={() => handleMinuteStep(-5)}
                    className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer transition-colors active:scale-95"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {/* Segmented AM / PM Toggle */}
              <div className="mt-3 flex justify-center">
                <div className="p-0.5 bg-slate-100 rounded-md flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPeriod("AM");
                      setHasTimeSelected(true);
                    }}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                      period === "AM"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPeriod("PM");
                      setHasTimeSelected(true);
                    }}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                      period === "PM"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>

              {/* Formatted Preview */}
              <div className="mt-2 text-center text-[11px] font-extrabold text-slate-600">
                {formattedTimePreview}
              </div>
            </div>

            {/* Bottom Action Bar: OK / Clear Time (Time Optional) */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <button
                type="button"
                onClick={handleConfirmTime}
                className={`w-full py-2 ${primaryBgClass} text-white font-extrabold text-xs rounded-md shadow-xs transition cursor-pointer text-center`}
              >
                OK
              </button>
              <button
                type="button"
                onClick={handleClearTime}
                className="w-full py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-md transition cursor-pointer text-center"
              >
                Clear Time (Optional)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomDateTimePicker;
