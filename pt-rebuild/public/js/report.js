/**
 * PT Therapist Portal
 */

const SUPABASE_URL = 'https://zvgoaxdpkgfxklotqwpz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pdyqh56HqQQ6OfHl3GG11A_W6IxqqWp';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentPatient = null;
let allExercises = [];
let currentExercise = null;
let currentAssignment = null;

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await onLogin();
  }

  bindEvents();
}

function bindEvents() {
  document.addEventListener('pointerup', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    if (!action || target.disabled) return;

    try {
      switch (action) {
        case 'toggle-menu':
          toggleMenu();
          break;
        case 'close-menu':
          closeMenu();
          break;
        case 'reload-app':
          window.location.reload();
          break;
        case 'show-login':
          showLoginForm();
          break;
        case 'login':
          await handleLogin();
          break;
        case 'logout':
          await handleLogout();
          break;
        case 'show-exercises':
          showExercisesView();
          break;
        case 'show-assignments':
          showAssignmentsView();
          break;
        case 'add-exercise':
          openExerciseModal();
          break;
        case 'edit-exercise':
          editExercise(target.dataset.exerciseId);
          break;
        case 'delete-exercise':
          await deleteExercise(target.dataset.exerciseId);
          break;
        case 'close-modal':
          closeExerciseModal();
          break;
        case 'save-exercise':
          await saveExercise();
          break;
        case 'assign-exercise':
          openAssignmentModal();
          break;
        case 'edit-assignment':
          editAssignment(target.dataset.assignmentId);
          break;
        case 'delete-assignment':
          await deleteAssignment(target.dataset.assignmentId);
          break;
        case 'close-assign-modal':
          closeAssignmentModal();
          break;
        case 'save-assignment':
          await saveAssignment();
          break;
      }
    } catch (error) {
      console.error(`Action '${action}' failed:`, error);
      alert(`Action failed: ${error.message}`);
    }
  });

  // Patient selection
  document.getElementById('patient-dropdown').addEventListener('change', (e) => {
    currentPatient = e.target.value;
    if (document.getElementById('assignments-view').style.display !== 'none') {
      loadAssignments();
    }
  });

  // Exercise search
  document.getElementById('exercise-search').addEventListener('input', filterExercises);
}

function toggleMenu() {
  const dropdown = document.getElementById('menu-dropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function closeMenu() {
  document.getElementById('menu-dropdown').style.display = 'none';
}

function showLoginForm() {
  document.getElementById('show-login-btn').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('email').focus();
}

async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');

  if (!email || !password) {
    errorEl.textContent = 'Email and password required';
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  currentUser = data.user;
  await onLogin();
}

async function onLogin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('portal-screen').style.display = 'block';

  await loadPatients();
  await loadExercises();
}

async function handleLogout() {
  await supabase.auth.signOut();
  window.location.reload();
}

async function loadPatients() {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return;

  // For now, hardcode single patient (therapist can see their patients)
  const dropdown = document.getElementById('patient-dropdown');

  // In production, fetch from /api/patients or similar
  // For now, use the known patient ID from migration
  dropdown.innerHTML = '<option value="">Select patient...</option>';

  // Hardcoded for single-patient system
  const response = await fetch('/api/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    const { users } = await response.json();
    users.filter(u => u.role === 'patient').forEach(patient => {
      const option = document.createElement('option');
      option.value = patient.id;
      option.textContent = patient.email;
      dropdown.appendChild(option);
    });
  }
}

async function loadExercises() {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return;

  const response = await fetch('/api/exercises', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    console.error('Failed to load exercises');
    return;
  }

  const { exercises } = await response.json();
  allExercises = exercises;
  displayExercises(exercises);
}

function displayExercises(exercises) {
  const list = document.getElementById('exercise-list');
  list.innerHTML = '';

  exercises.forEach(ex => {
    const li = document.createElement('li');
    li.style.cssText = 'background: white; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 8px;';

    li.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <strong style="display: block; font-size: 16px; color: #2c3e50; margin-bottom: 4px;">${escapeHtml(ex.canonical_name)}</strong>
          <span style="font-size: 14px; color: #7f8c8d; display: block; margin-bottom: 4px;">${escapeHtml(ex.description)}</span>
          <span style="font-size: 12px; color: #95a5a6;">Category: ${escapeHtml(ex.pt_category)} | Pattern: ${escapeHtml(ex.pattern)}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button data-action="edit-exercise" data-exercise-id="${escapeHtml(ex.id)}" style="padding: 8px 12px; background: #3498db; color: white; border: none; border-radius: 4px; font-size: 14px;">Edit</button>
          <button data-action="delete-exercise" data-exercise-id="${escapeHtml(ex.id)}" style="padding: 8px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-size: 14px;">Archive</button>
        </div>
      </div>
    `;

    list.appendChild(li);
  });
}

function filterExercises() {
  const query = document.getElementById('exercise-search').value.toLowerCase();
  const filtered = allExercises.filter(ex =>
    ex.canonical_name.toLowerCase().includes(query) ||
    ex.description.toLowerCase().includes(query)
  );
  displayExercises(filtered);
}

function showExercisesView() {
  document.getElementById('exercises-view').style.display = 'block';
  document.getElementById('assignments-view').style.display = 'none';

  // Update tab styling
  const tabs = document.querySelectorAll('nav[style*="sticky"] button');
  tabs[0].style.color = '#3498db';
  tabs[0].style.borderBottom = '3px solid #3498db';
  tabs[1].style.color = '#7f8c8d';
  tabs[1].style.borderBottom = 'none';
}

function showAssignmentsView() {
  document.getElementById('exercises-view').style.display = 'none';
  document.getElementById('assignments-view').style.display = 'block';

  // Update tab styling
  const tabs = document.querySelectorAll('nav[style*="sticky"] button');
  tabs[0].style.color = '#7f8c8d';
  tabs[0].style.borderBottom = 'none';
  tabs[1].style.color = '#3498db';
  tabs[1].style.borderBottom = '3px solid #3498db';

  if (currentPatient) {
    loadAssignments();
  }
}

async function loadAssignments() {
  if (!currentPatient) {
    document.getElementById('no-patient-msg').style.display = 'block';
    document.getElementById('assignments-content').style.display = 'none';
    return;
  }

  document.getElementById('no-patient-msg').style.display = 'none';
  document.getElementById('assignments-content').style.display = 'block';

  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const response = await fetch(`/api/programs?patient_id=${currentPatient}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    console.error('Failed to load assignments');
    return;
  }

  const { programs } = await response.json();
  displayAssignments(programs);
}

function displayAssignments(programs) {
  const list = document.getElementById('assignments-list');
  list.innerHTML = '';

  programs.forEach(prog => {
    const ex = prog.exercises;
    const li = document.createElement('li');
    li.style.cssText = 'background: white; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 8px;';

    let dosageText = `${prog.sets} sets`;
    if (prog.reps_per_set) dosageText += ` × ${prog.reps_per_set} reps`;
    if (prog.seconds_per_set) dosageText += ` × ${prog.seconds_per_set}s`;

    li.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <strong style="display: block; font-size: 16px; color: #2c3e50; margin-bottom: 4px;">${escapeHtml(ex.canonical_name)}</strong>
          <span style="font-size: 14px; color: #7f8c8d; display: block; margin-bottom: 4px;">${escapeHtml(dosageText)}</span>
          <span style="font-size: 12px; color: #95a5a6;">Type: ${escapeHtml(prog.dosage_type)}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button data-action="edit-assignment" data-assignment-id="${escapeHtml(prog.id)}" style="padding: 8px 12px; background: #3498db; color: white; border: none; border-radius: 4px; font-size: 14px;">Edit</button>
          <button data-action="delete-assignment" data-assignment-id="${escapeHtml(prog.id)}" style="padding: 8px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-size: 14px;">Remove</button>
        </div>
      </div>
    `;

    list.appendChild(li);
  });
}

function openExerciseModal(exercise = null) {
  currentExercise = exercise;

  document.getElementById('modal-title').textContent = exercise ? 'Edit Exercise' : 'Add Exercise';
  document.getElementById('edit-id').value = exercise?.id || '';
  document.getElementById('edit-id').disabled = !!exercise;
  document.getElementById('edit-name').value = exercise?.canonical_name || '';
  document.getElementById('edit-description').value = exercise?.description || '';
  document.getElementById('edit-category').value = exercise?.pt_category || 'other';
  document.getElementById('edit-pattern').value = exercise?.pattern || 'both';

  document.getElementById('exercise-modal').style.display = 'block';
}

function closeExerciseModal() {
  document.getElementById('exercise-modal').style.display = 'none';
  currentExercise = null;
}

function editExercise(exerciseId) {
  const exercise = allExercises.find(ex => ex.id === exerciseId);
  if (exercise) {
    openExerciseModal(exercise);
  }
}

async function saveExercise() {
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const exercise = {
    id: document.getElementById('edit-id').value.trim(),
    canonical_name: document.getElementById('edit-name').value.trim(),
    description: document.getElementById('edit-description').value.trim(),
    pt_category: document.getElementById('edit-category').value,
    pattern: document.getElementById('edit-pattern').value
  };

  if (!exercise.id || !exercise.canonical_name || !exercise.description) {
    alert('Please fill in all required fields');
    return;
  }

  const isEdit = !!currentExercise;
  const response = await fetch('/api/exercises', {
    method: isEdit ? 'PUT' : 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ exercise })
  });

  if (!response.ok) {
    const error = await response.json();
    alert('Failed to save exercise: ' + (error.details || error.error));
    return;
  }

  closeExerciseModal();
  await loadExercises();
}

async function deleteExercise(exerciseId) {
  if (!confirm('Archive this exercise? It will be hidden from the library.')) {
    return;
  }

  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const response = await fetch(`/api/exercises?id=${exerciseId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    alert('Failed to archive exercise');
    return;
  }

  await loadExercises();
}

function openAssignmentModal(assignment = null) {
  currentAssignment = assignment;

  // Populate exercise dropdown
  const select = document.getElementById('assign-exercise');
  select.innerHTML = '<option value="">Select exercise...</option>';
  allExercises.filter(ex => !ex.archived).forEach(ex => {
    const option = document.createElement('option');
    option.value = ex.id;
    option.textContent = ex.canonical_name;
    if (assignment && assignment.exercise_id === ex.id) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  document.getElementById('assign-dosage-type').value = assignment?.dosage_type || 'reps';
  document.getElementById('assign-sets').value = assignment?.sets || 3;
  document.getElementById('assign-reps').value = assignment?.reps_per_set || 10;
  document.getElementById('assign-seconds').value = assignment?.seconds_per_set || 0;

  document.getElementById('assignment-modal').style.display = 'block';
}

function closeAssignmentModal() {
  document.getElementById('assignment-modal').style.display = 'none';
  currentAssignment = null;
}

function editAssignment(assignmentId) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  fetch(`/api/programs?patient_id=${currentPatient}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(({ programs }) => {
    const assignment = programs.find(p => p.id === assignmentId);
    if (assignment) {
      openAssignmentModal(assignment);
    }
  });
}

async function saveAssignment() {
  if (!currentPatient) {
    alert('Please select a patient first');
    return;
  }

  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const data = {
    patient_id: currentPatient,
    exercise_id: document.getElementById('assign-exercise').value,
    dosage_type: document.getElementById('assign-dosage-type').value,
    sets: parseInt(document.getElementById('assign-sets').value),
    reps_per_set: parseInt(document.getElementById('assign-reps').value) || null,
    seconds_per_set: parseInt(document.getElementById('assign-seconds').value) || null
  };

  if (!data.exercise_id) {
    alert('Please select an exercise');
    return;
  }

  const isEdit = !!currentAssignment;
  if (isEdit) {
    data.id = currentAssignment.id;
  }

  const response = await fetch('/api/programs', {
    method: isEdit ? 'PUT' : 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    alert('Failed to save assignment: ' + (error.details || error.error));
    return;
  }

  closeAssignmentModal();
  await loadAssignments();
}

async function deleteAssignment(assignmentId) {
  if (!confirm('Remove this assignment from the patient?')) {
    return;
  }

  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const response = await fetch(`/api/programs?id=${assignmentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    alert('Failed to remove assignment');
    return;
  }

  await loadAssignments();
}

// Initialize
init();
