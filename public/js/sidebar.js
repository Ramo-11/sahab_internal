// Sidebar JavaScript
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    updateNotificationBadges();
});

// Initialize sidebar
function initSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggle && sidebar) {
        // Toggle sidebar on mobile
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        // Close sidebar when clicking overlay
        overlay?.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Highlight active page
    highlightActivePage();
}

// Highlight active page in navigation
function highlightActivePage() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach((link) => {
        link.classList.remove('active');
        const href = link.getAttribute('href');

        if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
            link.classList.add('active');
        } else if (href === '/' && currentPath === '/') {
            link.classList.add('active');
        }
    });
}

// Update notification badges
async function updateNotificationBadges() {
    try {
        const alerts = await API.dashboard.getAlerts();

        if (alerts.success) {
            const data = alerts.data;

            // Count by category
            const counts = {
                proposals: data.filter((a) => a.category === 'proposal').length,
                invoices: data.filter((a) => a.category === 'invoice').length,
            };

            // Update badges
            updateBadge('proposals', counts.proposals);
            updateBadge('invoices', counts.invoices);
        }
    } catch (error) {
        console.error('Failed to update badges:', error);
    }
}

// Update individual badge
function updateBadge(section, count) {
    const link = document.querySelector(`.nav-link[href="/${section}"]`);
    if (!link) return;

    let badge = link.querySelector('.nav-badge');

    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'nav-badge';
            link.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : count;
    } else if (badge) {
        badge.remove();
    }
}
