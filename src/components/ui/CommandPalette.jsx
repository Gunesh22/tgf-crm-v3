import React, { useState, useEffect, useRef } from "react";
import { Search, Phone, PhoneIncoming, User, X, Sparkles, Command } from "lucide-react";

export const CommandPalette = ({
  isOpen,
  onClose,
  contacts = [],
  onSelectContact,
  onOpenCallEntry,
  onRebuildCache,
  onGetNumbers
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const quickActions = [
    { id: "add_call", label: "Add Call Entry", icon: PhoneIncoming, shortcut: "Alt + A", action: () => onOpenCallEntry?.() }
  ];

  const filteredContacts = query.trim()
    ? contacts.filter(c => {
        const q = query.toLowerCase();
        const name = (c.Name || c.name || c.caller || "").toLowerCase();
        const phone = (c.Phone || c.phone || c.Mobile || "").toLowerCase();
        const email = (c.Email || c.email || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q);
      }).slice(0, 8)
    : [];

  const totalItems = query.trim() ? filteredContacts.length : quickActions.length;

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      const isCmdK = (e.ctrlKey || e.metaKey) && (e.key?.toLowerCase() === "k" || e.code === "KeyK");
      if (isCmdK) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (totalItems > 0 ? (prev + 1) % totalItems : 0));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (!query.trim() && quickActions[selectedIndex]) {
          onClose();
          quickActions[selectedIndex].action();
        } else if (query.trim() && filteredContacts[selectedIndex]) {
          onClose();
          onSelectContact?.(filteredContacts[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, totalItems, selectedIndex, query, filteredContacts, quickActions, onSelectContact]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col overflow-hidden animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Command Search Bar */}
        <div className="p-3 border-b border-slate-200 flex items-center gap-2.5 bg-slate-50">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search contacts, phone numbers, or type a command... (Esc to close)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full text-xs font-medium bg-transparent text-slate-800 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100">
          {/* Quick Commands Group */}
          {!query && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</div>
              {quickActions.map((actionItem, index) => {
                const ActionIcon = actionItem.icon;
                const isSelected = selectedIndex === index;
                return (
                  <button
                    key={actionItem.id}
                    onClick={() => { onClose(); actionItem.action(); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isSelected ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ActionIcon size={14} className={isSelected ? "text-indigo-600" : "text-slate-500"} />
                      {actionItem.label}
                    </span>
                    <span className={`text-[10px] font-mono ${isSelected ? "text-indigo-600 font-bold" : "text-slate-400"}`}>{actionItem.shortcut}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Contact Search Results */}
          {query && filteredContacts.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Matching Contacts</div>
              {filteredContacts.map((c, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <div
                    key={c.id || c.Phone || c.name || index}
                    onClick={() => { onClose(); onSelectContact?.(c); }}
                    className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                      isSelected ? "bg-indigo-50 border border-indigo-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center ${isSelected ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"}`}>
                        {(c.Name || c.name || "C").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={`text-xs font-semibold ${isSelected ? "text-indigo-950 font-bold" : "text-slate-900"}`}>{c.Name || c.name || "Unknown"}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.Phone || c.phone || c.Mobile || "No phone"}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${isSelected ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"}`}>Select →</span>
                  </div>
                );
              })}
            </div>
          )}

          {query && filteredContacts.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400">
              No contacts or commands matching "{query}"
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span className="flex items-center gap-1"><Command size={11} /> TGF CRM Command Palette</span>
          <span>Use <kbd className="font-mono bg-white border px-1 rounded">↑↓</kbd> to navigate</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
