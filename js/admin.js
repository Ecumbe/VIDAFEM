// js/admin.js - VIDAFEM v3.1 (CRUD Completo + Modularidad)

let allPatients = [];

document.addEventListener("DOMContentLoaded", () => {
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

// ============================
// 2. TABLA Y DATOS
// ============================

function loadPatientsTable() {
  const tbody = document.getElementById("patientsTableBody");
  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center">Actualizando base de datos...</td></tr>';

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_data", sheet: "pacientes" }),
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

  resetValidationUI();
  openModal("modalPatient");
};

// ELIMINAR PACIENTE
window.deletePatient = function (id) {
  if (
    !confirm(
      "¿Estás seguro de eliminar este paciente? Esta acción no se puede deshacer.",
    )
  )
    return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete_record",
      sheet: "pacientes",
      id: id,
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

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: actionAPI,
        sheet: "pacientes",
        data: dataObj,
        id: idPaciente, // Solo se usa si es update
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
  // Usamos la nueva acción optimizada que trae todo de una vez
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_dashboard_stats" }),
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
// --- GESTIÓN DE SERVICIOS (ADMIN) ---

function loadServicesAdmin() {
  const list = document.getElementById("servicesList");
  list.innerHTML = "Cargando...";

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_services" }),
  })
    .then((r) => r.json())
    .then((res) => {
      list.innerHTML = "";
      if (res.success && res.data.length > 0) {
        res.data.forEach((s) => {
          const li = document.createElement("li");
          li.style.cssText =
            "padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;";
          li.innerHTML = `
                    <span>${s.nombre_servicio}</span>
                    <button onclick="deleteService('${s.id}')" style="background:none; border:none; color:red; cursor:pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
          list.appendChild(li);
        });
      } else {
        list.innerHTML = "<p>No hay servicios configurados.</p>";
      }
    });
}
// --- GESTIÓN DE SERVICIOS (ADMIN) ---

let globalServices = []; // Variable para guardar los servicios cargados

function loadServicesAdmin() {
  const list = document.getElementById("servicesList");
  list.innerHTML = "Cargando...";

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_services" }),
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

          li.innerHTML = `
                    <div style="flex:1;">
                        <span style="font-weight:600;">${s.nombre_servicio}</span><br>
                        <small style="color:#888;">${shortRec}</small>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button onclick="openEditService('${s.id}')" style="background:none; border:none; color:#3498db; cursor:pointer;" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteService('${s.id}')" style="background:none; border:none; color:red; cursor:pointer;" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
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
  if (!confirm("¿Borrar este servicio?")) return;
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete_service", id: id }),
  })
    .then((r) => r.json())
    .then(() => loadServicesAdmin());
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
    body: JSON.stringify({ action: "get_promo_list" }),
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
  if (!confirm("¿Borrar esta promoción?")) return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete_promotion", id: id }),
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
      body: JSON.stringify({ action: "save_promotion", data: data }),
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
    container.innerHTML = ""; // Limpiar
    
    // Resetear inputs
    document.getElementById('serviceOriginalName').value = "";
    document.getElementById('builderServiceName').value = "";
    document.getElementById('builderReportTitle').value = "";
    document.getElementById('builderServiceRecs').value = "";
    document.getElementById('btnDeleteServiceFull').style.display = "none";

    // MODO EDICIÓN (Si le pasamos datos)
    if (existingService) {
        document.getElementById('serviceOriginalName').value = existingService.nombre_servicio;
        document.getElementById('builderServiceName').value = existingService.nombre_servicio;
        document.getElementById('builderReportTitle').value = existingService.titulo_reporte || ""; 
        document.getElementById('builderServiceRecs').value = existingService.recomendaciones || "";
        document.getElementById('btnDeleteServiceFull').style.display = "block";

        // Cargar los campos de este servicio desde el servidor
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "get_service_config" })
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
            <div class="field-main-line">
                <input type="text" class="field-label doc-input" placeholder="Nombre del Campo (Ej: Tipo de Sangre)" value="${etiquetaVal}" style="flex:2;">
                
                <select class="field-type doc-input" style="flex:1;" onchange="toggleOptionsInput(this)">
                    <option value="texto" ${tipoVal==='texto'?'selected':''}>Texto Corto</option>
                    <option value="parrafo" ${tipoVal==='parrafo'?'selected':''}>Párrafo</option>
                    <option value="numero" ${tipoVal==='numero'?'selected':''}>Número</option>
                    <option value="select" ${tipoVal==='select'?'selected':''}>🔻 Lista Desplegable</option>
                    <option value="imagenes" ${tipoVal==='imagenes'?'selected':''}>📷 Galería Fotos</option>
                    <option value="titulo" ${tipoVal==='titulo'?'selected':''}>-- Título Sección --</option>
                </select>
                
                <button type="button" class="btn-remove-field" onclick="this.closest('.field-row').remove()">&times;</button>
            </div>

            <div class="options-config ${tipoVal==='select'?'active':''}">
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

// 4. GUARDAR TODO (Llama al backend 'saveServiceFull')
window.saveServiceFullConfig = function() {
    const originalName = document.getElementById('serviceOriginalName').value;
    const name = document.getElementById('builderServiceName').value;
    const title = document.getElementById('builderReportTitle').value;
    const recs = document.getElementById('builderServiceRecs').value;
    
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

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ 
            action: "save_service_full", 
            data: {
                originalName: originalName,
                nombre_servicio: name,
                titulo_reporte: title,
                recomendaciones: recs,
                campos: campos
            }
        })
    })
    .then(r => r.json())
    .then(res => {
        if(res.success) {
            alert("Servicio guardado correctamente.");
            closeModal('modalServiceBuilder');
            loadServicesAdmin();
        } else {
            alert("Error: " + res.message);
        }
    })
    .finally(() => { btn.innerText = oldText; btn.disabled = false; });
}

// 5. ELIMINAR SERVICIO (Llama al backend 'deleteServiceFull')
window.deleteCurrentService = function() {
    const name = document.getElementById('serviceOriginalName').value;
    if(!name) return;
    
    if(confirm("¿ESTÁS SEGURO?\nSe borrará el servicio '" + name + "' y toda su configuración.")) {
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "delete_service_full", nombre: name })
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
