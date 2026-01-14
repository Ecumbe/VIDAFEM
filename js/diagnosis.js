// js/diagnosis.js
// Módulo exclusivo para Diagnósticos y Tratamientos

// Escuchar envío del formulario de diagnóstico
const formDiag = document.getElementById('formDiagnosis');

if (formDiag) {
    formDiag.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Guardando...";

        // Obtenemos ID del paciente desde la URL (igual que en clinical.js)
        const urlParams = new URLSearchParams(window.location.search);
        const patientId = urlParams.get('id');

        const data = {
            id_paciente: patientId,
            tipo: document.getElementById('diagType').value,
            fecha: document.getElementById('diagDate').value,
            resultado: document.getElementById('diagResult').value,
            archivo_url: document.getElementById('diagFile').value
        };

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "add_diagnosis", data: data })
        })
        .then(r => r.json())
        .then(res => {
            if (res.success) {
                alert("Diagnóstico guardado.");
                this.reset();
                // Recargar la lista inmediatamente
                loadDiagnosesList(patientId);
            } else {
                alert("Error: " + res.message);
            }
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerText = originalText;
        });
    });
}

// Función para cargar la lista de tarjetas (Se llama al entrar a la pestaña)
function loadDiagnosesList(patientId) {
    const container = document.getElementById('diagnosisList');
    container.innerHTML = '<p style="color:#888;">Cargando historial...</p>';

    fetch(API_URL, { 
        method: "POST", 
        body: JSON.stringify({ action: "get_diagnoses", id_paciente: patientId }) 
    })
    .then(r => r.json())
    .then(res => {
        container.innerHTML = ""; // Limpiar
        
        if (res.success && res.data.length > 0) {
            res.data.forEach(diag => {
                const card = document.createElement('div');
                card.className = "card diagnosis-card";
                card.style.borderLeft = "4px solid var(--c-accent)"; // Borde decorativo
                
                // Icono según tipo
                let icon = "fa-file-medical";
                if(diag.tipo === 'Ecografia') icon = "fa-baby";
                if(diag.tipo === 'Laboratorio') icon = "fa-flask";

                // Botón de archivo (si existe link)
                let fileBtn = "";
                if(diag.archivo_url) {
                    fileBtn = `<a href="${diag.archivo_url}" target="_blank" class="btn-icon" title="Ver Archivo" style="color:var(--c-primary); margin-left:auto;">
                                <i class="fas fa-external-link-alt"></i> Ver Archivo
                               </a>`;
                }

                card.innerHTML = `
                    <div style="display:flex; align-items:flex-start; gap:15px;">
                        <div style="background:#f0f2f5; padding:10px; border-radius:50%; color:#666;">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between;">
                                <h4 style="margin:0; color:var(--c-primary);">${diag.tipo}</h4>
                                <small style="color:#999;">${formatDate(diag.fecha)}</small>
                            </div>
                            <p style="margin:8px 0; font-size:0.95rem; white-space: pre-wrap;">${diag.resultado}</p>
                            ${fileBtn}
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `
                <div class="empty-state" style="padding:20px;">
                    <i class="fas fa-folder-open"></i>
                    <p>No hay diagnósticos registrados.</p>
                </div>
            `;
        }
    });
}

// Helper para fecha (Reusamos o definimos si es módulo aislado)
function formatDate(dateString) {
    if(!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
}