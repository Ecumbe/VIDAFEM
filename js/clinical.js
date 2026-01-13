// js/clinical.js - Controlador Principal del Expediente (Versión Blindada)

// Hacemos estas funciones GLOBALES para que el HTML siempre las encuentre
window.openModal = function(id) {
    const modal = document.getElementById(id);
    if(modal) modal.classList.add('active');
}

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if(modal) modal.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener ID del paciente
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
    if(typeof loadHistoryModule === 'function') {
        loadHistoryModule(patientId);
    }
    
    // 4. Configurar listeners de Citas si existen los elementos
    setupAppointmentListeners();
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
                safeText('headerPatientName', patient.nombre_completo);
                safeText('clinName', patient.nombre_completo);
                safeText('clinId', "ID: " + patient.cedula);
                safeText('clinAge', calculateAge(patient.fecha_nacimiento));
            }
        }
    });
}

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
// Hacemos global también la función switchTab por si acaso
window.switchTab = function(tabName) {
    // UI Updates
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activar botón (Buscamos el que tenga el onclick correspondiente)
    const buttons = document.querySelectorAll('.tab-btn');
    // Mapeo simple basado en el orden de tus botones en el HTML
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

    // B. CITAS
    if (tabName === 'citas') {
        loadAppointmentHistory(id);
    }
    
    // C. DIAGNOSTICO
    if (tabName === 'diagnostico' && typeof loadDiagnosesList === 'function') {
        loadDiagnosesList(id);
    }
}

// --- LISTA DE CITAS DEL PACIENTE + REAGENDAR ---
function loadAppointmentHistory(patientId) {
    const container = document.querySelector('#tab-citas .clinical-timeline-container');
    if (!container) return; // Protección si no existe
    
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

// --- FUNCIONES DE AGENDAMIENTO ---

// Hacemos global openAppointmentModal para el botón HTML
// js/clinical.js

window.openAppointmentModal = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const inputId = document.getElementById('apptPatientId');
    if(inputId) inputId.value = id;
    
    // CAMBIO IMPORTANTE AQUÍ:
    const select = document.getElementById('apptReason');
    const txtRecs = document.getElementById('apptRecs'); // El cuadro de texto

    if(select) {
        select.innerHTML = '<option>Cargando servicios...</option>';
        fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_services" }) })
        .then(r => r.json())
        .then(res => {
            select.innerHTML = '<option value="">Selecciona un servicio...</option>';
            
            if(res.success && res.data.length > 0) {
                res.data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.nombre_servicio;
                    opt.innerText = s.nombre_servicio;
                    
                    // AQUÍ ESTÁ EL TRUCO: Guardamos la recomendación en un atributo oculto
                    // Usamos encodeURIComponent para evitar problemas con comillas o espacios raros
                    opt.setAttribute('data-recs', s.recomendaciones || "");
                    
                    select.appendChild(opt);
                });
            }
        });

        // ESCUCHAR EL CAMBIO (Dispara el autollenado)
        select.onchange = function() {
            // Obtener la opción seleccionada
            const selectedOption = select.options[select.selectedIndex];
            // Leer el dato oculto
            const savedRecs = selectedOption.getAttribute('data-recs');
            
            // Si hay cuadro de texto y hay recomendación, llenarlo
            if(txtRecs) {
                if (savedRecs) {
                    txtRecs.value = savedRecs;
                    // Efecto visual opcional (resaltar amarillo un segundo)
                    txtRecs.style.backgroundColor = "#fff9c4";
                    setTimeout(() => txtRecs.style.backgroundColor = "#fff", 500);
                } else {
                    txtRecs.value = ""; // Limpiar si no tiene
                }
            }
        };
    }

    // Configurar fecha mínima
    const dateInput = document.getElementById('apptDate');
    if(dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.onchange = loadAvailableHours; 
    }

    window.openModal('modalAppointment');
}



function loadAvailableHours() {
    const dateVal = document.getElementById('apptDate').value;
    const timeSelect = document.getElementById('apptTime');
    if(!dateVal || !timeSelect) return;
    
    timeSelect.innerHTML = '<option>Verificando...</option>';
    timeSelect.disabled = true;

    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: dateVal }) })
    .then(r => r.json())
    .then(res => {
        const taken = res.data || [];
        timeSelect.innerHTML = "";
        timeSelect.disabled = false;
        
        let hasSlots = false;
        for (let h = 9; h <= 16; h++) {
            ["00", "30"].forEach(m => {
                if(h===16 && m==="30") return;
                const hStr = h < 10 ? `0${h}` : `${h}`;
                const t = `${hStr}:${m}`;
                if (!taken.includes(t)) {
                    const opt = document.createElement('option');
                    opt.value = t; opt.innerText = t;
                    timeSelect.appendChild(opt);
                    hasSlots = true;
                }
            });
        }
        if(!hasSlots) timeSelect.innerHTML = "<option>Sin cupos</option>";
    });
}

function setupAppointmentListeners() {
    const formAppt = document.getElementById('formAppointment');
    if(formAppt) {
        // Remover listeners anteriores para evitar duplicados si se llama varias veces
        const newForm = formAppt.cloneNode(true);
        formAppt.parentNode.replaceChild(newForm, formAppt);
        
        newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('button');
            const originalText = btn.innerText;
            btn.disabled = true; btn.innerText = "Enviando...";

            const data = {
                id_paciente: document.getElementById('apptPatientId').value,
                fecha: document.getElementById('apptDate').value,
                hora: document.getElementById('apptTime').value,
                motivo: document.getElementById('apptReason').value + " | Nota: " + document.getElementById('apptNotes').value,
                recomendaciones: document.getElementById('apptRecs').value,
                creado_por: "DOCTOR"
            };

            fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ action: "schedule_appointment", data: data })
            })
            .then(r => r.json())
            .then(response => {
                if (response.success) {
                    alert("Cita agendada.");
                    window.closeModal('modalAppointment');
                    this.reset();
                    // Recargar lista si estamos en la pestaña
                    const urlParams = new URLSearchParams(window.location.search);
                    loadAppointmentHistory(urlParams.get('id'));
                } else {
                    alert(response.message);
                }
            })
            .finally(() => {
                btn.disabled = false;
                btn.innerText = originalText;
            });
        });
    }
}

// --- LÓGICA DE REAGENDAR (GLOBALES) ---
window.openReschedule = function(idCita) {
    const inputId = document.getElementById('reschIdCita');
    const dateIn = document.getElementById('reschDate');
    const timeIn = document.getElementById('reschTime');
    
    if(inputId) inputId.value = idCita;
    if(dateIn) {
        dateIn.value = "";
        dateIn.min = new Date().toISOString().split('T')[0];
        dateIn.onchange = loadRescheduleHours;
    }
    if(timeIn) timeIn.innerHTML = '<option>Selecciona fecha...</option>';
    
    window.openModal('modalReschedule');
}

function loadRescheduleHours() {
    const dateVal = document.getElementById('reschDate').value;
    const timeSelect = document.getElementById('reschTime');
    if(!dateVal || !timeSelect) return;
    
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

// Configurar listener del formulario de reagendar
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
                window.closeModal('modalReschedule');
                const urlParams = new URLSearchParams(window.location.search);
                loadAppointmentHistory(urlParams.get('id'));
            } else {
                alert("Error: " + res.message);
            }
        })
        .finally(() => { btn.disabled = false; btn.innerText = originalText; });
    });
}
