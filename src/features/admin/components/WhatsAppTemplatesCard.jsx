import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Plus, Edit2, Trash2, Save, X, User, HelpCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { processTemplateText } from "../../attender/components/WhatsAppButton";

const renderTextWithVariableBadges = (text = "") => {
  if (!text) return null;
  const parts = text.split(/(\{Name\}|\[Contact Name\]|\[Name\]|\{cleanName\})/gi);
  return parts.map((part, idx) => {
    if (/^(\{Name\}|\[Contact Name\]|\[Name\]|\{cleanName\})$/i.test(part)) {
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold font-mono text-[11px] border border-emerald-300/80 mx-0.5 shadow-2xs"
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

export function WhatsAppTemplatesCard({ templates = [], onSaveTemplates }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({ title: "", text: "" });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const openAddModal = () => {
    setEditingTemplate(null);
    setFormData({ title: "", text: "Happy Thoughts {Name} ji! " });
    setIsModalOpen(true);
  };

  const openEditModal = (tpl) => {
    setEditingTemplate(tpl);
    setFormData({
      title: tpl.title || "",
      text: tpl.text || ""
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Template title is required!");
      return;
    }
    if (!formData.text.trim()) {
      toast.error("Template message text is required!");
      return;
    }

    let updatedList;
    if (editingTemplate) {
      updatedList = templates.map((t) =>
        t.id === editingTemplate.id
          ? { ...t, title: formData.title.trim(), text: formData.text.trim() }
          : t
      );
    } else {
      const newId = "tpl_" + Date.now();
      updatedList = [
        ...templates,
        { id: newId, title: formData.title.trim(), text: formData.text.trim() }
      ];
    }

    try {
      await onSaveTemplates(updatedList);
      toast.success(editingTemplate ? "Template updated!" : "New template added!");
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save template: " + err.message);
    }
  };

  const handleDelete = async (idToDelete) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;

    const updatedList = templates.filter((t) => t.id !== idToDelete);
    try {
      await onSaveTemplates(updatedList);
      toast.success("Template deleted!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template: " + err.message);
    }
  };

  const insertNameTag = () => {
    setFormData((prev) => ({
      ...prev,
      text: prev.text ? (prev.text.endsWith(" ") ? prev.text + "{Name} " : prev.text + " {Name} ") : "{Name} "
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <MessageSquare size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-[#172033] text-sm">WhatsApp Message Templates</h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Customize quick message templates used by attenders when sending WhatsApp messages.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition shadow-2xs cursor-pointer shrink-0"
        >
          <Plus size={14} />
          <span>Add Template</span>
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <div className="col-span-full py-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-6 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <MessageSquare size={18} />
            </div>
            <p className="text-xs font-semibold text-slate-700">No custom templates created yet</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Click &quot;Add Template&quot; above to create quick message templates for attenders.
            </p>
          </div>
        ) : (
          templates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-slate-50/50 rounded-lg border border-slate-200 p-4 space-y-3 flex flex-col justify-between hover:border-slate-300 hover:bg-slate-50 transition group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-800 text-xs">{tpl.title}</h4>
                </div>
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                  <button
                    onClick={() => openEditModal(tpl)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                    title="Edit Template"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                    title="Delete Template"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-md border border-slate-200 line-clamp-4">
                {renderTextWithVariableBadges(tpl.text)}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1">
                <User size={11} className="text-emerald-600" />
                <span>Variable Tag: <strong className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono border border-emerald-200 text-[10px]">{'{Name}'}</strong></span>
              </span>
            </div>
          </div>
        ))
      )}
    </div>

      {/* Edit / Add Modal */}
      {isModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div
            className="bg-white rounded-xl w-full max-w-lg shadow-xl border border-slate-200 overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    {editingTemplate ? "Edit WhatsApp Template" : "Add WhatsApp Template"}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Configure message text and dynamic placeholders for quick replies.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              {/* Template Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Template Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Follow-up Intro"
                  className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs placeholder:text-slate-400"
                />
              </div>

              {/* Message Text Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Message Text <span className="text-red-500">*</span>
                  </label>
                  
                  {/* Insert Name Button */}
                  <button
                    type="button"
                    onClick={insertNameTag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200 transition active:scale-95 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Insert Contact Name</span>
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  placeholder="Happy Thoughts {Name} ji! ..."
                  className="w-full px-3 py-2.5 text-xs text-slate-900 leading-relaxed bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs placeholder:text-slate-400"
                />

                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                  <HelpCircle size={13} className="text-emerald-600 shrink-0" />
                  <span>Use <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono font-bold border border-emerald-200 text-[10px]">{'{Name}'}</code> tag to automatically insert contact's name.</span>
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-emerald-600" />
                  <span>Live Message Preview (for "Namdev Kale")</span>
                </div>
                <div className="text-xs text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-md border border-slate-200 shadow-2xs">
                  {processTemplateText(formData.text, "Namdev Kale") || <span className="italic text-slate-400">Type message above...</span>}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-md border border-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-2xs transition active:scale-95 cursor-pointer"
              >
                <Save size={13} />
                <span>Save Template</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
