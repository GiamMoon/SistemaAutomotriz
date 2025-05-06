document.addEventListener("DOMContentLoaded", () => {
  let localCurrentUser = currentUser;
  let isAuthenticatedOnLoad = isAuthenticated;

  if (!isAuthenticatedOnLoad || !localCurrentUser) {
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
    return;
  }

  document.body.classList.remove("auth-pending");

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
  const tablaVehiculos = document.getElementById("tabla-vehiculos");
  const tablaVehiculosBody = document.getElementById("tabla-vehiculos-body");
  const searchPlacaInput = document.getElementById("search-placa");
  const btnBuscarVehiculos = document.getElementById("btn-buscar-vehiculos");
  const btnLimpiarBusqueda = document.getElementById("btn-limpiar-busqueda");
  const btnAddVehiculo = document.getElementById("btn-add-vehiculo");
  const actionFeedbackMessageDiv = document.getElementById(
    "action-feedback-message"
  );
  const globalFeedbackContainer = document.getElementById(
    "global-feedback-container"
  );
  const modalVehiculoOverlay = document.getElementById(
    "modal-vehiculo-overlay"
  );
  const vehiculoModal = document.getElementById("vehiculo-modal");
  const vehiculoForm = document.getElementById("vehiculo-form");
  const modalVehiculoTitle = document.getElementById("modal-vehiculo-title");
  const modalVehiculoCloseButton = document.getElementById(
    "modal-vehiculo-close-button"
  );
  const modalVehiculoCancelButton = document.getElementById(
    "modal-vehiculo-cancel-button"
  );
  const modalVehiculoSaveButton = document.getElementById(
    "modal-vehiculo-save-button"
  );
  const vehiculoFeedbackMessageDiv = document.getElementById(
    "vehiculo-feedback-message"
  );
  const vehiculoIdInput = document.getElementById("vehiculo-id");
  const vehiculoPlacaInput = document.getElementById("vehiculo-placa");
  const vehiculoMarcaInput = document.getElementById("vehiculo-marca");
  const vehiculoModeloInput = document.getElementById("vehiculo-modelo");
  const vehiculoAnoInput = document.getElementById("vehiculo-ano");
  const asociarClienteSection = document.getElementById(
    "asociar-cliente-section"
  );
  const buscarClienteTelefonoInput = document.getElementById(
    "buscar-cliente-telefono"
  );
  const btnBuscarCliente = document.getElementById("btn-buscar-cliente");
  const clienteEncontradoInfoDiv = document.getElementById(
    "cliente-encontrado-info"
  );
  const clienteEncontradoNombreSpan = document.getElementById(
    "cliente-encontrado-nombre"
  );
  const clienteAsociadoIdInput = document.getElementById("cliente-asociado-id");
  const errorBuscarClienteSpan = document.getElementById(
    "error-buscar-cliente"
  );

  let allVehicles = [];
  let editMode = false;
  let vehiculoSortState = { key: null, direction: "none" };

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
  }

  function showActionFeedback(message, type = "info", duration = 4000) {
    if (!globalFeedbackContainer) {
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

  function showVehiculoModalFeedback(message, type = "info") {
    const feedbackDiv = vehiculoFeedbackMessageDiv;
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
    if (!vehiculoForm) return;
    vehiculoForm
      .querySelectorAll(".is-invalid")
      .forEach((el) => el.classList.remove("is-invalid", "border-red-500"));
    vehiculoForm
      .querySelectorAll(".error-message")
      .forEach((el) => el.classList.add("hidden"));
    if (errorBuscarClienteSpan) errorBuscarClienteSpan.classList.add("hidden");
    if (buscarClienteTelefonoInput)
      buscarClienteTelefonoInput.classList.remove(
        "border-red-500",
        "is-invalid"
      );
  }

  function renderizarTablaVehiculos(vehiculosData) {
    if (!tablaVehiculosBody) {
      return;
    }
    tablaVehiculosBody.innerHTML = "";
    if (!vehiculosData || vehiculosData.length === 0) {
      tablaVehiculosBody.innerHTML =
        '<tr><td colspan="6" class="py-4 px-4 text-center text-gray-500">No se encontraron vehículos.</td></tr>';
      return;
    }
    vehiculosData.forEach((v) => {
      const tr = document.createElement("tr");
      const clienteNombre = `${v.nombre_cliente || ""} ${
        v.apellido_cliente || ""
      }`.trim();
      tr.innerHTML = `
                <td class="py-3 px-4 font-medium text-gray-900" data-value="${
                  v.placa_vehiculo || ""
                }">${v.placa_vehiculo || "S/P"}</td>
                <td class="py-3 px-4" data-value="${v.marca_vehiculo || ""}">${
        v.marca_vehiculo || "N/A"
      }</td>
                <td class="py-3 px-4" data-value="${v.modelo_vehiculo || ""}">${
        v.modelo_vehiculo || "N/A"
      }</td>
                <td class="py-3 px-4" data-value="${v.ano_vehiculo || 0}">${
        v.ano_vehiculo || "N/A"
      }</td>
                <td class="py-3 px-4" data-value="${clienteNombre}">${
        clienteNombre || "Cliente no asociado"
      }</td>
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    <button class="action-button btn-edit" title="Editar Vehículo" data-id="${
                      v.id_vehiculo
                    }"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-button btn-delete" title="Eliminar Vehículo" data-id="${
                      v.id_vehiculo
                    }" data-placa="${
        v.placa_vehiculo || "S/P"
      }"><i class="fas fa-trash-alt"></i></button>
                </td>`;
      tablaVehiculosBody.appendChild(tr);
    });
  }
  async function cargarVehiculos(searchTerm = "") {
    if (!tablaVehiculosBody) return;
    const loadingHtml =
      '<tr><td colspan="6" class="py-4 px-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Cargando vehículos...</td></tr>';
    tablaVehiculosBody.innerHTML = loadingHtml;
    allVehicles = [];
    vehiculoSortState = { key: null, direction: "none" };
    updateVehiculoSortIcons();
    let apiUrl = "http://localhost:3000/api/vehiculos";
    const trimmedSearchTerm = searchTerm.trim().toUpperCase();
    if (trimmedSearchTerm) {
      apiUrl += `?placa=${encodeURIComponent(trimmedSearchTerm)}`;
    }
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (response.ok && data.success && data.vehiculos) {
        allVehicles = data.vehiculos;
        renderizarTablaVehiculos(allVehicles);
      } else {
        tablaVehiculosBody.innerHTML = `<tr><td colspan="6" class="py-4 px-4 text-center text-red-500">Error al cargar vehículos: ${
          data.message || "Error desconocido"
        }</td></tr>`;
      }
    } catch (error) {
      tablaVehiculosBody.innerHTML =
        '<tr><td colspan="6" class="py-4 px-4 text-center text-red-500">Error de conexión al cargar vehículos.</td></tr>';
    }
  }

  function openVehiculoModal(isEditMode = false, vehiculoData = null) {
    editMode = isEditMode;
    if (!vehiculoForm) return;
    vehiculoForm.reset();
    clearModalValidationErrors();
    showVehiculoModalFeedback("", "clear");
    clienteEncontradoInfoDiv.classList.add("hidden");
    clienteAsociadoIdInput.value = "";
    modalVehiculoSaveButton.disabled = false;
    if (isEditMode && vehiculoData) {
      modalVehiculoTitle.textContent = "Editar Vehículo";
      vehiculoIdInput.value = vehiculoData.id_vehiculo;
      vehiculoPlacaInput.value = vehiculoData.placa_vehiculo || "";
      vehiculoMarcaInput.value = vehiculoData.marca_vehiculo || "";
      vehiculoModeloInput.value = vehiculoData.modelo_vehiculo || "";
      vehiculoAnoInput.value = vehiculoData.ano_vehiculo || "";
      asociarClienteSection.style.display = "none";
      modalVehiculoSaveButton.innerHTML =
        '<i class="fas fa-save mr-2"></i> Actualizar Vehículo';
    } else {
      modalVehiculoTitle.textContent = "Añadir Nuevo Vehículo";
      vehiculoIdInput.value = "";
      asociarClienteSection.style.display = "block";
      modalVehiculoSaveButton.innerHTML =
        '<i class="fas fa-plus mr-2"></i> Añadir Vehículo';
    }
    if (modalVehiculoOverlay) modalVehiculoOverlay.classList.remove("hidden");
    if (vehiculoModal) vehiculoModal.classList.remove("hidden");
  }
  function closeVehiculoModal() {
    if (modalVehiculoOverlay) modalVehiculoOverlay.classList.add("hidden");
    if (vehiculoModal) vehiculoModal.classList.add("hidden");
    if (vehiculoForm) vehiculoForm.reset();
  }

  function getSortValueFromVehiculo(vehiculo, sortKey) {
    try {
      switch (sortKey) {
        case "placa":
          return (vehiculo.placa_vehiculo || "").toLowerCase();
        case "marca":
          return (vehiculo.marca_vehiculo || "").toLowerCase();
        case "modelo":
          return (vehiculo.modelo_vehiculo || "").toLowerCase();
        case "ano":
          return parseInt(vehiculo.ano_vehiculo, 10) || 0;
        case "cliente":
          const nombre = `${vehiculo.nombre_cliente || ""} ${
            vehiculo.apellido_cliente || ""
          }`.trim();
          return nombre.toLowerCase();
        default:
          return "";
      }
    } catch (e) {
      return "";
    }
  }
  function sortVehiculoTable(sortKey) {
    if (!allVehicles || allVehicles.length <= 1) return;
    let currentDirection = vehiculoSortState.direction;
    let newDirection;
    if (vehiculoSortState.key === sortKey) {
      newDirection = currentDirection === "asc" ? "desc" : "asc";
    } else {
      newDirection = "asc";
    }
    vehiculoSortState = { key: sortKey, direction: newDirection };
    allVehicles.sort((a, b) => {
      const valA = getSortValueFromVehiculo(a, sortKey);
      const valB = getSortValueFromVehiculo(b, sortKey);
      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return newDirection === "desc" ? comparison * -1 : comparison;
    });
    renderizarTablaVehiculos(allVehicles);
    updateVehiculoSortIcons();
  }
  function updateVehiculoSortIcons() {
    if (!tablaVehiculos) return;
    const headers = tablaVehiculos.querySelectorAll("thead th.sortable-header");
    headers.forEach((th) => {
      const key = th.dataset.sortKey;
      const iconSpan = th.querySelector(".sort-icon i");
      if (!iconSpan) return;
      th.classList.remove("sort-asc", "sort-desc");
      iconSpan.className = "fas fa-sort";
      if (vehiculoSortState.key === key) {
        if (vehiculoSortState.direction === "asc") {
          th.classList.add("sort-asc");
          iconSpan.className = "fas fa-sort-up";
        } else if (vehiculoSortState.direction === "desc") {
          th.classList.add("sort-desc");
          iconSpan.className = "fas fa-sort-down";
        }
      }
    });
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    let localCurrentUser = currentUser;
    if (!localCurrentUser || !localCurrentUser.id) {
      showActionFeedback("Error: No se pudo identificar al usuario.", "error");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    const maxSize = 2 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      showActionFeedback("Error: Tipo de archivo no permitido.", "error");
      avatarUploadInput.value = "";
      return;
    }
    if (file.size > maxSize) {
      showActionFeedback("Error: El archivo es demasiado grande.", "error");
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
      const response = await fetch(apiUrl, { method: "POST", body: formData });
      if (loadingFeedback) loadingFeedback.remove();
      const result = await response.json();
      if (response.ok && result.success && result.avatarUrl) {
        if (userAvatarImg) {
          userAvatarImg.src = result.avatarUrl;
        }
        localCurrentUser.avatarUrl = result.avatarUrl;
        localStorage.setItem("userData", JSON.stringify(localCurrentUser));
        showActionFeedback(
          result.message || "Foto de perfil actualizada.",
          "success"
        );
      } else {
        showActionFeedback(
          result.message || "Error al subir la foto.",
          "error"
        );
      }
    } catch (error) {
      if (loadingFeedback) loadingFeedback.remove();
      showActionFeedback("Error de conexión al subir la foto.", "error");
    } finally {
      avatarUploadInput.value = "";
    }
  }

  if (logoutButton)
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("userData");
      window.location.replace("login.html");
    });
  if (btnAddVehiculo)
    btnAddVehiculo.addEventListener("click", () => openVehiculoModal(false));
  if (btnBuscarVehiculos)
    btnBuscarVehiculos.addEventListener("click", () =>
      cargarVehiculos(searchPlacaInput.value)
    );
  if (btnLimpiarBusqueda)
    btnLimpiarBusqueda.addEventListener("click", () => {
      searchPlacaInput.value = "";
      cargarVehiculos();
    });
  if (searchPlacaInput)
    searchPlacaInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") cargarVehiculos(searchPlacaInput.value);
    });
  if (tablaVehiculosBody)
    tablaVehiculosBody.addEventListener("click", handleVehiculoTableActions);
  if (modalVehiculoCloseButton)
    modalVehiculoCloseButton.addEventListener("click", closeVehiculoModal);
  if (modalVehiculoCancelButton)
    modalVehiculoCancelButton.addEventListener("click", closeVehiculoModal);
  if (modalVehiculoOverlay)
    modalVehiculoOverlay.addEventListener("click", closeVehiculoModal);
  if (vehiculoForm)
    vehiculoForm.addEventListener("submit", handleVehiculoFormSubmit);
  if (btnBuscarCliente)
    btnBuscarCliente.addEventListener("click", handleBuscarCliente);
  if (tablaVehiculos) {
    tablaVehiculos
      .querySelectorAll("thead .sortable-header")
      .forEach((header) => {
        header.addEventListener("click", () => {
          const sortKey = header.dataset.sortKey;
          if (sortKey) sortVehiculoTable(sortKey);
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

  async function handleBuscarCliente() {
    const telefono = buscarClienteTelefonoInput.value.trim();
    clienteEncontradoInfoDiv.classList.add("hidden");
    errorBuscarClienteSpan.classList.add("hidden");
    clienteAsociadoIdInput.value = "";
    buscarClienteTelefonoInput.classList.remove("border-red-500", "is-invalid");
    if (!telefono || !/^[0-9]{7,15}$/.test(telefono)) {
      showVehiculoModalFeedback(
        "Ingrese un número de teléfono válido.",
        "error"
      );
      errorBuscarClienteSpan.textContent = "Teléfono inválido.";
      errorBuscarClienteSpan.classList.remove("hidden");
      buscarClienteTelefonoInput.classList.add("border-red-500", "is-invalid");
      return;
    }
    showVehiculoModalFeedback("Buscando cliente...", "loading");
    try {
      const response = await fetch(
        `http://localhost:3000/api/clientes/buscar?telefono=${encodeURIComponent(
          telefono
        )}`
      );
      const result = await response.json();
      if (response.ok && result.success && result.cliente) {
        const cliente = result.cliente;
        clienteEncontradoNombreSpan.textContent = `${
          cliente.nombre_cliente || ""
        } ${cliente.apellido_cliente || ""}`.trim();
        clienteAsociadoIdInput.value = cliente.id_cliente;
        clienteEncontradoInfoDiv.classList.remove("hidden");
        showVehiculoModalFeedback("Cliente encontrado y asociado.", "success");
        errorBuscarClienteSpan.classList.add("hidden");
      } else {
        showVehiculoModalFeedback(
          result.message || "Cliente no encontrado.",
          "error"
        );
        errorBuscarClienteSpan.textContent =
          result.message || "Cliente no encontrado.";
        errorBuscarClienteSpan.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error buscando cliente:", error);
      showVehiculoModalFeedback("Error de red al buscar cliente.", "error");
      errorBuscarClienteSpan.textContent = "Error de conexión.";
      errorBuscarClienteSpan.classList.remove("hidden");
    }
  }
  async function handleVehiculoFormSubmit(event) {
    event.preventDefault();
    clearModalValidationErrors();
    showVehiculoModalFeedback("", "clear");
    let formValid = true;
    vehiculoForm
      .querySelectorAll('[required]:not([type="hidden"])')
      .forEach((field) => {
        if (!field.value.trim()) {
          field.classList.add("is-invalid", "border-red-500");
          const errorSpan = field.parentElement.querySelector(".error-message");
          if (errorSpan) errorSpan.classList.remove("hidden");
          formValid = false;
        }
      });
    if (!editMode && !clienteAsociadoIdInput.value) {
      errorBuscarClienteSpan.classList.remove("hidden");
      buscarClienteTelefonoInput.classList.add("is-invalid", "border-red-500");
      formValid = false;
    }
    const anoVal = parseInt(vehiculoAnoInput.value);
    const currentYear = new Date().getFullYear();
    if (
      vehiculoAnoInput.value &&
      (isNaN(anoVal) ||
        String(anoVal).length !== 4 ||
        anoVal < 1980 ||
        anoVal > currentYear + 1)
    ) {
      vehiculoAnoInput.classList.add("is-invalid", "border-red-500");
      const errorSpan =
        vehiculoAnoInput.parentElement.querySelector(".error-message");
      if (errorSpan) {
        errorSpan.textContent = `Ingrese un año válido (4 dígitos, entre 1980 y ${
          currentYear + 1
        }).`;
        errorSpan.classList.remove("hidden");
      }
      formValid = false;
    }
    if (!formValid) {
      showVehiculoModalFeedback(
        "Por favor, complete todos los campos requeridos correctamente.",
        "error"
      );
      return;
    }
    const placaInputVal = vehiculoPlacaInput.value.toUpperCase().trim();
    const vehiculoId = vehiculoIdInput.value;
    let placaCheckNeeded = false;
    if (!editMode) {
      placaCheckNeeded = true;
    } else {
      const vehiculoOriginal = allVehicles.find(
        (v) => v.id_vehiculo == vehiculoId
      );
      if (
        vehiculoOriginal &&
        vehiculoOriginal.placa_vehiculo !== placaInputVal
      ) {
        placaCheckNeeded = true;
      }
    }
    if (placaCheckNeeded) {
      showVehiculoModalFeedback("Verificando placa...", "loading");
      try {
        const checkPlacaResponse = await fetch(
          `http://localhost:3000/api/vehiculos?placa=${encodeURIComponent(
            placaInputVal
          )}`
        );
        const checkPlacaResult = await checkPlacaResponse.json();
        let placaDuplicada = false;
        if (
          checkPlacaResponse.ok &&
          checkPlacaResult.success &&
          checkPlacaResult.vehiculos.length > 0
        ) {
          if (editMode) {
            if (
              checkPlacaResult.vehiculos.some(
                (v) => v.id_vehiculo != vehiculoId
              )
            ) {
              placaDuplicada = true;
            }
          } else {
            placaDuplicada = true;
          }
        }
        if (placaDuplicada) {
          showVehiculoModalFeedback(
            "Error: La placa ingresada ya está registrada en otro vehículo.",
            "error"
          );
          vehiculoPlacaInput.classList.add("is-invalid", "border-red-500");
          const errorPlacaSpan =
            vehiculoPlacaInput.parentElement.querySelector(".error-message");
          if (errorPlacaSpan) {
            errorPlacaSpan.textContent = "Esta placa ya existe.";
            errorPlacaSpan.classList.remove("hidden");
          }
          modalVehiculoSaveButton.disabled = false;
          return;
        }
        showVehiculoModalFeedback("", "clear");
      } catch (error) {
        showVehiculoModalFeedback(
          "Error al verificar la placa. Intente de nuevo.",
          "error"
        );
        modalVehiculoSaveButton.disabled = false;
        return;
      }
    }
    modalVehiculoSaveButton.disabled = true;
    const feedbackMsg = editMode
      ? "Actualizando vehículo..."
      : "Añadiendo vehículo...";
    showVehiculoModalFeedback(feedbackMsg, "loading");
    const vehiculoData = {
      placa_vehiculo: placaInputVal,
      marca_vehiculo: vehiculoMarcaInput.value.trim(),
      modelo_vehiculo: vehiculoModeloInput.value.trim(),
      ano_vehiculo: vehiculoAnoInput.value,
      id_cliente: editMode ? undefined : clienteAsociadoIdInput.value,
    };
    if (vehiculoData.id_cliente === undefined) delete vehiculoData.id_cliente;
    const apiUrl = editMode
      ? `http://localhost:3000/api/vehiculos/${vehiculoId}`
      : "http://localhost:3000/api/vehiculos";
    const apiMethod = editMode ? "PUT" : "POST";
    try {
      const response = await fetch(apiUrl, {
        method: apiMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehiculoData),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        showVehiculoModalFeedback(
          result.message ||
            `Vehículo ${editMode ? "actualizado" : "añadido"} exitosamente.`,
          "success"
        );
        setTimeout(() => {
          closeVehiculoModal();
          cargarVehiculos(searchPlacaInput.value);
          showActionFeedback(
            `Vehículo ${editMode ? "actualizado" : "añadido"} correctamente.`,
            "success"
          );
        }, 1000);
      } else {
        showVehiculoModalFeedback(
          result.message ||
            `Error al ${editMode ? "actualizar" : "añadir"} el vehículo.`,
          "error"
        );
        modalVehiculoSaveButton.disabled = false;
      }
    } catch (error) {
      showVehiculoModalFeedback("Error de conexión al guardar.", "error");
      modalVehiculoSaveButton.disabled = false;
    }
  }
  async function eliminarVehiculo(vehiculoId) {
    const loadingFeedback = showActionFeedback(
      "Eliminando vehículo...",
      "loading"
    );
    try {
      const response = await fetch(
        `http://localhost:3000/api/vehiculos/${vehiculoId}`,
        { method: "DELETE" }
      );
      const result = await response.json();

      if (loadingFeedback) loadingFeedback.remove();

      if (response.ok && result.success) {
        showActionFeedback(
          result.message || "Vehículo eliminado correctamente.",
          "success"
        );
        cargarVehiculos(searchPlacaInput.value);
      } else {
        showActionFeedback(
          result.message ||
            "Error al eliminar el vehículo (verifique si tiene citas asociadas).",
          "error"
        );
      }
    } catch (error) {
      if (loadingFeedback) loadingFeedback.remove();
      console.error("Error de red al eliminar vehículo:", error);
      showActionFeedback("Error de conexión al eliminar.", "error");
    }
  }
  function handleVehiculoTableActions(event) {
    const targetButton = event.target.closest("button.action-button");
    if (!targetButton) return;
    const vehiculoId = targetButton.dataset.id;
    if (!vehiculoId) return;
    if (targetButton.classList.contains("btn-edit")) {
      const vehiculoData = allVehicles.find((v) => v.id_vehiculo == vehiculoId);
      if (vehiculoData) {
        openVehiculoModal(true, vehiculoData);
      } else {
        showActionFeedback("Error al cargar datos para editar.", "error");
      }
    } else if (targetButton.classList.contains("btn-delete")) {
      const placa = targetButton.dataset.placa;
      if (
        confirm(
          `¿Está seguro que desea eliminar el vehículo con placa ${placa}?`
        )
      ) {
        eliminarVehiculo(vehiculoId);
      }
    }
  }

  function inicializarPagina() {
    cargarVehiculos();
    console.log("Página Gestión de Vehículos cargada y lógica inicializada.");
  }
  inicializarPagina();
});
