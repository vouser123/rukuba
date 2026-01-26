const FALLBACK_SUPABASE_URL = 'https://zvgoaxdpkgfxklotqwpz.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_pdyqh56HqQQ6OfHl3GG11A_W6IxqqWp';

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
        // Fall through to fallback values.
    }

    return {
        supabaseUrl: FALLBACK_SUPABASE_URL,
        supabaseAnonKey: FALLBACK_SUPABASE_ANON_KEY,
        warning: 'Using fallback Supabase credentials. If this persists, check /api/env.'
    };
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
        let errorDetail = '';
        try {
            const errorBody = await response.json();
            errorDetail = errorBody.error || errorBody.message || JSON.stringify(errorBody);
        } catch (e) {
            errorDetail = await response.text();
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
                    <strong>${item.code}</strong>: ${item.definition}
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

    // Lifecycle fields
    document.getElementById('archived').checked = exercise.archived || false;
    document.getElementById('lifecycleStatus').value = exercise.lifecycle_status || '';
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
            <button type="button" class="tag-remove" onclick="removeTag('${containerId}', ${index})">×</button>
        `;
        container.appendChild(tag);
    });
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
            <button type="button" class="tag-remove" onclick="removeGuidance('${containerId}', ${index})">×</button>
        `;
        container.appendChild(li);
    });
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

    const exerciseData = {
        id: currentExercise?.id || generateExerciseId(canonicalName),
        canonical_name: canonicalName,
        description: description,
        pt_category: ptCategory,
        pattern: pattern,
        archived: document.getElementById('archived').checked,
        lifecycle_status: document.getElementById('lifecycleStatus').value || null,
        lifecycle_effective_start_date: document.getElementById('effectiveStartDate').value || null,
        lifecycle_effective_end_date: document.getElementById('effectiveEndDate').value || null,
        supersedes_exercise_id: document.getElementById('supersedesExercise')?.value || null,
        superseded_by_exercise_id: document.getElementById('supersededByExercise')?.value || null,
        superseded_date: document.getElementById('supersededDate')?.value || null,
        added_date: document.getElementById('addedDate')?.value || null,
        updated_date: document.getElementById('updatedDate')?.value || null,
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
            <button type="button" class="btn-danger" onclick="removeRoleRow(this)">Remove</button>
        </td>
    `;

    if (role.region) row.querySelector('.role-region').value = role.region;
    if (role.capacity) row.querySelector('.role-capacity').value = role.capacity;
    if (role.focus) row.querySelector('.role-focus').value = role.focus;
    if (role.contribution) row.querySelector('.role-contribution').value = role.contribution;

    tbody.appendChild(row);
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
        const url = isUpdate ? `/api/exercises/${exerciseId}` : '/api/exercises';

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
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: var(--ios-blue); color: white; font-size: 11px; font-weight: 600; margin-right: 8px;">${role.contribution.toUpperCase()}</span>
                    <strong>${role.region}</strong> / ${role.capacity}${role.focus ? ' / ' + role.focus : ''}
                </div>
                <button type="button" class="btn-danger" onclick="removeRole('${role.id}')" style="padding: 6px 12px; font-size: 12px;">Remove</button>
            </div>
        `).join('');
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

async function loadExerciseDosage() {
    const exerciseId = document.getElementById('dosageExerciseSelect').value;

    if (!exerciseId) {
        document.getElementById('currentDosageDisplay').classList.add('hidden');
        document.getElementById('editDosageForm').classList.add('hidden');
        selectedExerciseForDosage = null;
        return;
    }

    selectedExerciseForDosage = allExercises.find(ex => ex.id === exerciseId);
    if (!selectedExerciseForDosage) return;

    // Show/hide conditional fields based on pattern modifiers
    const modifiers = selectedExerciseForDosage.pattern_modifiers || [];
    const hasHold = modifiers.includes('hold_seconds');
    const hasDuration = modifiers.includes('duration_seconds');
    const hasDistance = modifiers.includes('distance_feet');
    const isUnilateral = selectedExerciseForDosage.pattern === 'side';

    // Toggle visibility of conditional fields
    document.getElementById('dosageSecondsGroup').classList.toggle('hidden', !(hasHold || hasDuration));
    document.getElementById('dosageDistanceGroup').classList.toggle('hidden', !hasDistance);

    // Update label based on modifier type
    if (hasHold) {
        document.getElementById('dosageSecondsLabel').textContent = 'Hold Seconds';
    } else if (hasDuration) {
        document.getElementById('dosageSecondsLabel').textContent = 'Duration Seconds';
    }

    // Show the form
    document.getElementById('editDosageForm').classList.remove('hidden');

    // Clear/reset fields
    document.getElementById('dosageSets').value = '';
    document.getElementById('dosageReps').value = '';
    document.getElementById('dosageSeconds').value = '';
    document.getElementById('dosageDistance').value = '';

    toast('Select dosage parameters below', 'success');
}

window.loadExerciseDosage = loadExerciseDosage;

async function updateDosage() {
    const sets = document.getElementById('dosageSets').value;
    const reps = document.getElementById('dosageReps').value;

    if (!selectedExerciseForDosage) {
        toast('Please select an exercise first', 'error');
        return;
    }

    if (!sets || !reps) {
        toast('Please fill in sets and reps', 'error');
        return;
    }

    const dosageData = {
        patient_id: currentUser.id,
        exercise_id: selectedExerciseForDosage.id,
        sets: parseInt(sets),
        reps_per_set: parseInt(reps)
    };

    // Add optional fields if visible
    const modifiers = selectedExerciseForDosage.pattern_modifiers || [];
    if (modifiers.includes('hold_seconds') || modifiers.includes('duration_seconds')) {
        const seconds = document.getElementById('dosageSeconds').value;
        if (seconds) dosageData.seconds_per_rep = parseInt(seconds);
    }

    if (modifiers.includes('distance_feet')) {
        const distance = document.getElementById('dosageDistance').value;
        if (distance) dosageData.distance_feet = parseInt(distance);
    }

    try {
        // Check if program exists
        const response = await fetchWithAuth(`/api/programs?patient_id=${currentUser.id}`);
        const programs = response.programs || [];
        const existing = programs.find(p => p.exercise_id === selectedExerciseForDosage.id);

        if (existing) {
            // Update existing program
            await fetchWithAuth(`/api/programs/${existing.id}`, {
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
