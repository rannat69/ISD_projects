/*
HKUST MPhil TIE Weekly Progress Tracker (Demo, SPA)

Backendless SPA using Supabase persistence (tables).
Configuration:
- Provide Supabase URL and anon/public key in Settings (stored only in memory).
- You can predefine window.SUPABASE_URL and window.SUPABASE_KEY before the app loads.
- Without credentials, the app runs read-only with in-memory demo data.

Tables (schemas align with former CSVs):
- students
- weekly_entries
- teams
- team_memberships
- team_weekly_entries

Schemas (blockers removed):
- students: id, full_name, email, cohort, start_date, status, notes, research_area, supervisor, created_at, updated_at
- weekly_entries: id, student_id, week_start_date, goals_set_json, per_goal_status_json, overall_status, progress_notes, next_week_goals_json, created_by, created_at, updated_at
- teams: id, team_name, description, created_at, updated_at
- team_memberships: id, team_id, student_id, role_in_team, created_at
- team_weekly_entries: id, team_id, week_start_date, team_goals_set_json, team_overall_status, team_progress_notes, next_week_team_goals_json, created_by, created_at, updated_at
*/

import { renderStudents, renderStudentDetail } from "./components/students.js";
import { renderTeams } from "./components/teams.js";
import { renderCourses } from "./components/courses.js";
import { renderInstructors } from "./components/instructors.js";
import { renderRequests, renderMakeRequest } from "./components/requests.js";

import { checkPermissions } from "./checkPermissions.js";

import {
  addDaysHK,
  getCurrentMondayHKISO,
  formatISOForDisplay,
  HK_TZ,
  getStudentById,
  hasEntryThisWeek,
  getEntryByStudentAndWeek,
  getEntriesByStudent,
  getTeamsByStudentId,
  writeEnabled,
  setActiveNav,
} from "./tools.js";

(() => {
  window.onload = function () {
    checkPermissions(appState);

    // Your existing app logic here
    // Example: load content based on userEmail
    // const mainContent = document.getElementById("mainContent");
    // mainContent.innerHTML = `<h1>Welcome, ${userEmail}</h1>`;
  };

  // -------------------- Utilities --------------------
  const uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const s4 = () =>
      Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  };

  const nowISO = () => new Date().toISOString();

  const toHKISODate = (date) => {
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

  const getDayOfWeekHK = (date) => {
    const dayStr = new Intl.DateTimeFormat("en-US", {
      timeZone: HK_TZ,
      weekday: "short",
    }).format(date);
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[dayStr];
  };

  const dateFromHKISO = (isoYMD) => new Date(`${isoYMD}T00:00:00+08:00`);

  const isMondayHK = (isoYMD) => getDayOfWeekHK(dateFromHKISO(isoYMD)) === 1;

  const computeOverallStatusFromGoalStatuses = (statuses) => {
    if (!statuses || statuses.length === 0) return "not_achieved";
    const allAchieved = statuses.every((s) => s === "achieved");
    const noneAchieved = statuses.every((s) => s !== "achieved");
    if (allAchieved) return "achieved";
    if (noneAchieved) return "not_achieved";
    return "partial";
  };

  const showToast = (message, type = "info", timeout = 3000) => {
    const container = document.getElementById("toastContainer");
    const div = document.createElement("div");
    div.className = `toast ${type}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(8px)";
      setTimeout(() => div.remove(), 200);
    }, timeout);
  };

  // CSV helpers (parse/stringify) for reports only
  const csvEscape = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  };
  const csvStringify = (rows, headers) => {
    if (!rows || rows.length === 0)
      return headers ? headers.join(",") + "\n" : "";
    const cols = headers || Object.keys(rows[0]);
    const lines = [cols.join(",")];
    for (const row of rows) {
      lines.push(cols.map((h) => csvEscape(row[h] ?? "")).join(","));
    }
    return lines.join("\n");
  };
  const csvParse = (str) => {
    // Simple CSV parser supporting quotes and escaped quotes
    const rows = [];
    let i = 0,
      field = "",
      row = [],
      inQuotes = false;
    const pushField = () => {
      row.push(field);
      field = "";
    };
    const pushRow = () => {
      rows.push(row);
      row = [];
    };
    while (i < str.length) {
      const c = str[i];
      if (inQuotes) {
        if (c === '"') {
          if (str[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        } else {
          field += c;
          i++;
          continue;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (c === ",") {
          pushField();
          i++;
          continue;
        }
        if (c === "\n" || c === "\r") {
          // handle CRLF or LF
          pushField();
          pushRow();
          if (c === "\r" && str[i + 1] === "\n") i++;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
    }
    pushField();
    pushRow();
    // Convert to array of objects using header row
    if (rows.length === 0) return [];
    const header = rows[0];
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      if (rows[r].length === 1 && rows[r][0] === "") continue; // skip trailing blank
      const obj = {};
      for (let cidx = 0; cidx < header.length; cidx++)
        obj[header[cidx]] = rows[r][cidx] ?? "";
      out.push(obj);
    }
    return out;
  };

  // base64 helpers for Unicode
  const encodeBase64 = (s) => btoa(unescape(encodeURIComponent(s)));
  const decodeBase64 = (b) => decodeURIComponent(escape(atob(b)));

  // -------------------- Supabase Backend --------------------
  // retained only for CSV export column order
  const githubPaths = {
    students: "data/students.csv",
    weekly_entries: "data/weekly_entries.csv",
    teams: "data/teams.csv",
    team_memberships: "data/team_memberships.csv",
    team_weekly_entries: "data/team_weekly_entries.csv",
  };

  const appState = {
    data: null,
    page: "dashboard",
    selectedStudentId: null,
    filters: {
      search: "",
      status: "all",
      team: "all",
      hasEntryThisWeek: "all",
    },
    formEditingEntryId: null,
    supabase: {
      url: window.SUPABASE_URL || "",
      key: window.SUPABASE_KEY || "",
      client: null,
    },
  };

  const ensureSupabaseClient = () => {
    if (!appState.supabase.client && writeEnabled(appState)) {
      appState.supabase.client = window.supabase.createClient(
        appState.supabase.url,
        appState.supabase.key
      );
    }
    return appState.supabase.client;
  };

  const loadAllDataFromSupabase = async () => {
    const client = ensureSupabaseClient();
    if (!client) return { data: null, missing: true };
    const [
      studentsRes,
      coursesRes,
      instructorsRes,
      studentsCoursesRes,
      weeklyRes,
      teamsRes,
      membershipsRes,
      teamWeeklyRes,
      teamExpensesRes,
      requestsRes,
    ] = await Promise.all([
      client.from("students").select("*"),
      client.from("courses").select("*"),
      client.from("instructors").select("*"),
      client.from("students_courses").select("*"),
      client.from("weekly_entries").select("*"),
      client.from("teams").select("*"),
      client.from("team_memberships").select("*"),
      client.from("team_weekly_entries").select("*"),
      client.from("team_expenses").select("*"),
      client.from("requests").select("*"),
    ]);
    const anyError = [
      studentsRes,
      coursesRes,
      instructorsRes,
      studentsCoursesRes,
      weeklyRes,
      teamsRes,
      membershipsRes,
      teamWeeklyRes,
      teamExpensesRes,
      requestsRes,
    ].find((r) => r.error);
    if (anyError) return { data: null, missing: true };
    const result = {
      students: studentsRes.data || [],
      courses: coursesRes.data || [],
      instructors: instructorsRes.data || [],
      students_courses: studentsCoursesRes.data || [],
      weekly_entries: weeklyRes.data || [],
      teams: teamsRes.data || [],
      team_memberships: membershipsRes.data || [],
      team_weekly_entries: teamWeeklyRes.data || [],
      team_expenses: teamExpensesRes.data || [],
      requests: requestsRes.data || [],
    };
    return { data: result, missing: false };
  };

  const csvHeaders = {
    students: [
      "id",
      "full_name",
      "email",
      "cohort",
      "start_date",
      "status",
      "notes",
      "research_area",
      "supervisor",
      "created_at",
      "updated_at",
    ],
    courses: [
      "id",
      "name",
      "description",
      "start_date",
      "created_at",
      "updated_at",
    ],
    student_courses: ["course_id", "created_at"],
    weekly_entries: [
      "id",
      "student_id",
      "week_start_date",
      "goals_set_json",
      "per_goal_status_json",
      "overall_status",
      "progress_notes",
      "next_week_goals_json",
      "created_by",
      "created_at",
      "updated_at",
    ],
    teams: ["id", "team_name", "description", "created_at", "updated_at"],
    team_memberships: [
      "id",
      "team_id",
      "student_id",
      "role_in_team",
      "created_at",
    ],
    team_weekly_entries: [
      "id",
      "team_id",
      "week_start_date",
      "team_goals_set_json",
      "team_overall_status",
      "team_progress_notes",
      "next_week_team_goals_json",
      "created_by",
      "created_at",
      "updated_at",
    ],
  };

  const upsertTable = async (tableName, rows) => {
    const client = ensureSupabaseClient();
    const { error } = await client
      .from(tableName)
      .upsert(rows, { onConflict: "id" });
    if (error) throw error;
  };

  const seedAllDataToSupabase = async (data) => {
    await upsertTable("students", data.students);
    await upsertTable("courses", data.courses);
    await upsertTable("student_courses", data.student_courses);
    await upsertTable("teams", data.teams);
    await upsertTable("team_memberships", data.team_memberships);
    await upsertTable("weekly_entries", data.weekly_entries);
    await upsertTable("team_weekly_entries", data.team_weekly_entries);
  };

  // -------------------- Templates and Seeding (no blockers) --------------------
  const templates = {
    /*
    goalTemplates: [
      "Complete literature review for 20 papers on transformer architectures",
      "Implement baseline CNN model for image classification",
      "Draft methodology section (2000 words)",
      "Attend 2 research seminars and take detailed notes",
      "Set up development environment for React Native app",
      "Interview 5 startup founders for user research",
      "Complete statistical analysis of survey data (n=150)",
      "Prepare presentation for progress review meeting",
      "Debug API integration issues in prototype",
      "Write introduction chapter (3000 words)",
    ],
    progressNoteTemplates: [
      "Identified 3 key research gaps and updated literature matrix.",
      "Baseline model reached 85% accuracy on validation set.",
      "Drafted 1800 words of methodology section; need advisor feedback.",
      "Gathered seminar insights on latest GAN techniques.",
      "Environment set up with Docker; resolved dependency conflicts.",
      "Completed interviews; transcripts ready for coding.",
      "Performed chi-square tests; results show significant correlations.",
      "Slides prepared for supervisor meeting; rehearsal pending.",
      "API bug fixed by refactoring auth middleware.",
      "Introduction chapter outline finalized, 1000 words written.",
    ],
    studentNames: [
      "Alice Chen",
      "Bob Zhang",
      "Carol Liu",
      "David Wong",
      "Emma Lee",
      "Frank Kumar",
      "Grace Wang",
      "Henry Tan",
      "Isabel Ng",
      "Jack Martinez",
      "Kelly Ho",
      "Leo Garcia",
      "Mona Patel",
      "Nathan Yu",
      "Olivia Chan",
      "Peter Lam",
      "Queenie Lau",
      "Ryan Choi",
      "Sophia Torres",
      "Thomas Yeung",
    ],
    researchAreas: [
      "AI/Machine Learning",
      "IoT Systems",
      "Fintech",
      "EdTech",
      "Sustainable Technology",
      "Healthcare Innovation",
      "Blockchain",
      "Robotics",
      "Data Analytics",
      "Cybersecurity",
    ],
    supervisors: [
      "Prof. Li",
      "Prof. Chan",
      "Prof. Zhang",
      "Prof. Wong",
      "Prof. Lee",
      "Prof. Smith",
      "Prof. Patel",
      "Prof. Garcia",
      "Prof. Yu",
      "Prof. Lam",
    ],
    teams: [
      {
        name: "AI/ML",
        description:
          "Research on artificial intelligence and machine learning.",
      },
      {
        name: "IoT",
        description: "Internet of Things systems and embedded innovations.",
      },
      {
        name: "EdTech",
        description: "Technology for education and learning analytics.",
      },
    ],*/
  };

  // Read data from canvas
  // How, though ?

  const pickN = (arr, n) => {
    const copy = arr.slice();
    const result = [];
    while (result.length < n && copy.length) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  };

  const randomStatus = () => {
    const r = Math.random();
    if (r < 0.55) return "achieved";
    if (r < 0.85) return "partial";
    return "not_achieved";
  };

  const seedInitialDataWithoutBlockers = () => {
    const currentMonday = getCurrentMondayHKISO();
    const weeks = [0, -7, -14, -21, -28, -35].map((off) =>
      addDaysHK(currentMonday, off)
    );

    const students = [];
    const weekly_entries = [];

    for (let i = 0; i < 20; i++) {
      const full_name =
        templates.studentNames[i % templates.studentNames.length];
      const research_area =
        templates.researchAreas[i % templates.researchAreas.length];
      const supervisor =
        templates.supervisors[i % templates.supervisors.length];
      const id = uuid();

      const start_date = addDaysHK(
        currentMonday,
        -(70 + Math.floor(Math.random() * 120))
      );
      const created_at = nowISO();

      const student = {
        id,
        full_name,
        email: `${full_name.toLowerCase().replace(/[^a-z]/g, ".")}@ust.hk`,
        cohort: "MPhil TIE 2025",
        start_date,
        status: "active",
        notes: "",
        research_area,
        supervisor,
        created_at,
        updated_at: created_at,
      };
      students.push(student);

      for (const w of weeks) {
        const numGoals = 3 + Math.floor(Math.random() * 3);
        const goals = pickN(templates.goalTemplates, numGoals);
        const goalStatuses = goals.map(() => randomStatus());
        const overall = computeOverallStatusFromGoalStatuses(goalStatuses);
        const progress = pickN(
          templates.progressNoteTemplates,
          1 + Math.floor(Math.random() * 2)
        ).join(" ");
        const nextNumGoals = 3 + Math.floor(Math.random() * 2);
        const nextGoals = pickN(templates.goalTemplates, nextNumGoals);

        weekly_entries.push({
          id: uuid(),
          student_id: id,
          week_start_date: w,
          goals_set_json: JSON.stringify(goals),
          per_goal_status_json: JSON.stringify(goalStatuses),
          overall_status: overall,
          progress_notes: progress,
          next_week_goals_json: JSON.stringify(nextGoals),
          created_by: "seed",
          created_at,
          updated_at: created_at,
        });
      }
    }

    const teams = templates.teams.map((t) => ({
      id: uuid(),
      team_name: t.name,
      description: t.description,
      created_at: nowISO(),
      updated_at: nowISO(),
    }));
    const team_memberships = [];
    for (let i = 0; i < students.length; i++) {
      const teamIdx = i % teams.length;
      team_memberships.push({
        id: uuid(),
        team_id: teams[teamIdx].id,
        student_id: students[i].id,
        role_in_team: "member",
        created_at: nowISO(),
      });
    }

    const team_weekly_entries = [];
    const teamMondays = [0, -7, -14].map((off) =>
      addDaysHK(currentMonday, off)
    );
    for (const team of teams) {
      for (const w of teamMondays) {
        const goals = pickN(
          templates.goalTemplates,
          3 + Math.floor(Math.random() * 2)
        );
        const statuses = goals.map(() => randomStatus());
        const overall = computeOverallStatusFromGoalStatuses(statuses);
        const notes = pickN(templates.progressNoteTemplates, 2).join(" ");
        const nextGoals = pickN(templates.goalTemplates, 3);
        team_weekly_entries.push({
          id: uuid(),
          team_id: team.id,
          week_start_date: w,
          team_goals_set_json: JSON.stringify(goals),
          team_overall_status: overall,
          team_progress_notes: notes,
          next_week_team_goals_json: JSON.stringify(nextGoals),
          created_by: "seed",
          created_at: nowISO(),
          updated_at: nowISO(),
        });
      }
    }

    return {
      students,
      weekly_entries,
      teams,
      team_memberships,
      team_weekly_entries,
    };
  };

  // -------------------- Accessors & checks --------------------

  // -------------------- Rendering --------------------
  const setActiveNav = (page) => {
    document.querySelectorAll(".nav .nav-link").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page);
      if (btn.dataset.page === page) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  };

  const render = () => {
    const container = document.getElementById("mainContent");
    container.innerHTML = "";
    setActiveNav(appState.page);
    if (appState.page === "dashboard") return renderDashboard(container);
    if (appState.page === "students")
      return renderStudents(appState, container);
    if (appState.page === "instructors")
      return renderInstructors(appState, container);
    if (appState.page === "courses") return renderCourses(appState, container);
    if (appState.page === "teams") return renderTeams(appState, container);
    if (appState.page === "reports") return renderReports(container);
    if (appState.page === "settings") return renderSettings(container);

    if (appState.page === "makeRequest")
      return renderMakeRequest(appState, container);
    if (appState.page === "checkRequest")
      return renderRequests(appState, container);

    if (appState.page === "student_detail")
      return renderStudentDetail(
        appState,
        container,
        appState.selectedStudentId
      );
  };

  const renderDashboard = (root) => {
    const data = appState.data;
    const currentMonday = getCurrentMondayHKISO();
    const activeStudents = data.students.filter((s) => s.status === "active");
    const activeCount = activeStudents.length;
    const studentsWithEntryThisWeek = activeStudents.filter((s) =>
      hasEntryThisWeek(data, s.id, currentMonday)
    ).length;
    const pctWithEntry = activeCount
      ? Math.round((studentsWithEntryThisWeek / activeCount) * 100)
      : 0;

    const entriesThisWeek = data.weekly_entries.filter(
      (e) => e.week_start_date === currentMonday
    );
    const achievedCount = entriesThisWeek.filter(
      (e) => e.overall_status === "achieved"
    ).length;
    const completionRate = entriesThisWeek.length
      ? Math.round((achievedCount / entriesThisWeek.length) * 100)
      : 0;

    const header = document.createElement("div");
    header.className = "page-header";
    header.innerHTML = `<div class="page-title">Dashboard</div><div class="meta">Week of ${currentMonday} (HK)</div>`;

    const kpis = document.createElement("div");
    kpis.className = "kpis";
    kpis.innerHTML = `
      <div class="kpi">
        <div class="kpi-label">Active students</div>
        <div class="kpi-value">${activeCount}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">% with entry this week</div>
        <div class="kpi-value">${pctWithEntry}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Completion rate this week</div>
        <div class="kpi-value">${completionRate}%</div>
      </div>
    `;

    const recentCard = document.createElement("div");
    recentCard.className = "card";
    recentCard.innerHTML = `<div class="card-header"><div><strong>Recent activity</strong></div><div class="meta">Current week statuses</div></div>`;

    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Research Area</th>
          <th>Current Week</th>
          <th>Goals Achieved</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    const rows = data.students
      .slice(0)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    for (const s of rows) {
      const current = getEntryByStudentAndWeek(data, s.id, currentMonday);
      const chip = current
        ? `<span class="chip ${
            current.overall_status
          }">${current.overall_status.replace("_", " ")}</span>`
        : '<span class="meta">No entry</span>';
      let goalsAchieved = "-";
      if (current) {
        const statuses = JSON.parse(current.per_goal_status_json);
        const total = statuses.length;
        const achieved = statuses.filter((x) => x === "achieved").length;
        goalsAchieved = `${achieved}/${total}`;
      }
      const lastUpdated = (() => {
        const entries = getEntriesByStudent(data, s.id);
        if (!entries.length) return "";
        const maxUpdated = entries.reduce(
          (acc, e) => (acc > e.updated_at ? acc : e.updated_at),
          entries[0].updated_at
        );
        return new Date(maxUpdated).toLocaleString();
      })();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.full_name}</td>
        <td>${s.research_area}</td>
        <td>${chip}</td>
        <td>${goalsAchieved}</td>
        <td>${lastUpdated}</td>
      `;
      tr.addEventListener("click", () => {
        appState.page = "student_detail";
        appState.selectedStudentId = s.id;
        setActiveNav("students");
        renderStudentDetail(appState, root, s.id);
      });
      tbody.appendChild(tr);
    }

    recentCard.appendChild(table);

    root.appendChild(header);
    root.appendChild(kpis);
    root.appendChild(recentCard);
  };

  const renderReports = (root) => {
    const data = appState.data;

    const header = document.createElement("div");
    header.className = "page-header";
    header.innerHTML = `<div class="page-title">Reports</div><div class="meta">Download CSV exports</div>`;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="grid-responsive">
        <div>
          <div><strong>Students</strong></div>
          <button class="button" id="dlStudents">Download students.csv</button>
        </div>
        <div>
          <div><strong>Weekly entries</strong></div>
          <button class="button" id="dlWeekly">Download weekly_entries.csv</button>
        </div>
        <div>
          <div><strong>Teams</strong></div>
          <button class="button" id="dlTeams">Download teams.csv</button>
        </div>
        <div>
          <div><strong>Team memberships</strong></div>
          <button class="button" id="dlMemberships">Download team_memberships.csv</button>
        </div>
        <div>
          <div><strong>Team weekly entries</strong></div>
          <button class="button" id="dlTeamWeekly">Download team_weekly_entries.csv</button>
        </div>
      </div>
    `;

    const toDownload = (filename, rows, order) => {
      // Include BOM for downloads
      const content = "\uFEFF" + csvStringify(rows, order);
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

    card
      .querySelector("#dlStudents")
      .addEventListener("click", () =>
        toDownload("students.csv", data.students, csvHeaders.students)
      );
    card
      .querySelector("#dlWeekly")
      .addEventListener("click", () =>
        toDownload(
          "weekly_entries.csv",
          data.weekly_entries,
          csvHeaders.weekly_entries
        )
      );
    card
      .querySelector("#dlTeams")
      .addEventListener("click", () =>
        toDownload("teams.csv", data.teams, csvHeaders.teams)
      );
    card
      .querySelector("#dlMemberships")
      .addEventListener("click", () =>
        toDownload(
          "team_memberships.csv",
          data.team_memberships,
          csvHeaders.team_memberships
        )
      );
    card
      .querySelector("#dlTeamWeekly")
      .addEventListener("click", () =>
        toDownload(
          "team_weekly_entries.csv",
          data.team_weekly_entries,
          csvHeaders.team_weekly_entries
        )
      );

    root.appendChild(header);
    root.appendChild(card);
  };

  const renderSettings = (root) => {
    const header = document.createElement("div");
    header.className = "page-header";
    header.innerHTML = `<div class="page-title">Settings</div>`;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="grid-responsive">
        <div class="field">
          <label>Supabase URL</label>
          <input id="sbUrl" class="input" placeholder="https://xyzcompany.supabase.co" value="${
            appState.supabase.url
          }" />
        </div>
        <div class="field">
          <label>Supabase anon/public key</label>
          <input id="sbKey" class="input" type="password" placeholder="ey..." value="${
            appState.supabase.key
          }" />
        </div>
        <div class="help">Stored only in memory during this session.</div>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap: wrap;">
        <button class="button" id="saveCfg">Save Config</button>
        <button class="button primary" id="initData">Initialize Data</button>
      </div>
      <div class="meta" style="margin-top:6px;">Write is ${
        writeEnabled(appState) ? "enabled" : "disabled (read-only)"
      }.</div>
    `;

    const initBtn = card.querySelector("#initData");
    if (!writeEnabled(appState)) {
      initBtn.disabled = true;
      initBtn.title = "Provide Supabase URL and key to initialize.";
    }

    card.querySelector("#saveCfg").addEventListener("click", async () => {
      appState.supabase.url = card.querySelector("#sbUrl").value.trim();
      appState.supabase.key = card.querySelector("#sbKey").value.trim();
      appState.supabase.client = null;
      ensureSupabaseClient();
      showToast("Supabase configuration updated.", "success");
      // Try to reload data
      await reloadDataFlow();
    });

    card.querySelector("#initData").addEventListener("click", async () => {
      if (!writeEnabled(appState)) {
        showToast("Write disabled. Provide Supabase URL/key.", "error");
        return;
      }
      try {
        showToast("Initializing data…", "info");
        const seed = seedInitialDataWithoutBlockers();
        await seedAllDataToSupabase(seed);
        appState.data = seed;
        render();
        showToast("Initialization complete.", "success");
      } catch (e) {
        console.error(e);
        showToast("Initialization failed. Check console.", "error");
      }
    });

    root.appendChild(header);
    root.appendChild(card);
  };

  // -------------------- Init --------------------
  const reloadDataFlow = async () => {
    try {
      showToast("Loading data…", "info");
      const { data, missing } = await loadAllDataFromSupabase();
      if (!missing && data) {
        appState.data = data;
        showToast("Data loaded from Supabase.", "success");
      } else {
        if (writeEnabled(appState)) {
          const seed = seedInitialDataWithoutBlockers();
          await seedAllDataToSupabase(seed);
          appState.data = seed;
          showToast("Seeded initial data to Supabase.", "success");
        } else {
          appState.data = seedInitialDataWithoutBlockers();
          showToast(
            "Supabase not configured. Running with in-memory demo data (read-only).",
            "info"
          );
        }
      }
    } catch (e) {
      console.error(e);
      appState.data = seedInitialDataWithoutBlockers();
      showToast(
        "Failed to load from Supabase. Using in-memory demo (read-only).",
        "error"
      );
    }
    if (!appState.page) appState.page = "dashboard";
    render();
  };

  const init = async () => {
    const loadSessionsFromSupabase = async () => {
      const client = ensureSupabaseClient();

      if (!client) return { data: null, missing: true };
      const usersRes = await Promise.all([client.from("sessions").select("*")]);

      const anyError = [usersRes].find((r) => r.error);
      if (anyError) return { data: null, missing: true };
      const result = {
        users: usersRes[0].data || [],
      };

      return { data: result, missing: false };
    };

    const userEmail = localStorage.getItem("userEmail");
    const role = localStorage.getItem("role");
    // Redirect to login if not authenticated
    if (!userEmail || !role) {
      window.location.href = "login.html";
    }

    const sessionNumber = localStorage.getItem("sessionNumber");

    // read table sessions with sessionNumber, email and role.
    // if not match, redirect to login.html

    const { data, missing } = await loadSessionsFromSupabase();

    console.log("data sessions", data);

    // Look for record in data with same session_id, user_email and role
    const session = data.users.filter(
      (session) =>
        session.session_id == sessionNumber &&
        session.user_email == userEmail &&
        session.role == role
    );

    if (session.length === 0) {
      // delete sessionNumber from local storage
      localStorage.removeItem("sessionNumber");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("role");
      window.location.href = "login.html";
    }

    // Nav events
    document.querySelector(".nav").addEventListener("click", async (e) => {
      const btn = e.target.closest(".nav-link");
      if (!btn) return;
      const page = btn.dataset.page;
      if (
        [
          "dashboard",
          "students",
          "instructors",
          "courses",
          "teams",
          "reports",
          "settings",
          "checkRequest",
          "makeRequest",
        ].includes(page)
      ) {
        appState.page = page;
        appState.selectedStudentId = null;
        render();
        document.getElementById("mainContent").focus();
      }

      // if logout, display popup "Are you sure ?", if yes, clean local storage.
      if (btn.id === "logoutButton") {
        let userChoice = confirm("Are you sure you want to log out?");

        if (userChoice) {
          // Code to execute if the user clicks "OK" (Yes)
          localStorage.removeItem("userEmail");
          localStorage.removeItem("role");
          localStorage.removeItem("sessionNumber");

          const deleteSessionFromSupabase = async () => {
            const client = ensureSupabaseClient();

            if (!client) return { data: null, missing: true };
            const response = await client
              .from("sessions")
              .delete()
              .eq("session_id", sessionNumber);

            return response;
          };

          // Remove the session from the database
          const response = await deleteSessionFromSupabase();

          window.location.reload();
        }
      }
    });

    await reloadDataFlow();
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
