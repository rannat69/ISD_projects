import {
  addDaysHK,
  getCurrentMondayHKISO,
  getStudentById,
  setActiveNav,
  getCourseById,
  getTeamsByStudentId,
  getEntryByStudentAndWeek,
  getEntriesByCourse,
} from "../tools.js";

export const renderInstructors = (appState, root) => {
  const data = appState.data;
  const currentMonday = getCurrentMondayHKISO();

  console.log("data", data);

  const header = document.createElement("div");
  header.className = "page-header";
  header.innerHTML = `<div class="page-title">Instructors</div>`;

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
          <th>Cohort</th>  
        </tr>
      </thead>
      <tbody></tbody>
    `;

  const applyFiltersInstructor = () => {
    const name = document
      .getElementById("searchName")
      .value.trim()
      .toLowerCase();

    appState.filters = {
      search: name,
    };

    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";

    let list = data.instructors.slice();
    if (name) list = list.filter((s) => s.full_name.toLowerCase().includes(name));

    list.sort((a, b) => a.name.localeCompare(b.name));

    for (const s of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${s.full_name}</td>
          <td>${s.cohort}</td>
        `;
      tr.addEventListener("click", () => {
        appState.page = "instructor_detail";
        appState.selectedStudentId = s.id;
        setActiveNav("instructors");
        renderInstructorDetail(appState, root, s.id);
      });
      tbody.appendChild(tr);
    }
  };

  controls.addEventListener("input", (e) => {
    if (["searchName"].includes(e.target.id)) applyFiltersInstructor();
  });
  controls.addEventListener("change", applyFiltersInstructor);

  root.appendChild(header);
  root.appendChild(controls);
  root.appendChild(table);

  applyFiltersInstructor();
};

const renderInstructorDetail = (appState, root, instructorId) => {
  const data = appState.data;
  const course = getCourseById(data, instructorId);
  if (!course) return;

  root.innerHTML = "";

  const header = document.createElement("div");
  header.className = "page-header";

  const teams = getTeamsByStudentId(data, instructorId);
  const teamsText = teams
    .map((t) => `<span class="badge">${t.team_name}</span>`)
    .join(" ");

  const fourMondays = [0, -7, -14, -21].map((off) =>
    addDaysHK(getCurrentMondayHKISO(), off)
  );
  const chips = fourMondays
    .map((w) => {
      const e = getEntryByStudentAndWeek(data, instructorId, w);
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

  const entries = getEntriesByCourse(data, instructorId);
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
