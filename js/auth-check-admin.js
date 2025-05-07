let currentUser = null;
let isAuthenticated = false;

try {
  const storedUserData = localStorage.getItem("userData");
  if (!storedUserData) {
    // console.log(
    //   "Auth Check (Head): No user data found in localStorage. Redirecting to login..."
    // );
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
    throw new Error("Redirect login");
  }
  currentUser = JSON.parse(storedUserData);
  if (!currentUser || !currentUser.username || !currentUser.id) {
    console.error(
      "Auth Check (Head): Invalid user data format in localStorage."
    );
    localStorage.removeItem("userData");
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
    throw new Error("Invalid user data.");
  }
  // console.log(
  //   "Auth Check (Head): Authentication successful for user:",
  //   currentUser.username,
  //   "ID:",
  //   currentUser.id
  // );
  isAuthenticated = true;
} catch (e) {
  if (e.message !== "Redirect login" && e.message !== "Invalid user data.") {
    console.error("Auth Check (Head) Error:", e);
    localStorage.removeItem("userData");
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
  }
  currentUser = null;
  isAuthenticated = false;
}
