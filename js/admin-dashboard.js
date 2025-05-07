document.addEventListener("DOMContentLoaded", () => {
  //console.log("DEBUG: DOMContentLoaded event fired.");

  
  
  let localCurrentUser = currentUserData;
  let isAuthenticatedOnLoad = isAuthenticatedInHead;

  if (!isAuthenticatedOnLoad || !localCurrentUser) {
    // console.error(
    //   "ERROR: Autenticación fallida o datos de usuario no disponibles en DOMContentLoaded. Redirigiendo."
    // );
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
    return; 
  }

  document.body.classList.remove("auth-pending"); 
 // console.log("DEBUG: Usuario autenticado, inicializando script principal...");

  
  const userAvatarImg = document.getElementById("user-avatar-img");
  const uploadAvatarTrigger = document.getElementById("upload-avatar-trigger");
  const avatarUploadInput = document.getElementById("avatar-upload-input");
  const userNameDisplay = document.getElementById("user-name-display");
  const userRoleDisplay = document.getElementById("user-role-display");
  const profileNameDisplay = document.getElementById("profile-name-display");
  const profileDropdownButton = document.getElementById(
    "profile-dropdown-button"
  );
  const profileDropdownMenu = document.getElementById("profile-dropdown-menu");
  const updateProfilePicHeader = document.getElementById(
    "update-profile-pic-header"
  );
  const logoutButton = document.getElementById("logout-button");
  const countCitasHoy = document.getElementById("count-citas-hoy");
  const countVehiculos = document.getElementById("count-vehiculos");
  const countClientes = document.getElementById("count-clientes");
  const countServicios = document.getElementById("count-servicios");
  const proximasCitasList = document.getElementById("proximas-citas-list");

  const globalFeedbackContainer = document.getElementById(
    "global-feedback-container"
  );

  
const paginationContainer = document.getElementById("citas-pagination");
const btnPrevPage = document.getElementById("btn-prev-page");
const btnNextPage = document.getElementById("btn-next-page");
const pageInfoSpan = document.getElementById("page-info");



let allProximasCitasPendientes = []; 
let currentPage = 1;
const itemsPerPage = 5; 
let totalPages = 1;


  
  if (userNameDisplay)
    userNameDisplay.textContent =
      localCurrentUser.nombre || localCurrentUser.username;
  if (userRoleDisplay)
    userRoleDisplay.textContent = localCurrentUser.rol || "Usuario";
  if (profileNameDisplay)
    profileNameDisplay.textContent =
      localCurrentUser.nombre || localCurrentUser.username;
  if (userAvatarImg && localCurrentUser.avatarUrl) {
    // console.log(
    //   "Setting avatar from localStorage:",
    //   localCurrentUser.avatarUrl
    // );
    userAvatarImg.src = localCurrentUser.avatarUrl;
  } else if (userAvatarImg) {
  //  console.log("No avatarUrl found, using default placeholder.");
  }

  /**
   * Muestra un mensaje de feedback global.
   * @param {string} message - El mensaje a mostrar.
   * @param {string} type - El tipo de mensaje (success, error, loading, info).
   * @param {number} duration - Duración en ms antes de que desaparezca (si no es 'loading').
   * @returns {HTMLElement|null} El elemento del mensaje de feedback o null.
   */
  function showActionFeedback(message, type = "info", duration = 4000) {
    let feedbackContainer = globalFeedbackContainer;
    if (!feedbackContainer) {
     // console.warn("Contenedor de feedback global no encontrado. Creando uno nuevo.");
      
      feedbackContainer = document.createElement("div");
      feedbackContainer.id = "global-feedback-container";
      feedbackContainer.style.position = "fixed";
      feedbackContainer.style.bottom = "1rem";
      feedbackContainer.style.right = "1rem";
      feedbackContainer.style.zIndex = "1000";
      feedbackContainer.style.display = "flex";
      feedbackContainer.style.flexDirection = "column";
      feedbackContainer.style.gap = "0.5rem";
      feedbackContainer.style.alignItems = "flex-end";
      document.body.appendChild(feedbackContainer);
      
    }

    const feedbackDiv = document.createElement("div");
    let bgColor, iconClass;

    switch (type) {
      case "success":
        bgColor = "bg-green-100 border border-green-400 text-green-700";
        iconClass = "fas fa-check-circle";
        break;
      case "error":
        bgColor = "bg-red-100 border border-red-400 text-red-700";
        iconClass = "fas fa-exclamation-triangle";
        break;
      case "loading":
        bgColor = "bg-blue-100 border border-blue-400 text-blue-700";
        iconClass = "fas fa-spinner fa-spin";
        break;
      default: 
        bgColor = "bg-gray-100 border border-gray-400 text-gray-700";
        iconClass = "fas fa-info-circle";
        break;
    }

    
    feedbackDiv.className = `global-feedback-message p-3 rounded-md shadow-md flex items-center text-sm ${bgColor}`;
    feedbackDiv.style.transition = "opacity 0.5s ease-out"; 
    feedbackDiv.innerHTML = `<span class="inline-block align-middle mr-2"><i class="${iconClass}"></i></span><span class="inline-block align-middle">${message}</span>`;

    feedbackContainer.appendChild(feedbackDiv);

    if (type !== "loading") {
      setTimeout(() => {
        feedbackDiv.style.opacity = "0";
        
        feedbackDiv.addEventListener("transitionend", () => feedbackDiv.remove());
        
        setTimeout(() => {
          if (feedbackDiv.parentNode) feedbackDiv.remove();
        }, duration + 500); 
      }, duration);
    }
    return feedbackDiv; 
  }

  /**
   * Formatea una cadena de fecha y hora a un formato legible (Día Mes, HH:MM AM/PM).
   * @param {string} dateTimeString - La cadena de fecha y hora (ej. 'YYYY-MM-DDTHH:mm:ss.sssZ').
   * @returns {string} La fecha y hora formateada o 'N/A'/'Fecha inválida'.
   */
  function formatDateTimeSimple(dateTimeString) {
    if (!dateTimeString || dateTimeString === "N/A") return "N/A";
    try {
      let date = new Date(dateTimeString);
      
      if (isNaN(date.getTime())) {
        const parts = dateTimeString.split(/[- :T.]/); 
        if (parts.length >= 6) { 
          date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]));
        } else if (parts.length >= 3) { 
          date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        }
      }
      if (isNaN(date.getTime())) return "Fecha inválida";

      return date.toLocaleString("es-PE", { 
        day: "2-digit",
        month: "short", 
        hour: "2-digit",
        minute: "2-digit",
        hour12: true, 
        
      });
    } catch (e) {
     // console.error("Error formateando fecha-hora simple:", dateTimeString, e);
      return "Fecha inválida";
    }
  }

  /**
   * Formatea una cadena de fecha a un formato legible (DD Mes YYYY).
   * @param {string} dateString - La cadena de fecha (ej. 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ss.sssZ').
   * @returns {string} La fecha formateada o 'N/A'/'Fecha inválida'.
   */
  function formatDateSimple(dateString) {
    if (!dateString || dateString === "N/A") return "N/A";
    try {
      const datePart = dateString.split("T")[0]; 
      const parts = datePart.split("-");
      if (parts.length !== 3) return "Formato inválido"; 
      
      const date = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      if (isNaN(date.getTime())) return "Fecha inválida";

      return date.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC", 
      });
    } catch (e) {
     // console.error("Error formateando fecha simple:", dateString, e);
      return "Fecha inválida";
    }
  }

  /**
   * Formatea una cadena de hora a un formato legible (HH:MM AM/PM).
   * @param {string} timeString - La cadena de hora (ej. 'HH:mm:ss' o 'HH:mm').
   * @returns {string} La hora formateada o 'Hora inválida'.
   */
  function formatTimeSimple(timeString) {
    if (!timeString || timeString === "N/A") return ""; 
    try {
      const timeParts = timeString.split(":");
      if (timeParts.length >= 2) { 
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const tempDate = new Date(); 
          tempDate.setHours(hours, minutes, 0, 0); 
          return tempDate.toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            
            
            
          });
        }
      }
      return "Hora inválida";
    } catch (e) {
     // console.error("Error formateando hora simple:", timeString, e);
      return "Hora inválida";
    }
  }

  /**
   * Carga los datos estadísticos y las próximas citas para el dashboard.
   */
  /**
 * Carga los datos estadísticos y las próximas citas para el dashboard.
 */
  async function cargarDatosDashboard() {
   // console.log("DEBUG: Cargando datos del dashboard...");
    
    if (countCitasHoy) countCitasHoy.textContent = "...";
    if (countVehiculos) countVehiculos.textContent = "...";
    if (countClientes) countClientes.textContent = "...";
    if (countServicios) countServicios.textContent = "...";
    if (proximasCitasList) proximasCitasList.innerHTML = '<p class="text-center text-gray-500 italic">Cargando próximas citas...</p>';
    if (paginationContainer) paginationContainer.classList.add('hidden'); 

    try {
      const hoy = new Date();
      const hoyStr = hoy.toISOString().split("T")[0]; 

      let citasHoyPendientes = 0;

      
      
      const citasResponse = await fetch(`/api/citas?fecha_inicio=${hoyStr}`);
      const citasData = await citasResponse.json();
    //  console.log("DEBUG: Respuesta Citas (futuras):", citasData);

      if (citasResponse.ok && citasData.success && citasData.citas) {
        
        allProximasCitasPendientes = citasData.citas
          .filter(cita => cita.estado === 'Pendiente')
          .sort((a, b) => { 
            
            const dateAString = `${a.fecha_cita.split('T')[0]}T${a.hora_cita || "00:00:00"}`;
            const dateBString = `${b.fecha_cita.split('T')[0]}T${b.hora_cita || "00:00:00"}`;
            const dateA = new Date(dateAString);
            const dateB = new Date(dateBString);
            return dateA - dateB; 
          });

        
       // console.log("DEBUG: Citas pendientes futuras ordenadas (allProximasCitasPendientes):", JSON.stringify(allProximasCitasPendientes.map(c => ({fecha: c.fecha_cita, hora: c.hora_cita}))));

        
        citasHoyPendientes = allProximasCitasPendientes.filter(cita => cita.fecha_cita.split("T")[0] === hoyStr).length;
        if (countCitasHoy) countCitasHoy.textContent = citasHoyPendientes;

        
        currentPage = 1; 
        renderProximasCitasPage(); 

      } else {
       // console.error("Error al cargar citas para dashboard:", citasData.message || "Respuesta no OK");
        if (countCitasHoy) countCitasHoy.textContent = "Error";
        if (proximasCitasList) proximasCitasList.innerHTML = '<p class="text-center text-red-500">Error al cargar citas.</p>';
        if (paginationContainer) paginationContainer.classList.add('hidden');
      }

      
      try { const vehiculosResponse = await fetch("/api/vehiculos/count"); const vehiculosData = await vehiculosResponse.json(); if (vehiculosResponse.ok && vehiculosData.success) { if (countVehiculos) countVehiculos.textContent = vehiculosData.total ?? "0"; } else { console.error("Error en respuesta de /api/vehiculos/count:", vehiculosData.message); if (countVehiculos) countVehiculos.textContent = "Error"; } } catch (e) { console.error("Error fetching vehicle count:", e); if (countVehiculos) countVehiculos.textContent = "Error"; }
      try { const clientesResponse = await fetch("/api/clientes/count"); const clientesData = await clientesResponse.json(); if (clientesResponse.ok && clientesData.success) { if (countClientes) countClientes.textContent = clientesData.total ?? "0"; } else { console.error("Error en respuesta de /api/clientes/count:", clientesData.message); if (countClientes) countClientes.textContent = "Error"; } } catch (e) { console.error("Error fetching client count:", e); if (countClientes) countClientes.textContent = "Error"; }
      try { const serviciosResponse = await fetch("/api/servicios?activos=true"); const serviciosData = await serviciosResponse.json(); if (serviciosResponse.ok && serviciosData.success && serviciosData.servicios) { if (countServicios) countServicios.textContent = serviciosData.servicios.length; } else { console.error("Error en respuesta de /api/servicios?activos=true:", serviciosData.message); if (countServicios) countServicios.textContent = "Error"; } } catch (e) { console.error("Error fetching active services count:", e); if (countServicios) countServicios.textContent = "Error"; }

    } catch (error) {
      //console.error("Error general cargando datos del dashboard:", error);
      if (countCitasHoy) countCitasHoy.textContent = "Error"; if (countVehiculos) countVehiculos.textContent = "Error"; if (countClientes) countClientes.textContent = "Error"; if (countServicios) countServicios.textContent = "Error";
      if (proximasCitasList) proximasCitasList.innerHTML = '<p class="text-center text-red-500">Error de conexión al cargar datos.</p>';
      if (paginationContainer) paginationContainer.classList.add('hidden');
    }
  }

  /**
   * Maneja la subida de un nuevo avatar para el usuario.
   * @param {Event} event - El evento 'change' del input de archivo.
   */
  async function handleAvatarUpload(event) {
    //console.log("DEBUG: Avatar file input changed.");
    const file = event.target.files[0];
    if (!file) {
      //console.log("DEBUG: No file selected.");
      return;
    }

    
    const currentUserForUpload = currentUserData;
    if (!currentUserForUpload || !currentUserForUpload.id) {
      // console.error(
      //   "Error: No se pudo obtener el ID del usuario actual para subir avatar."
      // );
      showActionFeedback("Error: No se pudo identificar al usuario.", "error");
      return;
    }

    
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    const maxSize = 2 * 1024 * 1024; 
    if (!allowedTypes.includes(file.type)) {
      showActionFeedback(
        "Error: Tipo de archivo no permitido (solo JPG, PNG, GIF).",
        "error"
      );
      avatarUploadInput.value = ""; 
      return;
    }
    if (file.size > maxSize) {
      showActionFeedback(
        "Error: El archivo es demasiado grande (máximo 2MB).",
        "error"
      );
      avatarUploadInput.value = ""; 
      return;
    }

    const loadingFeedback = showActionFeedback(
      "Subiendo nueva foto...",
      "loading"
    );
    const formData = new FormData();
    formData.append("avatar", file); 

    try {
      const apiUrl = `/api/users/${currentUserForUpload.id}/avatar`; 
     // console.log(`DEBUG: Sending POST to ${apiUrl} for avatar upload.`);

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        
      });

      if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove(); 

      const result = await response.json();
     // console.log("DEBUG: Server response (avatar upload):", result);

      if (response.ok && result.success && result.avatarUrl) {
        // console.log(
        //   "DEBUG: Avatar uploaded successfully. New URL:",
        //   result.avatarUrl
        // );

        if (userAvatarImg) {
          userAvatarImg.src = result.avatarUrl; 
        }

        
        currentUserForUpload.avatarUrl = result.avatarUrl;
        localStorage.setItem("userData", JSON.stringify(currentUserForUpload));
        
        

        // console.log(
        //   "DEBUG: User data updated in localStorage with new avatarUrl."
        // );
        showActionFeedback(
          result.message || "Foto de perfil actualizada.",
          "success"
        );
      } else {
        // console.error(
        //   "Error in server response (avatar upload):",
        //   result.message || response.statusText
        // );
        showActionFeedback(
          result.message || "Error al subir la foto.",
          "error"
        );
      }
    } catch (error) {
      if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
     // console.error("Network error during avatar upload:", error);
      showActionFeedback("Error de conexión al subir la foto.", "error");
    } finally {
      avatarUploadInput.value = ""; 
      //console.log("DEBUG: Avatar file input reset.");
    }
  }


  /**
   * Renderiza la página actual de citas próximas pendientes.
   */

  /**
   * Renderiza la página actual de citas próximas pendientes.
   */
  function renderProximasCitasPage() {
    if (!proximasCitasList || !paginationContainer) {
      //  console.error("Elementos de lista o paginación no encontrados");
        return;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const citasPaginaActual = allProximasCitasPendientes.slice(startIndex, endIndex);
    proximasCitasList.innerHTML = "";
    if (citasPaginaActual.length === 0 && currentPage === 1) {
      proximasCitasList.innerHTML = '<p class="text-center text-gray-500 italic">No hay citas pendientes próximas.</p>';
      paginationContainer.classList.add('hidden');
    } else if (citasPaginaActual.length === 0 && currentPage > 1) {
       proximasCitasList.innerHTML = '<p class="text-center text-gray-500 italic">No hay más citas para mostrar en esta página.</p>';
       paginationContainer.classList.remove('hidden');
    } else {
      citasPaginaActual.forEach(cita => {
        const nombreCliente = `${cita.nombre_cliente || ""} ${cita.apellido_cliente || ""}`.trim();
        const vehiculoDesc = `${cita.marca_vehiculo || "Marca Desc."} ${cita.modelo_vehiculo || "Modelo Desc."} (${cita.placa_vehiculo || "S/P"})`;
        const div = document.createElement('div');
        div.className = "appointment-list-item flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0";
        
        div.innerHTML = `
          <div>
            <p class="font-medium text-gray-800">${formatDateSimple(cita.fecha_cita)} - ${formatTimeSimple(cita.hora_cita)}</p>
            <p class="text-xs text-gray-600">${nombreCliente} - ${vehiculoDesc}</p>
          </div>
          <a href="admin_miscitas.html#cita-${cita.id_cita}" class="text-xs text-blue-600 hover:underline">Ver</a>
        `;
        proximasCitasList.appendChild(div);
      });
      paginationContainer.classList.remove('hidden');
    }
    renderPaginationControls();
  }

  /**
   * Actualiza los controles de paginación (botones y texto).
   */
  function renderPaginationControls() {
    if (!paginationContainer || !pageInfoSpan || !btnPrevPage || !btnNextPage) return;

    totalPages = Math.ceil(allProximasCitasPendientes.length / itemsPerPage);
    if (totalPages <= 0) totalPages = 1; 

    pageInfoSpan.textContent = `Página ${currentPage} de ${totalPages}`;
    btnPrevPage.disabled = currentPage === 1;
    btnNextPage.disabled = currentPage === totalPages || allProximasCitasPendientes.length === 0;
  }
  

  
  if (logoutButton)
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("userData"); 
      window.location.replace("login.html"); 
    });


  
if(btnPrevPage) {
  btnPrevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderProximasCitasPage(); 
    }
  });
}
if(btnNextPage) {
  btnNextPage.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderProximasCitasPage(); 
    }
  });
}


  
  if (uploadAvatarTrigger && avatarUploadInput) {
    uploadAvatarTrigger.addEventListener("click", () => {
      //console.log("DEBUG: Sidebar avatar trigger clicked.");
      avatarUploadInput.click(); 
    });
    avatarUploadInput.addEventListener("change", handleAvatarUpload);
  }

  
  if (updateProfilePicHeader && avatarUploadInput) {
    updateProfilePicHeader.addEventListener("click", (event) => {
      event.preventDefault(); 
     // console.log("DEBUG: Header dropdown avatar trigger clicked.");
      avatarUploadInput.click(); 
      if (profileDropdownMenu) profileDropdownMenu.classList.add("hidden"); 
    });
    
  }

  
  if (profileDropdownButton && profileDropdownMenu) {
    profileDropdownButton.addEventListener("click", (event) => {
      event.stopPropagation(); 
      profileDropdownMenu.classList.toggle("hidden");
    });
    
    document.addEventListener("click", (event) => {
      if (
        profileDropdownMenu && 
        !profileDropdownMenu.classList.contains("hidden") && 
        !profileDropdownButton.contains(event.target) && 
        !profileDropdownMenu.contains(event.target) 
      ) {
        profileDropdownMenu.classList.add("hidden");
      }
    });
  }

  /**
   * Función de inicialización de la página.
   */
  function inicializarPagina() {
    cargarDatosDashboard();
   // console.log("Dashboard cargado y lógica inicializada.");
  }

  
  inicializarPagina();
});
