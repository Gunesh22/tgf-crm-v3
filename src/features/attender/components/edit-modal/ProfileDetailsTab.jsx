import React from "react";
import {
  User, Phone, Hash, MapPin, CheckCircle2, Tag, Loader
} from "lucide-react";
import { formatContactName } from "../../utils";
import CityAutofillInput from "./CityAutofillInput";

export const ProfileDetailsTab = ({
  edited,
  handleChange,
  getEditable,
  isCheckingDuplicate,
  isSearchingCRM
}) => {
  return (
    <div className="space-y-5 md:space-y-6 text-xs bg-white">
      {/* Primary Contact Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Name */}
        <div className="space-y-1.5 min-w-0">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <User size={13} className="text-slate-400" /> Name
          </label>
          <input
            value={edited.Name || ""}
            onChange={e => handleChange("Name", e.target.value)}
            onBlur={e => handleChange("Name", formatContactName(e.target.value))}
            readOnly={!getEditable("Name")}
            className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
              !getEditable("Name")
                ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-white border-slate-200 text-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500"
            }`}
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5 min-w-0">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 truncate">
            <Phone size={13} className="text-slate-400 shrink-0" /> Phone <span className="text-rose-500 font-bold ml-0.5">*</span>
            {isCheckingDuplicate && <Loader size={11} className="animate-spin text-indigo-600 ml-1 shrink-0" />}
            {isSearchingCRM && <Loader size={11} className="animate-spin text-emerald-600 ml-1 shrink-0" />}
          </label>
          <input
            value={edited.Phone || ""}
            onChange={e => handleChange("Phone", e.target.value)}
            readOnly={!getEditable("Phone")}
            className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
              !getEditable("Phone")
                ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-white border-slate-200 text-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500"
            }`}
          />
        </div>

        {/* Mobile */}
        <div className="space-y-1.5 min-w-0">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 truncate">
            <Phone size={13} className="text-slate-400 shrink-0" /> Mobile
            {isCheckingDuplicate && <Loader size={11} className="animate-spin text-indigo-600 ml-1 shrink-0" />}
            {isSearchingCRM && <Loader size={11} className="animate-spin text-emerald-600 ml-1 shrink-0" />}
          </label>
          <input
            value={edited.Mobile || ""}
            onChange={e => handleChange("Mobile", e.target.value)}
            readOnly={!getEditable("Mobile")}
            className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
              !getEditable("Mobile")
                ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-white border-slate-200 text-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500"
            }`}
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5 min-w-0">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Hash size={13} className="text-slate-400" /> Email
          </label>
          <input
            value={edited.Email || ""}
            onChange={e => handleChange("Email", e.target.value)}
            readOnly={!getEditable("Email")}
            className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
              !getEditable("Email")
                ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-white border-slate-200 text-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500"
            }`}
          />
        </div>

        {/* City */}
        <div className="space-y-1.5 min-w-0">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin size={13} className="text-slate-400" /> City <span className="text-rose-500 font-bold ml-0.5">*</span>
          </label>
          <CityAutofillInput
            cityValue={edited.City || ""}
            stateValue={edited.State || ""}
            onChangeCity={val => handleChange("City", val)}
            onChangeState={val => handleChange("State", val)}
            readOnly={!getEditable("City")}
            className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
              !getEditable("City")
                ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-white border-slate-200 text-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500"
            }`}
          />
        </div>

        {/* State */}
        <div className="space-y-1.5 min-w-0">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin size={13} className="text-slate-400" /> State
          </label>
          <input
            value={edited.State || ""}
            onChange={e => handleChange("State", e.target.value)}
            readOnly={!getEditable("State")}
            className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
              !getEditable("State")
                ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-white border-slate-200 text-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500"
            }`}
          />
        </div>

        {/* Khoji */}
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-slate-400" /> Khoji <span className="text-rose-500 font-bold ml-0.5">*</span>
          </label>
          <div className="flex items-center gap-2.5 h-[42px]">
            {(() => {
              const kVal = String(edited.Khoji || "").toLowerCase().trim();
              const isDew = kVal === "dew drop khoji";
              const isYes = kVal === "yes" || isDew;
              const isNo = kVal === "no";
              const editable = getEditable("Khoji");
              return (
                <>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => handleChange("Khoji", isYes ? "" : "Yes")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      isYes
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => handleChange("Khoji", isNo ? "" : "No")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      isNo
                        ? "bg-rose-600 border-rose-600 text-white shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    No
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer ml-2 select-none">
                    <input
                      type="checkbox"
                      checked={isDew}
                      disabled={!editable}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleChange("Khoji", "Dew drop khoji");
                        } else {
                          handleChange("Khoji", "Yes");
                        }
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer border-slate-300"
                    />
                    <span className="text-xs font-medium text-slate-700">Dew drop khoji</span>
                  </label>
                </>
              );
            })()}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5 col-span-1 md:col-span-4">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Tag size={13} className="text-slate-400" /> Tags
          </label>
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/80 border border-slate-200/80 rounded-xl min-h-[42px] items-center">
            {(() => {
              const rawTags = edited.Tags || edited.tags || "";
              let tagsArr = [];
              if (Array.isArray(rawTags)) {
                tagsArr = rawTags.map(t => typeof t === "object" ? (t?.name || t?.label || t?.tag || "") : String(t));
              } else if (typeof rawTags === "string") {
                tagsArr = rawTags.split(",");
              } else if (typeof rawTags === "object" && rawTags !== null) {
                tagsArr = [rawTags.name || rawTags.label || rawTags.tag || ""];
              }
              const cleanTags = Array.from(new Set(
                tagsArr
                  .map(t => String(t || "").trim().replace(/^#+/, ""))
                  .filter(t => t.length > 0 && t !== "[object Object]")
              ));
              if (cleanTags.length === 0) {
                return <span className="text-xs text-slate-400 px-2 font-medium">No tags mapped</span>;
              }
              return cleanTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/60 text-slate-700 border border-slate-300/50"
                >
                  {tag}
                </span>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileDetailsTab;
