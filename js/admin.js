// js/admin.js - VIDAFEM v3.1 (CRUD Completo + Modularidad)

let allPatients = [];
let isDeletingPatient = false;

function getSessionDataSafe() {
  try {
    const raw = sessionStorage.getItem("vidafem_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function requireDoctorSession() {
  const s = getSessionDataSafe();
  const role = s && s.role ? String(s.role).toLowerCase() : "";
  if (!s || (role !== "admin" && role !== "doctor")) {
    alert("Sesion invalida o expirada. Inicia sesion nuevamente.");
    try { sessionStorage.removeItem("vidafem_session"); } catch (e) {}
    window.location.href = "index.html";
    return null;
  }
  return s;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!requireDoctorSession()) return;
  loadDoctorProfileFromSession();
  setupDoctorProfileEditForm();
  setupProfilePasswordForm();
  setupNavigation();
  loadDashboardStats();
  setupSearch();
});

// ============================
// 1. UTILIDADES Y CÁLCULOS
// ============================

// Calcular EDAD REAL
function calculateAge(dateString) {
  if (!dateString) return "-";
  const today = new Date();
  const birthDate = new Date(dateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age + " años";
}

// Formatear fecha para el input type="date" (YYYY-MM-DD)
function toInputDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toISOString().split("T")[0];
}

// Validar longitud (10 caracteres)
function validateLength(value) {
  return value.length === 10 && !isNaN(value);
}

function getRequesterFromSession() {
  const s = requireDoctorSession();
  if (!s) return null;
  return (s.data && (s.data.usuario || s.data.usuario_doctor || s.data.nombre_doctor)) || null;
}

function normalizePhoneForWa_(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.charAt(0) === "0") {
    digits = "593" + digits.substring(1);
  } else if (digits.length === 9) {
    digits = "593" + digits;
  }
  return digits;
}

function setNotifyLoginButtonVisible_(visible) {
  const btn = document.getElementById("btnNotifyLogin");
  if (!btn) return;
  btn.style.display = visible ? "inline-flex" : "none";
}

function loadDoctorProfileFromSession() {
  const s = getSessionDataSafe();
  if (!s || !s.data) return;

  const d = s.data;
  const name = d.nombre_doctor || d.nombre || d.usuario || "Doctor";
  const user = d.usuario || d.usuario_doctor || "";
  const role = d.rol || "DOCTOR";
  const email = d.correo_notificaciones || d.correo || "";
  const phone = d.telefono || "";

  const elName = document.getElementById("profileDoctorName");
  const elUser = document.getElementById("profileDoctorUser");
  const elRole = document.getElementById("profileDoctorRole");
  const elEmail = document.getElementById("profileDoctorEmail");
  const elPhone = document.getElementById("profileDoctorPhone");

  if (elName) elName.innerText = name;
  if (elUser) elUser.innerText = user;
  if (elRole) elRole.innerText = role;
  if (elEmail) elEmail.innerText = email || "--";
  if (elPhone) elPhone.innerText = phone || "--";
}

function openDoctorProfileEditModal_() {
  const s = getSessionDataSafe();
  if (!s || !s.data) return;

  const d = s.data;
  const elUser = document.getElementById("profileEditUsuario");
  const elName = document.getElementById("profileEditNombre");
  const elEmail = document.getElementById("profileEditCorreo");
  const elPhone = document.getElementById("profileEditTelefono");

  if (elUser) elUser.value = d.usuario || d.usuario_doctor || "";
  if (elName) elName.value = d.nombre_doctor || d.nombre || "";
  if (elEmail) elEmail.value = d.correo_notificaciones || d.correo || "";
  if (elPhone) elPhone.value = d.telefono || "";

  openModal("modalDoctorProfileEdit");
}

function setupDoctorProfileEditForm() {
  const btnOpen = document.getElementById("btnEditDoctorProfile");
  if (btnOpen) btnOpen.addEventListener("click", openDoctorProfileEditModal_);

  const inputName = document.getElementById("profileEditNombre");
  const inputMail = document.getElementById("profileEditCorreo");
  const inputPhone = document.getElementById("profileEditTelefono");
  if (inputName) {
    inputName.addEventListener("input", (e) => {
      e.target.value = String(e.target.value || "").toUpperCase();
    });
  }
  if (inputMail) {
    inputMail.addEventListener("input", (e) => {
      e.target.value = String(e.target.value || "").toLowerCase();
    });
  }
  if (inputPhone) {
    inputPhone.addEventListener("input", (e) => {
      e.target.value = String(e.target.value || "").replace(/[^\d]/g, "");
    });
  }

  const form = document.getElementById("formDoctorProfileEdit");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const s = getSessionDataSafe();
    if (!s || !s.data) {
      alert("Sesion invalida. Inicia sesion nuevamente.");
      return;
    }

    const user = String(s.data.usuario || s.data.usuario_doctor || "").trim();
    if (!user) {
      alert("No se pudo identificar el usuario.");
      return;
    }

    const payload = {
      nombre_doctor: String((inputName && inputName.value) || "").trim(),
      correo_notificaciones: String((inputMail && inputMail.value) || "").trim(),
      telefono: String((inputPhone && inputPhone.value) || "").trim()
    };

    const btnSave = document.getElementById("btnSaveDoctorProfile");
    const oldText = btnSave ? btnSave.innerText : "";
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerText = "Guardando...";
    }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "self_update_admin_profile",
          user_id: user,
          requester: user,
          data: payload
        })
      }).then((r) => r.json());

      if (!res || !res.success) {
        alert("Error: " + (res && res.message ? res.message : "No se pudo actualizar."));
        return;
      }

      try {
        const raw = sessionStorage.getItem("vidafem_session");
        if (raw) {
          const updated = JSON.parse(raw);
          if (updated && updated.data && res.data) {
            updated.data.nombre_doctor = res.data.nombre_doctor || updated.data.nombre_doctor || "";
            updated.data.correo_notificaciones = res.data.correo || res.data.correo_notificaciones || updated.data.correo_notificaciones || "";
            updated.data.telefono = res.data.telefono || updated.data.telefono || "";
            sessionStorage.setItem("vidafem_session", JSON.stringify(updated));
          }
        }
      } catch (err) {}

      loadDoctorProfileFromSession();
      closeModal("modalDoctorProfileEdit");
      if (window.showToast) window.showToast("Perfil actualizado.", "success");
      else alert("Perfil actualizado.");
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerText = oldText;
      }
    }
  });
}

function setupProfilePasswordForm() {
  const form = document.getElementById("formProfilePassword");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const s = getSessionDataSafe();
    if (!s || !s.data) {
      alert("Sesion invalida. Inicia sesion nuevamente.");
      return;
    }

    const newPass = document.getElementById("profileNewPassword");
    const confirmPass = document.getElementById("profileConfirmPassword");
    const passVal = newPass ? newPass.value.trim() : "";
    const confirmVal = confirmPass ? confirmPass.value.trim() : "";

    if (!passVal || !confirmVal) {
      alert("Completa la nueva contrasena.");
      return;
    }
    if (passVal !== confirmVal) {
      alert("Las contrasenas no coinciden.");
      return;
    }

    const ok = window.appConfirm
      ? await window.appConfirm({
          title: "Cambiar contrasena",
          message: "Estas seguro de cambiar tu contrasena",
          confirmText: "Si, cambiar",
          cancelText: "Cancelar",
        })
      : confirm("Estas seguro de cambiar tu contrasena");
    if (!ok) return;

    const usuario = s.data.usuario || s.data.usuario_doctor || "";
    if (!usuario) {
      alert("No se pudo identificar el usuario.");
      return;
    }

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "self_update_password",
        role: "admin",
        user_id: usuario,
        new_password: passVal,
        requester: usuario,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res && res.success) {
          if (newPass) newPass.value = "";
          if (confirmPass) confirmPass.value = "";
          if (window.showToast) window.showToast("Contrasena actualizada.", "success");
          else alert("Contrasena actualizada.");
          try {
            const raw = sessionStorage.getItem("vidafem_session");
            if (raw) {
              const updated = JSON.parse(raw);
              sessionStorage.setItem("vidafem_session", JSON.stringify(updated));
            }
          } catch (err) {}
        } else {
          alert("Error: " + (res && res.message ? res.message : "No se pudo actualizar."));
        }
      })
      .catch(() => {
        alert("Error de conexion.");
      });
  });
}

// ============================
// 2. TABLA Y DATOS
// ============================

function loadPatientsTable() {
  const tbody = document.getElementById("patientsTableBody");
  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center">Actualizando base de datos...</td></tr>';

  // Incluir requester (doctor) para que backend retorne solo sus pacientes
  const requester = getRequesterFromSession();

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_data", sheet: "pacientes", requester: requester }),
  })
    .then((r) => r.json())
    .then((response) => {
      if (response.success && response.data.length > 0) {
        allPatients = response.data.reverse();
        renderTable(allPatients.slice(0, 5));

        const statCounter = document.getElementById("stat-total-patients");
        if (statCounter) statCounter.innerText = allPatients.length;
      } else {
        allPatients = [];
        tbody.innerHTML =
          '<tr><td colspan="5" class="text-center">No hay pacientes registrados.</td></tr>';
      }
    })
    .catch((error) => {
      console.error(error);
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center" style="color:red">Error de conexión.</td></tr>';
    });
}

function renderTable(dataArray) {
  const tbody = document.getElementById("patientsTableBody");
  tbody.innerHTML = "";

  if (dataArray.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center">No se encontraron coincidencias.</td></tr>';
    return;
  }

  dataArray.forEach((paciente) => {
    const tr = document.createElement("tr");
    tr.style.animation = "fadeIn 0.3s ease-out";

    const edad = calculateAge(paciente.fecha_nacimiento);

    tr.innerHTML = `
            <td><strong>${paciente.cedula}</strong></td>
            <td>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:600; color:var(--c-primary)">${paciente.nombre_completo}</span>
                </div>
            </td>
            <td>${edad}</td>
            <td>${paciente.telefono || "-"}</td>
            <td>
                <div style="display:flex; gap:10px;">
                    <button class="btn-icon" onclick="editPatient('${paciente.id_paciente}')" title="Editar">
                        <i class="fas fa-pencil-alt" style="color:#3498db;"></i>
                    </button>
                    
                    <button class="btn-icon" onclick="deletePatient('${paciente.id_paciente}')" title="Eliminar">
                        <i class="fas fa-trash" style="color:#e74c3c;"></i>
                    </button>

                    <button class="btn-icon" onclick="goToClinical('${paciente.id_paciente}')" title="Abrir Expediente">
                         <i class="fas fa-folder-open" style="color:var(--c-primary);"></i>
                    </button>
                </div>
            </td>
        `;
    tbody.appendChild(tr);
  });
}

// ============================
// 3. ACCIONES CRUD (Crear, Editar, Borrar)
// ============================

// ABRIR MODAL PARA CREAR (Limpio)
window.openCreateModal = function () {
  document.getElementById("formNewPatient").reset();
  document.getElementById("editPatientId").value = ""; // ID vacío = Crear
  document.getElementById("btnSubmitPatient").innerText = "Guardar Paciente";
  document.querySelector(".modal-header h3").innerText = "Nuevo Paciente";
  setNotifyLoginButtonVisible_(false);

  // Limpiar errores visuales
  resetValidationUI();

  openModal("modalPatient");
};

// ABRIR MODAL PARA EDITAR (Lleno)
window.editPatient = function (id) {
  const paciente = allPatients.find((p) => p.id_paciente === id);
  if (!paciente) return;

  // Llenar campos básicos
  document.getElementById("editPatientId").value = paciente.id_paciente;
  document.getElementById("inpNombre").value = paciente.nombre_completo;
  document.getElementById("inpCedula").value = paciente.cedula;
  document.getElementById("inpPass").value = paciente.password;
  document.getElementById("inpFecha").value = toInputDate(
    paciente.fecha_nacimiento,
  );
  document.getElementById("inpTel").value = paciente.telefono;
  document.getElementById("inpCorreo").value = paciente.correo;
  document.getElementById("inpDir").value = paciente.direccion || "";
  document.getElementById("inpOcupacion").value = paciente.ocupacion || "";

  // IMPORTANTE: Llenar también antecedentes
  const inpAntecedentes = document.getElementById("inpAntecedentes");
  if (inpAntecedentes) {
    inpAntecedentes.value = paciente.antecedentes || "";
  }

  // Cambiar textos
  document.getElementById("btnSubmitPatient").innerText = "Actualizar Datos";
  document.querySelector(".modal-header h3").innerText = "Editar Paciente";
  setNotifyLoginButtonVisible_(true);

  resetValidationUI();
  openModal("modalPatient");
};

window.notifyPatientLoginFromModal = function () {
  const idPaciente = String(document.getElementById("editPatientId").value || "").trim();
  if (!idPaciente) {
    alert("Esta opcion solo aplica cuando editas un paciente.");
    return;
  }

  const nombre = String(document.getElementById("inpNombre").value || "").trim();
  const cedula = String(document.getElementById("inpCedula").value || "").replace(/[^\d]/g, "");
  const password = String(document.getElementById("inpPass").value || "").trim();
  const phoneRaw = String(document.getElementById("inpTel").value || "").trim();
  const waNumber = normalizePhoneForWa_(phoneRaw);

  if (!waNumber) {
    alert("No se encontro un telefono valido del paciente para WhatsApp.");
    return;
  }
  if (!cedula || !password) {
    alert("Faltan datos de login (cedula o contrasena).");
    return;
  }

  const saludo = nombre ? `Estimad@ ${nombre},` : "Estimad@ paciente,";
  const msg =
    `${saludo}\n\n` +
    `Sus datos de inicio de sesion son:\n` +
    `Usuario: ${cedula}\n` +
    `Contrasena: ${password}\n\n` +
    `Por seguridad, puede cambiar su contrasena en su primer ingreso.\n` +
    `Atentamente,\nVIDAFEM`;

  const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
};

// ELIMINAR PACIENTE
window.deletePatient = async function (id) {
  if (isDeletingPatient) {
    alert("Ya se esta eliminando un paciente. Espera un momento.");
    return;
  }
  const ok = window.appConfirm
    ? await window.appConfirm({
        title: "Eliminar paciente",
        message: "Se borraran paciente, citas, reportes y archivos.\nEsta accion no se puede deshacer.",
        confirmText: "Si, eliminar",
        cancelText: "Cancelar",
      })
    : confirm("Eliminar paciente y todos sus datos");
  if (!ok) return;
  if (false && (
    !confirm(
      "¿Estás seguro de eliminar este paciente Esta acción no se puede deshacer.",
    )
  ))
    return;

  const requester = getRequesterFromSession();
  isDeletingPatient = true;
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete_record",
      sheet: "pacientes",
      id: id,
      requester: requester,
    }),
  })
    .then((r) => r.json())
    .then((res) => {
      if (res.success) {
        alert("Paciente eliminado.");
        loadPatientsTable();
      } else {
        alert("Error: " + res.message);
      }
    })
    .catch(() => {
      alert("Error de conexion al eliminar paciente.");
    })
    .finally(() => {
      isDeletingPatient = false;
    });
};

// GUARDAR (Crear o Editar según si hay ID)
const formNewPatient = document.getElementById("formNewPatient");
if (formNewPatient) {
  formNewPatient.addEventListener("submit", function (e) {
    e.preventDefault();

    // VALIDACIÓN ESTRICTA DE 10 DÍGITOS
    const cedula = document.getElementById("inpCedula");
    const tel = document.getElementById("inpTel");
    let isValid = true;

    // Validar Cedula
    if (!validateLength(cedula.value)) {
      cedula.classList.add("input-error");
      const errCedula = document.getElementById("errorCedula");
      if (errCedula) errCedula.style.display = "block";
      isValid = false;
    } else {
      resetInputUI(cedula, "errorCedula");
    }

    // Validar Telefono (si hay algo escrito)
    if (tel.value.length > 0 && !validateLength(tel.value)) {
      tel.classList.add("input-error");
      const errTel = document.getElementById("errorTel");
      if (errTel) errTel.style.display = "block";
      isValid = false;
    } else {
      resetInputUI(tel, "errorTel");
    }

    if (!isValid) return; // Detener si hay errores

    // Preparar envío
    const btn = document.getElementById("btnSubmitPatient");
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Procesando...";

    const formData = new FormData(this);
    let dataObj = {};
    formData.forEach((value, key) => {
      if (key !== "password" && key !== "correo" && typeof value === "string") {
        dataObj[key] = value.toUpperCase();
      } else {
        dataObj[key] = value;
      }
    });

    // Añadir creador (doctor) para vincular paciente -> doctor
    try {
      const sessionRaw = sessionStorage.getItem('vidafem_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const user = session.data && (session.data.usuario || session.data.usuario_doctor || session.data.nombre_doctor);
        if (user && !dataObj.creado_por) dataObj.creado_por = String(user);
      }
    } catch(e) { console.warn('No se pudo setear creado_por', e); }

    const idPaciente = document.getElementById("editPatientId").value;
    let actionAPI = "create_record";

    if (idPaciente) {
      // MODO EDICIÓN
      actionAPI = "update_record";
    } else {
      // MODO CREACIÓN
      dataObj["id_paciente"] = "P-" + new Date().getTime();
      dataObj["fecha_registro"] = new Date().toISOString().split("T")[0];
    }

    // Añadimos requester en el body para que el backend pueda validar permisos
    const requester = getRequesterFromSession();

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: actionAPI,
        sheet: "pacientes",
        data: dataObj,
        id: idPaciente, // Solo se usa si es update
        requester: requester
      }),
    })
      .then((r) => r.json())
      .then((response) => {
        if (response.success) {
          closeModal("modalPatient");
          showSuccessModal(
            "¡Excelente!",
            idPaciente ? "Datos actualizados." : "Paciente registrado.",
          );
          loadPatientsTable();
          switchView("patients");
        } else {
          alert("Error: " + response.message);
        }
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerText = originalText;
      });
  });
}

// ============================
// 4. NAVEGACIÓN Y SEARCH
// ============================
function setupNavigation() {
  const links = document.querySelectorAll(".menu-link");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      const span = link.querySelector("span");
      if (!span) return;
      const text = span.innerText;

      // Opción Pacientes
      if (text === "Pacientes") {
        e.preventDefault();
        switchView("patients");
        loadPatientsTable();
      }
      // Opción Inicio
      else if (text === "Inicio") {
        e.preventDefault();
        switchView("home");
      }
      else if (text === "Perfil") {
        e.preventDefault();
        switchView("profile");
        loadDoctorProfileFromSession();
      }
      // --- NUEVO: Opción Tipo de Servicio ---
      else if (text === "Tipo de Servicio") {
        e.preventDefault();
        switchView("services");
        loadServicesAdmin(); // Carga la lista de servicios
      }
      // En setupNavigation...
      else if (text === "Agenda") {
        e.preventDefault();
        switchView("agenda");
        // Cargar la fecha que esté seleccionada en el input (o la de hoy)
        const dateInput = document.getElementById("agendaDateInput");
        if (dateInput && dateInput.value) {
          loadAgenda(dateInput.value); // Función de agenda.js
        }
      }
      // ... dentro de setupNavigation ...
      else if (text === "Promociones") {
        e.preventDefault();
        switchView("promotions");
        loadPromoStatus(); // <--- AGREGAR ESTA LLAMADA
      }
    });
  });
}

function switchView(viewName) {
  document
    .querySelectorAll(".view-section")
    .forEach((el) => (el.style.display = "none"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = "block";
    target.style.animation = "none";
    target.offsetHeight;
    target.style.animation = "fadeIn 0.4s ease-out";
  }
}

function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term === "") {
      renderTable(allPatients.slice(0, 5));
      document.getElementById("tableInfo").innerText =
        "Mostrando los últimos registros";
    } else {
      const filtered = allPatients.filter(
        (p) =>
          (p.nombre_completo &&
            p.nombre_completo.toLowerCase().includes(term)) ||
          (p.cedula && String(p.cedula).includes(term)),
      );
      renderTable(filtered);
      document.getElementById("tableInfo").innerText =
        `Encontradas ${filtered.length} coincidencias`;
    }
  });
}

// ============================
// 5. REDIRECCIÓN A CLÍNICA (NUEVO)
// ============================
function goToClinical(id) {
  // Redirige a la página de historia clínica con el ID
  window.location.href = `clinical.htmlid=${id}`;
}

// ============================
// 6. HELPERS Y MODALES
// ============================

function resetValidationUI() {
  // Busca todos los que tengan error y quítaselo
  document
    .querySelectorAll(".input-error")
    .forEach((el) => el.classList.remove("input-error"));

  // Oculta todos los textos de error
  document.querySelectorAll(".error-text").forEach((el) => {
    if (el) el.style.display = "none";
  });
}

function resetInputUI(input, errorId) {
  if (input) input.classList.remove("input-error");

  const errorMsg = document.getElementById(errorId);
  if (errorMsg) {
    errorMsg.style.display = "none";
  }
}

function loadDashboardStats() {
  const requester = getRequesterFromSession();
  // Usamos la nueva acción optimizada que trae todo de una vez
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_dashboard_stats", requester: requester }),
  })
    .then((r) => r.json())
    .then((res) => {
      if (res.success) {
        // Actualizar Pacientes
        const elPacientes = document.getElementById("stat-total-patients");
        if (elPacientes) elPacientes.innerText = res.data.total_pacientes;

        // Actualizar Citas Hoy
        const elHoy = document.getElementById("stat-citas-hoy");
        // Nota: Si usaste IDs diferentes en el HTML, ajústalos aquí
        if (elHoy) elHoy.innerText = res.data.citas_hoy;

        // Actualizar Citas Semana
        const elSemana = document.getElementById("stat-citas-semana");
        if (elSemana) elSemana.innerText = res.data.citas_semana;
      }
    });
}

window.openModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("active");
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
};

function showSuccessModal(title, message) {
  const t = document.getElementById("successTitle");
  const m = document.getElementById("successMessage");
  const modal = document.getElementById("modalSuccess");

  if (t) t.innerText = title;
  if (m) m.innerText = message;
  if (modal) modal.classList.add("active");
}
let globalServices = []; // Variable para guardar los servicios cargados

function loadServicesAdmin() {
  const list = document.getElementById("servicesList");
  list.innerHTML = "Cargando...";
  const requester = getRequesterFromSession();
  const requesterNorm = String(requester || "").trim().toLowerCase();

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_services", requester: requester }),
  })
    .then((r) => r.json())
    .then((res) => {
      list.innerHTML = "";
      if (res.success && res.data.length > 0) {
        globalServices = res.data; // Guardamos en memoria para editar fácil

        res.data.forEach((s) => {
          const li = document.createElement("li");
          li.style.cssText =
            "padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;";

          // Mostrar recomendación cortada si es muy larga
          const shortRec = s.recomendaciones
            ? s.recomendaciones.substring(0, 30) + "..."
            : "Sin rec.";
          const scopeText = s.scope_visibility === "OWNER" ? "Solo para mi" : "Para todos";
          const scopeColor = s.scope_visibility === "OWNER" ? "#d35400" : "#16a085";
          const ownerNorm = String(s.owner_usuario || "").trim().toLowerCase();
          const canManage = !!ownerNorm && ownerNorm === requesterNorm;
          const actionsHtml = canManage
            ? `
                        <button onclick="openEditService('${s.id}')" style="background:none; border:none; color:#3498db; cursor:pointer;" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteService('${s.id}')" style="background:none; border:none; color:red; cursor:pointer;" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>`
            : `<small style="color:#888; font-style:italic;">Solo lectura</small>`;

          li.innerHTML = `
                    <div style="flex:1;">
                        <span style="font-weight:600;">${s.nombre_servicio}</span><br>
                        <small style="color:#888;">${shortRec}</small><br>
                        <small style="font-weight:600; color:${scopeColor};">${scopeText}</small>
                    </div>
                    <div style="display:flex; gap:10px;">
                        ${actionsHtml}
                    </div>
                `;
          list.appendChild(li);
        });
      } else {
        list.innerHTML = "<p>No hay servicios configurados.</p>";
      }
    });
}

// 1. Agregar Servicio (Actualizado con recomendaciones)
const formService = document.getElementById("formService");
if (formService) {
  formService.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      nombre: document.getElementById("serviceName").value,
      recomendaciones: document.getElementById("serviceRecs").value,
    };

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "add_service", data: data }),
    })
      .then((r) => r.json())
      .then(() => {
        document.getElementById("serviceName").value = "";
        document.getElementById("serviceRecs").value = "";
        loadServicesAdmin();
      });
  });
}

// 2. Funciones de Edición
window.openEditService = function (id) {
  const service = globalServices.find((s) => s.id === id);
  if (service) {
    document.getElementById("editServiceId").value = service.id;
    document.getElementById("editServiceName").value = service.nombre_servicio;
    document.getElementById("editServiceRecs").value = service.recomendaciones;
    openModal("modalEditService");
  }
};

const formEditService = document.getElementById("formEditService");
if (formEditService) {
  formEditService.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      id: document.getElementById("editServiceId").value,
      nombre: document.getElementById("editServiceName").value,
      recomendaciones: document.getElementById("editServiceRecs").value,
    };

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "update_service", data: data }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          closeModal("modalEditService");
          loadServicesAdmin();
        } else {
          alert("Error: " + res.message);
        }
      });
  });
}

// 3. Borrar Servicio
window.deleteService = function (id) {
  if (!confirm("¿Borrar este servicio")) return;
  const requester = getRequesterFromSession();
  const service = (globalServices || []).find((s) => String(s.id) === String(id));
  if (!service || !service.nombre_servicio) {
    alert("No se pudo identificar el servicio.");
    return;
  }
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete_service_full",
      nombre: service.nombre_servicio,
      requester: requester
    }),
  })
    .then((r) => r.json())
    .then((res) => {
      if (!res || !res.success) {
        alert("Error: " + (res && res.message ? res.message : "No se pudo borrar el servicio."));
        return;
      }
      loadServicesAdmin();
    });
};

// --- GESTIÓN DE PROMOCIONES (CON VISUALIZACIÓN Y BORRADO) ---

// 1. Cargar Estado al entrar
// --- GESTIÓN DE PROMOCIONES (LISTA) ---

// 1. Cargar Lista
function loadPromoStatus() {
  const container = document.getElementById("promoStatusContent");
  container.innerHTML = '<p style="text-align:center;">Cargando lista...</p>';

  // Nota: Cambié la acción a 'get_promo_list' para coincidir con el API nuevo
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_promo_list", requester: getRequesterFromSession() }),
  })
    .then((r) => r.json())
    .then((res) => {
      container.innerHTML = "";

      if (res.success && res.list && res.list.length > 0) {
        res.list.forEach((p) => {
          // Calcular si está activa hoy visualmente
          const hoy = new Date().toISOString().split("T")[0];
          const isActive = hoy >= p.inicio && hoy <= p.fin;
          const statusColor = isActive ? "#27ae60" : "#95a5a6";
          const statusText = isActive ? "ACTIVA HOY" : "PROGRAMADA / VENCIDA";

          const card = document.createElement("div");
          card.style.cssText = `background:white; border-left: 4px solid ${statusColor}; padding:15px; margin-bottom:10px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1);`;

          card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span style="font-size:0.7rem; font-weight:bold; color:${statusColor}; letter-spacing:1px;">${statusText}</span>
                            <p style="margin:5px 0; font-weight:bold; color:#333;">${p.mensaje}</p>
                            <p style="font-size:0.85rem; color:#666;">
                                <i class="far fa-calendar-alt"></i> ${p.inicio} al ${p.fin}
                            </p>
                        </div>
                        <button onclick="deletePromo('${p.id}')" style="background:none; border:none; color:#e74c3c; cursor:pointer; padding:5px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
          container.appendChild(card);
        });
      } else {
        container.innerHTML = `
                <div style="text-align:center; padding:20px; color:#888;">
                    <i class="far fa-folder-open" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>No hay promociones registradas.</p>
                </div>
            `;
      }
    });
}

// 2. Función Borrar por ID
window.deletePromo = function (id) {
  if (!confirm("¿Borrar esta promoción")) return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete_promotion", id: id, requester: getRequesterFromSession() }),
  })
    .then((r) => r.json())
    .then((res) => {
      alert("Promoción eliminada.");
      loadPromoStatus(); // Recargar lista
    });
};

// 3. Listener del Formulario (Guardar)
const formPromo = document.getElementById("formPromo");
if (formPromo) {
  formPromo.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = formPromo.querySelector("button");
    btn.disabled = true;
    btn.innerText = "Guardando...";

    const data = {
      mensaje: document.getElementById("promoMsg").value,
      fecha_inicio: document.getElementById("promoStart").value,
      fecha_fin: document.getElementById("promoEnd").value,
    };

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "save_promotion", data: data, requester: getRequesterFromSession() }),
    })
      .then((r) => r.json())
      .then((res) => {
        alert("¡Promoción agregada!");
        document.getElementById("promoMsg").value = ""; // Limpiar
        loadPromoStatus(); // Recargar lista
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerText = "Publicar / Actualizar";
      });
  });
}
// ==========================================
// CONSTRUCTOR DE SERVICIOS VISUAL
// ==========================================

// ==========================================
// CONSTRUCTOR DE SERVICIOS VISUAL (MEJORADO)
// ==========================================

// 1. ABRIR MODAL (Modo Crear o Editar)
// Esta función ahora se conecta al botón "Configurar / Editar Servicios"
window.openServiceBuilder = function(existingService = null) {
    const modal = document.getElementById('modalServiceBuilder');
    const container = document.getElementById('builderFieldsContainer');
    const scopeInfoWrap = document.getElementById('builderScopeInfoWrap');
    const scopeInfo = document.getElementById('builderScopeInfo');
    container.innerHTML = ""; // Limpiar
    
    // Resetear inputs
    document.getElementById('serviceOriginalName').value = "";
    document.getElementById('builderServiceName').value = "";
    document.getElementById('builderReportTitle').value = "";
    document.getElementById('builderServiceRecs').value = "";
    document.getElementById('btnDeleteServiceFull').style.display = "none";
    if (scopeInfoWrap) scopeInfoWrap.style.display = "none";
    if (scopeInfo) scopeInfo.value = "";

    // MODO EDICIÓN (Si le pasamos datos)
    if (existingService) {
        document.getElementById('serviceOriginalName').value = existingService.nombre_servicio;
        document.getElementById('builderServiceName').value = existingService.nombre_servicio;
        document.getElementById('builderReportTitle').value = existingService.titulo_reporte || ""; 
        document.getElementById('builderServiceRecs').value = existingService.recomendaciones || "";
        document.getElementById('btnDeleteServiceFull').style.display = "block";
        if (scopeInfoWrap && scopeInfo) {
            scopeInfoWrap.style.display = "block";
            scopeInfo.value = (existingService.scope_visibility === "OWNER") ? "Solo para ti (bloqueado)" : "Disponible para todos (bloqueado)";
        }

        // Cargar los campos de este servicio desde el servidor
        const requester = getRequesterFromSession();
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "get_service_config", requester: requester })
        })
        .then(r => r.json())
        .then(res => {
            if(res.success && res.data) {
                const config = res.data[existingService.nombre_servicio];
                if(config && Array.isArray(config)) {
                    config.forEach(c => addBuilderFieldRow(c.nombre, c.etiqueta, c.tipo, c.opciones));
                }
            }
        });

    } else {
        // MODO CREAR (Vacío con 1 campo)
        addBuilderFieldRow(); 
    }

    modal.classList.add('active');
}

// 1. AGREGAR FILA (CON ARRASTRE)
window.addBuilderFieldRow = function(nombreVal="", etiquetaVal="", tipoVal="texto", opcionesVal="") {
    const container = document.getElementById('builderFieldsContainer');
    const div = document.createElement('div');
    div.className = "field-row";
    div.draggable = true; // ¡Permite arrastrar!

    // HTML Interno
    div.innerHTML = `
        <div class="drag-handle" title="Arrastra para mover"><i class="fas fa-grip-vertical"></i></div>
        
        <div class="field-inputs">
            <div class="field-top-row">
                <div class="field-actions-row">
                    <div class="field-actions">
                        <button type="button" class="btn-move" onclick="moveField(this, -1)" title="Mover arriba">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <button type="button" class="btn-move" onclick="moveField(this, 1)" title="Mover abajo">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                    <button type="button" class="btn-remove-field" onclick="this.closest('.field-row').remove()">&times;</button>
                </div>

                <div class="field-main-line">
                    <input type="text" class="field-label doc-input" placeholder="Nombre del Campo (Ej: Tipo de Sangre)" value="${etiquetaVal}" style="flex:2;">
                    
                    <select class="field-type doc-input" style="flex:1;" onchange="toggleOptionsInput(this)">
                        <option value="texto" ${tipoVal==='texto' ? 'selected' : ''}>Texto Corto</option>
                        <option value="parrafo" ${tipoVal==='parrafo' ? 'selected' : ''}>Parrafo</option>
                        <option value="numero" ${tipoVal==='numero' ? 'selected' : ''}>Numero</option>
                        <option value="select" ${tipoVal==='select' ? 'selected' : ''}>Lista Desplegable</option>
                        <option value="imagenes" ${tipoVal==='imagenes' ? 'selected' : ''}>Galeria Fotos</option>
                        <option value="titulo" ${tipoVal==='titulo' ? 'selected' : ''}>-- Titulo Seccion --</option>
                    </select>
                </div>
            </div>

            <div class="options-config ${tipoVal==='select' ? 'active' : ''}">
                <input type="text" class="field-options doc-input" 
                       placeholder="Opciones separadas por coma (Ej: Positivo, Negativo, Indeterminado)" 
                       value="${opcionesVal}" style="background:#fff8e1; border-color:#ffe0b2;">
                <small style="color:#d35400;">* Escribe las opciones separadas por comas.</small>
            </div>
        </div>
    `;

    // --- EVENTOS DRAG AND DROP ---
    div.addEventListener('dragstart', () => { div.classList.add('dragging'); });
    div.addEventListener('dragend', () => { div.classList.remove('dragging'); });

    // Lógica del contenedor para ordenar
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            container.appendChild(draggable);
        } else {
            container.insertBefore(draggable, afterElement);
        }
    });

    container.appendChild(div);
}
// Helper para detectar posición del mouse al arrastrar
// Override: version optimizada (botones arriba/abajo)
window.addBuilderFieldRow = function(nombreVal="", etiquetaVal="", tipoVal="texto", opcionesVal="") {
    const container = document.getElementById('builderFieldsContainer');
    const div = document.createElement('div');
    div.className = "field-row";
    div.draggable = false; // Desactivamos drag para evitar fallos

    div.innerHTML = `
        <div class="drag-handle" title="Arrastra para mover"><i class="fas fa-grip-vertical"></i></div>
        
        <div class="field-inputs">
            <div class="field-top-row">
                <div class="field-actions-row">
                    <div class="field-actions">
                        <button type="button" class="btn-move" onclick="moveField(this, -1)" title="Mover arriba">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <button type="button" class="btn-move" onclick="moveField(this, 1)" title="Mover abajo">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                    <button type="button" class="btn-remove-field" onclick="this.closest('.field-row').remove()">&times;</button>
                </div>

                <div class="field-main-line">
                    <input type="text" class="field-label doc-input" placeholder="Nombre del Campo (Ej: Tipo de Sangre)" value="${etiquetaVal}" style="flex:2;">
                    
                    <select class="field-type doc-input" style="flex:1;" onchange="toggleOptionsInput(this)">
                        <option value="texto" ${tipoVal==='texto' ? 'selected' : ''}>Texto Corto</option>
                        <option value="parrafo" ${tipoVal==='parrafo' ? 'selected' : ''}>Parrafo</option>
                        <option value="numero" ${tipoVal==='numero' ? 'selected' : ''}>Numero</option>
                        <option value="select" ${tipoVal==='select' ? 'selected' : ''}>Lista Desplegable</option>
                        <option value="imagenes" ${tipoVal==='imagenes' ? 'selected' : ''}>Galeria Fotos</option>
                        <option value="titulo" ${tipoVal==='titulo' ? 'selected' : ''}>-- Titulo Seccion --</option>
                    </select>
                </div>
            </div>

            <div class="options-config ${tipoVal==='select' ? 'active' : ''}">
                <input type="text" class="field-options doc-input" 
                       placeholder="Opciones separadas por coma (Ej: Positivo, Negativo, Indeterminado)" 
                       value="${opcionesVal}" style="background:#fff8e1; border-color:#ffe0b2;">
                <small style="color:#d35400;">* Escribe las opciones separadas por comas.</small>
            </div>
        </div>
    `;

    container.appendChild(div);
}
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.field-row:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Mostrar/Ocultar input de opciones
window.toggleOptionsInput = function(select) {
    const row = select.closest('.field-inputs');
    const optDiv = row.querySelector('.options-config');
    if (select.value === 'select') {
        optDiv.classList.add('active');
    } else {
        optDiv.classList.remove('active');
    }
}
// 3. MOVER CAMPO (Arriba/Abajo)
window.moveField = function(btn, direction) {
    const row = btn.closest('.field-row');
    const container = row.parentElement;
    
    if (direction === -1 && row.previousElementSibling) {
        container.insertBefore(row, row.previousElementSibling);
    } else if (direction === 1 && row.nextElementSibling) {
        container.insertBefore(row.nextElementSibling, row);
    }
}

let serviceScopeResolver_ = null;

function openServiceScopeChoiceModal_() {
    return new Promise((resolve) => {
        serviceScopeResolver_ = resolve;
        openModal('modalServiceScopeChoice');
    });
}

window.chooseServiceScope = function(scope) {
    if (serviceScopeResolver_) {
        serviceScopeResolver_(scope || null);
        serviceScopeResolver_ = null;
    }
    closeModal('modalServiceScopeChoice');
}

// 4. GUARDAR TODO (Llama al backend 'saveServiceFull')
window.saveServiceFullConfig = async function() {
    const originalName = document.getElementById('serviceOriginalName').value;
    const name = document.getElementById('builderServiceName').value;
    const title = document.getElementById('builderReportTitle').value;
    const recs = document.getElementById('builderServiceRecs').value;
    const requester = getRequesterFromSession();
    
    if(!name) return alert("El nombre del servicio es obligatorio.");

    const campos = [];
    document.querySelectorAll('#builderFieldsContainer .field-row').forEach(row => {
        const etiqueta = row.querySelector('.field-label').value;
        const tipo = row.querySelector('.field-type').value;
        const opciones = row.querySelector('.field-options').value; // Leer opciones
        
        if(etiqueta) {
            let nombreInterno = etiqueta.toLowerCase()
                                .replace(/[áéíóúñ]/g, c => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u','ñ':'n'}[c]))
                                .replace(/[^a-z0-9]/g, '_');
            
            if(tipo === 'titulo') nombreInterno = 'titulo_' + Math.random().toString(36).substr(2, 5);

            campos.push({ 
                nombre: nombreInterno, 
                etiqueta: etiqueta, 
                tipo: tipo,
                opciones: opciones // Guardamos las opciones
            });
        }
    });

    const btn = document.querySelector('#modalServiceBuilder .btn-submit');
    const oldText = btn.innerText;
    btn.innerText = "Guardando..."; btn.disabled = true;

    try {
        let scopeVisibility = "";
        const isCreate = !String(originalName || "").trim();
        if (isCreate) {
            const choice = await openServiceScopeChoiceModal_();
            if (!choice) return;
            scopeVisibility = choice;
        }

        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: "save_service_full",
                requester: requester,
                data: {
                    originalName: originalName,
                    nombre_servicio: name,
                    titulo_reporte: title,
                    recomendaciones: recs,
                    campos: campos,
                    scope_visibility: scopeVisibility
                }
            })
        }).then(r => r.json());

        if(res.success) {
            alert("Servicio guardado correctamente.");
            closeModal('modalServiceBuilder');
            loadServicesAdmin();
        } else {
            alert("Error: " + res.message);
        }
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

// 5. ELIMINAR SERVICIO (Llama al backend 'deleteServiceFull')
window.deleteCurrentService = function() {
    const name = document.getElementById('serviceOriginalName').value;
    if(!name) return;
    
    if(confirm("¿ESTÁS SEGURO\nSe borrará el servicio '" + name + "' y toda su configuración.")) {
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "delete_service_full", nombre: name, requester: getRequesterFromSession() })
        })
        .then(r => r.json())
        .then(res => {
            if(res.success) {
                alert("Eliminado.");
                closeModal('modalServiceBuilder');
                loadServicesAdmin(); // Recargar lista
            } else {
                alert("Error: " + res.message);
            }
        });
    }
}

// 6. FUNCIÓN DE ENTRADA (Conecta el botón de la lista con el editor)
// Modifica tu función 'openEditService' existente para usar el nuevo modal
window.openEditService = function (id) {
  // Buscamos en la variable global que ya tenías
  const service = globalServices.find((s) => s.id === id);
  if (service) {
      openServiceBuilder(service); // Usamos la nueva función potente
  }
};
