document.addEventListener("DOMContentLoaded", () => {
  let localCurrentUser = currentUser && currentUser.id ? currentUser : null;
  let isAuthenticatedOnLoad = !!localCurrentUser;

  if (isAuthenticatedOnLoad) {
    document.body.classList.remove("auth-pending");
    console.log("Auth valid, initializing page script...");

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
    const profileDropdownMenu = document.getElementById(
      "profile-dropdown-menu"
    );
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
    const isNewVehicleInput = document.getElementById("is_new_vehicle");
    const saveVehicleFeedback = document.getElementById(
      "save-vehicle-feedback"
    );
    const apiFeedbackMessageDiv = document.getElementById(
      "api-feedback-message"
    );
    const emailInput = document.getElementById("email-cliente");
    const phoneInput = document.getElementById("telefono-cliente");
    const dateInput = document.getElementById("fecha-cita");
    const timeInput = document.getElementById("hora-cita");
    const newVehicleInputs =
      addNewVehicleSection.querySelectorAll("input[required]");
    const selectServicio = document.getElementById("select-servicio");
    const globalFeedbackContainer = document.getElementById(
      "global-feedback-container"
    );

    let isAddingNewVehicle = false;
    const todayString = new Date().toISOString().split("T")[0];
    let clienteVehiculosCache = {};
    let serviciosDisponibles = [];

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
      console.log("No avatarUrl found, using default.");
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

    function isValidEmail(email) {
      if (!email) return true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
    function isValidPhone(phone) {
      if (!phone) return false;
      const phoneRegex = /^[0-9]{7,15}$/;
      return phoneRegex.test(phone);
    }
    function isValidDate(dateStr) {
      if (!dateStr) return false;
      return dateStr >= todayString;
    }
    function isValidTime(timeStr) {
      if (!timeStr) return false;
      return true;
    }
    function isNotEmpty(value) {
      return value && value.trim() !== "";
    }
    function validateField(input, showErrors = false) {
      const errorSpan = document.getElementById(`error-${input.id}`);
      let isValid = true;
      let errorMessage = "";
      const esCampoNuevoVehiculo = addNewVehicleSection.contains(input);
      if (
        input.required &&
        !isNotEmpty(input.value) &&
        !(esCampoNuevoVehiculo && !isAddingNewVehicle)
      ) {
        isValid = false;
        errorMessage = "Este campo es obligatorio.";
      } else if (input.value) {
        let validationFn = null;
        if (input.id === "email-cliente") validationFn = isValidEmail;
        else if (input.id === "telefono-cliente") validationFn = isValidPhone;
        else if (input.id === "fecha-cita") validationFn = isValidDate;
        else if (input.id === "hora-cita") validationFn = isValidTime;
        else if (input.id === "ano-vehiculo")
          validationFn = (v) =>
            /^\d{4}$/.test(v) && v >= 1980 && v <= new Date().getFullYear() + 1;
        else if (input.id === "kilometraje")
          validationFn = (v) => !isNaN(v) && Number(v) >= 0;
        else if (input.id === "select-vehiculo-cliente" && !isAddingNewVehicle)
          validationFn = isNotEmpty;
        else if (input.id === "select-servicio") validationFn = isNotEmpty;
        if (validationFn) isValid = validationFn(input.value);
      }
      if (showErrors) {
        input.classList.toggle("is-invalid", !isValid);
        input.classList.add("interacted");
        if (errorSpan) {
          errorSpan.textContent = errorMessage;
          errorSpan.style.display = isValid ? "none" : "block";
        }
      } else {
        if (isValid && input.classList.contains("is-invalid")) {
          input.classList.remove("is-invalid");
          if (errorSpan) errorSpan.style.display = "none";
        }
      }
      return isValid;
    }
    function checkSectionValidity(fieldset, showErrors = false) {
      const inputs = fieldset.querySelectorAll(
        'input:not([type="hidden"]), select, textarea'
      );
      return Array.from(inputs).every((input) =>
        validateField(input, showErrors)
      );
    }
    function checkNewVehicleSectionValidity(showErrors = false) {
      return Array.from(newVehicleInputs).every((input) =>
        validateField(input, showErrors)
      );
    }

    function updateFormState(triggerSectionValidation = false) {
      const isS1Valid = checkSectionValidity(
        fieldset1,
        triggerSectionValidation
      );
      let isS2CompleteForS3 = false;
      stepCircle1.classList.toggle("step-circle-complete", isS1Valid);
      stepCircle1.classList.toggle("step-circle-active", !isS1Valid);
      if (isS1Valid) {
        if (fieldset2.disabled) {
          fieldset2.disabled = false;
          cargarVehiculosCliente();
        }
        stepCircle2.classList.add("step-circle-active");
        stepCircle2.classList.remove("step-circle-complete");
        if (isAddingNewVehicle) {
          isS2CompleteForS3 = checkNewVehicleSectionValidity(
            triggerSectionValidation
          );
        } else {
          isS2CompleteForS3 = validateField(
            selectVehiculo,
            triggerSectionValidation
          );
        }
        stepCircle2.classList.toggle("step-circle-complete", isS2CompleteForS3);
        stepCircle2.classList.toggle(
          "step-circle-active",
          isS1Valid && !isS2CompleteForS3
        );
      } else {
        fieldset2.disabled = true;
        stepCircle2.classList.remove(
          "step-circle-active",
          "step-circle-complete"
        );
        selectVehiculo.innerHTML =
          '<option value="" disabled selected>-- Ingrese teléfono del cliente primero --</option>';
        clienteVehiculosCache = {};
      }
      const canEnableS3 = isS1Valid && isS2CompleteForS3;
      if (canEnableS3) {
        if (fieldset3.disabled) {
          fieldset3.disabled = false;
          if (serviciosDisponibles.length === 0) {
            cargarServiciosSelect();
          }
        }
        stepCircle3.classList.add("step-circle-active");
        stepCircle3.classList.remove("step-circle-complete");
        const isS3Valid = checkSectionValidity(
          fieldset3,
          triggerSectionValidation
        );
        stepCircle3.classList.toggle("step-circle-complete", isS3Valid);
        stepCircle3.classList.toggle("step-circle-active", !isS3Valid);
        submitButton.disabled = !isS3Valid;
      } else {
        fieldset3.disabled = true;
        stepCircle3.classList.remove(
          "step-circle-active",
          "step-circle-complete"
        );
        submitButton.disabled = true;
      }
    }

    async function cargarVehiculosCliente() {
      const telefono = phoneInput.value.trim();
      if (!telefono || !isValidPhone(telefono)) {
        selectVehiculo.innerHTML =
          '<option value="" disabled selected>-- Teléfono de cliente inválido --</option>';
        return;
      }
      if (clienteVehiculosCache[telefono]) {
        populateVehicleSelect(clienteVehiculosCache[telefono]);
        updateFormState();
        return;
      }
      selectVehiculo.disabled = true;
      selectVehiculo.innerHTML =
        '<option value="" disabled selected>-- Cargando vehículos... --</option>';
      try {
        const response = await fetch(
          `http://localhost:3000/api/vehiculos/cliente?telefono=${encodeURIComponent(
            telefono
          )}`
        );
        const result = await response.json();
        if (response.ok && result.success) {
          clienteVehiculosCache[telefono] = result.vehicles;
          populateVehicleSelect(result.vehicles);
        } else {
          selectVehiculo.innerHTML = `<option value="" disabled selected>-- ${
            result.message || "No se encontraron vehículos"
          } --</option>`;
          clienteVehiculosCache[telefono] = [];
        }
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        selectVehiculo.innerHTML =
          '<option value="" disabled selected>-- Error al cargar vehículos --</option>';
        showActionFeedback("Error al cargar vehículos del cliente.", "error");
        clienteVehiculosCache[telefono] = [];
      } finally {
        selectVehiculo.disabled = false;
        updateFormState(true);
      }
    }

    function populateVehicleSelect(vehicles) {
      selectVehiculo.innerHTML = "";
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
          option.textContent = `${v.marca} ${v.modelo} (${v.placa || "S/P"})`;
          selectVehiculo.appendChild(option);
        });
      }
    }

    async function cargarServiciosSelect() {
      if (!selectServicio || serviciosDisponibles.length > 0) return;
      selectServicio.innerHTML =
        '<option value="" disabled selected>-- Cargando servicios... --</option>';
      try {
        const response = await fetch(
          "http://localhost:3000/api/servicios?activos=true"
        );
        const data = await response.json();
        if (response.ok && data.success && data.servicios) {
          serviciosDisponibles = data.servicios;
          selectServicio.innerHTML = "";
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
          const otrosOption = document.createElement("option");
          otrosOption.value = "otros";
          otrosOption.textContent = "Otros servicios / Diagnóstico";
          selectServicio.appendChild(otrosOption);
        } else {
          console.error("Error al cargar servicios activos:", data.message);
          selectServicio.innerHTML =
            '<option value="" disabled selected>-- Error al cargar --</option>';
        }
      } catch (error) {
        console.error("Error de red al cargar servicios activos:", error);
        selectServicio.innerHTML =
          '<option value="" disabled selected>-- Error de red --</option>';
      }
    }

    function toggleNewVehicleForm() {
      isAddingNewVehicle = !addNewVehicleSection.classList.toggle("hidden");
      isNewVehicleInput.value = isAddingNewVehicle ? "1" : "0";
      saveVehicleFeedback.innerHTML = "";
      apiFeedbackMessageDiv.innerHTML = "";
      const sectionToClear = isAddingNewVehicle
        ? selectVehiculo.closest(".col-span-full")
        : addNewVehicleSection;
      sectionToClear.querySelectorAll(".is-invalid").forEach((el) => {
        el.classList.remove("is-invalid", "interacted", "submit-attempted");
        const errorSpan = document.getElementById(`error-${el.id}`);
        if (errorSpan) errorSpan.style.display = "none";
      });
      document.getElementById("error-select-vehiculo-cliente").style.display =
        "none";
      if (isAddingNewVehicle) {
        selectVehiculo.value = "";
        selectVehiculo.required = false;
        newVehicleInputs.forEach((input) => (input.required = true));
        btnToggleAddVehicle.innerHTML =
          '<i class="fas fa-times mr-1"></i> Cancelar Añadir';
      } else {
        selectVehiculo.required = true;
        newVehicleInputs.forEach((input) => {
          input.required = false;
          input.value = "";
        });
        btnToggleAddVehicle.innerHTML =
          '<i class="fas fa-plus mr-1"></i> Añadir Nuevo Vehículo';
        const telefono = phoneInput.value.trim();
        if (clienteVehiculosCache[telefono]) {
          populateVehicleSelect(clienteVehiculosCache[telefono]);
        } else {
          selectVehiculo.innerHTML =
            '<option value="" disabled selected>-- Ingrese teléfono del cliente primero --</option>';
        }
      }
      updateFormState(true);
    }

    async function handleAvatarUpload(event) {
      console.log("DEBUG: Avatar file input changed.");
      const file = event.target.files[0];
      if (!file) {
        console.log("DEBUG: No file selected.");
        return;
      }
      let localCurrentUser = currentUser;
      if (!localCurrentUser || !localCurrentUser.id) {
        console.error(
          "Error: No se pudo obtener el ID del usuario actual para subir avatar."
        );
        showActionFeedback(
          "Error: No se pudo identificar al usuario.",
          "error"
        );
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

    form.addEventListener(
      "blur",
      (event) => {
        const target = event.target;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA"
        ) {
          target.classList.add("interacted");
          validateField(target, true);
          updateFormState();
        }
      },
      true
    );
    form.addEventListener("input", () => updateFormState(false));
    form.addEventListener("change", () => updateFormState(false));
    btnToggleAddVehicle.addEventListener("click", toggleNewVehicleForm);
    phoneInput.addEventListener("blur", () => {
      if (isValidPhone(phoneInput.value)) {
        cargarVehiculosCliente();
      } else {
        selectVehiculo.innerHTML =
          '<option value="" disabled selected>-- Teléfono de cliente inválido --</option>';
        clienteVehiculosCache = {};
        updateFormState();
      }
    });
    if (logoutButton)
      logoutButton.addEventListener("click", () => {
        localStorage.removeItem("userData");
        window.location.replace("login.html");
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

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      apiFeedbackMessageDiv.innerHTML = "";

      const isS1Valid = checkSectionValidity(fieldset1, true);
      let isS2Valid = false;
      if (isAddingNewVehicle) {
        isS2Valid = checkNewVehicleSectionValidity(true);
      } else {
        isS2Valid = checkSectionValidity(fieldset2, true);
      }
      const isS3Valid = checkSectionValidity(fieldset3, true);
      form
        .querySelectorAll("input, select, textarea")
        .forEach((el) => el.classList.add("submit-attempted"));

      if (isS1Valid && isS2Valid && isS3Valid) {
        submitButton.disabled = true;
        showActionFeedback("Guardando cita...", "loading");

        const formData = {
          nombres_cliente: document.getElementById("nombres-cliente").value,
          apellidos_cliente: document.getElementById("apellidos-cliente").value,
          email_cliente: document.getElementById("email-cliente").value,
          telefono_cliente: document.getElementById("telefono-cliente").value,
          is_new_vehicle: isAddingNewVehicle ? "1" : "0",
          vehiculo_registrado_id: isAddingNewVehicle
            ? null
            : selectVehiculo.value,
          marca_vehiculo: isAddingNewVehicle
            ? document.getElementById("marca-vehiculo").value
            : null,
          modelo_vehiculo: isAddingNewVehicle
            ? document.getElementById("modelo-vehiculo").value
            : null,
          ano_vehiculo: isAddingNewVehicle
            ? document.getElementById("ano-vehiculo").value
            : null,
          placa_vehiculo: isAddingNewVehicle
            ? document.getElementById("placa-vehiculo").value
            : null,
          kilometraje: document.getElementById("kilometraje").value || null,
          servicio_id: document.getElementById("select-servicio").value,
          detalle_sintomas: document.getElementById("detalle-sintomas").value,
          fecha_cita: dateInput.value,
          hora_cita: timeInput.value,
          userId: localCurrentUser.id,
        };

        const apiUrl = "http://localhost:3000/api/citas";
        const apiMethod = "POST";

        console.log(`Enviando datos (${apiMethod}) a ${apiUrl}:`, formData);

        try {
          const response = await fetch(apiUrl, {
            method: apiMethod,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          const result = await response.json();

          const loadingMsg =
            globalFeedbackContainer?.querySelector(".feedback-loading");
          if (loadingMsg) loadingMsg.remove();

          if (response.ok && result.success) {
            showActionFeedback(
              result.message || "Cita guardada exitosamente.",
              "success"
            );
            console.log("DEBUG: Mensaje de éxito mostrado.");
            submitButton.disabled = true;

            setTimeout(() => {
              console.log(
                "DEBUG: Redirigiendo a Mis Citas después de 2 segundos..."
              );
              window.location.href = "admin_miscitas.html";
            }, 2000);
          } else {
            showActionFeedback(
              result.message ||
                "Error al guardar la cita. Verifique los datos.",
              "error"
            );
            submitButton.disabled = false;
          }
        } catch (error) {
          const loadingMsg =
            globalFeedbackContainer?.querySelector(".feedback-loading");
          if (loadingMsg) loadingMsg.remove();
          console.error("Error de red al enviar el formulario:", error);
          showActionFeedback(
            "Error de conexión con el servidor. Intente nuevamente.",
            "error"
          );
          submitButton.disabled = false;
        }
      } else {
        console.log("Formulario inválido.");
        showActionFeedback(
          "Formulario inválido. Por favor corrija los errores marcados.",
          "error"
        );
        form.querySelector(".is-invalid")?.focus();
      }
    });

    async function inicializarPagina() {
      await cargarServiciosSelect();
      if (dateInput) dateInput.setAttribute("min", todayString);
      if (selectVehiculo) selectVehiculo.required = !isAddingNewVehicle;
      updateFormState();
      console.log(
        "Panel de administración (Nuevo Servicio) cargado y lógica inicializada."
      );
    }
    inicializarPagina();
  } else {
    console.error("Authentication failed after DOM loaded. Redirecting.");
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
  }
});
