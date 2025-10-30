import {
  addDaysHK,
  getCurrentMondayHKISO,
  formatISOForDisplay,
  HK_TZ,
  getStudentById,
  ensureSupabaseClient,
  setActiveNav,
} from "../tools.js";

export const renderMakeRequest = (appState, root) => {
  const data = appState.data;

  const header = document.createElement("div");
  header.className = "page-header";
  header.innerHTML = `<div class="page-title">Make a request</div>`;

  const grid = document.createElement("div");
  grid.className = "grid-responsive";

  let options = "";
  data.teams.forEach((team) => {
    options += `<option value="${team.id}">${team.team_name}</option>`;
  });

  let date = new Date();
  let formattedDate = date.toISOString().split("T")[0]; // Format YYYY-MM-DD

  grid.innerHTML = `
      <div class="grid-responsive card">
      <div class="flex">

        <div class="field">
          <label>Request title</label>
          <input
            id="rqTitle"
            class="input"
            placeholder="Title of your request"
        
          />
        </div>

        <div class="field">
          <label>Request description</label>
          <input
            id="rqDesc"
            class="input"
            placeholder="Describe your request"
        
          />
        </div>
        <div class="field">
          <label>Cost (in HKD)</label>
          <input
            id="cost"
            class="input"
            type="number"
            min="0"
            inputmode="numeric" 
            placeholder="How much would it cost ?"
            value=""
          />
        </div>
</div>      
<div class="flex">
        <div class="field">
          <label>Requesting team</label>
          <select id="requestTeam" class="input">
      ${options}
          </select>
        </div>

      </div><div class="flex">
        <div class="field">
        <label>Date</label>
          <input
            id="rqDate"
            class="input"
           value="${formattedDate}"
            type="date"
        
          />

      </div>
 

</div>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap: wrap;">
        <button class="button" id="saveRequest">
          Save Request
        </button>
      </div>
     `;

  root.appendChild(header);
  root.appendChild(grid);

  root.querySelector("#saveRequest").addEventListener("click", async () => {
    const client = ensureSupabaseClient(appState);

    // Get the values from the input fields
    const rqTitle = document.getElementById("rqTitle").value;
    const rqDesc = document.getElementById("rqDesc").value;
    const cost = document.getElementById("cost").value;
    const requestTeam = document.getElementById("requestTeam").value;
    // const rqAddDetails = document.getElementById("rqAddDetails").value;
    const rqDate = document.getElementById("rqDate").value;

    console.log("requestTeam", requestTeam);

    const userEmail = localStorage.getItem("userEmail");
    const role = localStorage.getItem("role");

    // check if cost is numeric and > 0
    if (isNaN(cost) || cost <= 0) {
      showToast("Cost must be a positive number.", "error");
      return;
    }

    // check if rqTitle is not empty
    if (rqTitle === "") {
      showToast("Request title cannot be empty.", "error");
      return;
    }

    if (rqDesc === "") {
      showToast("Request description cannot be empty.", "error");
      return;
    }

    // make an insert into table requests in supabase
    const { data, error } = await client
      .from("requests")
      .insert([
        {
          cost: cost,
          date: rqDate,
          team_id: requestTeam,
          title: rqTitle,
          description: rqDesc,
          status: "Pending",
          request_author_type: role,
        },
      ])
      .select();

    // empty fields
    // Empty all fields
    document.getElementById("rqTitle").value = "";

    document.getElementById("rqDesc").value = "";
    document.getElementById("cost").value = 0;

    showToast("Request saved.", "success");
  });
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

export const renderRequests = (appState, root) => {
  const data = appState.data;
  const currentMonday = getCurrentMondayHKISO();

  const header = document.createElement("div");
  header.className = "page-header";
  header.innerHTML = `<div class="page-title">Requests</div>`;

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
      <thead>
        <tr>   <th>Date</th>         
        <th>Team</th>        
          <th>Cost</th>  

                 <th>Title</th>
       <th>Description</th>
              <th>Status</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

  const applyFiltersRequest = () => {
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";

    let list = data.requests.slice();

    // Convert team_id to name
    list.forEach((request) => {
      const team = data.teams.find((team) => team.id === request.team_id);
      if (team) {
        request.team_name = team.team_name;
      }
    });

    // Order list by date
    list.sort((a, b) => b.date.localeCompare(a.date));

    for (const s of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
            <td>${s.date}</td>
            <td>${s.team_name}</td>
            <td>${s.cost}</td>
                   <td>${s.title}</td>
            <td>${s.description}</td>
                    <td>${s.status}</td>

        `;

      tr.addEventListener("click", () => {
        if (s.status != "Pending") {
          showToast(
            "You can only accept or decline a pending request.",
            "error"
          );
          return;
        }

        appState.page = "request_detail";
        appState.selectedStudentId = s.id;
        setActiveNav("checkRequest");

        // Create and display the popup
        const popup = document.createElement("div");
        popup.className = "popup-overlay";

        const popupContent = document.createElement("div");
        popupContent.className = "popup-content";

        // Add request details to the popup
        const details = `
        <p><strong>Date:</strong> ${s.date}</p>
        <p><strong>Cost:</strong> ${s.cost} HKD</p>
                <p><strong>Title:</strong> ${s.title}</p>
        <p><strong>Description:</strong> ${s.description}</p>
    `;
        popupContent.innerHTML = details; // Set the inner HTML with details

        const acceptButton = document.createElement("button");
        const declineButton = document.createElement("button");
        const cancelButton = document.createElement("button");

        acceptButton.textContent = "Accept";
        declineButton.textContent = "Decline";
        cancelButton.textContent = "Cancel";

        acceptButton.className = "button";
        declineButton.className = "button";
        cancelButton.className = "button";

        popupContent.appendChild(acceptButton);
        popupContent.appendChild(declineButton);
        popupContent.appendChild(cancelButton);
        popup.appendChild(popupContent);
        document.body.appendChild(popup);

        // Close the popup on button click
        cancelButton.addEventListener("click", () => {
          document.body.removeChild(popup);
        });

        // Handle accept and decline actions
        acceptButton.addEventListener("click", async () => {
          // Update status DB in supabase
          const client = ensureSupabaseClient(appState);

          // make an insert into table requests in supabase
          await client
            .from("requests")
            .update([
              {
                status: "Accepted",
              },
            ])
            .eq("id", s.id);

          // modify the team to deduct the expense to the budget

          // get team current budget
          const budget = await client
            .from("teams")
            .select("budget")
            .eq("id", s.team_id);

          const newBudget = budget.data[0].budget - s.cost;

          await client
            .from("teams")
            .update([
              {
                budget: newBudget,
              },
            ])
            .eq("id", s.team_id);

          // Handle accept logic
          console.log("Accepted request: ", s.id);
          s.status = "Accepted"; // Change the status to 'Accepted'
          tr.querySelector("td:last-child").textContent = s.status; // Update the last cell with the new status

          document.body.removeChild(popup);

          // create new team_expenses

          await client.from("team_expenses").insert([
            {
              team_id: s.team_id,
              value: s.cost,
              title: s.title,
              description: s.description,
            },
          ]);
        });

        declineButton.addEventListener("click", async () => {
          // Update status DB in supabase
          const client = ensureSupabaseClient(appState);

          // make an insert into table requests in supabase
          const { data, error } = await client
            .from("requests")
            .update([
              {
                status: "Declined",
              },
            ])
            .eq("id", s.id);

          // Handle decline logic
          console.log("Declined request: ", s.id);

          s.status = "Declined"; // Change the status to 'Accepted'
          tr.querySelector("td:last-child").textContent = s.status; // Update the last cell with the new status

          document.body.removeChild(popup);
        });
      });

      tbody.appendChild(tr);
    }
  };

  // Append header and table to root
  root.appendChild(header);
  root.appendChild(table);

  applyFiltersRequest();

  root.appendChild(header);

  root.appendChild(table);

  applyFiltersRequest();
};
