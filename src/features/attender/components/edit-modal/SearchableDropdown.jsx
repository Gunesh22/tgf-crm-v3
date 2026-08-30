import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check, Plus } from "lucide-react";

const SearchableDropdown = ({
  options,
  selected,
  onChange,
  placeholder = "Select option...",
  isMulti = false,
  colorClass = "indigo",
  disabled = false,
  allowCreate = false,
  onCreate = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverHeight = 250;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      // If space below is constrained (< 220px), pop UPWARDS, else pop DOWNWARDS
      if (spaceBelow < 220 && rect.top > popoverHeight) {
        setCoords({
          top: Math.max(10, rect.top - popoverHeight - 4),
          left: rect.left,
          width: rect.width
        });
      } else {
        setCoords({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScrollOrResize = () => {
        updateCoords();
      };
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSelected = (opt) => {
    if (!selected || typeof opt === 'object') return false;
    if (isMulti) {
      return selected.split(",").map(x => x.trim()).filter(Boolean).includes(opt);
    }
    return selected === opt;
  };

  const handleSelect = (opt) => {
    if (typeof opt === 'object' && opt.isHeader) return;
    const val = typeof opt === 'object' ? opt.value : opt;
    if (isMulti) {
      const selectedArr = selected.split(",").map(x => x.trim()).filter(Boolean);
      let updated;
      if (selectedArr.includes(val)) {
        updated = selectedArr.filter(x => x !== val);
      } else {
        updated = [...selectedArr, val];
      }
      onChange(updated.join(", "));
    } else {
      onChange(val);
      setIsOpen(false);
    }
  };

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.trim().toLowerCase();
    return options.filter(opt => {
      if (typeof opt === 'object' && opt.isHeader) return true;
      const str = typeof opt === 'object' ? (opt.label || opt.value) : opt;
      return String(str || "").toLowerCase().includes(query);
    });
  }, [options, search]);

  const getButtonText = () => {
    if (!selected) return placeholder;
    if (isMulti) {
      const selectedArr = selected.split(",").map(x => x.trim()).filter(Boolean);
      if (selectedArr.length === 0) return placeholder;
      return selectedArr.join(", ");
    }
    return selected;
  };

  const hasExactMatch = useMemo(() => {
    if (!search.trim()) return true;
    return options.some(opt => {
      if (typeof opt === 'object' && opt.isHeader) return false;
      const str = typeof opt === 'object' ? (opt.label || opt.value) : opt;
      return String(str || "").toLowerCase() === search.trim().toLowerCase();
    });
  }, [options, search]);

  const handleCreate = () => {
    if (disabled || !search.trim() || !onCreate) return;
    onCreate(search.trim());
    setIsOpen(false);
    setSearch("");
  };

  const hasValue = useMemo(() => {
    if (!selected) return false;
    if (isMulti) {
      return selected.split(",").map(x => x.trim()).filter(Boolean).length > 0;
    }
    return true;
  }, [selected, isMulti]);

  const buttonStyle = disabled
    ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
    : hasValue
      ? "bg-indigo-50/50 border-indigo-200 text-indigo-950 font-semibold"
      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 font-normal";

  const iconColor = hasValue ? "text-indigo-600" : "text-slate-400";

  return (
    <div className="w-full">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 border rounded-xl text-xs text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex justify-between items-center transition cursor-pointer shadow-2xs ${buttonStyle}`}
      >
        <span className="truncate">{getButtonText()}</span>
        <ChevronDown size={14} className={`${iconColor} shrink-0 ml-2`} />
      </button>

      {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999
          }}
          className="bg-white border border-slate-200/90 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-dropdown"
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search size={13} className="text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search options..."
              className="w-full bg-transparent px-1 py-0.5 text-xs text-slate-800 focus:outline-none placeholder:text-slate-400"
              autoFocus={typeof window !== 'undefined' && !('ontouchstart' in window || navigator.maxTouchPoints > 0)}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 max-h-52">
            {filteredOptions.length === 0 && (!allowCreate || !search.trim()) ? (
              <div className="px-3 py-2 text-xs text-slate-400 italic text-center">No options found</div>
            ) : (
              <>
                {filteredOptions.map((opt, idx) => {
                  if (typeof opt === 'object' && opt.isHeader) {
                    return (
                      <div key={`header-${idx}`} className="px-3 py-1.5 bg-slate-100 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider sticky top-0 z-20 border-b border-slate-200/80 shadow-2xs">
                        {opt.label}
                      </div>
                    );
                  }
                  const optVal = typeof opt === 'object' ? opt.value : opt;
                  const optLabel = typeof opt === 'object' ? opt.label : opt;
                  const active = isSelected(optVal);
                  const itemStyle = active
                    ? "bg-indigo-50 text-indigo-900 font-semibold"
                    : "text-slate-700 hover:bg-slate-50 font-normal";
                  return (
                    <button
                      key={optVal}
                      type="button"
                      onClick={() => handleSelect(optVal)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${itemStyle}`}
                    >
                      <span className="truncate">{optLabel}</span>
                      {active && (
                        <Check size={13} className="text-indigo-600 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
                {allowCreate && search.trim() && !hasExactMatch && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border-t border-slate-100 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus size={13} className="shrink-0 text-indigo-600" />
                    <span>Create "{search.trim()}"</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableDropdown;

