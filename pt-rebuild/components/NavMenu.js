/**
 * NavMenu — shared navigation sidebar component.
 *
 * Pure React — no window.HamburgerMenu, no globals, no Script tags.
 * Every Next.js page uses this instead of the legacy HamburgerMenu.init() pattern.
 *
 * Renders three things:
 *   1. The ☰ trigger button (place inside your header-actions div)
 *   2. A background overlay (fixed, dims the page)
 *   3. The slide-in panel (fixed, right side)
 *
 * CSS comes from /css/rehab-coverage.css (hamburger-* classes).
 * TODO: Move hamburger CSS to main.css when more pages are migrated.
 *
 * Usage:
 *   <NavMenu
 *     user={session.user}
 *     isAdmin={userRole !== 'patient'}
 *     onSignOut={signOut}
 *     currentPage="rehab_coverage"
 *     actions={[{ action: 'refresh-data', icon: '🔄', label: 'Refresh Data' }]}
 *     onAction={(action) => { if (action === 'refresh-data') loadData(); }}
 *   />
 *
 * @param {{
 *   user: object,          Supabase user object (has .email)
 *   isAdmin: boolean,      true for therapist/admin — shows admin-only nav items
 *   onSignOut: function,   () => void — called on sign-out tap
 *   currentPage: string,   NAV_PAGES id — highlights current page, hides it from links
 *   actions: Array,        [{action, icon, label}] page-specific items above nav links
 *   onAction: function,    (action: string) => void — called when a page action is tapped
 * }} props
 */
import { useState } from 'react';

/**
 * All pages in the app.
 * Use HTML paths for unmigrated pages, Next.js routes for migrated ones.
 * adminOnly: true hides the link from patient-role users.
 *
 * Update hrefs here as pages are migrated (e.g., pt_view.html → /pt-view).
 */
const NAV_PAGES = [
    { id: 'index',          href: '/index.html',          label: '📱 PT Tracker',       adminOnly: false },
    { id: 'pt_view',        href: '/pt_view.html',        label: '📊 View History',      adminOnly: false },
    { id: 'pt_editor',      href: '/pt_editor.html',      label: '✏️ Exercise Editor',   adminOnly: true  },
    { id: 'rehab_coverage', href: '/rehab',               label: '📈 Coverage Analysis', adminOnly: false },
];

export default function NavMenu({ user, isAdmin, onSignOut, currentPage, actions = [], onAction }) {
    const [isOpen, setIsOpen] = useState(false);

    function open()  { setIsOpen(true);  }
    function close() { setIsOpen(false); }
    function toggle() { setIsOpen(o => !o); }

    async function handleSignOut() {
        close();
        if (onSignOut) await onSignOut();
    }

    function handleAction(action) {
        close();
        if (onAction) onAction(action);
    }

    // Exclude the current page from nav links; hide admin-only links for patients
    const navLinks = NAV_PAGES.filter(p =>
        p.id !== currentPage && (!p.adminOnly || isAdmin)
    );

    return (
        <>
            {/* Trigger button — rendered inline, place inside header-actions */}
            <button
                className="hamburger-btn"
                onPointerUp={toggle}
                aria-label="Open menu"
                aria-expanded={isOpen}
                aria-controls="hamburgerMenu"
            >
                ☰
            </button>

            {/* Background overlay — tap to close */}
            <div
                className={`hamburger-overlay ${isOpen ? 'active' : ''}`}
                onPointerUp={close}
                aria-hidden="true"
            />

            {/* Slide-in panel */}
            <nav
                id="hamburgerMenu"
                className={`hamburger-menu ${isOpen ? 'active' : ''}`}
                aria-label="Site navigation"
            >
                <div className="hamburger-header">
                    <h3>Menu</h3>
                    <button
                        className="hamburger-close"
                        onPointerUp={close}
                        aria-label="Close menu"
                    >
                        Close
                    </button>
                </div>

                {/* User info */}
                {user && (
                    <div className="hamburger-user-info">
                        <strong>{isAdmin ? 'Therapist' : 'Patient'}</strong>
                        {user.email}
                    </div>
                )}

                {/* Page-specific actions (e.g. Refresh Data) */}
                {actions.map(item => (
                    <button
                        key={item.action}
                        className="hamburger-item"
                        onPointerUp={() => handleAction(item.action)}
                    >
                        <span className="hamburger-icon">{item.icon}</span>
                        {item.label}
                    </button>
                ))}

                {/* Nav links to other pages */}
                {navLinks.map(page => (
                    <a key={page.id} className="hamburger-item" href={page.href}>
                        {page.label}
                    </a>
                ))}

                {/* Sign out */}
                <button className="hamburger-item" onPointerUp={handleSignOut}>
                    <span className="hamburger-icon">🚪</span>
                    Sign Out
                </button>
            </nav>
        </>
    );
}
