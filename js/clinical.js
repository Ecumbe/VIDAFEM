// js/clinical.js - Controlador Principal del Expediente

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener ID
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');

    if (!patientId) {
        alert("Volviendo al inicio.");
        window.location.href = "admin.html";
        return;
    }
    
    // 2. Cargar Cabecera Mini (Siempre visible)
    loadMiniHeader(patientId);

    // 3. Cargar la pestaña por defecto (Historial)
    // Ahora delegamos la tarea al nuevo archivo history.js
    if(typeof loadHistoryModule === 'function') {
        loadHistoryModule(patientId);
    }
});

// Carga solo la barrita superior con ID y Edad
function loadMiniHeader(id) {
    const nameLabel = document.getElementById('clinName');
    if(nameLabel) nameLabel.innerText = "Cargando...";

    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_data", sheet: "pacientes" }) })
    .then(r => r.json())
    .then(response => {
        if (response.success) {
            const patient = response.data.find(p => String(p.id_paciente) === String(id));
            if (patient) {
                // Llenar datos mini
                safeText('headerPatientName', patient.nombre_completo);
                safeText('clinName', patient.nombre_completo);
                safeText('clinId', "ID: " + patient.cedula);
                safeText('clinAge', calculateAge(patient.fecha_nacimiento));
            }
        }
    });
}

// Helper seguro
function safeText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.innerText = text || "---";
}

function calculateAge(dateString) {
    if (!dateString) return "-";
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age + " años";
}

// --- SISTEMA DE PESTAÑAS (ROUTER) ---
function switchTab(tabName) {
    // UI Updates...
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const buttons = document.querySelectorAll('.tab-btn');
    if(tabName === 'historial') buttons[0].classList.add('active');
    if(tabName === 'citas') buttons[1].classList.add('active');
    if(tabName === 'diagnostico') buttons[2].classList.add('active');

    const target = document.getElementById(`tab-${tabName}`);
    if(target) target.classList.add('active');

    // LOGICA DE DATOS
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    // A. HISTORIAL
    if (tabName === 'historial' && typeof loadHistoryModule === 'function') {
        loadHistoryModule(id);
    }

    // B. CITAS (ESTO ES LO NUEVO QUE FALTABA)
    if (tabName === 'citas') {
        loadAppointmentHistory(id);
    }
    
    // C. DIAGNOSTICO
    if (tabName === 'diagnostico' && typeof loadDiagnosesList === 'function') {
        loadDiagnosesList(id);
    }
}
// ... (resto del archivo arriba) ...

// --- LISTA DE CITAS DEL PACIENTE + REAGENDAR ---
function loadAppointmentHistory(patientId) {
    const container = document.querySelector('#tab-citas .clinical-timeline-container');
    container.innerHTML = '<p>Cargando historial...</p>';

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_patient_appointments", id_paciente: patientId })
    })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = ""; 
        if (res.success && res.data.length > 0) {
            res.data.forEach(cita => {
                const item = document.createElement('div');
                item.className = "card";
                item.style.marginBottom = "10px";
                item.style.borderLeft = "4px solid #ccc";
                
                let estadoColor = "#ccc";
                let icon = "fa-clock";
                
                if(cita.estado === "ASISTIO") { item.style.borderLeftColor = "#27ae60"; estadoColor = "#27ae60"; icon = "fa-check-circle"; }
                if(cita.estado === "NO_ASISTIO") { item.style.borderLeftColor = "#e74c3c"; estadoColor = "#e74c3c"; icon = "fa-times-circle"; }
                if(cita.estado === "REAGENDADO") { item.style.borderLeftColor = "#f39c12"; estadoColor = "#f39c12"; icon = "fa-history"; }

                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 style="margin:0; color:var(--c-primary);"><i class="fas fa-calendar-day"></i> ${cita.fecha} <small style="color:#666; margin-left:10px;">${cita.hora}</small></h4>
                            <p style="margin:5px 0;">${cita.motivo}</p>
                            ${cita.recomendaciones ? `<small style="color:#e67e22;">${cita.recomendaciones}</small>` : ''}
                        </div>
                        <div style="text-align:right; display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                            <span style="color:${estadoColor}; font-weight:bold; font-size:0.9rem;">
                                <i class="fas ${icon}"></i> ${cita.estado}
                            </span>
                            <button onclick="openReschedule('${cita.id_cita}')" style="background:#fff; border:1px solid #f39c12; color:#f39c12; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                                <i class="fas fa-edit"></i> Reagendar
                            </button>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = `<div class="empty-state"><p>No hay citas.</p></div>`;
        }
    });
}

// Lógica del Modal Reagendar (IGUAL QUE EN AGENDA.JS)
function openReschedule(idCita) {
    document.getElementById('reschIdCita').value = idCita;
    const dateIn = document.getElementById('reschDate');
    dateIn.value = "";
    dateIn.min = new Date().toISOString().split('T')[0];
    dateIn.addEventListener('change', loadRescheduleHours); // Activar listener
    
    document.getElementById('reschTime').innerHTML = '<option>Selecciona fecha...</option>';
    document.getElementById('modalReschedule').classList.add('active');
}

function loadRescheduleHours() {
    const dateVal = document.getElementById('reschDate').value;
    const timeSelect = document.getElementById('reschTime');
    if(!dateVal) return;
    
    timeSelect.innerHTML = '<option>Cargando...</option>';
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: dateVal }) })
    .then(r => r.json())
    .then(res => {
        const taken = res.data || [];
        timeSelect.innerHTML = "";
        for (let h = 9; h <= 16; h++) {
            ["00", "30"].forEach(m => {
                if(h===16 && m==="30") return;
                const t = `${h<10?'0'+h:h}:${m}`;
                if(!taken.includes(t)) {
                    const opt = document.createElement('option');
                    opt.value = t; opt.innerText = t;
                    timeSelect.appendChild(opt);
                }
            });
        }
    });
}

// Listener del formulario
const formResch = document.getElementById('formReschedule');
if(formResch) {
    formResch.addEventListener('submit', function(e) {
        e.preventDefault();
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        btn.disabled = true; btn.innerText = "Procesando...";
        
        const data = {
            id_cita: document.getElementById('reschIdCita').value,
            nueva_fecha: document.getElementById('reschDate').value,
            nueva_hora: document.getElementById('reschTime').value
        };
        
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "reschedule_appointment", data: data })
        })
        .then(r => r.json())
        .then(res => {
            if(res.success) {
                alert("Cita reagendada.");
                closeModal('modalReschedule');
                // Recargar lista
                const urlParams = new URLSearchParams(window.location.search);
                loadAppointmentHistory(urlParams.get('id'));
            } else {
                alert("Error: " + res.message);
            }
        })
        .finally(() => { btn.disabled = false; btn.innerText = originalText; });
    });
}