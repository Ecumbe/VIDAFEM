// js/sidebar.js
document.addEventListener('DOMContentLoaded', () => {
    
    const sidebar = document.getElementById('sidebar');
    const toggleDesktop = document.getElementById('toggleDesktop'); // Flecha PC
    const toggleMobile = document.getElementById('toggleMobile');   // Hamburguesa Móvil
    const overlay = document.getElementById('overlay');

    // --- MODO ESCRITORIO: Colapsar / Expandir ---
    if (toggleDesktop) {
        toggleDesktop.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // --- MODO MÓVIL: Abrir / Cerrar menú completo ---
    function toggleMobileMenu() {
        sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
    }

    if (toggleMobile) {
        toggleMobile.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileMenu();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // --- ACTIVAR ENLACE ACTUAL ---
    const currentPath = window.location.pathname.split("/").pop();
    const menuLinks = document.querySelectorAll('.menu-link');
    menuLinks.forEach(link => {
        if(link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
});