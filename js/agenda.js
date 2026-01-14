// js/agenda.js - Controlador de Agenda con WhatsApp

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('agendaDateInput');
    if(dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.addEventListener('change', () => loadAgenda(dateInput.value));
    }
    // Listener para modal reagendar (si existe el elemento)
    const reschDate = document.getElementById('reschDate');
    if(reschDate) {
        reschDate.min = new Date().toISOString().split('T')[0];
        reschDate.addEventListener('change', loadRescheduleHours);
    }
});
// js/agenda.js (Parte Visual Corregida)

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

                // Lógica WhatsApp
                let btnWhatsappHTML = "";
                if(cita.telefono) {
                    const cleanTel = cita.telefono.replace(/^0+/, '');
                    const urlWa = `https://wa.me/593${cleanTel}?text=Hola ${cita.nombre_paciente}, le saludamos de VIDAFEM para confirmar la cita del día de mañana ${cita.fecha} a las ${cita.hora}. Me confirma por favor☺️¡Gracias!`;
                    
                    btnWhatsappHTML = `
                        <a href="${urlWa}" target="_blank" class="btn-status" style="background:#25D366; color:white; text-decoration:none;" title="Enviar WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </a>
                    `;
                }

                // --- NUEVO: VISUALIZAR NOTA DEL PACIENTE ---
                let notaHTML = "";
                if(cita.nota) {
                    notaHTML = `
                        <div style="background:#fff3cd; color:#856404; padding:8px; border-radius:5px; margin-top:10px; font-size:0.85rem; border-left:3px solid #ffeeba;">
                            <i class="fas fa-comment-dots"></i> <strong>Nota:</strong> ${cita.nota}
                        </div>
                    `;
                }

                card.innerHTML = `
                    <div class="agenda-time"><i class="far fa-clock"></i> ${cita.hora}</div>
                    <a href="#" onclick="goToClinical('${cita.id_paciente}')" class="agenda-patient">
                        ${cita.nombre_paciente} <i class="fas fa-external-link-alt" style="font-size:0.8rem"></i>
                    </a>
                    <span class="agenda-proc">${cita.motivo}</span>
                    
                    ${notaHTML} <div class="agenda-actions">
                        <button class="btn-status btn-check" onclick="setApptStatus('${cita.id_cita}', 'ASISTIO', this)" title="Asistió">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-status btn-cross" onclick="setApptStatus('${cita.id_cita}', 'NO_ASISTIO', this)" title="Faltó">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="btn-status" onclick="openReschedule('${cita.id_cita}')" style="background:#fcf8e3; color:#f39c12;" title="Reagendar">
                            <i class="fas fa-calendar-alt"></i>
                        </button>
                        ${btnWhatsappHTML}
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
    card.className = "agenda-card"; 
    if(status === 'ASISTIO') card.classList.add('attended');
    if(status === 'NO_ASISTIO') card.classList.add('missed');
    
    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "update_appt_status", id_cita: id, estado: status }) });
}

// ... (Resto de funciones de Reagendar igual que antes) ...
// Copia aquí las funciones openReschedule, loadRescheduleHours y el listener del formReschedule que ya tenías
// o usa el archivo agenda.js que te di antes y solo cambia la función loadAgenda.
// Para que sea más fácil, abajo te pongo las funciones de reagendar para que completes el archivo si borras todo.

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
                loadAgenda(document.getElementById('agendaDateInput').value); 
            } else {
                alert("Error: " + res.message);
            }
        })
        .finally(() => { btn.disabled = false; btn.innerText = "Guardar Cambios"; });
    });
}