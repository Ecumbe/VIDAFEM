// js/history.js - Módulo de Historial Clínico

function loadHistoryModule(patientId) {
    // 1. Datos Fijos (Tarjeta 1)
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_data", sheet: "pacientes" }) })
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            const patient = res.data.find(p => String(p.id_paciente) === String(patientId));
            if (patient) renderCard1(patient);
        }
    });

    // 2. Datos Médicos (Tarjetas 2 y 3)
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_history", id_paciente: patientId }) })
    .then(r => r.json())
    .then(res => {
        if (res.success && res.data) {
            fillHistoryForm(res.data);
        }
    });
}

function renderCard1(p) {
    safeTextHistory('h_nombre', p.nombre_completo);
    safeTextHistory('h_cedula', p.cedula);
    safeTextHistory('h_fecha', formatDateShow(p.fecha_nacimiento));
    safeTextHistory('h_edad', calculateAgeHistory(p.fecha_nacimiento));
    safeTextHistory('h_ocupacion', p.ocupacion);
    safeTextHistory('h_direccion', p.direccion);
}

// --- LLENAR EL FORMULARIO ---
function fillHistoryForm(data) {
    const form = document.getElementById('formHistory');
    if(!form) return;
    
    // Inputs normales (incluyendo las nuevas cajitas de números)
    const inputs = form.querySelectorAll('input:not([type="radio"]), textarea, select');
    inputs.forEach(input => {
        if(data[input.name] !== undefined) {
            if (input.type === 'date') {
                try { input.value = String(data[input.name]).split('T')[0]; } 
                catch(e) {}
            } else {
                input.value = data[input.name];
            }
        }
    });

    // RADIO BUTTONS (Parto / Aborto)
    // El backend envía 'tipo_ultimo'
    if (data.tipo_ultimo) {
        const radio = form.querySelector(`input[name="tipo_ultimo"][value="${data.tipo_ultimo}"]`);
        if (radio) radio.checked = true;
    }
}

// --- BOTÓN GLOBAL EDITAR / GUARDAR ---
window.toggleGlobalEdit = function() {
    const btn = document.getElementById('btnGlobalEdit');
    const form = document.getElementById('formHistory');
    
    // PROTECCIÓN CONTRA EL ERROR "NULL"
    if (!form) {
        alert("Error crítico: No se encuentra el formulario de historial. Recarga la página.");
        return;
    }

    const inputs = form.querySelectorAll('.history-input');
    
    if (btn.innerText.includes("Editar")) {
        // MODO EDICIÓN
        inputs.forEach(inp => inp.disabled = false);
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Historia';
        btn.style.background = "#27ae60"; 
    } else {
        // MODO GUARDAR
        saveHistoryChanges(btn, inputs, form);
    }
}

function saveHistoryChanges(btn, inputs, form) {
    btn.innerText = "Guardando...";
    btn.disabled = true;

    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');
    
    let dataObj = { id_paciente: patientId };
    
    // 1. Recolectar Inputs normales
    const formInputs = form.querySelectorAll('input:not([type="radio"]), textarea, select');
    formInputs.forEach(i => dataObj[i.name] = i.value);
    
    // 2. Recolectar Radio Button (Tipo Último)
    const selectedRadio = form.querySelector('input[name="tipo_ultimo"]:checked');
    dataObj['tipo_ultimo'] = selectedRadio ? selectedRadio.value : "";

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "save_history", data: dataObj })
    })
    .then(r => r.json())
    .then(res => {
        if(res.success) {
            alert("Historia clínica actualizada.");
            inputs.forEach(inp => inp.disabled = true);
            btn.innerHTML = '<i class="fas fa-edit"></i> Editar Información';
            btn.style.background = ""; 
            btn.disabled = false;
        } else {
            alert("Error: " + res.message);
            btn.disabled = false;
        }
    });
}

// Helpers internos
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