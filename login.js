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

  const loadUserDataFromSupabase = async (email) => {
    const client = ensureSupabaseClient();
    console.log("client userdata", client);
    if (!client) return { data: null, missing: true };
    const usersRes = await Promise.all([
      client.from("users").select("*").eq("email", email),
    ]);

    const anyError = [usersRes].find((r) => r.error);
    if (anyError) return { data: null, missing: true };
    const result = {
      users: usersRes[0].data || [],
    };

    return { data: result, missing: false };
  };

  const setSession = async (email, role) => {
    const client = ensureSupabaseClient();
    console.log("client session", client);
    if (!client) return { randNumber: 0, error: true };

    // Initialiser le numéro aléatoire
    let randNumber;

    // Boucle jusqu'à ce qu'un numéro unique soit trouvé
    let sessionData = [];
    do {
      randNumber = Math.floor(Math.random() * 1000000);

      // Vérifiez si le numéro de session existe déjà
      try {
        console.log("randNumber", randNumber);

        const { data, error } = await client
          .from("sessions")
          .select("*")
          .eq("session_id", randNumber);

        console.log("error", error);
        console.log("data", data);
        sessionData = data || [];

        if (error) {
          console.error(
            "Erreur lors de la vérification de la session :",
            error
          );
          return { randNumber: 0, error: true };
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de la session :", error);
        return { randNumber: 0, error: true };
      }
    } while (sessionData.length > 0);

    // create record in table session
    const { data, error } = await client
      .from("sessions")
      .insert([{ session_id: randNumber, user_email: email, role: role }]);

    if (error) {
      console.error("Erreur lors de l'insertion de la session :", error);
      return { randNumber: 0, error: true };
    }

    console.log("data", data);

    return { randNumber: randNumber, error: false };
  };

  const checkEmailPass = async () => {
    // Simple email validation
    if (email) {
      if (password) {
        const { data, missing } = await loadUserDataFromSupabase(email);
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

        const { randNumber, error } = await setSession(
          email,
          currentUser[0].role
        );

        if (error) {
          errorDiv.textContent = "Error setting session.";
          return null;
        }

        localStorage.setItem("sessionNumber", randNumber);

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
