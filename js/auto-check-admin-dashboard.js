let currentUserData = null; 
        let isAuthenticatedInHead = false;
        try {
            const storedUserData = localStorage.getItem('userData');
            if (!storedUserData) {
                console.log("Auth Check (Head): No user data. Redirecting...");
                if (!window.location.pathname.endsWith('login.html')) window.location.replace('login.html');
                throw new Error("Redirecting");
            }
            currentUserData = JSON.parse(storedUserData); 
            if (!currentUserData || !currentUserData.username || !currentUserData.id) {
                 console.error("Auth Check (Head): Invalid user data format.");
                 localStorage.removeItem('userData');
                 if (!window.location.pathname.endsWith('login.html')) window.location.replace('login.html');
                 throw new Error("Invalid user data.");
             }
            console.log("Auth Check (Head): OK for user:", currentUserData.username);
            isAuthenticatedInHead = true;
        } catch (e) {
             if (e.message !== "Redirecting" && e.message !== "Invalid user data.") {
                 console.error("Auth Check Error (Head), redirecting:", e);
                 localStorage.removeItem('userData');
                 if (!window.location.pathname.endsWith('login.html')) { window.location.replace('login.html'); }
             }
             currentUserData = null; 
             isAuthenticatedInHead = false;
         }