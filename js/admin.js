// js/admin.js - VIDAFEM v3.1 (CRUD Completo + Modularidad)

let allPatients = []; 

document.addEventListener('DOMContentLoaded', () => {
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
    if(!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

// Validar longitud (10 caracteres)
function validateLength(value) {
    return value.length === 10 && !isNaN(value);
}

// ============================
// 2. TABLA Y DATOS
// ============================

function loadPatientsTable() {
    const tbody = document.getElementById('patientsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Actualizando base de datos...</td></tr>';

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_data", sheet: "pacientes" })
    })
    .then(r => r.json())
    .then(response => {
        if (response.success && response.data.length > 0) {
            allPatients = response.data.reverse(); 
            renderTable(allPatients.slice(0, 5));
            
            const statCounter = document.getElementById('stat-total-patients');
            if(statCounter) statCounter.innerText = allPatients.length;
        } else {
            allPatients = [];
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay pacientes registrados.</td></tr>';
        }
    })
    .catch(error => {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:red">Error de conexión.</td></tr>';
    });
}

function renderTable(dataArray) {
    const tbody = document.getElementById('patientsTableBody');
    tbody.innerHTML = ""; 

    if (dataArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No se encontraron coincidencias.</td></tr>';
        return;
    }

    dataArray.forEach(paciente => {
        const tr = document.createElement('tr');
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
            <td>${paciente.telefono || '-'}</td>
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
window.openCreateModal = function() {
    document.getElementById('formNewPatient').reset();
    document.getElementById('editPatientId').value = ""; // ID vacío = Crear
    document.getElementById('btnSubmitPatient').innerText = "Guardar Paciente";
    document.querySelector('.modal-header h3').innerText = "Nuevo Paciente";
    
    // Limpiar errores visuales
    resetValidationUI();
    
    openModal('modalPatient');
}

// ABRIR MODAL PARA EDITAR (Lleno)
window.editPatient = function(id) {
    const paciente = allPatients.find(p => p.id_paciente === id);
    if (!paciente) return;

    // Llenar campos básicos
    document.getElementById('editPatientId').value = paciente.id_paciente;
    document.getElementById('inpNombre').value = paciente.nombre_completo;
    document.getElementById('inpCedula').value = paciente.cedula;
    document.getElementById('inpPass').value = paciente.password;
    document.getElementById('inpFecha').value = toInputDate(paciente.fecha_nacimiento);
    document.getElementById('inpTel').value = paciente.telefono;
    document.getElementById('inpCorreo').value = paciente.correo;
    document.getElementById('inpDir').value = paciente.direccion || "";
    document.getElementById('inpOcupacion').value = paciente.ocupacion || "";
    
    // IMPORTANTE: Llenar también antecedentes
    const inpAntecedentes = document.getElementById('inpAntecedentes');
    if(inpAntecedentes) {
        inpAntecedentes.value = paciente.antecedentes || "";
    }

    // Cambiar textos
    document.getElementById('btnSubmitPatient').innerText = "Actualizar Datos";
    document.querySelector('.modal-header h3').innerText = "Editar Paciente";
    
    resetValidationUI();
    openModal('modalPatient');
}

// ELIMINAR PACIENTE
window.deletePatient = function(id) {
    if (!confirm("¿Estás seguro de eliminar este paciente? Esta acción no se puede deshacer.")) return;

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ 
            action: "delete_record", 
            sheet: "pacientes", 
            id: id 
        })
    })
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            alert("Paciente eliminado.");
            loadPatientsTable();
        } else {
            alert("Error: " + res.message);
        }
    });
}

// GUARDAR (Crear o Editar según si hay ID)
const formNewPatient = document.getElementById('formNewPatient');
if (formNewPatient) {
    formNewPatient.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // VALIDACIÓN ESTRICTA DE 10 DÍGITOS
        const cedula = document.getElementById('inpCedula');
        const tel = document.getElementById('inpTel');
        let isValid = true;

        // Validar Cedula
        if (!validateLength(cedula.value)) {
            cedula.classList.add('input-error');
            const errCedula = document.getElementById('errorCedula');
            if(errCedula) errCedula.style.display = 'block';
            isValid = false;
        } else {
            resetInputUI(cedula, 'errorCedula');
        }

        // Validar Telefono (si hay algo escrito)
        if (tel.value.length > 0 && !validateLength(tel.value)) {
            tel.classList.add('input-error');
            const errTel = document.getElementById('errorTel');
            if(errTel) errTel.style.display = 'block';
            isValid = false;
        } else {
            resetInputUI(tel, 'errorTel');
        }

        if (!isValid) return; // Detener si hay errores

        // Preparar envío
        const btn = document.getElementById('btnSubmitPatient');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Procesando...";

        const formData = new FormData(this);
        let dataObj = {};
        formData.forEach((value, key) => {
            if (key !== 'password' && key !== 'correo' && typeof value === 'string') {
                dataObj[key] = value.toUpperCase();
            } else {
                dataObj[key] = value;
            }
        });

        const idPaciente = document.getElementById('editPatientId').value;
        let actionAPI = "create_record";
        
        if (idPaciente) {
            // MODO EDICIÓN
            actionAPI = "update_record";
        } else {
            // MODO CREACIÓN
            dataObj['id_paciente'] = "P-" + new Date().getTime();
            dataObj['fecha_registro'] = new Date().toISOString().split('T')[0];
        }

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: actionAPI, 
                sheet: "pacientes", 
                data: dataObj,
                id: idPaciente // Solo se usa si es update
            })
        })
        .then(r => r.json())
        .then(response => {
            if (response.success) {
                closeModal('modalPatient');
                showSuccessModal("¡Excelente!", idPaciente ? "Datos actualizados." : "Paciente registrado.");
                loadPatientsTable();
                switchView('patients');
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
    const links = document.querySelectorAll('.menu-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const span = link.querySelector('span');
            if(!span) return;
            const text = span.innerText;
            
            // Opción Pacientes
            if (text === "Pacientes") {
                e.preventDefault(); 
                switchView('patients');
                loadPatientsTable();
            } 
            // Opción Inicio
            else if (text === "Inicio") {
                e.preventDefault();
                switchView('home');
            }
            // --- NUEVO: Opción Tipo de Servicio ---
            else if (text === "Tipo de Servicio") {
                e.preventDefault();
                switchView('services');
                loadServicesAdmin(); // Carga la lista de servicios
            }
            // En setupNavigation...
            else if (text === "Agenda") {
                e.preventDefault();
                switchView('agenda');
                // Cargar la fecha que esté seleccionada en el input (o la de hoy)
                const dateInput = document.getElementById('agendaDateInput');
                if(dateInput && dateInput.value) {
                    loadAgenda(dateInput.value); // Función de agenda.js
                }
            }
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.style.display = 'block';
        target.style.animation = 'none';
        target.offsetHeight; 
        target.style.animation = 'fadeIn 0.4s ease-out';
    }
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if(!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (term === "") {
            renderTable(allPatients.slice(0, 5)); 
            document.getElementById('tableInfo').innerText = "Mostrando los últimos registros";
        } else {
            const filtered = allPatients.filter(p => 
                (p.nombre_completo && p.nombre_completo.toLowerCase().includes(term)) || 
                (p.cedula && String(p.cedula).includes(term))
            );
            renderTable(filtered);
            document.getElementById('tableInfo').innerText = `Encontradas ${filtered.length} coincidencias`;
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
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    
    // Oculta todos los textos de error
    document.querySelectorAll('.error-text').forEach(el => {
        if(el) el.style.display = 'none';
    });
}

function resetInputUI(input, errorId) {
    if(input) input.classList.remove('input-error');
    
    const errorMsg = document.getElementById(errorId);
    if (errorMsg) {
        errorMsg.style.display = 'none';
    }
}

function loadDashboardStats() {
    // Usamos la nueva acción optimizada que trae todo de una vez
    fetch(API_URL, { 
        method: "POST", 
        body: JSON.stringify({ action: "get_dashboard_stats" }) 
    })
    .then(r => r.json())
    .then(res => {
        if(res.success) {
            // Actualizar Pacientes
            const elPacientes = document.getElementById('stat-total-patients');
            if(elPacientes) elPacientes.innerText = res.data.total_pacientes;
            
            // Actualizar Citas Hoy
            const elHoy = document.getElementById('stat-citas-hoy');
            // Nota: Si usaste IDs diferentes en el HTML, ajústalos aquí
            if(elHoy) elHoy.innerText = res.data.citas_hoy;

            // Actualizar Citas Semana
            const elSemana = document.getElementById('stat-citas-semana');
            if(elSemana) elSemana.innerText = res.data.citas_semana;
        }
    });
}

window.openModal = function(modalId) { 
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.add('active'); 
}

window.closeModal = function(modalId) { 
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.remove('active'); 
}

function showSuccessModal(title, message) {
    const t = document.getElementById('successTitle');
    const m = document.getElementById('successMessage');
    const modal = document.getElementById('modalSuccess');
    
    if(t) t.innerText = title;
    if(m) m.innerText = message;
    if(modal) modal.classList.add('active');
}
// --- GESTIÓN DE SERVICIOS (ADMIN) ---

function loadServicesAdmin() {
    const list = document.getElementById('servicesList');
    list.innerHTML = "Cargando...";
    
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_services" }) })
    .then(r => r.json())
    .then(res => {
        list.innerHTML = "";
        if(res.success && res.data.length > 0) {
            res.data.forEach(s => {
                const li = document.createElement('li');
                li.style.cssText = "padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;";
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
    const list = document.getElementById('servicesList');
    list.innerHTML = "Cargando...";
    
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_services" }) })
    .then(r => r.json())
    .then(res => {
        list.innerHTML = "";
        if(res.success && res.data.length > 0) {
            globalServices = res.data; // Guardamos en memoria para editar fácil
            
            res.data.forEach(s => {
                const li = document.createElement('li');
                li.style.cssText = "padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;";
                
                // Mostrar recomendación cortada si es muy larga
                const shortRec = s.recomendaciones ? s.recomendaciones.substring(0, 30) + "..." : "Sin rec.";

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
const formService = document.getElementById('formService');
if(formService) {
    formService.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            nombre: document.getElementById('serviceName').value,
            recomendaciones: document.getElementById('serviceRecs').value
        };
        
        fetch(API_URL, { 
            method: "POST", 
            body: JSON.stringify({ action: "add_service", data: data }) 
        })
        .then(r => r.json())
        .then(() => {
            document.getElementById('serviceName').value = "";
            document.getElementById('serviceRecs').value = "";
            loadServicesAdmin(); 
        });
    });
}

// 2. Funciones de Edición
window.openEditService = function(id) {
    const service = globalServices.find(s => s.id === id);
    if(service) {
        document.getElementById('editServiceId').value = service.id;
        document.getElementById('editServiceName').value = service.nombre_servicio;
        document.getElementById('editServiceRecs').value = service.recomendaciones;
        openModal('modalEditService');
    }
}

const formEditService = document.getElementById('formEditService');
if(formEditService) {
    formEditService.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            id: document.getElementById('editServiceId').value,
            nombre: document.getElementById('editServiceName').value,
            recomendaciones: document.getElementById('editServiceRecs').value
        };
        
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "update_service", data: data })
        })
        .then(r => r.json())
        .then(res => {
            if(res.success) {
                closeModal('modalEditService');
                loadServicesAdmin();
            } else {
                alert("Error: " + res.message);
            }
        });
    });
}

// 3. Borrar Servicio
window.deleteService = function(id) {
    if(!confirm("¿Borrar este servicio?")) return;
    fetch(API_URL, { 
        method: "POST", 
        body: JSON.stringify({ action: "delete_service", id: id }) 
    })
    .then(r => r.json())
    .then(() => loadServicesAdmin());
}
