// js/sidebar.js - CONTROL DEL MENÚ LATERAL (MEJORADO)

document.addEventListener('DOMContentLoaded', () => {
    
    const sidebar = document.getElementById('sidebar');
    const toggleDesktop = document.getElementById('toggleDesktop'); // Flecha PC
    const toggleMobile = document.getElementById('toggleMobile');   // Hamburguesa Móvil
    const overlay = document.getElementById('overlay');
    const menuLinks = document.querySelectorAll('.menu-link');      // Todos los enlaces del menú

    // --- FUNCIONES AUXILIARES ---
    
    function collapseSidebar() {
        // Solo aplica en escritorio para "encoger" el menú
        if (sidebar && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
        }
    }

    function closeMobileMenu() {
        // Cierra el menú completamente en móvil
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }

    function toggleMobileState() {
        if (sidebar) sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
    }

    // --- 1. EVENTOS DE LOS BOTONES DE APERTURA/CIERRE ---

    // Modo Escritorio: Colapsar / Expandir manual
    if (toggleDesktop) {
        toggleDesktop.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // Modo Móvil: Abrir / Cerrar menú completo
    if (toggleMobile) {
        toggleMobile.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileState();
        });
    }

    // Cerrar al dar clic en el fondo oscuro (Overlay)
    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }

    // --- 2. MEJORA: CERRAR AUTOMÁTICAMENTE AL ELEGIR UNA OPCIÓN ---
    menuLinks.forEach(link => {
        // Lógica visual: Activar enlace actual (bold/color)
        const currentPath = window.location.pathname.split("/").pop();
        // Si el enlace coincide con la url actual O si es un link interno (href="#") que acabamos de clicar
        if(link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }

        // Lógica funcional: CERRAR AL CLIC
        link.addEventListener('click', () => {
            // Si estamos en MÓVIL (ancho menor a 900px) -> Ocultar menú
            if (window.innerWidth <= 900) {
                closeMobileMenu();
            }
            // Opcional: Si quieres que en PC también se encoja al dar clic, descomenta la siguiente línea:
            // else { collapseSidebar(); }
        });
    });

    // --- 3. MEJORA: AUTO-COLAPSO AL CARGAR (TEMPORIZADOR 1 SEGUNDO) ---
    setTimeout(() => {
        if (window.innerWidth > 900) {
            // EN PC: Se "encoge" para dar más espacio
            collapseSidebar();
        } else {
            // EN MÓVIL: Se asegura de estar cerrado
            closeMobileMenu();
        }
    }, 1000); // 1000 milisegundos = 1 segundo

});
// ==========================================
    // 4. LÓGICA GLOBAL DE CERRAR SESIÓN (LOGOUT)
    // ==========================================
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        // Clonamos el elemento para eliminar listeners viejos duplicados si existieran
        const newBtn = btnLogout.cloneNode(true);
        btnLogout.parentNode.replaceChild(newBtn, btnLogout);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                localStorage.removeItem("vidafem_session");
                window.location.href = "index.html";
            }
        });
    }