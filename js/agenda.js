// js/agenda.js - Controlador de la Vista de Agenda (Con Reagendar)

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('agendaDateInput');
    if(dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.addEventListener('change', () => loadAgenda(dateInput.value));
    }
    
    // Configurar listener para cargar horas disponibles en el modal de reagendar
    const reschDate = document.getElementById('reschDate');
    if(reschDate) {
        reschDate.min = new Date().toISOString().split('T')[0];
        reschDate.addEventListener('change', loadRescheduleHours);
    }
});

function loadAgenda(dateString) {
    const container = document.getElementById('agendaGrid');
    container.innerHTML = '<p>Cargando citas...</p>';

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_agenda", fecha: dateString })
    })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = "";
        if (res.success && res.data.length > 0) {
            res.data.forEach(cita => {
                const card = document.createElement('div');
                card.className = "agenda-card";
                
                if (cita.estado === "ASISTIO") card.classList.add('attended');
                if (cita.estado === "NO_ASISTIO") card.classList.add('missed');
                if (cita.estado === "REAGENDADO") card.style.borderLeftColor = "#f39c12";

                card.innerHTML = `
                    <div class="agenda-time"><i class="far fa-clock"></i> ${cita.hora}</div>
                    <a href="#" onclick="goToClinical('${cita.id_paciente}')" class="agenda-patient">
                        ${cita.nombre_paciente} <i class="fas fa-external-link-alt" style="font-size:0.8rem"></i>
                    </a>
                    <span class="agenda-proc">${cita.motivo}</span>
                    
                    <div class="agenda-actions">
                        <button class="btn-status btn-check" onclick="setApptStatus('${cita.id_cita}', 'ASISTIO', this)" title="Asistió">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-status btn-cross" onclick="setApptStatus('${cita.id_cita}', 'NO_ASISTIO', this)" title="Faltó">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="btn-status" onclick="openReschedule('${cita.id_cita}')" style="background:#fcf8e3; color:#f39c12;" title="Reagendar">
                            <i class="fas fa-calendar-alt"></i> Reagendar
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#aaa;"><p>No hay citas para el ${dateString}.</p></div>`;
        }
    });
}

function setApptStatus(id, status, btn) {
    const card = btn.closest('.agenda-card');
    card.className = "agenda-card"; // Reset
    if(status === 'ASISTIO') card.classList.add('attended');
    if(status === 'NO_ASISTIO') card.classList.add('missed');
    
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "update_appt_status", id_cita: id, estado: status }) });
}

// --- LÓGICA DE REAGENDAR ---
function openReschedule(idCita) {
    document.getElementById('reschIdCita').value = idCita;
    document.getElementById('reschDate').value = "";
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
        // Generar horas 9am - 4pm
        for (let h = 9; h <= 16; h++) {
            ["00", "30"].forEach(m => {
                if(h===16 && m==="30") return; // Límite 16:00
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
                loadAgenda(document.getElementById('agendaDateInput').value); // Recargar
            } else {
                alert("Error: " + res.message);
            }
        })
        .finally(() => { btn.disabled = false; btn.innerText = "Guardar Cambios"; });
    });
}