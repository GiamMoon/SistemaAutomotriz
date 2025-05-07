document.addEventListener("DOMContentLoaded", () => {
  let localCurrentUser = currentUser;
  let isAuthenticatedOnLoad = isAuthenticated;

  if (!isAuthenticatedOnLoad || !localCurrentUser) {
   // console.error("Auth Error on DOMContentLoaded. Stopping script execution.");
    return;
  }

  document.body.classList.remove("auth-pending");
 // console.log("Auth valid, initializing page script...");

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
  const tablaCitasProximasBody = document.getElementById(
    "tabla-citas-proximas-body"
  );
  const tablaCitasPasadasBody = document.getElementById(
    "tabla-citas-pasadas-body"
  );
  const tablaProximas = document.getElementById("tabla-proximas");
  const tablaPasadas = document.getElementById("tabla-pasadas");
  const filtroFechaInicio = document.getElementById("filtro-fecha-inicio");
  const filtroFechaFin = document.getElementById("filtro-fecha-fin");
  const btnFiltrar = document.getElementById("btn-filtrar-citas");
  const btnLimpiar = document.getElementById("btn-limpiar-filtros");
  const actionFeedbackMessageDiv = document.getElementById(
    "action-feedback-message"
  );

  const modalOverlay = document.getElementById("modal-overlay");
  const citaDetailsModal = document.getElementById("cita-details-modal");
  const modalCloseButton = document.getElementById("modal-close-button");
  const modalCloseButtonFooter = document.getElementById(
    "modal-close-button-footer"
  );
  const modalClienteNombre = document.getElementById("modal-cliente-nombre");
  const modalClienteTelefono = document.getElementById(
    "modal-cliente-telefono"
  );
  const modalClienteEmail = document.getElementById("modal-cliente-email");
  const modalFechaHora = document.getElementById("modal-fecha-hora");
  const modalVehiculoInfo = document.getElementById("modal-vehiculo-info");
  const modalVehiculoPlaca = document.getElementById("modal-vehiculo-placa");
  const modalKilometraje = document.getElementById("modal-kilometraje");
  const modalEstado = document.getElementById("modal-estado");
  const modalServicioPrincipal = document.getElementById(
    "modal-servicio-principal"
  );
  const modalMotivoDetalle = document.getElementById("modal-motivo-detalle");
  const modalCreadoPor = document.getElementById("modal-creado-por");
  const modalFechaCreacion = document.getElementById("modal-fecha-creacion");
  const modalModificadoPor = document.getElementById("modal-modificado-por");
  const modalFechaModificacion = document.getElementById(
    "modal-fecha-modificacion"
  );

  const modalEditOverlay = document.getElementById("modal-edit-overlay");
  const citaEditModal = document.getElementById("cita-edit-modal");
  const editCitaForm = document.getElementById("edit-cita-form");
  const modalEditCloseButton = document.getElementById(
    "modal-edit-close-button"
  );
  const modalEditCancelButton = document.getElementById(
    "modal-edit-cancel-button"
  );
  const modalEditSaveButton = document.getElementById("modal-edit-save-button");
  const editFeedbackMessageDiv = document.getElementById(
    "edit-feedback-message"
  );
  const editCitaIdInput = document.getElementById("edit-cita-id");
  const editClienteInfo = document.getElementById("edit-cliente-info");
  const editTelefonoInfo = document.getElementById("edit-telefono-info");
  const editVehiculoInfo = document.getElementById("edit-vehiculo-info");
  const editPlacaInfo = document.getElementById("edit-placa-info");
  const editFechaCitaInput = document.getElementById("edit-fecha-cita");
  const editHoraCitaInput = document.getElementById("edit-hora-cita");
  const editKilometrajeInput = document.getElementById("edit-kilometraje");
  const editSelectServicio = document.getElementById("edit-select-servicio");
  const editDetalleSintomasTextarea = document.getElementById(
    "edit-detalle-sintomas"
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let serviciosCache = {};
  let todasLasCitas = [];
  let citasProximasData = [];
  let citasPasadasData = [];
  let sortState = {
    "tabla-proximas": { key: null, direction: "none" },
    "tabla-pasadas": { key: null, direction: "none" },
  };

  if (userNameDisplay)
    userNameDisplay.textContent =
      localCurrentUser.nombre || localCurrentUser.username;
  if (userRoleDisplay)
    userRoleDisplay.textContent = localCurrentUser.rol || "Usuario";
  if (profileNameDisplay)
    profileNameDisplay.textContent =
      localCurrentUser.nombre || localCurrentUser.username;
  if (userAvatarImg && localCurrentUser.avatarUrl) {
    userAvatarImg.src = localCurrentUser.avatarUrl;
  } else if (userAvatarImg) {
    //console.log("No avatarUrl found, using default placeholder.");
  }

  function showActionFeedback(message, type = "info") {
    const feedbackDiv = actionFeedbackMessageDiv;
    if (!feedbackDiv) return;
    let bgColor, iconClass;
    switch (type) {
      case "success":
        bgColor = "feedback-success";
        iconClass = "fas fa-check-circle";
        break;
      case "error":
        bgColor = "feedback-error";
        iconClass = "fas fa-exclamation-triangle";
        break;
      case "loading":
        bgColor = "feedback-loading";
        iconClass = "fas fa-spinner fa-spin";
        break;
      default:
        bgColor = "bg-gray-100 border border-gray-300 text-gray-800";
        iconClass = "fas fa-info-circle";
        break;
    }
    feedbackDiv.className = `feedback-message ${bgColor} flex items-center justify-center`;
    feedbackDiv.innerHTML = `<i class="${iconClass} mr-2"></i> ${message}`;
    feedbackDiv.style.display = "flex";

    if (type !== "loading") {
      setTimeout(() => {
        if (feedbackDiv) feedbackDiv.style.display = "none";
        feedbackDiv.innerHTML = "";
      }, 4000);
    }
  }

  function showEditFeedback(message, type = "info") {
    const feedbackDiv = editFeedbackMessageDiv;
    if (!feedbackDiv) return;

    if (type === "clear") {
      feedbackDiv.style.display = "none";
      feedbackDiv.innerHTML = "";
      return;
    }
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
    feedbackDiv.className = `px-4 py-3 rounded relative text-sm ${bgColor}`;
    feedbackDiv.innerHTML = `<span class="inline-block align-middle mr-2"><i class="${iconClass}"></i></span><span class="inline-block align-middle">${message}</span>`;
    feedbackDiv.style.display = "block";

    if (type !== "loading") {
      setTimeout(() => {
        if (feedbackDiv) feedbackDiv.style.display = "none";
        feedbackDiv.innerHTML = "";
      }, 4000);
    }
  }

  function clearModalValidationErrors() {
    if (editCitaForm) {
      editCitaForm
        .querySelectorAll(".is-invalid")
        .forEach((el) => el.classList.remove("is-invalid", "border-red-500"));

      editCitaForm
        .querySelectorAll(".error-message")
        .forEach((el) => el.classList.add("hidden"));
    }
  }

  
  function formatDateTime(dateTimeString) {
    if (!dateTimeString || dateTimeString === "N/A") {
      return "N/A";
    }

    //console.log("[formatDateTime] 1. Original dateTimeString:", dateTimeString, "(Tipo:", typeof dateTimeString, ")");

    try {
      let dateInput = String(dateTimeString);

      
      
      if (dateInput.includes(' ') && !dateInput.includes('T')) {
        dateInput = dateInput.replace(' ', 'T');
       // console.log("[formatDateTime] 2. Replaced space with T:", dateInput);
      }

      
      
      const hasTimeZoneSpecifier = /Z|[+-]\d{2}(:?\d{2})?$/.test(dateInput);

      if (!hasTimeZoneSpecifier && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateInput)) {
        
        dateInput += 'Z';
       // console.log("[formatDateTime] 3. Assumed UTC, appended 'Z':", dateInput);
      } else if (hasTimeZoneSpecifier) {
        //console.log("[formatDateTime] 3. Input string already has a time zone specifier:", dateInput);
      } else {
        //console.warn("[formatDateTime] 3. Input string format is not a recognized ISO-like format or already has TZ. Proceeding as is:", dateInput);
      }

      let date = new Date(dateInput);
      //console.log("[formatDateTime] 4. Parsed Date object (before offset - toISOString):", date.toISOString());

      if (isNaN(date.getTime())) {
        //console.error("[formatDateTime] 6. Invalid Date after parsing:", dateInput);
        return "Fecha inválida";
      }



      const options = {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        
        hour12: true,
        timeZone: 'America/Lima' 
      };
      const formattedDate = date.toLocaleString("es-PE", options);
      //console.log("[formatDateTime] 7. Formatted Date (America/Lima):", formattedDate);
      return formattedDate;

    } catch (e) {
      //console.error("[formatDateTime] Error crítico formateando fecha/hora:", dateTimeString, e);
      return "Fecha inválida";
    }
  }
  
  function formatDate(dateString) {
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
     // console.error("Error formateando fecha:", dateString, e);
      return "Fecha inválida";
    }
  }

  function formatTime(timeString) {
    if (!timeString || timeString === "N/A") return "";
    try {
      const timeParts = timeString.split(":");
      if (timeParts.length >= 2) {
        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const tempDate = new Date();
          tempDate.setUTCHours(hours, minutes, 0, 0);
          return tempDate.toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "UTC",
          });
        }
      }
      return "Hora inválida";
    } catch (e) {
     // console.error("Error formateando hora:", timeString, e);
      return "Hora inválida";
    }
  }

  async function cargarServicios() {
    if (Object.keys(serviciosCache).length > 0) {
      //console.log("Servicios ya en caché.");
      populateEditServiceSelect();
      return;
    }
  //  console.log("Fetching services from API...");
    try {
      const response = await fetch("/api/servicios"); 
      const data = await response.json();
      if (response.ok && data.success && data.servicios) {
        serviciosCache = data.servicios.reduce((acc, servicio) => {
          acc[servicio.id_servicio] = {
            id: servicio.id_servicio,
            nombre: servicio.nombre_servicio,
            activo: !!servicio.activo,
          };
          return acc;
        }, {});
      //  console.log("Servicios cargados en caché:", serviciosCache);
        populateEditServiceSelect();
      } else {
       // console.error("Error loading services from API:", data.message);
        serviciosCache = {};
      }
    } catch (error) {
     // console.error("Network error loading services:", error);
      serviciosCache = {};
    }
  }

  function getNombreServicio(servicioIdInput) {
    if (servicioIdInput === null || typeof servicioIdInput === "undefined") {
      // console.log(
      //   "DEBUG getNombreServicio: Input es null/undefined, devolviendo N/A"
      // );
      return "N/A";
    }

    const inputStr = String(servicioIdInput);

    if (inputStr === "otros") {
     // console.log("DEBUG getNombreServicio: Input es 'otros'");
      return "Otros servicios / Diagnóstico";
    }

    let servicioId = null;

    const match = inputStr.match(/(\d+)$/);
    if (match && match[1]) {
      servicioId = match[1];
      // console.log(
      //   `DEBUG getNombreServicio: ID extraído del string '${inputStr}': ${servicioId}`
      // );
    } else {
      const potentialId = parseInt(inputStr, 10);
      if (!isNaN(potentialId)) {
        servicioId = String(potentialId);
        // console.log(
        //   `DEBUG getNombreServicio: Input '${inputStr}' parece ser ID numérico: ${servicioId}`
        // );
      } else {
        // console.log(
        //   `DEBUG getNombreServicio: No se pudo extraer/parsear ID numérico de '${inputStr}'`
        // );
      }
    }

    if (servicioId !== null) {
      const servicio = serviciosCache[servicioId];
      // console.log(
      //   `DEBUG getNombreServicio: Buscando ID '${servicioId}' en caché. Encontrado:`,
      //   servicio
      // );

      if (
        servicio &&
        typeof servicio === "object" &&
        typeof servicio.nombre === "string"
      ) {
        // console.log(
        //   `DEBUG getNombreServicio: Devolviendo nombre de caché: ${servicio.nombre}`
        // );
        return servicio.nombre;
      } else {
        // console.warn(
        //   `Servicio con ID '${servicioId}' no encontrado o inválido en caché.`
        // );
        return `Servicio (ID: ${servicioId})`;
      }
    }

    // console.warn(
    //   `Nombre de servicio no encontrado y no se pudo extraer ID de: ${servicioIdInput}. Devolviendo input original.`
    // );
    return inputStr;
  }

  function populateEditServiceSelect() {
    if (!editSelectServicio) return;
    const currentValue = editSelectServicio.value;
    editSelectServicio.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Seleccionar --";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    editSelectServicio.appendChild(defaultOption);

    //console.log("Poblando select con servicios activos:", serviciosCache);
    for (const id in serviciosCache) {
      const servicio = serviciosCache[id];
      if (servicio && servicio.activo) {
        const option = document.createElement("option");
        option.value = String(servicio.id);
        option.textContent = servicio.nombre;
        editSelectServicio.appendChild(option);
      }
    }

    const otrosOption = document.createElement("option");
    otrosOption.value = "otros";
    otrosOption.textContent = "Otros servicios / Diagnóstico";
    editSelectServicio.appendChild(otrosOption);

    if (
      editSelectServicio.querySelector(
        `option[value="${String(currentValue)}"]`
      )
    ) {
      editSelectServicio.value = String(currentValue);
    } else {
      editSelectServicio.value = "";
    }
   // console.log("Select poblado. Valor actual:", editSelectServicio.value);
  }

  function renderizarTabla(tbodyElement, citasData, tablaId) {
    tbodyElement.innerHTML = "";

    if (!citasData || citasData.length === 0) {
      const mensaje =
        tablaId === "tabla-proximas" ? "próximas" : "en el historial";
      tbodyElement.innerHTML = `<tr><td colspan="8" class="py-4 px-4 text-center text-gray-500">No hay citas ${mensaje} para mostrar.</td></tr>`;
      return;
    }

    citasData.forEach((cita) => {
      const tr = document.createElement("tr");
      tr.dataset.citaData = JSON.stringify(cita);

      let fechaCitaDate = null;
      let fechaFormateada = "Fecha inválida";
      let horaFormateada = "";
      let fechaHoraValue = "";
      let fechaCreacionValue = "";
      let fechaModifValue = "";

      if (cita.fecha_cita) {
        try {
          const fechaISO = cita.fecha_cita.split("T")[0];
          const hora = cita.hora_cita
            ? cita.hora_cita.substring(0, 5)
            : "00:00";

          fechaHoraValue = `${fechaISO}T${hora}:00Z`;
          const fechaParts = fechaISO.split("-");
          if (fechaParts.length === 3) {
            fechaCitaDate = new Date(
              Date.UTC(
                parseInt(fechaParts[0]),
                parseInt(fechaParts[1]) - 1,
                parseInt(fechaParts[2])
              )
            );
            if (!isNaN(fechaCitaDate.getTime())) {
              fechaFormateada = formatDate(fechaISO);
              horaFormateada = formatTime(cita.hora_cita);
            } else {
              fechaCitaDate = null;
              fechaHoraValue = "";
            }
          } else {
            fechaCitaDate = null;
            fechaHoraValue = "";
          }
        } catch (e) {
          fechaCitaDate = null;
          fechaHoraValue = "";
        }
      }

      if (cita.fecha_creacion) {
        try {
          fechaCreacionValue = new Date(cita.fecha_creacion).toISOString();
        } catch {
          fechaCreacionValue = "";
        }
      }
      if (cita.fecha_modificacion) {
        try {
          fechaModifValue = new Date(cita.fecha_modificacion).toISOString();
        } catch {
          fechaModifValue = "";
        }
      }

      const nombreClienteCompleto = `${cita.nombre_cliente || ""} ${
        cita.apellido_cliente || ""
      }`.trim();
      const vehiculoInfo = `${cita.marca_vehiculo || ""} ${
        cita.modelo_vehiculo || ""
      } (${cita.ano_vehiculo || "S/A"})`;
      const placaVehiculo = cita.placa_vehiculo || "S/P";
      const vehiculoCompleto = `${vehiculoInfo} (${placaVehiculo})`;
      const nombreServicioMostrado = getNombreServicio(
        cita.servicio_id || cita.servicio_principal
      );
      const servicioParaOrdenar =
        nombreServicioMostrado || cita.motivo_detalle || "";
      const estadoCita = cita.estado || "Pendiente";
      const esModificable = estadoCita === "Pendiente";
      const fechaCreacionFmt = formatDateTime(cita.fecha_creacion);
      const fechaModifFmt = formatDateTime(cita.fecha_modificacion);

      let botonesAccion = `<button class="action-button btn-view" title="Ver Detalles" data-id="${cita.id_cita}"><i class="fas fa-eye"></i></button>`;
      if (esModificable) {
        botonesAccion += `<button class="action-button btn-edit" title="Editar Cita" data-id="${cita.id_cita}"><i class="fas fa-pencil-alt"></i></button>`;
        botonesAccion += `<button class="action-button btn-complete" title="Marcar como Completada" data-id="${cita.id_cita}" data-cliente-nombre="${nombreClienteCompleto}"><i class="fas fa-check-circle"></i></button>`;
        botonesAccion += `<button class="action-button btn-cancel" title="Cancelar Cita" data-id="${cita.id_cita}" data-cliente-nombre="${nombreClienteCompleto}"><i class="fas fa-times-circle"></i></button>`;
      }

      tr.innerHTML = `
                <td class="py-3 px-4" data-value="${fechaHoraValue}"><div>${fechaFormateada}</div><div class="text-xs text-gray-500">${horaFormateada}</div></td>
                <td class="py-3 px-4" data-value="${
                  nombreClienteCompleto || ""
                }">${nombreClienteCompleto || "N/A"}</td>
                <td class="py-3 px-4" data-value="${vehiculoCompleto}"><div>${vehiculoInfo}</div><div class="text-xs text-gray-500">(${placaVehiculo})</div></td>
                <td class="py-3 px-4" data-value="${servicioParaOrdenar}">${
        nombreServicioMostrado || cita.motivo_detalle || "N/A"
      }</td>
                <td class="py-3 px-4" data-value="${estadoCita}"><span class="status-badge status-${estadoCita.replace(
        /\s+/g,
        "-"
      )}">${estadoCita}</span></td>
                <td class="py-3 px-4 audit-info" data-value="${fechaCreacionValue}"><div>${
        cita.creado_por_username || "N/A"
      }</div><div>${fechaCreacionFmt}</div></td>
                <td class="py-3 px-4 audit-info" data-value="${fechaModifValue}"><div>${
        cita.modificado_por_username || "---"
      }</div><div>${fechaModifFmt}</div></td>
                <td class="py-3 px-4 text-right whitespace-nowrap">${botonesAccion}</td>`;

      tbodyElement.appendChild(tr);
    });
  }

   
   async function cargarYMostrarCitas(fechaInicio = "", fechaFin = "") {
    await cargarServicios(); 
    if (!tablaCitasProximasBody || !tablaCitasPasadasBody) return;

    const loadingHtml = '<tr><td colspan="8" class="py-4 px-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Cargando citas...</td></tr>';
    tablaCitasProximasBody.innerHTML = loadingHtml;
    tablaCitasPasadasBody.innerHTML = loadingHtml;

    todasLasCitas = []; citasProximasData = []; citasPasadasData = [];
    sortState["tabla-proximas"] = { key: null, direction: "none" };
    sortState["tabla-pasadas"] = { key: null, direction: "none" };
    updateSortIcons(tablaProximas); updateSortIcons(tablaPasadas);

    
    const todayComp = new Date();
    const todayYear = todayComp.getFullYear();
    const todayMonth = todayComp.getMonth(); 
    const todayDay = todayComp.getDate();

    let apiUrl = "/api/citas";
    const params = new URLSearchParams();
    if (fechaInicio) params.append("fecha_inicio", fechaInicio);
    if (fechaFin) params.append("fecha_fin", fechaFin);
    const queryString = params.toString();
    if (queryString) apiUrl += `?${queryString}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (response.ok && data.success && data.citas) {
        todasLasCitas = data.citas;
        todasLasCitas.forEach((cita) => {
          let isTodayOrFuture = false;
          let fechaCitaValida = false;

          if (cita.fecha_cita) {
            try {
              const fechaISO = cita.fecha_cita.split("T")[0]; 
              const fechaParts = fechaISO.split("-");
              if (fechaParts.length === 3) {
                const citaYear = parseInt(fechaParts[0], 10);
                const citaMonth = parseInt(fechaParts[1], 10) - 1; 
                const citaDay = parseInt(fechaParts[2], 10);

                
                if (!isNaN(citaYear) && !isNaN(citaMonth) && !isNaN(citaDay)) {
                    fechaCitaValida = true;
                    if (citaYear > todayYear) {
                        isTodayOrFuture = true;
                    } else if (citaYear === todayYear) {
                        if (citaMonth > todayMonth) {
                            isTodayOrFuture = true;
                        } else if (citaMonth === todayMonth) {
                            if (citaDay >= todayDay) {
                                isTodayOrFuture = true;
                            }
                        }
                    }
                    
                }
              }
            } catch (e) {
            //  console.error("Error parsing cita.fecha_cita for comparison:", cita.fecha_cita, e);
              fechaCitaValida = false;
            }
          }
          const estadoCita = cita.estado || "Pendiente";

          
          if (estadoCita === "Pendiente" && fechaCitaValida && isTodayOrFuture) {
            citasProximasData.push(cita);
          } else {
            citasPasadasData.push(cita);
          }
        });
        renderizarTabla(tablaCitasProximasBody, citasProximasData, "tabla-proximas");
        renderizarTabla(tablaCitasPasadasBody, citasPasadasData, "tabla-pasadas");
      } else {
      //  console.error("Error fetching appointments:", data.message);
        const errorMsg = '<tr><td colspan="8" class="py-4 px-4 text-center text-red-500">Error al cargar citas.</td></tr>';
        tablaCitasProximasBody.innerHTML = errorMsg; tablaCitasPasadasBody.innerHTML = errorMsg;
      }
    } catch (error) {
    //  console.error("Network error fetching appointments:", error);
      const errorMsg = '<tr><td colspan="8" class="py-4 px-4 text-center text-red-500">Error de red al cargar citas.</td></tr>';
      tablaCitasProximasBody.innerHTML = errorMsg; tablaCitasPasadasBody.innerHTML = errorMsg;
    }
  }

  async function cancelarCita(citaId, nombreCliente) {
    if (
      !confirm(
        `¿Está seguro que desea CANCELAR la cita de ${nombreCliente}? Esta acción no se puede deshacer.`
      )
    )
      return;
    showActionFeedback("Cancelando cita...", "loading");
    try {
      const payload = { userId: localCurrentUser?.id };
      const response = await fetch(
        `/api/citas/${citaId}/cancelar`, 
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (response.ok && result.success) {
        showActionFeedback(
          result.message || "Cita cancelada correctamente.",
          "success"
        );
        cargarYMostrarCitas(filtroFechaInicio.value, filtroFechaFin.value);
      } else {
        showActionFeedback(
          result.message || "Error al cancelar la cita.",
          "error"
        );
      }
    } catch (error) {
     // console.error("Error de red al cancelar cita:", error);
      showActionFeedback("Error de conexión al intentar cancelar.", "error");
    }
  }

  async function completarCita(citaId, nombreCliente) {
    if (!confirm(`¿Marcar como COMPLETADA la cita de ${nombreCliente}?`))
      return;
    showActionFeedback("Marcando cita como completada...", "loading");
    try {
      const payload = { userId: localCurrentUser?.id };
      const response = await fetch(
        `/api/citas/${citaId}/completar`, 
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (response.ok && result.success) {
        showActionFeedback(
          result.message || "Cita completada correctamente.",
          "success"
        );
        cargarYMostrarCitas(filtroFechaInicio.value, filtroFechaFin.value);
      } else {
        showActionFeedback(
          result.message || "Error al marcar la cita como completada.",
          "error"
        );
      }
    } catch (error) {
      // console.error("Error de red al completar cita:", error);
      // showActionFeedback(
      //   "Error de conexión al intentar completar la cita.",
      //   "error"
      // );
    }
  }

  function mostrarDetallesCita(citaId) {
  //  console.log(`DEBUG: Intentando mostrar detalles para cita ID: ${citaId}`);

    const citaSeleccionada = todasLasCitas.find((c) => c.id_cita == citaId);
    if (!citaSeleccionada) {
      // console.error(
      //   "DEBUG: Cita no encontrada en caché para detalles:",
      //   citaId
      // );
      showActionFeedback(
        "Error: No se pudieron cargar los detalles de la cita.",
        "error"
      );
      return;
    }
    //console.log("DEBUG: Datos encontrados para detalles:", citaSeleccionada);

    let fechaFormateadaModal = formatDate(citaSeleccionada.fecha_cita);
    let horaFormateadaModal = formatTime(citaSeleccionada.hora_cita);
    const fechaCreacionFmtModal = formatDateTime(
      citaSeleccionada.fecha_creacion
    );
    const fechaModifFmtModal = formatDateTime(
      citaSeleccionada.fecha_modificacion
    );

    modalClienteNombre.textContent =
      `${citaSeleccionada.nombre_cliente || ""} ${
        citaSeleccionada.apellido_cliente || ""
      }`.trim() || "N/A";
    modalClienteTelefono.textContent =
      citaSeleccionada.telefono_cliente || "N/A";
    modalClienteEmail.textContent = citaSeleccionada.email_cliente || "N/A";
    modalFechaHora.textContent =
      `${fechaFormateadaModal} ${horaFormateadaModal}`.trim() || "N/A";
    modalVehiculoInfo.textContent = `${citaSeleccionada.marca_vehiculo || ""} ${
      citaSeleccionada.modelo_vehiculo || ""
    } (${citaSeleccionada.ano_vehiculo || "S/A"})`;
    modalVehiculoPlaca.textContent = citaSeleccionada.placa_vehiculo || "S/P";
    modalKilometraje.textContent =
      citaSeleccionada.kilometraje !== null
        ? citaSeleccionada.kilometraje
        : "N/A";
    modalEstado.textContent = citaSeleccionada.estado || "Pendiente";
    modalEstado.className = `status-badge status-${(
      citaSeleccionada.estado || "Pendiente"
    ).replace(/\s+/g, "-")}`;
    modalServicioPrincipal.textContent = getNombreServicio(
      citaSeleccionada.servicio_id || citaSeleccionada.servicio_principal
    );
    modalMotivoDetalle.textContent =
      citaSeleccionada.motivo_detalle || "(Ninguno)";

    if (modalCreadoPor)
      modalCreadoPor.textContent =
        citaSeleccionada.creado_por_username || "Sistema/Desconocido";
    if (modalFechaCreacion)
      modalFechaCreacion.textContent = fechaCreacionFmtModal;
    if (modalModificadoPor)
      modalModificadoPor.textContent =
        citaSeleccionada.modificado_por_username || "---";
    if (modalFechaModificacion)
      modalFechaModificacion.textContent = fechaModifFmtModal;

    if (modalOverlay) modalOverlay.classList.remove("hidden");
    if (citaDetailsModal) citaDetailsModal.classList.remove("hidden");
   // console.log("DEBUG: Modal de detalles mostrado.");
  }

  function cerrarModalDetalles() {
    if (modalOverlay) modalOverlay.classList.add("hidden");
    if (citaDetailsModal) citaDetailsModal.classList.add("hidden");
  }

  async function abrirModalEdicion(citaId) {
    // console.log(
    //   `DEBUG: Intentando abrir modal de edición para cita ID: ${citaId}`
    // );
    showEditFeedback("Cargando datos de la cita...", "loading");
    await cargarServicios();

    try {
      let cita = todasLasCitas.find((c) => c.id_cita == citaId);

      if (!cita) {
       // console.warn("Cita no encontrada en caché local, buscando en API...");
        const response = await fetch(
          `/api/citas/${citaId}` 
        );
        const result = await response.json();
        if (response.ok && result.success && result.cita) {
          cita = result.cita;
        } else {
          throw new Error(
            result.message || "No se pudo obtener la cita de la API para editar"
          );
        }
      }

     // console.log("DEBUG: Datos para editar cargados:", cita);

      editCitaIdInput.value = cita.id_cita;

      editClienteInfo.textContent =
        `${cita.nombre_cliente || ""} ${cita.apellido_cliente || ""}`.trim() ||
        "N/A";
      editTelefonoInfo.textContent = cita.telefono_cliente || "N/A";
      editVehiculoInfo.textContent = `${cita.marca_vehiculo || ""} ${
        cita.modelo_vehiculo || ""
      } (${cita.ano_vehiculo || "S/A"})`;
      editPlacaInfo.textContent = cita.placa_vehiculo || "S/P";

      try {
        editFechaCitaInput.value = cita.fecha_cita.split("T")[0];
      } catch {
        editFechaCitaInput.value = "";
      }
      editHoraCitaInput.value = cita.hora_cita
        ? cita.hora_cita.substring(0, 5)
        : "";
      editKilometrajeInput.value = cita.kilometraje || "";
      editDetalleSintomasTextarea.value = cita.motivo_detalle || "";

      let servicioIdActual = String(
        cita.servicio_id || cita.servicio_principal || ""
      );
      let servicioSeleccionado = false;

      if (servicioIdActual === "otros") {
        if (editSelectServicio.querySelector('option[value="otros"]')) {
          editSelectServicio.value = "otros";
          servicioSeleccionado = true;
        //  console.log("DEBUG: Preseleccionado 'Otros servicios'");
        }
      } else if (
        servicioIdActual &&
        servicioIdActual !== "null" &&
        servicioIdActual !== ""
      ) {
        const optionElement = editSelectServicio.querySelector(
          `option[value="${servicioIdActual}"]`
        );
        if (optionElement) {
          editSelectServicio.value = servicioIdActual;
          servicioSeleccionado = true;
          // console.log(
          //   `DEBUG: Preseleccionado servicio activo ID: ${servicioIdActual}`
          // );
        } else {
          // console.log(
          //   `DEBUG: El servicio actual (ID: ${servicioIdActual}) está inactivo o no existe en el select, no se preselecciona.`
          // );
        }
      }

      if (!servicioSeleccionado) {
        editSelectServicio.value = "";
        // console.log(
        //   "DEBUG: No se preseleccionó ningún servicio (o no aplica/está inactivo). Se deja '-- Seleccionar --'."
        // );
      }

      clearModalValidationErrors();
      editFeedbackMessageDiv.style.display = "none";
      if (modalEditOverlay) modalEditOverlay.classList.remove("hidden");
      if (citaEditModal) citaEditModal.classList.remove("hidden");
      //console.log("DEBUG: Modal de edición abierto y rellenado.");
    } catch (error) {
      // console.error("DEBUG: Error al obtener detalles para editar:", error);
      // showActionFeedback(
      //   error.message || "Error al cargar datos para editar.",
      //   "error"
      // );
      showEditFeedback("Error al cargar los datos de la cita.", "error");
    }
  }

  function cerrarModalEdicion() {
    if (modalEditOverlay) modalEditOverlay.classList.add("hidden");
    if (citaEditModal) citaEditModal.classList.add("hidden");
    if (editCitaForm) editCitaForm.reset();
    clearModalValidationErrors();
    editFeedbackMessageDiv.style.display = "none";
    editFeedbackMessageDiv.innerHTML = "";
    if (modalEditSaveButton) modalEditSaveButton.disabled = false;
  }

  function getSortValueFromCita(cita, sortKey) {
    try {
      switch (sortKey) {
        case "fecha":
          const fechaISO = cita.fecha_cita ? cita.fecha_cita.split("T")[0] : "";
          const hora = cita.hora_cita
            ? cita.hora_cita.substring(0, 5)
            : "00:00";
          const fechaHoraValue = fechaISO ? `${fechaISO}T${hora}:00Z` : "";
          return fechaHoraValue ? new Date(fechaHoraValue).getTime() : 0;
        case "cliente":
          return `${cita.nombre_cliente || ""} ${cita.apellido_cliente || ""}`
            .trim()
            .toLowerCase();
        case "vehiculo":
          const vehiculoInfo = `${cita.marca_vehiculo || ""} ${
            cita.modelo_vehiculo || ""
          } (${cita.ano_vehiculo || "S/A"})`;
          const placaVehiculo = cita.placa_vehiculo || "S/P";
          return `${vehiculoInfo} (${placaVehiculo})`.toLowerCase();
        case "servicio":
          const nombreServicio = getNombreServicio(
            cita.servicio_id || cita.servicio_principal
          );
          return (nombreServicio || cita.motivo_detalle || "").toLowerCase();
        case "estado":
          return (cita.estado || "Pendiente").toLowerCase();
        case "creado":
          return cita.fecha_creacion
            ? new Date(cita.fecha_creacion).getTime()
            : 0;
        case "modificado":
          return cita.fecha_modificacion
            ? new Date(cita.fecha_modificacion).getTime()
            : 0;
        default:
          return "";
      }
    } catch (e) {
      // console.error(
      //   `Error getting sort value for key ${sortKey} from cita:`,
      //   cita,
      //   e
      // );
      return "";
    }
  }

  function sortTable(tableElement, sortKey) {
    const tbody = tableElement.querySelector("tbody");
    const tableId = tableElement.id;
    if (!tbody) return;

    let dataToSort =
      tableId === "tabla-proximas" ? citasProximasData : citasPasadasData;
    if (!dataToSort || dataToSort.length <= 1) return;

    let currentDirection = sortState[tableId].direction;
    let newDirection;
    if (sortState[tableId].key === sortKey) {
      newDirection = currentDirection === "asc" ? "desc" : "asc";
    } else {
      newDirection = "asc";
    }

    sortState[tableId] = { key: sortKey, direction: newDirection };

    dataToSort.sort((a, b) => {
      const valA = getSortValueFromCita(a, sortKey);
      const valB = getSortValueFromCita(b, sortKey);
      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return newDirection === "desc" ? comparison * -1 : comparison;
    });

    renderizarTabla(tbody, dataToSort, tableId);
    updateSortIcons(tableElement);
  }

  function updateSortIcons(tableElement) {
    if (!tableElement) return;
    const tableId = tableElement.id;
    const headers = tableElement.querySelectorAll("thead th.sortable-header");

    headers.forEach((th) => {
      const key = th.dataset.sortKey;
      const iconSpan = th.querySelector(".sort-icon i");
      if (!iconSpan) return;

      th.classList.remove("sort-asc", "sort-desc");
      iconSpan.className = "fas fa-sort";

      if (sortState[tableId] && sortState[tableId].key === key) {
        if (sortState[tableId].direction === "asc") {
          th.classList.add("sort-asc");
          iconSpan.className = "fas fa-sort-up";
        } else if (sortState[tableId].direction === "desc") {
          th.classList.add("sort-desc");
          iconSpan.className = "fas fa-sort-down";
        }
      }
    });
  }

  async function handleAvatarUpload(event) {
   // console.log("DEBUG: Avatar file input changed.");
    const file = event.target.files[0];
    if (!file) {
    //  console.log("DEBUG: No file selected.");
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

    showActionFeedback("Subiendo nueva foto...", "loading");
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const apiUrl = `/api/users/${localCurrentUser.id}/avatar`; 
     // console.log(`DEBUG: Sending POST to ${apiUrl} for avatar upload.`);
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        
      });
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
        showActionFeedback("Foto de perfil actualizada.", "success");

        localCurrentUser.avatarUrl = result.avatarUrl;
        localStorage.setItem("userData", JSON.stringify(localCurrentUser));
        // console.log(
        //   "DEBUG: User data updated in localStorage with new avatarUrl."
        // );
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
     // console.error("Network error during avatar upload:", error);
      showActionFeedback("Error de conexión al subir la foto.", "error");
    } finally {
      avatarUploadInput.value = "";
     // console.log("DEBUG: Avatar file input reset.");
    }
  }

  if (logoutButton)
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("userData");
      window.location.replace("login.html");
    });

  if (btnFiltrar)
    btnFiltrar.addEventListener("click", () =>
      cargarYMostrarCitas(filtroFechaInicio.value, filtroFechaFin.value)
    );
  if (btnLimpiar)
    btnLimpiar.addEventListener("click", () => {
      filtroFechaInicio.value = "";
      filtroFechaFin.value = "";
      cargarYMostrarCitas();
    });

  if (tablaCitasProximasBody)
    tablaCitasProximasBody.addEventListener("click", handleTableActions);
  if (tablaCitasPasadasBody)
    tablaCitasPasadasBody.addEventListener("click", handleTableActions);

  if (modalCloseButton)
    modalCloseButton.addEventListener("click", cerrarModalDetalles);
  if (modalCloseButtonFooter)
    modalCloseButtonFooter.addEventListener("click", cerrarModalDetalles);
  if (modalOverlay) modalOverlay.addEventListener("click", cerrarModalDetalles);

  if (modalEditCloseButton)
    modalEditCloseButton.addEventListener("click", cerrarModalEdicion);
  if (modalEditCancelButton)
    modalEditCancelButton.addEventListener("click", cerrarModalEdicion);
  if (modalEditOverlay)
    modalEditOverlay.addEventListener("click", cerrarModalEdicion);

  if (editCitaForm)
    editCitaForm.addEventListener("submit", handleEditFormSubmit);

  document.querySelectorAll(".sortable-header").forEach((header) => {
    header.addEventListener("click", () => {
      const sortKey = header.dataset.sortKey;
      const tableElement = header.closest("table");
      if (tableElement && sortKey) sortTable(tableElement, sortKey);
    });
  });

  if (uploadAvatarTrigger && avatarUploadInput) {
    uploadAvatarTrigger.addEventListener("click", () =>
      avatarUploadInput.click()
    );
    avatarUploadInput.addEventListener("change", handleAvatarUpload);
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

    if (updateProfilePicHeader && avatarUploadInput) {
      updateProfilePicHeader.addEventListener("click", (event) => {
        event.preventDefault();
        avatarUploadInput.click();
        profileDropdownMenu.classList.add("hidden");
      });
    }
  }

  function handleTableActions(event) {
   // console.log("DEBUG: Clic en tabla citas detectado.");
    const targetButton = event.target.closest("button.action-button");

    if (!targetButton) {
     // console.log("DEBUG: Clic no fue en un botón de acción.");
      return;
    }

    const citaId = targetButton.dataset.id;
    if (!citaId) {
     // console.error("DEBUG: Botón sin data-id clickeado.");
      return;
    }

    const nombreCliente = targetButton.dataset.clienteNombre || "este cliente";
   // console.log(`DEBUG: Botón de acción clickeado para Cita ID: ${citaId}`);

    if (targetButton.classList.contains("btn-view")) {
    //  console.log("DEBUG: Botón Ver presionado.");
      mostrarDetallesCita(citaId);
    } else if (targetButton.classList.contains("btn-edit")) {
    //  console.log("DEBUG: Botón Editar presionado.");
      abrirModalEdicion(citaId);
    } else if (targetButton.classList.contains("btn-complete")) {
    //  console.log("DEBUG: Botón Completar presionado.");
      completarCita(citaId, nombreCliente);
    } else if (targetButton.classList.contains("btn-cancel")) {
     // console.log("DEBUG: Botón Cancelar presionado.");
      cancelarCita(citaId, nombreCliente);
    } else {
      // console.log(
      //   "DEBUG: Botón clickeado no reconocido:",
      //   targetButton.classList
      // );
    }
  }

  async function handleEditFormSubmit(event) {
   // console.log("DEBUG: Submit event capturado en editCitaForm!");
    event.preventDefault();
    clearModalValidationErrors();
    showEditFeedback("", "clear");
  //  console.log("DEBUG: Validando formulario de edición...");

    let formValid = true;
    editCitaForm
      .querySelectorAll('[required]:not([type="hidden"])')
      .forEach((field) => {
        if (!field.value.trim()) {
          field.classList.add("is-invalid", "border-red-500");
          const errorSpan = field
            .closest("div")
            .querySelector(".error-message");
          if (errorSpan) errorSpan.classList.remove("hidden");
          formValid = false;
          // console.log(
          //   `DEBUG: Edición - Validación fallida: ${field.id || field.name}`
          // );
        } else {
          field.classList.remove("is-invalid", "border-red-500");
          const errorSpan = field
            .closest("div")
            .querySelector(".error-message");
          if (errorSpan) errorSpan.classList.add("hidden");
        }
      });

    if (!formValid) {
      showEditFeedback(
        "Por favor, complete todos los campos requeridos.",
        "error"
      );
      //console.log("DEBUG: Edición - Formulario NO válido.");
      return;
    }

   // console.log("DEBUG: Edición - Formulario VÁLIDO.");
    modalEditSaveButton.disabled = true;
    showEditFeedback("Guardando cambios...", "loading");

    const citaId = editCitaIdInput.value;
    const updatedData = {
      fecha_cita: editFechaCitaInput.value,
      hora_cita: editHoraCitaInput.value,
      kilometraje: editKilometrajeInput.value
        ? parseInt(editKilometrajeInput.value)
        : null,
      servicio_id: editSelectServicio.value,
      detalle_sintomas: editDetalleSintomasTextarea.value,
      userId: localCurrentUser.id,
    };

   // console.log(`DEBUG: Enviando PUT a /api/citas/${citaId}`, updatedData);

    try {
      const response = await fetch(
        `/api/citas/${citaId}`, 
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData),
        }
      );
      const result = await response.json();
      // console.log(
      //   "DEBUG: Edición - Respuesta backend:",
      //   response.status,
      //   result
      // );

      if (response.ok && result.success) {
        showEditFeedback("Cita actualizada exitosamente.", "success");
        setTimeout(() => {
          cerrarModalEdicion();
          cargarYMostrarCitas(filtroFechaInicio.value, filtroFechaFin.value);
          showActionFeedback("La cita fue actualizada.", "success");
        }, 1000);
      } else {
        showEditFeedback(
          result.message || "Error al actualizar la cita.",
          "error"
        );
        modalEditSaveButton.disabled = false;
      }
    } catch (error) {
     // console.error("DEBUG: Edición - Error de red:", error);
      showEditFeedback("Error de conexión al guardar.", "error");
      modalEditSaveButton.disabled = false;
    }
  }

  async function inicializarPagina() {
    await cargarServicios();
    cargarYMostrarCitas();
  //  console.log("Página Mis Citas cargada y lógica inicializada.");
  }

  inicializarPagina();
});
