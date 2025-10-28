import {
  addDaysHK,
  getCurrentMondayHKISO,
  formatISOForDisplay,
  HK_TZ,
  getStudentById,
  getEntryByStudentAndWeek,
  getEntriesByStudent,
  getTeamsByStudentId,
  writeEnabled, setActiveNav
} from "../tools.js";

export const renderStudents = (appState, root) => {
  const data = appState.data;
  const currentMonday = getCurrentMondayHKISO();

  const header = document.createElement("div");
  header.className = "page-header";
  header.innerHTML = `<div class="page-title">Students</div>`;

  const controls = document.createElement("div");
  controls.className = "filters";
  controls.innerHTML = `
      <input type="text" class="input" id="searchName" placeholder="Search by name" value="${
        appState.filters.search
      }" />
      <select id="filterStatus">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select id="filterTeam">
        <option value="all">All teams</option>
        ${data.teams
          .map((t) => `<option value="${t.id}">${t.team_name}</option>`)
          .join("")}
      </select>
      <select id="filterThisWeek">
        <option value="all">All</option>
        <option value="yes">Has entry this week</option>
        <option value="no">No entry this week</option>
      </select>
    `;

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Research Area</th>
          <th>Current Week Status</th>
          <th>Goals Achieved (#)</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

  const applyFilters = () => {
    const name = document
      .getElementById("searchName")
      .value.trim()
      .toLowerCase();
    const status = document.getElementById("filterStatus").value;
    const team = document.getElementById("filterTeam").value;
    const thisWeek = document.getElementById("filterThisWeek").value;

    appState.filters = {
      search: name,
      status,
      team,
      hasEntryThisWeek: thisWeek,
    };

    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";

    let list = data.students.slice();
    if (name)
      list = list.filter((s) => s.full_name.toLowerCase().includes(name));
    if (status !== "all") list = list.filter((s) => s.status === status);
    if (team !== "all") {
      const memberIds = data.team_memberships
        .filter((m) => m.team_id === team)
        .map((m) => m.student_id);
      list = list.filter((s) => memberIds.includes(s.id));
    }
    if (thisWeek !== "all") {
      list = list.filter(
        (s) =>
          hasEntryThisWeek(data, s.id, currentMonday) === (thisWeek === "yes")
      );
    }
    list.sort((a, b) => a.full_name.localeCompare(b.full_name));

    for (const s of list) {
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
  };

  controls.addEventListener("input", (e) => {
    if (["searchName"].includes(e.target.id)) applyFilters();
  });
  controls.addEventListener("change", applyFilters);

  root.appendChild(header);
  root.appendChild(controls);
  root.appendChild(table);

  applyFilters();
};



export const renderStudentDetail = (appState, root, studentId) => {
  const data = appState.data;
  console.log("data", data);
  const student = getStudentById(data, studentId);
  if (!student) return;

  root.innerHTML = "";

  const header = document.createElement("div");
  header.className = "page-header";

  const teams = getTeamsByStudentId(data, studentId);
  const teamsText = teams
    .map((t) => `<span class="badge">${t.team_name}</span>`)
    .join(" ");

  const fourMondays = [0, -7, -14, -21].map((off) =>
    addDaysHK(getCurrentMondayHKISO(), off)
  );
  const chips = fourMondays
    .map((w) => {
      const e = getEntryByStudentAndWeek(data, studentId, w);
      return e
        ? `<span class="chip ${e.overall_status}">${e.overall_status.replace(
            "_",
            " "
          )}</span>`
        : '<span class="badge">No entry</span>';
    })
    .join(" ");

  header.innerHTML = `
      <div>
        <div class="page-title">${student.full_name}</div>
        <div class="meta">${student.research_area} • Supervisor: ${student.supervisor} • Status: ${student.status}</div>
        <div style="margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap: wrap;">${teamsText}</div>
      </div>
      <div>
        <div class="meta" style="margin-bottom:6px;">Last 4 weeks</div>
        <div style="display:flex; gap:6px; flex-wrap: wrap;">${chips}</div>
      </div>
    `;

  const layout = document.createElement("div");
  layout.className = "grid-2";

  // Timeline
  const timeline = document.createElement("div");
  const title = document.createElement("div");
  title.className = "card";
  title.innerHTML = `<div class="card-header"><strong>Weekly entries</strong></div>`;

  const entries = getEntriesByStudent(data, studentId);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent =
      "No entries for this week yet. Use 'Duplicate last week’s goals' to get started.";
    title.appendChild(empty);
  } else {
    for (const e of entries) {
      const card = document.createElement("div");
      card.className = "entry-card";
      const goals = JSON.parse(e.goals_set_json);
      const statuses = JSON.parse(e.per_goal_status_json);
      const nextGoals = JSON.parse(e.next_week_goals_json);
      const ga = statuses.filter((s) => s === "achieved").length;
      card.innerHTML = `
          <div class="entry-header">
            <div><strong>${formatISOForDisplay(
              e.week_start_date
            )}</strong> • <span class="chip ${
        e.overall_status
      }">${e.overall_status.replace("_", " ")}</span></div>
            <div>
              <button class="button" data-edit="${e.id}">Edit</button>
            </div>
          </div>
          <div class="entry-body">
            <div><strong>Goals (${ga}/${
        goals.length
      } achieved)</strong><div style="margin-top:6px; display:grid; gap:6px;">${goals
        .map(
          (g, i) =>
            `<div><span class="status-dot ${
              statuses[i]
            }"></span> ${g} (${statuses[i].replace("_", " ")})</div>`
        )
        .join("")}</div></div>
            <div><strong>Progress notes</strong><div class="meta">${
              e.progress_notes || "-"
            }</div></div>
            <div><strong>Next week goals</strong><div class="meta">${nextGoals
              .map((g) => `• ${g}`)
              .join("<br/>")}</div></div>
          </div>
        `;
      title.appendChild(card);
    }
  }

  // Form
  const formCard = document.createElement("div");
  formCard.className = "card";
  formCard.innerHTML = `<div class="card-header"><strong>Quick add / edit weekly entry</strong></div>`;

  const form = document.createElement("form");
  form.className = "entry-form";

  const defaultMonday = getCurrentMondayHKISO();

  form.innerHTML = `
      <div class="grid-3">
        <div class="field">
          <label for="weekDate">Week (Monday)</label>
          <input id="weekDate" name="weekDate" type="date" class="input" value="${defaultMonday}" required />
          <div class="help">HK timezone enforced</div>
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button type="button" class="button ghost" id="duplicateGoals">Duplicate last week’s goals</button>
        </div>
      </div>

      <div class="field">
        <label>Goals</label>
        <div id="goalsList" class="grid-responsive"></div>
        <button type="button" class="button" id="addGoal">+ Add Goal</button>
      </div>

      <div class="field">
        <label>Progress notes</label>
        <textarea id="progressNotes" rows="3"></textarea>
      </div>

      <div class="field">
        <label>Next week goals</label>
        <div id="nextGoalsList" class="grid-responsive"></div>
        <button type="button" class="button" id="addNextGoal">+ Add Next Week Goal</button>
      </div>

      <div>
        <button type="submit" class="button primary" id="saveEntry">Save Entry</button>
        <button type="button" class="button" id="cancelEdit" style="display:none;">Cancel Edit</button>
        <span class="meta" id="formModeLabel">Creating new entry</span>
      </div>
    `;

  const goalsList = form.querySelector("#goalsList");
  const nextGoalsList = form.querySelector("#nextGoalsList");
  const weekDateInput = form.querySelector("#weekDate");
  const progressNotesInput = form.querySelector("#progressNotes");
  const formModeLabel = form.querySelector("#formModeLabel");
  const cancelEditBtn = form.querySelector("#cancelEdit");
  const saveBtn = form.querySelector("#saveEntry");

  if (!writeEnabled(appState)) {
    saveBtn.disabled = true;
    saveBtn.title =
      "Provide Supabase URL and key in Settings to enable saving.";
  }

  const makeGoalRow = (goalText = "") => {
    const div = document.createElement("div");
    div.className = "goal-row";
    div.innerHTML = `
        <input type="text" class="input goal-text" placeholder="Goal description" value="${goalText.replace(
          /\"/g,
          "&quot;"
        )}" />
        <select class="goal-status">
          <option value="achieved">achieved</option>
          <option value="partial" selected>partial</option>
          <option value="not_achieved">not_achieved</option>
        </select>
        <button type="button" class="remove" aria-label="Remove goal">✕</button>
      `;
    div.querySelector(".remove").addEventListener("click", () => div.remove());
    return div;
  };

  const makeNextGoalRow = (goalText = "") => {
    const div = document.createElement("div");
    div.className = "next-goal-row";
    div.innerHTML = `
        <input type="text" class="input next-goal-text" placeholder="Next week goal" value="${goalText.replace(
          /\"/g,
          "&quot;"
        )}" />
        <button type="button" class="remove" aria-label="Remove goal">✕</button>
      `;
    div.querySelector(".remove").addEventListener("click", () => div.remove());
    return div;
  };

  const addGoal = (text = "") => goalsList.appendChild(makeGoalRow(text));
  const addNextGoal = (text = "") =>
    nextGoalsList.appendChild(makeNextGoalRow(text));

  if (!goalsList.children.length) addGoal("");
  if (!nextGoalsList.children.length) addNextGoal("");

  form.querySelector("#addGoal").addEventListener("click", () => addGoal(""));
  form
    .querySelector("#addNextGoal")
    .addEventListener("click", () => addNextGoal(""));

  form.querySelector("#duplicateGoals").addEventListener("click", () => {
    const dateISO = weekDateInput.value;
    const current = getEntriesByStudent(data, studentId);
    const sorted = current
      .slice()
      .sort((a, b) => (a.week_start_date < b.week_start_date ? 1 : -1));
    const targetDate = dateISO;
    const prev = sorted.find((e) => e.week_start_date < targetDate);
    if (prev) {
      const nextGoals = JSON.parse(prev.next_week_goals_json);
      goalsList.innerHTML = "";
      nextGoals.forEach((g) => addGoal(g));
      showToast(
        "Copied last week's next week goals into goals. Statuses reset.",
        "success"
      );
    } else {
      showToast("No previous week found to duplicate from.", "info");
    }
  });

  weekDateInput.addEventListener("change", () => {
    const iso = weekDateInput.value;
    if (!isMondayHK(iso)) {
      showToast("Selected date must be a Monday (HK time).", "error");
      weekDateInput.value = getCurrentMondayHKISO();
    }
    if (appState.formEditingEntryId) {
      const editing = data.weekly_entries.find(
        (e) => e.id === appState.formEditingEntryId
      );
      if (editing)
        formModeLabel.textContent = `Editing entry for ${formatISOForDisplay(
          weekDateInput.value
        )}`;
    }
  });

  const loadEntryIntoForm = (entry) => {
    appState.formEditingEntryId = entry.id;
    cancelEditBtn.style.display = "inline-flex";
    weekDateInput.value = entry.week_start_date;
    progressNotesInput.value = entry.progress_notes || "";
    goalsList.innerHTML = "";
    nextGoalsList.innerHTML = "";
    const goals = JSON.parse(entry.goals_set_json);
    const statuses = JSON.parse(entry.per_goal_status_json);
    goals.forEach((g, i) => {
      const row = makeGoalRow(g);
      row.querySelector(".goal-status").value = statuses[i] || "partial";
      goalsList.appendChild(row);
    });
    const nx = JSON.parse(entry.next_week_goals_json);
    nx.forEach((g) => nextGoalsList.appendChild(makeNextGoalRow(g)));
    formModeLabel.textContent = `Editing entry for ${formatISOForDisplay(
      entry.week_start_date
    )}`;
  };

  cancelEditBtn.addEventListener("click", () => {
    appState.formEditingEntryId = null;
    cancelEditBtn.style.display = "none";
    formModeLabel.textContent = "Creating new entry";
    weekDateInput.value = defaultMonday;
    progressNotesInput.value = "";
    goalsList.innerHTML = "";
    nextGoalsList.innerHTML = "";
    addGoal("");
    addNextGoal("");
  });

  title.addEventListener("click", (e) => {
    const id = e.target && e.target.getAttribute("data-edit");
    if (!id) return;
    const entry = data.weekly_entries.find((x) => x.id === id);
    if (entry) loadEntryIntoForm(entry);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!writeEnabled(appState)) {
      showToast(
        "Write disabled. Configure Supabase URL/key in Settings.",
        "error"
      );
      return;
    }
    const weekISO = weekDateInput.value;
    if (!isMondayHK(weekISO)) {
      showToast("Selected date must be a Monday (HK time).", "error");
      return;
    }
    const goals = Array.from(goalsList.querySelectorAll(".goal-text"))
      .map((i) => i.value.trim())
      .filter(Boolean);
    const statuses = Array.from(goalsList.querySelectorAll(".goal-status")).map(
      (s) => s.value
    );
    const nextGoals = Array.from(
      nextGoalsList.querySelectorAll(".next-goal-text")
    )
      .map((i) => i.value.trim())
      .filter(Boolean);
    if (goals.length === 0) {
      showToast("At least one goal is required.", "error");
      return;
    }
    if (nextGoals.length === 0) {
      showToast("At least one goal is required.", "error");
      return;
    }

    const overall = computeOverallStatusFromGoalStatuses(statuses);

    try {
      if (!appState.formEditingEntryId) {
        if (!ensureUniqueWeeklyEntry(data, studentId, weekISO)) {
          showToast("Duplicate entry for this student and week.", "error");
          return;
        }
        const entry = {
          id: uuid(),
          student_id: studentId,
          week_start_date: weekISO,
          goals_set_json: JSON.stringify(goals),
          per_goal_status_json: JSON.stringify(statuses),
          overall_status: overall,
          progress_notes: progressNotesInput.value.trim(),
          next_week_goals_json: JSON.stringify(nextGoals),
          created_by: "demo_user",
          created_at: nowISO(),
          updated_at: nowISO(),
        };
        data.weekly_entries.push(entry);
        showToast("Saving…", "info");
        try {
          const client = ensureSupabaseClient();
          await client.from("weekly_entries").insert(entry);
          showToast("Weekly entry saved.", "success");
        } catch (err) {
          console.error(err);
          showToast("Save error. Check console and Settings.", "error");
        }
        renderStudentDetail(root, studentId);
      } else {
        const existing = data.weekly_entries.find(
          (e) => e.id === appState.formEditingEntryId
        );
        if (!existing) {
          showToast("Editing target not found.", "error");
          return;
        }
        if (!ensureUniqueWeeklyEntry(data, studentId, weekISO, existing.id)) {
          showToast("Duplicate entry for this student and week.", "error");
          return;
        }
        existing.week_start_date = weekISO;
        existing.goals_set_json = JSON.stringify(goals);
        existing.per_goal_status_json = JSON.stringify(statuses);
        existing.overall_status = overall;
        existing.progress_notes = progressNotesInput.value.trim();
        existing.next_week_goals_json = JSON.stringify(nextGoals);
        existing.updated_at = nowISO();
        showToast("Saving…", "info");
        try {
          const client = ensureSupabaseClient();
          await client
            .from("weekly_entries")
            .update({
              student_id: existing.student_id,
              week_start_date: existing.week_start_date,
              goals_set_json: existing.goals_set_json,
              per_goal_status_json: existing.per_goal_status_json,
              overall_status: existing.overall_status,
              progress_notes: existing.progress_notes,
              next_week_goals_json: existing.next_week_goals_json,
              created_by: existing.created_by,
              created_at: existing.created_at,
              updated_at: existing.updated_at,
            })
            .eq("id", existing.id);
          showToast("Weekly entry saved.", "success");
        } catch (err) {
          console.error(err);
          showToast("Save error. Check console and Settings.", "error");
        }
        renderStudentDetail(root, studentId);
      }
    } catch (err) {
      console.error(err);
      showToast("Save error. Check console and Settings.", "error");
    }
  });

  timeline.appendChild(title);
  formCard.appendChild(form);

  layout.appendChild(formCard);
  layout.appendChild(timeline);

  root.appendChild(header);
  root.appendChild(layout);
};
