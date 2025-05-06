document.addEventListener("DOMContentLoaded", () => {
  console.log("DEBUG: DOMContentLoaded event fired.");

  let localCurrentUser = currentUserData;
  let isAuthenticatedOnLoad = isAuthenticatedInHead;

  if (!isAuthenticatedOnLoad || !localCurrentUser) {
    console.error(
      "ERROR: Autenticación fallida o datos de usuario no disponibles. Redirigiendo."
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
  const tablaServicios = document.getElementById("tabla-servicios");
  const tablaServiciosBody = document.getElementById("tabla-servicios-body");
  const btnAddServicio = document.getElementById("btn-add-servicio");
  const actionFeedbackMessageDiv = document.getElementById(
    "action-feedback-message"
  );
  const globalFeedbackContainer = document.getElementById(
    "global-feedback-container"
  );

  const modalServicioOverlay = document.getElementById(
    "modal-servicio-overlay"
  );
  const servicioModal = document.getElementById("servicio-modal");
  const servicioForm = document.getElementById("servicio-form");
  const modalServicioTitle = document.getElementById("modal-servicio-title");
  const modalServicioCloseButton = document.getElementById(
    "modal-servicio-close-button"
  );
  const modalServicioCancelButton = document.getElementById(
    "modal-servicio-cancel-button"
  );
  const modalServicioSaveButton = document.getElementById(
    "modal-servicio-save-button"
  );
  const servicioFeedbackMessageDiv = document.getElementById(
    "servicio-feedback-message"
  );
  const servicioIdInput = document.getElementById("servicio-id");
  const servicioNombreInput = document.getElementById("servicio-nombre");

  let allServices = [];
  let editMode = false;
  let servicioSortState = { key: null, direction: "none" };

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
    console.log(
      "No avatarUrl found in localStorage, using default placeholder."
    );
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

  function showServicioModalFeedback(message, type = "info") {
    const feedbackDiv = servicioFeedbackMessageDiv;
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
    if (!servicioForm) return;
    servicioForm
      .querySelectorAll(".is-invalid")
      .forEach((el) => el.classList.remove("is-invalid", "border-red-500"));
    servicioForm
      .querySelectorAll(".error-message")
      .forEach((el) => el.classList.add("hidden"));
  }

  function renderizarTablaServicios(serviciosData) {
    if (!tablaServiciosBody) {
      console.error("ERROR: tablaServiciosBody no encontrado");
      return;
    }
    tablaServiciosBody.innerHTML = "";
    if (!serviciosData || serviciosData.length === 0) {
      tablaServiciosBody.innerHTML =
        '<tr><td colspan="4" class="py-4 px-4 text-center text-gray-500">No hay servicios registrados.</td></tr>';
      return;
    }
    serviciosData.forEach((s) => {
      const tr = document.createElement("tr");
      const isActive = s.activo;
      const estadoTexto = isActive ? "Activo" : "Inactivo";
      const estadoClase = isActive
        ? "bg-green-100 text-green-800"
        : "bg-red-100 text-red-800";
      const toggleButtonText = isActive ? "Desactivar" : "Activar";
      const toggleButtonIcon = isActive ? "fa-toggle-off" : "fa-toggle-on";
      const toggleButtonClass = isActive
        ? "btn-toggle-active"
        : "btn-toggle-inactive";
      tr.innerHTML = `
                <td class="py-3 px-4 text-gray-500" data-value="${
                  s.id_servicio
                }">${s.id_servicio}</td>
                <td class="py-3 px-4 font-medium text-gray-900" data-value="${
                  s.nombre_servicio || ""
                }">${s.nombre_servicio || "N/A"}</td>
                <td class="py-3 px-4" data-value="${estadoTexto}"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoClase}">${estadoTexto}</span></td>
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    <button class="action-button btn-edit" title="Editar Servicio" data-id="${
                      s.id_servicio
                    }" data-nombre="${
        s.nombre_servicio || ""
      }"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-button ${toggleButtonClass}" title="${toggleButtonText}" data-id="${
        s.id_servicio
      }" data-nombre="${s.nombre_servicio || ""}" data-activo="${
        isActive ? "1" : "0"
      }"><i class="fas ${toggleButtonIcon}"></i></button>
                    <button class="action-button btn-delete" title="Eliminar Servicio" data-id="${
                      s.id_servicio
                    }" data-nombre="${
        s.nombre_servicio || ""
      }"><i class="fas fa-trash-alt"></i></button>
                </td>`;
      tablaServiciosBody.appendChild(tr);
    });
  }
  async function cargarServicios() {
    console.log("DEBUG: Iniciando cargarServicios...");
    if (!tablaServiciosBody) {
      console.error("ERROR: tablaServiciosBody no encontrado");
      return;
    }
    const loadingHtml =
      '<tr><td colspan="4" class="py-4 px-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Cargando servicios...</td></tr>';
    tablaServiciosBody.innerHTML = loadingHtml;
    allServices = [];
    servicioSortState = { key: null, direction: "none" };
    updateServicioSortIcons();
    try {
      const response = await fetch("http://localhost:3000/api/servicios");
      const data = await response.json();
      console.log("DEBUG: Respuesta de /api/servicios:", data);
      if (response.ok && data.success && data.servicios) {
        allServices = data.servicios;
        renderizarTablaServicios(allServices);
      } else {
        console.error(
          "Error al obtener servicios:",
          data ? data.message : "Respuesta no OK"
        );
        tablaServiciosBody.innerHTML =
          '<tr><td colspan="4" class="py-4 px-4 text-center text-red-500">Error al cargar servicios.</td></tr>';
      }
    } catch (error) {
      console.error("Error de red al obtener servicios:", error);
      tablaServiciosBody.innerHTML =
        '<tr><td colspan="4" class="py-4 px-4 text-center text-red-500">Error de conexión.</td></tr>';
    }
  }

  function openServicioModal(isEditMode = false, servicioData = null) {
    editMode = isEditMode;
    if (!servicioForm) {
      console.error("ERROR: servicioForm no encontrado");
      return;
    }
    servicioForm.reset();
    clearModalValidationErrors();
    showServicioModalFeedback("", "clear");
    modalServicioSaveButton.disabled = false;
    if (isEditMode && servicioData) {
      modalServicioTitle.textContent = "Editar Servicio";
      servicioIdInput.value = servicioData.id_servicio;
      servicioNombreInput.value = servicioData.nombre_servicio || "";
      modalServicioSaveButton.innerHTML =
        '<i class="fas fa-save mr-2"></i> Actualizar Servicio';
    } else {
      modalServicioTitle.textContent = "Añadir Nuevo Servicio";
      servicioIdInput.value = "";
      modalServicioSaveButton.innerHTML =
        '<i class="fas fa-plus mr-2"></i> Añadir Servicio';
    }
    if (modalServicioOverlay) modalServicioOverlay.classList.remove("hidden");
    if (servicioModal) servicioModal.classList.remove("hidden");
  }
  function closeServicioModal() {
    if (modalServicioOverlay) modalServicioOverlay.classList.add("hidden");
    if (servicioModal) servicioModal.classList.add("hidden");
    if (servicioForm) servicioForm.reset();
  }

  function getSortValueFromServicio(servicio, sortKey) {
    try {
      switch (sortKey) {
        case "id":
          return parseInt(servicio.id_servicio, 10) || 0;
        case "nombre":
          return (servicio.nombre_servicio || "").toLowerCase();
        case "estado":
          return servicio.activo ? 1 : 0;
        default:
          return "";
      }
    } catch (e) {
      console.error(
        `Error getting sort value for key ${sortKey} from servicio:`,
        servicio,
        e
      );
      return "";
    }
  }
  function sortServicioTable(sortKey) {
    if (!allServices || allServices.length <= 1) return;
    let currentDirection = servicioSortState.direction;
    let newDirection;
    if (servicioSortState.key === sortKey) {
      newDirection = currentDirection === "asc" ? "desc" : "asc";
    } else {
      newDirection = "asc";
    }
    servicioSortState = { key: sortKey, direction: newDirection };
    allServices.sort((a, b) => {
      const valA = getSortValueFromServicio(a, sortKey);
      const valB = getSortValueFromServicio(b, sortKey);
      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return newDirection === "desc" ? comparison * -1 : comparison;
    });
    renderizarTablaServicios(allServices);
    updateServicioSortIcons();
  }
  function updateServicioSortIcons() {
    if (!tablaServicios) return;
    const headers = tablaServicios.querySelectorAll("thead th.sortable-header");
    headers.forEach((th) => {
      const key = th.dataset.sortKey;
      const iconSpan = th.querySelector(".sort-icon i");
      if (!iconSpan) return;
      th.classList.remove("sort-asc", "sort-desc");
      iconSpan.className = "fas fa-sort";
      if (servicioSortState.key === key) {
        if (servicioSortState.direction === "asc") {
          th.classList.add("sort-asc");
          iconSpan.className = "fas fa-sort-up";
        } else if (servicioSortState.direction === "desc") {
          th.classList.add("sort-desc");
          iconSpan.className = "fas fa-sort-down";
        }
      }
    });
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
      const response = await fetch(apiUrl, { method: "POST", body: formData });
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
  if (btnAddServicio)
    btnAddServicio.addEventListener("click", () => openServicioModal(false));
  if (tablaServiciosBody)
    tablaServiciosBody.addEventListener("click", handleServicioTableActions);
  if (modalServicioCloseButton)
    modalServicioCloseButton.addEventListener("click", closeServicioModal);
  if (modalServicioCancelButton)
    modalServicioCancelButton.addEventListener("click", closeServicioModal);
  if (modalServicioOverlay)
    modalServicioOverlay.addEventListener("click", closeServicioModal);
  if (servicioForm)
    servicioForm.addEventListener("submit", handleServicioFormSubmit);
  if (tablaServicios) {
    tablaServicios
      .querySelectorAll("thead .sortable-header")
      .forEach((header) => {
        header.addEventListener("click", () => {
          const sortKey = header.dataset.sortKey;
          if (sortKey) sortServicioTable(sortKey);
        });
      });
  }

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

  async function handleServicioTableActions(event) {
    const targetButton = event.target.closest("button.action-button");
    if (!targetButton) return;
    const servicioId = targetButton.dataset.id;
    const nombreServicio = targetButton.dataset.nombre;
    if (!servicioId) return;
    if (targetButton.classList.contains("btn-edit")) {
      const servicioData = allServices.find((s) => s.id_servicio == servicioId);
      if (servicioData) {
        openServicioModal(true, servicioData);
      } else {
        openServicioModal(true, {
          id_servicio: servicioId,
          nombre_servicio: nombreServicio,
        });
        console.warn("Datos completos no encontrados en caché.");
      }
    } else if (
      targetButton.classList.contains("btn-toggle-active") ||
      targetButton.classList.contains("btn-toggle-inactive")
    ) {
      const estadoActual = targetButton.dataset.activo === "1";
      const accion = estadoActual ? "desactivar" : "activar";
      if (
        confirm(
          `¿Está seguro que desea ${accion} el servicio "${nombreServicio}"?`
        )
      ) {
        toggleServicioActivo(servicioId);
      }
    } else if (targetButton.classList.contains("btn-delete")) {
      if (
        confirm(
          `¿Está seguro que desea ELIMINAR el servicio "${nombreServicio}"? Esta acción no se puede deshacer y podría fallar si el servicio está en uso.`
        )
      ) {
        eliminarServicio(servicioId);
      }
    }
  }
  async function handleServicioFormSubmit(event) {
    event.preventDefault();
    clearModalValidationErrors();
    showServicioModalFeedback("", "clear");
    let formValid = true;
    if (!servicioNombreInput.value.trim()) {
      servicioNombreInput.classList.add("is-invalid", "border-red-500");
      const errorSpan =
        servicioNombreInput.parentElement.querySelector(".error-message");
      if (errorSpan) errorSpan.classList.remove("hidden");
      formValid = false;
    }
    if (!formValid) {
      showServicioModalFeedback(
        "El nombre del servicio es requerido.",
        "error"
      );
      return;
    }
    modalServicioSaveButton.disabled = true;
    const feedbackMsg = editMode
      ? "Actualizando servicio..."
      : "Añadiendo servicio...";
    showServicioModalFeedback(feedbackMsg, "loading");
    const servicioData = { nombre_servicio: servicioNombreInput.value };
    const servicioId = servicioIdInput.value;
    const apiUrl = editMode
      ? `http://localhost:3000/api/servicios/${servicioId}`
      : "http://localhost:3000/api/servicios";
    const apiMethod = editMode ? "PUT" : "POST";
    console.log(`DEBUG: Enviando ${apiMethod} a ${apiUrl}`, servicioData);
    try {
      const response = await fetch(apiUrl, {
        method: apiMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(servicioData),
      });
      const result = await response.json();
      console.log("DEBUG: Respuesta del backend:", response.status, result);
      if (response.ok && result.success) {
        showServicioModalFeedback(
          result.message ||
            `Servicio ${editMode ? "actualizado" : "añadido"} exitosamente.`,
          "success"
        );
        setTimeout(() => {
          closeServicioModal();
          cargarServicios();
          showActionFeedback(
            `Servicio ${editMode ? "actualizado" : "añadido"} correctamente.`,
            "success"
          );
        }, 1000);
      } else {
        showServicioModalFeedback(
          result.message ||
            `Error al ${editMode ? "actualizar" : "añadir"} el servicio.`,
          "error"
        );
        modalServicioSaveButton.disabled = false;
      }
    } catch (error) {
      console.error(
        `DEBUG: Error de red al ${
          editMode ? "actualizar" : "añadir"
        } servicio:`,
        error
      );
      showServicioModalFeedback("Error de conexión al guardar.", "error");
      modalServicioSaveButton.disabled = false;
    }
  }

  async function toggleServicioActivo(servicioId) {
    const loadingFeedback = showActionFeedback(
      "Cambiando estado...",
      "loading"
    );
    try {
      const response = await fetch(
        `http://localhost:3000/api/servicios/${servicioId}/toggle`,
        { method: "PATCH", headers: { "Content-Type": "application/json" } }
      );
      const result = await response.json();

      if (loadingFeedback) loadingFeedback.remove();

      if (response.ok && result.success) {
        showActionFeedback(
          result.message || "Estado del servicio cambiado.",
          "success"
        );
        cargarServicios();
      } else {
        showActionFeedback(
          result.message || "Error al cambiar el estado del servicio.",
          "error"
        );
      }
    } catch (error) {
      if (loadingFeedback) loadingFeedback.remove();
      console.error("Error de red al cambiar estado:", error);
      showActionFeedback("Error de conexión.", "error");
    }
  }

  async function eliminarServicio(servicioId) {
    const loadingFeedback = showActionFeedback(
      "Eliminando servicio...",
      "loading"
    );
    try {
      const response = await fetch(
        `http://localhost:3000/api/servicios/${servicioId}`,
        { method: "DELETE" }
      );
      const result = await response.json();

      if (loadingFeedback) loadingFeedback.remove();

      if (response.ok && result.success) {
        showActionFeedback(
          result.message || "Servicio eliminado correctamente.",
          "success"
        );
        cargarServicios();
      } else {
        showActionFeedback(
          result.message ||
            "Error al eliminar el servicio (podría estar en uso).",
          "error"
        );
      }
    } catch (error) {
      if (loadingFeedback) loadingFeedback.remove();
      console.error("Error de red al eliminar servicio:", error);
      showActionFeedback("Error de conexión al eliminar.", "error");
    }
  }

  function inicializarPagina() {
    cargarServicios();
    console.log("Página Gestión de Servicios cargada y lógica inicializada.");
  }
  inicializarPagina();
});
