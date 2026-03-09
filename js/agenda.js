// js/agenda.js - Controlador de Agenda con WhatsApp

let isReschedulingFromAgenda = false;

function normalizePhoneForWa(phone) {
    if (!phone) return "";
    let digits = String(phone).replace(/[^\d]/g, "");
    if (!digits) return "";

    // Ecuador local: 09XXXXXXXX o 9XXXXXXXX
    if (digits.length === 10 && digits.charAt(0) === "0") {
        digits = "593" + digits.substring(1);
    } else if (digits.length === 9) {
        digits = "593" + digits;
    }

    return digits;
}

function getSessionDataSafe() {
    try {
        const raw = sessionStorage.getItem("vidafem_session");
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
        alert("Sesion invalida o expirada. Inicia sesion nuevamente.");
        try { sessionStorage.removeItem("vidafem_session"); } catch (e) {}
        window.location.href = "index.html";
        return null;
    }
    return s;
}

function getRequesterFromSession() {
    const s = requireDoctorSession();
    if (!s) return null;
    return (s.data && (s.data.usuario || s.data.usuario_doctor || s.data.nombre_doctor)) || null;
}

document.addEventListener("DOMContentLoaded", () => {
    if (!requireDoctorSession()) return;

    const dateInput = document.getElementById("agendaDateInput");
    if (dateInput) {
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;
        dateInput.addEventListener("change", () => loadAgenda(dateInput.value));
        loadAgenda(today);
    }

    const reschDate = document.getElementById("reschDate");
    if (reschDate) {
        reschDate.min = new Date().toISOString().split("T")[0];
        reschDate.addEventListener("change", loadRescheduleHours);
    }
});

function loadAgenda(dateString) {
    const requester = getRequesterFromSession();
    if (!requester) return;

    const container = document.getElementById("agendaGrid");
    if (!container) return;
    container.innerHTML = "<p>Cargando citas...</p>";

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_agenda", fecha: dateString, requester: requester })
    })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = "";

        if (res.success && res.data.length > 0) {
            res.data.forEach(cita => {
                const card = document.createElement("div");
                card.className = "agenda-card";

                if (cita.estado === "ASISTIO") card.classList.add("attended");
                if (cita.estado === "NO_ASISTIO") card.classList.add("missed");
                if (cita.estado === "REAGENDADO") card.style.borderLeftColor = "#f39c12";

                let btnWhatsappHTML = "";
                if (cita.telefono) {
                    const waNumber = normalizePhoneForWa(cita.telefono);
                    const recMsg = cita.recomendaciones ? `\nRecomendaciones: ${cita.recomendaciones}` : "";
                    const waMsg = `Hola ${cita.nombre_paciente}, le saludamos de VIDAFEM para confirmar la cita del dia de manana ${cita.fecha} a las ${cita.hora}.${recMsg}\nMe confirma por favor. Gracias.`;
                    if (waNumber) {
                        const urlWa = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
                        btnWhatsappHTML = `
                            <a href="${urlWa}" target="_blank" class="btn-status" style="background:#25D366; color:white; text-decoration:none;" title="Enviar WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </a>
                        `;
                    }
                }

                let notaHTML = "";
                if (cita.nota) {
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
                    ${notaHTML}
                    <div class="agenda-actions">
                        <button class="btn-status btn-check" onclick="setApptStatus('${cita.id_cita}', 'ASISTIO', this)" title="Asistio">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-status btn-cross" onclick="setApptStatus('${cita.id_cita}', 'NO_ASISTIO', this)" title="Falto">
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
    })
    .catch(() => {
        container.innerHTML = '<p style="color:#c0392b;">Error de conexion al cargar agenda.</p>';
    });
}

function setApptStatus(id, status, btn) {
    const requester = getRequesterFromSession();
    if (!requester) return;

    const card = btn.closest(".agenda-card");
    if (card) {
        card.className = "agenda-card";
        if (status === "ASISTIO") card.classList.add("attended");
        if (status === "NO_ASISTIO") card.classList.add("missed");
    }

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "update_appt_status", id_cita: id, estado: status, requester: requester })
    });
}

function openReschedule(idCita) {
    document.getElementById("reschIdCita").value = idCita;
    document.getElementById("reschDate").value = "";
    document.getElementById("reschTime").innerHTML = "<option>Selecciona fecha...</option>";
    document.getElementById("modalReschedule").classList.add("active");
}

function loadRescheduleHours() {
    const requester = getRequesterFromSession();
    if (!requester) return;

    const dateVal = document.getElementById("reschDate").value;
    const timeSelect = document.getElementById("reschTime");
    if (!dateVal || !timeSelect) return;

    timeSelect.innerHTML = "<option>Cargando...</option>";

    fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_taken_slots", fecha: dateVal, requester: requester }) })
    .then(r => r.json())
    .then(res => {
        const taken = res.data || [];
        timeSelect.innerHTML = "";
        for (let h = 9; h <= 16; h++) {
            ["00", "30"].forEach(m => {
                if (h === 16 && m === "30") return;
                const t = `${h < 10 ? "0" + h : h}:${m}`;
                if (!taken.includes(t)) {
                    const opt = document.createElement("option");
                    opt.value = t;
                    opt.innerText = t;
                    timeSelect.appendChild(opt);
                }
            });
        }
    });
}

const formResch = document.getElementById("formReschedule");
if (formResch) {
    formResch.addEventListener("submit", function(e) {
        e.preventDefault();
        if (isReschedulingFromAgenda) {
            alert("Ya se esta procesando el reagendamiento. Espera un momento.");
            return;
        }

        const requester = getRequesterFromSession();
        if (!requester) return;

        const btn = this.querySelector("button");
        btn.disabled = true;
        btn.innerText = "Procesando...";
        isReschedulingFromAgenda = true;

        const data = {
            id_cita: document.getElementById("reschIdCita").value,
            nueva_fecha: document.getElementById("reschDate").value,
            nueva_hora: document.getElementById("reschTime").value
        };

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "reschedule_appointment", data: data, requester: requester })
        })
        .then(r => r.json())
        .then(res => {
            if (res.success) {
                alert("Cita reagendada.");
                if (typeof closeModal === "function") closeModal("modalReschedule");
                else document.getElementById("modalReschedule").classList.remove("active");

                const dateInput = document.getElementById("agendaDateInput");
                if (dateInput) loadAgenda(dateInput.value);
            } else {
                alert("Error: " + res.message);
            }
        })
        .catch(() => {
            alert("Error de conexion al reagendar cita.");
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerText = "Guardar Cambios";
            isReschedulingFromAgenda = false;
        });
    });
}
