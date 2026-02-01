/**
 * Shared authentication module for PT Tracker pages.
 * Handles login, password reset, and auth state changes.
 *
 * Usage:
 *   <script src="/js/auth.js"></script>
 *   <script>
 *     Auth.init(supabaseClient, {
 *       onSignedIn: async (session) => { ... },
 *       onSignedOut: () => { ... },
 *       onPasswordUpdated: () => { showToast('Password updated!', 'success'); }
 *     });
 *   </script>
 */

window.Auth = (function() {
    let _supabaseClient = null;
    let _callbacks = {};

    /**
     * Initialize the auth module.
     * @param {object} supabaseClient - The Supabase client instance
     * @param {object} callbacks - Page-specific callbacks
     * @param {function} callbacks.onSignedIn - Called with (session) when user signs in
     * @param {function} callbacks.onSignedOut - Called when user signs out
     * @param {function} callbacks.onPasswordUpdated - Called after password is successfully updated
     */
    function init(supabaseClient, callbacks = {}) {
        _supabaseClient = supabaseClient;
        _callbacks = callbacks;

        // Set up auth state listener
        _supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                hideAuthModal();
                hideForgotPasswordModal();
                showNewPasswordModal();
            } else if (event === 'SIGNED_IN') {
                hideAuthModal();
                hideNewPasswordModal();
                if (_callbacks.onSignedIn) {
                    await _callbacks.onSignedIn(session);
                }
            } else if (event === 'SIGNED_OUT') {
                showAuthModal();
                if (_callbacks.onSignedOut) {
                    _callbacks.onSignedOut();
                }
            }
        });

        // Bind auth event handlers
        bindAuthEventHandlers();
    }

    // Modal functions
    function showAuthModal() {
        document.getElementById('authModal')?.classList.remove('hidden');
    }

    function hideAuthModal() {
        document.getElementById('authModal')?.classList.add('hidden');
    }

    function showForgotPasswordModal() {
        hideAuthModal();
        document.getElementById('forgotPasswordModal')?.classList.remove('hidden');
    }

    function hideForgotPasswordModal() {
        document.getElementById('forgotPasswordModal')?.classList.add('hidden');
    }

    function showNewPasswordModal() {
        document.getElementById('newPasswordModal')?.classList.remove('hidden');
    }

    function hideNewPasswordModal() {
        document.getElementById('newPasswordModal')?.classList.add('hidden');
    }

    // Auth functions
    async function signIn(email, password) {
        const { data, error } = await _supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        return data;
    }

    async function requestPasswordReset(email) {
        const { error } = await _supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });
        return { error };
    }

    async function updatePassword(newPassword) {
        const { error } = await _supabaseClient.auth.updateUser({ password: newPassword });
        return { error };
    }

    // Bind auth-related event handlers
    function bindAuthEventHandlers() {
        // Auth form
        const authForm = document.getElementById('authForm');
        if (authForm) {
            authForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('emailInput').value;
                const password = document.getElementById('passwordInput').value;
                const errorEl = document.getElementById('authError');

                try {
                    await signIn(email, password);
                    errorEl.textContent = '';
                } catch (error) {
                    errorEl.textContent = error.message;
                }
            });
        }

        // Forgot password link
        const forgotLink = document.getElementById('forgotPasswordLink');
        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                showForgotPasswordModal();
            });
        }

        // Back to login link
        const backLink = document.getElementById('backToLoginLink');
        if (backLink) {
            backLink.addEventListener('click', (e) => {
                e.preventDefault();
                hideForgotPasswordModal();
                showAuthModal();
            });
        }

        // Forgot password form
        const forgotForm = document.getElementById('forgotPasswordForm');
        if (forgotForm) {
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('resetEmailInput').value;
                const errorEl = document.getElementById('resetError');
                const submitBtn = e.target.querySelector('button[type="submit"]');

                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';

                try {
                    const { error } = await requestPasswordReset(email);
                    if (error) throw error;
                    errorEl.style.color = '#28a745';
                    errorEl.textContent = 'Check your email for the reset link.';
                } catch (error) {
                    errorEl.style.color = '';
                    errorEl.textContent = error.message;
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Reset Link';
                }
            });
        }

        // New password form
        const newPwForm = document.getElementById('newPasswordForm');
        if (newPwForm) {
            newPwForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newPassword = document.getElementById('newPasswordInput').value;
                const confirmPassword = document.getElementById('confirmPasswordInput').value;
                const errorEl = document.getElementById('newPasswordError');

                if (newPassword !== confirmPassword) {
                    errorEl.textContent = 'Passwords do not match.';
                    return;
                }

                const submitBtn = e.target.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';

                try {
                    const { error } = await updatePassword(newPassword);
                    if (error) throw error;
                    hideNewPasswordModal();
                    if (_callbacks.onPasswordUpdated) {
                        _callbacks.onPasswordUpdated();
                    } else if (typeof showToast === 'function') {
                        showToast('Password updated successfully!', 'success');
                    }
                } catch (error) {
                    errorEl.textContent = error.message;
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Update Password';
                }
            });
        }
    }

    // Public API
    return {
        init,
        showAuthModal,
        hideAuthModal,
        showForgotPasswordModal,
        hideForgotPasswordModal,
        showNewPasswordModal,
        hideNewPasswordModal,
        signIn,
        requestPasswordReset,
        updatePassword
    };
})();
