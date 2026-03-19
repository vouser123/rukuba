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
 * Styles are scoped via NavMenu.module.css (CSS Modules).
 * CSS variables (colors, spacing) come from styles/globals.css via _app.js.
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
import styles from './NavMenu.module.css';

/**
 * All pages in the app.
 * Use HTML paths for unmigrated pages, Next.js routes for migrated ones.
 * adminOnly: true hides the link from patient-role users.
 *
 * Update hrefs here as pages are migrated (e.g., pt_view.html → /pt-view).
 */
const NAV_PAGES = [
    { id: 'index',          href: '/',                    label: '📱 PT Tracker',       adminOnly: false },
    { id: 'pt_view',        href: '/pt-view',              label: '📊 View History',      adminOnly: false },
    { id: 'pt_editor',      href: '/program',             label: '📋 Program Editor',    adminOnly: true  },
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

    function handleRefresh() {
        close();
        window.location.reload();
    }

    // Exclude the current page from nav links; hide admin-only links for patients
    const navLinks = NAV_PAGES.filter(p =>
        p.id !== currentPage && (!p.adminOnly || isAdmin)
    );

    return (
        <>
            {/* Trigger button — rendered inline, place inside header-actions */}
            <button
                className={styles['hamburger-btn']}
                onPointerUp={toggle}
                aria-label="Open menu"
                aria-expanded={isOpen}
                aria-controls="hamburgerMenu"
            >
                ☰
            </button>

            {/* Background overlay — tap to close */}
            <div
                className={`${styles['hamburger-overlay']} ${isOpen ? styles.active : ''}`}
                onPointerUp={close}
                aria-hidden="true"
            />

            {/* Slide-in panel */}
            <nav
                id="hamburgerMenu"
                className={`${styles['hamburger-menu']} ${isOpen ? styles.active : ''}`}
                aria-label="Site navigation"
            >
                <div className={styles['hamburger-header']}>
                    <h3>Menu</h3>
                    <button
                        className={styles['hamburger-close']}
                        onPointerUp={close}
                        aria-label="Close menu"
                    >
                        Close
                    </button>
                </div>

                {/* User info */}
                {user && (
                    <div className={styles['hamburger-user-info']}>
                        {/* Always "Signed in as" — matches vanilla JS hamburger-menu.js. Do NOT change to role name. */}
                        <strong>Signed in as</strong>
                        {user.email}
                    </div>
                )}

                {/* Page-specific actions (e.g. Refresh Data) */}
                {actions.map(item => (
                    <button
                        key={item.action}
                        className={styles['hamburger-item']}
                        onPointerUp={() => handleAction(item.action)}
                    >
                        <span className={styles['hamburger-icon']}>{item.icon}</span>
                        {item.label}
                    </button>
                ))}

                {/* Refresh — always present; reloads the page to re-fetch latest data */}
                <button className={styles['hamburger-item']} onPointerUp={handleRefresh}>
                    <span className={styles['hamburger-icon']}>🔄</span>
                    Refresh
                </button>

                {/* Nav links to other pages */}
                {navLinks.map(page => (
                    <a key={page.id} className={styles['hamburger-item']} href={page.href}>
                        {page.label}
                    </a>
                ))}

                {/* Sign out */}
                <button className={styles['hamburger-item']} onPointerUp={handleSignOut}>
                    <span className={styles['hamburger-icon']}>🚪</span>
                    Sign Out
                </button>
            </nav>
        </>
    );
}
