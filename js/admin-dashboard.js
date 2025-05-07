document.addEventListener("DOMContentLoaded", () => {
  console.log("DEBUG: DOMContentLoaded event fired.");

  // Asumiendo que currentUserData y isAuthenticatedInHead se definen globalmente
  // por el script auto-check-admin-dashboard.js que se ejecuta en el <head>
  let localCurrentUser = currentUserData;
  let isAuthenticatedOnLoad = isAuthenticatedInHead;

  if (!isAuthenticatedOnLoad || !localCurrentUser) {
    console.error(
      "ERROR: Autenticación fallida o datos de usuario no disponibles en DOMContentLoaded. Redirigiendo."
    );
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
    return; // Detiene la ejecución si no está autenticado
  }

  document.body.classList.remove("auth-pending"); // Quita la clase que oculta el contenido
  console.log("DEBUG: Usuario autenticado, inicializando script principal...");

  // Obtención de elementos del DOM
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

  // Configuración inicial de la UI con datos del usuario
  if (userNameDisplay)
    userNameDisplay.textContent =
      localCurrentUser.nombre || localCurrentUser.username;
  if (userRoleDisplay)
    userRoleDisplay.textContent = localCurrentUser.rol || "Usuario";
  if (profileNameDisplay)
    profileNameDisplay.textContent =
      localCurrentUser.nombre || localCurrentUser.username;
  if (userAvatarImg && localCurrentUser.avatarUrl) {
    console.log(
      "Setting avatar from localStorage:",
      localCurrentUser.avatarUrl
    );
    userAvatarImg.src = localCurrentUser.avatarUrl;
  } else if (userAvatarImg) {
    console.log("No avatarUrl found, using default placeholder.");
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
      console.warn("Contenedor de feedback global no encontrado. Creando uno nuevo.");
      // Crea el contenedor si no existe (puede ser útil si el script se carga antes que el HTML)
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
      // globalFeedbackContainer = feedbackContainer; // Actualiza la referencia global si es necesario
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
      default: // info
        bgColor = "bg-gray-100 border border-gray-400 text-gray-700";
        iconClass = "fas fa-info-circle";
        break;
    }

    // Aplicar estilos Tailwind y personalizados para el mensaje
    feedbackDiv.className = `global-feedback-message p-3 rounded-md shadow-md flex items-center text-sm ${bgColor}`;
    feedbackDiv.style.transition = "opacity 0.5s ease-out"; // Para la animación de desaparición
    feedbackDiv.innerHTML = `<span class="inline-block align-middle mr-2"><i class="${iconClass}"></i></span><span class="inline-block align-middle">${message}</span>`;

    feedbackContainer.appendChild(feedbackDiv);

    if (type !== "loading") {
      setTimeout(() => {
        feedbackDiv.style.opacity = "0";
        // Espera a que termine la transición antes de remover el elemento
        feedbackDiv.addEventListener("transitionend", () => feedbackDiv.remove());
        // Fallback por si transitionend no se dispara (raro, pero seguro)
        setTimeout(() => {
          if (feedbackDiv.parentNode) feedbackDiv.remove();
        }, duration + 500); // Un poco más que la duración para asegurar
      }, duration);
    }
    return feedbackDiv; // Devuelve el div para poder quitarlo manualmente si es 'loading'
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
      // Intento de parseo manual si el automático falla (considerando UTC)
      if (isNaN(date.getTime())) {
        const parts = dateTimeString.split(/[- :T.]/); // Divide por -, espacio, :, T, .
        if (parts.length >= 6) { // YYYY, MM, DD, HH, MM, SS
          date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]));
        } else if (parts.length >= 3) { // YYYY, MM, DD (si solo es fecha)
          date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        }
      }
      if (isNaN(date.getTime())) return "Fecha inválida";

      return date.toLocaleString("es-PE", { // es-PE para formato peruano
        day: "2-digit",
        month: "short", // Mes abreviado (ej. "may.")
        hour: "2-digit",
        minute: "2-digit",
        hour12: true, // Formato AM/PM
        // timeZone: 'UTC' // Si la fecha original es UTC y quieres mostrarla como tal
      });
    } catch (e) {
      console.error("Error formateando fecha-hora simple:", dateTimeString, e);
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
      const datePart = dateString.split("T")[0]; // Tomar solo la parte de la fecha si es ISO completa
      const parts = datePart.split("-");
      if (parts.length !== 3) return "Formato inválido"; // YYYY, MM, DD
      // Crear fecha en UTC para evitar problemas de zona horaria al interpretar solo la fecha
      const date = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      if (isNaN(date.getTime())) return "Fecha inválida";

      return date.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC", // Importante para que la fecha se muestre como se almacenó
      });
    } catch (e) {
      console.error("Error formateando fecha simple:", dateString, e);
      return "Fecha inválida";
    }
  }

  /**
   * Formatea una cadena de hora a un formato legible (HH:MM AM/PM).
   * @param {string} timeString - La cadena de hora (ej. 'HH:mm:ss' o 'HH:mm').
   * @returns {string} La hora formateada o 'Hora inválida'.
   */
  function formatTimeSimple(timeString) {
    if (!timeString || timeString === "N/A") return ""; // Devolver vacío si no hay hora
    try {
      const timeParts = timeString.split(":");
      if (timeParts.length >= 2) { // HH, MM
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const tempDate = new Date(); // Fecha temporal solo para usar toLocaleTimeString
          tempDate.setHours(hours, minutes, 0, 0); // Establecer horas y minutos
          return tempDate.toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            // No especificar timeZone aquí para que use la del navegador,
            // asumiendo que la hora guardada es local al servidor/usuario.
            // Si la hora es UTC, se debería manejar en la creación de la fecha.
          });
        }
      }
      return "Hora inválida";
    } catch (e) {
      console.error("Error formateando hora simple:", timeString, e);
      return "Hora inválida";
    }
  }

  /**
   * Carga los datos estadísticos y las próximas citas para el dashboard.
   */
  async function cargarDatosDashboard() {
    console.log("DEBUG: Cargando datos del dashboard...");
    // Mostrar indicadores de carga
    if (countCitasHoy) countCitasHoy.textContent = "...";
    if (countVehiculos) countVehiculos.textContent = "...";
    if (countClientes) countClientes.textContent = "...";
    if (countServicios) countServicios.textContent = "...";
    if (proximasCitasList)
      proximasCitasList.innerHTML =
        '<p class="text-center text-gray-500 italic">Cargando próximas citas...</p>';

    try {
      const hoy = new Date();
      const hoyStr = hoy.toISOString().split("T")[0]; // YYYY-MM-DD para hoy
      const proxSemana = new Date();
      proxSemana.setDate(hoy.getDate() + 7); // Fecha dentro de 7 días
      const proxSemanaStr = proxSemana.toISOString().split("T")[0]; // YYYY-MM-DD para próxima semana

      let citasHoyPendientes = 0;
      const proximasCitasHtml = [];

      // Fetch de citas para la próxima semana (incluyendo hoy)
      const citasResponse = await fetch(
        `/api/citas?fecha_inicio=${hoyStr}&fecha_fin=${proxSemanaStr}` // MODIFIED
      );
      const citasData = await citasResponse.json();
      console.log("DEBUG: Respuesta Citas:", citasData);

      if (citasResponse.ok && citasData.success && citasData.citas) {
        // Ordenar citas por fecha y hora
        citasData.citas.sort((a, b) => {
          const dateA = new Date(`${a.fecha_cita.split('T')[0]}T${a.hora_cita || "00:00:00"}`);
          const dateB = new Date(`${b.fecha_cita.split('T')[0]}T${b.hora_cita || "00:00:00"}`);
          return dateA - dateB;
        });

        citasData.citas.forEach((cita) => {
          if (cita.estado === "Pendiente") {
            const fechaCita = cita.fecha_cita.split("T")[0];
            if (fechaCita === hoyStr) {
              citasHoyPendientes++;
            }

            // Mostrar hasta 5 próximas citas pendientes
            if (proximasCitasHtml.length < 5) {
              const nombreCliente = `${cita.nombre_cliente || ""} ${
                cita.apellido_cliente || ""
              }`.trim();
              const vehiculoDesc = `${cita.marca_vehiculo || ""} ${
                cita.modelo_vehiculo || ""
              } (${cita.placa_vehiculo || "S/P"})`;

              proximasCitasHtml.push(`
                <div class="appointment-list-item flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                    <div>
                        <p class="font-medium text-gray-800">${formatDateSimple(
                          cita.fecha_cita // Usar la fecha completa para formatear
                        )} ${formatTimeSimple(cita.hora_cita)}</p>
                        <p class="text-xs text-gray-600">${nombreCliente} - ${vehiculoDesc}</p>
                    </div>
                    <a href="admin_miscitas.html#cita-${cita.id_cita}" class="text-xs text-blue-600 hover:underline">Ver</a>
                </div>`);
            }
          }
        });
        if (countCitasHoy) countCitasHoy.textContent = citasHoyPendientes;
        if (proximasCitasList) {
          proximasCitasList.innerHTML =
            proximasCitasHtml.length > 0
              ? proximasCitasHtml.join("")
              : '<p class="text-center text-gray-500 italic">No hay citas pendientes próximas.</p>';
        }
      } else {
        console.error("Error al cargar citas para dashboard:", citasData.message || "Respuesta no OK");
        if (countCitasHoy) countCitasHoy.textContent = "Error";
        if (proximasCitasList)
          proximasCitasList.innerHTML =
            '<p class="text-center text-red-500">Error al cargar citas.</p>';
      }

      // Fetch de conteo de vehículos
      try {
        const vehiculosResponse = await fetch("/api/vehiculos/count"); // MODIFIED
        const vehiculosData = await vehiculosResponse.json();
        console.log("DEBUG: Respuesta Vehiculos Count:", vehiculosData);
        if (vehiculosResponse.ok && vehiculosData.success) {
          if (countVehiculos)
            countVehiculos.textContent = vehiculosData.total ?? "0";
        } else {
          console.error("Error en respuesta de /api/vehiculos/count:", vehiculosData.message);
          if (countVehiculos) countVehiculos.textContent = "Error";
        }
      } catch (e) {
        console.error("Error fetching vehicle count:", e);
        if (countVehiculos) countVehiculos.textContent = "Error";
      }

      // Fetch de conteo de clientes
      try {
        const clientesResponse = await fetch("/api/clientes/count"); // MODIFIED
        const clientesData = await clientesResponse.json();
        console.log("DEBUG: Respuesta Clientes Count:", clientesData);
        if (clientesResponse.ok && clientesData.success) {
          if (countClientes)
            countClientes.textContent = clientesData.total ?? "0";
        } else {
          console.error("Error en respuesta de /api/clientes/count:", clientesData.message);
          if (countClientes) countClientes.textContent = "Error";
        }
      } catch (e) {
        console.error("Error fetching client count:", e);
        if (countClientes) countClientes.textContent = "Error";
      }

      // Fetch de conteo de servicios activos
      try {
        const serviciosResponse = await fetch("/api/servicios?activos=true"); // MODIFIED
        const serviciosData = await serviciosResponse.json();
        console.log("DEBUG: Respuesta Servicios Activos:", serviciosData);
        if (
          serviciosResponse.ok &&
          serviciosData.success &&
          serviciosData.servicios
        ) {
          if (countServicios)
            countServicios.textContent = serviciosData.servicios.length;
        } else {
          console.error("Error en respuesta de /api/servicios?activos=true:", serviciosData.message);
          if (countServicios) countServicios.textContent = "Error";
        }
      } catch (e) {
        console.error("Error fetching active services count:", e);
        if (countServicios) countServicios.textContent = "Error";
      }
    } catch (error) {
      console.error("Error general cargando datos del dashboard:", error);
      // Mostrar error en todos los contadores y lista
      if (countCitasHoy) countCitasHoy.textContent = "Error";
      if (countVehiculos) countVehiculos.textContent = "Error";
      if (countClientes) countClientes.textContent = "Error";
      if (countServicios) countServicios.textContent = "Error";
      if (proximasCitasList)
        proximasCitasList.innerHTML =
          '<p class="text-center text-red-500">Error de conexión al cargar datos.</p>';
    }
  }

  /**
   * Maneja la subida de un nuevo avatar para el usuario.
   * @param {Event} event - El evento 'change' del input de archivo.
   */
  async function handleAvatarUpload(event) {
    console.log("DEBUG: Avatar file input changed.");
    const file = event.target.files[0];
    if (!file) {
      console.log("DEBUG: No file selected.");
      return;
    }

    // Re-obtener localCurrentUser por si acaso, aunque debería estar disponible
    const currentUserForUpload = currentUserData;
    if (!currentUserForUpload || !currentUserForUpload.id) {
      console.error(
        "Error: No se pudo obtener el ID del usuario actual para subir avatar."
      );
      showActionFeedback("Error: No se pudo identificar al usuario.", "error");
      return;
    }

    // Validaciones de archivo
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (!allowedTypes.includes(file.type)) {
      showActionFeedback(
        "Error: Tipo de archivo no permitido (solo JPG, PNG, GIF).",
        "error"
      );
      avatarUploadInput.value = ""; // Limpiar input
      return;
    }
    if (file.size > maxSize) {
      showActionFeedback(
        "Error: El archivo es demasiado grande (máximo 2MB).",
        "error"
      );
      avatarUploadInput.value = ""; // Limpiar input
      return;
    }

    const loadingFeedback = showActionFeedback(
      "Subiendo nueva foto...",
      "loading"
    );
    const formData = new FormData();
    formData.append("avatar", file); // El backend espera un campo 'avatar'

    try {
      const apiUrl = `/api/users/${currentUserForUpload.id}/avatar`; // MODIFIED
      console.log(`DEBUG: Sending POST to ${apiUrl} for avatar upload.`);

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        // No es necesario 'Content-Type' para FormData, el navegador lo establece.
      });

      if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove(); // Quitar mensaje de carga

      const result = await response.json();
      console.log("DEBUG: Server response (avatar upload):", result);

      if (response.ok && result.success && result.avatarUrl) {
        console.log(
          "DEBUG: Avatar uploaded successfully. New URL:",
          result.avatarUrl
        );

        if (userAvatarImg) {
          userAvatarImg.src = result.avatarUrl; // Actualizar imagen en la UI
        }

        // Actualizar avatarUrl en el objeto localCurrentUser y en localStorage
        currentUserForUpload.avatarUrl = result.avatarUrl;
        localStorage.setItem("userData", JSON.stringify(currentUserForUpload));
        // Si tienes una variable global `currentUserData` podrías actualizarla también
        // currentUserData.avatarUrl = result.avatarUrl;

        console.log(
          "DEBUG: User data updated in localStorage with new avatarUrl."
        );
        showActionFeedback(
          result.message || "Foto de perfil actualizada.",
          "success"
        );
      } else {
        console.error(
          "Error in server response (avatar upload):",
          result.message || response.statusText
        );
        showActionFeedback(
          result.message || "Error al subir la foto.",
          "error"
        );
      }
    } catch (error) {
      if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
      console.error("Network error during avatar upload:", error);
      showActionFeedback("Error de conexión al subir la foto.", "error");
    } finally {
      avatarUploadInput.value = ""; // Limpiar el input de archivo en cualquier caso
      console.log("DEBUG: Avatar file input reset.");
    }
  }

  // Event Listeners
  if (logoutButton)
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("userData"); // Limpiar datos de sesión
      window.location.replace("login.html"); // Redirigir a login
    });

  // Para el botón de cámara en el sidebar
  if (uploadAvatarTrigger && avatarUploadInput) {
    uploadAvatarTrigger.addEventListener("click", () => {
      console.log("DEBUG: Sidebar avatar trigger clicked.");
      avatarUploadInput.click(); // Abrir selector de archivo
    });
    avatarUploadInput.addEventListener("change", handleAvatarUpload);
  }

  // Para la opción "Actualizar imagen de perfil" en el dropdown del header
  if (updateProfilePicHeader && avatarUploadInput) {
    updateProfilePicHeader.addEventListener("click", (event) => {
      event.preventDefault(); // Prevenir comportamiento de enlace
      console.log("DEBUG: Header dropdown avatar trigger clicked.");
      avatarUploadInput.click(); // Abrir selector de archivo
      if (profileDropdownMenu) profileDropdownMenu.classList.add("hidden"); // Ocultar dropdown
    });
    // No es necesario agregar 'change' listener aquí de nuevo si avatarUploadInput es el mismo
  }

  // Manejo del dropdown de perfil
  if (profileDropdownButton && profileDropdownMenu) {
    profileDropdownButton.addEventListener("click", (event) => {
      event.stopPropagation(); // Evitar que el clic se propague al documento
      profileDropdownMenu.classList.toggle("hidden");
    });
    // Cerrar dropdown si se hace clic fuera
    document.addEventListener("click", (event) => {
      if (
        profileDropdownMenu && // Verificar que existe
        !profileDropdownMenu.classList.contains("hidden") && // Solo si está visible
        !profileDropdownButton.contains(event.target) && // Si el clic no fue en el botón
        !profileDropdownMenu.contains(event.target) // Y tampoco dentro del menú
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
    console.log("Dashboard cargado y lógica inicializada.");
  }

  // Iniciar la carga de datos del dashboard
  inicializarPagina();
});
