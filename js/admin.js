// js/admin.js - VIDAFEM v3.1 (CRUD Completo + Modularidad)

let allPatients = [];
let isDeletingPatient = false;
let adminInfographicPosts_ = [];
let pendingInfographicImageDataUrl_ = "";
let doctorVacationCache_ = {
  active: false,
  fecha_hasta: "",
  titulo: "",
  mensaje: "",
  block_message: ""
};

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
  setupDoctorVacationForm();
  setupInfographicForm();
  setupPromoHubNavigation();
  loadDoctorVacationStatus();
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

function renderDoctorVacationStatus_(vac) {
  const box = document.getElementById("doctorVacationStatusBox");
  if (!box) return;

  const active = !!(vac && vac.active);
  if (!active) {
    box.innerHTML = `
      <div style="background:#f8f9fa; border-left:4px solid #95a5a6; padding:12px; border-radius:8px;">
        <strong style="color:#2c3e50;">Sin aviso activo</strong><br>
        <small style="color:#666;">Tus pacientes pueden seguir agendando normalmente.</small>
      </div>
    `;
    return;
  }

  const until = String(vac.fecha_hasta || "").trim();
  const title = String(vac.titulo || "").trim() || "Aviso";
  const msg = String(vac.mensaje || "").trim() || "Sin mensaje.";
  box.innerHTML = `
    <div style="background:#fff8e1; border-left:4px solid #f39c12; padding:12px; border-radius:8px;">
      <strong style="color:#d35400;">${title}</strong><br>
      <small style="color:#666; display:block; margin:6px 0;">Activo hasta: ${until || "--"}</small>
      <span style="color:#444;">${msg}</span>
    </div>
  `;
}

function loadDoctorVacationStatus() {
  const requester = getRequesterFromSession();
  if (!requester) return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_my_vacation", requester: requester })
  })
    .then((r) => r.json())
    .then((res) => {
      if (res && res.success) {
        doctorVacationCache_ = {
          active: !!res.active,
          fecha_hasta: res.fecha_hasta || "",
          titulo: res.titulo || "",
          mensaje: res.mensaje || "",
          block_message: res.block_message || ""
        };
      } else {
        doctorVacationCache_ = { active: false, fecha_hasta: "", titulo: "", mensaje: "", block_message: "" };
      }
      renderDoctorVacationStatus_(doctorVacationCache_);
    })
    .catch(() => {
      doctorVacationCache_ = { active: false, fecha_hasta: "", titulo: "", mensaje: "", block_message: "" };
      renderDoctorVacationStatus_(doctorVacationCache_);
    });
}

function openDoctorVacationModal_() {
  const dateEl = document.getElementById("vacUntilDate");
  const titleEl = document.getElementById("vacTitle");
  const msgEl = document.getElementById("vacMessage");

  if (dateEl) {
    dateEl.min = new Date().toISOString().split("T")[0];
    dateEl.value = String(doctorVacationCache_.fecha_hasta || "");
  }
  if (titleEl) titleEl.value = String(doctorVacationCache_.titulo || "");
  if (msgEl) msgEl.value = String(doctorVacationCache_.mensaje || "");

  openModal("modalDoctorVacation");
}

function setupDoctorVacationForm() {
  const btnOpen = document.getElementById("btnOpenDoctorVacation");
  if (btnOpen) btnOpen.addEventListener("click", openDoctorVacationModal_);

  const titleEl = document.getElementById("vacTitle");
  if (titleEl) {
    titleEl.addEventListener("input", (e) => {
      e.target.value = String(e.target.value || "").toUpperCase();
    });
  }

  const form = document.getElementById("formDoctorVacation");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const requester = getRequesterFromSession();
      if (!requester) {
        alert("Sesion invalida.");
        return;
      }

      const until = String((document.getElementById("vacUntilDate") || {}).value || "").trim();
      const title = String((document.getElementById("vacTitle") || {}).value || "").trim();
      const message = String((document.getElementById("vacMessage") || {}).value || "").trim();
      if (!until || !title || !message) {
        alert("Completa fecha, titulo y mensaje.");
        return;
      }

      const btn = document.getElementById("btnSaveDoctorVacation");
      const oldText = btn ? btn.innerText : "";
      if (btn) {
        btn.disabled = true;
        btn.innerText = "Guardando...";
      }

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "set_my_vacation",
            requester: requester,
            data: {
              activo: true,
              fecha_hasta: until,
              titulo: title,
              mensaje: message
            }
          })
        }).then((r) => r.json());

        if (!res || !res.success) {
          alert("Error: " + (res && res.message ? res.message : "No se pudo guardar."));
          return;
        }

        doctorVacationCache_ = {
          active: !!res.active,
          fecha_hasta: res.fecha_hasta || "",
          titulo: res.titulo || "",
          mensaje: res.mensaje || "",
          block_message: res.block_message || ""
        };
        renderDoctorVacationStatus_(doctorVacationCache_);
        closeModal("modalDoctorVacation");
        if (window.showToast) window.showToast("Aviso de vacaciones actualizado.", "success");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerText = oldText;
        }
      }
    });
  }

  const btnClear = document.getElementById("btnClearDoctorVacation");
  if (btnClear) {
    btnClear.addEventListener("click", async () => {
      const requester = getRequesterFromSession();
      if (!requester) return;
      const ok = window.appConfirm
        ? await window.appConfirm({
            title: "Desactivar aviso",
            message: "Tus pacientes volveran a poder agendar citas normalmente.",
            confirmText: "Desactivar",
            cancelText: "Cancelar",
          })
        : confirm("Desactivar aviso de vacaciones");
      if (!ok) return;

      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "set_my_vacation",
          requester: requester,
          data: { activo: false, fecha_hasta: "", titulo: "", mensaje: "" }
        })
      }).then((r) => r.json());

      if (!res || !res.success) {
        alert("Error: " + (res && res.message ? res.message : "No se pudo desactivar."));
        return;
      }
      doctorVacationCache_ = {
        active: !!res.active,
        fecha_hasta: res.fecha_hasta || "",
        titulo: res.titulo || "",
        mensaje: res.mensaje || "",
        block_message: res.block_message || ""
      };
      renderDoctorVacationStatus_(doctorVacationCache_);
      closeModal("modalDoctorVacation");
      if (window.showToast) window.showToast("Aviso desactivado.", "success");
    });
  }
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
        loadDoctorVacationStatus();
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
      else if (text === "Promociones" || text === "Infografia / promociones" || text === "Infografía / promociones") {
        e.preventDefault();
        switchView("promotions");
        showPromoHubHome_();
        loadPromoStatus();
        loadInfographicPostsAdmin();
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

function showPromoHubHome_() {
  const hub = document.getElementById("promoHubSelector");
  const panelPromo = document.getElementById("promoPanelPromotions");
  const panelInf = document.getElementById("promoPanelInfographics");
  if (hub) hub.style.display = "grid";
  if (panelPromo) panelPromo.style.display = "none";
  if (panelInf) panelInf.style.display = "none";
}

function openPromoHubPanel_(panelName) {
  const hub = document.getElementById("promoHubSelector");
  const panelPromo = document.getElementById("promoPanelPromotions");
  const panelInf = document.getElementById("promoPanelInfographics");
  if (hub) hub.style.display = "none";
  if (panelPromo) panelPromo.style.display = panelName === "promo" ? "block" : "none";
  if (panelInf) panelInf.style.display = panelName === "infographic" ? "block" : "none";
}

function setupPromoHubNavigation() {
  const cardPromo = document.getElementById("promoHubCardPromo");
  const cardInf = document.getElementById("promoHubCardInfographic");
  const btnBackPromo = document.getElementById("btnBackFromPromoPanel");
  const btnBackInf = document.getElementById("btnBackFromInfPanel");

  if (cardPromo && !cardPromo.dataset.bound) {
    cardPromo.dataset.bound = "1";
    cardPromo.addEventListener("click", () => openPromoHubPanel_("promo"));
  }
  if (cardInf && !cardInf.dataset.bound) {
    cardInf.dataset.bound = "1";
    cardInf.addEventListener("click", () => openPromoHubPanel_("infographic"));
  }
  if (btnBackPromo && !btnBackPromo.dataset.bound) {
    btnBackPromo.dataset.bound = "1";
    btnBackPromo.addEventListener("click", showPromoHubHome_);
  }
  if (btnBackInf && !btnBackInf.dataset.bound) {
    btnBackInf.dataset.bound = "1";
    btnBackInf.addEventListener("click", showPromoHubHome_);
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
  window.location.href = `clinical.html?id=${id}`;
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

// --- GESTIÓN DE PROMOCIONES ---
function loadPromoStatus() {
  const container = document.getElementById("promoStatusContent");
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;">Cargando lista...</p>';

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_promo_list", requester: getRequesterFromSession() }),
  })
    .then((r) => r.json())
    .then((res) => {
      container.innerHTML = "";

      if (res.success && res.list && res.list.length > 0) {
        res.list.forEach((p) => {
          const hoy = new Date().toISOString().split("T")[0];
          const isActive = hoy >= p.inicio && hoy <= p.fin;
          const statusColor = isActive ? "#27ae60" : "#95a5a6";
          const statusText = isActive ? "ACTIVA HOY" : "PROGRAMADA / VENCIDA";
          const scope = String(p.scope_visibility || "OWNER").toUpperCase() === "ALL"
            ? "Todos los pacientes"
            : "Solo mis pacientes";

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
                            <small style="display:block; color:#6f5aa8; font-weight:600;">${scope}</small>
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

window.deletePromo = function (id) {
  if (!confirm("¿Borrar esta promoción")) return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete_promotion", id: id, requester: getRequesterFromSession() }),
  })
    .then((r) => r.json())
    .then((res) => {
      if (!res || !res.success) {
        alert("Error: " + ((res && res.message) || "No se pudo eliminar."));
        return;
      }
      alert("Promoción eliminada.");
      loadPromoStatus(); // Recargar lista
    });
};

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
      scope_visibility: String((document.getElementById("promoScope") || {}).value || "OWNER").trim().toUpperCase(),
    };

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "save_promotion", data: data, requester: getRequesterFromSession() }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res || !res.success) {
          alert("Error: " + ((res && res.message) || "No se pudo guardar la promoción."));
          return;
        }
        alert("¡Promoción guardada!");
        document.getElementById("promoMsg").value = ""; // Limpiar
        loadPromoStatus(); // Recargar lista
      })
      .finally(() => {
        btn.disabled = false;
        btn.innerText = "Guardar promocion";
      });
  });
}

function renderInfographicPostsAdmin_() {
  const container = document.getElementById("infographicPostsList");
  if (!container) return;
  container.innerHTML = "";

  if (!adminInfographicPosts_ || adminInfographicPosts_.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:20px; color:#888;">
        <i class="far fa-images" style="font-size:2rem; margin-bottom:8px;"></i>
        <p>No hay publicaciones visuales registradas.</p>
      </div>
    `;
    return;
  }

  adminInfographicPosts_.forEach((p) => {
    const active = !!p.activo;
    const scopeText = p.scope_visibility === "ALL" ? "Todos los pacientes" : "Solo mis pacientes";
    const statusColor = active ? "#27ae60" : "#7f8c8d";
    const statusText = active ? "ACTIVA" : "INACTIVA";
    const showAgenda = p.show_btn_agenda !== false;
    const showInfo = p.show_btn_info !== false;
    const showSource = p.show_btn_source === true;
    const showContact = p.show_btn_contacto !== false;
    const actions = [
      showAgenda ? "Agenda" : "",
      showInfo ? "Mas informacion" : "",
      showSource ? "Fuente" : "",
      showContact ? "Contacto" : ""
    ].filter(Boolean).join(" / ");
    const card = document.createElement("div");
    card.style.cssText = "background:#fff; border:1px solid #eee; border-radius:12px; margin-bottom:12px; overflow:hidden;";

    const img = p.imagen_url
      ? `<div style="height:160px; background-image:url('${p.imagen_url}'); background-size:cover; background-position:center;"></div>`
      : `<div style="height:160px; background:linear-gradient(135deg,#d6d3e8,#eceaf7);"></div>`;

    card.innerHTML = `
      ${img}
      <div style="padding:14px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <span style="font-size:0.72rem; font-weight:700; color:${statusColor}; letter-spacing:1px;">${statusText}</span>
            <h4 style="margin:6px 0; color:#2c3e50;">${p.titulo || "Sin titulo"}</h4>
            <p style="margin:0; color:#555; white-space:pre-wrap;">${String(p.mensaje || "").substring(0, 160)}${String(p.mensaje || "").length > 160 ? "..." : ""}</p>
            <small style="display:block; margin-top:8px; color:#777;">${scopeText}</small>
            <small style="display:block; margin-top:4px; color:#5d4aa5; font-weight:600;">${actions || "Sin acciones visibles"}</small>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" onclick="editInfographicPost('${p.id_post}')" style="background:none; border:none; color:#3498db; cursor:pointer;" title="Editar">
              <i class="fas fa-pen"></i>
            </button>
            <button type="button" onclick="deleteInfographicPost('${p.id_post}')" style="background:none; border:none; color:#e74c3c; cursor:pointer;" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function setInfographicImagePreview_(url) {
  const wrap = document.getElementById("infImagePreviewWrap");
  const box = document.getElementById("infImagePreview");
  const val = String(url || "").trim();
  if (!wrap || !box) return;
  if (!val) {
    wrap.style.display = "none";
    box.style.backgroundImage = "";
    return;
  }
  box.style.backgroundImage = `url('${val}')`;
  wrap.style.display = "block";
}

function toggleInfographicActionFields_() {
  const showInfo = !!((document.getElementById("infShowInfo") || {}).checked);
  const showSource = !!((document.getElementById("infShowSource") || {}).checked);
  const showAgenda = !!((document.getElementById("infShowAgenda") || {}).checked);
  const showContact = !!((document.getElementById("infShowContact") || {}).checked);
  const agendaRow = document.getElementById("infAgendaConfigRow");
  const infoRow = document.getElementById("infInfoConfigRow");
  const sourceRow = document.getElementById("infSourceConfigRow");
  const contactRow = document.getElementById("infContactConfigRow");
  const agendaInput = document.getElementById("infBtnAgenda");
  const infoInput = document.getElementById("infBtnInfo");
  const sourceInput = document.getElementById("infBtnSource");
  const sourceUrlInput = document.getElementById("infSourceUrl");
  const contactInput = document.getElementById("infBtnContact");

  if (agendaRow) agendaRow.style.display = showAgenda ? "block" : "none";
  if (infoRow) infoRow.style.display = showInfo ? "block" : "none";
  if (sourceRow) sourceRow.style.display = showSource ? "flex" : "none";
  if (contactRow) contactRow.style.display = showContact ? "block" : "none";
  if (agendaInput) agendaInput.disabled = !showAgenda;
  if (infoInput) infoInput.disabled = !showInfo;
  if (sourceInput) sourceInput.disabled = !showSource;
  if (sourceUrlInput) sourceUrlInput.disabled = !showSource;
  if (contactInput) contactInput.disabled = !showContact;
}

function resetInfographicForm_() {
  const form = document.getElementById("formInfographicPost");
  if (form) form.reset();
  const id = document.getElementById("infPostId");
  const btn = document.getElementById("btnSaveInfographicPost");
  const btnCancel = document.getElementById("btnCancelInfographicEdit");
  const scope = document.getElementById("infScope");
  const active = document.getElementById("infActive");
  const btnAgenda = document.getElementById("infBtnAgenda");
  const btnInfo = document.getElementById("infBtnInfo");
  const btnSource = document.getElementById("infBtnSource");
  const btnContact = document.getElementById("infBtnContact");
  const showAgenda = document.getElementById("infShowAgenda");
  const showInfo = document.getElementById("infShowInfo");
  const showSource = document.getElementById("infShowSource");
  const showContact = document.getElementById("infShowContact");
  const imageFile = document.getElementById("infImageFile");

  if (id) id.value = "";
  if (scope) scope.value = "OWNER";
  if (active) active.checked = true;
  if (showAgenda) showAgenda.checked = false;
  if (showInfo) showInfo.checked = false;
  if (showSource) showSource.checked = false;
  if (showContact) showContact.checked = false;
  if (btnAgenda) btnAgenda.value = "Agenda tu cita";
  if (btnInfo) btnInfo.value = "Mas informacion";
  if (btnSource) btnSource.value = "Ir a fuente";
  if (btnContact) btnContact.value = "Contactanos";
  if (imageFile) imageFile.value = "";
  const imageUrl = document.getElementById("infImageUrl");
  if (imageUrl) imageUrl.value = "";
  const sourceUrl = document.getElementById("infSourceUrl");
  if (sourceUrl) sourceUrl.value = "";
  pendingInfographicImageDataUrl_ = "";
  setInfographicImagePreview_("");
  if (btn) btn.innerText = "Guardar publicacion";
  if (btnCancel) btnCancel.style.display = "none";
  toggleInfographicActionFields_();
}

function fillInfographicForm_(post) {
  if (!post) return;
  const id = document.getElementById("infPostId");
  const title = document.getElementById("infTitle");
  const msg = document.getElementById("infMessage");
  const img = document.getElementById("infImageUrl");
  const scope = document.getElementById("infScope");
  const active = document.getElementById("infActive");
  const btnAgenda = document.getElementById("infBtnAgenda");
  const btnInfo = document.getElementById("infBtnInfo");
  const btnSource = document.getElementById("infBtnSource");
  const sourceUrl = document.getElementById("infSourceUrl");
  const btnContact = document.getElementById("infBtnContact");
  const showAgenda = document.getElementById("infShowAgenda");
  const showInfo = document.getElementById("infShowInfo");
  const showSource = document.getElementById("infShowSource");
  const showContact = document.getElementById("infShowContact");
  const imageFile = document.getElementById("infImageFile");
  const btnSave = document.getElementById("btnSaveInfographicPost");
  const btnCancel = document.getElementById("btnCancelInfographicEdit");

  pendingInfographicImageDataUrl_ = "";
  if (imageFile) imageFile.value = "";
  if (id) id.value = post.id_post || "";
  if (title) title.value = post.titulo || "";
  if (msg) msg.value = post.mensaje || "";
  if (img) img.value = post.imagen_url || "";
  if (scope) scope.value = post.scope_visibility === "ALL" ? "ALL" : "OWNER";
  if (active) active.checked = !!post.activo;
  if (showAgenda) showAgenda.checked = post.show_btn_agenda !== false;
  if (showInfo) showInfo.checked = post.show_btn_info !== false;
  if (showSource) showSource.checked = post.show_btn_source === true;
  if (showContact) showContact.checked = post.show_btn_contacto !== false;
  if (btnAgenda) btnAgenda.value = post.btn_agenda_text || "Agenda tu cita";
  if (btnInfo) btnInfo.value = post.btn_info_text || "Mas informacion";
  if (btnSource) btnSource.value = post.btn_source_text || "Ir a fuente";
  if (sourceUrl) sourceUrl.value = post.btn_source_url || "";
  if (btnContact) btnContact.value = post.btn_contacto_text || "Contactanos";
  setInfographicImagePreview_(post.imagen_url || "");
  toggleInfographicActionFields_();
  if (btnSave) btnSave.innerText = "Actualizar publicacion";
  if (btnCancel) btnCancel.style.display = "inline-flex";
}

function loadInfographicPostsAdmin() {
  const container = document.getElementById("infographicPostsList");
  if (!container) return;
  container.innerHTML = '<p style="text-align:center; color:#888;">Cargando publicaciones...</p>';

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "get_infographic_posts_admin",
      requester: getRequesterFromSession()
    })
  })
    .then((r) => r.json())
    .then((res) => {
      if (!res || !res.success) {
        container.innerHTML = `<p style="text-align:center; color:#c0392b;">${(res && res.message) || "No se pudieron cargar publicaciones."}</p>`;
        adminInfographicPosts_ = [];
        return;
      }
      adminInfographicPosts_ = Array.isArray(res.list) ? res.list : [];
      renderInfographicPostsAdmin_();
    })
    .catch(() => {
      container.innerHTML = '<p style="text-align:center; color:#c0392b;">Error de conexion.</p>';
      adminInfographicPosts_ = [];
    });
}

function setupInfographicForm() {
  const form = document.getElementById("formInfographicPost");
  if (!form) return;

  const title = document.getElementById("infTitle");
  if (title) {
    title.addEventListener("input", (e) => {
      e.target.value = String(e.target.value || "").toUpperCase();
    });
  }

  const btnCancel = document.getElementById("btnCancelInfographicEdit");
  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      resetInfographicForm_();
    });
  }

  const checkAgenda = document.getElementById("infShowAgenda");
  const checkInfo = document.getElementById("infShowInfo");
  const checkSource = document.getElementById("infShowSource");
  const checkContact = document.getElementById("infShowContact");
  [checkAgenda, checkInfo, checkSource, checkContact].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", toggleInfographicActionFields_);
  });

  const imageUrl = document.getElementById("infImageUrl");
  if (imageUrl) {
    imageUrl.addEventListener("input", () => {
      if (pendingInfographicImageDataUrl_) return;
      setInfographicImagePreview_(imageUrl.value);
    });
  }

  const imageFile = document.getElementById("infImageFile");
  if (imageFile) {
    imageFile.addEventListener("change", () => {
      const file = imageFile.files && imageFile.files[0];
      if (!file) {
        pendingInfographicImageDataUrl_ = "";
        setInfographicImagePreview_((imageUrl && imageUrl.value) || "");
        return;
      }
      if (!String(file.type || "").startsWith("image/")) {
        alert("Selecciona un archivo de imagen valido.");
        imageFile.value = "";
        pendingInfographicImageDataUrl_ = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        pendingInfographicImageDataUrl_ = String(reader.result || "");
        setInfographicImagePreview_(pendingInfographicImageDataUrl_);
      };
      reader.readAsDataURL(file);
    });
  }

  toggleInfographicActionFields_();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const requester = getRequesterFromSession();
    if (!requester) {
      alert("Sesion invalida.");
      return;
    }

    const id = String((document.getElementById("infPostId") || {}).value || "").trim();
    const payload = {
      id_post: id,
      titulo: String((document.getElementById("infTitle") || {}).value || "").trim(),
      mensaje: String((document.getElementById("infMessage") || {}).value || "").trim(),
      imagen_url: String((document.getElementById("infImageUrl") || {}).value || "").trim(),
      scope_visibility: String((document.getElementById("infScope") || {}).value || "OWNER").trim().toUpperCase(),
      activo: !!((document.getElementById("infActive") || {}).checked),
      show_btn_agenda: !!((document.getElementById("infShowAgenda") || {}).checked),
      show_btn_info: !!((document.getElementById("infShowInfo") || {}).checked),
      show_btn_source: !!((document.getElementById("infShowSource") || {}).checked),
      show_btn_contacto: !!((document.getElementById("infShowContact") || {}).checked),
      btn_agenda_text: String((document.getElementById("infBtnAgenda") || {}).value || "").trim(),
      btn_info_text: String((document.getElementById("infBtnInfo") || {}).value || "").trim(),
      btn_source_text: String((document.getElementById("infBtnSource") || {}).value || "").trim(),
      btn_source_url: String((document.getElementById("infSourceUrl") || {}).value || "").trim(),
      btn_contacto_text: String((document.getElementById("infBtnContact") || {}).value || "").trim()
    };
    if (pendingInfographicImageDataUrl_) payload.imagen_data_url = pendingInfographicImageDataUrl_;

    if (!payload.imagen_data_url && !payload.imagen_url) {
      alert("Debes subir una imagen.");
      return;
    }
    if (payload.show_btn_source && !payload.btn_source_url) {
      alert("Si habilitas 'Ir a fuente', debes ingresar su enlace.");
      return;
    }

    const btnSave = document.getElementById("btnSaveInfographicPost");
    const oldText = btnSave ? btnSave.innerText : "";
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerText = "Guardando...";
    }

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "save_infographic_post",
        requester: requester,
        data: payload
      })
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res || !res.success) {
          alert("Error: " + ((res && res.message) || "No se pudo guardar."));
          return;
        }
        if (window.showToast) window.showToast("Publicacion guardada.", "success");
        resetInfographicForm_();
        loadInfographicPostsAdmin();
      })
      .finally(() => {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerText = oldText || "Guardar publicacion";
        }
      });
  });
}

window.editInfographicPost = function(idPost) {
  const post = (adminInfographicPosts_ || []).find((p) => String(p.id_post) === String(idPost));
  if (!post) return;
  openPromoHubPanel_("infographic");
  fillInfographicForm_(post);
  const panel = document.getElementById("formInfographicPost");
  if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.deleteInfographicPost = function(idPost) {
  if (!confirm("¿Eliminar esta publicacion visual?")) return;
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete_infographic_post",
      id: idPost,
      requester: getRequesterFromSession()
    })
  })
    .then((r) => r.json())
    .then((res) => {
      if (!res || !res.success) {
        alert("Error: " + ((res && res.message) || "No se pudo eliminar."));
        return;
      }
      if (window.showToast) window.showToast("Publicacion eliminada.", "success");
      loadInfographicPostsAdmin();
      resetInfographicForm_();
    });
};
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
