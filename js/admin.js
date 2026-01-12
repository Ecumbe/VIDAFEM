// js/admin.js - VIDAFEM v3.0 (CRUD Completo)

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
        
        // Aquí mostramos la EDAD en vez de la fecha
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

                    <button class="btn-icon" onclick="openHistory('${paciente.id_paciente}')" title="Historial">
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

    // Llenar campos
    document.getElementById('editPatientId').value = paciente.id_paciente;
    document.getElementById('inpNombre').value = paciente.nombre_completo;
    document.getElementById('inpCedula').value = paciente.cedula;
    document.getElementById('inpPass').value = paciente.password;
    document.getElementById('inpFecha').value = toInputDate(paciente.fecha_nacimiento);
    document.getElementById('inpTel').value = paciente.telefono;
    document.getElementById('inpCorreo').value = paciente.correo;
    document.getElementById('inpDir').value = paciente.direccion || "";
    document.getElementById('inpOcupacion').value = paciente.ocupacion || "";

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
document.getElementById('formNewPatient').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // VALIDACIÓN ESTRICTA DE 10 DÍGITOS
    const cedula = document.getElementById('inpCedula');
    const tel = document.getElementById('inpTel');
    let isValid = true;

    // Validar Cedula
    if (!validateLength(cedula.value)) {
        cedula.classList.add('input-error');
        document.getElementById('errorCedula').style.display = 'block';
        isValid = false;
    } else {
        resetInputUI(cedula, 'errorCedula');
    }

    // Validar Telefono (si hay algo escrito)
    if (tel.value.length > 0 && !validateLength(tel.value)) {
        tel.classList.add('input-error');
        document.getElementById('errorTel').style.display = 'block';
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


// ============================
// 4. NAVEGACIÓN Y SEARCH (Igual que antes)
// ============================
function setupNavigation() {
    const links = document.querySelectorAll('.menu-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const span = link.querySelector('span');
            if(!span) return;
            const text = span.innerText;
            if (text === "Pacientes") {
                e.preventDefault(); 
                switchView('patients');
                loadPatientsTable();
            } else if (text === "Inicio") {
                e.preventDefault();
                switchView('home');
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

// Helpers Visuales
// Helpers Visuales (Versión Segura Anti-Errores)

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
    
    // AQUÍ ESTABA EL ERROR: Verificamos si existe antes de tocar su estilo
    const errorMsg = document.getElementById(errorId);
    if (errorMsg) {
        errorMsg.style.display = 'none';
    }
}
function loadDashboardStats() {
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_data", sheet: "pacientes" }) })
    .then(r => r.json())
    .then(res => {
        if(res.success) {
            const statCounter = document.getElementById('stat-total-patients');
            if(statCounter) statCounter.innerText = res.data.length;
        }
    });
}

// Modales (Globales)
window.openModal = function(modalId) { document.getElementById(modalId).classList.add('active'); }
window.closeModal = function(modalId) { document.getElementById(modalId).classList.remove('active'); }
function showSuccessModal(title, message) {
    document.getElementById('successTitle').innerText = title;
    document.getElementById('successMessage').innerText = message;
    document.getElementById('modalSuccess').classList.add('active');
}