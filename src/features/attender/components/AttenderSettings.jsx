import React, { useState } from "react";
import { ArrowLeft, MessageSquare, Palette, ChevronRight, User } from "lucide-react";
import TemplatesSettings from "./settings/TemplatesSettings";
import AppearanceSettings from "./settings/AppearanceSettings";

/**
 * Extensible Settings Sections Registry
 * Add future settings sections here cleanly without changing page layout:
 * e.g. CallingSettings, NotificationSettings, AppearanceSettings
 */
const SETTINGS_SECTIONS = [
  {
    id: "templates",
    label: "Templates",
    description: "Personal message templates",
    icon: MessageSquare,
    component: TemplatesSettings
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Table display & row highlight style",
    icon: Palette,
    component: AppearanceSettings
  }
];

export default function AttenderSettings({ attenderId, attenderName, onBack }) {
  const [activeSectionId, setActiveSectionId] = useState("templates");

  const activeSection =
    SETTINGS_SECTIONS.find((s) => s.id === activeSectionId) || SETTINGS_SECTIONS[0];
  const ActiveComponent = activeSection.component;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
              title="Return to Call Sheet"
            >
              <ArrowLeft size={14} />
              <span>Back to Call Sheet</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">Settings</h1>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Personal workspace & preferences
              </p>
            </div>
          </div>

          {attenderName && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600">
              <User size={13} className="text-slate-400" />
              <span>{attenderName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Settings Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col">
        {/* Mobile Navigation Bar (< md) */}
        <div className="md:hidden mb-4">
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SETTINGS_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = sec.id === activeSectionId;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-white" : "text-slate-500"} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Desktop 2-Column Layout (md+) */}
        <div className="flex flex-col md:flex-row gap-6 flex-1 items-start">
          {/* Settings Navigation Sidebar */}
          <aside className="hidden md:block w-64 shrink-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
            <div className="px-3 py-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                General Settings
              </span>
            </div>
            <nav className="space-y-1">
              {SETTINGS_SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const isActive = sec.id === activeSectionId;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-left ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{sec.label}</p>
                        {sec.description && (
                          <p
                            className={`text-[10px] truncate ${
                              isActive ? "text-emerald-700/80" : "text-slate-400"
                            }`}
                          >
                            {sec.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <ChevronRight size={14} className="text-emerald-600 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Settings Content Panel */}
          <section className="flex-1 min-w-0 w-full bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-2xs">
            <ActiveComponent
              attenderId={attenderId}
              attenderName={attenderName}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
