document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorDiv = document.getElementById("error");

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

  const writeEnabled = () => !!(appState.supabase.url && appState.supabase.key);

  const ensureSupabaseClient = () => {
    if (!appState.supabase.client && writeEnabled()) {
      appState.supabase.client = window.supabase.createClient(
        appState.supabase.url,
        appState.supabase.key
      );
    }
    return appState.supabase.client;
  };

  const loadUsersDataFromSupabase = async () => {
    const client = ensureSupabaseClient();
    if (!client) return { data: null, missing: true };
    const usersRes = await Promise.all([client.from("users").select("*")]);

    const anyError = [usersRes].find((r) => r.error);
    if (anyError) return { data: null, missing: true };
    const result = {
      users: usersRes[0].data || [],
    };

    return { data: result, missing: false };
  };

  const checkEmailPass = async () => {
    // Simple email validation
    if (email) {
      if (password) {
        const { data, missing } = await loadUsersDataFromSupabase();
        // check if email is present in

        console.log("users", data.users);
        console.log("missing", missing);

        if (missing) {
          errorDiv.textContent = "No users found.";
          return null;
        }

        // find email in users object
        const currentUser = data.users.filter((user) => user.email === email);

        if (currentUser.length === 0 || currentUser[0].password != password) {
          errorDiv.textContent = "Invalid user/password.";
          return null;
        }

        localStorage.setItem("userEmail", email);
        localStorage.setItem("role", currentUser[0].role);
        window.location.href = "index.html"; // Redirect to the main app
      } else {
        errorDiv.textContent = "Please enter a password.";
      }
    } else {
      errorDiv.textContent = "Please enter a valid email address.";
    }
  };

  checkEmailPass();
});
