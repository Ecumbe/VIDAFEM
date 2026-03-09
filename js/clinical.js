// js/clinical.js - Controlador Principal del Expediente (Versión Blindada y Limpia)

// VARIABLE GLOBAL DEL ID PACIENTE
let currentPatientId = null;
let currentPatientName = "";
let currentPatientPhone = "";
let isSchedulingAppointment = false;
let isReschedulingAppointment = false;
let isDeletingReport = false;
let deletingAppointments = {};
let isRescheduleHoursLoading = false;
let rescheduleHoursRequestSeq = 0;

function getSessionDataSafe() {
    try {
        const raw = sessionStorage.getItem('vidafem_session');
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
        alert("Sesión inválida o expirada. Inicia sesión nuevamente.");
        try { sessionStorage.removeItem("vidafem_session"); } catch (e) {}
        window.location.href = 'index.html';
        return null;
    }
    return s;
}

function getRequesterFromSession() {
    const s = requireDoctorSession();
    if (!s) return null;
    return (s.data && (s.data.usuario || s.data.usuario_doctor || s.data.nombre_doctor)) || null;
}

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
    // 1. Validar sesión y obtener ID del paciente
    const sessionData = requireDoctorSession();
    if (!sessionData) return;

    // Obtener ID del paciente
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');
    const initialTab = String(urlParams.get('tab') || 'historial').toLowerCase();

    if (!patientId) {
        alert("Error: No se ha seleccionado un paciente. Volviendo al inicio.");
        window.location.href = "admin.html";
        return;
    }

    // Guardamos el ID en la variable global
    currentPatientId = patientId;
    
    // 2. Cargar Cabecera Mini (Siempre visible)
    loadMiniHeader(patientId, sessionData.data && (sessionData.data.usuario || sessionData.data.usuario_doctor));

    // 3. Cargar la pestaña por defecto (Historial Clínico)
    // Verificamos si existe la función antes de llamarla
    const tabToOpen = (initialTab === 'citas' || initialTab === 'diagnostico' || initialTab === 'evolucion') ? initialTab : 'historial';
    switchTab(tabToOpen);
    
    // 4. Configurar listeners de Citas si existen los elementos
    setupAppointmentListeners();
});

// Carga solo la barrita superior con ID y Edad
function loadMiniHeader(id) {
    const nameLabel = document.getElementById('clinName');
    if(nameLabel) nameLabel.innerText = "Cargando...";
    // requester param will be appended if provided to allow backend permission checks
    const requester = arguments[1] || null;
    const body = { action: "get_data", sheet: "pacientes" };
    if (requester) body.requester = requester;

    fetch(API_URL, { method: "POST", body: JSON.stringify(body) })
    .then(r => r.json())
    .then(response => {
        if (response.success) {
            const patient = response.data.find(p => String(p.id_paciente) === String(id));
            if (patient) {
                currentPatientName = String(patient.nombre_completo || "");
                currentPatientPhone = String(patient.telefono || "");
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
    const safeTab = (tabName === 'citas' || tabName === 'diagnostico' || tabName === 'evolucion') ? tabName : 'historial';

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.menu-link[data-tab]').forEach(link => link.classList.remove('active'));

    const target = document.getElementById(`tab-${safeTab}`);
    if(target) target.classList.add('active');

    const activeLink = document.querySelector(`.menu-link[data-tab="${safeTab}"]`);
    if (activeLink) activeLink.classList.add('active');

    const id = currentPatientId;
    if (safeTab === 'historial' && typeof loadHistoryModule === 'function') {
        loadHistoryModule(id);
    }
    if (safeTab === 'citas') {
        loadAppointmentHistory(id);
    }
    if (safeTab === 'diagnostico') {
        loadDiagnosisHistory();
    }
    if (safeTab === 'evolucion' && typeof loadEvolutionModule === 'function') {
        loadEvolutionModule();
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
        body: JSON.stringify({ action: "get_patient_appointments", id_paciente: patientId, requester: (function(){ try{ const s=JSON.parse(sessionStorage.getItem('vidafem_session')||'null'); return s && (s.data && (s.data.usuario || s.data.usuario_doctor || s.data.nombre_doctor)) ? (s.data.usuario || s.data.usuario_doctor || s.data.nombre_doctor) : null; }catch(e){return null;} })() })
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
                            <div style="display:flex; gap:5px;">
                                <button onclick="openReschedule('${cita.id_cita}')" style="background:#fff; border:1px solid #f39c12; color:#f39c12; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                                    <i class="fas fa-edit"></i> Reagendar
                                </button>
                                <button onclick="deleteAppointmentFromUI('${cita.id_cita}')" style="background:#fff; border:1px solid #e74c3c; color:#e74c3c; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                                    <i class="fas fa-trash"></i> Borrar
                                </button>
                            </div>
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
        fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_services", requester: getRequesterFromSession() }) })
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

    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: dateVal, requester: getRequesterFromSession() }) })
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
            if (isSchedulingAppointment) {
                alert("Ya se esta procesando la cita. Espera un momento.");
                return;
            }
            const btn = this.querySelector('button');
            const originalText = btn.innerText;
            btn.disabled = true; btn.innerText = "Enviando...";
            isSchedulingAppointment = true;

            const fechaVal = document.getElementById('apptDate').value;
            const horaVal = document.getElementById('apptTime').value;
            const motivoVal = document.getElementById('apptReason').value;
            const requesterDoc = getRequesterFromSession();

            if (!requesterDoc) {
                alert("Sesión inválida. Inicia sesión nuevamente.");
                btn.disabled = false; btn.innerText = originalText;
                isSchedulingAppointment = false;
                return;
            }
            if (!fechaVal) {
                alert("Selecciona una fecha para la cita.");
                btn.disabled = false; btn.innerText = originalText;
                isSchedulingAppointment = false;
                return;
            }
            if (!horaVal || horaVal === "Sin cupos" || /selecciona/i.test(horaVal)) {
                alert("Selecciona una hora válida para la cita.");
                btn.disabled = false; btn.innerText = originalText;
                isSchedulingAppointment = false;
                return;
            }
            if (!motivoVal || !motivoVal.trim()) {
                alert("Ingresa el motivo de la cita.");
                btn.disabled = false; btn.innerText = originalText;
                isSchedulingAppointment = false;
                return;
            }

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
                body: JSON.stringify({ action: "schedule_appointment", data: data, requester: requesterDoc })
            })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    window.closeModal('modalAppointment');
                    this.reset();
                    
                    const nombrePac = res.nombre || "Paciente";
                    const telPac = res.telefono || "";
                    const mensaje = `\n\nHola ${nombrePac}, tu cita ha sido agendada correctamente.\n\nFecha: ${fechaVal}\nHora: ${horaVal}\nLugar: Consultorio VIDAFEM Cdla. La Garzota. Av. Agustín Freire Icaza, diagonal a la Unidad Educativa Provincia de Tungurahua a 2 min del terminal terrestre.\n\n${data.recomendaciones ? '*Recomendaciones:* ' + data.recomendaciones : ''}`;
                    
                    const btnWa = document.getElementById('btnWaSuccess');
                    const successTitle = document.getElementById('successApptTitle');
                    const successText = document.getElementById('successApptText');
                    if (successTitle) successTitle.innerText = "¡Cita agendada!";
                    if (successText) successText.innerText = "La cita se ha guardado correctamente en el sistema.";
                    
                    const waNumber = normalizePhoneForWa_(telPac);
                    if (waNumber) {
                        btnWa.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(mensaje)}`;
                        btnWa.style.display = "flex";
                        btnWa.innerHTML = '<i class="fab fa-whatsapp" style="font-size:1.2rem;"></i> Enviar Comprobante por WhatsApp';
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
            .catch(() => {
                alert("Error de conexión al agendar la cita.");
            })
            .finally(() => {
                btn.disabled = false;
                btn.innerText = originalText;
                isSchedulingAppointment = false;
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
    if(timeIn) {
        timeIn.innerHTML = '<option value="">Selecciona fecha...</option>';
        timeIn.disabled = true;
        timeIn.onchange = updateDoctorRescheduleSubmitState;
    }
    
    window.openModal('modalReschedule');
    isRescheduleHoursLoading = false;
    updateDoctorRescheduleSubmitState();
}

function updateDoctorRescheduleSubmitState() {
    const form = document.getElementById('formReschedule');
    if (!form) return;
    const btn = form.querySelector('button[type="submit"]');
    const dateVal = (document.getElementById('reschDate') || {}).value || "";
    const timeVal = (document.getElementById('reschTime') || {}).value || "";
    const canSubmit = !!dateVal && !!timeVal && !isRescheduleHoursLoading && !isReschedulingAppointment;
    if (btn) btn.disabled = !canSubmit;
}

function loadRescheduleHours() {
    const dateVal = document.getElementById('reschDate').value;
    const timeSelect = document.getElementById('reschTime');
    if(!timeSelect) return;
    if(!dateVal) {
        timeSelect.innerHTML = '<option value="">Selecciona fecha...</option>';
        timeSelect.disabled = true;
        updateDoctorRescheduleSubmitState();
        return;
    }
    
    const reqId = ++rescheduleHoursRequestSeq;
    isRescheduleHoursLoading = true;
    timeSelect.disabled = true;
    timeSelect.innerHTML = '<option value="">Verificando disponibilidad...</option>';
    updateDoctorRescheduleSubmitState();

    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: dateVal, requester: getRequesterFromSession() }) })
    .then(r => r.json())
    .then(res => {
        if (reqId !== rescheduleHoursRequestSeq) return;
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
        if (timeSelect.children.length === 0) {
            timeSelect.innerHTML = '<option value="">Sin horarios disponibles</option>';
            timeSelect.disabled = true;
        } else {
            timeSelect.insertAdjacentHTML('afterbegin', '<option value="">Selecciona hora...</option>');
            timeSelect.disabled = false;
        }
    })
    .catch(() => {
        if (reqId !== rescheduleHoursRequestSeq) return;
        timeSelect.innerHTML = '<option value="">No se pudo verificar horarios</option>';
        timeSelect.disabled = true;
        alert("Error de conexión al consultar horarios.");
    })
    .finally(() => {
        if (reqId !== rescheduleHoursRequestSeq) return;
        isRescheduleHoursLoading = false;
        updateDoctorRescheduleSubmitState();
    });
}

function normalizePhoneForWa_(phone) {
    if (!phone) return "";
    let digits = String(phone).replace(/[^\d]/g, "");
    if (!digits) return "";
    if (digits.length === 10 && digits.charAt(0) === "0") digits = "593" + digits.substring(1);
    else if (digits.length === 9) digits = "593" + digits;
    return digits;
}

function buildPatientRescheduleWaLink_() {
    const num = normalizePhoneForWa_(currentPatientPhone);
    if (!num) return "";
    const msg = [
        "Hola, su cita ha sido reagendada.",
        "Nueva fecha: " + (document.getElementById('reschDate') ? document.getElementById('reschDate').value : ""),
        "Nueva hora: " + (document.getElementById('reschTime') ? document.getElementById('reschTime').value : ""),
        "Gracias por preferirnos."
    ].join("\n");
    return "https://wa.me/" + num + "?text=" + encodeURIComponent(msg);
}

function openDoctorRescheduleSuccessModal_() {
    const title = document.getElementById('successApptTitle');
    const text = document.getElementById('successApptText');
    const btnWa = document.getElementById('btnWaSuccess');
    if (title) title.innerText = "Cita reagendada!";
    if (text) text.innerText = "La cita se reagendo correctamente en el sistema.";
    if (btnWa) {
        const link = buildPatientRescheduleWaLink_();
        if (link) {
            btnWa.href = link;
            btnWa.style.display = "flex";
            btnWa.innerHTML = '<i class="fab fa-whatsapp" style="font-size:1.2rem;"></i> Avisar por WhatsApp al paciente';
        } else {
            btnWa.style.display = "none";
        }
    }
    window.openModal('modalSuccessAppt');
}

const formResch = document.getElementById('formReschedule');
if(formResch) {
    formResch.addEventListener('submit', function(e) {
        e.preventDefault();
        if (isReschedulingAppointment) {
            alert("Ya se esta procesando el reagendamiento. Espera un momento.");
            return;
        }
        if (isRescheduleHoursLoading) {
            alert("Espera a que termine la verificación de horarios.");
            return;
        }
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        if (!btn) return;
        btn.disabled = true; btn.innerText = "Procesando...";
        isReschedulingAppointment = true;
        
        const data = {
            id_cita: document.getElementById('reschIdCita').value,
            nueva_fecha: document.getElementById('reschDate').value,
            nueva_hora: document.getElementById('reschTime').value
        };
        const requesterDoc = getRequesterFromSession();
        if (!requesterDoc) {
            alert("Sesión inválida. Inicia sesión nuevamente.");
            btn.disabled = false; btn.innerText = originalText;
            isReschedulingAppointment = false;
            return;
        }
        if (!data.id_cita) {
            alert("No se encontro la cita a reagendar.");
            btn.disabled = false; btn.innerText = originalText;
            isReschedulingAppointment = false;
            return;
        }
        if (!data.nueva_fecha) {
            alert("Selecciona la nueva fecha.");
            btn.disabled = false; btn.innerText = originalText;
            isReschedulingAppointment = false;
            return;
        }
        if (!data.nueva_hora || /cargando|selecciona|sin cupos/i.test(data.nueva_hora)) {
            alert("Selecciona una nueva hora válida.");
            btn.disabled = false; btn.innerText = originalText;
            isReschedulingAppointment = false;
            return;
        }

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "reschedule_appointment", data: data, requester: requesterDoc })
        })
        .then(r => r.json())
        .then(res => {
            if(res.success) {
                window.closeModal('modalReschedule');
                loadAppointmentHistory(currentPatientId);
                openDoctorRescheduleSuccessModal_();
            } else {
                alert("Error: " + res.message);
            }
        })
        .catch(() => {
            alert("Error de conexión al reagendar cita");
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerText = originalText;
            isReschedulingAppointment = false;
            updateDoctorRescheduleSubmitState();
        });
    });
}

// 1. Función para IR a la nueva página de creación
function goToNewDiagnosis() {
    if(currentPatientId) {
        window.location.href = `diagnostico.html?patientId=${currentPatientId}&tab=diagnostico`;
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

    // Obtener requester desde la sesión
    let requesterDoc = null;
    try {
        const s = sessionStorage.getItem('vidafem_session');
        if (s) requesterDoc = JSON.parse(s).data.usuario;
    } catch (e) {}
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_diagnosis_history", id_paciente: currentPatientId, requester: requesterDoc })
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
window.deleteReport = async function(idReporte) {
    if (isDeletingReport) {
        alert("Ya se esta eliminando un reporte. Espera un momento.");
        return;
    }
    const ok = window.appConfirm
        ? await window.appConfirm({
            title: "Eliminar diagnóstico",
            message: "Se borrará el diagnóstico y sus archivos asociados.\nEsta acción no se puede deshacer.",
            confirmText: "Si, eliminar",
            cancelText: "Cancelar",
        })
        : confirm("Eliminar diagnóstico y archivos");
    if (!ok) return;
    const container = document.getElementById('diagnosisHistoryList');
    if (!container) return;
    const oldContent = container.innerHTML;
    container.innerHTML = '<p style="text-align:center; color:red;">Eliminando archivos, por favor espere...</p>';
    isDeletingReport = true;
    const requesterDoc = getRequesterFromSession();
    if (!requesterDoc) {
        alert("Sesión inválida. Inicia sesión nuevamente.");
        container.innerHTML = oldContent;
        isDeletingReport = false;
        return;
    }
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete_diagnosis", id_reporte: idReporte, requester: requesterDoc })
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
    .catch(() => {
        alert("Error de conexión");
        container.innerHTML = oldContent;
    })
    .finally(() => {
        isDeletingReport = false;
    });
}
// Función para borrar una cita desde la UI
window.deleteAppointmentFromUI = async function(idCita) {
    if (deletingAppointments[idCita]) {
        alert("Esa cita ya se esta eliminando. Espera un momento.");
        return;
    }
    const ok = window.appConfirm
        ? await window.appConfirm({
            title: "Eliminar cita",
            message: "Se borrara la cita seleccionada.",
            confirmText: "Si, eliminar",
            cancelText: "Cancelar",
        })
        : confirm("Eliminar cita");
    if (!ok) return;
    deletingAppointments[idCita] = true;
    const requesterDoc = getRequesterFromSession();
    if (!requesterDoc) {
        alert("Sesión inválida. Inicia sesión nuevamente.");
        deletingAppointments[idCita] = false;
        return;
    }
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete_cita", id_cita: idCita, requester: requesterDoc })
    })
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            alert("Cita eliminada correctamente.");
            loadAppointmentHistory(currentPatientId);
        } else {
            alert("Error: " + res.message);
        }
    })
    .catch(() => {
        alert("Error de conexión al borrar cita");
    })
    .finally(() => {
        deletingAppointments[idCita] = false;
    });
}
// 6. REDIRIGIR A EDITAR
window.editReportRedirect = function(idReporte) {
    window.location.href = `diagnostico.html?patientId=${currentPatientId}&reportId=${idReporte}&tab=diagnostico`;
}



