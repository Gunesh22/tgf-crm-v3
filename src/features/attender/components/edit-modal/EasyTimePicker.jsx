/**
 * Follow-up Time Utility Helpers
 */

/**
 * Parses time string into { hour: "10", minute: "30", period: "AM" }
 */
export const parseTimeTo3Boxes = (timeVal) => {
  if (!timeVal) return { hour: "", minute: "", period: "AM" };
  const str = String(timeVal).trim();
  if (!str) return { hour: "", minute: "", period: "AM" };

  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (h > 12) h = h % 12 || 12;
    return {
      hour: String(h),
      minute: String(m).padStart(2, "0"),
      period
    };
  }

  const parts = str.split(":");
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return {
        hour: String(h),
        minute: String(m).padStart(2, "0"),
        period
      };
    }
  }

  return { hour: "", minute: "", period: "AM" };
};

export const normalizeTypedTime = (rawStr) => {
  if (!rawStr) return "";
  const parsed = parseTimeTo3Boxes(rawStr);
  if (!parsed.hour && !parsed.minute) return "";
  let hNum = parseInt(parsed.hour, 10);
  if (isNaN(hNum)) hNum = 10;
  if (hNum > 12) hNum = hNum % 12 || 12;
  if (hNum === 0) hNum = 12;

  let mNum = parseInt(parsed.minute, 10);
  if (isNaN(mNum) || mNum < 0) mNum = 0;
  if (mNum > 59) mNum = 59;

  return `${String(hNum).padStart(2, "0")}:${String(mNum).padStart(2, "0")} ${parsed.period}`;
};

export const formatFollowupTime12h = normalizeTypedTime;
export const timeTo24h = (str) => str;
export const timeTo12h = normalizeTypedTime;
