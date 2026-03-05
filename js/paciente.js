// js/paciente.js - Portal del Paciente (CORRECCIÓN DE PESTAÑAS - FUERZA BRUTA)

let currentPatientId = null;
let autoUpdateInterval = null;

function notify(message, type) {
    if (window.showToast) {
        window.showToast(message, type || "info");
    } else {
        alert(message);
    }
}

function getPatientSessionData_() {
    try {
        const raw = sessionStorage.getItem("vidafem_session");
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function toInputDate_(value) {
    if (!value) return "";
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
}

function normalizePatientIdKey_(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (/^\d+$/.test(lower)) return String(Number(lower));
    return lower;
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. VERIFICAR SESIÓN
    const session = sessionStorage.getItem("vidafem_session");
    if (!session) {
        window.location.href = "index.html";
        return;
    }
    
    const sessionData = JSON.parse(session);
    // Verificación de seguridad extra
    if (sessionData.role !== 'paciente') {
        window.location.href = "index.html";
        return;
    }

    // Configurar Datos del Usuario
    currentPatientId = sessionData.data.id_paciente || sessionData.data.id;
    
    const selfId = document.getElementById('selfId');
    if(selfId) selfId.value = currentPatientId;
    
    const nameDisplay = document.getElementById('patientNameDisplay');
    if(nameDisplay) nameDisplay.innerText = sessionData.data.nombre_completo;

    fillPatientProfile(sessionData.data);
    setupPatientProfileEditForm();
    loadTreatingDoctorInfo();
    setupProfilePasswordFormPatient();

    // 2. INICIALIZAR VISTA: Forzamos ir al Inicio primero
    switchView('inicio');

    // 3. CARGAR DATOS
    refreshAllData();

    // 4. AUTO-REFRESCO (Cada 10 segundos)
    if (autoUpdateInterval) clearInterval(autoUpdateInterval);
    autoUpdateInterval = setInterval(refreshAllData, 10000);
});

// FUNCIÓN MAESTRA DE ACTUALIZACIÓN
window.refreshAllData = function() {
    if(document.hidden) return; 
    
    checkPromoAndDashboard(); 
    loadMyAppointments(); 
    loadMyResults(); 
}

// --- NAVEGACIÓN "NUCLEAR" (Garantiza que se limpie la pantalla) ---
window.switchView = function(viewName) {
    // 1. Ocultar TODAS las secciones forzando con !important
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(el => {
        // Esto sobrescribe cualquier CSS que esté bloqueando el ocultamiento
        el.style.setProperty('display', 'none', 'important');
        el.classList.remove('active');
    });
    
    // 2. Desactivar visualmente los links del menú
    document.querySelectorAll('.menu-link').forEach(el => el.classList.remove('active'));
    
    // 3. Identificar y mostrar SOLO la sección destino
    const targetId = 'view-' + viewName;
    const target = document.getElementById(targetId);
    
    // 4. Activar el link del menú correspondiente
    // Buscamos el link que llama a esta función para ponerle la clase active
    const menuLinks = document.querySelectorAll('.menu-link');
    menuLinks.forEach(link => {
        if(link.getAttribute('onclick') && link.getAttribute('onclick').includes(viewName)) {
            link.classList.add('active');
        }
    });
    
    if (target) {
        // Excepción: El inicio usa Flexbox, el resto Block
        if (viewName === 'inicio') {
             target.style.setProperty('display', 'flex', 'important');
        } else {
             target.style.setProperty('display', 'block', 'important');
        }
        
        setTimeout(() => {
            target.classList.add('active');
        }, 10);
        
        // Recargar datos específicos si es necesario
        if(viewName === 'historial') loadMyResults();
        if(viewName === 'perfil') loadTreatingDoctorInfo();
    } else {
        console.error("No se encontró la sección: " + targetId);
    }
}

function fillPatientProfile(data) {
    if (!data) return;
    const elName = document.getElementById("profilePatientName");
    const elCedula = document.getElementById("profilePatientCedula");
    const elEmail = document.getElementById("profilePatientEmail");
    const elPhone = document.getElementById("profilePatientPhone");
    const elAddress = document.getElementById("profilePatientAddress");
    const elJob = document.getElementById("profilePatientJob");
    const elBirth = document.getElementById("profilePatientBirth");

    if (elName) elName.innerText = data.nombre_completo || "--";
    if (elCedula) elCedula.innerText = data.cedula || "--";
    if (elEmail) elEmail.innerText = data.correo || "--";
    if (elPhone) elPhone.innerText = data.telefono || "--";
    if (elAddress) elAddress.innerText = data.direccion || "--";
    if (elJob) elJob.innerText = data.ocupacion || "--";
    if (elBirth) elBirth.innerText = data.fecha_nacimiento || "--";
}

function openPatientProfileEditModal_() {
    const sessionData = getPatientSessionData_();
    if (!sessionData || !sessionData.data) {
        notify("Sesion invalida. Inicia sesion nuevamente.", "warning");
        return;
    }
    const d = sessionData.data;

    const cedula = document.getElementById("profileEditPatientCedula");
    const name = document.getElementById("profileEditPatientName");
    const email = document.getElementById("profileEditPatientEmail");
    const phone = document.getElementById("profileEditPatientPhone");
    const address = document.getElementById("profileEditPatientAddress");
    const job = document.getElementById("profileEditPatientJob");
    const birth = document.getElementById("profileEditPatientBirth");

    if (cedula) cedula.value = d.cedula || "";
    if (name) name.value = d.nombre_completo || "";
    if (email) email.value = d.correo || "";
    if (phone) phone.value = d.telefono || "";
    if (address) address.value = d.direccion || "";
    if (job) job.value = d.ocupacion || "";
    if (birth) birth.value = toInputDate_(d.fecha_nacimiento);

    const modal = document.getElementById("modalPatientProfileEdit");
    if (modal) modal.classList.add("active");
}

function setupPatientProfileEditForm() {
    const btnOpen = document.getElementById("btnEditPatientProfile");
    if (btnOpen) btnOpen.addEventListener("click", openPatientProfileEditModal_);

    const inputName = document.getElementById("profileEditPatientName");
    const inputMail = document.getElementById("profileEditPatientEmail");
    const inputPhone = document.getElementById("profileEditPatientPhone");
    const inputAddress = document.getElementById("profileEditPatientAddress");
    const inputJob = document.getElementById("profileEditPatientJob");

    if (inputName) inputName.addEventListener("input", (e) => { e.target.value = String(e.target.value || "").toUpperCase(); });
    if (inputMail) inputMail.addEventListener("input", (e) => { e.target.value = String(e.target.value || "").toLowerCase(); });
    if (inputPhone) inputPhone.addEventListener("input", (e) => { e.target.value = String(e.target.value || "").replace(/[^\d]/g, ""); });
    if (inputAddress) inputAddress.addEventListener("input", (e) => { e.target.value = String(e.target.value || "").toUpperCase(); });
    if (inputJob) inputJob.addEventListener("input", (e) => { e.target.value = String(e.target.value || "").toUpperCase(); });

    const form = document.getElementById("formPatientProfileEdit");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const sessionData = getPatientSessionData_();
        if (!sessionData || !sessionData.data) {
            notify("Sesion invalida. Inicia sesion nuevamente.", "warning");
            return;
        }

        const userId = String(sessionData.data.id_paciente || sessionData.data.id || "").trim();
        if (!userId) {
            notify("No se pudo identificar al paciente.", "error");
            return;
        }

        const payload = {
            nombre_completo: String((inputName && inputName.value) || "").trim(),
            correo: String((inputMail && inputMail.value) || "").trim(),
            telefono: String((inputPhone && inputPhone.value) || "").trim(),
            direccion: String((inputAddress && inputAddress.value) || "").trim(),
            ocupacion: String((inputJob && inputJob.value) || "").trim(),
            fecha_nacimiento: String((document.getElementById("profileEditPatientBirth") || {}).value || "").trim()
        };

        const btnSave = document.getElementById("btnSavePatientProfile");
        const oldText = btnSave ? btnSave.innerText : "";
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerText = "Guardando...";
        }

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "self_update_patient_profile",
                    user_id: userId,
                    requester: userId,
                    data: payload
                })
            }).then(r => r.json());

            if (!res || !res.success) {
                notify("Error: " + (res && res.message ? res.message : "No se pudo actualizar."), "error");
                return;
            }

            if (!sessionData.data) sessionData.data = {};
            if (res.data) {
                sessionData.data.nombre_completo = res.data.nombre_completo || sessionData.data.nombre_completo || "";
                sessionData.data.cedula = res.data.cedula || sessionData.data.cedula || "";
                sessionData.data.correo = res.data.correo || "";
                sessionData.data.telefono = res.data.telefono || "";
                sessionData.data.direccion = res.data.direccion || "";
                sessionData.data.ocupacion = res.data.ocupacion || "";
                sessionData.data.fecha_nacimiento = res.data.fecha_nacimiento || "";
            }
            sessionStorage.setItem("vidafem_session", JSON.stringify(sessionData));

            const nameDisplay = document.getElementById("patientNameDisplay");
            if (nameDisplay) nameDisplay.innerText = sessionData.data.nombre_completo || "Paciente";

            fillPatientProfile(sessionData.data);
            window.closeModal("modalPatientProfileEdit");
            notify("Perfil actualizado.", "success");
        } catch (err) {
            notify("Error de conexion.", "error");
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerText = oldText;
            }
        }
    });
}

function fillTreatingDoctorInfo(data) {
    const elName = document.getElementById("profileTreatingDoctorName");
    const elPhone = document.getElementById("profileTreatingDoctorPhone");
    const elEmail = document.getElementById("profileTreatingDoctorEmail");

    if (elName) elName.innerText = (data && data.nombre_doctor) || "--";
    if (elPhone) elPhone.innerText = (data && data.telefono) || "--";
    if (elEmail) elEmail.innerText = (data && data.correo) || "--";
}

function loadTreatingDoctorInfo() {
    if (!currentPatientId) return;
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "get_my_doctor_info",
            requester: currentPatientId
        })
    })
    .then(r => r.json())
    .then(res => {
        if (res && res.success) {
            fillTreatingDoctorInfo(res.data || {});
        } else {
            fillTreatingDoctorInfo(null);
        }
    })
    .catch(() => {
        fillTreatingDoctorInfo(null);
    });
}

function setupProfilePasswordFormPatient() {
    const form = document.getElementById("formProfilePasswordPatient");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const session = sessionStorage.getItem("vidafem_session");
        if (!session) {
            window.location.href = "index.html";
            return;
        }

        const sessionData = JSON.parse(session);
        const newPass = document.getElementById("profilePatientNewPassword");
        const confirmPass = document.getElementById("profilePatientConfirmPassword");
        const passVal = newPass ? newPass.value.trim() : "";
        const confirmVal = confirmPass ? confirmPass.value.trim() : "";

        if (!passVal || !confirmVal) {
            notify("Completa la nueva contrasena.", "warning");
            return;
        }
        if (passVal !== confirmVal) {
            notify("Las contrasenas no coinciden.", "warning");
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

        const userId = sessionData.data.id_paciente || sessionData.data.id;
        if (!userId) {
            notify("No se pudo identificar al paciente.", "error");
            return;
        }

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "self_update_password",
                role: "paciente",
                user_id: userId,
                new_password: passVal,
                requester: userId,
            }),
        })
        .then(r => r.json())
        .then(res => {
            if (res && res.success) {
                if (newPass) newPass.value = "";
                if (confirmPass) confirmPass.value = "";
                notify("Contrasena actualizada.", "success");
                try {
                    const updated = JSON.parse(sessionStorage.getItem("vidafem_session"));
                    sessionStorage.setItem("vidafem_session", JSON.stringify(updated));
                } catch(e) {}
            } else {
                notify("Error: " + (res && res.message ? res.message : "No se pudo actualizar."), "error");
            }
        })
        .catch(() => {
            notify("Error de conexion.", "error");
        });
    });
}

// ==========================================
// 1. DASHBOARD Y PROMOCIONES
// ==========================================
function checkPromoAndDashboard() {
    const timestamp = new Date().getTime(); 
    const promoPromise = fetch(API_URL + "?t=" + timestamp, { method: "POST", body: JSON.stringify({ action: "get_active_promotion" }) }).then(r => r.json());
    const citasListPromise = fetch(API_URL + "?t=" + timestamp, { method: "POST", body: JSON.stringify({ action: "get_patient_appointments", id_paciente: currentPatientId, requester: currentPatientId }) }).then(r => r.json());

    Promise.all([promoPromise, citasListPromise]).then(([resPromo, resCitas]) => {
        const grid = document.getElementById('dashboardGrid');
        if(!grid) return;
        
        let htmlContent = "";

        // A. TARJETA DE PROMOCIÓN
        if(resPromo.success && resPromo.active) {
            const txtMsg = document.getElementById('txtPromoMsg');
            const txtDate = document.getElementById('txtPromoDate');
            if(txtMsg) txtMsg.innerText = resPromo.mensaje;
            if(txtDate) txtDate.innerText = resPromo.fin;
            
            if(!sessionStorage.getItem('promoSeen')) {
                const modalPromo = document.getElementById('modalPromo');
                if(modalPromo) modalPromo.classList.add('active');
                sessionStorage.setItem('promoSeen', 'true');
            }

            htmlContent += `
                <div class="summary-card card-promo">
                    <div class="summary-icon"><i class="fas fa-bullhorn"></i></div>
                    <div class="summary-title">Promoción Especial</div>
                    <div class="summary-value" style="font-size:1rem; margin-bottom:10px;">${resPromo.mensaje}</div>
                    <div style="display:flex; flex-direction:column; gap:8px; width:100%; margin-top:auto;">
                        <button class="btn-primary-small" onclick="promoAction('agendar')" style="background:var(--c-primary); border:none; width:100%; justify-content:center;">
                            <i class="fas fa-calendar-check"></i> Agendar
                        </button>
                    </div>
                </div>`;
        } else {
            htmlContent += `
                <div class="summary-card card-empty">
                    <div class="summary-icon"><i class="fas fa-check"></i></div>
                    <div class="summary-title">Novedades</div>
                    <div class="summary-value" style="font-size:1rem;">Todo al día</div>
                    <small>No hay promociones vigentes.</small>
                </div>`;
        }

        // B. TARJETA DE PRÓXIMA CITA
        let nextAppt = null;
        if(resCitas.success && resCitas.data.length > 0) {
            const hoy = new Date().toISOString().split('T')[0];
            let futuras = resCitas.data.filter(c => (c.estado === 'PENDIENTE' || c.estado === 'REAGENDADO') && c.fecha >= hoy);
            
            futuras.sort((a,b) => {
                if(a.fecha === b.fecha) return a.hora.localeCompare(b.hora);
                return a.fecha.localeCompare(b.fecha);
            });
            nextAppt = futuras[0];
        }

        if(nextAppt) {
            htmlContent += `
                <div class="summary-card card-appt">
                    <div class="summary-icon"><i class="fas fa-calendar-day"></i></div>
                    <div class="summary-title">Tu Próxima Cita</div>
                    <div class="summary-value">${nextAppt.fecha}</div>
                    <div style="font-size:1.5rem; color:#6a1b9a; font-weight:bold;">${nextAppt.hora}</div>
                    <small>${nextAppt.motivo}</small>
                </div>`;
        } else {
            htmlContent += `
                <div class="summary-card card-empty">
                    <div class="summary-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="summary-title">Agenda</div>
                    <div class="summary-value" style="font-size:1rem;">Sin citas pendientes</div>
                    <small>¿Deseas agendar una revisión</small>
                </div>`;
        }

        grid.innerHTML = htmlContent;
    }).catch(err => console.error("Error Dashboard:", err));
}

// ==========================================
// 2. LISTA DE CITAS
// ==========================================
function loadMyAppointments() {
    const container = document.getElementById('myAppointmentsList');
    if(!container) return;
    
    if(container.children.length === 0) container.innerHTML = '<p>Actualizando...</p>';
    const timestamp = new Date().getTime();

    fetch(API_URL + "?t=" + timestamp, {
        method: "POST",
        body: JSON.stringify({ action: "get_patient_appointments", id_paciente: currentPatientId, requester: currentPatientId })
    })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = ""; 
        if (res.success && res.data.length > 0) {
            res.data.forEach(cita => {
                const card = document.createElement('div');
                card.className = "card";
                
                let colorBorde = '#ccc';
                if(cita.estado === 'ASISTIO') colorBorde = '#27ae60';
                if(cita.estado === 'PENDIENTE') colorBorde = '#3498db';
                if(cita.estado === 'REAGENDADO') colorBorde = '#f39c12';
                
                card.style.borderLeft = "5px solid " + colorBorde;
                
                let btnReagendar = "";
                if (cita.estado === "PENDIENTE" || cita.estado === "REAGENDADO") {
                    btnReagendar = `
                        <button onclick="openPatientReschedule('${cita.id_cita}')" style="margin-top:10px; background:white; border:1px solid #f39c12; color:#f39c12; padding:5px 10px; border-radius:5px; cursor:pointer;">
                            <i class="fas fa-sync-alt"></i> Cambiar Fecha
                        </button>`;
                }

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h4 style="margin:0;"><i class="fas fa-calendar-day"></i> ${cita.fecha}</h4>
                            <h2 style="margin:5px 0; color:var(--c-primary);">${cita.hora}</h2>
                            <p style="color:#666;">${cita.motivo}</p>
                            ${cita.recomendaciones ? `<small style="display:block; margin-top:5px; background:#fff3cd; padding:5px;">nota: ${cita.recomendaciones}</small>` : ''}
                        </div>
                        <div style="text-align:right;">
                            <span style="font-weight:bold; font-size:0.8rem; background:#eee; padding:3px 8px; border-radius:4px;">${cita.estado}</span>
                        </div>
                    </div>
                    ${btnReagendar}`;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `<div class="empty-state"><p>No tienes citas registradas.</p></div>`;
        }
    });
}

// ==========================================
// 3. REAGENDAMIENTO Y AUTO-AGENDA
// ==========================================
window.openPatientReschedule = function(idCita) {
    const inputId = document.getElementById('reschIdCita');
    if(inputId) inputId.value = idCita;
    
    const dateIn = document.getElementById('reschDate');
    if(dateIn){
        dateIn.value = "";
        dateIn.min = new Date().toISOString().split('T')[0];
        dateIn.onchange = loadRescheduleHoursPatient;
    }
    
    const timeSel = document.getElementById('reschTime');
    if(timeSel) timeSel.innerHTML = '<option>Selecciona fecha...</option>';
    
    const modal = document.getElementById('modalPatientReschedule');
    if(modal) modal.classList.add('active');
}

function loadRescheduleHoursPatient() {
    const dateVal = document.getElementById('reschDate').value;
    const timeSelect = document.getElementById('reschTime');
    if(!dateVal || !timeSelect) return;

    timeSelect.innerHTML = "<option>Cargando...</option>";
    
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: dateVal, requester: currentPatientId }) })
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
        if(timeSelect.children.length === 0) timeSelect.innerHTML = "<option>Lleno</option>";
    });
}

const formResch = document.getElementById('formPatientReschedule');
if(formResch) {
    formResch.addEventListener('submit', function(e) {
        e.preventDefault();
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        btn.disabled = true; btn.innerText = "Guardando...";

        const data = {
            id_cita: document.getElementById('reschIdCita').value,
            nueva_fecha: document.getElementById('reschDate').value,
            nueva_hora: document.getElementById('reschTime').value
        };

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "reschedule_appointment", data: data, requester: currentPatientId })
        })
        .then(r => r.json())
        .then(res => {
            if(res.success) {
                notify("Cita reagendada con exito.", "success");
                window.closeModal('modalPatientReschedule');
                refreshAllData(); 
            } else {
                notify("Error: " + res.message, "error");
            }
        })
        .finally(() => { btn.disabled = false; btn.innerText = originalText; });
    });
}

// ==========================================
// 4. NUEVA CITA (PACIENTE)
// ==========================================
let isSelfHoursLoading = false;
let isSelfScheduleSubmitting = false;
let selfHoursRequestSeq = 0;

function updateSelfScheduleSubmitState() {
    const form = document.getElementById('formSelfAppt');
    if (!form) return;

    const btn = form.querySelector('button[type="submit"]');
    const dateVal = (document.getElementById('selfDate') || {}).value || "";
    const timeVal = (document.getElementById('selfTime') || {}).value || "";
    const serviceVal = (document.getElementById('selfService') || {}).value || "";
    const canSubmit = !!dateVal && !!timeVal && !!serviceVal && !isSelfHoursLoading && !isSelfScheduleSubmitting;

    if (btn) btn.disabled = !canSubmit;
}

function setSelfTimeLoadingState(isLoading) {
    const timeSelect = document.getElementById('selfTime');
    if (!timeSelect) return;

    isSelfHoursLoading = !!isLoading;
    timeSelect.disabled = !!isLoading;
    if (isLoading) {
        timeSelect.innerHTML = '<option value="">Verificando disponibilidad...</option>';
    }
    updateSelfScheduleSubmitState();
}

function normalizePhoneForWa(phone) {
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

function buildDoctorWaLink(doctorPhone, dataObj) {
    const number = normalizePhoneForWa(doctorPhone);
    if (!number) return "";

    let patientName = "Paciente";
    try {
        const session = JSON.parse(sessionStorage.getItem("vidafem_session") || "null");
        if (session && session.data && session.data.nombre_completo) {
            patientName = String(session.data.nombre_completo);
        }
    } catch (e) {}

    const msg = [
        "Hola doctor/a, acabo de agendar una cita.",
        "Paciente: " + patientName,
        "Fecha: " + (dataObj.fecha || ""),
        "Hora: " + (dataObj.hora || ""),
        "Motivo: " + (dataObj.motivo || ""),
    ].join("\n");

    return "https://wa.me/" + number + "?text=" + encodeURIComponent(msg);
}

function openSelfApptSuccessModal(doctorPhone, dataObj) {
    const modal = document.getElementById("modalSelfApptSuccess");
    if (!modal) return;

    const btnWa = document.getElementById("btnWaDoctorSelfAppt");
    const hint = document.getElementById("txtWaDoctorHint");
    const link = buildDoctorWaLink(doctorPhone, dataObj || {});

    if (btnWa) {
        if (link) {
            btnWa.href = link;
            btnWa.style.display = "flex";
        } else {
            btnWa.href = "#";
            btnWa.style.display = "none";
        }
    }
    if (hint) {
        if (link) {
            hint.style.display = "none";
            hint.innerText = "";
        } else {
            hint.style.display = "block";
            hint.innerText = "No se encontro el telefono del medico asignado.";
        }
    }

    modal.classList.add("active");
}

window.openSelfSchedule = function() {
    resetSelfScheduleForm();
    const select = document.getElementById('selfService');
    const recBox = document.getElementById('recBox');
    const recDisplay = document.getElementById('selfRecsDisplay');

    if(select) {
        select.innerHTML = '<option>Cargando servicios...</option>';
        fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_services", requester: currentPatientId }) })
        .then(r => r.json())
        .then(res => {
            select.innerHTML = '<option value="">Selecciona servicio...</option>';
            if(res.data) {
                res.data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.nombre_servicio;
                    opt.innerText = s.nombre_servicio;
                    opt.setAttribute('data-recs', s.recomendaciones || "");
                    select.appendChild(opt);
                });
            }
            select.onchange = function() {
                const opt = select.options[select.selectedIndex];
                const recs = opt ? opt.getAttribute('data-recs') : "";
                if(recs && recBox && recDisplay) {
                    recBox.style.display = 'block';
                    recDisplay.innerText = recs;
                } else if(recBox) {
                    recBox.style.display = 'none';
                }
                updateSelfScheduleSubmitState();
            };
            updateSelfScheduleSubmitState();
        });
    }

    const dateIn = document.getElementById('selfDate');
    if(dateIn) {
        dateIn.min = new Date().toISOString().split('T')[0];
        dateIn.onchange = loadSelfHours;
    }

    const modal = document.getElementById('modalSelfAppt');
    if(modal) modal.classList.add('active');
    updateSelfScheduleSubmitState();
}

function resetSelfScheduleForm() {
    const dateIn = document.getElementById('selfDate');
    if (dateIn) dateIn.value = "";

    const timeSelect = document.getElementById('selfTime');
    if (timeSelect) {
        timeSelect.innerHTML = '<option value="">Elige fecha primero...</option>';
        timeSelect.disabled = true;
        timeSelect.onchange = updateSelfScheduleSubmitState;
    }

    const serviceSelect = document.getElementById('selfService');
    if (serviceSelect) {
        serviceSelect.innerHTML = '<option value="">Selecciona servicio...</option>';
    }

    const note = document.getElementById('selfNote');
    if (note) note.value = "";

    const recBox = document.getElementById('recBox');
    if (recBox) recBox.style.display = 'none';

    const recDisplay = document.getElementById('selfRecsDisplay');
    if (recDisplay) recDisplay.innerText = "";

    const form = document.getElementById('formSelfAppt');
    const btn = form ? form.querySelector('button[type="submit"]') : null;
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Confirmar Cita";
    }

    isSelfHoursLoading = false;
    isSelfScheduleSubmitting = false;
    updateSelfScheduleSubmitState();
}

function loadSelfHours() {
    const dateVal = document.getElementById('selfDate').value;
    const timeSelect = document.getElementById('selfTime');
    if(!timeSelect) return;

    if(!dateVal) {
        timeSelect.innerHTML = '<option value="">Elige fecha primero...</option>';
        timeSelect.disabled = true;
        updateSelfScheduleSubmitState();
        return;
    }

    const reqId = ++selfHoursRequestSeq;
    setSelfTimeLoadingState(true);

    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: dateVal, requester: currentPatientId }) })
    .then(r => r.json())
    .then(res => {
        if (reqId !== selfHoursRequestSeq) return;

        const taken = res.data || [];
        timeSelect.innerHTML = "";
        for (let h = 9; h <= 16; h++) {
            ["00", "30"].forEach(m => {
                if(h===16 && m==="30") return;
                const t = `${h<10?'0'+h:h}:${m}`;
                if(!taken.includes(t)) {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.innerText = t;
                    timeSelect.appendChild(opt);
                }
            });
        }

        if(timeSelect.children.length === 0) {
            timeSelect.innerHTML = '<option value="">Sin horarios disponibles</option>';
            timeSelect.disabled = true;
        } else {
            timeSelect.insertAdjacentHTML('afterbegin', '<option value="">Selecciona hora...</option>');
            timeSelect.disabled = false;
        }
    })
    .catch(() => {
        if (reqId !== selfHoursRequestSeq) return;
        timeSelect.innerHTML = '<option value="">No se pudo verificar horarios</option>';
        timeSelect.disabled = true;
        notify("No se pudo verificar disponibilidad. Intenta nuevamente.", "error");
    })
    .finally(() => {
        if (reqId !== selfHoursRequestSeq) return;
        isSelfHoursLoading = false;
        updateSelfScheduleSubmitState();
    });
}

const formSelf = document.getElementById('formSelfAppt');
if(formSelf) {
    formSelf.addEventListener('submit', function(e) {
        e.preventDefault();
        const btn = this.querySelector('button');
        if (!btn) return;

        if (isSelfScheduleSubmitting) return;
        if (isSelfHoursLoading) {
            notify("Espera a que termine la verificacion de horarios.", "warning");
            return;
        }

        const recDisplay = document.getElementById('selfRecsDisplay');
        const textoRecomendacion = recDisplay ? String(recDisplay.innerText || "").trim() : "";
        const fecha = document.getElementById('selfDate').value;
        const hora = document.getElementById('selfTime').value;
        const motivo = document.getElementById('selfService').value;

        if (!fecha || !hora || !motivo) {
            notify("Completa fecha, hora y motivo para continuar.", "warning");
            updateSelfScheduleSubmitState();
            return;
        }

        isSelfScheduleSubmitting = true;
        btn.disabled = true;
        btn.innerText = "Verificando horario...";

        const data = {
            id_paciente: currentPatientId,
            fecha: fecha,
            hora: hora,
            motivo: motivo,
            nota: document.getElementById('selfNote').value,
            recomendaciones: textoRecomendacion,
            creado_por: "PACIENTE_WEB"
        };

        // Revalidar disponibilidad antes de guardar para evitar choques de horario.
        fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: data.fecha, requester: currentPatientId }) })
        .then(r => r.json())
        .then(check => {
            const taken = (check && check.data) ? check.data : [];
            if (taken.includes(data.hora)) {
                notify("Ese horario acaba de ocuparse. Elige otra hora.", "warning");
                loadSelfHours();
                throw new Error("slot_taken");
            }

            btn.innerText = "Agendando...";
            // anadir requester (paciente) para que backend valide
            return fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "schedule_appointment", data: data, requester: currentPatientId }) });
        })
        .then(r => r.json())
        .then(res => {
            if(!res) return;
            if(res.success) {
                notify("Cita agendada con exito.", "success");
                window.closeModal('modalSelfAppt');
                resetSelfScheduleForm();
                refreshAllData();
                openSelfApptSuccessModal(res.doctor_phone || "", data);
            } else {
                notify(res.message || "No se pudo agendar la cita.", "error");
            }
        })
        .catch(err => {
            if (err && err.message === "slot_taken") return;
            notify("Error al agendar cita. Intenta nuevamente.", "error");
        })
        .finally(() => {
            isSelfScheduleSubmitting = false;
            btn.innerText = "Confirmar Cita";
            updateSelfScheduleSubmitState();
        });
    });
}
window.promoAction = function(type) {
    const modal = document.getElementById('modalPromo');
    if(modal) modal.classList.remove('active');
    
    const msg = document.getElementById('txtPromoMsg') ? document.getElementById('txtPromoMsg').innerText : "Promo";
    if(type === 'agendar') {
        const note = document.getElementById('selfNote');
        if(note) note.value = "APLICA PROMO: " + msg;
        openSelfSchedule();
    }
    if(type === 'whatsapp') {
        window.open(`https://wa.me/593997330933?text=${encodeURIComponent("Hola, vi la promo y deseo mas información: " + msg)}`, '_blank');
    }
}

// ==========================================
// 5. CARGAR RESULTADOS
// ==========================================
function loadMyResults() {
    const container = document.getElementById('myDiagnosesList');
    if(!container) return;

    const timestamp = new Date().getTime();

    fetch(API_URL + "?t=" + timestamp, { 
        method: "POST", 
        body: JSON.stringify({ action: "get_data", sheet: "diagnosticos_archivos", requester: currentPatientId }) 
    })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = "";

        if (!res || !res.success) {
            container.innerHTML = `<p style="text-align:center; color:red;">${(res && res.message) || "No se pudieron cargar resultados."}</p>`;
            return;
        }

        const requesterKey = normalizePatientIdKey_(currentPatientId);
        const allReports = Array.isArray(res.data) ? res.data : [];
        let myReports = allReports.filter(r => normalizePatientIdKey_(r.id_paciente) === requesterKey);
        if (myReports.length === 0 && allReports.length > 0) {
            // El backend ya filtra por permisos; evitamos vaciar por diferencias historicas de formato ID.
            myReports = allReports.slice();
        }
        
        if (myReports.length > 0) {
            myReports.sort((a, b) => {
                const dateA = new Date(a.fecha);
                const dateB = new Date(b.fecha);
                return dateB - dateA; 
            });

            myReports.forEach(rep => {
                let extraData = {};
                try {
                    extraData = (typeof rep.datos_json === 'string') ? JSON.parse(rep.datos_json) : rep.datos_json;
                } catch(e) {}

                let titulo = rep.tipo_examen || "REPORTE CLÍNICO";
                let iconClass = "fa-file-medical";
                let color = "#36235d"; 

                if (rep.tipo_examen === "COLPOSCOPIA") {
                    iconClass = "fa-microscope";
                    color = "#e67e22"; 
                } else if (rep.tipo_examen === "RECETA") {
                    iconClass = "fa-prescription-bottle-alt";
                    color = "#27ae60"; 
                }

                const fecha = rep.fecha ? rep.fecha.split('T')[0] : "S/F";
                const safeJson = encodeURIComponent(rep.datos_json);

                let botonesHtml = "";

                // A. Botón "Ver Detalles" - DESACTIVADO A PETICIÓN TUYA
                /*
                botonesHtml += `
                    <button onclick="verDetalles('${safeJson}', '${rep.tipo_examen}')" class="btn-primary-small" style="background:#3498db; padding:8px 15px; border:none; color:white; cursor:pointer;">
                        <i class="fas fa-eye"></i> Ver Detalles
                    </button>`;
                */

                // B. Botón "Reporte PDF"
                if (rep.pdf_url) {
                    botonesHtml += `
                        <button onclick="downloadFeedback(this, '${rep.pdf_url}')" class="btn-primary-small" style="background:${color}; padding:8px 15px; border:none; color:white; cursor:pointer;">
                            <i class="fas fa-file-pdf"></i> Reporte
                        </button>`;
                }

                // C. Botón "Receta PDF"
                if (extraData && extraData.pdf_receta_link) {
                    botonesHtml += `
                        <button onclick="downloadFeedback(this, '${extraData.pdf_receta_link}')" class="btn-primary-small" style="background:#27ae60; padding:8px 15px; border:none; color:white; cursor:pointer;">
                            <i class="fas fa-prescription-bottle-alt"></i> Receta
                        </button>`;
                }
                
                // D. Botón "Examen Adjunto"
                if (extraData && extraData.pdf_externo_link) {
                     botonesHtml += `
                        <button onclick="downloadFeedback(this, '${extraData.pdf_externo_link}')" class="btn-primary-small" style="background:#2980b9; padding:8px 15px; border:none; color:white; cursor:pointer;">
                            <i class="fas fa-paperclip"></i> Adjunto
                        </button>`;
                }

                const card = document.createElement('div');
                card.className = "card";
                card.style.cssText = `border-left: 5px solid ${color}; margin-bottom: 15px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);`;

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <div style="background:${color}20; color:${color}; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
                                <i class="fas ${iconClass}"></i>
                            </div>
                            <div>
                                <h4 style="margin:0; color:${color}; text-transform:uppercase; font-size:1rem;">${titulo}</h4>
                                <small style="color:#666; font-size:0.9rem;">
                                    <i class="far fa-calendar-alt"></i> ${fecha}
                                </small>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap; border-top:1px solid #eee; padding-top:15px;">
                        ${botonesHtml}
                    </div>`;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `
                <div style="text-align:center; padding:40px; color:#aaa; border:2px dashed #eee; border-radius:10px;">
                    <i class="fas fa-folder-open" style="font-size:3rem; margin-bottom:15px; color:#ddd;"></i>
                    <p>No tienes resultados disponibles todavía.</p>
                </div>`;
        }
    })
    .catch(e => {
        console.error(e);
        container.innerHTML = '<p style="color:red; text-align:center;">Error al cargar datos.</p>';
    });
}

// --- VISOR DE DETALLES (MANTENIDO PARA INTEGRIDAD DEL CÓDIGO) ---
window.verDetalles = function(encodedJson, tipo) {
    try {
        const data = JSON.parse(decodeURIComponent(encodedJson));
        const contentDiv = document.getElementById('visorContent');
        const titleDiv = document.getElementById('visorTitle');
        const modal = document.getElementById('modalVisor');

        if(titleDiv) titleDiv.innerText = "Detalles: " + tipo;
        let html = "";

        if (tipo === "RECETA") {
            html += `<h4 style="color:#27ae60; border-bottom:1px solid #eee; padding-bottom:5px;">Medicamentos Recetados:</h4>`;
            if (data.medicamentos && data.medicamentos.length > 0) {
                html += `<ul style="list-style:none; padding:0;">`;
                data.medicamentos.forEach(m => {
                    html += `
                    <li style="background:#f9f9f9; padding:10px; margin-bottom:5px; border-radius:5px; border-left:3px solid #27ae60;">
                        <strong style="color:#333;">${m.nombre}</strong><br>
                        <small style="color:#555;">Cant: ${m.cantidad} | Indicación: ${m.frecuencia}</small>
                    </li>`;
                });
                html += `</ul>`;
            }
            if (data.observaciones) {
                html += `<h4 style="margin-top:20px; color:#555;">Observaciones:</h4><p style="background:#fff3cd; padding:10px; border-radius:5px;">${data.observaciones}</p>`;
            }
        } 
        else if (tipo === "COLPOSCOPIA") {
            html += `
                <div style="background:#f0f8ff; padding:10px; border-radius:5px; margin-bottom:15px; border-left: 3px solid #3498db;">
                    <strong style="color:#3498db;">Evaluación General:</strong>
                    <p style="margin:5px 0; color:#444;">${data.evaluacion || "Sin datos"}</p>
                </div>
                <h4 style="color:#e67e22; border-bottom:1px solid #eee; margin-top:20px;">Conclusiones</h4>
                <p><strong>Diagnóstico:</strong> ${data.diagnostico || "--"}</p>
                <div style="margin-top:15px; background:#e8f5e9; padding:10px; border-radius:5px; border-left: 3px solid #27ae60;">
                    <strong style="color:#27ae60;">Recomendaciones:</strong>
                    <p style="margin:5px 0;">${data.recomendaciones || "--"}</p>
                </div>
            `;
        }
        else {
            // GENERICO
            html += `
                <div style="padding:10px;">
                    <p><strong>Motivo:</strong> ${data.motivo || "--"}</p>
                    <p><strong>Evolución:</strong> ${data.evaluacion || "--"}</p>
                    <hr style="margin:10px 0; border:0; border-top:1px solid #eee;">
                    <p><strong>Diagnóstico:</strong> ${data.diagnostico || "--"}</p>
                    <p><strong>Tratamiento:</strong> ${data.recomendaciones || "--"}</p>
                </div>
            `;
        }

        if(contentDiv) contentDiv.innerHTML = html;
        if(modal) modal.classList.add('active');

    } catch (e) {
        console.error(e);
        alert("No se pudieron cargar los detalles.");
    }
}

// Helpers
window.closeModal = function(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.classList.remove('active'); 
}

window.downloadFeedback = function(btn, url) {
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = "0.8";
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Abriendo...`;
    
    setTimeout(() => {
        window.open(url, '_blank');
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
            btn.style.opacity = "1";
        }, 2000);
    }, 800);
}
