import React, { useEffect, useRef } from "react";
import { ShieldCheck, PhoneCall, MessageSquare, ListChecks, SlidersHorizontal, Database, Layers } from "lucide-react";

export function SettingsSubnav({ activeSection, onSelectSection }) {
  const activeTabRef = useRef(null);
  const containerRef = useRef(null);

  const navItems = [
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "call-center", label: "Call Center", icon: PhoneCall },
    { id: "whatsapp-templates", label: "WhatsApp", icon: MessageSquare },
    { id: "status-rules", label: "Status Rules", icon: ListChecks },
    { id: "status-stage-mapping", label: "Stage Mapping", icon: Layers },
    { id: "call-classification", label: "Classification", icon: SlidersHorizontal },
    { id: "data-management", label: "Data Management", icon: Database },
  ];

  useEffect(() => {
    if (activeTabRef.current && containerRef.current) {
      const container = containerRef.current;
      const tab = activeTabRef.current;
      const tabLeft = tab.offsetLeft;
      const tabWidth = tab.offsetWidth;
      const containerWidth = container.offsetWidth;
      
      container.scrollTo({
        left: tabLeft - containerWidth / 2 + tabWidth / 2,
        behavior: "smooth"
      });
    }
  }, [activeSection]);

  return (
    <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E4E7EC] -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 mb-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition-all duration-150">
      <div 
        ref={containerRef}
        className="max-w-[1240px] mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar h-12 py-1"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              ref={isActive ? activeTabRef : null}
              onClick={() => onSelectSection(item.id)}
              className={`relative h-full flex items-center gap-2 px-3.5 rounded-lg text-[13px] whitespace-nowrap transition-all duration-150 ease-out cursor-pointer ${
                isActive
                  ? "bg-[#EFF6FF] text-[#2563EB] font-semibold"
                  : "text-[#667085] hover:text-[#172033] hover:bg-slate-100/70 font-medium"
              }`}
            >
              <Icon size={15} className={isActive ? "text-[#2563EB]" : "text-[#98A2B3]"} />
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-[#2563EB] rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
