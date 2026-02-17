let supabaseClient = null;

let currentUser = null;
let authToken = null;
let allExercises = [];
let currentExercise = null;
let vocabularies = {};
let referenceData = { equipment: [], muscles: [], formParameters: [] };

// Tag arrays
let requiredEquipment = [];
let optionalEquipment = [];
let primaryMuscles = [];
let secondaryMuscles = [];
let formParameters = [];
let motorCues = [];
let compensationWarnings = [];
let safetyFlags = [];
let externalCues = [];

async function loadSupabaseConfig() {
    try {
        const response = await fetch('/api/env');

        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        throw new Error('Failed to load Supabase config from /api/env. Check server status.');
    }
}

function readAuthParams() {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
        return { accessToken, refreshToken, source: 'url' };
    }

    const storedAuth = readStoredAuth();
    if (storedAuth?.accessToken && storedAuth?.refreshToken) {
        return { ...storedAuth, source: 'storage' };
    }

    return { accessToken: null, refreshToken: null, source: null };
}

function clearAuthParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('access_token');
    url.searchParams.delete('refresh_token');
    const newUrl = url.pathname + url.search + url.hash;
    window.history.replaceState({}, '', newUrl);
}

function readStoredAuth() {
    try {
        const raw = localStorage.getItem('pt_editor_auth');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return {
            accessToken: parsed.access_token || parsed.accessToken || null,
            refreshToken: parsed.refresh_token || parsed.refreshToken || null
        };
    } catch (error) {
        return null;
    }
}

function clearStoredAuth() {
    try {
        localStorage.removeItem('pt_editor_auth');
    } catch (error) {
        // Ignore storage errors
    }
}

// Initialize
async function init() {
    const { supabaseUrl, supabaseAnonKey, warning } = await loadSupabaseConfig();

    if (!window.supabase?.createClient) {
        throw new Error('Supabase SDK failed to load. Check CDN access or CSP.');
    }

    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

    if (warning) {
        showBootError(warning);
    }

    const { accessToken, refreshToken, source } = readAuthParams();
    let sessionHandled = false;

    if (accessToken && refreshToken) {
        const { data, error } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        if (source === 'url') {
            clearAuthParams();
        }
        if (source === 'storage') {
            clearStoredAuth();
        }

        if (error) {
            const errorDiv = document.getElementById('authError');
            errorDiv.textContent = `Token sign-in failed: ${error.message}`;
            errorDiv.classList.remove('hidden');
            showAuthAlert('PT Editor token sign-in failed', [
                `Message: ${error.message}`,
                `Source: ${source || 'none'}`,
                `Location: ${window.location.href}`
            ].join('\n'));
        } else if (data.session) {
            await handleAuthSuccess(data.session);
            sessionHandled = true;
        }
    }

    // Check for existing session
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session && !sessionHandled) {
        await handleAuthSuccess(session);
    }

    // Set up auth form
    document.getElementById('authForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await signIn();
    });

    // Set up exercise form
    document.getElementById('exerciseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveExercise();
    });

    // Set up New button (clear form to add new exercise)
    const newBtn = document.querySelector('[data-action="clear-form"]');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            clearForm();
        });
    }

    // Auto-populate end date when archived is selected
    const lifecycleSelect = document.getElementById('lifecycleStatus');
    if (lifecycleSelect) {
        lifecycleSelect.addEventListener('change', () => {
            const endDateInput = document.getElementById('effectiveEndDate');
            if (lifecycleSelect.value === 'archived' && endDateInput && !endDateInput.value) {
                // Set to today's date in YYYY-MM-DD format
                endDateInput.value = new Date().toISOString().split('T')[0];
            }
        });
    }

    // Bind iOS-safe pointerup handlers for all data-action elements
    bindPointerHandlers();

    // Bind input/change events for search and select elements
    bindInputHandlers();
}

/**
 * Bind input/change event handlers for search and select elements.
 * Separating from pointerup handlers since these are different event types.
 */
function bindInputHandlers() {
    // Exercise search and select (main form)
    const exerciseSearch = document.getElementById('exerciseSearch');
    if (exerciseSearch) {
        exerciseSearch.addEventListener('input', () => filterExercises());
    }
    const exerciseSelect = document.getElementById('exerciseSelect');
    if (exerciseSelect) {
        exerciseSelect.addEventListener('change', () => loadExerciseForEdit());
    }

    // Role exercise search and select
    const roleExerciseSearch = document.getElementById('roleExerciseSearch');
    if (roleExerciseSearch) {
        roleExerciseSearch.addEventListener('input', () => filterRoleExercises());
    }
    const roleExerciseSelect = document.getElementById('roleExerciseSelect');
    if (roleExerciseSelect) {
        roleExerciseSelect.addEventListener('change', () => loadExerciseRoles());
    }

    // Dosage exercise search and select
    const dosageExerciseSearch = document.getElementById('dosageExerciseSearch');
    if (dosageExerciseSearch) {
        dosageExerciseSearch.addEventListener('input', () => filterDosageExercises());
    }
    const dosageExerciseSelect = document.getElementById('dosageExerciseSelect');
    if (dosageExerciseSelect) {
        dosageExerciseSelect.addEventListener('change', () => loadExerciseDosage());
    }

    // Pattern modifiers: duration_seconds and hold_seconds are mutually exclusive
    const modDuration = document.getElementById('modDuration');
    const modHold = document.getElementById('modHold');
    if (modDuration && modHold) {
        modDuration.addEventListener('change', () => {
            if (modDuration.checked) modHold.checked = false;
        });
        modHold.addEventListener('change', () => {
            if (modHold.checked) modDuration.checked = false;
        });
    }

    // Vocab category selector
    const vocabCategory = document.getElementById('vocabCategory');
    if (vocabCategory) {
        vocabCategory.addEventListener('change', () => loadVocabTerms());
    }
}

/**
 * Bind iOS-safe pointer event handlers to elements with data-action attributes.
 * iOS Safari/PWA does not reliably trigger onclick handlers on dynamically created elements.
 * This binds pointerup events (which work consistently on iOS touch and desktop mouse).
 */
function bindPointerHandlers(root = document) {
    root.querySelectorAll('[data-action]').forEach(el => {
        if (el.dataset.pointerBound) return; // Prevent double-binding
        el.dataset.pointerBound = 'true';

        el.addEventListener('pointerup', (e) => {
            e.preventDefault();
            handleAction(el);
        });

        // Keyboard accessibility (Enter/Space)
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAction(el);
            }
        });
    });
}

/**
 * Handle data-action events from buttons.
 * @param {HTMLElement} el - The element that triggered the action
 */
function handleAction(el) {
    const action = el.dataset.action;
    switch (action) {
        case 'addRequiredEquipment':
            addRequiredEquipment();
            break;
        case 'addOptionalEquipment':
            addOptionalEquipment();
            break;
        case 'addPrimaryMuscle':
            addPrimaryMuscle();
            break;
        case 'addSecondaryMuscle':
            addSecondaryMuscle();
            break;
        case 'addFormParameter':
            addFormParameter();
            break;
        case 'addMotorCue':
            addMotorCue();
            break;
        case 'addCompensationWarning':
            addCompensationWarning();
            break;
        case 'addSafetyFlag':
            addSafetyFlag();
            break;
        case 'addExternalCue':
            addExternalCue();
            break;
        case 'addRoleRow':
            addRoleRow();
            break;
        case 'clearForm':
        case 'clear-form':
            clearForm();
            break;
        case 'addRoleToExercise':
            addRoleToExercise();
            break;
        case 'updateDosage':
            updateDosage();
            break;
        case 'removeTag':
            removeTag(el.dataset.container, parseInt(el.dataset.index));
            break;
        case 'removeGuidance':
            removeGuidance(el.dataset.container, parseInt(el.dataset.index));
            break;
        case 'removeRoleRow':
            removeRoleRow(el);
            break;
        case 'removeRole':
            removeRole(el.dataset.roleId);
            break;
        case 'addVocabTerm':
            addVocabTerm();
            break;
        case 'saveVocabEdit':
            saveVocabEdit();
            break;
        case 'cancelVocabEdit':
            closeVocabEditModal();
            break;
        case 'deleteVocabTerm':
            deleteVocabTerm();
            break;
        case 'editVocab':
            openVocabEditModal(el.dataset.code, el.dataset.definition);
            break;
        default:
            console.warn('Unknown action:', action);
    }
}

async function signIn() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('authError');
    const submitButton = document.querySelector('#authForm button[type="submit"]');

    errorDiv.classList.add('hidden');
    submitButton.disabled = true;
    submitButton.textContent = 'Signing in...';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        if (!data?.session) {
            throw new Error('Sign-in succeeded but no session was returned.');
        }

        await handleAuthSuccess(data.session);
    } catch (error) {
        const errorMessage = error.message || 'Sign in failed';
        errorDiv.textContent = errorMessage;
        errorDiv.classList.remove('hidden');
        showAuthAlert('PT Editor sign-in failed', [
            `Message: ${errorMessage}`,
            `Email: ${email || '(empty)'}`,
            `Online: ${navigator.onLine}`,
            `Location: ${window.location.href}`
        ].join('\n'));
        submitButton.disabled = false;
        submitButton.textContent = 'Sign In';
    }
}

async function handleAuthSuccess(session) {
    const errorDiv = document.getElementById('authError');
    currentUser = session.user;
    authToken = session.access_token;

    try {
        // Verify therapist or admin role
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('role')
            .eq('auth_id', currentUser.id)
            .single();

        if (userError) {
            throw new Error(`Database error: ${userError.message}`);
        }

        if (!userData) {
            throw new Error('User not found in database. Please contact administrator.');
        }

        if (userData.role !== 'therapist' && userData.role !== 'admin') {
            throw new Error(`Access denied. Your role is "${userData.role}". Required: therapist or admin.`);
        }

        // Success! Show main content
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');

        // Check if user has programs assigned (they're also a patient)
        // Pass the auth_id - the API's resolvePatientId() will map it to the users.id
        let showTrackerLink = false;
        try {
            const programsResponse = await fetchWithAuth(`/api/programs?patient_id=${currentUser.id}`);
            const programs = programsResponse.programs || [];
            showTrackerLink = programs.length > 0;
        } catch (e) {
            // If programs fetch fails, default to not showing the link
            console.warn('Could not check for patient programs:', e);
        }

        // Initialize hamburger menu with user info
        if (typeof HamburgerMenu !== 'undefined') {
            HamburgerMenu.init({
                currentUser: currentUser,
                signOutFn: signOut,
                showTrackerLink: showTrackerLink,
                onAction: (action) => {
                    if (action === 'clear-form') {
                        clearForm();
                        return true;
                    }
                    return false;
                }
            });
        }

        // Load data
        await loadVocabularies();
        await loadReferenceData();
        await loadExercises();

    } catch (error) {
        // Show error - don't sign out, let them try again
        errorDiv.textContent = error.message;
        errorDiv.classList.remove('hidden');
        showAuthAlert('PT Editor access check failed', [
            `Message: ${error.message || 'Unknown error'}`,
            `User ID: ${currentUser?.id || 'unknown'}`,
            `Email: ${currentUser?.email || 'unknown'}`
        ].join('\n'));

        // Reset form
        const submitButton = document.querySelector('#authForm button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign In';
        }

        // Clear the password field
        document.getElementById('passwordInput').value = '';
    }
}

async function signOut() {
    // Clear stored auth tokens BEFORE signing out to prevent stale token errors on reload
    clearStoredAuth();
    await supabaseClient.auth.signOut();
    location.reload();
}

window.signOut = signOut;

async function fetchWithAuth(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (!response.ok) {
        // Read the body once to avoid "Body is disturbed or locked" errors.
        const responseText = await response.text();
        let errorDetail = responseText;

        if (responseText) {
            try {
                const errorBody = JSON.parse(responseText);
                errorDetail = errorBody.error || errorBody.message || JSON.stringify(errorBody);
            } catch (e) {
                // Keep the raw response text for non-JSON errors.
            }
        }

        throw new Error(errorDetail || `Request failed: ${response.status}`);
    }

    return response.json();
}

async function loadVocabularies() {
    try {
        const result = await fetchWithAuth('/api/vocab');
        vocabularies = result.vocabularies;

        // Populate category dropdown
        const categorySelect = document.getElementById('ptCategory');
        categorySelect.innerHTML = '<option value="">-- Select Category --</option>';

        if (vocabularies.pt_category) {
            vocabularies.pt_category.forEach(item => {
                const option = document.createElement('option');
                option.value = item.code;
                option.textContent = `${item.code} - ${item.definition}`;
                categorySelect.appendChild(option);
            });
        }

        // Populate pattern dropdown
        const patternSelect = document.getElementById('pattern');
        patternSelect.innerHTML = '<option value="">-- Select Pattern --</option>';

        if (vocabularies.pattern) {
            vocabularies.pattern.forEach(item => {
                const option = document.createElement('option');
                option.value = item.code;
                option.textContent = `${item.code} - ${item.definition}`;
                patternSelect.appendChild(option);
            });
        }

        // Populate Region dropdown for roles
        const regionSelect = document.getElementById('newRoleRegion');
        regionSelect.innerHTML = '<option value="">-- Select region --</option>';
        if (vocabularies.region) {
            vocabularies.region.forEach(item => {
                const option = document.createElement('option');
                option.value = item.code;
                option.textContent = `${item.code} - ${item.definition}`;
                regionSelect.appendChild(option);
            });
        }

        // Populate Capacity dropdown for roles
        const capacitySelect = document.getElementById('newRoleCapacity');
        capacitySelect.innerHTML = '<option value="">-- Select capacity --</option>';
        if (vocabularies.capacity) {
            vocabularies.capacity.forEach(item => {
                const option = document.createElement('option');
                option.value = item.code;
                option.textContent = `${item.code} - ${item.definition}`;
                capacitySelect.appendChild(option);
            });
        }

        // Populate Focus dropdown for roles
        const focusSelect = document.getElementById('newRoleFocus');
        focusSelect.innerHTML = '<option value="">-- No focus (general) --</option>';
        if (vocabularies.focus) {
            vocabularies.focus.forEach(item => {
                const option = document.createElement('option');
                option.value = item.code;
                option.textContent = `${item.code} - ${item.definition}`;
                focusSelect.appendChild(option);
            });
        }

        updateVocabReference();

    } catch (error) {
        console.error('Failed to load vocabularies:', error);
        toast('Failed to load vocabularies', 'error');
    }
}

async function loadReferenceData() {
    try {
        const result = await fetchWithAuth('/api/reference-data');
        referenceData = result;

        // Populate Equipment dropdowns
        populateReferenceDropdown('requiredEquipmentSelect', referenceData.equipment, 'Equipment');
        populateReferenceDropdown('optionalEquipmentSelect', referenceData.equipment, 'Equipment');

        // Populate Muscle dropdowns
        populateReferenceDropdown('primaryMusclesSelect', referenceData.muscles, 'Muscle');
        populateReferenceDropdown('secondaryMusclesSelect', referenceData.muscles, 'Muscle');

        // Populate Form Parameter dropdown
        populateReferenceDropdown('formParameterSelect', referenceData.formParameters, 'Parameter');

        // Add change listeners for "Other" option handling
        setupOtherOptionHandlers();

    } catch (error) {
        console.error('Failed to load reference data:', error);
        toast('Failed to load reference data', 'error');
    }
}

function populateReferenceDropdown(selectId, items, label) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = `<option value="">-- Select ${label} --</option>`;

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });

    // Add "Other" option
    const otherOption = document.createElement('option');
    otherOption.value = '__other__';
    otherOption.textContent = '-- Other (enter custom) --';
    select.appendChild(otherOption);
}

function setupOtherOptionHandlers() {
    const selects = [
        { selectId: 'requiredEquipmentSelect', inputId: 'requiredEquipmentOtherInput' },
        { selectId: 'optionalEquipmentSelect', inputId: 'optionalEquipmentOtherInput' },
        { selectId: 'primaryMusclesSelect', inputId: 'primaryMusclesOtherInput' },
        { selectId: 'secondaryMusclesSelect', inputId: 'secondaryMusclesOtherInput' },
        { selectId: 'formParameterSelect', inputId: 'formParameterOtherInput' }
    ];

    selects.forEach(({ selectId, inputId }) => {
        const select = document.getElementById(selectId);
        const input = document.getElementById(inputId);

        if (select && input) {
            select.addEventListener('change', () => {
                if (select.value === '__other__') {
                    input.style.display = 'block';
                    input.focus();
                } else {
                    input.style.display = 'none';
                    input.value = '';
                }
            });
        }
    });
}

function updateVocabReference() {
    const vocabDiv = document.getElementById('vocabReference');

    let html = '';

    const sections = [
        { key: 'region', title: 'Regions' },
        { key: 'capacity', title: 'Capacities' },
        { key: 'focus', title: 'Focus Areas' },
        { key: 'contribution', title: 'Contributions' },
        { key: 'pt_category', title: 'PT Categories' },
        { key: 'pattern', title: 'Patterns' }
    ];

    sections.forEach(section => {
        if (vocabularies[section.key] && vocabularies[section.key].length > 0) {
            html += `<h4 style="margin: 15px 0 8px 0; color: var(--ios-blue);">${section.title}</h4>`;
            html += '<div style="margin-left: 10px;">';

            vocabularies[section.key].forEach(item => {
                html += `<div style="margin-bottom: 4px;">
                    <strong>${escapeHtml(item.code)}</strong>: ${escapeHtml(item.definition || '')}
                </div>`;
            });

            html += '</div>';
        }
    });

    if (html === '') {
        html = '<p>No vocabularies loaded.</p>';
    }

    vocabDiv.innerHTML = html;
}

async function loadExercises() {
    try {
        const result = await fetchWithAuth('/api/exercises');
        allExercises = result.exercises || [];

        // Populate exercise select
        const exerciseSelect = document.getElementById('exerciseSelect');
        exerciseSelect.innerHTML = '<option value="">-- Add New Exercise (leave blank) --</option>';

        // Sort exercises alphabetically
        allExercises.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

        allExercises.forEach(exercise => {
            const option = document.createElement('option');
            option.value = exercise.id;
            option.textContent = exercise.canonical_name;
            exerciseSelect.appendChild(option);
        });

        // Populate roles and dosage section dropdowns
        populateRoleExerciseDropdown();
        populateDosageExerciseDropdown();

    } catch (error) {
        console.error('Failed to load exercises:', error);
        toast('Failed to load exercises', 'error');
    }
}

function populateRoleExerciseDropdown() {
    const select = document.getElementById('roleExerciseSelect');
    select.innerHTML = '<option value="">-- Choose an exercise --</option>';
    allExercises.forEach(exercise => {
        const option = document.createElement('option');
        option.value = exercise.id;
        option.textContent = exercise.canonical_name;
        select.appendChild(option);
    });
}

function populateDosageExerciseDropdown() {
    const select = document.getElementById('dosageExerciseSelect');
    select.innerHTML = '<option value="">-- Choose an exercise --</option>';
    allExercises.forEach(exercise => {
        const option = document.createElement('option');
        option.value = exercise.id;
        option.textContent = exercise.canonical_name;
        select.appendChild(option);
    });
}

function filterExercises() {
    const searchTerm = document.getElementById('exerciseSearch').value.toLowerCase();
    const select = document.getElementById('exerciseSelect');

    // Clear current options
    select.innerHTML = '<option value="">-- Add New Exercise (leave blank) --</option>';

    // Filter exercises
    const filteredExercises = allExercises.filter(exercise =>
        exercise.canonical_name.toLowerCase().includes(searchTerm)
    );

    filteredExercises.forEach(exercise => {
        const option = document.createElement('option');
        option.value = exercise.id;
        option.textContent = exercise.canonical_name;
        select.appendChild(option);
    });
}

window.filterExercises = filterExercises;

function loadExerciseForEdit() {
    const exerciseId = document.getElementById('exerciseSelect').value;

    if (!exerciseId) {
        clearForm();
        return;
    }

    const exercise = allExercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    currentExercise = exercise;

    // Populate basic fields
    document.getElementById('canonicalName').value = exercise.canonical_name || '';
    document.getElementById('description').value = exercise.description || '';
    document.getElementById('ptCategory').value = exercise.pt_category || '';
    document.getElementById('pattern').value = exercise.pattern || '';

    // Pattern modifiers
    document.getElementById('modDuration').checked = exercise.pattern_modifiers?.includes('duration_seconds') || false;
    document.getElementById('modHold').checked = exercise.pattern_modifiers?.includes('hold_seconds') || false;
    document.getElementById('modDistance').checked = exercise.pattern_modifiers?.includes('distance_feet') || false;

    // Equipment
    requiredEquipment = exercise.equipment?.required || [];
    optionalEquipment = exercise.equipment?.optional || [];
    renderTagList('requiredEquipmentTags', requiredEquipment);
    renderTagList('optionalEquipmentTags', optionalEquipment);

    // Muscles
    primaryMuscles = exercise.primary_muscles || [];
    secondaryMuscles = exercise.secondary_muscles || [];
    renderTagList('primaryMusclesTags', primaryMuscles);
    renderTagList('secondaryMusclesTags', secondaryMuscles);

    // Form parameters
    formParameters = exercise.form_parameters_required || [];
    renderTagList('formParameterTags', formParameters);

    // Guidance
    motorCues = exercise.guidance?.motor_cues || [];
    compensationWarnings = exercise.guidance?.compensation_warnings || [];
    safetyFlags = exercise.guidance?.safety_flags || [];
    externalCues = exercise.guidance?.external_cues || [];
    renderGuidanceList('motorCuesList', motorCues);
    renderGuidanceList('compensationList', compensationWarnings);
    renderGuidanceList('safetyList', safetyFlags);
    renderGuidanceList('externalCuesList', externalCues);

    // Lifecycle fields - use lifecycle_status as source of truth, default to 'active'
    const lifecycleStatus = exercise.lifecycle_status || (exercise.archived ? 'archived' : 'active');
    document.getElementById('lifecycleStatus').value = lifecycleStatus;
    document.getElementById('archived').checked = lifecycleStatus === 'archived';
    document.getElementById('effectiveStartDate').value = exercise.lifecycle_effective_start_date || '';
    document.getElementById('effectiveEndDate').value = exercise.lifecycle_effective_end_date || '';

    // Optional lifecycle fields (may not exist in UI)
    const supersedesEl = document.getElementById('supersedesExercise');
    if (supersedesEl) supersedesEl.value = exercise.supersedes_exercise_id || '';

    const supersededByEl = document.getElementById('supersededByExercise');
    if (supersededByEl) supersededByEl.value = exercise.superseded_by_exercise_id || '';

    const supersededDateEl = document.getElementById('supersededDate');
    if (supersededDateEl) supersededDateEl.value = exercise.superseded_date || '';

    const addedDateEl = document.getElementById('addedDate');
    if (addedDateEl) addedDateEl.value = exercise.added_date || '';

    const updatedDateEl = document.getElementById('updatedDate');
    if (updatedDateEl) updatedDateEl.value = exercise.updated_date || '';

    // Update buttons
    document.querySelector('#exerciseForm button[type="submit"]').textContent = 'Update Exercise';
}

window.loadExerciseForEdit = loadExerciseForEdit;

function clearForm() {
    currentExercise = null;

    // Reset form fields
    document.getElementById('exerciseForm').reset();
    document.getElementById('exerciseSelect').value = '';
    document.querySelector('#exerciseForm button[type="submit"]').textContent = 'Save Exercise';

    // Set lifecycle defaults - always default to 'active'
    document.getElementById('lifecycleStatus').value = 'active';
    document.getElementById('archived').checked = false;

    // Auto-populate start date for new exercises
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('effectiveStartDate').value = today;
    document.getElementById('effectiveEndDate').value = '';

    // Clear tag arrays
    requiredEquipment = [];
    optionalEquipment = [];
    primaryMuscles = [];
    secondaryMuscles = [];
    formParameters = [];
    motorCues = [];
    compensationWarnings = [];
    safetyFlags = [];
    externalCues = [];

    renderTagList('requiredEquipmentTags', requiredEquipment);
    renderTagList('optionalEquipmentTags', optionalEquipment);
    renderTagList('primaryMusclesTags', primaryMuscles);
    renderTagList('secondaryMusclesTags', secondaryMuscles);
    renderTagList('formParameterTags', formParameters);
    renderGuidanceList('motorCuesList', motorCues);
    renderGuidanceList('compensationList', compensationWarnings);
    renderGuidanceList('safetyList', safetyFlags);
    renderGuidanceList('externalCuesList', externalCues);
}

window.clearForm = clearForm;

function renderTagList(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    items.forEach((item, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            <span>${escapeHtml(item)}</span>
            <button type="button" class="tag-remove" data-action="removeTag" data-container="${containerId}" data-index="${index}">×</button>
        `;
        container.appendChild(tag);
    });

    // Rebind handlers for dynamically created elements
    bindPointerHandlers(container);
}

function removeTag(containerId, index) {
    let array;

    switch (containerId) {
        case 'requiredEquipmentTags':
            array = requiredEquipment;
            break;
        case 'optionalEquipmentTags':
            array = optionalEquipment;
            break;
        case 'primaryMusclesTags':
            array = primaryMuscles;
            break;
        case 'secondaryMusclesTags':
            array = secondaryMuscles;
            break;
        case 'formParameterTags':
            array = formParameters;
            break;
        default:
            return;
    }

    array.splice(index, 1);
    renderTagList(containerId, array);
}

window.removeTag = removeTag;

function addRequiredEquipment() {
    const select = document.getElementById('requiredEquipmentSelect');
    const otherInput = document.getElementById('requiredEquipmentOtherInput');

    let value = '';
    if (select.value === '__other__') {
        value = otherInput.value.trim();
        otherInput.value = '';
        otherInput.style.display = 'none';
    } else {
        value = select.value.trim();
    }

    if (!value) {
        toast('Please select or enter equipment', 'error');
        return;
    }

    if (requiredEquipment.includes(value)) {
        toast('Equipment already added', 'error');
        return;
    }

    requiredEquipment.push(value);
    select.value = '';
    renderTagList('requiredEquipmentTags', requiredEquipment);
}

window.addRequiredEquipment = addRequiredEquipment;

function addOptionalEquipment() {
    const select = document.getElementById('optionalEquipmentSelect');
    const otherInput = document.getElementById('optionalEquipmentOtherInput');

    let value = '';
    if (select.value === '__other__') {
        value = otherInput.value.trim();
        otherInput.value = '';
        otherInput.style.display = 'none';
    } else {
        value = select.value.trim();
    }

    if (!value) {
        toast('Please select or enter equipment', 'error');
        return;
    }

    if (optionalEquipment.includes(value)) {
        toast('Equipment already added', 'error');
        return;
    }

    optionalEquipment.push(value);
    select.value = '';
    renderTagList('optionalEquipmentTags', optionalEquipment);
}

window.addOptionalEquipment = addOptionalEquipment;

function addPrimaryMuscle() {
    const select = document.getElementById('primaryMusclesSelect');
    const otherInput = document.getElementById('primaryMusclesOtherInput');

    let value = '';
    if (select.value === '__other__') {
        value = otherInput.value.trim();
        otherInput.value = '';
        otherInput.style.display = 'none';
    } else {
        value = select.value.trim();
    }

    if (!value) {
        toast('Please select or enter muscle', 'error');
        return;
    }

    if (primaryMuscles.includes(value)) {
        toast('Muscle already added', 'error');
        return;
    }

    primaryMuscles.push(value);
    select.value = '';
    renderTagList('primaryMusclesTags', primaryMuscles);
}

window.addPrimaryMuscle = addPrimaryMuscle;

function addSecondaryMuscle() {
    const select = document.getElementById('secondaryMusclesSelect');
    const otherInput = document.getElementById('secondaryMusclesOtherInput');

    let value = '';
    if (select.value === '__other__') {
        value = otherInput.value.trim();
        otherInput.value = '';
        otherInput.style.display = 'none';
    } else {
        value = select.value.trim();
    }

    if (!value) {
        toast('Please select or enter muscle', 'error');
        return;
    }

    if (secondaryMuscles.includes(value)) {
        toast('Muscle already added', 'error');
        return;
    }

    secondaryMuscles.push(value);
    select.value = '';
    renderTagList('secondaryMusclesTags', secondaryMuscles);
}

window.addSecondaryMuscle = addSecondaryMuscle;

function addFormParameter() {
    const select = document.getElementById('formParameterSelect');
    const otherInput = document.getElementById('formParameterOtherInput');

    let value = '';
    if (select.value === '__other__') {
        value = otherInput.value.trim();
        otherInput.value = '';
        otherInput.style.display = 'none';
    } else {
        value = select.value.trim();
    }

    if (!value) {
        toast('Please select or enter parameter', 'error');
        return;
    }

    if (formParameters.includes(value)) {
        toast('Parameter already added', 'error');
        return;
    }

    formParameters.push(value);
    select.value = '';
    renderTagList('formParameterTags', formParameters);
}

window.addFormParameter = addFormParameter;

function renderGuidanceList(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            ${escapeHtml(item)}
            <button type="button" class="tag-remove" data-action="removeGuidance" data-container="${containerId}" data-index="${index}">×</button>
        `;
        container.appendChild(li);
    });

    // Rebind handlers for dynamically created elements
    bindPointerHandlers(container);
}

function removeGuidance(containerId, index) {
    let array;

    switch (containerId) {
        case 'motorCuesList':
            array = motorCues;
            break;
        case 'compensationList':
            array = compensationWarnings;
            break;
        case 'safetyList':
            array = safetyFlags;
            break;
        case 'externalCuesList':
            array = externalCues;
            break;
        default:
            return;
    }

    array.splice(index, 1);
    renderGuidanceList(containerId, array);
}

window.removeGuidance = removeGuidance;

function addMotorCue() {
    const input = document.getElementById('motorCuesInput');
    const value = input.value.trim();
    if (!value) return;

    motorCues.push(value);
    input.value = '';
    renderGuidanceList('motorCuesList', motorCues);
}

window.addMotorCue = addMotorCue;

function addCompensationWarning() {
    const input = document.getElementById('compensationInput');
    const value = input.value.trim();
    if (!value) return;

    compensationWarnings.push(value);
    input.value = '';
    renderGuidanceList('compensationList', compensationWarnings);
}

window.addCompensationWarning = addCompensationWarning;

function addSafetyFlag() {
    const input = document.getElementById('safetyInput');
    const value = input.value.trim();
    if (!value) return;

    safetyFlags.push(value);
    input.value = '';
    renderGuidanceList('safetyList', safetyFlags);
}

window.addSafetyFlag = addSafetyFlag;

function addExternalCue() {
    const input = document.getElementById('externalCuesInput');
    const value = input.value.trim();
    if (!value) return;

    externalCues.push(value);
    input.value = '';
    renderGuidanceList('externalCuesList', externalCues);
}

window.addExternalCue = addExternalCue;

function collectFormData() {
    const canonicalName = document.getElementById('canonicalName').value.trim();
    const description = document.getElementById('description').value.trim();
    const ptCategory = document.getElementById('ptCategory').value;
    const pattern = document.getElementById('pattern').value;

    if (!canonicalName || !description || !ptCategory || !pattern) {
        throw new Error('Please fill in all required fields (Canonical Name, Description, PT Category, Pattern).');
    }

    // Get lifecycle status - always default to 'active', never null
    const lifecycleStatus = document.getElementById('lifecycleStatus').value || 'active';
    const isArchived = lifecycleStatus === 'archived';

    // Auto-set dates only if user hasn't entered their own value
    const today = new Date().toISOString().split('T')[0];
    const isNewExercise = !currentExercise;
    const addedDateInput = document.getElementById('addedDate')?.value || null;
    const updatedDateInput = document.getElementById('updatedDate')?.value || null;

    // For new exercises: use user's input or default to today
    // For existing exercises: preserve added_date, use user's updated_date or default to today
    const addedDate = isNewExercise
        ? (addedDateInput || today)
        : (addedDateInput || currentExercise?.added_date || null);
    const updatedDate = isNewExercise
        ? null
        : (updatedDateInput || today);

    const exerciseData = {
        id: currentExercise?.id || generateExerciseId(canonicalName),
        canonical_name: canonicalName,
        description: description,
        pt_category: ptCategory,
        pattern: pattern,
        archived: isArchived,
        lifecycle_status: lifecycleStatus,
        lifecycle_effective_start_date: document.getElementById('effectiveStartDate').value || null,
        lifecycle_effective_end_date: document.getElementById('effectiveEndDate').value || null,
        supersedes_exercise_id: document.getElementById('supersedesExercise')?.value || null,
        superseded_by_exercise_id: document.getElementById('supersededByExercise')?.value || null,
        superseded_date: document.getElementById('supersededDate')?.value || null,
        added_date: addedDate,
        updated_date: updatedDate,
        pattern_modifiers: [
            ...(document.getElementById('modDuration').checked ? ['duration_seconds'] : []),
            ...(document.getElementById('modHold').checked ? ['hold_seconds'] : []),
            ...(document.getElementById('modDistance').checked ? ['distance_feet'] : [])
        ],
        equipment: {
            required: requiredEquipment,
            optional: optionalEquipment
        },
        primary_muscles: primaryMuscles,
        secondary_muscles: secondaryMuscles,
        form_parameters_required: formParameters,
        guidance: {
            motor_cues: motorCues,
            compensation_warnings: compensationWarnings,
            safety_flags: safetyFlags,
            external_cues: externalCues
        },
        roles: collectRoles()
    };

    return exerciseData;
}

function collectRoles() {
    const roles = [];

    const rows = document.querySelectorAll('#rolesTable tbody tr');
    rows.forEach(row => {
        const region = row.querySelector('.role-region').value;
        const capacity = row.querySelector('.role-capacity').value;
        const focus = row.querySelector('.role-focus').value;
        const contribution = row.querySelector('.role-contribution').value;

        if (region || capacity || focus || contribution) {
            roles.push({ region, capacity, focus, contribution });
        }
    });

    return roles;
}

function addRoleRow(role = {}) {
    const tbody = document.querySelector('#rolesTable tbody');
    const row = document.createElement('tr');

    row.innerHTML = `
        <td>
            <select class="form-select role-region">
                <option value="">-- Select Region --</option>
                ${vocabularies.region?.map(item => `<option value="${item.code}">${item.code}</option>`).join('') || ''}
            </select>
        </td>
        <td>
            <select class="form-select role-capacity">
                <option value="">-- Select Capacity --</option>
                ${vocabularies.capacity?.map(item => `<option value="${item.code}">${item.code}</option>`).join('') || ''}
            </select>
        </td>
        <td>
            <select class="form-select role-focus">
                <option value="">-- Select Focus --</option>
                ${vocabularies.focus?.map(item => `<option value="${item.code}">${item.code}</option>`).join('') || ''}
            </select>
        </td>
        <td>
            <select class="form-select role-contribution">
                <option value="">-- Select Contribution --</option>
                ${vocabularies.contribution?.map(item => `<option value="${item.code}">${item.code}</option>`).join('') || ''}
            </select>
        </td>
        <td>
            <button type="button" class="btn-danger" data-action="removeRoleRow">Remove</button>
        </td>
    `;

    if (role.region) row.querySelector('.role-region').value = role.region;
    if (role.capacity) row.querySelector('.role-capacity').value = role.capacity;
    if (role.focus) row.querySelector('.role-focus').value = role.focus;
    if (role.contribution) row.querySelector('.role-contribution').value = role.contribution;

    tbody.appendChild(row);

    // Rebind handlers for dynamically created button
    bindPointerHandlers(row);
}

window.addRoleRow = addRoleRow;

function removeRoleRow(button) {
    const row = button.closest('tr');
    row.remove();
}

window.removeRoleRow = removeRoleRow;

function renderRoles(roles = []) {
    const tbody = document.querySelector('#rolesTable tbody');
    tbody.innerHTML = '';

    roles.forEach(role => addRoleRow(role));

    if (roles.length === 0) {
        addRoleRow();
    }
}

async function saveExercise() {
    try {
        const exerciseData = collectFormData();
        const exerciseId = exerciseData.id;

        // Determine if creating or updating
        const isUpdate = currentExercise !== null;
        const method = isUpdate ? 'PUT' : 'POST';
        const url = isUpdate ? `/api/exercises?id=${encodeURIComponent(exerciseId)}` : '/api/exercises';

        const result = await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(exerciseData)
        });

        toast(`Exercise ${isUpdate ? 'updated' : 'created'} successfully!`, 'success');

        // Reload exercises and select the saved one
        await loadExercises();
        document.getElementById('exerciseSelect').value = exerciseId;
        loadExerciseForEdit();

    } catch (error) {
        console.error('Failed to save exercise:', error);
        toast(error.message || 'Failed to save exercise', 'error');
    }
}

function generateExerciseId(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toast(message, type = 'success') {
    const toastEl = document.getElementById('toast');
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    toastEl.classList.add('show');

    setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3000);
}

function showAuthAlert(title, details) {
    const content = [title, details].filter(Boolean).join('\n\n');
    alert(content);
}

function showBootError(error) {
    const message = error?.message || String(error);
    const errorDiv = document.getElementById('authError');

    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    showAuthAlert('PT Editor boot error', message);
}

// ========================================
// SECTION 2: ROLES MANAGEMENT
// ========================================

let selectedExerciseForRoles = null;
let currentRoles = [];

function filterRoleExercises() {
    filterExerciseDropdown('roleExerciseSelect', 'roleExerciseSearch');
}

window.filterRoleExercises = filterRoleExercises;

function filterDosageExercises() {
    filterExerciseDropdown('dosageExerciseSelect', 'dosageExerciseSearch');
}

window.filterDosageExercises = filterDosageExercises;

function filterExerciseDropdown(selectId, searchId) {
    const searchTerm = document.getElementById(searchId).value.toLowerCase();
    const select = document.getElementById(selectId);

    // Clear and repopulate
    select.innerHTML = '<option value="">-- Choose an exercise --</option>';
    allExercises.filter(ex => ex.canonical_name.toLowerCase().includes(searchTerm))
        .forEach(exercise => {
            const option = document.createElement('option');
            option.value = exercise.id;
            option.textContent = exercise.canonical_name;
            select.appendChild(option);
        });
}

async function loadExerciseRoles() {
    const exerciseId = document.getElementById('roleExerciseSelect').value;

    if (!exerciseId) {
        document.getElementById('currentRoles').innerHTML = '';
        document.getElementById('addRoleForm').classList.add('hidden');
        selectedExerciseForRoles = null;
        return;
    }

    selectedExerciseForRoles = allExercises.find(ex => ex.id === exerciseId);
    if (!selectedExerciseForRoles) return;

    try {
        const result = await fetchWithAuth(`/api/roles?exercise_id=${exerciseId}`);
        currentRoles = result.roles || [];

        renderCurrentRoles();
        document.getElementById('addRoleForm').classList.remove('hidden');

    } catch (error) {
        console.error('Failed to load roles:', error);
        toast('Failed to load roles', 'error');
    }
}

window.loadExerciseRoles = loadExerciseRoles;

function renderCurrentRoles() {
    const container = document.getElementById('currentRoles');

    if (currentRoles.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No roles assigned yet.</p>';
        return;
    }

    container.innerHTML = '<h4 style="margin-bottom: 10px; font-size: 16px;">Current Roles:</h4>' +
        currentRoles.map(role => `
            <div style="background: var(--bg-tertiary); padding: 10px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: var(--ios-blue); color: white; font-size: 11px; font-weight: 600; margin-right: 8px;">${escapeHtml(role.contribution.toUpperCase())}</span>
                    <strong>${escapeHtml(role.region)}</strong> / ${escapeHtml(role.capacity)}${role.focus ? ' / ' + escapeHtml(role.focus) : ''}
                </div>
                <button type="button" class="btn-danger" data-action="removeRole" data-role-id="${role.id}" style="padding: 6px 12px; font-size: 12px;">Remove</button>
            </div>
        `).join('');

    // Rebind handlers for dynamically created buttons
    bindPointerHandlers(container);
}

async function addRoleToExercise() {
    const region = document.getElementById('newRoleRegion').value;
    const capacity = document.getElementById('newRoleCapacity').value;
    const focus = document.getElementById('newRoleFocus').value || null;
    const contribution = document.getElementById('newRoleContribution').value;

    if (!selectedExerciseForRoles) {
        toast('Please select an exercise first', 'error');
        return;
    }

    if (!region || !capacity || !contribution) {
        toast('Please fill in all required role fields', 'error');
        return;
    }

    try {
        const roleData = {
            exercise_id: selectedExerciseForRoles.id,
            region: region,
            capacity: capacity,
            focus: focus,
            contribution: contribution
        };

        await fetchWithAuth('/api/roles', {
            method: 'POST',
            body: JSON.stringify(roleData)
        });

        toast('Role added successfully!', 'success');

        // Clear form
        document.getElementById('newRoleRegion').value = '';
        document.getElementById('newRoleCapacity').value = '';
        document.getElementById('newRoleFocus').value = '';
        document.getElementById('newRoleContribution').value = '';

        // Reload roles
        await loadExerciseRoles();

    } catch (error) {
        console.error('Failed to add role:', error);
        toast(error.message || 'Failed to add role', 'error');
    }
}

window.addRoleToExercise = addRoleToExercise;

async function removeRole(roleId) {
    if (!confirm('Are you sure you want to remove this role?')) {
        return;
    }

    try {
        await fetchWithAuth(`/api/roles/${roleId}`, {
            method: 'DELETE'
        });

        toast('Role removed successfully!', 'success');
        await loadExerciseRoles();

    } catch (error) {
        console.error('Failed to remove role:', error);
        toast(error.message || 'Failed to remove role', 'error');
    }
}

window.removeRole = removeRole;

// ========================================
// SECTION 3: DOSAGE MANAGEMENT
// ========================================

let selectedExerciseForDosage = null;
let currentProgramForDosage = null;

async function loadExerciseDosage() {
    const exerciseId = document.getElementById('dosageExerciseSelect').value;

    if (!exerciseId) {
        document.getElementById('currentDosageDisplay').classList.add('hidden');
        document.getElementById('editDosageForm').classList.add('hidden');
        selectedExerciseForDosage = null;
        currentProgramForDosage = null;
        return;
    }

    selectedExerciseForDosage = allExercises.find(ex => ex.id === exerciseId);
    if (!selectedExerciseForDosage) return;
    currentProgramForDosage = null;

    // Show/hide conditional fields based on pattern modifiers
    const modifiers = selectedExerciseForDosage.pattern_modifiers || [];
    const hasHold = modifiers.includes('hold_seconds');
    const hasDuration = modifiers.includes('duration_seconds');
    const hasDistance = modifiers.includes('distance_feet');
    const isUnilateral = selectedExerciseForDosage.pattern === 'side';
    const replacesReps = hasDuration || hasDistance;

    // Toggle visibility of conditional fields
    document.getElementById('dosageRepsGroup').classList.toggle('hidden', replacesReps);
    document.getElementById('dosageSecondsGroup').classList.toggle('hidden', !(hasHold || hasDuration));
    document.getElementById('dosageDistanceGroup').classList.toggle('hidden', !hasDistance);

    // Update label based on modifier type
    if (hasHold) {
        document.getElementById('dosageSecondsLabel').textContent = 'Hold Seconds (per rep)';
    } else if (hasDuration) {
        document.getElementById('dosageSecondsLabel').textContent = 'Duration Seconds (per set)';
    }

    // Show the form
    document.getElementById('editDosageForm').classList.remove('hidden');

    // Clear/reset fields
    document.getElementById('dosageSets').value = '';
    document.getElementById('dosageReps').value = '';
    document.getElementById('dosageSeconds').value = '';
    document.getElementById('dosageDistance').value = '';

    try {
        const response = await fetchWithAuth(`/api/programs?patient_id=${currentUser.id}`);
        const programs = response.programs || [];
        currentProgramForDosage = programs.find(p => p.exercise_id === selectedExerciseForDosage.id) || null;

        const currentDisplay = document.getElementById('currentDosageDisplay');

        if (currentProgramForDosage) {
            const spec = currentProgramForDosage;
            const dosageType = spec.dosage_type;
            const usesHold = dosageType === 'hold' || (!dosageType && hasHold);
            const usesDuration = dosageType === 'duration' || (!dosageType && hasDuration);
            const secondsValue = usesDuration ? (spec.seconds_per_set || '') : (usesHold ? (spec.seconds_per_rep || '') : '');
            const distanceValue = spec.distance_feet || '';
            const repsValue = spec.reps_per_set || '';

            const summaryParts = [];
            if (spec.sets) {
                summaryParts.push(`${spec.sets} sets`);
            }
            if (!replacesReps && repsValue) {
                summaryParts.push(`${repsValue} reps`);
            }
            if (usesHold && spec.seconds_per_rep) {
                summaryParts.push(`${spec.seconds_per_rep}s hold`);
            }
            if (usesDuration && spec.seconds_per_set) {
                summaryParts.push(`${spec.seconds_per_set}s duration`);
            }
            if (spec.distance_feet) {
                summaryParts.push(`${spec.distance_feet} ft`);
            }

            currentDisplay.innerHTML = `
                <h4 style="margin-bottom: 10px; font-size: 16px;">Current Dosage</h4>
                <div style="background: var(--bg-tertiary); padding: 10px; border-radius: 6px; font-weight: 600;">
                    ${summaryParts.join(' • ')}
                </div>
            `;
            currentDisplay.classList.remove('hidden');

            document.getElementById('dosageSets').value = spec.sets || '';
            if (!replacesReps) {
                document.getElementById('dosageReps').value = repsValue;
            }
            if (hasHold || hasDuration) {
                document.getElementById('dosageSeconds').value = secondsValue;
            }
            if (hasDistance) {
                document.getElementById('dosageDistance').value = distanceValue;
            }
        } else {
            currentDisplay.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No dosage set yet.</p>';
            currentDisplay.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to load dosage:', error);
        toast(error.message || 'Failed to load dosage', 'error');
    }

    toast('Select dosage parameters below', 'success');
}

window.loadExerciseDosage = loadExerciseDosage;

async function updateDosage() {
    const sets = parseInt(document.getElementById('dosageSets').value, 10);
    const reps = parseInt(document.getElementById('dosageReps').value, 10);

    if (!selectedExerciseForDosage) {
        toast('Please select an exercise first', 'error');
        return;
    }

    if (!sets || sets < 1) {
        toast('Please enter valid sets', 'error');
        return;
    }

    const modifiers = selectedExerciseForDosage.pattern_modifiers || [];
    const replacesReps = modifiers.includes('duration_seconds') || modifiers.includes('distance_feet');

    if (!replacesReps && (!reps || reps < 1)) {
        toast('Please enter valid reps', 'error');
        return;
    }

    const dosageData = {
        patient_id: currentUser.id,
        exercise_id: selectedExerciseForDosage.id,
        sets: sets
    };

    // Add optional fields if visible
    if (!replacesReps) {
        dosageData.reps_per_set = reps;
    }

    if (modifiers.includes('hold_seconds')) {
        const seconds = parseInt(document.getElementById('dosageSeconds').value, 10);
        if (!seconds || seconds < 1) {
            toast('Please enter valid hold seconds', 'error');
            return;
        }
        dosageData.seconds_per_rep = seconds;
        dosageData.seconds_per_set = null;
        dosageData.dosage_type = 'hold';
    } else if (modifiers.includes('duration_seconds')) {
        const seconds = parseInt(document.getElementById('dosageSeconds').value, 10);
        if (!seconds || seconds < 1) {
            toast('Please enter valid duration in seconds', 'error');
            return;
        }
        dosageData.seconds_per_set = seconds;
        dosageData.seconds_per_rep = null;
        dosageData.dosage_type = 'duration';
    } else if (!replacesReps) {
        dosageData.dosage_type = 'reps';
    }

    if (modifiers.includes('distance_feet')) {
        const distance = parseInt(document.getElementById('dosageDistance').value, 10);
        if (!distance || distance < 1) {
            toast('Please enter valid distance in feet', 'error');
            return;
        }
        dosageData.distance_feet = distance;
        dosageData.dosage_type = 'distance';
    }

    try {
        // Check if program exists
        const response = await fetchWithAuth(`/api/programs?patient_id=${currentUser.id}`);
        const programs = response.programs || [];
        const existing = programs.find(p => p.exercise_id === selectedExerciseForDosage.id);

        if (existing) {
            // Update existing program
            await fetchWithAuth(`/api/programs?id=${encodeURIComponent(existing.id)}`, {
                method: 'PUT',
                body: JSON.stringify(dosageData)
            });
            toast('Dosage updated successfully!', 'success');
        } else {
            // Create new program
            await fetchWithAuth('/api/programs', {
                method: 'POST',
                body: JSON.stringify(dosageData)
            });
            toast('Dosage created successfully!', 'success');
        }

        // Reload to show updated dosage
        await loadExerciseDosage();
    } catch (error) {
        console.error('Error saving dosage:', error);
        toast(error.message || 'Failed to save dosage', 'error');
    }
}

window.updateDosage = updateDosage;

// ============================================================================
// Vocabulary Editor Functions
// ============================================================================

let currentVocabCategory = null;

/**
 * Load vocabulary terms for the selected category
 */
async function loadVocabTerms() {
    const category = document.getElementById('vocabCategory').value;
    const termsList = document.getElementById('vocabTermsList');
    const termsContent = document.getElementById('vocabTermsContent');
    const addForm = document.getElementById('addVocabForm');

    if (!category) {
        termsList.classList.add('hidden');
        addForm.classList.add('hidden');
        currentVocabCategory = null;
        return;
    }

    currentVocabCategory = category;
    const terms = vocabularies[category] || [];

    if (terms.length === 0) {
        termsContent.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No terms found.</p>';
    } else {
        termsContent.innerHTML = terms.map(term => `
            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <strong style="color: var(--ios-blue);">${escapeHtml(term.code)}</strong>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(term.definition || '(no definition)')}</div>
                </div>
                <button type="button" class="btn-secondary" data-action="editVocab" data-code="${term.code}" data-definition="${encodeURIComponent(term.definition || '')}" style="padding: 6px 12px; font-size: 12px; margin-left: 10px;">Edit</button>
            </div>
        `).join('');
    }

    termsList.classList.remove('hidden');
    addForm.classList.remove('hidden');

    // Clear add form
    document.getElementById('newVocabCode').value = '';
    document.getElementById('newVocabDefinition').value = '';

    // Rebind handlers for edit buttons
    bindPointerHandlers(termsContent);
}

/**
 * Add a new vocabulary term
 */
async function addVocabTerm() {
    if (!currentVocabCategory) {
        toast('Please select a category first', 'error');
        return;
    }

    const code = document.getElementById('newVocabCode').value.trim();
    const definition = document.getElementById('newVocabDefinition').value.trim();

    if (!code || !definition) {
        toast('Please enter both code and definition', 'error');
        return;
    }

    try {
        await fetchWithAuth('/api/vocab', {
            method: 'POST',
            body: JSON.stringify({
                table: currentVocabCategory,
                code: code,
                definition: definition
            })
        });

        toast('Term added successfully', 'success');

        // Reload vocabularies and refresh display
        await loadVocabularies();
        loadVocabTerms();

    } catch (error) {
        console.error('Failed to add vocab term:', error);
        toast(error.message || 'Failed to add term', 'error');
    }
}

/**
 * Open the edit modal for a vocabulary term
 */
function openVocabEditModal(code, encodedDefinition) {
    const modal = document.getElementById('editVocabModal');
    document.getElementById('editVocabCode').value = code;
    document.getElementById('editVocabCodeDisplay').value = code;
    document.getElementById('editVocabDefinition').value = decodeURIComponent(encodedDefinition || '');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

/**
 * Close the edit modal
 */
function closeVocabEditModal() {
    const modal = document.getElementById('editVocabModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

/**
 * Save vocabulary term edits
 */
async function saveVocabEdit() {
    if (!currentVocabCategory) return;

    const code = document.getElementById('editVocabCode').value;
    const definition = document.getElementById('editVocabDefinition').value.trim();

    if (!definition) {
        toast('Definition cannot be empty', 'error');
        return;
    }

    try {
        await fetchWithAuth('/api/vocab', {
            method: 'PUT',
            body: JSON.stringify({
                table: currentVocabCategory,
                code: code,
                definition: definition
            })
        });

        toast('Term updated successfully', 'success');
        closeVocabEditModal();

        // Reload vocabularies and refresh display
        await loadVocabularies();
        loadVocabTerms();

    } catch (error) {
        console.error('Failed to update vocab term:', error);
        toast(error.message || 'Failed to update term', 'error');
    }
}

/**
 * Delete (soft-delete) a vocabulary term
 */
async function deleteVocabTerm() {
    if (!currentVocabCategory) return;

    const code = document.getElementById('editVocabCode').value;

    if (!confirm(`Are you sure you want to remove "${code}"? This will hide it from all dropdowns.`)) {
        return;
    }

    try {
        await fetchWithAuth(`/api/vocab?table=${currentVocabCategory}&code=${code}`, {
            method: 'DELETE'
        });

        toast('Term removed successfully', 'success');
        closeVocabEditModal();

        // Reload vocabularies and refresh display
        await loadVocabularies();
        loadVocabTerms();

        // Also refresh role dropdowns
        populateRoleDropdowns();

    } catch (error) {
        console.error('Failed to delete vocab term:', error);
        toast(error.message || 'Failed to remove term', 'error');
    }
}

/**
 * Repopulate role dropdowns after vocab changes
 */
function populateRoleDropdowns() {
    const regionSelect = document.getElementById('newRoleRegion');
    const capacitySelect = document.getElementById('newRoleCapacity');
    const focusSelect = document.getElementById('newRoleFocus');

    if (regionSelect && vocabularies.region) {
        regionSelect.innerHTML = '<option value="">-- Select --</option>' +
            vocabularies.region.map(item => `<option value="${item.code}">${item.code}</option>`).join('');
    }

    if (capacitySelect && vocabularies.capacity) {
        capacitySelect.innerHTML = '<option value="">-- Select --</option>' +
            vocabularies.capacity.map(item => `<option value="${item.code}">${item.code}</option>`).join('');
    }

    if (focusSelect && vocabularies.focus) {
        focusSelect.innerHTML = '<option value="">(optional)</option>' +
            vocabularies.focus.map(item => `<option value="${item.code}">${item.code}</option>`).join('');
    }
}

window.addEventListener('error', (event) => {
    if (event?.message) {
        showBootError(event.message);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    showBootError(event.reason || 'Unexpected error during initialization.');
});

// Initialize on load
init().catch(showBootError);
