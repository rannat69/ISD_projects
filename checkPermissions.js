import {
  addDaysHK,
  getCurrentMondayHKISO,
  formatISOForDisplay,
  HK_TZ,
  getStudentById,
  ensureSupabaseClient,
} from "./tools.js";

export const checkPermissions = (appState) => {
  const userEmail = localStorage.getItem("userEmail");
  const role = localStorage.getItem("role");
  // Redirect to login if not authenticated
  if (!userEmail || !role) {
    window.location.href = "login.html";
  }

  const sessionNumber = localStorage.getItem("sessionNumber");

  const checkSessionDb = async () => {
    const client = ensureSupabaseClient(appState);
    const { data, error } = await client
      .from("sessions")
      .select("*")
      .eq("session_id", sessionNumber);

    const sessionData = data || [];

    if (sessionData.length === 0) {
      localStorage.removeItem("userEmail");
      localStorage.removeItem("role");
      localStorage.removeItem("sessionNumber");
      window.location.href = "login.html";
    }
  };

  checkSessionDb();
  // read table sessions with sessionNumber, email and role.
  // if not match, redirect to login.html

  if (role !== "ADMIN") {
    settingsButton.style.display = "none";
  }

  if (role !== "ADMIN" && role !== "INSTRUCTOR") {
    coursesButton.style.display = "none";
    checkRequestButton.style.display = "none";
  }
};
