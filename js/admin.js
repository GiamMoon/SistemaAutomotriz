document.addEventListener("DOMContentLoaded", () => {
    // Asumiendo que 'currentUser' es una variable global definida por un script de autenticación previo
    let localCurrentUser = currentUser && currentUser.id ? currentUser : null;
    let isAuthenticatedOnLoad = !!localCurrentUser; // Es true si localCurrentUser no es null
  
    if (isAuthenticatedOnLoad) {
      document.body.classList.remove("auth-pending");
      console.log("Auth valid, initializing page script for admin.js...");
  
      // Obtención de elementos del DOM
      const userAvatarImg = document.getElementById("user-avatar-img");
      const uploadAvatarTrigger = document.getElementById(
        "upload-avatar-trigger"
      );
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
      const form = document.getElementById("nuevo-servicio-form");
      const fieldset1 = document.getElementById("fieldset-1");
      const fieldset2 = document.getElementById("fieldset-2");
      const fieldset3 = document.getElementById("fieldset-3");
      const stepCircle1 = document.getElementById("step-circle-1");
      const stepCircle2 = document.getElementById("step-circle-2");
      const stepCircle3 = document.getElementById("step-circle-3");
      const submitButton = document.getElementById("submit-button");
      const selectVehiculo = document.getElementById("select-vehiculo-cliente");
      const btnToggleAddVehicle = document.getElementById(
        "btn-toggle-add-vehicle"
      );
      const addNewVehicleSection = document.getElementById(
        "add-new-vehicle-section"
      );
      const isNewVehicleInput = document.getElementById("is_new_vehicle"); // Hidden input
      const saveVehicleFeedback = document.getElementById( // No parece usarse, considerar si es necesario
        "save-vehicle-feedback"
      );
      const apiFeedbackMessageDiv = document.getElementById( // Feedback específico del formulario
        "api-feedback-message"
      );
      const emailInput = document.getElementById("email-cliente");
      const phoneInput = document.getElementById("telefono-cliente");
      const dateInput = document.getElementById("fecha-cita");
      const timeInput = document.getElementById("hora-cita");
      const newVehicleInputs = addNewVehicleSection.querySelectorAll("input[required]"); // Inputs requeridos en la sección de nuevo vehículo
      const selectServicio = document.getElementById("select-servicio");
      const globalFeedbackContainer = document.getElementById(
        "global-feedback-container"
      );
  
      let isAddingNewVehicle = false; // Flag para controlar si se está añadiendo un nuevo vehículo
      const todayString = new Date().toISOString().split("T")[0]; // Fecha de hoy en formato YYYY-MM-DD
      let clienteVehiculosCache = {}; // Caché para los vehículos de un cliente por teléfono
      let serviciosDisponibles = []; // Caché para los servicios disponibles
  
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
      } else if (userAvatarImg) {
        console.log("No avatarUrl found for user, using default placeholder.");
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
              feedbackContainer.style.zIndex = "1050"; // Asegurar alta visibilidad
              feedbackContainer.style.display = "flex";
              feedbackContainer.style.flexDirection = "column";
              feedbackContainer.style.gap = "0.5rem";
              feedbackContainer.style.alignItems = "flex-end";
              document.body.appendChild(feedbackContainer);
              // globalFeedbackContainer = feedbackContainer; // Reasignar si es necesario
          }
  
          const feedbackDiv = document.createElement("div");
          let bgColor, iconClass, textColor;
  
          switch (type) {
              case "success":
                  bgColor = "bg-green-500"; // Tailwind color
                  iconClass = "fas fa-check-circle";
                  textColor = "text-white";
                  break;
              case "error":
                  bgColor = "bg-red-500"; // Tailwind color
                  iconClass = "fas fa-exclamation-triangle";
                  textColor = "text-white";
                  break;
              case "loading":
                  bgColor = "bg-blue-500"; // Tailwind color
                  iconClass = "fas fa-spinner fa-spin";
                  textColor = "text-white";
                  break;
              default: // info
                  bgColor = "bg-gray-700"; // Tailwind color
                  iconClass = "fas fa-info-circle";
                  textColor = "text-white";
                  break;
          }
  
          feedbackDiv.className = `global-feedback-message p-4 rounded-lg shadow-xl flex items-center text-sm ${bgColor} ${textColor}`;
          feedbackDiv.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";
          feedbackDiv.style.opacity = "0";
          feedbackDiv.style.transform = "translateY(10px)"; // Inicia ligeramente abajo
  
          feedbackDiv.innerHTML = `<span class="inline-block align-middle mr-3"><i class="${iconClass} text-xl"></i></span><span class="inline-block align-middle">${message}</span>`;
          feedbackContainer.appendChild(feedbackDiv);
  
          // Forzar reflow para que la animación de entrada funcione
          void feedbackDiv.offsetWidth;
          feedbackDiv.style.opacity = "1";
          feedbackDiv.style.transform = "translateY(0)";
  
          if (type !== "loading") {
              setTimeout(() => {
                  feedbackDiv.style.opacity = "0";
                  feedbackDiv.style.transform = "translateY(10px)";
                  feedbackDiv.addEventListener("transitionend", () => feedbackDiv.remove());
                  setTimeout(() => { // Fallback por si transitionend no se dispara
                      if (feedbackDiv.parentNode) feedbackDiv.remove();
                  }, duration + 300);
              }, duration);
          }
          return feedbackDiv; // Devuelve el div para poder quitarlo manualmente si es 'loading'
      }
  
  
      // --- Funciones de Validación ---
      function isValidEmail(email) {
        if (!email && emailInput && !emailInput.required) return true; // Si no es requerido y está vacío, es válido
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      }
  
      function isValidPhone(phone) {
        if (!phone) return false; // Teléfono es siempre requerido en la sección 1
        const phoneRegex = /^[0-9]{7,15}$/; // Ajustar según necesidad (ej. 9 dígitos para Perú)
        return phoneRegex.test(phone);
      }
  
      function isValidDate(dateStr) {
        if (!dateStr) return false; // Fecha es requerida
        // Compara con la fecha de hoy (sin la hora)
        const selectedDate = new Date(dateStr + "T00:00:00"); // Asegurar que se compara solo la fecha
        const today = new Date(todayString + "T00:00:00");
        return selectedDate >= today;
      }
  
      function isValidTime(timeStr) {
        if (!timeStr) return false; // Hora es requerida
        return true; // Validación simple, se puede mejorar (ej. formato HH:MM)
      }
  
      function isNotEmpty(value) {
        return value && String(value).trim() !== "";
      }
  
      function validateField(input, showErrors = false) {
        const errorSpan = document.getElementById(`error-${input.id}`);
        let isValid = true;
        let errorMessage = "";
  
        const esCampoNuevoVehiculo = addNewVehicleSection.contains(input);
  
        // Solo validar si es requerido y no es un campo de nuevo vehículo que está oculto
        if (input.required && !(esCampoNuevoVehiculo && !isAddingNewVehicle)) {
          if (!isNotEmpty(input.value)) {
            isValid = false;
            errorMessage = "Este campo es obligatorio.";
          }
        }
  
        // Si es válido hasta ahora y tiene valor, aplicar validaciones específicas
        if (isValid && isNotEmpty(input.value)) {
          let validationFn = null;
          let specificErrorMsg = "";
  
          if (input.id === "email-cliente") {
              validationFn = isValidEmail;
              specificErrorMsg = "Ingrese un correo electrónico válido.";
          } else if (input.id === "telefono-cliente") {
              validationFn = isValidPhone;
              specificErrorMsg = "Ingrese un teléfono válido (solo números, 7-15 dígitos).";
          } else if (input.id === "fecha-cita") {
              validationFn = isValidDate;
              specificErrorMsg = "La fecha no puede ser anterior a hoy.";
          } else if (input.id === "hora-cita") {
              validationFn = isValidTime; // Asumiendo que el input type="time" maneja el formato
          } else if (input.id === "ano-vehiculo" && (isAddingNewVehicle || input.value)) { // Solo validar año si se añade veh o tiene valor
              validationFn = (v) => /^\d{4}$/.test(v) && parseInt(v, 10) >= 1980 && parseInt(v, 10) <= new Date().getFullYear() + 1;
              specificErrorMsg = `Año inválido (4 dígitos, 1980-${new Date().getFullYear() + 1}).`;
          } else if (input.id === "kilometraje" && input.value) { // Kilometraje es opcional, validar si tiene valor
              validationFn = (v) => !isNaN(v) && Number(v) >= 0;
              specificErrorMsg = "Kilometraje debe ser un número positivo.";
          } else if (input.id === "select-vehiculo-cliente" && !isAddingNewVehicle && input.required) {
               validationFn = isNotEmpty; // Ya cubierto por la validación de 'required'
          } else if (input.id === "select-servicio" && input.required) {
               validationFn = isNotEmpty; // Ya cubierto
          }
  
  
          if (validationFn) {
            const currentFieldValid = validationFn(input.value);
            if (!currentFieldValid) {
              isValid = false;
              errorMessage = specificErrorMsg || errorMessage; // Usar mensaje específico si hay
            }
          }
        }
  
        if (showErrors || input.classList.contains("interacted")) {
          input.classList.toggle("is-invalid", !isValid);
          if (errorSpan) {
            errorSpan.textContent = isValid ? "" : errorMessage;
            errorSpan.style.display = isValid ? "none" : "block";
          }
        }
        // No remover is-invalid aquí si showErrors es false, solo al interactuar o en blur
        return isValid;
      }
  
  
      function checkSectionValidity(fieldset, showErrors = false) {
        const inputs = fieldset.querySelectorAll(
          'input:not([type="hidden"]), select, textarea'
        );
        // Usar Array.from para asegurar que es un array iterable con .every
        return Array.from(inputs).every((input) =>
          validateField(input, showErrors)
        );
      }
  
      function checkNewVehicleSectionValidity(showErrors = false) {
        // newVehicleInputs ya es una NodeList, se puede convertir a array
        return Array.from(newVehicleInputs).every((input) =>
          validateField(input, showErrors)
        );
      }
  
      function updateFormState(triggerSectionValidation = false) {
        const isS1Valid = checkSectionValidity(fieldset1, triggerSectionValidation);
        let isS2CompleteForS3 = false;
  
        stepCircle1.classList.toggle("step-circle-complete", isS1Valid);
        stepCircle1.classList.toggle("step-circle-active", !isS1Valid);
  
        if (isS1Valid) {
          if (fieldset2.disabled) {
            fieldset2.disabled = false;
            // Solo cargar vehículos si el teléfono es válido y no se ha cargado antes para este teléfono
            if (isValidPhone(phoneInput.value) && !clienteVehiculosCache[phoneInput.value.trim()]) {
              cargarVehiculosCliente();
            } else if (clienteVehiculosCache[phoneInput.value.trim()]) {
              populateVehicleSelect(clienteVehiculosCache[phoneInput.value.trim()]);
            }
          }
          stepCircle2.classList.add("step-circle-active");
          stepCircle2.classList.remove("step-circle-complete");
  
          if (isAddingNewVehicle) {
            isS2CompleteForS3 = checkNewVehicleSectionValidity(triggerSectionValidation);
          } else {
            isS2CompleteForS3 = validateField(selectVehiculo,triggerSectionValidation);
          }
          stepCircle2.classList.toggle("step-circle-complete", isS2CompleteForS3);
          stepCircle2.classList.toggle("step-circle-active",isS1Valid && !isS2CompleteForS3);
  
        } else {
          fieldset2.disabled = true;
          stepCircle2.classList.remove("step-circle-active","step-circle-complete");
          selectVehiculo.innerHTML = '<option value="" disabled selected>-- Ingrese teléfono del cliente primero --</option>';
          // No limpiar caché aquí, podría ser útil si el usuario corrige el teléfono
        }
  
        const canEnableS3 = isS1Valid && isS2CompleteForS3;
        if (canEnableS3) {
          if (fieldset3.disabled) {
            fieldset3.disabled = false;
            if (serviciosDisponibles.length === 0) { // Cargar servicios solo una vez
              cargarServiciosSelect();
            }
          }
          stepCircle3.classList.add("step-circle-active");
          stepCircle3.classList.remove("step-circle-complete");
  
          const isS3Valid = checkSectionValidity(fieldset3, triggerSectionValidation);
          stepCircle3.classList.toggle("step-circle-complete", isS3Valid);
          stepCircle3.classList.toggle("step-circle-active", !isS3Valid);
          submitButton.disabled = !isS3Valid;
  
        } else {
          fieldset3.disabled = true;
          stepCircle3.classList.remove("step-circle-active","step-circle-complete");
          submitButton.disabled = true;
        }
      }
  
      async function cargarVehiculosCliente() {
        const telefono = phoneInput.value.trim();
        if (!telefono || !isValidPhone(telefono)) {
          selectVehiculo.innerHTML = '<option value="" disabled selected>-- Teléfono de cliente inválido --</option>';
          return;
        }
  
        // Usar caché si está disponible
        if (clienteVehiculosCache[telefono]) {
          populateVehicleSelect(clienteVehiculosCache[telefono]);
          updateFormState(); // Actualizar estado del formulario después de poblar
          return;
        }
  
        selectVehiculo.disabled = true;
        selectVehiculo.innerHTML = '<option value="" disabled selected>-- Cargando vehículos... --</option>';
  
        try {
          const response = await fetch(
            `/api/vehiculos/cliente?telefono=${encodeURIComponent(telefono)}` // MODIFIED
          );
          const result = await response.json();
  
          if (response.ok && result.success) {
            clienteVehiculosCache[telefono] = result.vehicles || []; // Guardar en caché (incluso array vacío)
            populateVehicleSelect(result.vehicles);
          } else {
            selectVehiculo.innerHTML = `<option value="" disabled selected>-- ${result.message || "No se encontraron vehículos"} --</option>`;
            clienteVehiculosCache[telefono] = []; // Guardar array vacío en caché
          }
        } catch (error) {
          console.error("Error fetching vehicles for client:", error);
          selectVehiculo.innerHTML = '<option value="" disabled selected>-- Error al cargar vehículos --</option>';
          showActionFeedback("Error al cargar vehículos del cliente.", "error");
          clienteVehiculosCache[telefono] = []; // Guardar array vacío en caché
        } finally {
          selectVehiculo.disabled = false;
          updateFormState(true); // Validar y actualizar estado del formulario
        }
      }
  
      function populateVehicleSelect(vehicles) {
        selectVehiculo.innerHTML = ""; // Limpiar opciones existentes
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Seleccione un vehículo --";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        selectVehiculo.appendChild(defaultOption);
  
        if (vehicles && vehicles.length > 0) {
          vehicles.forEach((v) => {
            const option = document.createElement("option");
            option.value = v.id_vehiculo;
            // Usar los nombres de campo correctos del backend (ej. marca_vehiculo, modelo_vehiculo, placa_vehiculo)
            option.textContent = `${v.marca_vehiculo || v.marca || 'Marca Desconocida'} ${v.modelo_vehiculo || v.modelo || 'Modelo Desconocido'} (${v.placa_vehiculo || v.placa || "S/P"})`;
            selectVehiculo.appendChild(option);
          });
        } else {
           // Si no hay vehículos, mantener el select vacío o con un mensaje
           const noVehiclesOption = document.createElement("option");
           noVehiclesOption.value = "";
           noVehiclesOption.textContent = "-- No hay vehículos registrados para este cliente --";
           noVehiclesOption.disabled = true;
           selectVehiculo.innerHTML = ''; // Limpiar antes de añadir esta única opción
           selectVehiculo.appendChild(noVehiclesOption);
        }
      }
  
      async function cargarServiciosSelect() {
        if (!selectServicio || serviciosDisponibles.length > 0) return; // No recargar si ya están
        selectServicio.innerHTML = '<option value="" disabled selected>-- Cargando servicios... --</option>';
        try {
          const response = await fetch("/api/servicios?activos=true"); // MODIFIED
          const data = await response.json();
          if (response.ok && data.success && data.servicios) {
            serviciosDisponibles = data.servicios;
            selectServicio.innerHTML = ""; // Limpiar "Cargando..."
            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "-- Seleccionar un servicio --";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            selectServicio.appendChild(defaultOption);
  
            data.servicios.forEach((servicio) => {
              const option = document.createElement("option");
              option.value = servicio.id_servicio;
              option.textContent = servicio.nombre_servicio;
              selectServicio.appendChild(option);
            });
            // Añadir opción "Otros"
            const otrosOption = document.createElement("option");
            otrosOption.value = "otros"; // Valor especial para "Otros"
            otrosOption.textContent = "Otros servicios / Diagnóstico";
            selectServicio.appendChild(otrosOption);
  
          } else {
            console.error("Error al cargar servicios activos:", data.message);
            selectServicio.innerHTML = '<option value="" disabled selected>-- Error al cargar --</option>';
          }
        } catch (error) {
          console.error("Error de red al cargar servicios activos:", error);
          selectServicio.innerHTML = '<option value="" disabled selected>-- Error de red --</option>';
        }
      }
  
      function toggleNewVehicleForm() {
          isAddingNewVehicle = !addNewVehicleSection.classList.toggle("hidden");
          isNewVehicleInput.value = isAddingNewVehicle ? "1" : "0";
  
          // Limpiar feedback y errores de la sección que se oculta/muestra
          if(saveVehicleFeedback) saveVehicleFeedback.innerHTML = "";
          if(apiFeedbackMessageDiv) apiFeedbackMessageDiv.innerHTML = "";
  
          const sectionToClearValidation = isAddingNewVehicle ? selectVehiculo.closest('.form-section-fieldset > div') : addNewVehicleSection;
          sectionToClearValidation.querySelectorAll(".is-invalid").forEach((el) => {
              el.classList.remove("is-invalid", "interacted", "submit-attempted");
              const errorSpan = document.getElementById(`error-${el.id}`);
              if (errorSpan) errorSpan.style.display = "none";
          });
          // Limpiar error específico del select de vehículo
          const errorSelectVehiculo = document.getElementById("error-select-vehiculo-cliente");
          if(errorSelectVehiculo) errorSelectVehiculo.style.display = "none";
  
  
          if (isAddingNewVehicle) {
              selectVehiculo.value = ""; // Limpiar selección de vehículo existente
              selectVehiculo.required = false;
              newVehicleInputs.forEach((input) => (input.required = true));
              btnToggleAddVehicle.innerHTML = '<i class="fas fa-times mr-1"></i> Cancelar Añadir Vehículo';
          } else {
              selectVehiculo.required = true;
              newVehicleInputs.forEach((input) => {
                  input.required = false;
                  input.value = ""; // Limpiar campos de nuevo vehículo
              });
              btnToggleAddVehicle.innerHTML = '<i class="fas fa-plus mr-1"></i> Añadir Nuevo Vehículo';
              // Repoblar select de vehículos si ya se habían cargado para el cliente
              const telefono = phoneInput.value.trim();
              if (clienteVehiculosCache[telefono]) {
                  populateVehicleSelect(clienteVehiculosCache[telefono]);
              } else {
                  // Si no hay caché, mostrar mensaje para ingresar teléfono
                  selectVehiculo.innerHTML = '<option value="" disabled selected>-- Ingrese teléfono del cliente primero --</option>';
              }
          }
          updateFormState(true); // Revalidar y actualizar el estado del formulario
      }
  
  
      async function handleAvatarUpload(event) {
          console.log("DEBUG: Avatar file input changed.");
          const file = event.target.files[0];
          if (!file) {
              console.log("DEBUG: No file selected.");
              return;
          }
  
          const currentUserForUpload = currentUser; // Usar la variable global
          if (!currentUserForUpload || !currentUserForUpload.id) {
              console.error("Error: No se pudo obtener el ID del usuario actual para subir avatar.");
              showActionFeedback("Error: No se pudo identificar al usuario.", "error");
              return;
          }
  
          const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
          const maxSize = 2 * 1024 * 1024; // 2MB
          if (!allowedTypes.includes(file.type)) {
              showActionFeedback("Error: Tipo de archivo no permitido (solo JPG, PNG, GIF).", "error");
              if(avatarUploadInput) avatarUploadInput.value = "";
              return;
          }
          if (file.size > maxSize) {
              showActionFeedback("Error: El archivo es demasiado grande (máximo 2MB).", "error");
              if(avatarUploadInput) avatarUploadInput.value = "";
              return;
          }
  
          const loadingFeedback = showActionFeedback("Subiendo nueva foto...", "loading");
          const formData = new FormData();
          formData.append("avatar", file);
  
          try {
              const apiUrl = `/api/users/${currentUserForUpload.id}/avatar`; // MODIFIED
              console.log(`DEBUG: Sending POST to ${apiUrl} for avatar upload.`);
              const response = await fetch(apiUrl, {
                  method: "POST",
                  body: formData,
              });
  
              if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
  
              const result = await response.json();
              console.log("DEBUG: Server response (avatar upload):", result);
  
              if (response.ok && result.success && result.avatarUrl) {
                  console.log("DEBUG: Avatar uploaded successfully. New URL:", result.avatarUrl);
                  if (userAvatarImg) {
                      userAvatarImg.src = result.avatarUrl;
                  }
                  currentUserForUpload.avatarUrl = result.avatarUrl; // Actualizar el objeto global
                  localStorage.setItem("userData", JSON.stringify(currentUserForUpload)); // Actualizar localStorage
                  console.log("DEBUG: User data updated in localStorage with new avatarUrl.");
                  showActionFeedback(result.message || "Foto de perfil actualizada.", "success");
              } else {
                  console.error("Error in server response (avatar upload):", result.message || response.statusText);
                  showActionFeedback(result.message || "Error al subir la foto.", "error");
              }
          } catch (error) {
              if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
              console.error("Network error during avatar upload:", error);
              showActionFeedback("Error de conexión al subir la foto.", "error");
          } finally {
              if(avatarUploadInput) avatarUploadInput.value = ""; // Limpiar input
              console.log("DEBUG: Avatar file input reset.");
          }
      }
  
  
      // --- Event Listeners ---
      form.addEventListener("blur", (event) => {
          const target = event.target;
          if ( target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") {
              target.classList.add("interacted"); // Marcar como interactuado
              validateField(target, true); // Validar y mostrar error si es necesario
              updateFormState(); // Actualizar estado general del formulario
          }
      }, true); // Usar captura para manejar blur en todos los campos
  
      form.addEventListener("input", () => updateFormState(false)); // Actualizar en input sin mostrar errores inmediatamente
      form.addEventListener("change", () => updateFormState(false)); // Para selects
  
      if(btnToggleAddVehicle) btnToggleAddVehicle.addEventListener("click", toggleNewVehicleForm);
  
      if(phoneInput) phoneInput.addEventListener("blur", () => {
          // Solo cargar vehículos si el teléfono es válido
          if (isValidPhone(phoneInput.value)) {
              cargarVehiculosCliente();
          } else {
              // Si el teléfono no es válido, limpiar el select de vehículos y caché
              selectVehiculo.innerHTML = '<option value="" disabled selected>-- Teléfono de cliente inválido --</option>';
              clienteVehiculosCache = {}; // Limpiar caché si el teléfono cambia a inválido
              updateFormState(); // Actualizar estado del formulario
          }
      });
  
      if (logoutButton)
        logoutButton.addEventListener("click", () => {
          localStorage.removeItem("userData");
          window.location.replace("login.html");
        });
  
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
            profileDropdownMenu && // Asegurarse que el menú existe
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
            if(profileDropdownMenu) profileDropdownMenu.classList.add("hidden");
          });
        }
      }
  
  
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if(apiFeedbackMessageDiv) apiFeedbackMessageDiv.innerHTML = ""; // Limpiar feedback previo
  
        // Forzar validación de todas las secciones y mostrar errores
        const isS1Valid = checkSectionValidity(fieldset1, true);
        let isS2Valid = false;
        if (isAddingNewVehicle) {
          isS2Valid = checkNewVehicleSectionValidity(true);
        } else {
          isS2Valid = checkSectionValidity(fieldset2, true); // Validar select de vehículo existente
        }
        const isS3Valid = checkSectionValidity(fieldset3, true);
  
        // Marcar todos los campos como "submit-attempted" para estilos visuales si es necesario
        form.querySelectorAll("input, select, textarea").forEach((el) => el.classList.add("submit-attempted"));
  
        if (isS1Valid && isS2Valid && isS3Valid) {
          if(submitButton) submitButton.disabled = true;
          const loadingSubmit = showActionFeedback("Guardando cita...", "loading");
  
          const formDataPayload = {
            nombres_cliente: document.getElementById("nombres-cliente").value.trim(),
            apellidos_cliente: document.getElementById("apellidos-cliente").value.trim(),
            email_cliente: document.getElementById("email-cliente").value.trim() || null, // Enviar null si está vacío
            telefono_cliente: document.getElementById("telefono-cliente").value.trim(),
            is_new_vehicle: isAddingNewVehicle ? "1" : "0",
            vehiculo_registrado_id: (isAddingNewVehicle || !selectVehiculo.value) ? null : selectVehiculo.value,
            marca_vehiculo: isAddingNewVehicle ? document.getElementById("marca-vehiculo").value.trim() : null,
            modelo_vehiculo: isAddingNewVehicle ? document.getElementById("modelo-vehiculo").value.trim() : null,
            ano_vehiculo: isAddingNewVehicle ? document.getElementById("ano-vehiculo").value.trim() : null,
            placa_vehiculo: isAddingNewVehicle ? document.getElementById("placa-vehiculo").value.toUpperCase().trim() : null,
            kilometraje: document.getElementById("kilometraje").value.trim() || null,
            servicio_id: document.getElementById("select-servicio").value,
            detalle_sintomas: document.getElementById("detalle-sintomas").value.trim() || null,
            fecha_cita: dateInput.value,
            hora_cita: timeInput.value,
            userId: localCurrentUser.id, // ID del usuario que crea la cita
          };
  
          const apiUrl = "/api/citas"; // MODIFIED
          const apiMethod = "POST";
  
          console.log(`Enviando datos (${apiMethod}) a ${apiUrl}:`, formDataPayload);
  
          try {
            const response = await fetch(apiUrl, {
              method: apiMethod,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(formDataPayload),
            });
            const result = await response.json();
  
            if(loadingSubmit && loadingSubmit.parentNode) loadingSubmit.remove(); // Quitar mensaje de carga
  
            if (response.ok && result.success) {
              showActionFeedback(result.message || "Cita guardada exitosamente.", "success");
              console.log("DEBUG: Mensaje de éxito mostrado.");
              if(submitButton) submitButton.disabled = true; // Mantener deshabilitado en éxito
  
              setTimeout(() => {
                console.log("DEBUG: Redirigiendo a Mis Citas después de 2 segundos...");
                window.location.href = "admin_miscitas.html";
              }, 2000); // Redirigir después de 2 segundos
            } else {
              showActionFeedback(result.message || "Error al guardar la cita. Verifique los datos.", "error");
              if(submitButton) submitButton.disabled = false; // Rehabilitar botón en caso de error
            }
          } catch (error) {
            if(loadingSubmit && loadingSubmit.parentNode) loadingSubmit.remove();
            console.error("Error de red al enviar el formulario:", error);
            showActionFeedback("Error de conexión con el servidor. Intente nuevamente.", "error");
            if(submitButton) submitButton.disabled = false; // Rehabilitar botón
          }
        } else {
          console.log("Formulario inválido. No se enviará.");
          showActionFeedback("Formulario inválido. Por favor corrija los errores marcados.", "error");
          // Opcional: enfocar el primer campo inválido
          const firstInvalidField = form.querySelector(".is-invalid");
          if (firstInvalidField) firstInvalidField.focus();
        }
      });
  
      // --- Inicialización de la Página ---
      async function inicializarPagina() {
        await cargarServiciosSelect(); // Cargar servicios al iniciar
        if (dateInput) dateInput.setAttribute("min", todayString); // Establecer fecha mínima para la cita
        if (selectVehiculo) selectVehiculo.required = !isAddingNewVehicle; // Establecer 'required' inicial
        updateFormState(); // Establecer estado inicial del formulario y steps
        console.log("Panel de administración (Nuevo Servicio) cargado y lógica inicializada.");
      }
  
      inicializarPagina();
  
    } else {
      // Este bloque se ejecuta si la autenticación falla DESPUÉS de que el DOM se haya cargado
      // pero antes de que este script específico se ejecute completamente.
      // El script de auto-check en el <head> ya debería haber redirigido.
      console.error("Authentication failed after DOM loaded in admin.js. Redirecting (should have happened already).");
      if (!window.location.pathname.endsWith("login.html")) {
        window.location.replace("login.html");
      }
    }
  });
  