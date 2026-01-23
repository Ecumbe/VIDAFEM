// js/clinical.js - Controlador Principal del Expediente (Versión Blindada y Limpia)

// VARIABLE GLOBAL DEL ID PACIENTE
let currentPatientId = null;

// ==========================================
// 1. FUNCIONES GLOBALES (Modales y Utilidades)
// ==========================================
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
        alert("Error: No se ha seleccionado un paciente. Volviendo al inicio.");
        window.location.href = "admin.html";
        return;
    }
    
    // Guardamos el ID en la variable global
    currentPatientId = patientId;
    
    // 2. Cargar Cabecera Mini (Siempre visible)
    loadMiniHeader(patientId);

    // 3. Cargar la pestaña por defecto (Historial Clínico)
    // Verificamos si existe la función antes de llamarla
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

// ==========================================
// 2. SISTEMA DE PESTAÑAS (ROUTER)
// ==========================================
window.switchTab = function(tabName) {
    // UI Updates
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activar botón
    const buttons = document.querySelectorAll('.tab-btn');
    // Asumiendo el orden: 0=Historial, 1=Citas, 2=Diagnóstico
    if(tabName === 'historial' && buttons[0]) buttons[0].classList.add('active');
    if(tabName === 'citas' && buttons[1]) buttons[1].classList.add('active');
    if(tabName === 'diagnostico' && buttons[2]) buttons[2].classList.add('active');

    const target = document.getElementById(`tab-${tabName}`);
    if(target) target.classList.add('active');

    // LOGICA DE DATOS
    const id = currentPatientId;

    // A. HISTORIAL
    if (tabName === 'historial' && typeof loadHistoryModule === 'function') {
        loadHistoryModule(id);
    }

    // B. CITAS
    if (tabName === 'citas') {
        loadAppointmentHistory(id);
    }
    
    // C. DIAGNOSTICO
    if (tabName === 'diagnostico') {
        loadDiagnosisHistory(); 
    }
}

// ==========================================
// 3. MÓDULO DE CITAS (LISTADO Y AGENDAMIENTO)
// ==========================================
function loadAppointmentHistory(patientId) {
    const container = document.querySelector('#tab-citas .clinical-timeline-container');
    if (!container) return; 
    
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
            container.innerHTML = `<div class="empty-state"><p>No hay citas registradas.</p></div>`;
        }
    });
}

window.openAppointmentModal = function() {
    const id = currentPatientId;
    const inputId = document.getElementById('apptPatientId');
    if(inputId) inputId.value = id;
    
    const select = document.getElementById('apptReason');
    const txtRecs = document.getElementById('apptRecs');

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
                    opt.setAttribute('data-recs', s.recomendaciones || "");
                    select.appendChild(opt);
                });
            }
        });

        select.onchange = function() {
            const selectedOption = select.options[select.selectedIndex];
            const savedRecs = selectedOption.getAttribute('data-recs');
            if(txtRecs) {
                if (savedRecs) {
                    txtRecs.value = savedRecs;
                    txtRecs.style.backgroundColor = "#fff9c4";
                    setTimeout(() => txtRecs.style.backgroundColor = "#fff", 500);
                } else {
                    txtRecs.value = "";
                }
            }
        };
    }

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
        const newForm = formAppt.cloneNode(true);
        formAppt.parentNode.replaceChild(newForm, formAppt);
        
        newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('button');
            const originalText = btn.innerText;
            btn.disabled = true; btn.innerText = "Enviando...";

            const fechaVal = document.getElementById('apptDate').value;
            const horaVal = document.getElementById('apptTime').value;
            const motivoVal = document.getElementById('apptReason').value;

            const data = {
                id_paciente: document.getElementById('apptPatientId').value,
                fecha: fechaVal,
                hora: horaVal,
                motivo: motivoVal + " | Nota: " + document.getElementById('apptNotes').value,
                recomendaciones: document.getElementById('apptRecs').value,
                creado_por: "DOCTOR"
            };

            fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ action: "schedule_appointment", data: data })
            })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    window.closeModal('modalAppointment');
                    this.reset();
                    
                    const nombrePac = res.nombre || "Paciente";
                    const telPac = res.telefono || "";
                    const mensaje = `*VIDAFEM - Consultorio Gineco-Obstétrico*\n\nHola ${nombrePac}, tu cita ha sido agendada correctamente.\n\n📅 *Fecha:* ${fechaVal}\n⏰ *Hora:* ${horaVal}\n📍 *Lugar:* Consultorio VIDAFEM Cdla. La Garzota. Av. Agustín Freire Icaza, diagonal a la Unidad Educativa Provincia de Tungurahua a 2 min del terminal terrestre.\n\n${data.recomendaciones ? '⚠️ *Recomendaciones:* ' + data.recomendaciones : ''}`;
                    
                    const btnWa = document.getElementById('btnWaSuccess');
                    
                    if (telPac && telPac.length >= 9) {
                        let cleanTel = telPac.replace(/^0+/, '');
                        btnWa.href = `https://wa.me/593${cleanTel}?text=${encodeURIComponent(mensaje)}`;
                        btnWa.style.display = "flex"; 
                    } else {
                        btnWa.style.display = "none"; 
                    }

                    window.openModal('modalSuccessAppt');

                    if(typeof loadAppointmentHistory === 'function') {
                        loadAppointmentHistory(currentPatientId);
                    }
                } else {
                    alert(res.message);
                }
            })
            .finally(() => {
                btn.disabled = false;
                btn.innerText = originalText;
            });
        });
    }
}

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
                loadAppointmentHistory(currentPatientId);
            } else {
                alert("Error: " + res.message);
            }
        })
        .finally(() => { btn.disabled = false; btn.innerText = originalText; });
    });
}

// 1. Función para IR a la nueva página de creación
function goToNewDiagnosis() {
    if(currentPatientId) {
        window.location.href = `diagnostico.html?patientId=${currentPatientId}`;
    } else {
        alert("Error: No hay paciente seleccionado.");
    }
}

// ==========================================
// 4. MÓDULO DE DIAGNÓSTICOS (VISUALIZACIÓN)
// ==========================================

function loadDiagnosisHistory() {
    const container = document.getElementById('diagnosisHistoryList');
    if(!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;"><i class="fas fa-circle-notch fa-spin"></i> Buscando expedientes...</div>';

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_diagnosis_history", id_paciente: currentPatientId })
    })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = "";
        
        if (res.success && res.data && res.data.length > 0) {
            res.data.forEach(rep => {
                
                // 1. Extraer datos guardados (JSON)
                let extraData = {};
                try {
                    // A veces viene como string, a veces como objeto
                    extraData = (typeof rep.datos_json === 'string') ? JSON.parse(rep.datos_json) : rep.datos_json;
                } catch(e) { console.warn("Error leyendo JSON", e); }

                // 2. CONSTRUIR BOTONES
                let botonesHtml = "";

                // A. VER REPORTE (El PDF principal)
                if (rep.pdf_url) {
                    botonesHtml += `
                        <button onclick="window.open('${rep.pdf_url}', '_blank')" class="btn-mini" style="background:#36235d; color:white;">
                            <i class="fas fa-file-pdf"></i> Reporte
                        </button>
                    `;
                }

                // B. VER RECETA (Si existe link guardado)
                if (extraData.pdf_receta_link) {
                    botonesHtml += `
                        <button onclick="window.open('${extraData.pdf_receta_link}', '_blank')" class="btn-mini" style="background:#27ae60; color:white;">
                            <i class="fas fa-prescription-bottle-alt"></i> Receta
                        </button>
                    `;
                }

                // C. VER EXAMEN SUBIDO (Si existe link guardado)
                if (extraData.pdf_externo_link) {
                    botonesHtml += `
                        <button onclick="window.open('${extraData.pdf_externo_link}', '_blank')" class="btn-mini" style="background:#2980b9; color:white;">
                            <i class="fas fa-paperclip"></i> Examen Adjunto
                        </button>
                    `;
                }

                // D. EDITAR (Solo carga los datos en el formulario)
                // Usamos editReportRedirect que ya definimos o definiremos
                botonesHtml += `
                    <button onclick="editReportRedirect('${rep.id_reporte}')" class="btn-mini" style="background:#f39c12; color:white;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                `;

                // E. ELIMINAR (Solo Doctor)
                const btnEliminar = `
                    <button onclick="deleteReport('${rep.id_reporte}')" style="background:none; border:none; color:#c0392b; cursor:pointer;" title="Eliminar definitivamente">
                        <i class="fas fa-trash"></i>
                    </button>
                `;

                // 3. DIBUJAR TARJETA
                const card = document.createElement('div');
                card.className = "card";
                card.style.borderLeft = "5px solid #36235d"; 
                card.style.marginBottom = "15px";
                card.style.padding = "15px";
                
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h4 style="margin:0; color:#36235d; text-transform:uppercase;">${rep.tipo_examen || "REPORTE"}</h4>
                            <small style="color:#777;">
                                <i class="far fa-calendar-alt"></i> ${new Date(rep.fecha).toLocaleString()} 
                            </small>
                        </div>
                        ${btnEliminar}
                    </div>
                    
                    <div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap;">
                        ${botonesHtml}
                    </div>
                `;
                container.appendChild(card);
            });

        } else {
            container.innerHTML = `<p style="text-align:center; color:#888;">No hay reportes registrados.</p>`;
        }
    });
}

// Estilos dinámicos para los botones pequeños
const style = document.createElement('style');
style.innerHTML = `
  .btn-mini { padding: 5px 10px; border:none; border-radius:4px; font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:5px; }
  .btn-mini:hover { opacity: 0.9; }
`;
document.head.appendChild(style);

// 5. ELIMINAR REPORTE
window.deleteReport = function(idReporte) {
    if(!confirm("¿ESTÁS SEGURO?\n\nSe eliminará el registro y el archivo PDF de Google Drive permanentemente.")) return;

    const container = document.getElementById('diagnosisHistoryList');
    const oldContent = container.innerHTML;
    container.innerHTML = '<p style="text-align:center; color:red;">Eliminando archivos, por favor espere...</p>';

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete_diagnosis", id_reporte: idReporte })
    })
    .then(r => r.json())
    .then(res => {
        if(res.success) {
            alert("Eliminado correctamente.");
            loadDiagnosisHistory(); 
        } else {
            alert("Error: " + res.message);
            container.innerHTML = oldContent; 
        }
    })
    .catch(e => {
        alert("Error de conexión");
        container.innerHTML = oldContent;
    });
}

// 6. REDIRIGIR A EDITAR
window.editReportRedirect = function(idReporte) {
    window.location.href = `diagnostico.html?patientId=${currentPatientId}&reportId=${idReporte}`;
}