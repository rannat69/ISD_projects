import {
  addDaysHK,
  getCurrentMondayHKISO,
  getStudentById,
  setActiveNav, getCourseById, getTeamsByStudentId, getEntryByStudentAndWeek, getEntriesByCourse
} from "../tools.js";

export const renderCourses = (appState, root) => {
  const data = appState.data;
  const currentMonday = getCurrentMondayHKISO();

  const header = document.createElement("div");
  header.className = "page-header";
  header.innerHTML = `<div class="page-title">Courses</div>`;

  const controls = document.createElement("div");
  controls.className = "filters";
  controls.innerHTML = `
      <input type="text" class="input" id="searchName" placeholder="Search by name" value="${appState.filters.search}" />

    `;

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Description</th>
          <th>Start Date</th>

          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

  const applyFiltersCourse = () => {
    const name = document
      .getElementById("searchName")
      .value.trim()
      .toLowerCase();

    appState.filters = {
      search: name,
    };

    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";

    let list = data.courses.slice();
    if (name) list = list.filter((s) => s.name.toLowerCase().includes(name));

    list.sort((a, b) => a.name.localeCompare(b.name));

    for (const s of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${s.name}</td>
          <td>${s.description}</td>
          <td>${s.start_date}</td>
        `;
      tr.addEventListener("click", () => {
        appState.page = "course_detail";
        appState.selectedStudentId = s.id;
        setActiveNav("courses");
        renderCourseDetail(appState, root, s.id);
      });
      tbody.appendChild(tr);
    }
  };

  controls.addEventListener("input", (e) => {
    if (["searchName"].includes(e.target.id)) applyFiltersCourse();
  });
  controls.addEventListener("change", applyFiltersCourse);

  root.appendChild(header);
  root.appendChild(controls);
  root.appendChild(table);

  applyFiltersCourse();
};

const renderCourseDetail = (appState, root, courseId) => {
  const data = appState.data;
  const course = getCourseById(data, courseId);
  if (!course) return;

  root.innerHTML = "";

  const header = document.createElement("div");
  header.className = "page-header";

  const teams = getTeamsByStudentId(data, courseId);
  const teamsText = teams
    .map((t) => `<span class="badge">${t.team_name}</span>`)
    .join(" ");

  const fourMondays = [0, -7, -14, -21].map((off) =>
    addDaysHK(getCurrentMondayHKISO(), off)
  );
  const chips = fourMondays
    .map((w) => {
      const e = getEntryByStudentAndWeek(data, courseId, w);
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
        <div class="page-title">${course.name}</div>
       <div class="page-title">${course.description}</div>
      </div>
    `;
  root.appendChild(header);
  const title = document.createElement("div");
  title.className = "card";
  title.innerHTML = `<div class="card-header"><strong>Students in this course</strong></div>`;

  const layout = document.createElement("div");
  layout.className = "grid-2";

  const entries = getEntriesByCourse(data, courseId);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No students for this course.";
    root.appendChild(empty); // Ajoutez le message à root
  } else {
    // Créez la table une seule fois
    const table = document.createElement("table");
    table.className = "table";

    // Créez l'en-tête de la table
    table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
            <th>Cohort</th>
        <th>Start Date</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

    const tbody = table.querySelector("tbody");

    // Remplissez le tbody avec les lignes pour chaque étudiant
    for (const e of entries) {
      const student = getStudentById(data, e.student_id); // Récupérer l'étudiant

      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${student.full_name}</td>
      <td>${student.email}</td>
            <td>${student.cohort}</td>
      <td>${student.start_date}</td>
    `;

      tbody.appendChild(tr); // Ajoutez la ligne au tbody
    }

    root.appendChild(layout);
    root.appendChild(table);
  }
};
