import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Send, Search, X, Copy, Check, Image as ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { getLocalTemplates, copyImageToClipboard } from "../../../lib/localTemplates";

/**
 * Formats a phone number for WhatsApp wa.me links
 * (e.g. 9876543210 -> 919876543210)
 */
export const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  return cleaned.length === 10 ? `91${cleaned}` : cleaned;
};

/**
 * Replaces name tags like {Name}, [Contact Name], or {cleanName} with actual attender name
 */
export const processTemplateText = (rawText, name) => {
  if (!rawText) return "";
  let cleanName = String(name || "").trim();
  const lowerName = cleanName.toLowerCase();
  if (lowerName === "unknown" || lowerName === "unknown lead" || lowerName === "unknown name") {
    cleanName = "";
  }
  const namePlaceholder = /\{Name\}|\[Contact Name\]|\[Name\]|\$?\{cleanName\}/gi;

  if (cleanName) {
    return rawText.replace(namePlaceholder, cleanName);
  }

  return rawText
    .replace(/(\{Name\}|\[Contact Name\]|\[Name\])\s*ji!?/gi, "")
    .replace(namePlaceholder, "")
    .replace(/\s+/g, " ")
    .trim();
};

const WhatsAppIcon = ({ className = "w-3.5 h-3.5 fill-current" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
);

export const WhatsAppButton = ({ phone, name = "", variant = "default", attenderId = "" }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedTextId, setCopiedTextId] = useState(null);
  const [copiedImageId, setCopiedImageId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTemplates = async () => {
      try {
        const data = await getLocalTemplates(attenderId);
        if (isMounted) setTemplates(data);
      } catch (err) {
        console.error("Failed to load local templates", err);
      }
    };

    fetchTemplates();

    const handleUpdate = () => {
      fetchTemplates();
    };

    window.addEventListener("local-wa-templates-updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("local-wa-templates-updated", handleUpdate);
    };
  }, [attenderId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearchQuery("");
        setCopiedTextId(null);
        setCopiedImageId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((tpl) => {
      const titleMatch = tpl?.title?.toLowerCase().includes(q);
      const textMatch = tpl?.text?.toLowerCase().includes(q);
      return titleMatch || textMatch;
    });
  }, [templates, searchQuery]);

  if (!phone) return null;

  const digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.length < 10) return null;

  const waPhone = formatPhoneForWhatsApp(phone);

  const handleOpenDirectWA = () => {
    setOpen(false);
    setSearchQuery("");
    setCopiedTextId(null);
    setCopiedImageId(null);
    const url = `https://wa.me/${waPhone}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyTemplate = async (rawText, title = "Template", id = null) => {
    const textToCopy = processTemplateText(rawText, name);
    if (!textToCopy) return;

    try {
      let copied = false;
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          copied = true;
        } catch {
          // Fall back to execCommand below
        }
      }
      if (!copied) {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      if (id !== null) {
        setCopiedTextId(id);
        setTimeout(() => setCopiedTextId(null), 2000);
      }
      toast.success(`Copied "${title}" to clipboard!`, { id: "wa-template-copied" });
    } catch (err) {
      console.error("Failed to copy template", err);
      toast.error("Failed to copy template to clipboard");
    }
  };

  const handleCopyImage = async (e, imageData, id) => {
    e.stopPropagation();
    if (!imageData) return;

    try {
      await copyImageToClipboard(imageData);
      setCopiedImageId(id);
      setTimeout(() => setCopiedImageId(null), 2000);
      toast.success("Image copied! Press Ctrl+V in WhatsApp.", { id: "wa-img-copied" });
    } catch (err) {
      console.error("Failed to copy image", err);
      toast.error("Failed to copy image: " + err.message);
    }
  };

  const toggleDropdown = () => {
    if (open) {
      setSearchQuery("");
      setCopiedTextId(null);
      setCopiedImageId(null);
    }
    setOpen((prev) => !prev);
  };

  const isHeader = variant === "header";

  return (
    <div className="relative inline-flex items-center shrink-0" ref={dropdownRef}>
      {/* Trigger Buttons */}
      {isHeader ? (
        <div className="inline-flex items-center bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold transition-all duration-150 border border-white/15 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={handleOpenDirectWA}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-emerald-500/30 active:scale-[0.97] transition-all duration-150 text-white cursor-pointer"
            title={`WhatsApp ${waPhone} (Direct Chat)`}
          >
            <WhatsAppIcon className="w-3.5 h-3.5 fill-emerald-300" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={toggleDropdown}
            className="px-2 py-1.5 hover:bg-white/20 text-white/80 hover:text-white active:scale-[0.97] transition-all duration-150 border-l border-white/15 cursor-pointer"
            title="Message Templates"
          >
            <ChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleOpenDirectWA}
            className="inline-flex items-center justify-center px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.97] text-white rounded-l-lg text-xs font-semibold transition-all duration-150 border border-emerald-600 shadow-2xs cursor-pointer"
            title={`WhatsApp ${waPhone} (Direct Chat)`}
          >
            <WhatsAppIcon className="w-3.5 h-3.5 fill-white mr-1" />
            WA
          </button>
          <button
            type="button"
            onClick={toggleDropdown}
            className="px-1.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.97] text-white rounded-r-lg border-l border-emerald-500 text-xs font-semibold transition-all duration-150 cursor-pointer"
            title="Choose message template"
          >
            <ChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        </>
      )}

      {/* Unified Templates Dropdown */}
      {open && (
        <div
          className={`absolute top-full ${
            isHeader ? "left-0 w-84" : "right-0 w-80"
          } mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 z-50 animate-fade-in text-slate-800`}
        >
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between">
            <span>WhatsApp Templates</span>
            {isHeader && (
              <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.2 rounded font-semibold font-mono">
                {waPhone}
              </span>
            )}
          </div>

          {/* Template Search Bar */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              autoFocus
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
            {/* Direct Chat (Open WhatsApp) */}
            {!searchQuery && (
              <button
                type="button"
                onClick={handleOpenDirectWA}
                className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 active:scale-[0.98] text-emerald-800 transition flex items-center justify-between group cursor-pointer mb-1"
              >
                <div className="flex items-center gap-2">
                  <WhatsAppIcon className="w-3.5 h-3.5 fill-emerald-600" />
                  <span>Direct Chat (Open WhatsApp)</span>
                </div>
                <Send size={11} className="text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {filteredTemplates.length > 0 ? (
              filteredTemplates.map((tpl, i) => {
                const tplId = tpl.id || i;
                const isCopiedText = copiedTextId === tplId;
                const isCopiedImg = copiedImageId === tplId;
                const previewText = processTemplateText(tpl.text, name);

                return (
                  <div
                    key={tplId}
                    className={`w-full flex items-stretch gap-1.5 p-1 rounded-xl transition border ${
                      isCopiedText
                        ? "bg-emerald-50/70 border-emerald-200"
                        : "hover:bg-slate-50 border-slate-100/80 hover:border-slate-200"
                    }`}
                  >
                    {/* Text Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyTemplate(tpl.text, tpl.title, tplId)}
                      className="flex-1 text-left px-2 py-1.5 rounded-lg cursor-pointer group/item min-w-0"
                      title="Click to copy message text"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate">{tpl.title}</span>
                        </div>
                        <span
                          className={`text-[10px] flex items-center gap-1 font-medium shrink-0 ml-1 transition-opacity ${
                            isCopiedText
                              ? "opacity-100 text-emerald-600 font-bold"
                              : "opacity-0 group-hover/item:opacity-100 text-slate-400 group-hover/item:text-emerald-600"
                          }`}
                        >
                          {isCopiedText ? (
                            <>
                              <Check size={11} className="text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {previewText}
                      </div>
                    </button>

                    {/* Image Thumbnail Box */}
                    {tpl.image && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyImage(e, tpl.image, tplId)}
                        className={`relative w-12 h-12 self-center shrink-0 rounded-lg border overflow-hidden cursor-pointer transition shadow-2xs group/img ${
                          isCopiedImg
                            ? "border-emerald-500 ring-2 ring-emerald-500"
                            : "border-slate-200 hover:border-emerald-400"
                        }`}
                        title="Click to copy original-quality image to clipboard"
                      >
                        <img
                          src={tpl.image}
                          alt="Template"
                          className="w-full h-full object-cover"
                        />
                        <div
                          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity ${
                            isCopiedImg
                              ? "opacity-100 bg-emerald-600/90 text-white"
                              : "opacity-0 group-hover/img:opacity-100 bg-slate-900/70 text-white"
                          }`}
                        >
                          {isCopiedImg ? (
                            <>
                              <Check size={13} className="stroke-[3]" />
                              <span className="text-[7.5px] font-black uppercase">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span className="text-[7.5px] font-bold uppercase mt-0.5">Image</span>
                            </>
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-6 px-3 text-center text-xs text-slate-400">
                {searchQuery ? (
                  <>No templates match &quot;{searchQuery}&quot;</>
                ) : (
                  <div className="space-y-1.5">
                    <p className="font-bold text-slate-600">No templates created yet</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Click the <span className="font-semibold text-slate-600">Settings</span> button in the top header to create your own WhatsApp templates with uncompressed images.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppButton;
