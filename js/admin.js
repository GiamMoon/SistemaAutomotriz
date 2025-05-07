document.addEventListener("DOMContentLoaded", () => {
    
    let localCurrentUser = currentUser && currentUser.id ? currentUser : null;
    let isAuthenticatedOnLoad = !!localCurrentUser; 
  
    if (isAuthenticatedOnLoad) {
      document.body.classList.remove("auth-pending");
      ////console.log("Auth valid, initializing page script for admin.js...");
  
      
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
      const newVehicleInputs = addNewVehicleSection.querySelectorAll("input[required]"); 
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
        ////console.log("No avatarUrl found for user, using default placeholder.");
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
              //console.warn("Contenedor de feedback global no encontrado en el DOM. Creando uno nuevo.");
              feedbackContainer = document.createElement("div");
              feedbackContainer.id = "global-feedback-container";
              feedbackContainer.style.position = "fixed";
              feedbackContainer.style.bottom = "1rem";
              feedbackContainer.style.right = "1rem";
              feedbackContainer.style.zIndex = "1050"; 
              feedbackContainer.style.display = "flex";
              feedbackContainer.style.flexDirection = "column";
              feedbackContainer.style.gap = "0.5rem";
              feedbackContainer.style.alignItems = "flex-end";
              document.body.appendChild(feedbackContainer);
              
          }
  
          const feedbackDiv = document.createElement("div");
          let bgColor, iconClass, textColor;
  
          switch (type) {
              case "success":
                  bgColor = "bg-green-500"; 
                  iconClass = "fas fa-check-circle";
                  textColor = "text-white";
                  break;
              case "error":
                  bgColor = "bg-red-500"; 
                  iconClass = "fas fa-exclamation-triangle";
                  textColor = "text-white";
                  break;
              case "loading":
                  bgColor = "bg-blue-500"; 
                  iconClass = "fas fa-spinner fa-spin";
                  textColor = "text-white";
                  break;
              default: 
                  bgColor = "bg-gray-700"; 
                  iconClass = "fas fa-info-circle";
                  textColor = "text-white";
                  break;
          }
  
          feedbackDiv.className = `global-feedback-message p-4 rounded-lg shadow-xl flex items-center text-sm ${bgColor} ${textColor}`;
          feedbackDiv.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";
          feedbackDiv.style.opacity = "0";
          feedbackDiv.style.transform = "translateY(10px)"; 
  
          feedbackDiv.innerHTML = `<span class="inline-block align-middle mr-3"><i class="${iconClass} text-xl"></i></span><span class="inline-block align-middle">${message}</span>`;
          feedbackContainer.appendChild(feedbackDiv);
  
          
          void feedbackDiv.offsetWidth;
          feedbackDiv.style.opacity = "1";
          feedbackDiv.style.transform = "translateY(0)";
  
          if (type !== "loading") {
              setTimeout(() => {
                  feedbackDiv.style.opacity = "0";
                  feedbackDiv.style.transform = "translateY(10px)";
                  feedbackDiv.addEventListener("transitionend", () => feedbackDiv.remove());
                  setTimeout(() => { 
                      if (feedbackDiv.parentNode) feedbackDiv.remove();
                  }, duration + 300);
              }, duration);
          }
          return feedbackDiv; 
      }
  
  
      
      function isValidEmail(email) {
        if (!email && emailInput && !emailInput.required) return true; 
        if (!email) return false;
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
        
        const selectedDate = new Date(dateStr + "T00:00:00"); 
        const today = new Date(todayString + "T00:00:00");
        return selectedDate >= today;
      }
  
      function isValidTime(timeStr) {
        if (!timeStr) return false; 
        return true; 
      }
  
      function isNotEmpty(value) {
        return value && String(value).trim() !== "";
      }
  
      function validateField(input, showErrors = false) {
        const errorSpan = document.getElementById(`error-${input.id}`);
        let isValid = true;
        let errorMessage = "";
  
        const esCampoNuevoVehiculo = addNewVehicleSection.contains(input);
  
        
        if (input.required && !(esCampoNuevoVehiculo && !isAddingNewVehicle)) {
          if (!isNotEmpty(input.value)) {
            isValid = false;
            errorMessage = "Este campo es obligatorio.";
          }
        }
  
        
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
              validationFn = isValidTime; 
          } else if (input.id === "ano-vehiculo" && (isAddingNewVehicle || input.value)) { 
              validationFn = (v) => /^\d{4}$/.test(v) && parseInt(v, 10) >= 1980 && parseInt(v, 10) <= new Date().getFullYear() + 1;
              specificErrorMsg = `Año inválido (4 dígitos, 1980-${new Date().getFullYear() + 1}).`;
          } else if (input.id === "kilometraje" && input.value) { 
              validationFn = (v) => !isNaN(v) && Number(v) >= 0;
              specificErrorMsg = "Kilometraje debe ser un número positivo.";
          } else if (input.id === "select-vehiculo-cliente" && !isAddingNewVehicle && input.required) {
               validationFn = isNotEmpty; 
          } else if (input.id === "select-servicio" && input.required) {
               validationFn = isNotEmpty; 
          }
  
  
          if (validationFn) {
            const currentFieldValid = validationFn(input.value);
            if (!currentFieldValid) {
              isValid = false;
              errorMessage = specificErrorMsg || errorMessage; 
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
        const isS1Valid = checkSectionValidity(fieldset1, triggerSectionValidation);
        let isS2CompleteForS3 = false;
  
        stepCircle1.classList.toggle("step-circle-complete", isS1Valid);
        stepCircle1.classList.toggle("step-circle-active", !isS1Valid);
  
        if (isS1Valid) {
          if (fieldset2.disabled) {
            fieldset2.disabled = false;
            
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
  
        
        if (clienteVehiculosCache[telefono]) {
          populateVehicleSelect(clienteVehiculosCache[telefono]);
          updateFormState(); 
          return;
        }
  
        selectVehiculo.disabled = true;
        selectVehiculo.innerHTML = '<option value="" disabled selected>-- Cargando vehículos... --</option>';
  
        try {
          const response = await fetch(
            `/api/vehiculos/cliente?telefono=${encodeURIComponent(telefono)}` 
          );
          const result = await response.json();
  
          if (response.ok && result.success) {
            clienteVehiculosCache[telefono] = result.vehicles || []; 
            populateVehicleSelect(result.vehicles);
          } else {
            selectVehiculo.innerHTML = `<option value="" disabled selected>-- ${result.message || "No se encontraron vehículos"} --</option>`;
            clienteVehiculosCache[telefono] = []; 
          }
        } catch (error) {
          //console.error("Error fetching vehicles for client:", error);
          selectVehiculo.innerHTML = '<option value="" disabled selected>-- Error al cargar vehículos --</option>';
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
            
            option.textContent = `${v.marca_vehiculo || v.marca || 'Marca Desconocida'} ${v.modelo_vehiculo || v.modelo || 'Modelo Desconocido'} (${v.placa_vehiculo || v.placa || "S/P"})`;
            selectVehiculo.appendChild(option);
          });
        } else {
           
           const noVehiclesOption = document.createElement("option");
           noVehiclesOption.value = "";
           noVehiclesOption.textContent = "-- No hay vehículos registrados para este cliente --";
           noVehiclesOption.disabled = true;
           selectVehiculo.innerHTML = ''; 
           selectVehiculo.appendChild(noVehiclesOption);
        }
      }
  
      async function cargarServiciosSelect() {
        if (!selectServicio || serviciosDisponibles.length > 0) return; 
        selectServicio.innerHTML = '<option value="" disabled selected>-- Cargando servicios... --</option>';
        try {
          const response = await fetch("/api/servicios?activos=true"); 
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
            //console.error("Error al cargar servicios activos:", data.message);
            selectServicio.innerHTML = '<option value="" disabled selected>-- Error al cargar --</option>';
          }
        } catch (error) {
          //console.error("Error de red al cargar servicios activos:", error);
          selectServicio.innerHTML = '<option value="" disabled selected>-- Error de red --</option>';
        }
      }
  
      function toggleNewVehicleForm() {
          isAddingNewVehicle = !addNewVehicleSection.classList.toggle("hidden");
          isNewVehicleInput.value = isAddingNewVehicle ? "1" : "0";
  
          
          if(saveVehicleFeedback) saveVehicleFeedback.innerHTML = "";
          if(apiFeedbackMessageDiv) apiFeedbackMessageDiv.innerHTML = "";
  
          const sectionToClearValidation = isAddingNewVehicle ? selectVehiculo.closest('.form-section-fieldset > div') : addNewVehicleSection;
          sectionToClearValidation.querySelectorAll(".is-invalid").forEach((el) => {
              el.classList.remove("is-invalid", "interacted", "submit-attempted");
              const errorSpan = document.getElementById(`error-${el.id}`);
              if (errorSpan) errorSpan.style.display = "none";
          });
          
          const errorSelectVehiculo = document.getElementById("error-select-vehiculo-cliente");
          if(errorSelectVehiculo) errorSelectVehiculo.style.display = "none";
  
  
          if (isAddingNewVehicle) {
              selectVehiculo.value = ""; 
              selectVehiculo.required = false;
              newVehicleInputs.forEach((input) => (input.required = true));
              btnToggleAddVehicle.innerHTML = '<i class="fas fa-times mr-1"></i> Cancelar Añadir Vehículo';
          } else {
              selectVehiculo.required = true;
              newVehicleInputs.forEach((input) => {
                  input.required = false;
                  input.value = ""; 
              });
              btnToggleAddVehicle.innerHTML = '<i class="fas fa-plus mr-1"></i> Añadir Nuevo Vehículo';
              
              const telefono = phoneInput.value.trim();
              if (clienteVehiculosCache[telefono]) {
                  populateVehicleSelect(clienteVehiculosCache[telefono]);
              } else {
                  
                  selectVehiculo.innerHTML = '<option value="" disabled selected>-- Ingrese teléfono del cliente primero --</option>';
              }
          }
          updateFormState(true); 
      }
  
  
      async function handleAvatarUpload(event) {
          ////console.log("DEBUG: Avatar file input changed.");
          const file = event.target.files[0];
          if (!file) {
              ////console.log("DEBUG: No file selected.");
              return;
          }
  
          const currentUserForUpload = currentUser; 
          if (!currentUserForUpload || !currentUserForUpload.id) {
              //console.error("Error: No se pudo obtener el ID del usuario actual para subir avatar.");
              showActionFeedback("Error: No se pudo identificar al usuario.", "error");
              return;
          }
  
          const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
          const maxSize = 2 * 1024 * 1024; 
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
              const apiUrl = `/api/users/${currentUserForUpload.id}/avatar`; 
              ////console.log(`DEBUG: Sending POST to ${apiUrl} for avatar upload.`);
              const response = await fetch(apiUrl, {
                  method: "POST",
                  body: formData,
              });
  
              if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
  
              const result = await response.json();
              ////console.log("DEBUG: Server response (avatar upload):", result);
  
              if (response.ok && result.success && result.avatarUrl) {
                  ////console.log("DEBUG: Avatar uploaded successfully. New URL:", result.avatarUrl);
                  if (userAvatarImg) {
                      userAvatarImg.src = result.avatarUrl;
                  }
                  currentUserForUpload.avatarUrl = result.avatarUrl; 
                  localStorage.setItem("userData", JSON.stringify(currentUserForUpload)); 
                  ////console.log("DEBUG: User data updated in localStorage with new avatarUrl.");
                  showActionFeedback(result.message || "Foto de perfil actualizada.", "success");
              } else {
                  //console.error("Error in server response (avatar upload):", result.message || response.statusText);
                  showActionFeedback(result.message || "Error al subir la foto.", "error");
              }
          } catch (error) {
              if (loadingFeedback && loadingFeedback.parentNode) loadingFeedback.remove();
              //console.error("Network error during avatar upload:", error);
              showActionFeedback("Error de conexión al subir la foto.", "error");
          } finally {
              if(avatarUploadInput) avatarUploadInput.value = ""; 
              ////console.log("DEBUG: Avatar file input reset.");
          }
      }
  
  
      
      form.addEventListener("blur", (event) => {
          const target = event.target;
          if ( target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") {
              target.classList.add("interacted"); 
              validateField(target, true); 
              updateFormState(); 
          }
      }, true); 
  
      form.addEventListener("input", () => updateFormState(false)); 
      form.addEventListener("change", () => updateFormState(false)); 
  
      if(btnToggleAddVehicle) btnToggleAddVehicle.addEventListener("click", toggleNewVehicleForm);
  
      if(phoneInput) phoneInput.addEventListener("blur", () => {
          
          if (isValidPhone(phoneInput.value)) {
              cargarVehiculosCliente();
          } else {
              
              selectVehiculo.innerHTML = '<option value="" disabled selected>-- Teléfono de cliente inválido --</option>';
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
            if(profileDropdownMenu) profileDropdownMenu.classList.add("hidden");
          });
        }
      }
  
  
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if(apiFeedbackMessageDiv) apiFeedbackMessageDiv.innerHTML = ""; 
  
        
        const isS1Valid = checkSectionValidity(fieldset1, true);
        let isS2Valid = false;
        if (isAddingNewVehicle) {
          isS2Valid = checkNewVehicleSectionValidity(true);
        } else {
          isS2Valid = checkSectionValidity(fieldset2, true); 
        }
        const isS3Valid = checkSectionValidity(fieldset3, true);
  
        
        form.querySelectorAll("input, select, textarea").forEach((el) => el.classList.add("submit-attempted"));
  
        if (isS1Valid && isS2Valid && isS3Valid) {
          if(submitButton) submitButton.disabled = true;
          const loadingSubmit = showActionFeedback("Guardando cita...", "loading");
  
          const formDataPayload = {
            nombres_cliente: document.getElementById("nombres-cliente").value.trim(),
            apellidos_cliente: document.getElementById("apellidos-cliente").value.trim(),
            email_cliente: document.getElementById("email-cliente").value.trim() || null, 
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
            userId: localCurrentUser.id, 
          };
  
          const apiUrl = "/api/citas"; 
          const apiMethod = "POST";
  
          ////console.log(`Enviando datos (${apiMethod}) a ${apiUrl}:`, formDataPayload);
  
          try {
            const response = await fetch(apiUrl, {
              method: apiMethod,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(formDataPayload),
            });
            const result = await response.json();
  
            if(loadingSubmit && loadingSubmit.parentNode) loadingSubmit.remove(); 
  
            if (response.ok && result.success) {
              showActionFeedback(result.message || "Cita guardada exitosamente.", "success");
              ////console.log("DEBUG: Mensaje de éxito mostrado.");
              if(submitButton) submitButton.disabled = true; 
  
              setTimeout(() => {
                ////console.log("DEBUG: Redirigiendo a Mis Citas después de 2 segundos...");
                window.location.href = "admin_miscitas.html";
              }, 2000); 
            } else {
              showActionFeedback(result.message || "Error al guardar la cita. Verifique los datos.", "error");
              if(submitButton) submitButton.disabled = false; 
            }
          } catch (error) {
            if(loadingSubmit && loadingSubmit.parentNode) loadingSubmit.remove();
            //console.error("Error de red al enviar el formulario:", error);
            showActionFeedback("Error de conexión con el servidor. Intente nuevamente.", "error");
            if(submitButton) submitButton.disabled = false; 
          }
        } else {
          ////console.log("Formulario inválido. No se enviará.");
          showActionFeedback("Formulario inválido. Por favor corrija los errores marcados.", "error");
          
          const firstInvalidField = form.querySelector(".is-invalid");
          if (firstInvalidField) firstInvalidField.focus();
        }
      });
  
      
      async function inicializarPagina() {
        await cargarServiciosSelect(); 
        if (dateInput) dateInput.setAttribute("min", todayString); 
        if (selectVehiculo) selectVehiculo.required = !isAddingNewVehicle; 
        updateFormState(); 
        ////console.log("Panel de administración (Nuevo Servicio) cargado y lógica inicializada.");
      }
  
      inicializarPagina();
  
    } else {
      
      
      
      //console.error("Authentication failed after DOM loaded in admin.js. Redirecting (should have happened already).");
      if (!window.location.pathname.endsWith("login.html")) {
        window.location.replace("login.html");
      }
    }
  });
  