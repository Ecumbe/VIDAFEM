// js/auth.js

// Verificamos si estamos en la página que tiene el formulario Login
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault(); 

        const usuarioInput = document.getElementById('usuario').value;
        const passwordInput = document.getElementById('password').value;
        const btnLogin = document.getElementById('btnLogin');
        const mensajeEstado = document.getElementById('mensajeEstado');

        // 1. Interfaz: Mostrar estado "Cargando"
        btnLogin.disabled = true;
        btnLogin.textContent = "Cargando...";
        if(mensajeEstado) {
            mensajeEstado.style.color = "#666";
            mensajeEstado.textContent = MESSAGES.loading;
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
                if(mensajeEstado) {
                    mensajeEstado.style.color = "green";
                    mensajeEstado.textContent = MESSAGES.success;
                }
                
                // Guardar sesión
                localStorage.setItem("vidafem_session", JSON.stringify(data));

                // Redirección
                setTimeout(() => {
                    window.location.href = "admin.html"; // Por ahora todos van a admin
                }, 1000);

            } else {
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
                mensajeEstado.textContent = MESSAGES.error;
            }
            btnLogin.disabled = false;
            btnLogin.textContent = "INGRESAR";
        });
    });
}