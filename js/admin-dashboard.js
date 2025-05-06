document.addEventListener("DOMContentLoaded", () => {
  console.log("DEBUG: DOMContentLoaded event fired.");

  let localCurrentUser = currentUserData;
  let isAuthenticatedOnLoad = isAuthenticatedInHead;

  if (!isAuthenticatedOnLoad || !localCurrentUser) {
    console.error(
      "ERROR: Autenticación fallida o datos de usuario no disponibles en DOMContentLoaded. Redirigiendo."
    );
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
    return;
  }

  document.body.classList.remove("auth-pending");
  console.log("DEBUG: Usuario autenticado, inicializando script principal...");

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

  function showActionFeedback(message, type = "info", duration = 4000) {
    if (!globalFeedbackContainer) {
      console.error("Contenedor de feedback global no encontrado.");

      const container = document.createElement("div");
      container.id = "global-feedback-container";
      container.style.position = "fixed";
      container.style.bottom = "1rem";
      container.style.right = "1rem";
      container.style.zIndex = "1000";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "0.5rem";
      container.style.alignItems = "flex-end";
      document.body.appendChild(container);
      globalFeedbackContainer = container;
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

    feedbackDiv.className = `global-feedback-message ${bgColor}`;
    feedbackDiv.innerHTML = `<span class="inline-block align-middle"><i class="${iconClass}"></i></span><span class="inline-block align-middle">${message}</span>`;

    globalFeedbackContainer.appendChild(feedbackDiv);

    if (type !== "loading") {
      setTimeout(() => {
        feedbackDiv.style.opacity = "0";
        feedbackDiv.addEventListener("transitionend", () =>
          feedbackDiv.remove()
        );

        setTimeout(() => {
          if (feedbackDiv.parentNode) feedbackDiv.remove();
        }, duration + 500);
      }, duration);
    }

    return feedbackDiv;
  }

  function formatDateTimeSimple(dateTimeString) {
    if (!dateTimeString || dateTimeString === "N/A") return "N/A";
    try {
      let date = new Date(dateTimeString);
      if (isNaN(date.getTime())) {
        const parts = dateTimeString.split(/[- :T.]/);
        if (parts.length >= 6) {
          date = new Date(
            Date.UTC(
              parts[0],
              parts[1] - 1,
              parts[2],
              parts[3],
              parts[4],
              parts[5]
            )
          );
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
      return "Fecha inválida";
    }
  }
  function formatDateSimple(dateString) {
    if (!dateString || dateString === "N/A") return "N/A";
    try {
      const datePart = dateString.split("T")[0];
      const parts = datePart.split("-");
      if (parts.length !== 3) return "Formato inválido";
      const date = new Date(
        Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      );
      if (isNaN(date.getTime())) return "Fecha inválida";
      return date.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch (e) {
      return "Fecha inválida";
    }
  }
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
      return "Hora inválida";
    }
  }

  async function cargarDatosDashboard() {
    console.log("DEBUG: Cargando datos del dashboard...");
    if (countCitasHoy) countCitasHoy.textContent = "...";
    if (countVehiculos) countVehiculos.textContent = "...";
    if (countClientes) countClientes.textContent = "...";
    if (countServicios) countServicios.textContent = "...";
    if (proximasCitasList)
      proximasCitasList.innerHTML =
        '<p class="text-center text-gray-500 italic">Cargando próximas citas...</p>';

    try {
      const hoyStr = new Date().toISOString().split("T")[0];
      const proxSemana = new Date();
      proxSemana.setDate(proxSemana.getDate() + 7);
      const proxSemanaStr = proxSemana.toISOString().split("T")[0];
      let citasHoyPendientes = 0;
      const proximasCitasHtml = [];

      const citasResponse = await fetch(
        `http://localhost:3000/api/citas?fecha_inicio=${hoyStr}&fecha_fin=${proxSemanaStr}`
      );
      const citasData = await citasResponse.json();
      console.log("DEBUG: Respuesta Citas:", citasData);

      if (citasResponse.ok && citasData.success && citasData.citas) {
        citasData.citas.sort((a, b) => {
          const dateA = new Date(
            `${a.fecha_cita}T${a.hora_cita || "00:00:00"}`
          );
          const dateB = new Date(
            `${b.fecha_cita}T${b.hora_cita || "00:00:00"}`
          );
          return dateA - dateB;
        });

        citasData.citas.forEach((cita) => {
          if (cita.estado === "Pendiente") {
            const fechaCita = cita.fecha_cita.split("T")[0];
            if (fechaCita === hoyStr) {
              citasHoyPendientes++;
            }

            if (proximasCitasHtml.length < 5) {
              const nombreCliente = `${cita.nombre_cliente || ""} ${
                cita.apellido_cliente || ""
              }`.trim();
              const vehiculoDesc = `${cita.marca_vehiculo || ""} ${
                cita.modelo_vehiculo || ""
              } (${cita.placa_vehiculo || "S/P"})`;

              proximasCitasHtml.push(`
                                <div class="appointment-list-item flex justify-between items-center">
                                    <div>
                                        <p class="font-medium text-gray-800">${formatDateSimple(
                                          cita.fecha_cita
                                        )} ${formatTimeSimple(
                cita.hora_cita
              )}</p>
                                        <p class="text-xs text-gray-600">${nombreCliente} - ${vehiculoDesc}</p>
                                    </div>
                                    <a href="admin_miscitas.html" class="text-xs text-blue-600 hover:underline">Ver</a>
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
        console.error("Error al cargar citas para dashboard");
        if (countCitasHoy) countCitasHoy.textContent = "Error";
        if (proximasCitasList)
          proximasCitasList.innerHTML =
            '<p class="text-center text-red-500">Error al cargar citas.</p>';
      }

      try {
        const vehiculosResponse = await fetch(
          "http://localhost:3000/api/vehiculos/count"
        );
        const vehiculosData = await vehiculosResponse.json();
        console.log("DEBUG: Respuesta Vehiculos Count:", vehiculosData);
        if (vehiculosResponse.ok && vehiculosData.success) {
          if (countVehiculos)
            countVehiculos.textContent = vehiculosData.total ?? "0";
        } else {
          console.error("Error en respuesta de /api/vehiculos/count");
          if (countVehiculos) countVehiculos.textContent = "Error";
        }
      } catch (e) {
        console.error("Error fetching vehicle count:", e);
        if (countVehiculos) countVehiculos.textContent = "Error";
      }

      try {
        const clientesResponse = await fetch(
          "http://localhost:3000/api/clientes/count"
        );
        const clientesData = await clientesResponse.json();
        console.log("DEBUG: Respuesta Clientes Count:", clientesData);
        if (clientesResponse.ok && clientesData.success) {
          if (countClientes)
            countClientes.textContent = clientesData.total ?? "0";
        } else {
          console.error("Error en respuesta de /api/clientes/count");
          if (countClientes) countClientes.textContent = "Error";
        }
      } catch (e) {
        console.error("Error fetching client count:", e);
        if (countClientes) countClientes.textContent = "Error";
      }

      try {
        const serviciosResponse = await fetch(
          "http://localhost:3000/api/servicios?activos=true"
        );
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
          console.error("Error en respuesta de /api/servicios?activos=true");
          if (countServicios) countServicios.textContent = "Error";
        }
      } catch (e) {
        console.error("Error fetching active services count:", e);
        if (countServicios) countServicios.textContent = "Error";
      }
    } catch (error) {
      console.error("Error general cargando datos del dashboard:", error);
      if (countCitasHoy) countCitasHoy.textContent = "Error";
      if (countVehiculos) countVehiculos.textContent = "Error";
      if (countClientes) countClientes.textContent = "Error";
      if (countServicios) countServicios.textContent = "Error";
      if (proximasCitasList)
        proximasCitasList.innerHTML =
          '<p class="text-center text-red-500">Error de conexión al cargar datos.</p>';
    }
  }

  async function handleAvatarUpload(event) {
    console.log("DEBUG: Avatar file input changed.");
    const file = event.target.files[0];
    if (!file) {
      console.log("DEBUG: No file selected.");
      return;
    }

    let localCurrentUser = currentUserData;
    if (!localCurrentUser || !localCurrentUser.id) {
      console.error(
        "Error: No se pudo obtener el ID del usuario actual para subir avatar."
      );
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
      const apiUrl = `http://localhost:3000/api/users/${localCurrentUser.id}/avatar`;
      console.log(`DEBUG: Sending POST to ${apiUrl} for avatar upload.`);

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
      });

      if (loadingFeedback) loadingFeedback.remove();

      const result = await response.json();
      console.log("DEBUG: Server response (avatar upload):", result);

      if (response.ok && result.success && result.avatarUrl) {
        console.log(
          "DEBUG: Avatar uploaded successfully. New URL:",
          result.avatarUrl
        );

        if (userAvatarImg) {
          userAvatarImg.src = result.avatarUrl;
        }

        localCurrentUser.avatarUrl = result.avatarUrl;
        localStorage.setItem("userData", JSON.stringify(localCurrentUser));
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
      if (loadingFeedback) loadingFeedback.remove();
      console.error("Network error during avatar upload:", error);
      showActionFeedback("Error de conexión al subir la foto.", "error");
    } finally {
      avatarUploadInput.value = "";
      console.log("DEBUG: Avatar file input reset.");
    }
  }

  if (logoutButton)
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("userData");
      window.location.replace("login.html");
    });

  if (uploadAvatarTrigger && avatarUploadInput) {
    uploadAvatarTrigger.addEventListener("click", () => {
      console.log("DEBUG: Sidebar avatar trigger clicked.");
      avatarUploadInput.click();
    });
    avatarUploadInput.addEventListener("change", handleAvatarUpload);
  }

  if (updateProfilePicHeader && avatarUploadInput) {
    updateProfilePicHeader.addEventListener("click", (event) => {
      event.preventDefault();
      console.log("DEBUG: Header dropdown avatar trigger clicked.");
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
        !profileDropdownButton.contains(event.target) &&
        !profileDropdownMenu.contains(event.target)
      ) {
        profileDropdownMenu.classList.add("hidden");
      }
    });
  }

  function inicializarPagina() {
    cargarDatosDashboard();
    console.log("Dashboard cargado y lógica inicializada.");
  }

  inicializarPagina();
});
