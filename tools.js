export const ensureSupabaseClient = (appState) => {
  if (!appState.supabase.client && writeEnabled()) {
    appState.supabase.client = window.supabase.createClient(
      appState.supabase.url,
      appState.supabase.key
    );
  }
  return appState.supabase.client;
};

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

export const getTeamsByStudentId = (data, studentId) => {
  const teamIds = data.team_memberships
    .filter((m) => m.student_id === studentId)
    .map((m) => m.team_id);
  return data.teams.filter((t) => teamIds.includes(t.id));
};
export const getEntriesByStudent = (data, studentId) =>
  data.weekly_entries
    .filter((e) => e.student_id === studentId)
    .sort((a, b) => (a.week_start_date < b.week_start_date ? 1 : -1));
export const getEntryByStudentAndWeek = (data, studentId, weekStart) =>
  data.weekly_entries.find(
    (e) => e.student_id === studentId && e.week_start_date === weekStart
  );
export const hasEntryThisWeek = (data, studentId, currentMonday) =>
  !!getEntryByStudentAndWeek(data, studentId, currentMonday);

export const ensureUniqueWeeklyEntry = (
  data,
  studentId,
  weekStart,
  ignoreEntryId = null
) =>
  !data.weekly_entries.some(
    (e) =>
      e.student_id === studentId &&
      e.week_start_date === weekStart &&
      e.id !== ignoreEntryId
  );
export const ensureUniqueTeamWeeklyEntry = (
  data,
  teamId,
  weekStart,
  ignoreId = null
) =>
  !data.team_weekly_entries.some(
    (e) =>
      e.team_id === teamId &&
      e.week_start_date === weekStart &&
      e.id !== ignoreId
  );

export const getCourseById = (data, id) =>
  data.courses.find((s) => s.id === id);

export const getEntriesByCourse = (data, courseId) =>
  data.students_courses.filter((e) => e.course_id === courseId);

export const writeEnabled = (appState) =>
  !!(appState.supabase.url && appState.supabase.key);

export const setActiveNav = (page) => {
  document.querySelectorAll(".nav .nav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
    if (btn.dataset.page === page) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
};
