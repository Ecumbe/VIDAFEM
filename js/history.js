// js/history.js
// Módulo exclusivo para la Pestaña "Historial Clínico"

// Función principal que se llama al entrar a la pestaña
function loadHistoryModule(patientId) {
    console.log("Cargando módulo de historial para:", patientId);
    
    // A. Cargar Datos Básicos (Tarjeta 1) desde 'pacientes'
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_data", sheet: "pacientes" }) })
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            const patient = res.data.find(p => String(p.id_paciente) === String(patientId));
            if (patient) {
                renderCard1(patient);
            }
        }
    });

    // B. Cargar Datos Médicos (Tarjeta 2 y 3) desde 'historia_clinica'
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_history", id_paciente: patientId }) })
    .then(r => r.json())
    .then(res => {
        if (res.success && res.data) {
            fillHistoryForm(res.data);
        }
    });
}

// Llenar Tarjeta 1 (Solo Lectura)
function renderCard1(p) {
    safeTextHistory('h_nombre', p.nombre_completo);
    safeTextHistory('h_cedula', p.cedula);
    safeTextHistory('h_fecha', formatDateShow(p.fecha_nacimiento));
    safeTextHistory('h_edad', calculateAgeHistory(p.fecha_nacimiento));
    safeTextHistory('h_ocupacion', p.ocupacion);
    safeTextHistory('h_direccion', p.direccion);
}

// Llenar Formulario (Tarjetas 2 y 3)


function fillHistoryForm(data) {
    const form = document.getElementById('formHistory');
    if(!form) return;
    
    // Inputs de texto, fecha, textarea y select
    const inputs = form.querySelectorAll('input:not([type="checkbox"]), textarea, select');
    
    inputs.forEach(input => {
        if(data[input.name]) {
            // CORRECCIÓN: Si es un campo de fecha, cortamos el string ISO
            if (input.type === 'date') {
                // Tomamos solo la parte "YYYY-MM-DD" antes de la "T"
                try {
                    input.value = String(data[input.name]).split('T')[0];
                } catch(e) {
                    console.warn("Error parseando fecha:", data[input.name]);
                }
            } else {
                // Si es texto normal, lo pasamos directo
                input.value = data[input.name];
            }
        }
    });

    // Checkboxes (Igual que antes)
    const checks = form.querySelectorAll('input[type="checkbox"]');
    checks.forEach(chk => {
        if(data[chk.name] === true || data[chk.name] === 'true') {
            chk.checked = true;
        } else {
            chk.checked = false;
        }
    });
}
// --- BOTÓN GLOBAL EDITAR / GUARDAR ---
let isGlobalEditing = false;

// Esta función se llama desde el HTML onclick="toggleGlobalEdit()"
window.toggleGlobalEdit = function() {
    const btn = document.getElementById('btnGlobalEdit');
    const inputs = document.querySelectorAll('.history-input');
    
    if (!isGlobalEditing) {
        // ACTIVAR EDICIÓN
        inputs.forEach(inp => inp.disabled = false);
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Historia';
        btn.style.background = "#27ae60"; // Verde
        isGlobalEditing = true;
    } else {
        // GUARDAR CAMBIOS
        saveHistoryChanges(btn, inputs);
    }
}

function saveHistoryChanges(btn, inputs) {
    btn.innerText = "Guardando...";
    btn.disabled = true;

    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');
    const form = document.getElementById('formHistory');
    
    let dataObj = { id_paciente: patientId };
    
    // Recolectar datos
    const formInputs = form.querySelectorAll('input:not([type="checkbox"]), textarea, select');
    formInputs.forEach(i => dataObj[i.name] = i.value);
    
    const checks = form.querySelectorAll('input[type="checkbox"]');
    checks.forEach(c => dataObj[c.name] = c.checked);

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "save_history", data: dataObj })
    })
    .then(r => r.json())
    .then(res => {
        if(res.success) {
            alert("Historia clínica actualizada correctamente.");
            
            // Volver a bloquear
            inputs.forEach(inp => inp.disabled = true);
            btn.innerHTML = '<i class="fas fa-edit"></i> Editar Información';
            btn.style.background = ""; 
            btn.disabled = false;
            isGlobalEditing = false;
        } else {
            alert("Error: " + res.message);
            btn.disabled = false;
        }
    });
}

// Helpers internos para este archivo
function safeTextHistory(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text || "---";
}

function formatDateShow(dateString) {
    if(!dateString) return "-";
    const parts = dateString.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`; 
}

function calculateAgeHistory(dateString) {
    if (!dateString) return "-";
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age + " años";
}