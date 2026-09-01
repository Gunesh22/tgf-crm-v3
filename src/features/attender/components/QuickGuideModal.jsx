import React, { useState } from "react";
import { X, Eye, Layers, Target } from "lucide-react";

const PIPELINE_STAGES = [
  {
    num: "1",
    name: "New Lead",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
    en: "New/uncontacted lead.",
    hi: "नया लीड / अभी संपर्क नहीं हुआ।",
    mr: "नवीन लीड / अजून संपर्क झालेला नाही।"
  },
  {
    num: "2",
    name: "Attempting Contact",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    en: "Trying to contact; no proper connection yet.",
    hi: "संपर्क करने की कोशिश चल रही है।",
    mr: "संपर्क करण्याचा प्रयत्न सुरू आहे।"
  },
  {
    num: "3",
    name: "Information Given",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-300",
    en: "Connected and basic information was given.",
    hi: "बात हुई और जानकारी दी गई।",
    mr: "संपर्क झाला आणि माहिती दिली।"
  },
  {
    num: "3.2",
    name: "Previous Program Pending",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-300",
    en: "Working on current program, but a previous program associated with source has not yet been attended/completed.",
    hi: "वर्तमान प्रोग्राम पर काम चल रहा है, लेकिन स्रोत से जुड़ा पिछला प्रोग्राम अभी पूरा नहीं हुआ है।",
    mr: "सध्याच्या प्रोग्रामवर काम सुरू आहे, परंतु स्त्रोताशी संबंधित मागील प्रोग्राम अद्याप पूर्ण झालेला नाही।"
  },
  {
    num: "4",
    name: "Nurture / Interested",
    badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-300",
    en: "Person is interested but needs follow-up/time.",
    hi: "व्यक्ति इच्छुक है, लेकिन आगे फॉलो-अप चाहिए।",
    mr: "व्यक्ती इच्छुक आहे, पण पुढील फॉलो-अप आवश्यक आहे।"
  },
  {
    num: "5",
    name: "Future Pool",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
    en: "Interested for a future batch/time; do not treat as an active immediate lead.",
    hi: "आगे के बैच/समय के लिए रखा गया लीड।",
    mr: "पुढील बॅच/वेळेसाठी ठेवलेली लीड।"
  },
  {
    num: "6",
    name: "Registered / Won",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
    en: "Registration is completed/confirmed.",
    hi: "रजिस्ट्रेशन पूरा/कन्फर्म हो गया है।",
    mr: "रजिस्ट्रेशन पूर्ण/कन्फर्म झाले आहे।"
  },
  {
    num: "7",
    name: "Closed / Lost",
    badgeClass: "bg-gray-200 text-gray-800 border-gray-400",
    en: "Person is not interested.",
    hi: "व्यक्ति इच्छुक नहीं है।",
    mr: "व्यक्ती इच्छुक नाही।"
  },
  {
    num: "8",
    name: "Closed / Invalid",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
    en: "Invalid/wrong number or genuinely unusable lead.",
    hi: "गलत/अमान्य नंबर या लीड उपयोग योग्य नहीं है।",
    mr: "चुकीचा/अवैध नंबर किंवा वापरण्यायोग्य नसलेली लीड।"
  },
  {
    num: "9",
    name: "Query Desk",
    badgeClass: "bg-cyan-100 text-cyan-900 border-cyan-300",
    en: "Question/support/information request, not a sales progression.",
    hi: "सवाल/सपोर्ट/जानकारी के लिए।",
    mr: "प्रश्न/सपोर्ट/माहितीसाठी।"
  }
];

const CALL_PURPOSES = [
  {
    key: "SALES",
    name: "Sales",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    en: "Calling to explain a program and move the person toward registration.",
    hi: "प्रोग्राम समझाने और रजिस्ट्रेशन की दिशा में आगे बढ़ाने के लिए।",
    mr: "प्रोग्राम समजावून सांगून रजिस्ट्रेशनकडे पुढे नेण्यासाठी।"
  },
  {
    key: "QUERY",
    name: "Query",
    badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300",
    en: "Handling a question, support request, or information issue.",
    hi: "सवाल, सपोर्ट या जानकारी की समस्या के लिए।",
    mr: "प्रश्न, सपोर्ट किंवा माहितीच्या समस्येसाठी।"
  },
  {
    key: "REMINDER",
    name: "Reminder",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    en: "Follow-up/reminder for an existing interested or registered person.",
    hi: "पहले से इच्छुक/रजिस्टर्ड व्यक्ति को फॉलो-अप या रिमाइंडर देने के लिए।",
    mr: "आधीच इच्छुक/रजिस्टर झालेल्या व्यक्तीसाठी फॉलो-अप किंवा रिमाइंडर।"
  }
];

export const QuickGuideModal = ({ isOpen, onClose }) => {
  const [lang, setLang] = useState("en"); // "en" | "hi" | "mr"

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden z-10 flex flex-col max-h-[85vh] border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold border border-indigo-400/30">
              <Eye size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black tracking-wider uppercase">CRM Quick Guide</h3>
              <p className="text-[10px] text-slate-400 font-normal leading-none mt-0.5">Stages & Call Purpose Reference</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Compact Language Selector Tabs */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2.5 py-0.5 rounded-md font-bold transition cursor-pointer ${
                  lang === "en" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-400 hover:text-white"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("hi")}
                className={`px-2.5 py-0.5 rounded-md font-bold transition cursor-pointer ${
                  lang === "hi" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-400 hover:text-white"
                }`}
              >
                हिंदी
              </button>
              <button
                type="button"
                onClick={() => setLang("mr")}
                className={`px-2.5 py-0.5 rounded-md font-bold transition cursor-pointer ${
                  lang === "mr" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-400 hover:text-white"
                }`}
              >
                मराठी
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto space-y-4 bg-slate-50/50 flex-1">
          
          {/* PIPELINE STAGES */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Layers size={14} className="text-indigo-600" />
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Pipeline Stages</h4>
              <span className="text-[9px] font-bold text-slate-400">({PIPELINE_STAGES.length})</span>
            </div>

            <div className="space-y-1.5">
              {PIPELINE_STAGES.map(stage => (
                <div
                  key={stage.num}
                  className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between gap-3 hover:border-indigo-200 transition-colors"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-black flex items-center justify-center">
                      {stage.num}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${stage.badgeClass}`}>
                      {stage.name}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 font-medium text-right flex-1">
                    {stage[lang]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CALL PURPOSE */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target size={14} className="text-emerald-600" />
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Call Purpose</h4>
              <span className="text-[9px] font-bold text-slate-400">({CALL_PURPOSES.length})</span>
            </div>

            <div className="space-y-1.5">
              {CALL_PURPOSES.map(purpose => (
                <div
                  key={purpose.key}
                  className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between gap-3 hover:border-emerald-200 transition-colors"
                >
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border uppercase tracking-wide shrink-0 ${purpose.badgeClass}`}>
                    {purpose.name}
                  </span>

                  <div className="text-xs text-slate-600 font-medium text-right flex-1">
                    {purpose[lang]}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default QuickGuideModal;
