import React from "react";
import { AlertCircle } from "lucide-react";

export const DuplicateBanner = ({
  globalDup,
  dupWarningMessage,
  isShared = false
}) => {
  if (!globalDup || !globalDup.showWarning || isShared) return null;

  return (
    <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs my-2 shadow-2xs">
      <AlertCircle size={14} className="text-amber-600 shrink-0" />
      <span className="font-bold text-amber-950">
        {dupWarningMessage || "Existing contact match found"}
      </span>
    </div>
  );
};

export default DuplicateBanner;
