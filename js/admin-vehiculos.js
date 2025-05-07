document.addEventListener("DOMContentLoaded", () => {
    // Asumiendo que currentUser e isAuthenticated se definen globalmente
    // por un script previo (ej. auto-check-admin-vehiculos.js)
    let localCurrentUser = currentUser;
    let isAuthenticatedOnLoad = isAuthenticated;
  
    if (!isAuthenticatedOnLoad || !localCurrentUser) {
      console.error("Autenticación fallida o datos de usuario no disponibles en admin-vehiculos.js. Redirigiendo a login.");
      if (!window.location.pathname.endsWith("login.html")) {
        window.location.replace("login.html");
      }
      return; // Detiene la ejecución si no está autenticado
    }
  
    document.body.classList.remove("auth-pending"); // Muestra el contenido de la página
    console.log("Usuario autenticado en admin-vehiculos.js, inicializando script...");
  
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
    const tablaVehiculos = document.getElementById("tabla-vehiculos");
    const tablaVehiculosBody = document.getElementById("tabla-vehiculos-body");
    const searchPlacaInput = document.getElementById("search-placa");
    const btnBuscarVehiculos = document.getElementById("btn-buscar-vehiculos");
    const btnLimpiarBusqueda = document.getElementById("btn-limpiar-busqueda");
    const btnAddVehiculo = document.getElementById("btn-add-vehiculo");
    // const actionFeedbackMessageDiv = document.getElementById( // No parece usarse directamente, globalFeedbackContainer es el principal
    //   "action-feedback-message"
    // );
    const globalFeedbackContainer = document.getElementById(
      "global-feedback-container"
    );
  
    // Elementos del Modal de Vehículo
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
    const vehiculoIdInput = document.getElementById("vehiculo-id"); // Hidden input para ID en edición
    const vehiculoPlacaInput = document.getElementById("vehiculo-placa");
    const vehiculoMarcaInput = document.getElementById("vehiculo-marca");
    const vehiculoModeloInput = document.getElementById("vehiculo-modelo");
    const vehiculoAnoInput = document.getElementById("vehiculo-ano");
  
    // Sección para asociar cliente
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
    const clienteAsociadoIdInput = document.getElementById("cliente-asociado-id"); // Hidden input para ID de cliente
    const errorBuscarClienteSpan = document.getElementById(
      "error-buscar-cliente"
    );
  
    let allVehicles = []; // Caché para todos los vehículos cargados
    let editMode = false; // Flag para saber si el modal está en modo edición o creación
    let vehiculoSortState = { key: null, direction: "none" }; // Estado del ordenamiento de la tabla
  
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
      userAvatarImg.src = localCurrentUser.avatarUrl;
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
        console.warn("Contenedor de feedback global no encontrado en el DOM. Creando uno nuevo.");
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
        // globalFeedbackContainer = feedbackContainer; // Actualizar referencia si se crea dinámicamente
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
      feedbackDiv.className = `global-feedback-message p-3 rounded-md shadow-lg flex items-center text-sm ${bgColor}`;
      feedbackDiv.style.transition = "opacity 0.5s ease-out, transform 0.5s ease-out";
      feedbackDiv.style.opacity = "0";
      feedbackDiv.style.transform = "translateY(20px)";
      feedbackDiv.innerHTML = `<span class="inline-block align-middle mr-2"><i class="${iconClass}"></i></span><span class="inline-block align-middle">${message}</span>`;
      feedbackContainer.appendChild(feedbackDiv);
  
      void feedbackDiv.offsetWidth; // Forzar reflow para animación
      feedbackDiv.style.opacity = "1";
      feedbackDiv.style.transform = "translateY(0)";
  
      if (type !== "loading") {
        setTimeout(() => {
          feedbackDiv.style.opacity = "0";
          feedbackDiv.style.transform = "translateY(20px)";
          feedbackDiv.addEventListener("transitionend", () => feedbackDiv.remove());
          setTimeout(() => {
            if (feedbackDiv.parentNode) feedbackDiv.remove();
          }, duration + 500);
        }, duration);
      }
      return feedbackDiv;
    }
  
    /**
     * Muestra un mensaje de feedback dentro del modal de vehículo.
     * @param {string} message - El mensaje a mostrar.
     * @param {string} type - El tipo de mensaje (success, error, loading, info, clear).
     */
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
        default: // info
          bgColor = "bg-gray-100 border border-gray-400 text-gray-700";
          iconClass = "fas fa-info-circle";
          break;
      }
      feedbackDiv.className = `px-4 py-3 rounded relative text-sm ${bgColor} mb-4`;
      feedbackDiv.innerHTML = `<span class="inline-block align-middle mr-2"><i class="${iconClass}"></i></span><span class="inline-block align-middle">${message}</span>`;
      feedbackDiv.style.display = "block";
  
      if (type !== "loading") {
        setTimeout(() => {
          if (feedbackDiv) feedbackDiv.style.display = "none";
          feedbackDiv.innerHTML = "";
        }, 4000);
      }
    }
  
    /**
     * Limpia los errores de validación del formulario del modal de vehículo.
     */
    function clearModalValidationErrors() {
      if (!vehiculoForm) return;
      vehiculoForm
        .querySelectorAll(".is-invalid")
        .forEach((el) => el.classList.remove("is-invalid", "border-red-500"));
      vehiculoForm
        .querySelectorAll(".error-message")
        .forEach((el) => el.classList.add("hidden"));
  
      // Limpiar errores específicos de la búsqueda de cliente
      if (errorBuscarClienteSpan) errorBuscarClienteSpan.classList.add("hidden");
      if (buscarClienteTelefonoInput)
        buscarClienteTelefonoInput.classList.remove(
          "border-red-500",
          "is-invalid"
        );
    }
  
    /**
     * Renderiza la tabla de vehículos con los datos proporcionados.
     * @param {Array} vehiculosData - Array de objetos de vehículo.
     */
    function renderizarTablaVehiculos(vehiculosData) {
      if (!tablaVehiculosBody) {
        console.error("ERROR: tablaVehiculosBody no encontrado en el DOM.");
        return;
      }
      tablaVehiculosBody.innerHTML = ""; // Limpiar tabla existente
  
      if (!vehiculosData || vehiculosData.length === 0) {
        tablaVehiculosBody.innerHTML =
          '<tr><td colspan="6" class="py-4 px-4 text-center text-gray-500">No se encontraron vehículos.</td></tr>';
        return;
      }
  
      vehiculosData.forEach((v) => {
        const tr = document.createElement("tr");
        tr.classList.add("hover:bg-gray-50", "transition-colors", "duration-150");
        const clienteNombre = `${v.nombre_cliente || ""} ${
          v.apellido_cliente || ""
        }`.trim();
  
        tr.innerHTML = `
                  <td class="py-3 px-4 font-medium text-gray-900" data-value="${v.placa_vehiculo || ""}">${v.placa_vehiculo || "S/P"}</td>
                  <td class="py-3 px-4 text-gray-700" data-value="${v.marca_vehiculo || ""}">${v.marca_vehiculo || "N/A"}</td>
                  <td class="py-3 px-4 text-gray-700" data-value="${v.modelo_vehiculo || ""}">${v.modelo_vehiculo || "N/A"}</td>
                  <td class="py-3 px-4 text-gray-700" data-value="${v.ano_vehiculo || 0}">${v.ano_vehiculo || "N/A"}</td>
                  <td class="py-3 px-4 text-gray-700" data-value="${clienteNombre}">${clienteNombre || "Cliente no asociado"}</td>
                  <td class="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button class="action-button btn-edit text-blue-600 hover:text-blue-800" title="Editar Vehículo" data-id="${v.id_vehiculo}"><i class="fas fa-pencil-alt"></i></button>
                      <button class="action-button btn-delete text-red-600 hover:text-red-800" title="Eliminar Vehículo" data-id="${v.id_vehiculo}" data-placa="${v.placa_vehiculo || "S/P"}"><i class="fas fa-trash-alt"></i></button>
                  </td>`;
        tablaVehiculosBody.appendChild(tr);
      });
    }
  
    /**
     * Carga los vehículos desde la API, opcionalmente filtrados por placa, y los renderiza.
     * @param {string} searchTerm - El término de búsqueda para la placa (opcional).
     */
    async function cargarVehiculos(searchTerm = "") {
      if (!tablaVehiculosBody) {
          console.error("ERROR: tablaVehiculosBody no definido al cargar vehículos.");
          return;
      }
      const loadingHtml =
        '<tr><td colspan="6" class="py-4 px-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Cargando vehículos...</td></tr>';
      tablaVehiculosBody.innerHTML = loadingHtml;
  
      allVehicles = []; // Limpiar caché local
      vehiculoSortState = { key: null, direction: "none" }; // Resetear estado de ordenamiento
      updateVehiculoSortIcons(); // Actualizar iconos
  
      let apiUrl = "/api/vehiculos"; // MODIFIED
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
          console.error("Error al cargar vehículos:", data.message || "Respuesta no OK");
          tablaVehiculosBody.innerHTML = `<tr><td colspan="6" class="py-4 px-4 text-center text-red-500">Error al cargar vehículos: ${
            data.message || "Error desconocido del servidor"
          }</td></tr>`;
        }
      } catch (error) {
        console.error("Error de red al cargar vehículos:", error);
        tablaVehiculosBody.innerHTML =
          '<tr><td colspan="6" class="py-4 px-4 text-center text-red-500">Error de conexión al cargar vehículos.</td></tr>';
      }
    }
  
    /**
     * Abre el modal para añadir o editar un vehículo.
     * @param {boolean} isEditMode - True si es para editar, false para añadir.
     * @param {object|null} vehiculoData - Los datos del vehículo si es para editar.
     */
    function openVehiculoModal(isEditMode = false, vehiculoData = null) {
      editMode = isEditMode;
      if (!vehiculoForm || !modalVehiculoTitle || !vehiculoIdInput || !vehiculoPlacaInput || !vehiculoMarcaInput || !vehiculoModeloInput || !vehiculoAnoInput || !modalVehiculoSaveButton || !modalVehiculoOverlay || !vehiculoModal || !asociarClienteSection || !clienteEncontradoInfoDiv || !clienteAsociadoIdInput) {
          console.error("ERROR: Uno o más elementos del modal de vehículo no fueron encontrados.");
          return;
      }
      vehiculoForm.reset();
      clearModalValidationErrors();
      showVehiculoModalFeedback("", "clear");
      clienteEncontradoInfoDiv.classList.add("hidden"); // Ocultar info de cliente encontrado
      clienteAsociadoIdInput.value = ""; // Limpiar ID de cliente asociado
      if(modalVehiculoSaveButton) modalVehiculoSaveButton.disabled = false;
  
      if (isEditMode && vehiculoData) {
        modalVehiculoTitle.textContent = "Editar Vehículo";
        vehiculoIdInput.value = vehiculoData.id_vehiculo;
        vehiculoPlacaInput.value = vehiculoData.placa_vehiculo || "";
        vehiculoMarcaInput.value = vehiculoData.marca_vehiculo || "";
        vehiculoModeloInput.value = vehiculoData.modelo_vehiculo || "";
        vehiculoAnoInput.value = vehiculoData.ano_vehiculo || "";
        asociarClienteSection.style.display = "none"; // Ocultar sección de asociar cliente en edición
        if(modalVehiculoSaveButton) modalVehiculoSaveButton.innerHTML =
          '<i class="fas fa-save mr-2"></i> Actualizar Vehículo';
      } else {
        modalVehiculoTitle.textContent = "Añadir Nuevo Vehículo";
        vehiculoIdInput.value = ""; // ID vacío para nuevo vehículo
        asociarClienteSection.style.display = "block"; // Mostrar sección de asociar cliente
        if(modalVehiculoSaveButton) modalVehiculoSaveButton.innerHTML =
          '<i class="fas fa-plus mr-2"></i> Añadir Vehículo';
      }
  
      if (modalVehiculoOverlay) modalVehiculoOverlay.classList.remove("hidden");
      if (vehiculoModal) vehiculoModal.classList.remove("hidden");
      if(vehiculoPlacaInput) vehiculoPlacaInput.focus();
    }
  
    /**
     * Cierra el modal de vehículo.
     */
    function closeVehiculoModal() {
      if (modalVehiculoOverlay) modalVehiculoOverlay.classList.add("hidden");
      if (vehiculoModal) vehiculoModal.classList.add("hidden");
      if (vehiculoForm) vehiculoForm.reset();
      clearModalValidationErrors();
      showVehiculoModalFeedback("", "clear");
    }
  
    /**
     * Obtiene el valor de un vehículo para una clave de ordenamiento específica.
     * @param {object} vehiculo - El objeto vehículo.
     * @param {string} sortKey - La clave por la cual ordenar.
     * @returns {string|number} El valor para la comparación.
     */
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
        console.error("Error obteniendo valor de ordenamiento para vehículo:", e);
        return "";
      }
    }
  
    /**
     * Ordena la tabla de vehículos.
     * @param {string} sortKey - La clave por la cual ordenar.
     */
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
  
    /**
     * Actualiza los iconos de ordenamiento en las cabeceras de la tabla de vehículos.
     */
    function updateVehiculoSortIcons() {
      if (!tablaVehiculos) return;
      const headers = tablaVehiculos.querySelectorAll("thead th.sortable-header");
      headers.forEach((th) => {
        const key = th.dataset.sortKey;
        const iconSpan = th.querySelector(".sort-icon i");
        if (!iconSpan) return;
  
        th.classList.remove("sort-asc", "sort-desc");
        iconSpan.className = "fas fa-sort"; // Icono por defecto
  
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
  
    /**
     * Maneja la subida de un nuevo avatar para el usuario.
     * @param {Event} event - El evento 'change' del input de archivo.
     */
    async function handleAvatarUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
  
      const currentUserForUpload = currentUser; // Usar la variable global
      if (!currentUserForUpload || !currentUserForUpload.id) {
        showActionFeedback("Error: No se pudo identificar al usuario para subir avatar.", "error");
        return;
      }
  
      const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (!allowedTypes.includes(file.type)) {
        showActionFeedback("Error: Tipo de archivo no permitido (solo JPG, PNG, GIF).", "error");
        if (avatarUploadInput) avatarUploadInput.value = "";
        return;
      }
      if (file.size > maxSize) {
        showActionFeedback("Error: El archivo es demasiado grande (máximo 2MB).", "error");
        if (avatarUploadInput) avatarUploadInput.value = "";
        return;
      }
  
      const loadingFeedback = showActionFeedback("Subiendo nueva foto...", "loading");
      const formData = new FormData();
      formData.append("avatar", file);
  
      try {
        const apiUrl = `/api/users/${currentUserForUpload.id}/avatar`; // MODIFIED
        const response = await fetch(apiUrl, { method: "POST", body: formData });
  
        if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
  
        const result = await response.json();
        if (response.ok && result.success && result.avatarUrl) {
          if (userAvatarImg) userAvatarImg.src = result.avatarUrl;
          currentUserForUpload.avatarUrl = result.avatarUrl; // Actualizar el objeto global
          localStorage.setItem("userData", JSON.stringify(currentUserForUpload)); // Actualizar localStorage
          showActionFeedback(result.message || "Foto de perfil actualizada.", "success");
        } else {
          showActionFeedback(result.message || "Error al subir la foto.", "error");
        }
      } catch (error) {
        if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
        console.error("Error de red al subir avatar:", error);
        showActionFeedback("Error de conexión al subir la foto.", "error");
      } finally {
        if (avatarUploadInput) avatarUploadInput.value = "";
      }
    }
  
    // Event Listeners Generales
    if (logoutButton)
      logoutButton.addEventListener("click", () => {
        localStorage.removeItem("userData");
        window.location.replace("login.html");
      });
  
    if (btnAddVehiculo)
      btnAddVehiculo.addEventListener("click", () => openVehiculoModal(false));
  
    if (btnBuscarVehiculos && searchPlacaInput)
      btnBuscarVehiculos.addEventListener("click", () =>
        cargarVehiculos(searchPlacaInput.value)
      );
  
    if (btnLimpiarBusqueda && searchPlacaInput)
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
  
    // Listeners para el modal de vehículo
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
  
    // Listeners para ordenamiento de tabla de vehículos
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
  
    // Listeners para subida de avatar
    if (uploadAvatarTrigger && avatarUploadInput) {
      uploadAvatarTrigger.addEventListener("click", () => avatarUploadInput.click());
      avatarUploadInput.addEventListener("change", handleAvatarUpload);
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
      if (updateProfilePicHeader && avatarUploadInput) {
        updateProfilePicHeader.addEventListener("click", (event) => {
          event.preventDefault();
          avatarUploadInput.click();
          if (profileDropdownMenu) profileDropdownMenu.classList.add("hidden");
        });
      }
    }
  
    /**
     * Maneja la búsqueda de un cliente por teléfono para asociarlo a un nuevo vehículo.
     */
    async function handleBuscarCliente() {
      if (!buscarClienteTelefonoInput || !clienteEncontradoInfoDiv || !errorBuscarClienteSpan || !clienteAsociadoIdInput) {
          console.error("Elementos para buscar cliente no encontrados.");
          return;
      }
      const telefono = buscarClienteTelefonoInput.value.trim();
      clienteEncontradoInfoDiv.classList.add("hidden");
      errorBuscarClienteSpan.classList.add("hidden");
      clienteAsociadoIdInput.value = ""; // Limpiar ID previo
      buscarClienteTelefonoInput.classList.remove("border-red-500", "is-invalid");
  
      if (!telefono || !/^[0-9]{7,15}$/.test(telefono)) { // Validación simple de teléfono
        showVehiculoModalFeedback("Ingrese un número de teléfono válido (7-15 dígitos).", "error");
        errorBuscarClienteSpan.textContent = "Teléfono inválido.";
        errorBuscarClienteSpan.classList.remove("hidden");
        buscarClienteTelefonoInput.classList.add("border-red-500", "is-invalid");
        return;
      }
  
      showVehiculoModalFeedback("Buscando cliente...", "loading");
      try {
        const response = await fetch(
          `/api/clientes/buscar?telefono=${encodeURIComponent(telefono)}` // MODIFIED
        );
        const result = await response.json();
        showVehiculoModalFeedback("", "clear"); // Limpiar mensaje de "Buscando..."
  
        if (response.ok && result.success && result.cliente) {
          const cliente = result.cliente;
          if(clienteEncontradoNombreSpan) clienteEncontradoNombreSpan.textContent = `${
            cliente.nombre_cliente || ""
          } ${cliente.apellido_cliente || ""}`.trim();
          clienteAsociadoIdInput.value = cliente.id_cliente;
          clienteEncontradoInfoDiv.classList.remove("hidden");
          showVehiculoModalFeedback("Cliente encontrado y pre-asociado.", "success");
          errorBuscarClienteSpan.classList.add("hidden");
        } else {
          showVehiculoModalFeedback(result.message || "Cliente no encontrado con ese teléfono.", "error");
          errorBuscarClienteSpan.textContent = result.message || "Cliente no encontrado.";
          errorBuscarClienteSpan.classList.remove("hidden");
        }
      } catch (error) {
        console.error("Error buscando cliente:", error);
        showVehiculoModalFeedback("Error de red al buscar cliente. Intente nuevamente.", "error");
        errorBuscarClienteSpan.textContent = "Error de conexión.";
        errorBuscarClienteSpan.classList.remove("hidden");
      }
    }
  
    /**
     * Maneja el envío del formulario para añadir o editar un vehículo.
     * @param {Event} event - El evento submit.
     */
    async function handleVehiculoFormSubmit(event) {
      event.preventDefault();
      clearModalValidationErrors();
      showVehiculoModalFeedback("", "clear");
  
      let formValid = true;
      // Validar campos requeridos
      const requiredFields = [vehiculoPlacaInput, vehiculoMarcaInput, vehiculoModeloInput, vehiculoAnoInput];
      requiredFields.forEach((field) => {
          if (field && !field.value.trim()) {
              field.classList.add("is-invalid", "border-red-500");
              const errorSpan = field.parentElement.querySelector(".error-message");
              if (errorSpan) errorSpan.classList.remove("hidden");
              formValid = false;
          }
      });
  
      // Validar asociación de cliente si es un nuevo vehículo
      if (!editMode && (!clienteAsociadoIdInput || !clienteAsociadoIdInput.value)) {
        if(errorBuscarClienteSpan) errorBuscarClienteSpan.classList.remove("hidden");
        if(errorBuscarClienteSpan) errorBuscarClienteSpan.textContent = "Debe asociar un cliente al vehículo.";
        if(buscarClienteTelefonoInput) buscarClienteTelefonoInput.classList.add("is-invalid", "border-red-500");
        formValid = false;
      }
  
      // Validar formato del año
      const anoVal = parseInt(vehiculoAnoInput.value);
      const currentYear = new Date().getFullYear();
      if (
        vehiculoAnoInput.value && // Solo validar si hay un valor
        (isNaN(anoVal) ||
          String(anoVal).length !== 4 ||
          anoVal < 1980 || // Año mínimo razonable
          anoVal > currentYear + 1) // Permitir hasta el próximo año
      ) {
        vehiculoAnoInput.classList.add("is-invalid", "border-red-500");
        const errorSpan = vehiculoAnoInput.parentElement.querySelector(".error-message");
        if (errorSpan) {
          errorSpan.textContent = `Ingrese un año válido (4 dígitos, entre 1980 y ${currentYear + 1}).`;
          errorSpan.classList.remove("hidden");
        }
        formValid = false;
      }
  
      if (!formValid) {
        showVehiculoModalFeedback("Por favor, complete todos los campos requeridos correctamente.", "error");
        return;
      }
  
      const placaInputVal = vehiculoPlacaInput.value.toUpperCase().trim();
      const vehiculoId = vehiculoIdInput.value;
      let placaCheckNeeded = false;
  
      // Determinar si se necesita verificar la placa (nueva o si cambió)
      if (!editMode) {
        placaCheckNeeded = true;
      } else {
        const vehiculoOriginal = allVehicles.find((v) => String(v.id_vehiculo) === String(vehiculoId));
        if (vehiculoOriginal && vehiculoOriginal.placa_vehiculo !== placaInputVal) {
          placaCheckNeeded = true;
        }
      }
  
      if (placaCheckNeeded) {
        showVehiculoModalFeedback("Verificando disponibilidad de la placa...", "loading");
        try {
          const checkPlacaResponse = await fetch(
            `/api/vehiculos?placa=${encodeURIComponent(placaInputVal)}` // MODIFIED
          );
          const checkPlacaResult = await checkPlacaResponse.json();
          let placaDuplicada = false;
  
          if (checkPlacaResponse.ok && checkPlacaResult.success && checkPlacaResult.vehiculos.length > 0) {
            if (editMode) {
              // Si estamos editando, la placa es duplicada si existe OTRO vehículo con esa placa
              if (checkPlacaResult.vehiculos.some(v => String(v.id_vehiculo) !== String(vehiculoId))) {
                placaDuplicada = true;
              }
            } else {
              // Si estamos creando, cualquier vehículo encontrado con esa placa es un duplicado
              placaDuplicada = true;
            }
          }
  
          if (placaDuplicada) {
            showVehiculoModalFeedback("Error: La placa ingresada ya está registrada en otro vehículo.", "error");
            vehiculoPlacaInput.classList.add("is-invalid", "border-red-500");
            const errorPlacaSpan = vehiculoPlacaInput.parentElement.querySelector(".error-message");
            if (errorPlacaSpan) {
              errorPlacaSpan.textContent = "Esta placa ya existe.";
              errorPlacaSpan.classList.remove("hidden");
            }
            if(modalVehiculoSaveButton) modalVehiculoSaveButton.disabled = false;
            return;
          }
          showVehiculoModalFeedback("", "clear"); // Limpiar mensaje de "Verificando..."
        } catch (error) {
          console.error("Error verificando placa:", error);
          showVehiculoModalFeedback("Error al verificar la placa. Intente de nuevo.", "error");
          if(modalVehiculoSaveButton) modalVehiculoSaveButton.disabled = false;
          return;
        }
      }
  
      if(modalVehiculoSaveButton) modalVehiculoSaveButton.disabled = true;
      const feedbackMsg = editMode ? "Actualizando vehículo..." : "Añadiendo vehículo...";
      showVehiculoModalFeedback(feedbackMsg, "loading");
  
      const vehiculoData = {
        placa_vehiculo: placaInputVal,
        marca_vehiculo: vehiculoMarcaInput.value.trim(),
        modelo_vehiculo: vehiculoModeloInput.value.trim(),
        ano_vehiculo: vehiculoAnoInput.value,
        // Solo enviar id_cliente si estamos en modo creación y se ha asociado un cliente
        id_cliente: (!editMode && clienteAsociadoIdInput && clienteAsociadoIdInput.value) ? clienteAsociadoIdInput.value : undefined,
      };
      // Eliminar id_cliente del payload si es undefined para no enviarlo innecesariamente
      if (vehiculoData.id_cliente === undefined) {
          delete vehiculoData.id_cliente;
      }
  
  
      const apiUrl = editMode
        ? `/api/vehiculos/${vehiculoId}` // MODIFIED
        : "/api/vehiculos"; // MODIFIED
      const apiMethod = editMode ? "PUT" : "POST";
  
      try {
        const response = await fetch(apiUrl, {
          method: apiMethod,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vehiculoData),
        });
        const result = await response.json();
        showVehiculoModalFeedback("", "clear"); // Limpiar mensaje de carga
  
        if (response.ok && result.success) {
          showVehiculoModalFeedback(
            result.message || `Vehículo ${editMode ? "actualizado" : "añadido"} exitosamente.`,
            "success"
          );
          setTimeout(() => {
            closeVehiculoModal();
            cargarVehiculos(searchPlacaInput ? searchPlacaInput.value : ""); // Recargar tabla (con filtro si existe)
            showActionFeedback( // Feedback global
              `Vehículo ${placaInputVal} ${editMode ? "actualizado" : "añadido"} correctamente.`,
              "success"
            );
          }, 1000);
        } else {
          showVehiculoModalFeedback(
            result.message || `Error al ${editMode ? "actualizar" : "añadir"} el vehículo. ${result.error || ''}`,
            "error"
          );
          if(modalVehiculoSaveButton) modalVehiculoSaveButton.disabled = false;
        }
      } catch (error) {
        console.error("Error de red al guardar vehículo:", error);
        showVehiculoModalFeedback("Error de conexión al guardar. Intente nuevamente.", "error");
        if(modalVehiculoSaveButton) modalVehiculoSaveButton.disabled = false;
      }
    }
  
    /**
     * Elimina un vehículo.
     * @param {string|number} vehiculoId - El ID del vehículo a eliminar.
     */
    async function eliminarVehiculo(vehiculoId) {
      const loadingFeedback = showActionFeedback("Eliminando vehículo...", "loading");
      try {
        const response = await fetch(
          `/api/vehiculos/${vehiculoId}`, // MODIFIED
          { method: "DELETE" }
        );
        let result = { success: response.ok, message: "" };
        if (response.headers.get("content-type")?.includes("application/json")) {
            result = await response.json();
        } else if (!response.ok) {
            result.message = `Error ${response.status}: ${response.statusText}`;
        }
  
  
        if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
  
        if (response.ok && result.success) {
          showActionFeedback(result.message || "Vehículo eliminado correctamente.", "success");
          cargarVehiculos(searchPlacaInput ? searchPlacaInput.value : ""); // Recargar con filtro actual
        } else {
          showActionFeedback(
            result.message || "Error al eliminar el vehículo (verifique si tiene citas asociadas o si ya fue eliminado).",
            "error"
          );
        }
      } catch (error) {
        if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
        console.error("Error de red al eliminar vehículo:", error);
        showActionFeedback("Error de conexión al intentar eliminar.", "error");
      }
    }
  
    /**
     * Maneja las acciones de la tabla de vehículos (editar, eliminar).
     * @param {Event} event - El evento click.
     */
    function handleVehiculoTableActions(event) {
      const targetButton = event.target.closest("button.action-button");
      if (!targetButton) return;
  
      const vehiculoId = targetButton.dataset.id;
      if (!vehiculoId) return;
  
      if (targetButton.classList.contains("btn-edit")) {
        const vehiculoData = allVehicles.find((v) => String(v.id_vehiculo) === String(vehiculoId));
        if (vehiculoData) {
          openVehiculoModal(true, vehiculoData);
        } else {
          console.error(`Vehículo con ID ${vehiculoId} no encontrado en caché para editar.`);
          showActionFeedback("Error al cargar datos del vehículo para editar.", "error");
        }
      } else if (targetButton.classList.contains("btn-delete")) {
        const placa = targetButton.dataset.placa || "este vehículo";
        if (
          confirm(
            `¿Está seguro que desea eliminar el vehículo con placa ${placa}? Esta acción no se puede deshacer.`
          )
        ) {
          eliminarVehiculo(vehiculoId);
        }
      }
    }
  
    /**
     * Función de inicialización de la página.
     */
    function inicializarPagina() {
      cargarVehiculos(); // Cargar la lista inicial de vehículos
      console.log("Página Gestión de Vehículos cargada y lógica inicializada.");
    }
  
    // Iniciar la página
    inicializarPagina();
  });
  