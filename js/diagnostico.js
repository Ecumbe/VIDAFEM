// js/diagnostico.js - VERSIÓN DINÁMICA FINAL (Títulos Personalizados + Editor Corregido)

let currentPatientId = null;
let currentReportId = null;
let CONFIG_CAMPOS = {};
let SERVICES_METADATA = [];
let hasUnsavedChanges = false;
// Ya no usamos existingFileIds fija, todo se lee del DOM

// VARIABLES EDITOR
let canvas,
  ctx,
  currentImgElement = null; // Guardamos referencia directa a la imagen editada
let isDrawing = false;
let history = [];
let currentColor = "#ff0000";
let currentTool = "brush";
let startX, startY, snapshot;

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Iniciando Diagnóstico...");

  // 1. Obtener IDs de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const pId = urlParams.get("patientId") || urlParams.get("id"); 
  const rId = urlParams.get("reportId") || urlParams.get("reporte"); // <--- AHORA LEEMOS EL REPORTE

  // Poner fecha de hoy por defecto
  const fechaInput = document.getElementById("fecha");
  if (fechaInput) {
      const today = new Date();
      fechaInput.value = today.toISOString().split('T')[0];
  }

  // 2. Cargar Datos del Paciente
  if (pId) {
    currentPatientId = pId;
    const hiddenInput = document.getElementById("selectedPatientId");
    if(hiddenInput) hiddenInput.value = pId;

    if (typeof loadPatientFullData === 'function') loadPatientFullData(pId);
    
    // Ajustar botón volver
    const btnBack = document.querySelector(".btn-back-sidebar");
    if (btnBack) btnBack.href = `clinical.html?id=${pId}`;
  }

  // 3. CARGA SECUENCIAL CLAVE (Configuración -> Luego Datos)
  // Primero cargamos el menú de servicios (Excel)
  if(typeof loadServicesDropdown === 'function') {
      // Modificamos loadServicesDropdown para que devuelva una Promesa y sepamos cuando terminó
      loadServicesDropdown().then(() => {
          // SOLO SI TERMINÓ DE CARGAR EL MENU Y HAY UN REPORTE, CARGAMOS LOS DATOS
          if (rId) {
              console.log("✏️ Modo Edición detectado. ID:", rId);
              currentReportId = rId; // Guardar ID global
              loadReportForEdit(rId);
          }
      });
  }
});

// ==========================================
// 1. GESTIÓN DE FOTOS DINÁMICAS (NUEVO SISTEMA)
// ==========================================

// Generador de ID único para cada slot
function generateId() {
  return "photo_" + Math.random().toString(36).substr(2, 9);
}

// MODIFICADA: Ahora acepta targetId para saber dónde dibujar la foto
window.addPhotoSlot = function (existingData = null, targetContainerId = "dynamicPhotoContainer") {
  const container = document.getElementById(targetContainerId);
  if (!container) return; // Si no existe el contenedor, no hace nada

  const id = generateId(); // ID único interno

  const div = document.createElement("div");
  div.className = "photo-card";
  div.id = `card_${id}`;

  // Valores por defecto
  const imgSrc = existingData ? existingData.src : "";
  const titleVal = existingData ? existingData.title : "";
  const isHidden = imgSrc ? "" : "hidden";
  const placeHidden = imgSrc ? "hidden" : "";
  
  // Guardamos fileId si existe para no resubir
  const fileIdAttr = existingData && existingData.fileId ? `data-fileid="${existingData.fileId}"` : "";

  div.innerHTML = `
        <button type="button" class="btn-remove-photo" onclick="removePhotoSlot('${id}')" title="Eliminar foto"><i class="fas fa-times"></i></button>
        
        <input type="text" class="photo-input-title" placeholder="Título (Ej: Muestra 1)" value="${titleVal}">
        
        <div class="photo-frame" onclick="triggerDynamicPhoto('${id}')">
            <input type="file" id="input_${id}" accept="image/*" hidden onchange="previewDynamicPhoto('${id}')">
            
            <div id="place_${id}" class="photo-placeholder ${placeHidden}" style="text-align:center; color:#999;">
                <i class="fas fa-camera" style="font-size:2rem; margin-bottom:5px;"></i><br>
                Clic para subir
            </div>
            
            <img id="img_${id}" src="${imgSrc}" class="${isHidden}" ${fileIdAttr}>
            
            <div id="actions_${id}" class="photo-actions ${isHidden}">
                <button type="button" class="btn-action edit" onclick="openEditorDynamic('${id}', event)"><i class="fas fa-pencil-alt"></i> Editar</button>
            </div>
        </div>
    `;

  container.appendChild(div);
};

window.removePhotoSlot = function (id) {
  if (confirm("¿Eliminar esta foto?")) {
    const card = document.getElementById(`card_${id}`);
    card.remove();
  }
};

window.triggerDynamicPhoto = function (id) {
  const img = document.getElementById(`img_${id}`);
  // Solo abre selector si no hay imagen. Si hay, usa los botones de acción.
  if (img.classList.contains("hidden")) {
    document.getElementById(`input_${id}`).click();
  }
};

window.previewDynamicPhoto = function (id) {
  const f = document.getElementById(`input_${id}`).files[0];
  if (f) {
    const r = new FileReader();
    r.onload = (e) => {
      const img = document.getElementById(`img_${id}`);
      const place = document.getElementById(`place_${id}`);
      const actions = document.getElementById(`actions_${id}`);

      img.src = e.target.result;
      img.classList.remove("hidden");
      place.classList.add("hidden");
      actions.classList.remove("hidden");

      // Marcar como "NUEVA" quitando el data-fileid si tenía
      img.removeAttribute("data-fileid");
    };
    r.readAsDataURL(f);
  }
};

// ==========================================
// 2. EDITOR DE FOTOS (CORREGIDO TEXTO Y VISIBILIDAD)
// ==========================================

window.openEditorDynamic = function (id, event) {
  if (event) event.stopPropagation();

  const img = document.getElementById(`img_${id}`);
  currentImgElement = img; // Guardamos referencia

  // --- MANEJO CORS GOOGLE DRIVE ---
  if (
    img.src.includes("drive.google.com") ||
    img.src.includes("googleusercontent")
  ) {
    const fileId = img.getAttribute("data-fileid");
    if (!fileId) {
      alert("Error: ID de archivo perdido. Recarga la página.");
      return;
    }

    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "get_file_base64", file_id: fileId }),
    })
      .then((r) => r.json())
      .then((res) => {
        btn.innerHTML = originalHtml;
        if (res.success) initCanvas(res.data);
        else alert("Error cargando imagen: " + res.message);
      });
  } else {
    initCanvas(img.src);
  }
};

function initCanvas(src) {
  const modal = document.getElementById("photoEditor");
  const overlay = document.getElementById("editorOverlay");
  canvas = document.getElementById("drawingCanvas");
  ctx = canvas.getContext("2d");

  const image = new Image();
  image.crossOrigin = "Anonymous";
  image.src = src;

  image.onload = () => {
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    history = [canvas.toDataURL()];

    modal.classList.add("active");
    overlay.classList.add("active");
    setupCanvasEvents();
  };
}

// EVENTOS DE DIBUJO (CON SOLUCIÓN TEXTO)
function setupCanvasEvents() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    // SI LA HERRAMIENTA ES TEXTO, CLICK PARA ESCRIBIR
    if (currentTool === "text") {
      const pos = getPos(e);
      const text = prompt("Ingresa el texto:");
      if (text) {
        ctx.font = "bold 24px Arial";
        ctx.fillStyle = currentColor;
        ctx.fillText(text, pos.x, pos.y);
        history.push(canvas.toDataURL());
      }
      return; // No dibujamos trazos
    }

    isDrawing = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = currentColor;

    if (currentTool === "brush") ctx.moveTo(pos.x, pos.y);
    if (e.type === "touchstart") e.preventDefault();
  };

  const draw = (e) => {
    if (!isDrawing || currentTool === "text") return;
    const pos = getPos(e);

    if (currentTool === "brush") {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (currentTool === "circle") {
      ctx.putImageData(snapshot, 0, 0);
      const r = Math.sqrt(
        Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2)
      );
      ctx.beginPath();
      ctx.arc(startX, startY, r, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (currentTool === "arrow") {
      ctx.putImageData(snapshot, 0, 0);
      drawArrow(ctx, startX, startY, pos.x, pos.y);
    }
    if (e.type === "touchmove") e.preventDefault();
  };

  const stopDraw = () => {
    if (isDrawing) {
      isDrawing = false;
      if (currentTool === "brush") ctx.closePath();
      history.push(canvas.toDataURL());
    }
  };

  canvas.onmousedown = startDraw;
  canvas.onmousemove = draw;
  canvas.onmouseup = stopDraw;
  canvas.ontouchstart = startDraw;
  canvas.ontouchmove = draw;
  canvas.ontouchend = stopDraw;
}

function drawArrow(ctx, x1, y1, x2, y2) {
  const head = 15;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(angle - Math.PI / 6),
    y2 - head * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(angle + Math.PI / 6),
    y2 - head * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

// Herramientas UI
window.setTool = function (tool, btn) {
  currentTool = tool;
  updateUI(".tool-btn", btn);
};
window.setToolColor = function (color, btn) {
  currentColor = color;
  updateUI(".color-btn", btn);
};
// Cambiamos addTextToCanvas para que solo seleccione la herramienta
window.addTextToCanvas = function (btn) {
  currentTool = "text";
  updateUI(".tool-btn", btn);
  alert("Ahora haz clic sobre la foto donde quieras que aparezca el texto.");
};

function updateUI(selector, btn) {
  document
    .querySelectorAll(selector)
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

window.undoLastStroke = function () {
  if (history.length > 1) {
    history.pop();
    const img = new Image();
    img.src = history[history.length - 1];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  }
};
window.clearCanvas = function () {
  if (history.length > 0) {
    const img = new Image();
    img.src = history[0];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      history.push(canvas.toDataURL());
    };
  }
};

window.saveEditedPhoto = function () {
  if (currentImgElement) {
    // Actualizamos la imagen en el DOM con la versión pintada
    currentImgElement.src = canvas.toDataURL("image/jpeg", 0.85);
    // Quitamos el ID de archivo porque ahora es una imagen "nueva" (editada)
    currentImgElement.removeAttribute("data-fileid");
    closeEditor();
  }
};
window.closeEditor = function () {
  document.getElementById("photoEditor").classList.remove("active");
  document.getElementById("editorOverlay").classList.remove("active");
};

// ==========================================
// 3. GUARDADO (RECOLECCIÓN DINÁMICA)
// ==========================================

// Función auxiliar de seguridad (Evita el crash si falta un input)
function getValSafe(id) {
  const el = document.getElementById(id);
  return el ? el.value : ""; // Si no existe, devuelve vacío en lugar de error
}

// --- PEGAR ESTO AL FINAL DE diagnostico.js O ANTES DE saveDiagnosis ---

// Función auxiliar para comprimir imágenes
function compressImage(base64Str, maxWidth = 1000, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calcular nuevas dimensiones manteniendo proporción
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Devolver base64 comprimido (image/jpeg es más ligero que png)
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str); // Si falla, devuelve original
  });
}

// --- MODIFICAR LA PARTE DE saveDiagnosis ASÍ ---

// Reemplaza tu función saveDiagnosis actual por esta versión unificada:

async function saveDiagnosis(generarPdf, btn) {
  // Usamos saveCommon para respetar tu estructura, validaciones y manejo de errores
  saveCommon("COLPOSCOPIA", generarPdf, btn, async () => {
    
    // 1. RECOLECTAR IMÁGENES (Mantenemos tu lógica de fotos y compresión)
    const cards = document.querySelectorAll(".photo-card img"); 
    const imgs = [];

    if(btn) btn.innerText = "Procesando imágenes...";

    for (let i = 0; i < cards.length; i++) {
        const imgEl = cards[i];
        const card = imgEl.closest('.photo-card');
        const titleInput = card.querySelector(".photo-input-title");
        const title = titleInput ? titleInput.value : `Imagen ${i + 1}`;
        const existingId = imgEl.getAttribute("data-fileid");
        
        if (imgEl.src.startsWith("data:")) {
            // Comprimimos si es nueva
            const compressedBase64 = (typeof compressImage === 'function') ? await compressImage(imgEl.src) : imgEl.src;
            imgs.push({ index: i + 1, title: title, data: compressedBase64, isNew: true });
        } else if (existingId) {
            // Mantenemos si ya existía
            imgs.push({ index: i + 1, title: title, fileId: existingId, isNew: false });
        }
    }

    // 2. RECOLECTAR RECETA (CORREGIDO: Ahora busca la Universal)
    let recetaData = { medicamentos: [], observaciones_receta: "" };
    
    // Intentamos leer la tabla de receta universal que es la que se ve en pantalla
    const filasReceta = document.querySelectorAll("#tablaRecetaUniversal tbody tr");
    if (filasReceta.length > 0) {
        filasReceta.forEach(tr => {
            const nombre = tr.querySelector(".med-name-uni").value;
            const cant = tr.querySelector(".med-qty-uni").value;
            const frec = tr.querySelector(".med-freq-uni").value;
            if (nombre) {
                recetaData.medicamentos.push({ nombre: nombre, cantidad: cant, frecuencia: frec });
            }
        });
        const obsReceta = document.getElementById("receta_obs_universal");
        if(obsReceta) recetaData.observaciones_receta = obsReceta.value;
    } 
    // Si no encontró nada ahí, intenta con la función auxiliar por si acaso
    else if (typeof getUniversalRecipeData === 'function') {
        const aux = getUniversalRecipeData();
        if(aux) recetaData = aux;
    }

    // 3. RECOLECTAR PDF EXTERNO (El archivo subido)
    if(btn) btn.innerText = "Leyendo archivo PDF...";
    let pdfFile = null;
    if (typeof getPdfExternoData === 'function') {
        pdfFile = await getPdfExternoData();
    }

    // Restaurar estado visual del botón antes de retornar
    if(btn) btn.innerHTML = `<i class="fas fa-circle-notch fa-spin-fast"></i> Guardando...`;

    // 4. RETORNAR EL PAQUETE COMPLETO (Esto se envía a saveCommon -> Servidor)
    return {
      // Datos clínicos (Colposcopía)
      evaluacion: getValSafe("colpo_evaluacion"),
      vagina: getValSafe("colpo_vagina"),
      vulva: getValSafe("colpo_vulva"),
      ano: getValSafe("colpo_ano"),
      hallazgos: getValSafe("colpo_hallazgos"),
      diagnostico: getValSafe("colpo_diagnostico"),
      biopsia: getValSafe("colpo_biopsia"),
      recomendaciones: getValSafe("colpo_recomendaciones"),
      
      // Datos adjuntos (Ahora sí viajan correctamente)
      imagenes: imgs,
      medicamentos: recetaData.medicamentos,
      observaciones_receta: recetaData.observaciones_receta,
      pdf_externo: pdfFile 
    };
  });
}
function saveRecipe(generarPdf, btn) {
  saveCommon("RECETA", generarPdf, btn, () => {
    const meds = [];
    document.querySelectorAll("#medicationTable tbody tr").forEach((tr) => {
      const nombre = tr.querySelector(".med-name").value;
      if (nombre)
        meds.push({
          nombre,
          cantidad: tr.querySelector(".med-qty").value,
          frecuencia: tr.querySelector(".med-freq").value,
        });
    });
    return {
      medicamentos: meds,
      observaciones: document.getElementById("receta_observaciones").value,
    };
  });
}

function saveGeneral(generarPdf, btn) {
  saveCommon("CONSULTA GENERAL", generarPdf, btn, () => {
    return {
      motivo: document.getElementById("gen_motivo").value,
      evaluacion: document.getElementById("gen_evaluacion").value,
      diagnostico: document.getElementById("gen_diagnostico").value,
      recomendaciones: document.getElementById("gen_recomendaciones").value,
    };
  });
}

async function saveCommon(tipo, generarPdf, btnClicked, getDataFn) {
  if (!currentPatientId) return alert("Error ID Paciente");
  
  // --- CORRECCIÓN: Declarar la variable aquí ---
  let pdfWindow = null;

  // 1. ABRIR VENTANA DE CARGA (Anti-Bloqueo)
  if (generarPdf) {
      pdfWindow = window.open("", "_blank");
      if (pdfWindow) {
          pdfWindow.document.write("<html><body style='text-align:center; padding:50px; font-family:sans-serif;'><h2>⏳ Generando Documento...</h2><p>Procesando solicitud...</p></body></html>");
      } else {
          alert("⚠️ Habilite las ventanas emergentes para ver el PDF.");
          return; // Cancelar si está bloqueado
      }
  }

  const originalContent = btnClicked.innerHTML;
  const allBtns = document.querySelectorAll(".btn-submit");
  allBtns.forEach((b) => (b.disabled = true));

  if (generarPdf) {
    btnClicked.innerHTML = `<i class="fas fa-circle-notch fa-spin-fast"></i> Abriendo PDF...`;
    btnClicked.style.background = "#e67e22";
  } else {
    btnClicked.innerHTML = `<i class="fas fa-circle-notch fa-spin-fast"></i> Guardando...`;
  }

  try {
    const specificData = await getDataFn();
    const data = {
      id_reporte: currentReportId,
      id_paciente: currentPatientId,
      nombre_paciente: document.getElementById("patientNameDisplay").value,
      tipo_examen: tipo,
      generar_pdf: generarPdf,
      ...specificData,
    };

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "save_diagnosis_advanced", data: data }),
    }).then((r) => r.json());

    if (res.success) {
      hasUnsavedChanges = false;
      
      btnClicked.innerHTML = `<i class="fas fa-check"></i> ¡Listo!`;
      btnClicked.style.background = "#27ae60";
      
      if (generarPdf && pdfWindow) {
          if (res.pdf_url) {
              pdfWindow.location.href = res.pdf_url;
          } else if (res.pdf_receta_url) {
              pdfWindow.location.href = res.pdf_receta_url;
          } else {
              pdfWindow.close(); // Si no hay link, cerramos la ventana blanca
              alert("Guardado, pero el servidor no devolvió el PDF.");
          }
          setTimeout(() => window.location.href = `clinical.html?id=${currentPatientId}`, 1500);
      } else {
          setTimeout(() => {
             btnClicked.disabled = false;
             btnClicked.innerHTML = originalContent;
             btnClicked.style.background = "";
             alert("Guardado correctamente.");
             restoreAllButtons(allBtns, btnClicked, originalContent);
          }, 800);
      }
    } else {
      if(pdfWindow) pdfWindow.close();
      alert("Error: " + res.message);
      restoreAllButtons(allBtns, btnClicked, originalContent);
    }
  } catch (e) {
    if(pdfWindow) pdfWindow.close();
    console.error(e);
    alert("Error de conexión.");
    restoreAllButtons(allBtns, btnClicked, originalContent);
  }
}

function restoreAllButtons(allBtns, btnClicked, originalContent) {
  allBtns.forEach((b) => (b.disabled = false));
  btnClicked.innerHTML = originalContent;
  btnClicked.style.background = "";
}
// ==========================================
// CONTROL DE MÓDULOS OPCIONALES (RECETA Y ARCHIVOS)
// ==========================================

// 1. Mostrar/Ocultar Receta
window.toggleRecetaModule = function(show) {
    const btn = document.getElementById("btnOpenReceta");
    const container = document.getElementById("recetaUniversalContainer");
    
    if (show) {
        if(btn) btn.style.display = "none";
        if(container) {
            container.classList.remove("hidden");
            // Si está vacía, agregamos una fila
            if(document.querySelector("#tablaRecetaUniversal tbody").children.length === 0) {
                addMedRowUniversal();
            }
        }
    } else {
        // CERRAR Y BORRAR DATOS
        if(confirm("¿Quitar la receta? Se borrarán los datos ingresados.")) {
            if(btn) btn.style.display = "block";
            if(container) container.classList.add("hidden");
            // Limpiar inputs
            document.querySelector("#tablaRecetaUniversal tbody").innerHTML = "";
            const obs = document.getElementById("receta_obs_universal");
            if(obs) obs.value = "";
        }
    }
}

// 2. Mostrar/Ocultar Archivo Adjunto
window.togglePdfModule = function(show) {
    const btn = document.getElementById("btnOpenPdf");
    const container = document.getElementById("pdfUploadContainer");
    
    if (show) {
        if(btn) btn.style.display = "none";
        if(container) container.classList.remove("hidden");
    } else {
        // CERRAR Y BORRAR
        if(confirm("¿Quitar el archivo adjunto?")) {
            if(btn) btn.style.display = "block";
            if(container) container.classList.add("hidden");
            
            // Limpiar input file
            const input = document.getElementById("pdfExternoFile");
            if(input) input.value = "";
            
            // Limpiar visualización de archivo existente
            const existingMsg = document.getElementById("existingPdfMsg");
            if(existingMsg) existingMsg.remove();
            
            // Marcar para borrado en backend
            window.pdfExternoEliminado = true;
        }
    }
}
// ==========================================
// 4. CARGA DE DATOS (EDICIÓN)
// ==========================================
// js/diagnostico.js - FUNCIÓN DE CARGA BLINDADA
function loadReportForEdit(reportId) {
  // CORRECCIÓN 1: Solo cambiamos texto a los botones PRINCIPALES de guardar
  const mainSaveBtns = document.querySelectorAll(".btn-save-main"); 
  mainSaveBtns.forEach((b) => (b.innerText = "⏳ Cargando..."));

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_data", sheet: "diagnosticos_archivos" }),
  })
    .then((r) => r.json())
    .then((res) => {
      const report = res.data.find((x) => String(x.id_reporte) === String(reportId));
      if (!report) return alert("Reporte no encontrado");

      let data = {};
      try { data = JSON.parse(report.datos_json); } catch (e) { console.error(e); }

      // 1. Configurar Servicio
      const selector = document.getElementById("reportTypeSelector");
      let serviceValue = data.tipo_examen === "CONSULTA GENERAL" ? "general" : 
                         data.tipo_examen === "COLPOSCOPIA" ? "colposcopia" :
                         data.tipo_examen === "RECETA" ? "receta" : data.tipo_examen;
      
      selector.value = serviceValue;
      toggleForm(); // Dibujar campos

      // 2. Restaurar Textos de Botones Principales
      mainSaveBtns.forEach(b => {
          if(b.innerHTML.includes("PDF")) b.innerHTML = '<i class="fas fa-print"></i> Guardar y PDF';
          else b.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
      });

      // 3. RELLENAR CAMPOS DINÁMICOS
      if (data.datos_json) {
          Object.keys(data.datos_json).forEach(key => {
              const input = document.getElementById("dyn_" + key);
              if (input) input.value = data.datos_json[key];
          });
      }
      
      // Rellenar campos fijos (Legacy)
      if (serviceValue === "colposcopia") {
          setVal("colpo_evaluacion", data.evaluacion);
          setVal("colpo_vagina", data.vagina);
          setVal("colpo_vulva", data.vulva);
          setVal("colpo_ano", data.ano);
          setVal("colpo_hallazgos", data.hallazgos);
          setVal("colpo_diagnostico", data.diagnostico);
          setVal("colpo_biopsia", data.biopsia);
          setVal("colpo_recomendaciones", data.recomendaciones);
      } else if (serviceValue === "general") {
          setVal("gen_motivo", data.motivo);
          setVal("gen_evaluacion", data.evaluacion);
          setVal("gen_diagnostico", data.diagnostico);
          setVal("gen_recomendaciones", data.recomendaciones);
      }

      // 4. RECETA (Usando el nuevo sistema de botones)
      if (data.medicamentos && data.medicamentos.length > 0) {
          // ABRIMOS EL MÓDULO VISUALMENTE
          toggleRecetaModule(true);
          
          const tbody = document.querySelector("#tablaRecetaUniversal tbody");
          tbody.innerHTML = ""; // Limpiar
          
          data.medicamentos.forEach(med => {
              const tr = document.createElement("tr");
              tr.innerHTML = `
                <td><input type="text" class="doc-input med-name-uni" value="${med.nombre}" style="width:100%"></td>
                <td><input type="text" class="doc-input med-qty-uni" value="${med.cantidad}" style="width:100%"></td>
                <td><input type="text" class="doc-input med-freq-uni" value="${med.frecuencia}" style="width:100%"></td>
                <td style="text-align:center;"><button type="button" onclick="this.closest('tr').remove()" style="color:red; background:none; border:none; cursor:pointer;">&times;</button></td>
              `;
              tbody.appendChild(tr);
          });
          
          if(data.observaciones_receta) {
               document.getElementById("receta_obs_universal").value = data.observaciones_receta;
          }
      }

      // 5. FOTOS (CORRECCIÓN VISUALIZACIÓN)
      const dynamicContainers = document.querySelectorAll('[id^="dyn_gallery_"]');
      const staticContainer = document.getElementById("dynamicPhotoContainer"); 
      
      if (data.imagenes && Array.isArray(data.imagenes)) {
          data.imagenes.forEach(img => {
              // CAMBIO CLAVE: Usamos un link más robusto para visualizar la imagen
              let src = img.data;
              if (!src && img.fileId) {
                  // Este enlace funciona mejor para incrustar imágenes de Drive
                  src = `https://lh3.googleusercontent.com/d/${img.fileId}`; 
              }
              
              const imgObj = { src: src, title: img.title, fileId: img.fileId };

              // Intentar poner en Colposcopia
              if (staticContainer && serviceValue === "colposcopia") {
                  addPhotoSlot(imgObj, "dynamicPhotoContainer");
              } 
              // Intentar poner en Servicios Dinámicos (Biopsias, etc)
              else if (dynamicContainers.length > 0) {
                  // Ponemos en el primer contenedor disponible
                  addPhotoSlot(imgObj, dynamicContainers[0].id);
              }
          });
      }

      // 6. ARCHIVO ADJUNTO (CORRECCIÓN BORRADO)
      if (data.pdf_externo_link) {
          togglePdfModule(true); // Abrir módulo
          
          const container = document.getElementById("pdfUploadContainer");
          // Evitar duplicados
          const oldMsg = document.getElementById("existingPdfMsg");
          if(oldMsg) oldMsg.remove();

          const msg = document.createElement("div");
          msg.id = "existingPdfMsg";
          msg.style.marginTop = "10px";
          msg.style.padding = "10px";
          msg.style.background = "#e8f8f5";
          msg.style.border = "1px solid #2ecc71";
          msg.style.borderRadius = "5px";
          msg.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <a href="${data.pdf_externo_link}" target="_blank" style="color:#27ae60; font-weight:bold; text-decoration:none;">
                    <i class="fas fa-file-pdf"></i> Ver Archivo Actual
                </a>
                <button type="button" onclick="togglePdfModule(false)" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
          `;
          // Insertar antes del input file para que se vea primero
          container.insertBefore(msg, container.firstChild);
      }
      // >>> AGREGAR ESTO AL FINAL DEL BLOQUE THEN:
      console.log("Datos cargados. Activando detector de cambios.");
      setTimeout(() => {
          hasUnsavedChanges = false; // Empezamos limpios después de cargar
          activateChangeDetection(); 
      }, 1000); // Damos 1 seg para que se asienten los datos

    })
    .catch(err => {
        alert("Error cargando: " + err);
        console.error(err);
    });
}

// Helpers Comunes
function loadPatientFullData(id) {
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "get_data", sheet: "pacientes" }),
  })
    .then((r) => r.json())
    .then((res) => {
      const p = res.data.find((x) => String(x.id_paciente) === String(id));
      if (p) {
        document.getElementById("displayNombre").innerText = p.nombre_completo;
        document.getElementById("displayCedula").innerText =
          "C.I.: " + (p.cedula || "--");
        document.getElementById("displayEdad").innerText = calculateAge(
          p.fecha_nacimiento
        );
        document.getElementById("displayNacimiento").innerText =
          p.fecha_nacimiento ? p.fecha_nacimiento.split("T")[0] : "--";
        document.getElementById("patientNameDisplay").value = p.nombre_completo;
      }
    });
}
function calculateAge(d) {
  if (!d) return "-";
  const t = new Date();
  const b = new Date(d);
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a + " años";
}

function loadServicesDropdown() {
  const s = document.getElementById("reportTypeSelector");
  if (!s) return Promise.resolve();

  // 1. Limpieza y opciones fijas iniciales
  s.innerHTML = `
      <option value="" selected disabled>-- Seleccione Procedimiento --</option>
      <option value="receta" style="font-weight:bold; color:#27ae60;">📝 RECETA MÉDICA</option>
      <option value="colposcopia" style="font-weight:bold; color:#e67e22;">🔬 COLPOSCOPIA</option>
      <option value="general" style="font-weight:bold; color:#3498db;">📋 CONSULTA GENERAL</option>
  `;

  console.log("🔄 Cargando configuración de servicios...");

  // 2. HACEMOS DOS PETICIONES SIMULTÁNEAS (Campos + Títulos/Metadatos)
  // Esto es necesario para tener el Título del Informe listo cuando selecciones
  const p1 = fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_service_config" }) }).then(r => r.json());
  const p2 = fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "get_services" }) }).then(r => r.json());

  return Promise.all([p1, p2])
    .then(([resConfig, resMeta]) => {
      
      // A. Guardar campos (Lo que ya tenías)
      if (resConfig.success) {
          CONFIG_CAMPOS = resConfig.data;
          console.log("✅ Configuración cargada:", CONFIG_CAMPOS);
      }
      
      // B. Guardar Metadatos (Aquí vienen los Títulos y Recomendaciones nuevos)
      if (resMeta.success) {
          SERVICES_METADATA = resMeta.data;
      }

      // C. Dibujar el menú con los servicios nuevos
      const serviciosNuevos = Object.keys(CONFIG_CAMPOS);
      if(serviciosNuevos.length > 0) {
          serviciosNuevos.forEach((nombreServicio) => {
              const o = document.createElement("option");
              o.value = nombreServicio; 
              o.innerText = nombreServicio.toUpperCase();
              s.appendChild(o);
          });
      }
      
      // D. Iniciar el menú bonito
      initCustomSelect(); 
    })
    .catch(err => console.error("Error cargando servicios:", err));
}
function toggleForm() {
  const v = document.getElementById("reportTypeSelector").value;
  document
    .querySelectorAll(".report-form")
    .forEach((e) => e.classList.add("hidden"));
  if (v === "colposcopia")
    document.getElementById("form-colposcopia").classList.remove("hidden");
  else if (v === "receta")
    document.getElementById("form-receta").classList.remove("hidden");
  else if (v === "general")
    document.getElementById("form-general").classList.remove("hidden");
}
function addMedRow() {
  const b = document.querySelector("#medicationTable tbody");
  const r = document.createElement("tr");
  r.innerHTML = `<td><input type="text" class="doc-input med-name"></td><td><input type="text" class="doc-input med-qty"></td><td><input type="text" class="doc-input med-freq"></td><td style="text-align:center;"><button onclick="this.parentElement.parentElement.remove()" style="color:red; border:none; background:none;"><i class="fas fa-trash"></i></button></td>`;
  b.appendChild(r);
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || "";
}
// ==========================================
// 5. LÓGICA DEL MÓDULO RECETA OPCIONAL
// ==========================================

// --- FUNCIONES DE RECETA UNIVERSAL (IDs Corregidos) ---

function toggleRecetaUniversal() {
    const div = document.getElementById("recetaUniversalContainer");
    if(!div) return; // Protección anti-error
    
    if (div.classList.contains("hidden")) {
        div.classList.remove("hidden");
        // Auto-agregar fila si está vacía
        const tbody = document.querySelector("#tablaRecetaUniversal tbody");
        if(tbody && tbody.children.length === 0) {
            addMedRowUniversal();
        }
    } else {
        div.classList.add("hidden");
    }
}

function addMedRowUniversal() {
    const tbody = document.querySelector("#tablaRecetaUniversal tbody");
    if (!tbody) {
        console.error("Error: No encuentro #tablaRecetaUniversal tbody");
        return;
    }
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" class="doc-input med-name-uni" placeholder="Nombre..." style="width:100%"></td>
        <td><input type="text" class="doc-input med-qty-uni" placeholder="#" style="width:100%"></td>
        <td><input type="text" class="doc-input med-freq-uni" placeholder="Indicaciones..." style="width:100%"></td>
        <td style="text-align:center;"><button type="button" onclick="this.closest('tr').remove()" style="color:red; background:none; border:none; cursor:pointer;">&times;</button></td>
    `;
    tbody.appendChild(tr);
}

// Función auxiliar para "cosechar" los datos de la receta
function getOptionalRecipeData() {
    const meds = [];
    document.querySelectorAll("#tablaRecetaOpcional tbody tr").forEach(tr => {
        const nombre = tr.querySelector(".med-name-opt").value;
        const cantidad = tr.querySelector(".med-qty-opt").value;
        const frecuencia = tr.querySelector(".med-freq-opt").value;
        
        if (nombre && nombre.trim() !== "") {
            meds.push({ nombre, cantidad, frecuencia });
        }
    });

    // Solo devolvemos datos si hay medicamentos o una observación escrita
    const obs = document.getElementById("receta_observaciones_opcional").value;
    
    if (meds.length > 0 || obs.trim() !== "") {
        return {
            hayReceta: true,
            medicamentos: meds,
            observaciones_receta: obs // Usamos nombre distinto para no chocar con observaciones del reporte
        };
    }
    return { hayReceta: false };
}



// ==========================================
// 2. EL DIBUJANTE (Renderizado Dinámico)
// ==========================================

// Decide qué formulario mostrar según la selección
window.toggleForm = function() {
    const select = document.getElementById("reportTypeSelector");
    if (!select) return;

    const servicio = select.value;
    
    // 1. Ocultar todos los formularios primero
    const forms = document.querySelectorAll(".report-form, #form-colposcopia, #form-general, #form-receta, #form-dinamico");
    forms.forEach(f => f.classList.add("hidden"));

    // 2. Mostrar el correcto según la selección
    if (servicio === "colposcopia" || servicio === "COLPOSCOPIA") {
        document.getElementById("form-colposcopia").classList.remove("hidden");
    } 
    else if (servicio === "receta" || servicio === "RECETA") {
        document.getElementById("form-receta").classList.remove("hidden");
    }
    else if (servicio === "general" || servicio === "CONSULTA GENERAL") {
        document.getElementById("form-general").classList.remove("hidden");
    } 
    else {
        // MODO DINÁMICO (Aquí ocurre la magia)
        const divDinamico = document.getElementById("form-dinamico");
        if (divDinamico) {
            divDinamico.classList.remove("hidden");
            
            // Buscamos la configuración en el "Mapa" que cargamos del Excel
            // Usamos toLowerCase() para evitar problemas de mayúsculas/minúsculas
            const configKey = Object.keys(CONFIG_CAMPOS).find(k => k.toLowerCase() === servicio.toLowerCase());
            
            if (configKey && CONFIG_CAMPOS[configKey]) {
                // Si encontramos instrucciones, ¡DIBUJAMOS!
                renderDynamicFields(servicio, CONFIG_CAMPOS[configKey]);
            } else {
                // Si elegiste un servicio pero no configuraste campos en Excel todavía
                divDinamico.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#7f8c8d; background:#f9f9f9; border-radius:10px;">
                        <i class="fas fa-tools" style="font-size:2rem; margin-bottom:15px; color:#bdc3c7;"></i><br>
                        <h3 style="margin:0; color:#2c3e50;">${servicio}</h3>
                        <p style="margin-top:10px;">Este servicio está activo pero aún no tiene campos configurados.</p>
                        <small style="color:#e67e22;">Ve a la hoja 'config_campos' en tu Excel para diseñarlo.</small>
                    </div>`;
            }
        }
    }
    setTimeout(() => {
        hasUnsavedChanges = false; // Reseteamos al cambiar de formulario
        activateChangeDetection(); // Activamos vigilancia en los campos nuevos
    }, 500);
};

// Función que crea el HTML de los campos
// Función que crea el HTML de los campos
function renderDynamicFields(nombreServicio, campos) {
    const container = document.getElementById("form-dinamico");
    
    // --- NUEVO: BUSCAR EL TÍTULO PERSONALIZADO ---
    let tituloMostrar = "REPORTE CLÍNICO"; // Valor por defecto
    
    // Verificamos si existe la variable global SERVICES_METADATA
    if (typeof SERVICES_METADATA !== 'undefined' && SERVICES_METADATA.length > 0) {
        // Buscamos el servicio actual en la lista
        const meta = SERVICES_METADATA.find(s => s.nombre_servicio === nombreServicio);
        // Si tiene un título configurado, lo usamos
        if (meta && meta.titulo_reporte && meta.titulo_reporte.trim() !== "") {
            tituloMostrar = meta.titulo_reporte.toUpperCase();
        }
    }

    let html = `
        <div class="paper-sheet">
            <div style="text-align:right; margin-bottom:10px;">
                <span style="background:#8e44ad; color:white; padding:5px 15px; border-radius:15px; font-size:0.8rem; font-weight:bold; text-transform:uppercase;">
                    ${nombreServicio}
                </span>
            </div>
            <h2 class="doc-title" style="color:#8e44ad;">${tituloMostrar}</h2>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
    `;
    
    campos.forEach(c => {
        let inputHtml = "";
        
        if (c.tipo === 'titulo') {
            html += `
                </div>
                <h4 style="grid-column: 1 / -1; margin-top:20px; color:#2c3e50; border-bottom:2px solid #eee; padding-bottom:5px;">
                    ${c.etiqueta}
                </h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            `;
            return;
        }

        // --- GESTIÓN DE IMÁGENES ---
        if (c.tipo === 'imagenes') {
             const galleryId = `dyn_gallery_${c.nombre}`;
             inputHtml = `
                <div style="background:#fff; padding:15px; border:1px solid #ddd; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <label style="font-weight:bold; color:#555;">${c.etiqueta}</label>
                        <button type="button" onclick="addPhotoSlot(null, '${galleryId}')" class="btn-submit" style="background:#e67e22; padding:5px 15px; font-size:0.85rem; width:auto;">
                            <i class="fas fa-camera"></i> Agregar Foto
                        </button>
                    </div>
                    <div id="${galleryId}" class="photo-grid-dynamic" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px;">
                    </div>
                </div>
             `;
        } 
        // --- NUEVO: LISTAS DESPLEGABLES (SELECT) ---
        else if (c.tipo === 'select') {
            let optionsHtml = `<option value="">-- Seleccionar --</option>`;
            if (c.opciones) {
                // Separar opciones por comas y limpiarlas
                c.opciones.split(',').forEach(opt => {
                    const cleanOpt = opt.trim();
                    optionsHtml += `<option value="${cleanOpt}">${cleanOpt}</option>`;
                });
            }
            inputHtml = `<select id="dyn_${c.nombre}" class="doc-input">${optionsHtml}</select>`;
        }
        // --- NUEVO: NÚMEROS CON PLACEHOLDER "0" ---
        else if (c.tipo === 'numero') {
            inputHtml = `<input type="number" id="dyn_${c.nombre}" class="doc-input" placeholder="0">`;
        } 
        else if (c.tipo === 'parrafo') {
            inputHtml = `<textarea id="dyn_${c.nombre}" class="doc-input" rows="4" placeholder="Escriba aquí..."></textarea>`;
        } 
        else {
            inputHtml = `<input type="text" id="dyn_${c.nombre}" class="doc-input">`;
        }

        const colSpan = (c.tipo === 'parrafo' || c.tipo === 'imagenes') ? 'grid-column: 1 / -1;' : '';
        
        html += `
            <div style="${colSpan}">
                 ${c.tipo !== 'imagenes' ? `<label style="font-weight:bold; font-size:0.9rem; color:#555; display:block; margin-bottom:5px;">${c.etiqueta}</label>` : ''}
                ${inputHtml}
            </div>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// 4. FUNCIONES GLOBALES DE RECETA (Para corregir el error ReferenceError)
window.toggleRecetaUniversal = function() {
    const div = document.getElementById("recetaUniversalContainer");
    if (!div) return;
    if(div.classList.contains("hidden")) {
        div.classList.remove("hidden");
        if(document.querySelector("#tablaRecetaUniversal tbody").children.length === 0) window.addMedRowUniversal();
    } else {
        div.classList.add("hidden");
    }
};

window.addMedRowUniversal = function() {
    const tbody = document.querySelector("#tablaRecetaUniversal tbody");
    if(!tbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" class="doc-input med-name-uni" placeholder="Nombre..." style="width:100%"></td>
        <td><input type="text" class="doc-input med-qty-uni" placeholder="#" style="width:100%"></td>
        <td><input type="text" class="doc-input med-freq-uni" placeholder="Dosis..." style="width:100%"></td>
        <td style="text-align:center;"><button type="button" onclick="this.closest('tr').remove()" style="color:red; background:none; border:none; cursor:pointer; font-size:1.2em;">&times;</button></td>
    `;
    tbody.appendChild(tr);
};

// Inicializador
document.addEventListener("DOMContentLoaded", function() {
 // loadFieldConfig();
});
// --- FUNCIÓN MAESTRA DE GUARDADO (Poner al final de diagnostico.js) ---
function handleMasterSave(generatePdf, btn) {
    const servicio = document.getElementById("reportTypeSelector").value;
    
    // 1. Recolectar datos universales (Receta)
    const receta = getUniversalRecipeData(); // Función auxiliar de abajo

    if (servicio === "colposcopia" || servicio === "COLPOSCOPIA") {
        saveDiagnosis(generatePdf, btn, receta);
    } 
    else if (servicio === "general" || servicio === "CONSULTA GENERAL") {
        saveGeneral(generatePdf, btn, receta);
    } 
    else {
        // Para los servicios nuevos del Excel
        saveDynamicService(servicio, generatePdf, btn, receta);
    }
}

// Auxiliar para leer la receta
function getUniversalRecipeData() {
    const meds = [];
    document.querySelectorAll("#tablaRecetaUniversal tbody tr").forEach(tr => {
        const nombre = tr.querySelector(".med-name-uni").value;
        const cant = tr.querySelector(".med-qty-uni").value;
        const frec = tr.querySelector(".med-freq-uni").value;
        if (nombre) meds.push({ nombre, cantidad: cant, frecuencia: frec });
    });
    const obs = document.getElementById("receta_obs_universal").value;
    
    if (meds.length > 0 || obs.trim()) {
        return { medicamentos: meds, observaciones_receta: obs };
    }
    return null; // Sin receta
}

// Función Genérica para Servicios Nuevos (CORREGIDA)
async function saveDynamicService(servicio, generatePdf, btn, recetaData) {
    // 1. Confirmación inicial
    if(generatePdf && !confirm("¿Guardar y generar PDF de " + servicio + "?")) return;
    
    // --- CORRECCIÓN: Declarar la variable aquí ---
    let pdfWindow = null;

    // 2. ABRIR VENTANA DE CARGA (Anti-Bloqueo)
    if (generatePdf) {
        pdfWindow = window.open("", "_blank");
        if (pdfWindow) {
            pdfWindow.document.write("<html><body style='text-align:center; padding:50px; font-family:sans-serif; background:#f4f4f9;'><h2>⏳ Generando Informe...</h2><p>Por favor espere, estamos procesando las imágenes y creando su PDF.</p></body></html>");
        } else {
            alert("⚠️ El navegador bloqueó la ventana emergente. Por favor permita pop-ups para este sitio.");
            return; // Cancelar si no se puede abrir la ventana
        }
    }
    
    const originalText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
    
    try {
        // 1. Recolectar datos del formulario dinámico
        const inputs = document.querySelectorAll("#form-dinamico .doc-input");
        const datosDinamicos = {};
        inputs.forEach(inp => {
            const key = inp.id.replace("dyn_", "");
            datosDinamicos[key] = inp.value;
        });

        // 2. Imágenes
        const cards = document.querySelectorAll("#form-dinamico .photo-card img"); 
        const imgs = [];
        for (let i = 0; i < cards.length; i++) {
            const imgEl = cards[i];
            const card = imgEl.closest('.photo-card');
            const title = card.querySelector(".photo-input-title").value || `Imagen ${i + 1}`;
            const existingId = imgEl.getAttribute("data-fileid");
            
            if (imgEl.src.startsWith("data:")) {
                const compressed = (typeof compressImage === 'function') ? await compressImage(imgEl.src) : imgEl.src;
                imgs.push({ index: i + 1, title: title, data: compressed, isNew: true });
            } else if (existingId) {
                imgs.push({ index: i + 1, title: title, fileId: existingId, isNew: false });
            }
        }

        // 3. PDF Externo
        let pdfFile = null;
        if (!document.getElementById("pdfUploadContainer").classList.contains("hidden")) {
             if (typeof getPdfExternoData === 'function') pdfFile = await getPdfExternoData();
        } else {
             if(window.pdfExternoEliminado) {
                 pdfFile = { delete: true }; 
             }
        }

        const dataObj = {
            id_reporte: currentReportId,
            id_paciente: currentPatientId,
            nombre_paciente: document.getElementById("patientNameDisplay").value,
            tipo_examen: servicio,
            generar_pdf: generatePdf,
            datos_json: datosDinamicos, 
            medicamentos: recetaData ? recetaData.medicamentos : [],
            observaciones_receta: recetaData ? recetaData.observaciones_receta : "",
            imagenes: imgs,
            pdf_externo: pdfFile
        };

        const r = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "save_diagnosis_advanced", data: dataObj })
        });
        const res = await r.json();

        if(res.success) {
            hasUnsavedChanges = false; 
            btn.innerHTML = '<i class="fas fa-check"></i> OK';
            btn.style.background = "#27ae60";
            
            // SI SE PIDIÓ PDF Y TENEMOS VENTANA ABIERTA
            if(generatePdf && pdfWindow) {
                if(res.pdf_url) {
                    console.log("PDF URL recibida:", res.pdf_url);
                    pdfWindow.location.href = res.pdf_url;
                    setTimeout(() => window.location.href = `clinical.html?id=${currentPatientId}`, 2000);
                } else {
                    pdfWindow.close();
                    alert("⚠️ Aviso: Se guardaron los datos pero el servidor no devolvió el enlace del PDF.");
                    window.location.href = `clinical.html?id=${currentPatientId}`;
                }
            } else {
                // SOLO GUARDAR
                 setTimeout(() => {
                    btn.disabled = false; 
                    btn.innerHTML = originalText;
                    btn.style.background = "";
                    alert("Datos guardados correctamente.");
                }, 500);
            }
        } else {
            // ERROR DEL SERVIDOR
            if(pdfWindow) pdfWindow.close();
            alert("❌ ERROR DEL SERVIDOR:\n" + res.message);
            btn.disabled = false; btn.innerHTML = originalText;
        }
    } catch (e) {
        if(pdfWindow) pdfWindow.close();
        console.error(e);
        alert("Error: " + e.message);
        btn.disabled = false; btn.innerHTML = originalText;
    }
}
// Función para leer el archivo PDF externo (si existe)
function getPdfExternoData() {
    return new Promise((resolve) => {
        const input = document.getElementById('pdfExternoFile');
        if (input && input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            // Convertimos el archivo a texto base64 para enviarlo a Google
            reader.onload = (e) => resolve({ 
                name: file.name, 
                mime: file.type, 
                data: e.target.result 
            });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        } else {
            resolve(null); // No hay archivo
        }
    });
}
// Función para mostrar previsualización en formularios dinámicos
window.handleDynamicImages = function(input, containerId) {
    const container = document.getElementById(containerId);
    if (input.files) {
        Array.from(input.files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const div = document.createElement('div');
                div.className = "photo-card dynamic-photo-item"; // Clase clave para guardar después
                div.innerHTML = `
                    <div class="photo-frame">
                        <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <input type="text" class="photo-input-title" placeholder="Descripción (Ej: Ovario Izq)" value="${file.name.split('.')[0]}">
                    <button type="button" onclick="this.parentElement.remove()" style="position:absolute; top:5px; right:5px; background:red; color:white; border:none; border-radius:50%; width:25px; height:25px; cursor:pointer;">&times;</button>
                `;
                container.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    }
};
// --- FUNCIÓN PARA CREAR EL MENÚ BONITO (Custom Select) ---
function initCustomSelect() {
    const originalSelect = document.getElementById("reportTypeSelector");
    if (!originalSelect) return;

    // 1. Evitar duplicados si ya se creó
    const existingWrapper = document.querySelector(".custom-select-wrapper");
    if (existingWrapper) existingWrapper.remove();

    // 2. Crear estructura contenedora
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-wrapper";
    
    // 3. Crear el "Botón" que se ve
    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    // Texto inicial
    const selectedOption = originalSelect.options[originalSelect.selectedIndex];
    trigger.innerHTML = selectedOption ? selectedOption.innerText : "-- Seleccione --";
    
    // 4. Crear la lista desplegable
    const optionsList = document.createElement("div");
    optionsList.className = "custom-options";

    // 5. Copiar opciones del select original al nuevo menú
    Array.from(originalSelect.options).forEach(opt => {
        const div = document.createElement("div");
        div.className = "custom-option";
        div.innerHTML = opt.innerHTML; // Mantiene iconos
        div.dataset.value = opt.value;
        
        // Copiar estilos (colores) del original
        if (opt.style.color) div.style.color = opt.style.color;
        if (opt.style.fontWeight) div.style.fontWeight = opt.style.fontWeight;

        // Si es separador o deshabilitado
        if (opt.disabled) {
            div.classList.add("separator");
        } else {
            // Evento Click
            div.addEventListener("click", () => {
                trigger.innerHTML = opt.innerHTML;
                originalSelect.value = opt.value;
                
                // Disparar evento change manualmente para que toggleForm funcione
                originalSelect.dispatchEvent(new Event('change'));
                
                optionsList.classList.remove("open");
                
                // Visual selected state
                document.querySelectorAll(".custom-option").forEach(c => c.classList.remove("selected"));
                div.classList.add("selected");
            });
        }
        optionsList.appendChild(div);
    });

    // 6. Eventos Abrir/Cerrar
    trigger.addEventListener("click", (e) => {
        e.stopPropagation(); // Evita que se cierre inmediatamente
        optionsList.classList.toggle("open");
    });

    // Cerrar al hacer clic fuera
    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            optionsList.classList.remove("open");
        }
    });

    // 7. Insertar en el DOM
    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsList);
    originalSelect.parentNode.insertBefore(wrapper, originalSelect);
}
// ==========================================
// 6. SISTEMA DE PROTECCIÓN DE CAMBIOS (NUEVO)
// ==========================================

function activateChangeDetection() {
    // 1. Detectar cambios en cualquier input, select o textarea
    const inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach(input => {
        // Evitamos duplicar listeners
        if(input.dataset.watching) return;
        
        input.dataset.watching = "true";
        input.addEventListener('input', () => { hasUnsavedChanges = true; });
        input.addEventListener('change', () => { hasUnsavedChanges = true; });
    });
}

// 2. Interceptar el botón "Volver" del Sidebar
document.addEventListener("DOMContentLoaded", () => {
    const btnBack = document.querySelector(".btn-back-sidebar");
    if(btnBack) {
        btnBack.addEventListener("click", (e) => {
            if (hasUnsavedChanges) {
                // El mensaje que pediste:
                const confirmar = confirm("⚠️ No se han guardado los datos.\n¿Desea salir de todas maneras?");
                if (!confirmar) {
                    e.preventDefault(); // CANCELA LA SALIDA
                }
            }
        });
    }
});

// 3. Interceptar cierre de pestaña o recarga (Navegador)
window.addEventListener("beforeunload", (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ""; // Necesario para Chrome/Edge
    }
});