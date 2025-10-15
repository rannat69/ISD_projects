export const nowISO = () => new Date().toISOString();

export const toHKISODate = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
};

export const getDayOfWeekHK = (date) => {
  const dayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: HK_TZ,
    weekday: "short",
  }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[dayStr];
};

export const dateFromHKISO = (isoYMD) => new Date(`${isoYMD}T00:00:00+08:00`);

export const addDaysHK = (isoYMD, delta) => {
  const base = dateFromHKISO(isoYMD);
  const moved = new Date(base.getTime() + delta * 86400000);
  return toHKISODate(moved);
};

export const getCurrentMondayHKISO = () => {
  const todayHK = toHKISODate(new Date());
  const d = dateFromHKISO(todayHK);
  const dow = getDayOfWeekHK(d);
  const delta = (dow + 6) % 7;
  const monday = new Date(d.getTime() - delta * 86400000);
  return toHKISODate(monday);
};

export const formatISOForDisplay = (isoYMD) => {
  const d = dateFromHKISO(isoYMD);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: HK_TZ,
    weekday: "short",
  }).format(d);
  return `${day}, ${isoYMD}`;
};

export const HK_TZ = "Asia/Hong_Kong";

export const getStudentById = (data, id) =>
  data.students.find((s) => s.id === id);
