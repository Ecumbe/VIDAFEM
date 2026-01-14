// js/paciente.js - Portal del Paciente (Versión Final: Auto-Update + Filtros)

let currentPatientId = null;
let autoUpdateInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. VERIFICAR SESIÓN
    const session = localStorage.getItem("vidafem_session");
    if (!session) {
        window.location.href = "index.html";
        return;
    }
    
    const sessionData = JSON.parse(session);
    if (sessionData.role !== 'paciente') {
        window.location.href = "index.html";
        return;
    }

    // Configurar Datos del Usuario
    currentPatientId = sessionData.data.id_paciente;
    document.getElementById('selfId').value = currentPatientId;
    document.getElementById('patientNameDisplay').innerText = sessionData.data.nombre_completo;

    // 2. CARGAR DATOS INICIALES
    refreshAllData();

    // 3. ACTIVAR AUTO-REFRESCO (Cada 10 segundos)
    // Esto mantiene el dashboard vivo sin recargar la página
    autoUpdateInterval = setInterval(refreshAllData, 10000);
});

// FUNCIÓN MAESTRA DE ACTUALIZACIÓN
function refreshAllData() {
    // Solo actualizamos si el usuario está viendo la pestaña (ahorra recursos)
    if(document.hidden) return; 
    
    checkPromoAndDashboard(); 
    loadMyAppointments(); 
    // loadMyResults(); // Resultados no cambian tanto, se cargan al entrar a la pestaña
}

// --- NAVEGACIÓN CORREGIDA ---
// --- NAVEGACIÓN BLINDADA ---
window.switchView = function(viewName) {
    // 1. Forzamos ocultar TODO explícitamente
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(el => {
        el.style.setProperty('display', 'none', 'important'); // Usamos !important en JS para ganar al CSS
        el.classList.remove('active');
    });
    
    // 2. Desactivar menús
    document.querySelectorAll('.menu-link').forEach(el => el.classList.remove('active'));
    
    // 3. Mostrar la sección deseada
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        // Quitamos el display none forzado
        target.style.removeProperty('display');
        
        if (viewName === 'inicio') {
            target.style.display = 'flex'; // Inicio usa Flex
        } else {
            target.style.display = 'block'; // Las demás usan Block
        }
        
        target.classList.add('active');
        target.style.animation = 'fadeIn 0.3s ease-out';
    }
    
    // 4. Cargar datos si es historial
    if(viewName === 'historial') loadMyResults();
}
// ==========================================
// 1. DASHBOARD: TARJETAS PEQUEÑAS (RESUMEN)
// ==========================================
function checkPromoAndDashboard() {
    // Peticiones paralelas para armar el dashboard rápido
    const promoPromise = fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_active_promotion" }) }).then(r => r.json());
    const citasListPromise = fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_patient_appointments", id_paciente: currentPatientId }) }).then(r => r.json());

    Promise.all([promoPromise, citasListPromise]).then(([resPromo, resCitas]) => {
        const grid = document.getElementById('dashboardGrid');
        let htmlContent = "";

        // A. TARJETA DE PROMOCIÓN
        // A. TARJETA DE PROMOCIÓN
        if(resPromo.success && resPromo.active) {
            // Llenar datos para el Modal Popup también
            document.getElementById('txtPromoMsg').innerText = resPromo.mensaje;
            document.getElementById('txtPromoDate').innerText = resPromo.fin;
            
            // Mostrar Popup solo una vez por sesión
            if(!sessionStorage.getItem('promoSeen')) {
                document.getElementById('modalPromo').classList.add('active');
                sessionStorage.setItem('promoSeen', 'true');
            }

            // Crear Tarjeta Pequeña (CON LOS 2 BOTONES)
            htmlContent += `
                <div class="summary-card card-promo">
                    <div class="summary-icon"><i class="fas fa-bullhorn"></i></div>
                    <div class="summary-title">Promoción Especial</div>
                    <div class="summary-value" style="font-size:1rem; margin-bottom:10px;">${resPromo.mensaje}</div>
                    
                    <div style="display:flex; flex-direction:column; gap:8px; width:100%; margin-top:auto;">
                        <button class="btn-primary-small" onclick="promoAction('agendar')" style="background:var(--c-primary); border:none; width:100%; justify-content:center;">
                            <i class="fas fa-calendar-check"></i> Agendar
                        </button>
                        
                        <button class="btn-primary-small" onclick="promoAction('whatsapp')" style="background:#25D366; border:none; width:100%; justify-content:center;">
                            <i class="fab fa-whatsapp"></i> Me interesa
                        </button>
                    </div>
                </div>
            `;
        
        } else {
            // Tarjeta vacía si no hay promo
            htmlContent += `
                <div class="summary-card card-empty">
                    <div class="summary-icon"><i class="fas fa-check"></i></div>
                    <div class="summary-title">Novedades</div>
                    <div class="summary-value" style="font-size:1rem;">Todo al día</div>
                    <small>No hay promociones vigentes.</small>
                </div>
            `;
        }

// B. TARJETA DE PRÓXIMA CITA (CORREGIDO: ORDENAR POR FECHA MÁS CERCANA)
        let nextAppt = null;
        if(resCitas.success && resCitas.data.length > 0) {
            const hoy = new Date().toISOString().split('T')[0];
            
            // 1. Filtramos solo las citas futuras o de hoy que estén pendientes
            let futuras = resCitas.data.filter(c => (c.estado === 'PENDIENTE' || c.estado === 'REAGENDADO') && c.fecha >= hoy);
            
            // 2. IMPORTANTE: Las ordenamos Ascendentemente (Fecha más cercana primero)
            futuras.sort((a,b) => {
                if(a.fecha === b.fecha) return a.hora.localeCompare(b.hora);
                return a.fecha.localeCompare(b.fecha);
            });

            // 3. Tomamos la primera (la más cercana)
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
                </div>
            `;
        } else {
            htmlContent += `
                <div class="summary-card card-empty">
                    <div class="summary-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="summary-title">Agenda</div>
                    <div class="summary-value" style="font-size:1rem;">Sin citas pendientes</div>
                    <small>¿Deseas agendar una revisión?</small>
                </div>
            `;
        }

        if(grid) grid.innerHTML = htmlContent;
    });
}

// ==========================================
// 2. LISTA DE CITAS (CON FILTRO 5 DÍAS)
// ==========================================
function loadMyAppointments() {
    const container = document.getElementById('myAppointmentsList');
    
    // Evitamos borrar el contenido si ya existe para que no parpadee en el auto-refresco
    if(container.children.length === 0) container.innerHTML = '<p>Actualizando...</p>';

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_patient_appointments", id_paciente: currentPatientId })
    })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = ""; // Limpiamos para redibujar
        
        if (res.success && res.data.length > 0) {
            // LÓGICA DE FILTRO: MÁXIMO 5 DÍAS A FUTURO
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const limitDate = new Date(today);
            limitDate.setDate(today.getDate() + 5); // Hoy + 5 días
            
            const filteredData = res.data.filter(cita => {
                // Parsear fecha "YYYY-MM-DD"
                const parts = cita.fecha.split('-');
                const citaDate = new Date(parts[0], parts[1]-1, parts[2]); // Mes base 0
                
                // Mostrar solo si: (Es hoy o futuro) Y (Es menor al límite de 5 días)
                // OJO: Si quieres ver historial pasado, quita "citaDate >= today"
                return citaDate >= today && citaDate <= limitDate;
            });

            if (filteredData.length > 0) {
                filteredData.forEach(cita => {
                    const card = document.createElement('div');
                    card.className = "card";
                    // Borde verde si asistió, gris si no
                    card.style.borderLeft = "5px solid " + (cita.estado === 'ASISTIO' ? '#27ae60' : '#ccc');
                    
                    let btnReagendar = "";
                    // Si está pendiente, ponemos borde naranja y botón reagendar
                    if (cita.estado === "PENDIENTE" || cita.estado === "REAGENDADO") {
                        card.style.borderLeftColor = "#f39c12"; 
                        btnReagendar = `
                            <button onclick="openPatientReschedule('${cita.id_cita}')" style="margin-top:10px; background:white; border:1px solid #f39c12; color:#f39c12; padding:5px 10px; border-radius:5px; cursor:pointer;">
                                <i class="fas fa-sync-alt"></i> Cambiar Fecha
                            </button>
                        `;
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
                        ${btnReagendar}
                    `;
                    container.appendChild(card);
                });
            } else {
                container.innerHTML = `<div class="empty-state"><p>No tienes citas en los próximos 5 días.</p></div>`;
            }
        } else {
            container.innerHTML = `<div class="empty-state"><p>No tienes citas registradas.</p></div>`;
        }
    });
}

// ==========================================
// 3. REAGENDAMIENTO (LÓGICA)
// ==========================================
window.openPatientReschedule = function(idCita) {
    document.getElementById('reschIdCita').value = idCita;
    const dateIn = document.getElementById('reschDate');
    dateIn.value = "";
    dateIn.min = new Date().toISOString().split('T')[0];
    dateIn.onchange = loadRescheduleHoursPatient;
    
    document.getElementById('reschTime').innerHTML = '<option>Selecciona fecha...</option>';
    document.getElementById('modalPatientReschedule').classList.add('active');
}

function loadRescheduleHoursPatient() {
    const dateVal = document.getElementById('reschDate').value;
    const timeSelect = document.getElementById('reschTime');
    timeSelect.innerHTML = "<option>Cargando...</option>";
    
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: dateVal }) })
    .then(r => r.json())
    .then(res => {
        const taken = res.data || [];
        timeSelect.innerHTML = "";
        // Horas laborales 9:00 - 16:00
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

document.getElementById('formPatientReschedule').addEventListener('submit', function(e) {
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
        body: JSON.stringify({ action: "reschedule_appointment", data: data })
    })
    .then(r => r.json())
    .then(res => {
        if(res.success) {
            alert("¡Cita reagendada con éxito! Te hemos enviado un correo.");
            window.closeModal('modalPatientReschedule');
            refreshAllData(); // Actualizar inmediato
        } else {
            alert("Error: " + res.message);
        }
    })
    .finally(() => { btn.disabled = false; btn.innerText = originalText; });
});

// ==========================================
// 4. AGENDAR NUEVA CITA
// ==========================================
window.openSelfSchedule = function() {
    const select = document.getElementById('selfService');
    const recBox = document.getElementById('recBox');
    const recDisplay = document.getElementById('selfRecsDisplay');

    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_services" }) })
    .then(r => r.json())
    .then(res => {
        select.innerHTML = '<option value="">Selecciona servicio...</option>';
        res.data.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.nombre_servicio;
            opt.innerText = s.nombre_servicio;
            opt.setAttribute('data-recs', s.recomendaciones || "");
            select.appendChild(opt);
        });
        
        // Mostrar recomendación al elegir servicio
        select.onchange = function() {
            const opt = select.options[select.selectedIndex];
            const recs = opt.getAttribute('data-recs');
            if(recs) {
                recBox.style.display = 'block';
                recDisplay.innerText = recs;
            } else {
                recBox.style.display = 'none';
            }
        };
    });

    const dateIn = document.getElementById('selfDate');
    dateIn.min = new Date().toISOString().split('T')[0];
    dateIn.onchange = loadSelfHours;

    document.getElementById('modalSelfAppt').classList.add('active');
}

function loadSelfHours() {
    const dateVal = document.getElementById('selfDate').value;
    const timeSelect = document.getElementById('selfTime');
    timeSelect.innerHTML = "<option>Cargando...</option>";
    
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

document.getElementById('formSelfAppt').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = this.querySelector('button');
    btn.disabled = true; btn.innerText = "Agendando...";

    // Capturamos la recomendación visible en pantalla (si existe)
    const recDisplay = document.getElementById('selfRecsDisplay');
    const textoRecomendacion = (recDisplay && recDisplay.style.display !== 'none') ? recDisplay.innerText : "";

    const data = {
        id_paciente: currentPatientId,
        fecha: document.getElementById('selfDate').value,
        hora: document.getElementById('selfTime').value,
        motivo: document.getElementById('selfService').value,
        
        // CORRECCIÓN: Enviamos separado
        nota: document.getElementById('selfNote').value,   // Lo que escribe el paciente
        recomendaciones: textoRecomendacion,               // Lo que dice el sistema
        
        creado_por: "PACIENTE_WEB"
    };

    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "schedule_appointment", data: data }) })
    .then(r => r.json())
    .then(res => {
        if(res.success) {
            alert("¡Cita Agendada con Éxito!");
            window.closeModal('modalSelfAppt');
            refreshAllData(); 
        } else {
            alert(res.message);
        }
    })
    .finally(() => { btn.disabled = false; btn.innerText = "Confirmar Cita"; });
});
// ==========================================
// 5. ACCIONES EXTRA Y UTILIDADES
// ==========================================

window.promoAction = function(type) {
    document.getElementById('modalPromo').classList.remove('active');
    if(type === 'agendar') {
        const msg = document.getElementById('txtPromoMsg').innerText || "Promo Web";
        document.getElementById('selfNote').value = "APLICA PROMO: " + msg;
        openSelfSchedule();
    }
    if(type === 'whatsapp') {
        const msg = document.getElementById('txtPromoMsg').innerText || "Promo Web";
        window.open(`https://wa.me/593997330933?text=Hola, vi la promo y deseo mas información: ${msg}`, '_blank');
    }
}

function loadMyResults() {
    const container = document.getElementById('myDiagnosesList');
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_diagnoses", id_paciente: currentPatientId }) })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = "";
        if (res.success && res.data.length > 0) {
            res.data.forEach(d => {
                container.innerHTML += `
                    <div class="card">
                        <h4><i class="fas fa-file-medical"></i> ${d.tipo} (${d.fecha})</h4>
                        <p style="background:#f9f9f9; padding:10px; border-radius:5px;">${d.resultado}</p>
                        ${d.archivo_url ? `<a href="${d.archivo_url}" target="_blank" class="btn-primary-small">Ver Archivo</a>` : ''}
                    </div>`;
            });
        } else { container.innerHTML = `<p style="color:#999; text-align:center;">Sin resultados disponibles.</p>`; }
    });
}

// Helpers globales
window.closeModal = function(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.classList.remove('active'); 
}

document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem("vidafem_session");
    window.location.href = "index.html";
});