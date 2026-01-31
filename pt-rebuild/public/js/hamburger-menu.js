/**
 * Shared Hamburger Menu Component
 *
 * Provides consistent hamburger menu functionality across all PT Tracker pages.
 * Uses data-action pattern for iOS Safari/PWA compatibility.
 *
 * Usage:
 * 1. Include the CSS styles in your page (or link shared-hamburger.css)
 * 2. Add the hamburger HTML structure
 * 3. Import this module: <script src="/js/hamburger-menu.js"></script>
 * 4. Call HamburgerMenu.init({ currentUser, signOutFn, ... })
 */

const HamburgerMenu = {
    config: {
        currentUser: null,
        signOutFn: null,
        onAction: null // Custom action handler
    },

    /**
     * Initialize the hamburger menu component.
     * @param {Object} options - Configuration options
     * @param {Object} options.currentUser - Current user object with email
     * @param {Function} options.signOutFn - Function to call for sign out
     * @param {Function} options.onAction - Optional custom action handler
     */
    init(options = {}) {
        this.config = { ...this.config, ...options };
        this.bindHandlers();
        this.updateUserDisplay();
    },

    /**
     * Toggle hamburger menu visibility.
     */
    toggle() {
        const overlay = document.getElementById('hamburgerOverlay');
        const menu = document.getElementById('hamburgerMenu');
        if (overlay && menu) {
            overlay.classList.toggle('active');
            menu.classList.toggle('active');
        }
    },

    /**
     * Close the hamburger menu.
     */
    close() {
        const overlay = document.getElementById('hamburgerOverlay');
        const menu = document.getElementById('hamburgerMenu');
        if (overlay) overlay.classList.remove('active');
        if (menu) menu.classList.remove('active');
    },

    /**
     * Update user info display in hamburger menu.
     */
    updateUserDisplay() {
        const emailEl = document.getElementById('userEmail');
        const patientLink = document.getElementById('patientTrackerLink');
        const user = this.config.currentUser;

        if (emailEl && user) {
            emailEl.textContent = user.email || 'Unknown';
        }

        // Show PT Tracker link for patients
        if (patientLink && user) {
            const isPatient = user.user_metadata?.patient_id ||
                              user.app_metadata?.role === 'patient';
            patientLink.style.display = isPatient ? 'flex' : 'none';
        }
    },

    /**
     * Bind iOS-safe pointer event handlers to elements with data-action attributes.
     * iOS Safari/PWA does not reliably trigger onclick on dynamically created elements.
     *
     * @param {HTMLElement} root - Root element to search (default: document)
     */
    bindHandlers(root = document) {
        const actionElements = root.querySelectorAll('[data-action]');

        actionElements.forEach(el => {
            if (el.dataset.hamburgerBound) return;
            el.dataset.hamburgerBound = 'true';

            el.addEventListener('pointerup', (e) => this.handleAction(e));
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleAction(e);
                }
            });
        });
    },

    /**
     * Handle data-action events from pointer/keyboard interactions.
     * @param {Event} e - The triggering event
     */
    handleAction(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;

        // Check for custom handler first
        if (this.config.onAction) {
            const handled = this.config.onAction(action, target, e);
            if (handled) return;
        }

        // Default handlers for common actions
        switch (action) {
            case 'toggle-hamburger':
                this.toggle();
                break;
            case 'sign-out':
                this.close();
                if (this.config.signOutFn) {
                    this.config.signOutFn();
                }
                break;
            case 'reload':
                this.close();
                location.reload();
                break;
        }
    }
};

// Auto-bind on DOMContentLoaded if elements exist
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('hamburgerMenu')) {
        HamburgerMenu.bindHandlers();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HamburgerMenu;
}
