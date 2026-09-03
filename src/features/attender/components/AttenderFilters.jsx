import React from "react";
import {
  Search, SlidersHorizontal, FileSpreadsheet, Flame, Clock, Tag,
  ChevronDown, X, AlertCircle, Phone, PhoneOff, Calendar, CalendarDays,
  User, Users, CheckCircle2, CheckSquare, MoreHorizontal, PhoneOutgoing, RefreshCw, Loader
} from "lucide-react";
import { STATUS_OPTIONS } from "../utils";

function MultiSelectDropdown({
  label,
  icon,
  options,
  selectedValues = [],
  onChange,
  placeholder = "Search...",
  colorClass = "text-indigo-500",
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = React.useMemo(() => {
    return options.filter(opt => {
      const displayLabel = typeof opt === "object" ? opt.label : opt;
      return String(displayLabel || "").toLowerCase().includes(search.toLowerCase());
    });
  }, [options, search]);

  const handleToggle = (opt) => {
    const value = typeof opt === "object" ? opt.value : opt;
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const isChecked = (opt) => {
    const value = typeof opt === "object" ? opt.value : opt;
    return selectedValues.includes(value);
  };

  const hasSelection = selectedValues && selectedValues.length > 0;

  return (
    <div ref={containerRef} className="relative space-y-1.5 transition-all">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none flex items-center gap-1 select-none">
        {icon} {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100/50 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          hasSelection 
            ? "border-indigo-300 bg-indigo-50/30 text-indigo-700 font-bold" 
            : "border-gray-200"
        }`}
      >
        <span className="truncate">
          {!hasSelection
            ? `All ${label}s`
            : `${selectedValues.length} Selected`}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-300 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <div className={`absolute left-0 mt-1.5 w-full min-w-[200px] max-w-[280px] bg-white border border-gray-200 rounded-2xl shadow-xl z-50 flex flex-col p-3 transition-all duration-200 transform origin-top ${
        isOpen
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
      }`}>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all duration-200 rounded-xl px-2.5 py-1.5 mb-2 shrink-0">
          <Search size={12} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-xs font-semibold text-gray-700 outline-none w-full placeholder:text-gray-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="p-0.5 hover:bg-gray-200 rounded-full transition text-gray-400 shrink-0 active:scale-90"
            >
              <X size={10} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] font-black text-indigo-600 uppercase tracking-wider px-1 mb-2 shrink-0 select-none">
          <button
            type="button"
            onClick={() => {
              const allVals = options.map(opt => typeof opt === "object" ? opt.value : opt);
              onChange(allVals);
            }}
            className="hover:underline hover:scale-[1.02] active:scale-[0.98] transition-transform duration-100"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={() => {
              onChange([]);
            }}
            className="hover:underline text-rose-600 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-100"
          >
            Clear
          </button>
        </div>

        <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1 flex-1">
          {filteredOptions.map((opt, idx) => {
            const checked = isChecked(opt);
            const val = typeof opt === "object" ? opt.value : opt;
            const displayLabel = typeof opt === "object" ? opt.label : opt;
            return (
              <label
                key={val + "-" + idx}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-150 text-xs font-bold hover:scale-[1.01] active:scale-[0.99] ${
                  checked ? "bg-indigo-50/40 text-indigo-700 font-extrabold" : "text-gray-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggle(opt)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 transition-all duration-150"
                />
                <span className="truncate">{displayLabel}</span>
              </label>
            );
          })}
          {filteredOptions.length === 0 && (
            <div className="text-center py-4 text-xs font-semibold text-gray-400 select-none">
              No matches.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export function AttenderFilters({
  // Working controls props (Tag selection & Get numbers)
  programs = [],
  selectedProgramId,
  setSelectedProgramId,
  selectedProgramName,
  setSelectedProgramName,
  setSelectedSubProgram,
  programDropOpen,
  setProgramDropOpen,
  programSearch,
  setProgramSearch,
  requestCount,
  setRequestCount,
  handleGetNumbers,
  isRequesting,
  handleRebuildCache,
  isRebuildingCache,

  isLoadingProgram = false,
  // Search & sorting
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  setPage,

  // Advanced toggle
  showAdvancedFilters,
  setShowAdvancedFilters,
  activeFiltersCount,

  // Columns toggle
  hiddenColumns,
  allPossibleCols,
  setIsColumnModalOpen,

  // Status quick filters
  filterStatus,
  setFilterStatus,

  // Tags filter
  availableTags,
  selectedTags,
  setSelectedTags,
  tagDropdownOpen,
  setTagDropdownOpen,
  tagSearchQuery,
  setTagSearchQuery,
  tagFilteredLogsLength,
  resetOtherFilters,

  // Stats for banner
  stats,

  // Advanced filters state
  filterSource,
  setFilterSource,
  filterCity,
  setFilterCity,
  filterCalledFor,
  setFilterCalledFor,
  filterCallType,
  setFilterCallType,
  filterSubProgram,
  setFilterSubProgram,
  filterObjectionReason,
  setFilterObjectionReason,
  filterCallbackStatus,
  setFilterCallbackStatus,
  filterCallCount,
  setFilterCallCount,
  filterGeneralStatus,
  setFilterGeneralStatus,
  filterQueryStatus,
  setFilterQueryStatus,
  filterAbhivyakti,
  setFilterAbhivyakti,
  filterKhoji,
  setFilterKhoji,
  filterDateType,
  setFilterDateType,
  filterDateRange,
  setFilterDateRange,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  customTimeFrom,
  setCustomTimeFrom,
  customTimeTo,
  setCustomTimeTo,

  // Dropdown options arrays
  uniqueSources,
  uniqueCities,
  uniqueCalledFor,
  uniqueSubPrograms,
  uniqueObjectionReasons,

  // Clear filters handler
  handleClearAllFilters,

  // Manual search trigger handler
  onTriggerSearch,

  // Mobile hide options
  hideTagFilter = false,
  hideSort = false
}) {
  const [searchDraft, setSearchDraft] = React.useState(searchQuery);
  const [filterSearchQuery, setFilterSearchQuery] = React.useState("");
  const [showDatePickerModal, setShowDatePickerModal] = React.useState(false);
  const [appliedFeedback, setAppliedFeedback] = React.useState("");
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false);
  const drawerSearchInputRef = React.useRef(null);

  React.useEffect(() => {
    setSearchDraft(searchQuery);
  }, [searchQuery]);

  // Handle Keyboard Shortcuts for Filter Drawer (Escape key)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && showAdvancedFilters) {
        setShowAdvancedFilters(false);
      }
    };
    if (showAdvancedFilters) {
      window.addEventListener("keydown", handleKeyDown);
      setTimeout(() => drawerSearchInputRef.current?.focus(), 50);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAdvancedFilters, setShowAdvancedFilters]);

  const handleExecuteSearch = () => {
    setSearchQuery(searchDraft);
    setPage(1);
    if (onTriggerSearch) onTriggerSearch(searchDraft);
  };

  // Structured All Filter Categories Registry for Global Filter Value Search
  const allCategories = React.useMemo(() => [
    {
      id: "source",
      name: "Source",
      group: "CONTACT",
      selected: filterSource || [],
      onChange: (vals) => { setFilterSource(vals); setPage(1); },
      options: (uniqueSources || []).map(s => typeof s === "object" ? s : { value: s, label: String(s || "") })
    },
    {
      id: "city",
      name: "City",
      group: "CONTACT",
      selected: filterCity || [],
      onChange: (vals) => { setFilterCity(vals); setPage(1); },
      options: (uniqueCities || []).map(c => typeof c === "object" ? c : { value: c, label: String(c || "") })
    },
    {
      id: "calledFor",
      name: "Called For",
      group: "CONTACT",
      selected: filterCalledFor || [],
      onChange: (vals) => { setFilterCalledFor(vals); setPage(1); },
      options: (uniqueCalledFor || []).map(cf => typeof cf === "object" ? cf : { value: cf, label: String(cf || "") })
    },
    {
      id: "callType",
      name: "Call Type",
      group: "CALL",
      selected: filterCallType || [],
      onChange: (vals) => { setFilterCallType(vals); setPage(1); },
      options: [
        { value: "incoming", label: "Incoming" },
        { value: "outgoing", label: "Outgoing" },
        { value: "incoming f", label: "Incoming Forward" },
        { value: "outgoing f", label: "Outgoing Forward" }
      ]
    },
    {
      id: "callCount",
      name: "Call Count",
      group: "CALL",
      selected: filterCallCount || [],
      onChange: (vals) => { setFilterCallCount(vals); setPage(1); },
      options: [
        { value: "0", label: "0 Calls (Never Called)" },
        { value: "1", label: "1 Call" },
        { value: "2+", label: "2+ Calls" }
      ]
    },
    {
      id: "callbackStatus",
      name: "Callback Status",
      group: "CALL",
      selected: filterCallbackStatus || [],
      onChange: (vals) => { setFilterCallbackStatus(vals); setPage(1); },
      options: [
        { value: "pending", label: "Pending" },
        { value: "done", label: "Done" },
        { value: "rescheduled", label: "Rescheduled" },
        { value: "cancelled", label: "Cancelled" }
      ]
    },
    {
      id: "subProgram",
      name: "Sub Program",
      group: "LEAD",
      selected: filterSubProgram || [],
      onChange: (vals) => { setFilterSubProgram(vals); setPage(1); },
      options: (uniqueSubPrograms || []).map(sp => typeof sp === "object" ? sp : { value: sp, label: String(sp || "") })
    },
    {
      id: "objection",
      name: "Objection Reason",
      group: "LEAD",
      selected: filterObjectionReason || [],
      onChange: (vals) => { setFilterObjectionReason(vals); setPage(1); },
      options: (uniqueObjectionReasons || []).map(o => typeof o === "object" ? o : { value: o, label: String(o || "") })
    },
    {
      id: "genStatus",
      name: "Pipeline & Status",
      group: "LEAD",
      selected: filterGeneralStatus || [],
      onChange: (vals) => { setFilterGeneralStatus(vals); setPage(1); },
      options: [
        { value: "1. New Lead", label: "1. New Lead" },
        { value: "2. Attempting Contact", label: "2. Attempting Contact" },
        { value: "3. Information Given", label: "3. Information Given" },
        { value: "Previous Program Pending", label: "Previous Program Pending" },
        { value: "4. Nurture / Interested", label: "4. Nurture / Interested" },
        { value: "5. Future Pool", label: "5. Future Pool" },
        { value: "6. Registered / Won", label: "6. Registered / Won" },
        { value: "Existing Alumni", label: "Existing Alumni" },
        { value: "Query Desk", label: "Query Desk" },
        { value: "Closed / Lost", label: "Closed / Lost" },
        { value: "Closed / Invalid", label: "Closed / Invalid" },
        ...(STATUS_OPTIONS || []).filter(opt => opt !== "Reg.Done").map(st => typeof st === "object" ? st : { value: st, label: String(st || "") })
      ]
    },
    {
      id: "abhivyakti",
      name: "Abhivyakti",
      group: "SPECIAL",
      selected: filterAbhivyakti || [],
      onChange: (vals) => { setFilterAbhivyakti(vals); setPage(1); },
      options: [
        { value: "Yes", label: "Yes (Registered)" },
        { value: "No", label: "No (Not Registered)" }
      ]
    },
    {
      id: "khoji",
      name: "Khoji Status",
      group: "SPECIAL",
      selected: filterKhoji || [],
      onChange: (vals) => { setFilterKhoji(vals); setPage(1); },
      options: [
        { value: "Yes", label: "Yes (Khoji)" },
        { value: "No", label: "No (New)" },
        { value: "Dew drop khoji", label: "Dew drop khoji" }
      ]
    }
  ], [
    filterSource, filterCity, filterCalledFor, filterCallType, filterCallCount,
    filterCallbackStatus, filterSubProgram, filterObjectionReason, filterGeneralStatus,
    filterAbhivyakti, filterKhoji, uniqueSources, uniqueCities, uniqueCalledFor,
    uniqueSubPrograms, uniqueObjectionReasons, setFilterSource, setFilterCity,
    setFilterCalledFor, setFilterCallType, setFilterCallCount, setFilterCallbackStatus,
    setFilterSubProgram, setFilterObjectionReason, setFilterGeneralStatus,
    setFilterAbhivyakti, setFilterKhoji, setPage
  ]);

  // Compute Active Filter Chips List
  const activeChips = React.useMemo(() => {
    const chips = [];
    allCategories.forEach(cat => {
      cat.selected.forEach(val => {
        const opt = cat.options.find(o => o.value === val);
        chips.push({
          catId: cat.id,
          catName: cat.name,
          val: val,
          label: opt ? opt.label : String(val),
          remove: () => cat.onChange(cat.selected.filter(v => v !== val))
        });
      });
    });

    if (filterDateType && filterDateType !== "All") {
      const dateLabel = filterDateType === "lastCalledAt" ? "Last Called" : "Assignment Date";
      chips.push({
        catId: "date",
        catName: "Date",
        val: filterDateRange,
        label: `${dateLabel}: ${filterDateRange}`,
        remove: () => {
          setFilterDateType("All");
          setFilterDateRange("All");
          setCustomDateFrom("");
          setCustomDateTo("");
        }
      });
    }
    return chips;
  }, [allCategories, filterDateType, filterDateRange, setFilterDateType, setFilterDateRange, setCustomDateFrom, setCustomDateTo]);

  // Perform Global Value & Field Search across all Categories
  const searchResults = React.useMemo(() => {
    const query = filterSearchQuery.trim().toLowerCase();
    if (!query) return null;

    const results = [];
    allCategories.forEach(cat => {
      const catNameMatches = cat.name.toLowerCase().includes(query);
      const matchedOpts = cat.options.filter(opt =>
        String(opt.label).toLowerCase().includes(query) ||
        String(opt.value).toLowerCase().includes(query)
      );

      if (catNameMatches || matchedOpts.length > 0) {
        results.push({
          category: cat,
          displayOptions: catNameMatches ? cat.options : matchedOpts
        });
      }
    });
    return results;
  }, [filterSearchQuery, allCategories]);

  React.useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && showAdvancedFilters) {
        setShowAdvancedFilters(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAdvancedFilters, setShowAdvancedFilters]);

  const handleApplyFilters = () => {
    setShowAdvancedFilters(false);
    setAppliedFeedback(`${activeChips.length} filter${activeChips.length === 1 ? "" : "s"} applied`);
    setTimeout(() => setAppliedFeedback(""), 3000);
  };

  return (
    <>
      {/* Overdue Callbacks Banner */}
      {stats.callbacks > 0 && filterStatus !== "Callback" && (
        <div 
          className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-lg shadow-red-600/10 cursor-pointer" 
          onClick={() => { setFilterStatus("Callback"); setPage(1); }}
        >
          <div className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
              <AlertCircle size={18} />
            </div>
            <div>
              <p className="font-black text-xs leading-none">You have {stats.callbacks} callback{stats.callbacks > 1 ? "s" : ""} due today or overdue!</p>
              <p className="text-white/70 text-[11px] font-medium mt-0.5">Click here to view them. These people are waiting for your call.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-xl text-white font-black text-xs">
            <Phone size={13} /> Call Now
          </div>
        </div>
      )}

      {/* Row 2: Data Controls (Search contacts, Tag selection, Get Numbers, More menu) */}
      <div className="bg-white border-b border-slate-200 px-5 py-2 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* Search contacts input with Search button */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px] max-w-md">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:bg-white transition flex-1">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchDraft}
                onChange={e => setSearchDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleExecuteSearch();
                  }
                }}
                className="bg-transparent text-xs font-medium outline-none w-full text-slate-800 placeholder-slate-400"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchDraft("");
                    setSearchQuery("");
                    setPage(1);
                    if (onTriggerSearch) onTriggerSearch("");
                  }}
                  className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0 cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExecuteSearch}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-lg font-semibold text-xs transition shadow-2xs cursor-pointer shrink-0"
              title="Search contacts (Enter)"
            >
              <Search size={13} />
              <span>Search</span>
            </button>
          </div>

          {/* Get Numbers Workflow Group */}
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg p-1 shrink-0">
            {/* Searchable Tag Dropdown */}
            <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setProgramDropOpen?.(false); setProgramSearch?.(""); } }}>
              <button
                type="button"
                onClick={() => { setProgramDropOpen?.(o => !o); setProgramSearch?.(""); }}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-md px-2.5 py-1 focus:outline-none cursor-pointer min-w-[130px] max-w-[200px]"
              >
                <span className="truncate">
                  {selectedProgramId ? (programs?.find(p => p.id === selectedProgramId)?.name || "Select Tag...") : "Select Tag..."}
                </span>
                <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform ${programDropOpen ? "rotate-180" : ""}`} />
              </button>

              {programDropOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search tags..."
                        value={programSearch}
                        onChange={e => setProgramSearch?.(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={() => { setSelectedProgramId?.(""); setSelectedProgramName?.(""); setSelectedSubProgram?.(""); setProgramDropOpen?.(false); setProgramSearch?.(""); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition ${!selectedProgramId ? "text-indigo-600 bg-indigo-50/50 font-semibold" : "text-slate-400"}`}
                    >
                      — Select Tag...
                    </button>
                    {(programs || [])
                      .filter(p => !programSearch || p.name.toLowerCase().includes(programSearch.toLowerCase()))
                      .map(p => (
                        <button
                          key={p.id}
                          type="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedProgramId?.(p.id);
                            setSelectedProgramName?.(p.name);
                            setSelectedSubProgram?.("");
                            setProgramDropOpen?.(false);
                            setProgramSearch?.("");
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition truncate ${selectedProgramId === p.id ? "text-indigo-600 bg-indigo-50/50 font-semibold" : "text-slate-700"}`}
                        >
                          {p.name}
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">
              <button onClick={() => setRequestCount?.(c => Math.max(5, c - 5))} className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-900 font-bold text-xs cursor-pointer">-</button>
              <span className="w-6 text-center font-mono font-bold text-xs text-slate-800">{requestCount}</span>
              <button onClick={() => setRequestCount?.(c => c + 5)} className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-900 font-bold text-xs cursor-pointer">+</button>
            </div>

            <button
              onClick={handleGetNumbers}
              disabled={isRequesting || !selectedProgramId}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-md font-semibold text-xs disabled:opacity-50 transition shadow-2xs cursor-pointer shrink-0"
            >
              {isRequesting ? <Loader size={12} className="animate-spin" /> : <PhoneOutgoing size={12} />}
              Get Numbers
            </button>
          </div>

          {/* More Menu (⋯) Dropdown */}
          <div className="relative shrink-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setMoreMenuOpen(false); }}>
            <button
              type="button"
              onClick={() => setMoreMenuOpen(o => !o)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
              title="More Options"
            >
              <MoreHorizontal size={16} />
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-fadeIn">
                <button
                  type="button"
                  onClick={() => { setMoreMenuOpen(false); handleRebuildCache?.(); }}
                  disabled={isRebuildingCache}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isRebuildingCache ? "animate-spin text-slate-500" : "text-slate-400"} />
                  <span>{isRebuildingCache ? "Rebuilding Cache..." : "Rebuild Cache"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMoreMenuOpen(false); window.location.reload(); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                >
                  <RefreshCw size={13} className="text-slate-400" />
                  <span>Refresh Data</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Filter & View Section (Controls + View Pills) */}
      <div className="bg-white border-b border-slate-200 px-5 py-2 flex items-center justify-between gap-4 flex-wrap shrink-0">
        {/* Controls group (Filters, Sort, Columns) */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Advanced Filters Drawer Button (Maintains active state when drawer is open or filters applied) */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer shrink-0 ${
              showAdvancedFilters || activeFiltersCount > 0
                ? "bg-indigo-50/90 border-indigo-300 text-indigo-700 font-bold shadow-2xs ring-2 ring-indigo-500/10"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <SlidersHorizontal size={13} className={showAdvancedFilters || activeFiltersCount > 0 ? "text-indigo-600" : "text-slate-500"} />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-600 text-white font-extrabold text-[10px] rounded-full shadow-2xs">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Sort Dropdown */}
          {!hideSort && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 shrink-0">
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setPage(1); }}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="activityDesc">Sort: Latest Activity</option>
                <option value="createdDesc">Sort: Date Assigned</option>
                <option value="nameAsc">Sort: Name (A-Z)</option>
              </select>
            </div>
          )}

          {/* Columns Button */}
          <button
            onClick={() => setIsColumnModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border active:scale-[0.97] shrink-0 ${
              hiddenColumns.length > 0
                ? "bg-teal-50 border-teal-200 text-teal-700 font-bold"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <FileSpreadsheet size={13} />
            Columns {hiddenColumns.length > 0 && `(${allPossibleCols.length - hiddenColumns.length}/${allPossibleCols.length})`}
          </button>

          {/* Clear Filters Button (surfaced outside in main toolbar when active) */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={() => {
                handleClearAllFilters?.();
                setShowAdvancedFilters(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-lg text-xs font-semibold transition shrink-0 active:scale-[0.97] cursor-pointer"
              title="Clear all active filters"
            >
              <X size={13} className="text-rose-500" />
              <span>Clear Filters</span>
            </button>
          )}

          {appliedFeedback && (
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-md animate-fade-in shrink-0">
              ✓ {appliedFeedback}
            </span>
          )}
        </div>

        {/* Views group (Light gray pills navigation with purple active tab) */}
        <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 py-0.5 select-none">
          {[
            { id: "All", label: "All", icon: null },
            { id: "Hot Leads", label: "Hot Leads", icon: Flame },
            { id: "Follow up", label: "Follow-up", icon: Clock },
            { id: "Unanswered Callback", label: "Unanswered", icon: PhoneOff },
            { id: "Today Activity", label: "Today", icon: Calendar },
            { id: "Shared", label: "Shared", icon: Users },
          ].map(tab => {
            const isActive = filterStatus === tab.id;
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setFilterStatus(tab.id); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-150 ease-in-out cursor-pointer h-7 ${
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold"
                    : "bg-slate-100 border-slate-200/60 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                }`}
              >
                {IconComp && (
                  <IconComp size={12} className={`shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── HIGH-SPEED RIGHT-SIDE FILTER DRAWER ────────────────────────────────── */}
      {showAdvancedFilters && (
        <>
          {/* Subtle Semi-Transparent Backdrop Overlay (dim underlying content, clicking closes) */}
          <div
            className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-200 animate-fadeIn"
            onClick={() => setShowAdvancedFilters(false)}
          />

          {/* Premium Right-Side Filter Drawer (contained within viewport, 400px fixed width on desktop, 90vw on mobile) */}
          <div className="fixed top-0 right-0 z-[110] w-[90vw] sm:w-[400px] max-w-[420px] bg-white border-l border-slate-200/80 shadow-2xl flex flex-col h-[100dvh] overflow-hidden transition-transform duration-200 ease-in-out animate-drawer-right">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100/70 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                    <SlidersHorizontal size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight">Advanced Filters</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Filter contacts using multiple criteria</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(false)}
                  className="p-1.5 hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer"
                  title="Close Filters (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Header Filter Counter Summary */}
              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-200/60 font-medium">
                <span className="text-slate-500 font-semibold">{allCategories.length} filter categories</span>
                {activeChips.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full text-[11px]">
                      {activeChips.length} active
                    </span>
                    <button
                      type="button"
                      onClick={() => handleClearAllFilters()}
                      className="text-rose-600 hover:underline font-semibold text-xs cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">No active filters</span>
                )}
              </div>
            </div>

            {/* Global Filter & Value Search Input (Most Important UX Feature) */}
            <div className="px-5 py-3 border-b border-slate-100 bg-white shrink-0 space-y-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-colors rounded-md px-3 py-2">
                <Search size={15} className="text-slate-400 shrink-0" />
                <input
                  ref={drawerSearchInputRef}
                  type="text"
                  placeholder="Search filters, values, or fields..."
                  value={filterSearchQuery}
                  onChange={e => setFilterSearchQuery(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-800 outline-none w-full placeholder:text-slate-400"
                />
                {filterSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterSearchQuery("")}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Active Filter Chips Summary */}
              {activeChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 max-h-24 overflow-y-auto">
                  {activeChips.map(chip => (
                    <span
                      key={chip.catId + "-" + chip.val}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-md text-xs font-semibold"
                    >
                      <span className="text-[10px] text-indigo-500 uppercase font-bold">{chip.catName}:</span>
                      <span>{chip.label}</span>
                      <button
                        type="button"
                        onClick={chip.remove}
                        className="text-indigo-400 hover:text-indigo-800 p-0.5 rounded cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* ── MODE 1: GLOBAL VALUE & FIELD SEARCH RESULTS ── */}
              {filterSearchQuery.trim() !== "" ? (
                <div className="space-y-4">
                  {searchResults && searchResults.length > 0 ? (
                    <>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {searchResults.length} Filter Group{searchResults.length > 1 ? "s" : ""} Matched
                      </div>
                      {searchResults.map(({ category, displayOptions }) => (
                        <div key={category.id} className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                          <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800">
                            <span className="uppercase tracking-wider text-[11px] text-indigo-600">{category.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {category.selected.length} / {category.options.length} selected
                            </span>
                          </div>
                          <div className="p-2 divide-y divide-slate-50 max-h-48 overflow-y-auto">
                            {displayOptions.map((opt, idx) => {
                              const checked = category.selected.includes(opt.value);
                              return (
                                <label
                                  key={category.id + "-" + opt.value + "-" + idx}
                                  className={`flex items-center justify-between px-3 py-2 rounded text-xs font-medium cursor-pointer transition-colors ${
                                    checked ? "bg-indigo-50/70 text-indigo-950 font-semibold" : "hover:bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        if (checked) {
                                          category.onChange(category.selected.filter(v => v !== opt.value));
                                        } else {
                                          category.onChange([...category.selected, opt.value]);
                                        }
                                      }}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <span className="truncate">{opt.label}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono uppercase ml-2 shrink-0">{category.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="p-8 text-center space-y-2 border border-dashed border-slate-200 rounded-lg">
                      <div className="text-slate-700 font-semibold text-xs">No matching filters for "{filterSearchQuery}"</div>
                      <p className="text-slate-400 text-xs">
                        Try searching for: <span className="font-mono text-indigo-600">source, city, status, program, phone</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setFilterSearchQuery("")}
                        className="mt-2 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Clear Filter Search
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ── MODE 2: DEFAULT GROUPED FILTER PANELS ── */
                <div className="space-y-6">
                  {/* GROUP 1 — CONTACT */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                      Group 1 — Contact Details
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {allCategories.filter(c => c.group === "CONTACT").map(cat => (
                        <MultiSelectDropdown
                          key={cat.id}
                          label={cat.name}
                          icon={<User size={12} className="text-slate-400" />}
                          options={cat.options}
                          selectedValues={cat.selected}
                          onChange={cat.onChange}
                          placeholder={`Search ${cat.name.toLowerCase()}...`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* GROUP 2 — CALL */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                      Group 2 — Call & Attempts
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {allCategories.filter(c => c.group === "CALL").map(cat => (
                        <MultiSelectDropdown
                          key={cat.id}
                          label={cat.name}
                          icon={<Phone size={12} className="text-slate-400" />}
                          options={cat.options}
                          selectedValues={cat.selected}
                          onChange={cat.onChange}
                          placeholder={`Search ${cat.name.toLowerCase()}...`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* GROUP 3 — LEAD */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                      Group 3 — Lead & Status
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {allCategories.filter(c => c.group === "LEAD").map(cat => (
                        <MultiSelectDropdown
                          key={cat.id}
                          label={cat.name}
                          icon={<Tag size={12} className="text-slate-400" />}
                          options={cat.options}
                          selectedValues={cat.selected}
                          onChange={cat.onChange}
                          placeholder={`Search ${cat.name.toLowerCase()}...`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* GROUP 4 — SPECIAL */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                      Group 4 — Special Classifications
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {allCategories.filter(c => c.group === "SPECIAL").map(cat => (
                        <MultiSelectDropdown
                          key={cat.id}
                          label={cat.name}
                          icon={<CheckCircle2 size={12} className="text-slate-400" />}
                          options={cat.options}
                          selectedValues={cat.selected}
                          onChange={cat.onChange}
                          placeholder={`Search ${cat.name.toLowerCase()}...`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* DATE PARAMETERS SECTION */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-slate-500" /> Date Parameters
                      </span>
                      {filterDateType !== "All" && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterDateType("All");
                            setFilterDateRange("All");
                            setCustomDateFrom("");
                            setCustomDateTo("");
                          }}
                          className="text-[10px] text-rose-600 hover:underline font-semibold cursor-pointer"
                        >
                          Clear Date
                        </button>
                      )}
                    </div>

                    {/* Date Target Selector Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-md">
                      {[
                        { label: "No Date", value: "All" },
                        { label: "Last Called", value: "lastCalledAt" },
                        { label: "Assigned", value: "createdAt" }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setFilterDateType(opt.value);
                            setPage(1);
                            if (opt.value === "All") {
                              setFilterDateRange("All");
                              setCustomDateFrom("");
                              setCustomDateTo("");
                            } else if (filterDateRange === "All") {
                              setFilterDateRange("Today");
                            }
                          }}
                          className={`py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                            filterDateType === opt.value
                              ? "bg-white text-indigo-700 shadow-2xs font-bold"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Revealable Date Range & Custom From/To */}
                    {filterDateType !== "All" && (
                      <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-md animate-fade-in">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Range</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "Today", value: "Today" },
                              { label: "Yesterday", value: "Yesterday" },
                              { label: "Last 7 Days", value: "This Week" },
                              { label: "Custom", value: "Custom" }
                            ].map(range => (
                              <button
                                key={range.value}
                                type="button"
                                onClick={() => {
                                  setFilterDateRange(range.value);
                                  setPage(1);
                                  if (range.value !== "Custom") {
                                    setCustomDateFrom("");
                                    setCustomDateTo("");
                                  }
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                                  filterDateRange === range.value
                                    ? "bg-indigo-600 border-indigo-600 text-white font-semibold"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {range.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* From / To Date Inputs */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">From Date</label>
                            <input
                              type="date"
                              value={customDateFrom}
                              onChange={e => {
                                setCustomDateFrom(e.target.value);
                                setFilterDateRange("Custom");
                                setPage(1);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">To Date</label>
                            <input
                              type="date"
                              value={customDateTo}
                              onChange={e => {
                                setCustomDateTo(e.target.value);
                                setFilterDateRange("Custom");
                                setPage(1);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Drawer Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3.5 flex items-center justify-between shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-20">
              <button
                type="button"
                onClick={() => handleClearAllFilters()}
                className="text-xs font-semibold text-slate-600 hover:text-rose-600 transition cursor-pointer"
              >
                Clear all filters
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-md transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-2xs transition active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                >
                  <span>Apply Filters</span>
                  {activeChips.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-white/20 text-white text-[10px] font-bold flex items-center justify-center">
                      {activeChips.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dedicated Historical Date Range Picker Modal */}
      {showDatePickerModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowDatePickerModal(false); }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <CalendarDays size={18} className="text-indigo-600" />
                  Historical Date Range
                </h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  Fetch historical lead partitions older than 3 months on-demand
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePickerModal(false)}
                className="p-2 hover:bg-gray-100 active:scale-90 rounded-xl transition text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Date Parameter Field */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Filter By Date Field</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFilterDateType("lastCalledAt")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                    filterDateType === "lastCalledAt" || filterDateType === "All"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-black"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Last Called Date
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDateType("createdAt")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                    filterDateType === "createdAt"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-black"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Assignment Date
                </button>
              </div>
            </div>

            {/* Date Inputs */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-700">Select Date Range</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">From Date</span>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={e => {
                      setCustomDateFrom(e.target.value);
                      if (filterDateType === "All") setFilterDateType("lastCalledAt");
                      setFilterDateRange("Custom");
                    }}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">To Date</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={e => {
                      setCustomDateTo(e.target.value);
                      if (filterDateType === "All") setFilterDateType("lastCalledAt");
                      setFilterDateRange("Custom");
                    }}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setFilterDateType("All");
                  setFilterDateRange("All");
                  setCustomDateFrom("");
                  setCustomDateTo("");
                  setPage(1);
                  setShowDatePickerModal(false);
                }}
                className="px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Reset to 3-Month Window
              </button>

              <button
                type="button"
                onClick={() => {
                  if (filterDateType === "All") setFilterDateType("lastCalledAt");
                  if (!customDateFrom && !customDateTo) setFilterDateRange("This Month");
                  else setFilterDateRange("Custom");
                  setPage(1);
                  setShowDatePickerModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md transition"
              >
                Apply Date Range
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }
