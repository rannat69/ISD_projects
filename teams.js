import {
  addDaysHK,
  getCurrentMondayHKISO,
  formatISOForDisplay,
  HK_TZ,
  getStudentById,
} from "./tools.js";

export const renderTeams = (appState, root) => {
  const data = appState.data;

  const header = document.createElement("div");
  header.className = "page-header";
  header.innerHTML = `<div class="page-title">Teams</div>`;

  const grid = document.createElement("div");
  grid.className = "grid-responsive";

  const last3Mondays = [0, -7, -14].map((off) =>
    addDaysHK(getCurrentMondayHKISO(), off)
  );

  for (const t of data.teams) {
    const card = document.createElement("div");
    card.className = "team-card";
    const members = data.team_memberships
      .filter((m) => m.team_id === t.id)
      .map((m) => getStudentById(data, m.student_id).full_name);
    const entries = data.team_weekly_entries
      .filter((e) => e.team_id === t.id)
      .sort((a, b) => (a.week_start_date < b.week_start_date ? 1 : -1));

    const expenses = data.team_expenses.filter((e) => e.team_id === t.id);

    console.log("expenses", expenses);

    card.innerHTML = `
        <div class="team-header">
          <div>
            <div><strong>${t.team_name}</strong></div>
            <div class="meta">${t.description}</div>
                 <div class="meta">Budget: ${t.budget}</div>
          </div>
          <div class="badge">Members: ${members.length}</div>
        </div>
        <div class="team-members">${members.join(", ")}</div>
          <div class="separator"></div>
           <div><strong>Expenses</strong></div>
            ${
              /*Display expenses*/

              expenses.length > 0
                ? expenses
                    .map((e) => {
                      const date = new Date(e.created_at).toLocaleDateString(
                        "en-US",
                        { timeZone: HK_TZ }
                      );
                      return `
    <div class="entry-card">

      <div class="entry-body">
                      <div><strong>Title</strong><div class="meta">${
                        e.title || "-"
                      }</div></div>

                                            <div><strong>Date</strong><div class="meta">${
                                              date || "-"
                                            }</div></div>
        <div><strong>Amount</strong><div class="meta">${e.value}</div></div>

        <div><strong>Description</strong><div class="meta">${
          e.description || "-"
        }</div></div>
      </div>
    </div>
  `;
                    })
                    .join("")
                : `<div class="entry-card"><strong>No expenses</strong></div>`
            }

        <div class="separator"></div>
        <div>
          <div class="meta" style="margin-bottom:6px;">Last 3 Mondays</div>
          ${last3Mondays
            .map((w) => {
              const e = entries.find((x) => x.week_start_date === w);
              if (!e)
                return `<div class="entry-card"><strong>${formatISOForDisplay(
                  w
                )}</strong><div class="meta">No entry</div></div>`;
              const goals = JSON.parse(e.team_goals_set_json);
              const ng = JSON.parse(e.next_week_team_goals_json);
              return `
              <div class="entry-card">
                <div class="entry-header"><strong>${formatISOForDisplay(
                  e.week_start_date
                )}</strong> • <span class="chip ${
                e.team_overall_status
              }">${e.team_overall_status.replace("_", " ")}</span></div>
                <div class="entry-body">
                  <div><strong>Team goals</strong><div class="meta">${goals
                    .map((g) => `• ${g}`)
                    .join("<br/>")}</div></div>
                  <div><strong>Progress notes</strong><div class="meta">${
                    e.team_progress_notes || "-"
                  }</div></div>
                  <div><strong>Next week goals</strong><div class="meta">${ng
                    .map((g) => `• ${g}`)
                    .join("<br/>")}</div></div>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      `;
    grid.appendChild(card);
  }

  root.appendChild(header);
  root.appendChild(grid);
};
