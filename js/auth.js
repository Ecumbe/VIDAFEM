// js/auth.js - Control de Acceso (Versión Unificada)

// Verificamos si estamos en la página que tiene el formulario Login
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault(); 

        const usuarioInput = document.getElementById('usuario').value.trim();
        const passwordInput = document.getElementById('password').value.trim();
        const btnLogin = document.getElementById('btnLogin');
        const mensajeEstado = document.getElementById('mensajeEstado');

        // 1. Interfaz: Mostrar estado "Cargando"
        btnLogin.disabled = true;
        btnLogin.textContent = "VERIFICANDO...";
        if(mensajeEstado) {
            mensajeEstado.style.color = "#666";
            mensajeEstado.textContent = "Conectando con el servidor...";
        }

        // 2. Preparar los datos
        const datos = {
            action: "login",
            usuario: usuarioInput,
            password: passwordInput
        };

        // 3. Conexión con Google Apps Script
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(datos)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // ÉXITO
                if(mensajeEstado) {
                    mensajeEstado.style.color = "green";
                    mensajeEstado.textContent = "¡Bienvenido! Redirigiendo...";
                }
                
                // Guardar sesión completa (incluye el rol)
                localStorage.setItem("vidafem_session", JSON.stringify(data));

                // 4. REDIRECCIÓN INTELIGENTE SEGÚN EL ROL
                setTimeout(() => {
                    if (data.role === 'paciente') {
                        // Si es paciente, va a su portal exclusivo
                        window.location.href = "paciente.html";
                    } else {
                        // Si es admin/doctor, va al panel médico
                        window.location.href = "admin.html";
                    }
                }, 1000); // Pequeña espera para que lea el mensaje de éxito

            } else {
                // ERROR (Credenciales incorrectas)
                if(mensajeEstado) {
                    mensajeEstado.style.color = "red";
                    mensajeEstado.textContent = data.message;
                }
                btnLogin.disabled = false;
                btnLogin.textContent = "INGRESAR";
            }
        })
        .catch(error => {
            console.error("Error:", error);
            if(mensajeEstado) {
                mensajeEstado.style.color = "red";
                mensajeEstado.textContent = "Error de conexión. Intente nuevamente.";
            }
            btnLogin.disabled = false;
            btnLogin.textContent = "INGRESAR";
        });
    });
}