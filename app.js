/**
 * Jake's Resume Builder - Application Logic
 * Reactive synchronization between Form State, Visual Preview, and LaTeX Generator
 */

// Global Application State initialized with Jake Ryan Original Preset
let resumeState = JSON.parse(JSON.stringify(BTECH_PRESETS.jake));
if (!resumeState.sectionOrder) {
  resumeState.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
}
if (!resumeState.introduction) {
  resumeState.introduction = { enabled: false, text: '' };
}
if (!resumeState.customSections) {
  resumeState.customSections = [];
}
if (!resumeState.personal.tagline) {
  resumeState.personal.tagline = '';
}
if (typeof normalizeSkills === 'function') {
  resumeState.skills = normalizeSkills(resumeState.skills);
}

const SECTION_METADATA = {
  introduction: { id: 'sec-intro', title: 'Introduction / Summary', shortTitle: 'Intro', icon: '📝' },
  education: { id: 'sec-education', title: 'Education', shortTitle: 'Education', icon: '🎓' },
  experience: { id: 'sec-experience', title: 'Experience', shortTitle: 'Experience', icon: '💼' },
  projects: { id: 'sec-projects', title: 'Projects', shortTitle: 'Projects', icon: '🚀' },
  skills: { id: 'sec-skills', title: 'Technical Skills', shortTitle: 'Skills', icon: '⚡' },
  certifications: { id: 'sec-certs', title: 'Certifications', shortTitle: 'Certs', icon: '📜' },
  achievements: { id: 'sec-honors', title: 'Honors & Achievements', shortTitle: 'Honors', icon: '🏆' }
};

let currentOptions = {
  fontSize: '11pt',
  paperSize: 'letterpaper',
  sectionSpacing: '-4pt',
  itemSpacing: '-2pt',
  showCertifications: true,
  showAchievements: true,
  nameSize: 'Huge',
  sectionHeaderSize: 'large',
  sectionAccentColor: 'black'
};

let currentZoom = 0.85;

// DOM Element References
const appContainer = document.getElementById('app-container');
const formPane = document.getElementById('form-pane');
const visualResume = document.getElementById('visual-resume');
const latexCodeOutput = document.getElementById('latex-code-output');
const pageCounterBadge = document.getElementById('page-counter-badge');
const toastNotice = document.getElementById('toast-notice');
const toastMessage = document.getElementById('toast-message');

/* ==========================================================================
   Multi-Resume Profiles & Continuous Auto-Save System
   ========================================================================== */
const STORAGE_KEY = 'jake_resume_draft_v1';
const PROFILES_STORAGE_KEY = 'jake_resume_profiles_v1';
const ACTIVE_PROFILE_ID_KEY = 'jake_active_profile_id_v1';
const SPLIT_STORAGE_KEY = 'jake_split_ratio_v1';

let resumeProfiles = [];
let activeProfileId = 'prof_default';
let isAutoSaveSuspended = false;
let autoSaveTimer = null;
let lastSavedTimestamp = null;

function formatSavedTime(timestamp) {
  if (!timestamp) return 'Saved';
  const date = new Date(timestamp);
  return `Saved ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function updateAutosaveStatus(status, text) {
  const dot = document.querySelector('.autosave-dot');
  const label = document.getElementById('autosave-label');
  const indicator = document.getElementById('autosave-status');

  if (dot) {
    dot.className = `autosave-dot ${status}`;
  }
  if (label && text) {
    label.textContent = text;
  }
  if (indicator && lastSavedTimestamp) {
    indicator.title = `Last auto-saved: ${new Date(lastSavedTimestamp).toLocaleString()}. Active profile: "${getActiveProfileName()}". Edits are continuously auto-saved.`;
  }
}

function getActiveProfileName() {
  const p = resumeProfiles.find(item => item.id === activeProfileId);
  return p ? p.name : 'Default Profile';
}

function scheduleAutoSave() {
  if (isAutoSaveSuspended) return;

  updateAutosaveStatus('saving', 'Saving...');
  clearTimeout(autoSaveTimer);

  autoSaveTimer = setTimeout(() => {
    try {
      lastSavedTimestamp = Date.now();
      
      // Update active profile in resumeProfiles
      const profIdx = resumeProfiles.findIndex(p => p.id === activeProfileId);
      if (profIdx !== -1) {
        resumeProfiles[profIdx].state = JSON.parse(JSON.stringify(resumeState));
        resumeProfiles[profIdx].options = JSON.parse(JSON.stringify(currentOptions));
        resumeProfiles[profIdx].updatedAt = lastSavedTimestamp;
      }

      saveProfilesToStorage();
      updateAutosaveStatus('saved', formatSavedTime(lastSavedTimestamp));
    } catch (err) {
      console.error('Failed to auto-save draft to localStorage:', err);
      updateAutosaveStatus('error', 'Save error');
    }
  }, 400);
}

function saveProfilesToStorage() {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(resumeProfiles));
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, activeProfileId);

    // Backward compatibility with older single-draft key
    const currentProf = resumeProfiles.find(p => p.id === activeProfileId);
    if (currentProf) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: currentProf.state,
        options: currentProf.options,
        updatedAt: currentProf.updatedAt
      }));
    }
  } catch (err) {
    console.error('Error saving profiles to localStorage:', err);
  }
}

function initProfiles() {
  try {
    const rawProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
    const savedActiveId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);

    if (rawProfiles) {
      resumeProfiles = JSON.parse(rawProfiles);
    }

    if (!Array.isArray(resumeProfiles) || resumeProfiles.length === 0) {
      // Migrate from old single draft or seed from preset
      const rawDraft = localStorage.getItem(STORAGE_KEY);
      let initialDraftState = null;
      let initialOptions = null;
      let initialTimestamp = Date.now();

      if (rawDraft) {
        try {
          const parsed = JSON.parse(rawDraft);
          if (parsed && parsed.state && parsed.state.personal) {
            initialDraftState = parsed.state;
            initialOptions = parsed.options;
            initialTimestamp = parsed.updatedAt || Date.now();
          }
        } catch (e) {
          console.warn(e);
        }
      }

      if (!initialDraftState) {
        initialDraftState = JSON.parse(JSON.stringify(BTECH_PRESETS.sde || BTECH_PRESETS.jake));
      }

      const defaultProfile = {
        id: 'prof_default',
        name: 'Resume - SDE Profile',
        state: initialDraftState,
        options: initialOptions || { ...currentOptions },
        updatedAt: initialTimestamp
      };

      resumeProfiles = [defaultProfile];
      activeProfileId = 'prof_default';
      saveProfilesToStorage();
    } else {
      activeProfileId = savedActiveId && resumeProfiles.some(p => p.id === savedActiveId)
        ? savedActiveId
        : resumeProfiles[0].id;
    }

    // Load active profile into memory
    const currentProf = resumeProfiles.find(p => p.id === activeProfileId) || resumeProfiles[0];
    if (currentProf && currentProf.state) {
      resumeState = currentProf.state;
      if (currentProf.options) {
        currentOptions = { ...currentOptions, ...currentProf.options };
      }
      lastSavedTimestamp = currentProf.updatedAt || Date.now();
    }

    if (!resumeState.sectionOrder) {
      resumeState.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
    }
    if (!resumeState.introduction) {
      resumeState.introduction = { enabled: false, text: '' };
    }
    if (!resumeState.customSections) {
      resumeState.customSections = [];
    }
    if (resumeState.personal && !resumeState.personal.tagline) {
      resumeState.personal.tagline = '';
    }
    if (typeof normalizeSkills === 'function') {
      resumeState.skills = normalizeSkills(resumeState.skills);
    }

    populateProfileDropdown();
    return true;
  } catch (err) {
    console.error('Failed to initialize profiles:', err);
    return false;
  }
}

function populateProfileDropdown() {
  const select = document.getElementById('profile-select');
  if (!select) return;
  select.innerHTML = '';
  resumeProfiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === activeProfileId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function handleProfileSelectChange(selectedId) {
  if (selectedId && selectedId !== activeProfileId) {
    switchProfile(selectedId);
  }
}
window.handleProfileSelectChange = handleProfileSelectChange;

function switchProfile(newProfileId) {
  if (newProfileId === activeProfileId) return;

  // Auto-save current active profile first synchronously
  const currentIdx = resumeProfiles.findIndex(p => p.id === activeProfileId);
  if (currentIdx !== -1) {
    resumeProfiles[currentIdx].state = JSON.parse(JSON.stringify(resumeState));
    resumeProfiles[currentIdx].options = JSON.parse(JSON.stringify(currentOptions));
    resumeProfiles[currentIdx].updatedAt = Date.now();
  }

  const targetProf = resumeProfiles.find(p => p.id === newProfileId);
  if (!targetProf) return;

  activeProfileId = targetProf.id;
  resumeState = JSON.parse(JSON.stringify(targetProf.state));
  if (targetProf.options) {
    currentOptions = { ...currentOptions, ...targetProf.options };
  }
  lastSavedTimestamp = targetProf.updatedAt || Date.now();

  if (!resumeState.sectionOrder) {
    resumeState.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
  }
  if (!resumeState.customSections) {
    resumeState.customSections = [];
  }
  if (!resumeState.introduction) {
    resumeState.introduction = { enabled: false, text: '' };
  }
  if (typeof normalizeSkills === 'function') {
    resumeState.skills = normalizeSkills(resumeState.skills);
  }

  saveProfilesToStorage();
  populateProfileDropdown();
  populateFormFromState();
  updatePreviews(false);
  renderProfilesModalList();

  updateAutosaveStatus('saved', formatSavedTime(lastSavedTimestamp));
  showToast(`Switched to: ${targetProf.name}`);
}
window.switchProfile = switchProfile;

function openProfilesModal() {
  const modal = document.getElementById('profiles-modal');
  if (!modal) return;
  renderProfilesModalList();
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('open'));
}
window.openProfilesModal = openProfilesModal;

function closeProfilesModal() {
  const modal = document.getElementById('profiles-modal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 200);
}
window.closeProfilesModal = closeProfilesModal;

function renderProfilesModalList() {
  const container = document.getElementById('profiles-list-container');
  if (!container) return;
  container.innerHTML = '';

  resumeProfiles.forEach((p) => {
    const isActive = p.id === activeProfileId;
    const item = document.createElement('div');
    item.className = `profile-card-item ${isActive ? 'active' : ''}`;

    const timeStr = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';
    const numProjects = p.state?.projects?.length || 0;
    const numRoles = p.state?.experience?.length || 0;

    item.innerHTML = `
      <div class="profile-info">
        <div class="profile-title-row">
          <span class="profile-title-text">${escapeHtml(p.name)}</span>
          ${isActive ? '<span class="profile-badge-active">Active</span>' : ''}
        </div>
        <span class="profile-meta-text">Updated: ${timeStr} &bull; ${numProjects} Projects &bull; ${numRoles} Roles</span>
      </div>
      <div class="profile-item-actions">
        ${!isActive ? `<button type="button" class="btn btn-sm btn-emerald" onclick="switchProfile('${p.id}')">Switch</button>` : ''}
        <button type="button" class="btn btn-sm btn-secondary" onclick="handleDuplicateProfile('${p.id}')" title="Clone profile">Duplicate</button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="handleRenameProfile('${p.id}')" title="Rename profile">Rename</button>
        <button type="button" class="btn btn-sm btn-danger" onclick="handleDeleteProfile('${p.id}')" ${resumeProfiles.length <= 1 ? 'disabled' : ''} title="${resumeProfiles.length <= 1 ? 'Cannot delete the only profile' : 'Delete profile'}">Delete</button>
      </div>
    `;
    container.appendChild(item);
  });
}
window.renderProfilesModalList = renderProfilesModalList;

function handleCreateNewProfile(cloneCurrent = false) {
  const input = document.getElementById('inp-new-profile-name');
  const name = (input && input.value.trim()) ? input.value.trim() : `Resume Profile ${resumeProfiles.length + 1}`;

  // Make sure current profile state is preserved in array
  const currentIdx = resumeProfiles.findIndex(p => p.id === activeProfileId);
  if (currentIdx !== -1) {
    resumeProfiles[currentIdx].state = JSON.parse(JSON.stringify(resumeState));
    resumeProfiles[currentIdx].options = JSON.parse(JSON.stringify(currentOptions));
    resumeProfiles[currentIdx].updatedAt = Date.now();
  }

  const newId = 'prof_' + Date.now();
  const newState = cloneCurrent
    ? JSON.parse(JSON.stringify(resumeState))
    : JSON.parse(JSON.stringify(BTECH_PRESETS.jake));

  const newProfile = {
    id: newId,
    name: name,
    state: newState,
    options: cloneCurrent ? { ...currentOptions } : { fontSize: '11pt', paperSize: 'letterpaper', sectionSpacing: '-4pt', itemSpacing: '-2pt', showCertifications: true, showAchievements: true },
    updatedAt: Date.now()
  };

  resumeProfiles.push(newProfile);
  if (input) input.value = '';

  saveProfilesToStorage();
  switchProfile(newId);
  showToast(`✓ Created new profile: ${name}`);
}
window.handleCreateNewProfile = handleCreateNewProfile;

function handleDuplicateProfile(profileId) {
  const source = resumeProfiles.find(p => p.id === profileId);
  if (!source) return;

  const newId = 'prof_' + Date.now();
  const newProfile = {
    id: newId,
    name: `${source.name} (Copy)`,
    state: JSON.parse(JSON.stringify(source.state)),
    options: JSON.parse(JSON.stringify(source.options)),
    updatedAt: Date.now()
  };

  resumeProfiles.push(newProfile);
  saveProfilesToStorage();
  renderProfilesModalList();
  populateProfileDropdown();
  showToast(`✓ Duplicated profile: ${source.name}`);
}
window.handleDuplicateProfile = handleDuplicateProfile;

function handleRenameProfile(profileId) {
  const target = resumeProfiles.find(p => p.id === profileId);
  if (!target) return;

  const newName = prompt('Enter new profile name:', target.name);
  if (!newName || !newName.trim()) return;

  target.name = newName.trim();
  target.updatedAt = Date.now();

  saveProfilesToStorage();
  renderProfilesModalList();
  populateProfileDropdown();
  showToast(`✓ Renamed profile to "${target.name}"`);
}
window.handleRenameProfile = handleRenameProfile;

function handleDeleteProfile(profileId) {
  if (resumeProfiles.length <= 1) {
    alert('You must keep at least one profile.');
    return;
  }

  const target = resumeProfiles.find(p => p.id === profileId);
  if (!target) return;

  const confirmDelete = confirm(`Are you sure you want to delete profile "${target.name}"?\nThis cannot be undone.`);
  if (!confirmDelete) return;

  const wasActive = (profileId === activeProfileId);
  resumeProfiles = resumeProfiles.filter(p => p.id !== profileId);

  if (wasActive) {
    activeProfileId = resumeProfiles[0].id;
    resumeState = JSON.parse(JSON.stringify(resumeProfiles[0].state));
    currentOptions = JSON.parse(JSON.stringify(resumeProfiles[0].options));
    lastSavedTimestamp = resumeProfiles[0].updatedAt || Date.now();
    populateFormFromState();
    updatePreviews(false);
  }

  saveProfilesToStorage();
  renderProfilesModalList();
  populateProfileDropdown();
  showToast(`Deleted profile: ${target.name}`);
}
window.handleDeleteProfile = handleDeleteProfile;

/**
 * Initialize Application
 */
function initApp() {
  isAutoSaveSuspended = true;
  initProfiles();
  populateFormFromState();
  updatePreviews(false);
  setupEventListeners();
  setupSplitterResizer();
  setupDragAndDropReordering();
  setupVisualClickToEdit();
  applyZoom(currentZoom);
  isAutoSaveSuspended = false;

  updateAutosaveStatus('saved', formatSavedTime(lastSavedTimestamp));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

/**
 * Populate all form inputs based on current resumeState
 */
function populateFormFromState() {
  // Ensure displays default to clean site names if empty or if containing URLs/slashes
  if (resumeState.personal.linkedin && (!resumeState.personal.linkedinDisplay || resumeState.personal.linkedinDisplay.includes('/'))) {
    resumeState.personal.linkedinDisplay = 'LinkedIn';
  }
  if (resumeState.personal.github && (!resumeState.personal.githubDisplay || resumeState.personal.githubDisplay.includes('/'))) {
    resumeState.personal.githubDisplay = 'GitHub';
  }
  if (resumeState.personal.leetcode && (!resumeState.personal.leetcodeDisplay || resumeState.personal.leetcodeDisplay.includes('/'))) {
    resumeState.personal.leetcodeDisplay = typeof getSiteDisplayName === 'function' 
      ? getSiteDisplayName(resumeState.personal.leetcode, '', 'LeetCode') 
      : 'LeetCode';
  }
  if (resumeState.personal.portfolio && (!resumeState.personal.portfolioDisplay || resumeState.personal.portfolioDisplay.includes('/'))) {
    resumeState.personal.portfolioDisplay = 'Portfolio';
  }

  // Personal Info
  document.getElementById('inp-name').value = resumeState.personal.fullName || '';
  const inpTagline = document.getElementById('inp-tagline');
  if (inpTagline) inpTagline.value = resumeState.personal.tagline || '';
  document.getElementById('inp-phone').value = resumeState.personal.phone || '';
  document.getElementById('inp-email').value = resumeState.personal.email || '';
  document.getElementById('inp-linkedin').value = resumeState.personal.linkedin || '';
  document.getElementById('inp-linkedin-display').value = resumeState.personal.linkedinDisplay || '';
  document.getElementById('inp-github').value = resumeState.personal.github || '';
  document.getElementById('inp-github-display').value = resumeState.personal.githubDisplay || '';
  document.getElementById('inp-leetcode').value = resumeState.personal.leetcode || '';
  document.getElementById('inp-leetcode-display').value = resumeState.personal.leetcodeDisplay || '';
  document.getElementById('inp-portfolio').value = resumeState.personal.portfolio || '';
  const portDisp = document.getElementById('inp-portfolio-display');
  if (portDisp) portDisp.value = resumeState.personal.portfolioDisplay || '';

  // Update Test Link buttons
  updateTestLink('test-linkedin', resumeState.personal.linkedin);
  updateTestLink('test-github', resumeState.personal.github);

  // Introduction Section
  renderIntroductionSection();

  // Dynamic Skills List
  renderSkillsList();

  // Render Dynamic Repeatable Lists
  renderEducationList();
  renderExperienceList();
  renderProjectsList();
  renderCertificationsList();
  renderAchievementsList();

  // Render Dynamic Custom Sections
  renderCustomSectionsList();

  // Reorder Form Section Cards in DOM
  reorderFormSectionCards();

  // Typography Options Sync
  const optNameSize = document.getElementById('opt-name-size');
  if (optNameSize) optNameSize.value = currentOptions.nameSize || 'Huge';

  const optModalNameSize = document.getElementById('modal-opt-name-size') || document.getElementById('opt-modal-name-size');
  if (optModalNameSize) optModalNameSize.value = currentOptions.nameSize || 'Huge';

  const optModalSecSize = document.getElementById('modal-opt-sec-size') || document.getElementById('opt-modal-sec-size');
  if (optModalSecSize) optModalSecSize.value = currentOptions.sectionHeaderSize || 'large';

  const optModalBodySize = document.getElementById('modal-opt-body-size') || document.getElementById('opt-modal-body-size');
  if (optModalBodySize) optModalBodySize.value = currentOptions.fontSize || '11pt';

  const optModalAccentColor = document.getElementById('modal-opt-sec-color') || document.getElementById('opt-modal-accent-color');
  if (optModalAccentColor) optModalAccentColor.value = currentOptions.sectionAccentColor || 'black';
}

function updateTestLink(elemId, url) {
  const el = document.getElementById(elemId);
  if (el) {
    if (url && url.trim()) {
      el.href = normalizeUrl(url);
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
    }
  }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Profile Selector
  const profileSelect = document.getElementById('profile-select');
  if (profileSelect) {
    profileSelect.addEventListener('change', (e) => {
      handleProfileSelectChange(e.target.value);
    });
  }

  // Preset Switcher
  document.getElementById('preset-select').addEventListener('change', (e) => {
    const selected = e.target.value;
    if (BTECH_PRESETS[selected]) {
      const hasCustomEdits = resumeState.personal.fullName && resumeState.personal.fullName !== 'Jake Ryan';
      if (hasCustomEdits) {
        const confirmSwitch = confirm(`Load the ${e.target.options[e.target.selectedIndex].text} preset?\n\nThis will replace your current edits. (Tip: You can click "Backup" first to save a copy).`);
        if (!confirmSwitch) {
          e.target.value = 'jake';
          return;
        }
      }
      resumeState = JSON.parse(JSON.stringify(BTECH_PRESETS[selected]));
      if (!resumeState.sectionOrder) {
        resumeState.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
      }
      if (!resumeState.customSections) {
        resumeState.customSections = [];
      }
      if (!resumeState.introduction) {
        resumeState.introduction = { enabled: false, text: '' };
      }
      if (typeof normalizeSkills === 'function') {
        resumeState.skills = normalizeSkills(resumeState.skills);
      }
      // Reset options to default
      currentOptions.fontSize = '11pt';
      currentOptions.sectionSpacing = '-4pt';
      currentOptions.itemSpacing = '-2pt';
      if (visualResume) visualResume.classList.remove('compact-mode');
      populateFormFromState();
      updatePreviews();
      showToast(`Loaded ${e.target.options[e.target.selectedIndex].text}`);
    }
  });

  // View Mode Buttons (Split / Form Only / Preview Only)
  const btnSplit = document.getElementById('btn-view-split');
  const btnForm = document.getElementById('btn-view-form');
  const btnPreview = document.getElementById('btn-view-preview');

  btnSplit.addEventListener('click', () => {
    appContainer.className = 'app-container view-split';
    btnSplit.classList.add('active');
    btnForm.classList.remove('active');
    btnPreview.classList.remove('active');
    applyZoom(0.85);
  });

  btnForm.addEventListener('click', () => {
    appContainer.className = 'app-container view-form-only';
    btnForm.classList.add('active');
    btnSplit.classList.remove('active');
    btnPreview.classList.remove('active');
  });

  btnPreview.addEventListener('click', () => {
    appContainer.className = 'app-container view-preview-only';
    btnPreview.classList.add('active');
    btnSplit.classList.remove('active');
    btnForm.classList.remove('active');
    applyZoom(1.0);
  });

  // Expand / Collapse All Cards
  const btnToggleAll = document.getElementById('btn-toggle-all');
  let allCollapsed = false;
  btnToggleAll.addEventListener('click', () => {
    allCollapsed = !allCollapsed;
    document.querySelectorAll('.section-card').forEach(card => {
      if (allCollapsed) {
        card.classList.add('collapsed');
      } else {
        card.classList.remove('collapsed');
      }
    });
    btnToggleAll.innerText = allCollapsed ? 'Expand All' : 'Collapse All';
  });

  // Personal Info Inputs
  const personalInputs = [
    { id: 'inp-name', key: 'fullName' },
    { id: 'inp-tagline', key: 'tagline' },
    { id: 'inp-phone', key: 'phone' },
    { id: 'inp-email', key: 'email' },
    { id: 'inp-linkedin', key: 'linkedin', testId: 'test-linkedin' },
    { id: 'inp-linkedin-display', key: 'linkedinDisplay' },
    { id: 'inp-github', key: 'github', testId: 'test-github' },
    { id: 'inp-github-display', key: 'githubDisplay' },
    { id: 'inp-leetcode', key: 'leetcode' },
    { id: 'inp-leetcode-display', key: 'leetcodeDisplay' },
    { id: 'inp-portfolio', key: 'portfolio' },
    { id: 'inp-portfolio-display', key: 'portfolioDisplay' }
  ];

  personalInputs.forEach(({ id, key, testId }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        resumeState.personal[key] = e.target.value;
        if (testId) updateTestLink(testId, e.target.value);
        updatePreviews();
      });
    }
  });



  // Accordion Toggle
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.section-card').classList.toggle('collapsed');
    });
  });

  // Tab Switching (Visual vs LaTeX Code)
  const tabVisual = document.getElementById('tab-visual');
  const tabLatex = document.getElementById('tab-latex');
  const visualArea = document.getElementById('visual-preview-area');
  const latexArea = document.getElementById('latex-view-container');

  tabVisual.addEventListener('click', () => {
    tabVisual.classList.add('active');
    tabLatex.classList.remove('active');
    visualArea.style.display = 'flex';
    latexArea.classList.remove('active');
  });

  tabLatex.addEventListener('click', () => {
    tabLatex.classList.add('active');
    tabVisual.classList.remove('active');
    visualArea.style.display = 'none';
    latexArea.classList.add('active');
  });

  // Zoom Controls
  document.getElementById('zoom-in').addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 0.1, 1.4);
    applyZoom(currentZoom);
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 0.1, 0.5);
    applyZoom(currentZoom);
  });

  document.getElementById('zoom-reset').addEventListener('click', () => {
    currentZoom = 0.85;
    applyZoom(currentZoom);
  });

  // Action Buttons
  document.getElementById('btn-copy-latex').addEventListener('click', copyLatexCode);
  document.getElementById('btn-download-tex').addEventListener('click', downloadTexFile);
  document.getElementById('btn-open-overleaf').addEventListener('click', openInOverleaf);
  document.getElementById('btn-print-pdf').addEventListener('click', exportCleanPdf);

  // Resume Dropzone Drag & Drop
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        processResumeFile(files[0]);
      }
    });
  }

  // Keyboard Escape listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeUploadModal();
    }
  });
}

/**
 * Generic Reordering Helper
 */
function moveItem(listKey, idx, direction) {
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= resumeState[listKey].length) return;
  const temp = resumeState[listKey][idx];
  resumeState[listKey][idx] = resumeState[listKey][targetIdx];
  resumeState[listKey][targetIdx] = temp;

  if (listKey === 'education') renderEducationList();
  else if (listKey === 'experience') renderExperienceList();
  else if (listKey === 'projects') renderProjectsList();
  else if (listKey === 'certifications') renderCertificationsList();
  else if (listKey === 'achievements') renderAchievementsList();

  updatePreviews();
}

/**
 * Smoothly scroll form to a specific section
 */
function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.classList.remove('collapsed');
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Auto-Fit engine is implemented below with progressive multi-level compaction

/**
 * Insert Action Verb into the latest project or experience bullet
 */
function insertActionVerb(verb) {
  if (resumeState.experience.length > 0) {
    const lastExp = resumeState.experience[0];
    lastExp.bullets.push(`${verb} `);
    renderExperienceList();
    updatePreviews();
    showToast(`Added action verb: "${verb}"`);
  }
}

/**
 * Apply Zoom to the Visual Canvas
 */
function applyZoom(zoom) {
  const paper = document.getElementById('visual-resume');
  if (paper) {
    paper.style.transform = `scale(${zoom})`;
    document.getElementById('zoom-label').innerText = `${Math.round(zoom * 100)}%`;
  }
}

/**
 * Update Both Previews (HTML Visual Canvas + LaTeX Code View)
 */
function updatePreviews(shouldSave = true) {
  renderVisualResume();
  renderLatexView();
  checkPageHeight();
  if (shouldSave !== false) {
    scheduleAutoSave();
  }
}

/**
 * Render the HTML Visual Resume (Exact Jake's Template Replica)
 * Annotated with data-jump-target and data-jump-section for Two-Way Click-to-Edit Visual Sync
 */
function renderVisualResume() {
  const { personal, education, experience, projects, skills, certifications, achievements } = resumeState;

  // 1. Header & Contacts
  let contactsHtml = [];
  if (personal.phone) {
    contactsHtml.push(`<span data-jump-target="inp-phone" title="Click to edit Phone">${escapeHtml(personal.phone)}</span>`);
  }
  if (personal.email) {
    contactsHtml.push(`<a href="mailto:${personal.email.trim()}" data-jump-target="inp-email" title="Click to edit Email" style="text-decoration: none;">${escapeHtml(personal.email.trim())}</a>`);
  }
  if (personal.linkedin) {
    const disp = typeof getSiteDisplayName === 'function' ? getSiteDisplayName(personal.linkedin, personal.linkedinDisplay, 'LinkedIn') : (personal.linkedinDisplay || 'LinkedIn');
    contactsHtml.push(`<a href="${normalizeUrl(personal.linkedin)}" target="_blank" rel="noopener noreferrer" data-jump-target="inp-linkedin" title="Click to edit LinkedIn" style="text-decoration: none;">${escapeHtml(disp)}</a>`);
  }
  if (personal.github) {
    const disp = typeof getSiteDisplayName === 'function' ? getSiteDisplayName(personal.github, personal.githubDisplay, 'GitHub') : (personal.githubDisplay || 'GitHub');
    contactsHtml.push(`<a href="${normalizeUrl(personal.github)}" target="_blank" rel="noopener noreferrer" data-jump-target="inp-github" title="Click to edit GitHub" style="text-decoration: none;">${escapeHtml(disp)}</a>`);
  }
  if (personal.leetcode) {
    const disp = typeof getSiteDisplayName === 'function' ? getSiteDisplayName(personal.leetcode, personal.leetcodeDisplay, 'LeetCode') : (personal.leetcodeDisplay || 'LeetCode');
    contactsHtml.push(`<a href="${normalizeUrl(personal.leetcode)}" target="_blank" rel="noopener noreferrer" data-jump-target="inp-leetcode" title="Click to edit Coding Profile" style="text-decoration: none;">${escapeHtml(disp)}</a>`);
  }
  if (personal.portfolio) {
    const disp = typeof getSiteDisplayName === 'function' ? getSiteDisplayName(personal.portfolio, personal.portfolioDisplay, 'Portfolio') : (personal.portfolioDisplay || 'Portfolio');
    contactsHtml.push(`<a href="${normalizeUrl(personal.portfolio)}" target="_blank" rel="noopener noreferrer" data-jump-target="inp-portfolio" title="Click to edit Portfolio" style="text-decoration: none;">${escapeHtml(disp)}</a>`);
  }

  const nameSize = (currentOptions.nameSize || 'Huge').toLowerCase();
  const nameClass = `res-name res-name-${nameSize}`;

  let html = `
    <header class="res-header">
      <div class="${nameClass}" data-jump-target="inp-name" title="Click to edit Full Name">${formatBulletHtml(personal.fullName || 'Jake Ryan')}</div>
      ${personal.tagline ? `<div class="res-tagline" data-jump-target="inp-tagline" title="Click to edit Headline / Keywords">${formatBulletHtml(personal.tagline)}</div>` : ''}
      <div class="res-contacts">
        ${contactsHtml.join(' <span class="res-sep">|</span> ')}
      </div>
    </header>
  `;

  // Dynamic Reorderable Sections Rendering
  const visualGenerators = {
    introduction: () => renderIntroductionVisual(resumeState.introduction),
    education: () => renderEducationVisual(resumeState.education),
    experience: () => renderExperienceVisual(resumeState.experience),
    projects: () => renderProjectsVisual(resumeState.projects),
    skills: () => renderSkillsVisual(resumeState.skills),
    certifications: () => renderCertificationsVisual(resumeState.certifications, currentOptions.showCertifications),
    achievements: () => renderAchievementsVisual(resumeState.achievements, currentOptions.showAchievements)
  };

  const defaultOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
  const order = (resumeState.sectionOrder && resumeState.sectionOrder.length > 0)
    ? resumeState.sectionOrder
    : defaultOrder;

  order.forEach(secKey => {
    if (visualGenerators[secKey]) {
      html += visualGenerators[secKey]();
    } else if (secKey.startsWith('custom_') || secKey.startsWith('sec-custom_')) {
      const cId = secKey.replace(/^sec-/, '');
      const customSec = (resumeState.customSections || []).find(cs => cs.id === cId || cs.id === secKey);
      if (customSec) {
        html += renderCustomSectionVisual(customSec);
      }
    }
  });

  visualResume.innerHTML = html;
}

function getSectionTitleHtml(title, sectionId, extraText = '') {
  const secSize = (currentOptions.sectionHeaderSize || 'large').toLowerCase();
  const secColor = currentOptions.sectionAccentColor || 'black';
  let styleStr = '';
  if (secColor && secColor !== 'black') {
    styleStr = ` style="color: ${secColor}; border-bottom-color: ${secColor};"`;
  }
  return `<div class="res-section-title res-sec-${secSize}" data-jump-section="${sectionId}" title="Click to jump to ${title}"${styleStr}>${title}${extraText}</div>`;
}

// 0. Introduction / Summary Visual
function renderIntroductionVisual(intro) {
  if (!intro) return '';
  const isEnabled = typeof intro === 'object' ? intro.enabled !== false : Boolean(intro);
  const text = typeof intro === 'object' ? (intro.text || '') : String(intro);
  if (!isEnabled || !text.trim()) return '';

  return `
    <section class="res-section">
      ${getSectionTitleHtml('Introduction', 'sec-intro')}
      <div class="res-intro-text" data-jump-target="inp-intro-text" title="Click to edit Introduction">${formatBulletHtml(text.trim())}</div>
    </section>
  `;
}

// 1. Education Visual
function renderEducationVisual(education) {
  if (!education || education.length === 0) return '';
  let html = `
    <section class="res-section">
      ${getSectionTitleHtml('Education', 'sec-education')}
  `;
  education.forEach((edu, idx) => {
    const gpaText = edu.gpa ? ` | CGPA/Percentage: ${formatBulletHtml(edu.gpa)}` : '';
    const courseworkText = edu.coursework ? `<div class="res-subdetails" data-jump-target="edu-${idx}-coursework" title="Click to edit Coursework"><strong>Relevant Coursework:</strong> ${formatBulletHtml(edu.coursework)}</div>` : '';
    html += `
      <div class="res-subheading" data-jump-target="edu-${idx}-institution" title="Click to edit Education entry #${idx + 1}">
        <div class="res-row-between">
          <span class="res-bold" data-jump-target="edu-${idx}-institution">${formatBulletHtml(edu.institution)}</span>
          <span class="res-location" data-jump-target="edu-${idx}-location">${formatBulletHtml(edu.location)}</span>
        </div>
        <div class="res-row-between">
          <span class="res-italic" data-jump-target="edu-${idx}-degree">${formatBulletHtml(edu.degree)}${gpaText}</span>
          <span class="res-dates" data-jump-target="edu-${idx}-dates">${formatBulletHtml(edu.dates)}</span>
        </div>
        ${courseworkText}
      </div>
    `;
  });
  html += `</section>`;
  return html;
}

// 2. Experience Visual
function renderExperienceVisual(experience) {
  if (!experience || experience.length === 0) return '';
  let html = `
    <section class="res-section">
      ${getSectionTitleHtml('Experience', 'sec-experience')}
  `;
  experience.forEach((exp, idx) => {
    html += `
      <div class="res-subheading">
        <div class="res-row-between">
          <span class="res-bold" data-jump-target="exp-${idx}-role" title="Click to edit Job Title">${formatBulletHtml(exp.role)}</span>
          <span class="res-dates" data-jump-target="exp-${idx}-dates" title="Click to edit Dates">${formatBulletHtml(exp.dates)}</span>
        </div>
        <div class="res-row-between">
          <span class="res-italic" data-jump-target="exp-${idx}-company" title="Click to edit Company">${formatBulletHtml(exp.company)}</span>
          <span class="res-location" data-jump-target="exp-${idx}-location" title="Click to edit Location">${formatBulletHtml(exp.location)}</span>
        </div>
        <ul class="res-bullets">
          ${(exp.subsections || []).filter(s => (s.label && s.label.trim()) || (s.text && s.text.trim())).map((s, sIdx) => `
            <li class="res-subsection-item" data-jump-target="exp-${idx}-sub-${sIdx}-label" title="Click to edit Sub-section">
              ${s.label && s.label.trim() ? `<strong class="res-bold">${formatBulletHtml(s.label.trim())}:</strong> ` : ''}<span>${formatBulletHtml(s.text || '')}</span>
            </li>
          `).join('')}
          ${exp.bullets.filter(b => b.trim()).map((b, bIdx) => `<li data-jump-target="exp-${idx}-bullet-${bIdx}" title="Click to edit bullet point">${formatBulletHtml(b)}</li>`).join('')}
        </ul>
      </div>
    `;
  });
  html += `</section>`;
  return html;
}

// 3. Projects Visual
function renderProjectsVisual(projects) {
  if (!projects || projects.length === 0) return '';
  let html = `
    <section class="res-section">
      ${getSectionTitleHtml('Projects', 'sec-projects')}
  `;
  projects.forEach((proj, idx) => {
    let linkItems = [];
    if (proj.liveUrl) {
      linkItems.push(`<a href="${normalizeUrl(proj.liveUrl)}" target="_blank" rel="noopener noreferrer" data-jump-target="proj-${idx}-liveUrl">${escapeHtml(proj.liveLabel || 'Live Demo')}</a>`);
    }
    if (proj.githubUrl) {
      linkItems.push(`<a href="${normalizeUrl(proj.githubUrl)}" target="_blank" rel="noopener noreferrer" data-jump-target="proj-${idx}-githubUrl">${escapeHtml(proj.githubLabel || 'GitHub')}</a>`);
    }

    const techPart = proj.techStack ? ` | <em>${formatBulletHtml(proj.techStack)}</em>` : '';
    const linksPart = linkItems.length > 0 ? ` | ${linkItems.join(' | ')}` : '';

    html += `
      <div class="res-subheading">
        <div class="res-row-between">
          <span><strong class="res-bold" data-jump-target="proj-${idx}-title" title="Click to edit Project Title">${formatBulletHtml(proj.title)}</strong><span data-jump-target="proj-${idx}-techStack" title="Click to edit Technologies">${techPart}</span>${linksPart}</span>
          <span class="res-dates" data-jump-target="proj-${idx}-dates" title="Click to edit Dates">${formatBulletHtml(proj.dates)}</span>
        </div>
        <ul class="res-bullets">
          ${(proj.subsections || []).filter(s => (s.label && s.label.trim()) || (s.text && s.text.trim())).map((s, sIdx) => `
            <li class="res-subsection-item" data-jump-target="proj-${idx}-sub-${sIdx}-label" title="Click to edit Sub-section">
              ${s.label && s.label.trim() ? `<strong class="res-bold">${formatBulletHtml(s.label.trim())}:</strong> ` : ''}<span>${formatBulletHtml(s.text || '')}</span>
            </li>
          `).join('')}
          ${proj.bullets.filter(b => b.trim()).map((b, bIdx) => `<li data-jump-target="proj-${idx}-bullet-${bIdx}" title="Click to edit bullet point">${formatBulletHtml(b)}</li>`).join('')}
        </ul>
      </div>
    `;
  });
  html += `</section>`;
  return html;
}

// 4. Technical Skills Visual (Dynamic Categories & Subsections)
function renderSkillsVisual(skills) {
  const normSkills = typeof normalizeSkills === 'function' ? normalizeSkills(skills) : skills;
  if (!normSkills || normSkills.length === 0) return '';
  const activeRows = normSkills.filter(s => s.category && s.category.trim() && s.items && s.items.trim());
  if (activeRows.length === 0) return '';

  let html = `
    <section class="res-section">
      ${getSectionTitleHtml('Technical Skills', 'sec-skills')}
      <ul class="res-skills-list">
  `;
  activeRows.forEach((item, idx) => {
    html += `<li data-jump-target="skill-${idx}-items" title="Click to edit Skill Category"><strong>${formatBulletHtml(item.category.trim())}:</strong> ${formatBulletHtml(item.items.trim())}</li>`;
  });
  html += `</ul></section>`;
  return html;
}

// 5. Certifications Visual (Single-line bullet list matching standard format & Image 3)
function renderCertificationsVisual(certifications, showCertifications = true) {
  if (!showCertifications || !certifications || certifications.length === 0) return '';
  let html = `
    <section class="res-section">
      ${getSectionTitleHtml('Certifications', 'sec-certs')}
      <ul class="res-bullets" style="padding-left: 1.15rem; margin-top: 3px; margin-bottom: 2px;">
  `;
  certifications.forEach((cert, idx) => {
    let name = (typeof cleanCertTitle === 'function' ? cleanCertTitle(cert.name) : (cert.name || '')).trim();
    let issuer = (typeof cleanCertTitle === 'function' ? cleanCertTitle(cert.issuer) : (cert.issuer || '')).trim();

    let boldPrefix = '';
    let restText = '';

    if (name && issuer) {
      boldPrefix = name;
      restText = issuer;
    } else if (name) {
      if (name.includes(' – ') || name.includes(' — ') || name.includes(' - ') || name.includes(' -- ')) {
        const parts = name.split(/\s+[—–\-]+\s+/);
        boldPrefix = parts[0];
        restText = parts.slice(1).join(' &ndash; ');
      } else {
        boldPrefix = name;
        restText = '';
      }
    } else if (issuer) {
      boldPrefix = issuer;
      restText = '';
    }

    let titleHtml = `<strong>${formatBulletHtml(boldPrefix)}</strong>`;
    if (restText) {
      titleHtml += ` &ndash; ${formatBulletHtml(restText)}`;
    }

    let rightParts = [];
    if (cert.date) {
      rightParts.push(`<span style="font-style: italic; color: #4b5563;" data-jump-target="cert-${idx}-date">${formatBulletHtml(cert.date)}</span>`);
    }
    if (cert.url) {
      rightParts.push(`<a href="${normalizeUrl(cert.url)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 500;">Certificate</a>`);
    }

    html += `
      <li data-jump-target="cert-${idx}-name" title="Click to edit Certification #${idx + 1}" style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
        <div>${titleHtml}</div>
        ${rightParts.length > 0 ? `<div style="text-align: right; white-space: nowrap; margin-left: 14px;">${rightParts.join('&nbsp;&nbsp;')}</div>` : ''}
      </li>
    `;
  });
  html += `</ul></section>`;
  return html;
}

// 6. Honors & Achievements Visual
function renderAchievementsVisual(achievements, showAchievements = true) {
  if (!showAchievements || !achievements || achievements.length === 0) return '';
  let html = `
    <section class="res-section">
      ${getSectionTitleHtml('Honors & Achievements', 'sec-honors')}
      <ul class="res-bullets">
  `;
  achievements.forEach((ach, idx) => {
    let line = `<strong>${formatBulletHtml(ach.title)}</strong>`;
    if (ach.description) line += `: ${formatBulletHtml(ach.description)}`;
    if (ach.url) {
      line += ` [<a href="${normalizeUrl(ach.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ach.linkLabel || 'Link')}</a>]`;
    }
    html += `<li data-jump-target="ach-${idx}-title" title="Click to edit Honor #${idx + 1}">${line}</li>`;
  });
  html += `</ul></section>`;
  return html;
}

/**
 * Render the Raw LaTeX Source Code
 */
function renderLatexView() {
  const code = generateLatexCode(resumeState, currentOptions);
  latexCodeOutput.textContent = code;
}

/**
 * Check if Resume fits cleanly on 1 page (Jake Gutierrez Spec)
 */
const PAGE_HEIGHT_MAX = 1056; // Standard 11in page at 96 DPI

/**
 * Check if Resume fits cleanly on 1 page (Jake Gutierrez Spec)
 * Updates toolbar badge and cutoff line cleanly without disrupting preview layout
 */
function checkPageHeight() {
  if (!visualResume) return;

  // Crucial: remove existing cutoff line before measuring so it NEVER contaminates scrollHeight
  const existingCutoff = visualResume.querySelector('.page-cutoff-line');
  if (existingCutoff) existingCutoff.remove();

  const currentHeight = visualResume.scrollHeight;
  const overflowPx = currentHeight - PAGE_HEIGHT_MAX;

  const btnAutofit = document.getElementById('btn-autofit');

  if (overflowPx > 6) {
    const overflowLines = Math.max(1, Math.ceil(overflowPx / 18));

    if (pageCounterBadge) {
      pageCounterBadge.className = 'page-counter-badge warning';
      pageCounterBadge.innerHTML = `⚠️ Exceeds 1 Page (+${overflowLines} ${overflowLines === 1 ? 'line' : 'lines'})`;
      pageCounterBadge.title = 'Click to Smart Auto-Fit into 1 Page';
      pageCounterBadge.onclick = () => autoFitToOnePage();
    }

    if (btnAutofit) {
      btnAutofit.style.display = 'inline-flex';
      btnAutofit.className = 'btn btn-sm btn-amber';
      btnAutofit.innerHTML = `⚡ Smart Auto-Fit`;
    }

    // Add visual page-cutoff guide line at 1056px (styled strictly above 1056px boundary)
    const cutoffLine = document.createElement('div');
    cutoffLine.className = 'page-cutoff-line';
    cutoffLine.innerHTML = `<span>✂️ 1-Page Cutoff &bull; Content below spills to Page 2</span>`;
    visualResume.appendChild(cutoffLine);
  } else {
    // Fits cleanly on 1 page
    if (pageCounterBadge) {
      pageCounterBadge.className = 'page-counter-badge';
      pageCounterBadge.innerHTML = `✓ 1 Page &bull; ATS Compliant`;
      pageCounterBadge.title = 'Resume fits cleanly on 1 Page';
      pageCounterBadge.onclick = null;
    }

    if (btnAutofit) {
      const isFitted = visualResume.classList.contains('compact-1') ||
                       visualResume.classList.contains('compact-2') ||
                       visualResume.classList.contains('compact-3') ||
                       visualResume.classList.contains('compact-4') ||
                       visualResume.classList.contains('compact-5');
      if (isFitted) {
        btnAutofit.style.display = 'inline-flex';
        btnAutofit.className = 'btn btn-sm btn-secondary';
        btnAutofit.innerHTML = `✓ Smart Fitted (1 Page)`;
      } else {
        btnAutofit.style.display = 'none';
      }
    }
  }
}

/**
 * Smart Auto-Fit to exactly 1 Page
 * Progressively tunes spacing and line heights across 5 granular levels
 * Minimizes empty whitespace so the resume always looks 100% full and balanced
 */
function autoFitToOnePage(andDownload = false) {
  if (!visualResume) return;

  // Clean cutoff line before measuring
  const existingCutoff = visualResume.querySelector('.page-cutoff-line');
  if (existingCutoff) existingCutoff.remove();

  // Clear existing compact classes
  visualResume.classList.remove('compact-1', 'compact-2', 'compact-3', 'compact-4', 'compact-5', 'compact-mode');

  // Check if it already fits without any compaction
  if (visualResume.scrollHeight <= PAGE_HEIGHT_MAX + 5) {
    currentOptions.compactLevel = 0;
    currentOptions.fontSize = '11pt';
    renderLatexView();
    checkPageHeight();
    showToast('✓ Resume already fits cleanly on 1 page!');
    if (andDownload) executeCleanPdfDownload();
    return true;
  }

  // Smart Level 1: Micro Spacing (11pt font, saves ~20px / ~1 line)
  visualResume.classList.add('compact-1');
  if (visualResume.scrollHeight <= PAGE_HEIGHT_MAX + 5) {
    currentOptions.compactLevel = 1;
    currentOptions.fontSize = '11pt';
    renderLatexView();
    checkPageHeight();
    showToast('✓ Smart Auto-Fit: Micro-tuned spacing to fit 1 full page!');
    if (andDownload) executeCleanPdfDownload();
    return true;
  }

  // Smart Level 2: Subtle Spacing (11pt font, saves ~45-55px / ~2-3 lines — EXACTLY 2-3 lines overflow!)
  visualResume.classList.remove('compact-1');
  visualResume.classList.add('compact-2');
  if (visualResume.scrollHeight <= PAGE_HEIGHT_MAX + 5) {
    currentOptions.compactLevel = 2;
    currentOptions.fontSize = '11pt';
    renderLatexView();
    checkPageHeight();
    showToast('✓ Smart Auto-Fit: Spacing tuned to fit 1 page while looking completely full!');
    if (andDownload) executeCleanPdfDownload();
    return true;
  }

  // Smart Level 3: Moderate Spacing (10.7pt font, saves ~70-95px / ~4-5 lines)
  visualResume.classList.remove('compact-2');
  visualResume.classList.add('compact-3');
  if (visualResume.scrollHeight <= PAGE_HEIGHT_MAX + 5) {
    currentOptions.compactLevel = 3;
    currentOptions.fontSize = '10.7pt';
    renderLatexView();
    checkPageHeight();
    showToast('✓ Smart Auto-Fit: Balanced compaction applied to fit 1 full page!');
    if (andDownload) executeCleanPdfDownload();
    return true;
  }

  // Smart Level 4: Compact Spacing (10.4pt font, saves ~110-140px / ~6-7 lines)
  visualResume.classList.remove('compact-3');
  visualResume.classList.add('compact-4');
  if (visualResume.scrollHeight <= PAGE_HEIGHT_MAX + 5) {
    currentOptions.compactLevel = 4;
    currentOptions.fontSize = '10.4pt';
    renderLatexView();
    checkPageHeight();
    showToast('✓ Smart Auto-Fit: Compacted to fit 1 page!');
    if (andDownload) executeCleanPdfDownload();
    return true;
  }

  // Smart Level 5: Maximum ATS Safe Spacing (10pt font, saves ~150-180px / ~8-10 lines)
  visualResume.classList.remove('compact-4');
  visualResume.classList.add('compact-5');
  if (visualResume.scrollHeight <= PAGE_HEIGHT_MAX + 5) {
    currentOptions.compactLevel = 5;
    currentOptions.fontSize = '10pt';
    renderLatexView();
    checkPageHeight();
    showToast('✓ Smart Auto-Fit: Maximum safe compaction applied to fit 1 page!');
    if (andDownload) executeCleanPdfDownload();
    return true;
  }

  // Still overflowing after maximum compaction Level 5!
  currentOptions.compactLevel = 5;
  currentOptions.fontSize = '10pt';
  renderLatexView();
  checkPageHeight();

  const remainingOverflow = visualResume.scrollHeight - PAGE_HEIGHT_MAX;
  const linesToDelete = Math.max(1, Math.ceil(remainingOverflow / 17));

  // Open the "Please Delete Lines" modal
  showTrimLinesModal(linesToDelete, remainingOverflow, andDownload);
  return false;
}
window.autoFitToOnePage = autoFitToOnePage;

/**
 * Export Clean PDF without browser print headers, URLs, or timestamps
 * Automatically runs Smart Auto-Fit if overflowing, ensuring clean 1-click download
 */
function exportCleanPdf() {
  const resumeElem = document.getElementById('visual-resume');
  if (!resumeElem) return;

  // Crucial: remove cutoff line before measuring
  const cutoff = resumeElem.querySelector('.page-cutoff-line');
  if (cutoff) cutoff.remove();

  const currentHeight = resumeElem.scrollHeight;

  // If overflowing, automatically run Smart Auto-Fit to ensure 1 full page!
  if (currentHeight > PAGE_HEIGHT_MAX + 6) {
    const fitted = autoFitToOnePage(false);
    if (fitted) {
      showToast('⚡ Auto-fitted to 1 page! Downloading clean PDF...');
      executeCleanPdfDownload();
      return;
    }
    // Only if even maximum compaction (Level 5) cannot fit, prompt the user
    const overflowPx = resumeElem.scrollHeight - PAGE_HEIGHT_MAX;
    const lines = Math.max(1, Math.ceil(overflowPx / 18));
    showDownloadOverflowWarningModal(lines, overflowPx);
    return;
  }

  executeCleanPdfDownload();
}
window.exportCleanPdf = exportCleanPdf;

/**
 * Execute actual Clean PDF generation and download
 */
function executeCleanPdfDownload() {
  const resumeElem = document.getElementById('visual-resume');
  if (!resumeElem) return;

  if (typeof html2pdf === 'undefined') {
    showToast('Opening print dialog (uncheck "Headers and footers" in print settings)...');
    window.print();
    return;
  }

  showToast('📄 Generating clean 1-page PDF...');

  // Crucial: remove cutoff line completely so it is never in canvas
  const cutoff = resumeElem.querySelector('.page-cutoff-line');
  if (cutoff) cutoff.remove();

  // Temporarily reset zoom scale and box shadow for 100% crisp render
  const prevTransform = resumeElem.style.transform;
  const prevTransformOrigin = resumeElem.style.transformOrigin;
  const prevBoxShadow = resumeElem.style.boxShadow;

  resumeElem.style.transform = 'none';
  resumeElem.style.boxShadow = 'none';

  // Ensure contact links have no underline in html2canvas render
  const contactLinks = resumeElem.querySelectorAll('.res-contacts a');
  const prevUnderlines = [];
  contactLinks.forEach(a => {
    prevUnderlines.push(a.style.textDecoration);
    a.style.textDecoration = 'none';
  });

  const candidateName = (resumeState.personal.fullName || 'Jake_Ryan').trim().replace(/\s+/g, '_');
  const filename = `${candidateName}_Resume.pdf`;

  const isOnePage = resumeElem.scrollHeight <= 1070 || 
                    visualResume.classList.contains('compact-1') || 
                    visualResume.classList.contains('compact-2') || 
                    visualResume.classList.contains('compact-3') ||
                    visualResume.classList.contains('compact-4') ||
                    visualResume.classList.contains('compact-5');

  const opt = {
    margin: [0, 0, 0, 0],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2.5,
      useCORS: true,
      letterRendering: true,
      scrollY: 0,
      scrollX: 0
    },
    jsPDF: {
      unit: 'in',
      format: 'letter',
      orientation: 'portrait'
    }
  };

  const cleanup = () => {
    resumeElem.style.transform = prevTransform;
    resumeElem.style.transformOrigin = prevTransformOrigin;
    resumeElem.style.boxShadow = prevBoxShadow;
    contactLinks.forEach((a, i) => { a.style.textDecoration = prevUnderlines[i] || ''; });
    checkPageHeight();
  };

  html2pdf()
    .set(opt)
    .from(resumeElem)
    .toPdf()
    .get('pdf')
    .then(function (pdf) {
      if (isOnePage && pdf.internal.getNumberOfPages() > 1) {
        // Automatically delete any accidental blank 2nd page!
        pdf.deletePage(2);
      }
    })
    .save()
    .then(() => {
      cleanup();
      showToast(`✓ Clean PDF downloaded: ${filename}`);
    })
    .catch((err) => {
      console.error('Error generating clean PDF:', err);
      cleanup();
      showToast('⚠️ Opening browser print dialog...');
      window.print();
    });
}
window.executeCleanPdfDownload = executeCleanPdfDownload;

function showDownloadOverflowWarningModal(lines, overflowPx) {
  const modal = document.getElementById('download-warning-modal');
  const linesEl = document.getElementById('download-overflow-lines');
  if (linesEl) linesEl.innerText = `${lines} line${lines === 1 ? '' : 's'}`;
  if (modal) modal.style.display = 'flex';
}
window.showDownloadOverflowWarningModal = showDownloadOverflowWarningModal;

function closeDownloadWarningModal() {
  const modal = document.getElementById('download-warning-modal');
  if (modal) modal.style.display = 'none';
}
window.closeDownloadWarningModal = closeDownloadWarningModal;

function proceedWithDownloadAnyway() {
  closeDownloadWarningModal();
  closeTrimLinesModal();
  executeCleanPdfDownload();
}
window.proceedWithDownloadAnyway = proceedWithDownloadAnyway;

function autoFitAndDownload() {
  closeDownloadWarningModal();
  autoFitToOnePage(true);
}
window.autoFitAndDownload = autoFitAndDownload;

function showTrimLinesModal(linesNeeded, remainingOverflowPx = 0, andDownload = false) {
  closeDownloadWarningModal();
  const modal = document.getElementById('trim-lines-modal');
  const neededEl = document.getElementById('trim-lines-needed');
  const neededTextEl = document.getElementById('trim-lines-needed-text');
  const targetEl = document.getElementById('trim-lines-target');
  const listEl = document.getElementById('trim-recommendations-list');

  if (neededEl) neededEl.innerText = String(linesNeeded);
  if (neededTextEl) neededTextEl.innerText = `${linesNeeded} line${linesNeeded === 1 ? '' : 's'}`;
  if (targetEl) targetEl.innerText = String(linesNeeded);

  if (listEl) {
    const recs = generateTrimRecommendations(linesNeeded);
    listEl.innerHTML = recs.map(r => `<li>${r}</li>`).join('');
  }

  if (modal) modal.style.display = 'flex';
}
window.showTrimLinesModal = showTrimLinesModal;

function closeTrimLinesModal() {
  const modal = document.getElementById('trim-lines-modal');
  if (modal) modal.style.display = 'none';
}
window.closeTrimLinesModal = closeTrimLinesModal;

function openTrimModalFromBanner() {
  const currentHeight = visualResume ? visualResume.scrollHeight : 0;
  const overflowPx = Math.max(0, currentHeight - PAGE_HEIGHT_MAX);
  const lines = Math.max(1, Math.ceil(overflowPx / 18));
  showTrimLinesModal(lines, overflowPx, false);
}
window.openTrimModalFromBanner = openTrimModalFromBanner;

function openTrimModalFromDownload() {
  closeDownloadWarningModal();
  openTrimModalFromBanner();
}
window.openTrimModalFromDownload = openTrimModalFromDownload;

function generateTrimRecommendations(linesNeeded) {
  const list = [];
  const { projects, experience, certifications, achievements } = resumeState;

  let totalProjBullets = 0;
  if (projects && projects.length) {
    projects.forEach(p => { totalProjBullets += (p.bullets ? p.bullets.length : 0); });
  }

  let totalExpBullets = 0;
  if (experience && experience.length) {
    experience.forEach(e => { totalExpBullets += (e.bullets ? e.bullets.length : 0); });
  }

  list.push(`<strong>Shorten wrapping bullet points:</strong> Check your Projects and Experience for lines where only 1&ndash;3 words spill onto a new line. Trimming 1&ndash;2 words reclaims an entire line!`);

  if (totalProjBullets > 3) {
    list.push(`<strong>Trim Project Bullets:</strong> You currently have ${totalProjBullets} bullets across ${projects.length} projects. Deleting ${Math.min(linesNeeded, 2)} bullet(s) from earlier projects will save ${Math.min(linesNeeded, 2)} line(s).`);
  }

  if (totalExpBullets > 3) {
    list.push(`<strong>Consolidate Experience:</strong> You have ${totalExpBullets} experience bullets. Keep only high-impact, quantified bullets.`);
  }

  if (certifications && certifications.length > 2) {
    list.push(`<strong>Certifications:</strong> You have ${certifications.length} certifications listed. Removing 1 saves 1 line.`);
  }

  if (achievements && achievements.length > 2) {
    list.push(`<strong>Achievements:</strong> You have ${achievements.length} achievements listed. Removing or combining 1 saves 1 line.`);
  }

  return list;
}
window.generateTrimRecommendations = generateTrimRecommendations;

/**
 * Copy LaTeX Code to Clipboard
 */
function copyLatexCode() {
  const code = generateLatexCode(resumeState, currentOptions);
  navigator.clipboard.writeText(code).then(() => {
    showToast('✓ LaTeX Code copied to clipboard!');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('✓ LaTeX Code copied to clipboard!');
  });
}

/**
 * Download .tex File
 */
function downloadTexFile() {
  const code = generateLatexCode(resumeState, currentOptions);
  const blob = new Blob([code], { type: 'text/x-tex;charset=utf-8;' });
  const filename = `${(resumeState.personal.fullName || 'resume').toLowerCase().replace(/\s+/g, '_')}_jake_resume.tex`;
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`✓ Downloaded ${filename}`);
}

/**
 * Open Directly in Overleaf via snip API
 */
function openInOverleaf() {
  const code = generateLatexCode(resumeState, currentOptions);
  const form = document.createElement('form');
  form.action = 'https://www.overleaf.com/docs';
  form.method = 'POST';
  form.target = '_blank';

  const snipInput = document.createElement('input');
  snipInput.type = 'hidden';
  snipInput.name = 'snip';
  snipInput.value = code;

  const nameInput = document.createElement('input');
  nameInput.type = 'hidden';
  nameInput.name = 'snip_name';
  nameInput.value = 'jake_resume.tex';

  form.appendChild(snipInput);
  form.appendChild(nameInput);
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
  showToast('🚀 Opening compilation directly in Overleaf...');
}

/**
 * Helper to show toast notification
 */
function showToast(msg) {
  if (toastMessage && toastNotice) {
    toastMessage.textContent = msg;
    toastNotice.classList.add('show');
    setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 3200);
  }
}

/**
 * Helper to escape HTML characters in preview
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Inherited safely from template.js (with fallbacks if isolated)
var APP_PRESET_COLORS = (typeof window !== 'undefined' && window.PRESET_COLORS) ? window.PRESET_COLORS : ((typeof PRESET_COLORS !== 'undefined') ? PRESET_COLORS : {
  navy: '1E40AF',
  blue: '2563EB',
  emerald: '059669',
  green: '16A34A',
  teal: '0D9488',
  purple: '7C3AED',
  crimson: 'DC2626',
  red: 'E11D48',
  amber: 'D97706',
  orange: 'EA580C',
  gray: '4B5563',
  dark: '1F2937'
});

var APP_KNOWN_SIZES = (typeof window !== 'undefined' && window.KNOWN_SIZES) ? window.KNOWN_SIZES : ((typeof KNOWN_SIZES !== 'undefined') ? KNOWN_SIZES : new Set(['small', 'sm', 'large', 'lg', 'tiny', 'xs', 'huge']));

function resolveColorHex(spec) {
  if (typeof window !== 'undefined' && typeof window.parseColorHex === 'function') return window.parseColorHex(spec);
  if (typeof parseColorHex === 'function') return parseColorHex(spec);
  if (!spec) return null;
  const s = spec.trim().toLowerCase();
  if (APP_PRESET_COLORS[s]) return APP_PRESET_COLORS[s];
  const hexMatch = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return hex.toUpperCase();
  }
  return null;
}

function resolveFormattingSpec(specStr) {
  if (typeof window !== 'undefined' && typeof window.parseFormattingSpec === 'function') return window.parseFormattingSpec(specStr);
  if (typeof parseFormattingSpec === 'function') return parseFormattingSpec(specStr);
  const parts = specStr.split(',').map(p => p.trim());
  let color = null;
  let size = null;
  let bg = null;

  for (const p of parts) {
    const plower = p.toLowerCase();
    if (plower.startsWith('size:')) {
      size = plower.slice(5).trim();
    } else if (APP_KNOWN_SIZES.has(plower)) {
      size = plower;
    } else if (plower.startsWith('bg:') || plower.startsWith('highlight:') || plower.startsWith('hl:')) {
      const val = p.split(':')[1].trim();
      bg = resolveColorHex(val) || 'FEF08A';
    } else {
      const c = resolveColorHex(p);
      if (c) color = c;
    }
  }
  return { color, size, bg };
}

/**
 * Format bullet and body text for HTML preview:
 * Safely converts markdown bold (**...**), italics (*...*), highlighters (==...==),
 * custom colors ([text]{color}), and sizes ([text]{size:...}).
 */
function formatBulletHtml(text) {
  if (!text) return '';

  const pattern = /(==[^=\n]+==|\[[^\]\n]+\]\{[^}\n]+\}|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  const parts = String(text).split(pattern);

  return parts.map(part => {
    if (!part) return '';
    if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
      const inner = part.slice(2, -2);
      return `<mark class="res-hl">${formatBulletHtml(inner)}</mark>`;
    }
    if (part.startsWith('[') && part.includes(']{')) {
      const m = part.match(/^\[([^\]\n]+)\]\{([^}\n]+)\}$/);
      if (m) {
        const inner = m[1];
        const spec = resolveFormattingSpec(m[2]);
        let styles = [];
        let classes = [];
        if (spec.color) styles.push(`color: #${spec.color}`);
        if (spec.bg) styles.push(`background-color: #${spec.bg}`);
        if (spec.size === 'small' || spec.size === 'sm') classes.push('res-text-sm');
        else if (spec.size === 'large' || spec.size === 'lg') classes.push('res-text-lg');
        else if (spec.size === 'huge') classes.push('res-text-huge');
        else if (spec.size === 'tiny' || spec.size === 'xs') classes.push('res-text-xs');

        const styleAttr = styles.length ? ` style="${styles.join('; ')}"` : '';
        const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
        return `<span${classAttr}${styleAttr}>${formatBulletHtml(inner)}</span>`;
      }
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2);
      return `<strong>${formatBulletHtml(inner)}</strong>`;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
      const inner = part.slice(1, -1);
      return `<em>${formatBulletHtml(inner)}</em>`;
    }
    return escapeHtml(part);
  }).join('');
}

/* ==========================================================================
   Typography, Highlighting & Rich Formatting Controller
   ========================================================================== */

let lastFocusedInput = null;

document.addEventListener('focusin', (e) => {
  if (e.target && e.target.matches && e.target.matches('input[type="text"], textarea')) {
    lastFocusedInput = e.target;
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.target && e.target.matches && e.target.matches('input[type="text"], textarea')) {
    lastFocusedInput = e.target;
  }
});
document.addEventListener('keyup', (e) => {
  if (e.target && e.target.matches && e.target.matches('input[type="text"], textarea')) {
    lastFocusedInput = e.target;
  }
});

// Keyboard shortcuts for formatting: Ctrl+B (bold), Ctrl+I (italic), Ctrl+H (highlight)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.target && e.target.matches && e.target.matches('input[type="text"], textarea')) {
    const key = e.key.toLowerCase();
    if (key === 'b') {
      e.preventDefault();
      applyTextFormat('bold', null, e.target);
    } else if (key === 'i') {
      e.preventDefault();
      applyTextFormat('italic', null, e.target);
    } else if (key === 'h') {
      e.preventDefault();
      applyTextFormat('highlight', null, e.target);
    }
  }
});

function smartApplyFormat(val, selStart, selEnd, formatType, customValue = null) {
  let start = selStart;
  let end = selEnd;
  let selectedText = val.substring(start, end);

  // If no selection, check if cursor is inside an existing tag
  if (start === end) {
    const tagPatterns = [
      { type: 'highlight', regex: /==([^=\n]+)==/g },
      { type: 'bold', regex: /\*\*([^*\n]+)\*\*/g },
      { type: 'italic', regex: /(?<!\*)\*([^*\n]+)\*(?!\*)/g },
      { type: 'color_or_size', regex: /\[([^\]\n]+)\]\{([^}\n]+)\}/g }
    ];

    for (const { type, regex } of tagPatterns) {
      let match;
      while ((match = regex.exec(val)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        if (start >= matchStart && start <= matchEnd) {
          start = matchStart;
          end = matchEnd;
          selectedText = val.substring(start, end);
          break;
        }
      }
      if (start !== end) break;
    }
  }

  // 1. Highlight toggle
  if (formatType === 'highlight') {
    if (selectedText.startsWith('==') && selectedText.endsWith('==') && selectedText.length >= 4) {
      const unwrapped = selectedText.slice(2, -2);
      return {
        newVal: val.substring(0, start) + unwrapped + val.substring(end),
        newStart: start,
        newEnd: start + unwrapped.length,
        action: 'removed highlight'
      };
    }
    if (start >= 2 && val.substring(start - 2, start) === '==' && val.substring(end, end + 2) === '==') {
      return {
        newVal: val.substring(0, start - 2) + selectedText + val.substring(end + 2),
        newStart: start - 2,
        newEnd: start - 2 + selectedText.length,
        action: 'removed highlight'
      };
    }
  }

  // 2. Bold toggle
  if (formatType === 'bold') {
    if (selectedText.startsWith('**') && selectedText.endsWith('**') && selectedText.length >= 4) {
      const unwrapped = selectedText.slice(2, -2);
      return {
        newVal: val.substring(0, start) + unwrapped + val.substring(end),
        newStart: start,
        newEnd: start + unwrapped.length,
        action: 'removed bold'
      };
    }
    if (start >= 2 && val.substring(start - 2, start) === '**' && val.substring(end, end + 2) === '**') {
      return {
        newVal: val.substring(0, start - 2) + selectedText + val.substring(end + 2),
        newStart: start - 2,
        newEnd: start - 2 + selectedText.length,
        action: 'removed bold'
      };
    }
  }

  // 3. Italic toggle
  if (formatType === 'italic') {
    if (selectedText.startsWith('*') && selectedText.endsWith('*') && !selectedText.startsWith('**') && selectedText.length >= 2) {
      const unwrapped = selectedText.slice(1, -1);
      return {
        newVal: val.substring(0, start) + unwrapped + val.substring(end),
        newStart: start,
        newEnd: start + unwrapped.length,
        action: 'removed italic'
      };
    }
    if (start >= 1 && val.substring(start - 1, start) === '*' && val.substring(end, end + 1) === '*' && val.substring(start - 2, start) !== '**') {
      return {
        newVal: val.substring(0, start - 1) + selectedText + val.substring(end + 1),
        newStart: start - 1,
        newEnd: start - 1 + selectedText.length,
        action: 'removed italic'
      };
    }
  }

  // 4. Color & Size: [inner]{spec}
  // Case A: When selection is the entire [text]{spec} block:
  const directColorSize = selectedText.match(/^\[([^\]\n]+)\]\{([^}\n]+)\}$/);
  if (directColorSize) {
    const innerText = directColorSize[1];
    const existingSpec = directColorSize[2];

    if (formatType === 'color') {
      const newCol = customValue || 'emerald';
      if (existingSpec === newCol) {
        return {
          newVal: val.substring(0, start) + innerText + val.substring(end),
          newStart: start,
          newEnd: start + innerText.length,
          action: 'removed color'
        };
      }
      const replacement = `[${innerText}]{${newCol}}`;
      return {
        newVal: val.substring(0, start) + replacement + val.substring(end),
        newStart: start,
        newEnd: start + replacement.length,
        action: 'updated color'
      };
    }

    if (formatType === 'size') {
      const newSz = customValue || 'small';
      const targetSpec = `size:${newSz}`;
      if (existingSpec === targetSpec || existingSpec === newSz) {
        return {
          newVal: val.substring(0, start) + innerText + val.substring(end),
          newStart: start,
          newEnd: start + innerText.length,
          action: 'removed size'
        };
      }
      const replacement = `[${innerText}]{size:${newSz}}`;
      return {
        newVal: val.substring(0, start) + replacement + val.substring(end),
        newStart: start,
        newEnd: start + replacement.length,
        action: 'updated size'
      };
    }
  }

  // Case B: When selection is inside [selection]{spec}:
  if (start >= 1 && val.substring(start - 1, start) === '[' && val.substring(end).startsWith(']{')) {
    const specEndIndex = val.indexOf('}', end + 2);
    if (specEndIndex !== -1) {
      const fullEnd = specEndIndex + 1;
      const existingSpec = val.substring(end + 2, specEndIndex);
      const innerText = selectedText;

      if (formatType === 'color') {
        const newCol = customValue || 'emerald';
        if (existingSpec === newCol) {
          return {
            newVal: val.substring(0, start - 1) + innerText + val.substring(fullEnd),
            newStart: start - 1,
            newEnd: start - 1 + innerText.length,
            action: 'removed color'
          };
        }
        const replacement = `[${innerText}]{${newCol}}`;
        return {
          newVal: val.substring(0, start - 1) + replacement + val.substring(fullEnd),
          newStart: start - 1,
          newEnd: start - 1 + replacement.length,
          action: 'updated color'
        };
      }

      if (formatType === 'size') {
        const newSz = customValue || 'small';
        const targetSpec = `size:${newSz}`;
        if (existingSpec === targetSpec || existingSpec === newSz) {
          return {
            newVal: val.substring(0, start - 1) + innerText + val.substring(fullEnd),
            newStart: start - 1,
            newEnd: start - 1 + innerText.length,
            action: 'removed size'
          };
        }
        const replacement = `[${innerText}]{size:${newSz}}`;
        return {
          newVal: val.substring(0, start - 1) + replacement + val.substring(fullEnd),
          newStart: start - 1,
          newEnd: start - 1 + replacement.length,
          action: 'updated size'
        };
      }
    }
  }

  // 5. Fresh formatting (Preserve leading/trailing whitespace outside formatting delimiters)
  let lead = '';
  let trail = '';
  let coreText = selectedText;
  if (selectedText) {
    const leadMatch = selectedText.match(/^\s+/);
    if (leadMatch) {
      lead = leadMatch[0];
      coreText = coreText.slice(lead.length);
    }
    const trailMatch = coreText.match(/\s+$/);
    if (trailMatch) {
      trail = trailMatch[0];
      coreText = coreText.slice(0, -trail.length);
    }
  }

  const textToWrap = coreText || (formatType === 'highlight' ? 'highlighted text' : formatType === 'color' ? 'colored text' : formatType === 'bold' ? 'bold text' : 'text');
  let formattedCore = '';
  if (formatType === 'bold') formattedCore = `**${textToWrap}**`;
  else if (formatType === 'italic') formattedCore = `*${textToWrap}*`;
  else if (formatType === 'highlight') formattedCore = `==${textToWrap}==`;
  else if (formatType === 'color') formattedCore = `[${textToWrap}]{${customValue || 'emerald'}}`;
  else if (formatType === 'size') formattedCore = `[${textToWrap}]{size:${customValue || 'small'}}`;

  const replacement = lead + formattedCore + trail;

  let innerStart = start + lead.length;
  let innerEnd = start + lead.length + formattedCore.length;
  if (!selectedText) {
    if (formatType === 'bold' || formatType === 'highlight') {
      innerStart = start + lead.length + 2;
      innerEnd = innerStart + textToWrap.length;
    } else if (formatType === 'italic') {
      innerStart = start + lead.length + 1;
      innerEnd = innerStart + textToWrap.length;
    } else if (formatType === 'color' || formatType === 'size') {
      innerStart = start + lead.length + 1;
      innerEnd = innerStart + textToWrap.length;
    }
  }

  return {
    newVal: val.substring(0, start) + replacement + val.substring(end),
    newStart: innerStart,
    newEnd: innerEnd,
    action: `applied ${formatType}`
  };
}

function applyTextFormat(formatType, customValue = null, explicitTarget = null) {
  let targetInput = explicitTarget || (
    (document.activeElement && document.activeElement.matches && document.activeElement.matches('input[type="text"], textarea'))
      ? document.activeElement
      : (lastFocusedInput && document.body.contains(lastFocusedInput) ? lastFocusedInput : null)
  );
  if (!targetInput) {
    targetInput = document.querySelector('.bullet-item input, #inp-intro-text, input[type="text"], textarea');
  }
  if (!targetInput) return;

  const start = targetInput.selectionStart !== undefined ? targetInput.selectionStart : targetInput.value.length;
  const end = targetInput.selectionEnd !== undefined ? targetInput.selectionEnd : targetInput.value.length;
  const val = targetInput.value;

  const res = smartApplyFormat(val, start, end, formatType, customValue);
  targetInput.value = res.newVal;

  targetInput.focus();
  targetInput.setSelectionRange(res.newStart, res.newEnd);

  targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  showToast(res.action.charAt(0).toUpperCase() + res.action.slice(1));

  closeAllFormattingPalettes();
}
window.smartApplyFormat = smartApplyFormat;
window.applyTextFormat = applyTextFormat;

function toggleColorPalette(btnEl) {
  const group = btnEl.closest('.format-tool-color-group');
  if (!group) return;
  const menu = group.querySelector('.format-color-palette');
  if (!menu) return;

  const isVisible = menu.style.display === 'flex';
  closeAllFormattingPalettes();
  if (!isVisible) {
    menu.style.display = 'flex';
  }
}
window.toggleColorPalette = toggleColorPalette;

function toggleSizePalette(btnEl) {
  const group = btnEl.closest('.format-tool-size-group');
  if (!group) return;
  const menu = group.querySelector('.format-size-palette');
  if (!menu) return;

  const isVisible = menu.style.display === 'flex';
  closeAllFormattingPalettes();
  if (!isVisible) {
    menu.style.display = 'flex';
  }
}
window.toggleSizePalette = toggleSizePalette;

function closeAllFormattingPalettes() {
  document.querySelectorAll('.format-color-palette, .format-size-palette').forEach(el => {
    el.style.display = 'none';
  });
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.format-tool-color-group') && !e.target.closest('.format-tool-size-group')) {
    closeAllFormattingPalettes();
  }
});

function updateNameFontSize(val) {
  if (!val) return;
  currentOptions.nameSize = val;

  const optNameSize = document.getElementById('opt-name-size');
  if (optNameSize) optNameSize.value = val;
  const optModalNameSize = document.getElementById('modal-opt-name-size') || document.getElementById('opt-modal-name-size');
  if (optModalNameSize) optModalNameSize.value = val;

  updatePreviews();
  scheduleAutoSave();
  showToast(`Name size set to ${val}`);
}
window.updateNameFontSize = updateNameFontSize;

function updateSectionHeaderSize(val) {
  if (!val) return;
  currentOptions.sectionHeaderSize = val;

  const optModalSecSize = document.getElementById('modal-opt-sec-size') || document.getElementById('opt-modal-sec-size');
  if (optModalSecSize) optModalSecSize.value = val;

  updatePreviews();
  scheduleAutoSave();
  showToast(`Section headers set to ${val}`);
}
window.updateSectionHeaderSize = updateSectionHeaderSize;

function updateBodyFontSize(val) {
  if (!val) return;
  currentOptions.fontSize = val;

  const optModalBodySize = document.getElementById('modal-opt-body-size') || document.getElementById('opt-modal-body-size');
  if (optModalBodySize) optModalBodySize.value = val;

  updatePreviews();
  scheduleAutoSave();
  showToast(`Body font size set to ${val}`);
}
window.updateBodyFontSize = updateBodyFontSize;

function updateSectionAccentColor(val) {
  if (!val) return;
  currentOptions.sectionAccentColor = val;

  const optModalAccentColor = document.getElementById('modal-opt-sec-color') || document.getElementById('opt-modal-accent-color');
  if (optModalAccentColor) optModalAccentColor.value = val;

  updatePreviews();
  scheduleAutoSave();
  showToast(`Section accent color updated`);
}
window.updateSectionAccentColor = updateSectionAccentColor;

function openTypographyModal() {
  const modal = document.getElementById('typography-modal');
  if (!modal) return;
  const optModalNameSize = document.getElementById('modal-opt-name-size') || document.getElementById('opt-modal-name-size');
  if (optModalNameSize) optModalNameSize.value = currentOptions.nameSize || 'Huge';

  const optModalSecSize = document.getElementById('modal-opt-sec-size') || document.getElementById('opt-modal-sec-size');
  if (optModalSecSize) optModalSecSize.value = currentOptions.sectionHeaderSize || 'large';

  const optModalBodySize = document.getElementById('modal-opt-body-size') || document.getElementById('opt-modal-body-size');
  if (optModalBodySize) optModalBodySize.value = currentOptions.fontSize || '11pt';

  const optModalAccentColor = document.getElementById('modal-opt-sec-color') || document.getElementById('opt-modal-accent-color');
  if (optModalAccentColor) optModalAccentColor.value = currentOptions.sectionAccentColor || 'black';

  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('open'));
}
window.openTypographyModal = openTypographyModal;

function closeTypographyModal() {
  const modal = document.getElementById('typography-modal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 200);
}
window.closeTypographyModal = closeTypographyModal;

/* ==========================================================================
   Draggable Splitter Pane Setup
   ========================================================================== */
function setupSplitterResizer() {
  const splitter = document.getElementById('drag-splitter');
  const container = document.getElementById('app-container');
  const formPane = document.getElementById('form-pane');
  const previewPane = document.getElementById('preview-pane');

  if (!splitter || !container || !formPane || !previewPane) return;

  let isDragging = false;

  // Restore saved ratio if available
  const savedRatio = localStorage.getItem(SPLIT_STORAGE_KEY);
  if (savedRatio && container.classList.contains('view-split') && window.innerWidth > 900) {
    const r = parseFloat(savedRatio);
    if (!isNaN(r) && r >= 22 && r <= 78) {
      formPane.style.width = `${r}%`;
      previewPane.style.width = `${100 - r}%`;
    }
  }

  const startDrag = (e) => {
    if (!container.classList.contains('view-split') || window.innerWidth <= 900) return;
    isDragging = true;
    splitter.classList.add('is-active');
    document.body.classList.add('is-resizing');
    e.preventDefault();
  };

  const onDrag = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = container.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    let percent = (offsetX / rect.width) * 100;

    // Constrain between 22% and 78%
    percent = Math.max(22, Math.min(78, percent));

    formPane.style.width = `${percent.toFixed(2)}%`;
    previewPane.style.width = `${(100 - percent).toFixed(2)}%`;
  };

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    splitter.classList.remove('is-active');
    document.body.classList.remove('is-resizing');

    const rect = container.getBoundingClientRect();
    const formWidth = formPane.getBoundingClientRect().width;
    const currentPercent = (formWidth / rect.width) * 100;

    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, currentPercent.toFixed(1));
    } catch (e) {
      console.warn(e);
    }

    checkPageHeight();
  };

  splitter.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);

  splitter.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('touchmove', onDrag, { passive: true });
  window.addEventListener('touchend', stopDrag);

  // Double-click to reset 50/50
  splitter.addEventListener('dblclick', () => {
    formPane.style.width = '48%';
    previewPane.style.width = '52%';
    try {
      localStorage.removeItem(SPLIT_STORAGE_KEY);
    } catch (e) {
      console.warn(e);
    }
    showToast('Reset split panes to 50/50');
    checkPageHeight();
  });
}

/* ==========================================================================
   Two-Way Click-to-Edit Visual Sync
   ========================================================================== */
function setupVisualClickToEdit() {
  const preview = document.getElementById('visual-resume');
  if (!preview) return;

  preview.addEventListener('click', (e) => {
    // If user clicked with Ctrl/Cmd or middle-click, allow default link opening
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      return;
    }

    const targetEl = e.target.closest('[data-jump-target]');
    const sectionEl = e.target.closest('[data-jump-section]');

    if (targetEl) {
      e.preventDefault();
      const targetId = targetEl.getAttribute('data-jump-target');
      jumpToFormInput(targetId);
    } else if (sectionEl) {
      e.preventDefault();
      const secId = sectionEl.getAttribute('data-jump-section');
      scrollToSection(secId);
    }
  });
}

function jumpToFormInput(inputId) {
  if (!inputId) return;

  // If in Preview Only mode, switch to Split so editor is visible!
  const container = document.getElementById('app-container');
  if (container && container.classList.contains('view-preview-only')) {
    const btnSplit = document.getElementById('btn-view-split');
    if (btnSplit) btnSplit.click();
  }

  const input = document.getElementById(inputId);
  if (!input) {
    console.warn('Form input not found for jump target:', inputId);
    return;
  }

  // Ensure parent section card is expanded
  const card = input.closest('.section-card');
  if (card) {
    card.classList.remove('collapsed');
  }

  // Smooth scroll
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Focus and pulse highlight
  setTimeout(() => {
    input.focus();
    if (typeof input.select === 'function') {
      input.select();
    }
    input.classList.remove('jump-highlight');
    void input.offsetWidth; // Force reflow
    input.classList.add('jump-highlight');

    setTimeout(() => {
      input.classList.remove('jump-highlight');
    }, 1800);
  }, 120);
}
window.jumpToFormInput = jumpToFormInput;

/* ==========================================================================
   Drag-and-Drop Reordering Engine
   ========================================================================== */

function setupDragAndDropReordering() {
  setupSectionDragAndDrop();
}

function setupSectionDragAndDrop() {
  const container = document.getElementById('reorderable-sections-container');
  if (!container) return;

  const cards = container.querySelectorAll('.section-card');
  cards.forEach((card) => {
    const secKey = card.getAttribute('data-section-key');
    const handle = card.querySelector('.section-drag-handle');
    if (!handle || !secKey) return;
    if (handle.dataset.dragBound === 'true') return;
    handle.dataset.dragBound = 'true';

    handle.setAttribute('draggable', 'true');

    handle.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'section', secKey }));
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      container.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      card.classList.remove('drag-over-top', 'drag-over-bottom');
      if (e.clientY < midY) {
        card.classList.add('drag-over-top');
      } else {
        card.classList.add('drag-over-bottom');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over-top', 'drag-over-bottom');
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.type === 'section' && data.secKey && data.secKey !== secKey) {
          const order = resumeState.sectionOrder || ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
          const fromIdx = order.indexOf(data.secKey);
          let toIdx = order.indexOf(secKey);

          if (fromIdx !== -1 && toIdx !== -1) {
            const [moved] = order.splice(fromIdx, 1);
            order.splice(toIdx, 0, moved);
            resumeState.sectionOrder = order;

            // Clear preset chips
            document.querySelectorAll('.order-chip-btn').forEach(btn => btn.classList.remove('active'));

            reorderFormSectionCards();
            updatePreviews();
            scheduleAutoSave();
            showToast(`Reordered sections`);
          }
        }
      } catch (err) {
        console.warn(err);
      }
    });
  });
}

function attachItemDragEvents(el, listKey, idx, renderFn) {
  const handle = el.querySelector('.item-drag-handle');
  if (!handle) return;

  handle.setAttribute('draggable', 'true');

  handle.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'item', listKey, fromIdx: idx }));
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('is-dragging');
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('is-dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
  });

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    el.classList.remove('drag-over-top', 'drag-over-bottom');
    if (e.clientY < midY) {
      el.classList.add('drag-over-top');
    } else {
      el.classList.add('drag-over-bottom');
    }
  });

  el.addEventListener('dragleave', (e) => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-over-top', 'drag-over-bottom');
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.type === 'item' && data.listKey === listKey && data.fromIdx !== idx) {
        const [movedItem] = resumeState[listKey].splice(data.fromIdx, 1);
        resumeState[listKey].splice(idx, 0, movedItem);
        renderFn();
        updatePreviews();
        scheduleAutoSave();
        showToast(`Reordered ${listKey}`);
      }
    } catch (err) {
      console.warn(err);
    }
  });
}

function attachBulletDragEvents(bulletEl, listKey, itemIdx, bulletIdx, renderFn) {
  const handle = bulletEl.querySelector('.bullet-drag-handle');
  if (!handle) return;

  handle.setAttribute('draggable', 'true');

  handle.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'bullet', listKey, itemIdx, fromBulletIdx: bulletIdx }));
    e.dataTransfer.effectAllowed = 'move';
    bulletEl.classList.add('is-dragging');
  });

  bulletEl.addEventListener('dragend', () => {
    bulletEl.classList.remove('is-dragging');
    document.querySelectorAll('.bullet-item.drag-over-top, .bullet-item.drag-over-bottom').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
  });

  bulletEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = bulletEl.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    bulletEl.classList.remove('drag-over-top', 'drag-over-bottom');
    if (e.clientY < midY) {
      bulletEl.classList.add('drag-over-top');
    } else {
      bulletEl.classList.add('drag-over-bottom');
    }
  });

  bulletEl.addEventListener('dragleave', () => {
    bulletEl.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  bulletEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    bulletEl.classList.remove('drag-over-top', 'drag-over-bottom');
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.type === 'bullet' && data.listKey === listKey && data.itemIdx === itemIdx && data.fromBulletIdx !== bulletIdx) {
        const [movedBullet] = resumeState[listKey][itemIdx].bullets.splice(data.fromBulletIdx, 1);
        resumeState[listKey][itemIdx].bullets.splice(bulletIdx, 0, movedBullet);
        renderFn();
        updatePreviews();
        scheduleAutoSave();
        showToast(`Reordered bullet point`);
      }
    } catch (err) {
      console.warn(err);
    }
  });
}

function attachCustomItemDragEvents(el, customId, idx) {
  const handle = el.querySelector('.item-drag-handle');
  if (!handle) return;
  handle.setAttribute('draggable', 'true');

  handle.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'custom-item', customId, fromIdx: idx }));
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('is-dragging');
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('is-dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
  });

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    el.classList.remove('drag-over-top', 'drag-over-bottom');
    if (e.clientY < midY) el.classList.add('drag-over-top');
    else el.classList.add('drag-over-bottom');
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-over-top', 'drag-over-bottom');
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.type === 'custom-item' && data.customId === customId && data.fromIdx !== idx) {
        const sec = (resumeState.customSections || []).find(cs => cs.id === customId);
        if (sec && sec.items) {
          const [movedItem] = sec.items.splice(data.fromIdx, 1);
          sec.items.splice(idx, 0, movedItem);
          renderCustomSectionsList();
          updatePreviews();
          scheduleAutoSave();
          showToast(`Reordered ${sec.title || 'entry'}`);
        }
      }
    } catch (err) {
      console.warn(err);
    }
  });
}

function attachCustomBulletDragEvents(bulletEl, customId, itemIdx, bulletIdx) {
  const handle = bulletEl.querySelector('.bullet-drag-handle');
  if (!handle) return;
  handle.setAttribute('draggable', 'true');

  handle.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'custom-bullet', customId, itemIdx, fromBulletIdx: bulletIdx }));
    e.dataTransfer.effectAllowed = 'move';
    bulletEl.classList.add('is-dragging');
  });

  bulletEl.addEventListener('dragend', () => {
    bulletEl.classList.remove('is-dragging');
    document.querySelectorAll('.bullet-item.drag-over-top, .bullet-item.drag-over-bottom').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
  });

  bulletEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = bulletEl.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    bulletEl.classList.remove('drag-over-top', 'drag-over-bottom');
    if (e.clientY < midY) bulletEl.classList.add('drag-over-top');
    else bulletEl.classList.add('drag-over-bottom');
  });

  bulletEl.addEventListener('dragleave', () => {
    bulletEl.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  bulletEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    bulletEl.classList.remove('drag-over-top', 'drag-over-bottom');
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.type === 'custom-bullet' && data.customId === customId && data.itemIdx === itemIdx && data.fromBulletIdx !== bulletIdx) {
        const sec = (resumeState.customSections || []).find(cs => cs.id === customId);
        if (sec && sec.items && sec.items[itemIdx] && sec.items[itemIdx].bullets) {
          const bullets = sec.items[itemIdx].bullets;
          const [movedBullet] = bullets.splice(data.fromBulletIdx, 1);
          bullets.splice(bulletIdx, 0, movedBullet);
          renderCustomSectionsList();
          updatePreviews();
          scheduleAutoSave();
          showToast('Reordered bullet point');
        }
      }
    } catch (err) {
      console.warn(err);
    }
  });
}

/* ==========================================================================
   Dynamic Section Renderers (with Reordering & Deletion)
   ========================================================================== */

// 1. Education
function renderEducationList() {
  const container = document.getElementById('education-list');
  container.innerHTML = '';
  resumeState.education.forEach((edu, idx) => {
    const item = document.createElement('div');
    item.className = 'repeatable-item';
    item.dataset.index = idx;
    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">
          <span class="item-drag-handle" draggable="true" title="Drag to reorder" onclick="event.stopPropagation()">⋮⋮</span>
          School / College #${idx + 1}
        </span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('education', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('education', ${idx}, 1)" ${idx === resumeState.education.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeEducation(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>College / University Name</label>
          <input type="text" id="edu-${idx}-institution" class="form-control" value="${escapeHtml(edu.institution)}" oninput="updateEduField(${idx}, 'institution', this.value)">
        </div>
        <div class="form-group">
          <label>Location (e.g. Georgetown, TX)</label>
          <input type="text" id="edu-${idx}-location" class="form-control" value="${escapeHtml(edu.location)}" oninput="updateEduField(${idx}, 'location', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Degree / Major</label>
          <input type="text" id="edu-${idx}-degree" class="form-control" value="${escapeHtml(edu.degree)}" oninput="updateEduField(${idx}, 'degree', this.value)">
        </div>
        <div class="form-group">
          <label>Dates (e.g. Aug. 2018 -- May 2021)</label>
          <input type="text" id="edu-${idx}-dates" class="form-control" value="${escapeHtml(edu.dates)}" oninput="updateEduField(${idx}, 'dates', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>CGPA / Percentage (Optional)</label>
          <input type="text" id="edu-${idx}-gpa" class="form-control" value="${escapeHtml(edu.gpa || '')}" placeholder="e.g. 9.2 / 10.0" oninput="updateEduField(${idx}, 'gpa', this.value)">
        </div>
        <div class="form-group">
          <label>Relevant Coursework (Optional)</label>
          <input type="text" id="edu-${idx}-coursework" class="form-control" value="${escapeHtml(edu.coursework || '')}" oninput="updateEduField(${idx}, 'coursework', this.value)">
        </div>
      </div>
    `;
    container.appendChild(item);
    attachItemDragEvents(item, 'education', idx, renderEducationList);
  });
}

function updateEduField(idx, field, val) {
  resumeState.education[idx][field] = val;
  updatePreviews();
}

function addEducation() {
  resumeState.education.push({
    institution: 'University Name',
    location: 'City, State',
    degree: 'Bachelor of Technology in Computer Science',
    dates: 'Aug. 2022 -- May 2026',
    gpa: '',
    coursework: ''
  });
  renderEducationList();
  updatePreviews();
}

function removeEducation(idx) {
  resumeState.education.splice(idx, 1);
  renderEducationList();
  updatePreviews();
}

// 2. Experience
function renderExperienceList() {
  const container = document.getElementById('experience-list');
  container.innerHTML = '';
  resumeState.experience.forEach((exp, idx) => {
    const item = document.createElement('div');
    item.className = 'repeatable-item';
    item.dataset.index = idx;

    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">
          <span class="item-drag-handle" draggable="true" title="Drag to reorder" onclick="event.stopPropagation()">⋮⋮</span>
          Experience #${idx + 1}
        </span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('experience', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('experience', ${idx}, 1)" ${idx === resumeState.experience.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeExperience(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Job Title / Role</label>
          <input type="text" id="exp-${idx}-role" class="form-control" value="${escapeHtml(exp.role)}" oninput="updateExpField(${idx}, 'role', this.value)">
        </div>
        <div class="form-group">
          <label>Dates (e.g. June 2020 -- Present)</label>
          <input type="text" id="exp-${idx}-dates" class="form-control" value="${escapeHtml(exp.dates)}" oninput="updateExpField(${idx}, 'dates', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Company / Organization Name</label>
          <input type="text" id="exp-${idx}-company" class="form-control" value="${escapeHtml(exp.company)}" oninput="updateExpField(${idx}, 'company', this.value)">
        </div>
        <div class="form-group">
          <label>Location (e.g. College Station, TX)</label>
          <input type="text" id="exp-${idx}-location" class="form-control" value="${escapeHtml(exp.location)}" oninput="updateExpField(${idx}, 'location', this.value)">
        </div>
      </div>
      <div class="form-group subsection-group">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="margin-bottom: 0; font-weight: 600; font-size: 0.82rem;">Sub-sections / Highlights (e.g. Core Tech, Focus Area)</label>
          <button type="button" class="btn btn-sm btn-secondary" onclick="addExpSubsection(${idx})">+ Add Sub-section</button>
        </div>
        <div class="subsection-list" id="exp-subsections-${idx}"></div>
      </div>
      <div class="form-group">
        <label>Bullet Points <button class="btn btn-sm btn-secondary" onclick="addExpBullet(${idx})">+ Add Bullet</button></label>
        <div class="bullet-list" id="exp-bullets-${idx}"></div>
      </div>
    `;
    container.appendChild(item);

    const expSubContainer = item.querySelector(`#exp-subsections-${idx}`);
    if (exp.subsections && exp.subsections.length > 0) {
      exp.subsections.forEach((sub, sIdx) => {
        const subRow = document.createElement('div');
        subRow.className = 'subsection-item-row';
        subRow.innerHTML = `
          <input type="text" id="exp-${idx}-sub-${sIdx}-label" class="form-control subsection-label-input" value="${escapeHtml(sub.label || '')}" placeholder="Heading (e.g. Tech Stack)" oninput="updateExpSubsection(${idx}, ${sIdx}, 'label', this.value)">
          <input type="text" id="exp-${idx}-sub-${sIdx}-text" class="form-control subsection-text-input" value="${escapeHtml(sub.text || '')}" placeholder="Details / keywords" oninput="updateExpSubsection(${idx}, ${sIdx}, 'text', this.value)">
          <button type="button" class="btn btn-sm btn-danger" onclick="removeExpSubsection(${idx}, ${sIdx})" title="Remove sub-section">&times;</button>
        `;
        expSubContainer.appendChild(subRow);
      });
    }

    const bulletsContainer = item.querySelector(`#exp-bullets-${idx}`);
    exp.bullets.forEach((bullet, bIdx) => {
      const bItem = document.createElement('div');
      bItem.className = 'bullet-item';
      bItem.dataset.bulletIdx = bIdx;
      bItem.innerHTML = `
        <span class="bullet-drag-handle" draggable="true" title="Drag to reorder bullet" onclick="event.stopPropagation()">⋮⋮</span>
        <span class="bullet-indicator">&bull;</span>
        <input type="text" id="exp-${idx}-bullet-${bIdx}" class="form-control" value="${escapeHtml(bullet)}" placeholder="Action verb + task + quantifiable result" oninput="updateExpBullet(${idx}, ${bIdx}, this.value)">
        <button class="btn btn-sm btn-danger" onclick="removeExpBullet(${idx}, ${bIdx})">&times;</button>
      `;
      bulletsContainer.appendChild(bItem);
      attachBulletDragEvents(bItem, 'experience', idx, bIdx, renderExperienceList);
    });

    attachItemDragEvents(item, 'experience', idx, renderExperienceList);
  });
}

function updateExpField(idx, field, val) {
  resumeState.experience[idx][field] = val;
  updatePreviews();
}

function updateExpBullet(expIdx, bIdx, val) {
  resumeState.experience[expIdx].bullets[bIdx] = val;
  updatePreviews();
}

function addExpBullet(expIdx) {
  resumeState.experience[expIdx].bullets.push('');
  renderExperienceList();
  updatePreviews();
}

function removeExpBullet(expIdx, bIdx) {
  resumeState.experience[expIdx].bullets.splice(bIdx, 1);
  renderExperienceList();
  updatePreviews();
}

function addExpSubsection(expIdx) {
  if (!resumeState.experience[expIdx].subsections) {
    resumeState.experience[expIdx].subsections = [];
  }
  resumeState.experience[expIdx].subsections.push({ label: 'Key Technologies', text: '' });
  renderExperienceList();
  updatePreviews();
}
window.addExpSubsection = addExpSubsection;

function removeExpSubsection(expIdx, sIdx) {
  if (resumeState.experience[expIdx].subsections) {
    resumeState.experience[expIdx].subsections.splice(sIdx, 1);
    renderExperienceList();
    updatePreviews();
  }
}
window.removeExpSubsection = removeExpSubsection;

function updateExpSubsection(expIdx, sIdx, field, val) {
  if (resumeState.experience[expIdx].subsections && resumeState.experience[expIdx].subsections[sIdx]) {
    resumeState.experience[expIdx].subsections[sIdx][field] = val;
    updatePreviews();
  }
}
window.updateExpSubsection = updateExpSubsection;

function addExperience() {
  resumeState.experience.push({
    role: 'Software Development Intern',
    company: 'Company Name',
    location: 'City, State',
    dates: 'June 2024 -- Aug. 2024',
    bullets: ['Engineered full-stack features improving user engagement by 20%.']
  });
  renderExperienceList();
  updatePreviews();
}

function removeExperience(idx) {
  resumeState.experience.splice(idx, 1);
  renderExperienceList();
  updatePreviews();
}

// 3. Projects (with Clickable Links)
function renderProjectsList() {
  const container = document.getElementById('projects-list');
  container.innerHTML = '';
  resumeState.projects.forEach((proj, idx) => {
    const item = document.createElement('div');
    item.className = 'repeatable-item';
    item.dataset.index = idx;

    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">
          <span class="item-drag-handle" draggable="true" title="Drag to reorder" onclick="event.stopPropagation()">⋮⋮</span>
          Project #${idx + 1}
        </span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('projects', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('projects', ${idx}, 1)" ${idx === resumeState.projects.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeProject(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Project Title</label>
          <input type="text" id="proj-${idx}-title" class="form-control" value="${escapeHtml(proj.title)}" oninput="updateProjField(${idx}, 'title', this.value)">
        </div>
        <div class="form-group">
          <label>Technologies Used</label>
          <input type="text" id="proj-${idx}-techStack" class="form-control" value="${escapeHtml(proj.techStack)}" placeholder="e.g. Python, Flask, React, PostgreSQL, Docker" oninput="updateProjField(${idx}, 'techStack', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Duration / Dates</label>
          <input type="text" id="proj-${idx}-dates" class="form-control" value="${escapeHtml(proj.dates)}" placeholder="e.g. June 2020 -- Present" oninput="updateProjField(${idx}, 'dates', this.value)">
        </div>
        <div class="form-group">
          <label>GitHub Repository URL (Optional)</label>
          <div class="input-with-action">
            <input type="url" id="proj-${idx}-githubUrl" class="form-control" value="${escapeHtml(proj.githubUrl || '')}" placeholder="https://github.com/..." oninput="updateProjField(${idx}, 'githubUrl', this.value)">
            ${proj.githubUrl ? `<a href="${normalizeUrl(proj.githubUrl)}" target="_blank" class="test-link-btn">Test ↗</a>` : ''}
          </div>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Live Demo URL (Optional)</label>
          <div class="input-with-action">
            <input type="url" id="proj-${idx}-liveUrl" class="form-control" value="${escapeHtml(proj.liveUrl || '')}" placeholder="https://..." oninput="updateProjField(${idx}, 'liveUrl', this.value)">
            ${proj.liveUrl ? `<a href="${normalizeUrl(proj.liveUrl)}" target="_blank" class="test-link-btn">Test ↗</a>` : ''}
          </div>
        </div>
        <div class="form-group">
          <label>Live Demo Link Label</label>
          <input type="text" id="proj-${idx}-liveLabel" class="form-control" value="${escapeHtml(proj.liveLabel || 'Live Demo')}" oninput="updateProjField(${idx}, 'liveLabel', this.value)">
        </div>
      </div>
      <div class="form-group subsection-group">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="margin-bottom: 0; font-weight: 600; font-size: 0.82rem;">Sub-sections / Tech Stack Highlights</label>
          <button type="button" class="btn btn-sm btn-secondary" onclick="addProjSubsection(${idx})">+ Add Sub-section</button>
        </div>
        <div class="subsection-list" id="proj-subsections-${idx}"></div>
      </div>
      <div class="form-group">
        <label>Bullet Points <button class="btn btn-sm btn-secondary" onclick="addProjBullet(${idx})">+ Add Bullet</button></label>
        <div class="bullet-list" id="proj-bullets-${idx}"></div>
      </div>
    `;
    container.appendChild(item);

    const projSubContainer = item.querySelector(`#proj-subsections-${idx}`);
    if (proj.subsections && proj.subsections.length > 0) {
      proj.subsections.forEach((sub, sIdx) => {
        const subRow = document.createElement('div');
        subRow.className = 'subsection-item-row';
        subRow.innerHTML = `
          <input type="text" id="proj-${idx}-sub-${sIdx}-label" class="form-control subsection-label-input" value="${escapeHtml(sub.label || '')}" placeholder="Heading (e.g. Core Tech)" oninput="updateProjSubsection(${idx}, ${sIdx}, 'label', this.value)">
          <input type="text" id="proj-${idx}-sub-${sIdx}-text" class="form-control subsection-text-input" value="${escapeHtml(sub.text || '')}" placeholder="Details / keywords" oninput="updateProjSubsection(${idx}, ${sIdx}, 'text', this.value)">
          <button type="button" class="btn btn-sm btn-danger" onclick="removeProjSubsection(${idx}, ${sIdx})" title="Remove sub-section">&times;</button>
        `;
        projSubContainer.appendChild(subRow);
      });
    }

    const bulletsContainer = item.querySelector(`#proj-bullets-${idx}`);
    proj.bullets.forEach((bullet, bIdx) => {
      const bItem = document.createElement('div');
      bItem.className = 'bullet-item';
      bItem.dataset.bulletIdx = bIdx;
      bItem.innerHTML = `
        <span class="bullet-drag-handle" draggable="true" title="Drag to reorder bullet" onclick="event.stopPropagation()">⋮⋮</span>
        <span class="bullet-indicator">&bull;</span>
        <input type="text" id="proj-${idx}-bullet-${bIdx}" class="form-control" value="${escapeHtml(bullet)}" placeholder="Developed X using Y for Z..." oninput="updateProjBullet(${idx}, ${bIdx}, this.value)">
        <button class="btn btn-sm btn-danger" onclick="removeProjBullet(${idx}, ${bIdx})">&times;</button>
      `;
      bulletsContainer.appendChild(bItem);
      attachBulletDragEvents(bItem, 'projects', idx, bIdx, renderProjectsList);
    });

    attachItemDragEvents(item, 'projects', idx, renderProjectsList);
  });
}

function updateProjField(idx, field, val) {
  resumeState.projects[idx][field] = val;
  updatePreviews();
}

function updateProjBullet(projIdx, bIdx, val) {
  resumeState.projects[projIdx].bullets[bIdx] = val;
  updatePreviews();
}

function addProjBullet(projIdx) {
  resumeState.projects[projIdx].bullets.push('');
  renderProjectsList();
  updatePreviews();
}

function removeProjBullet(projIdx, bIdx) {
  resumeState.projects[projIdx].bullets.splice(bIdx, 1);
  renderProjectsList();
  updatePreviews();
}

function addProjSubsection(projIdx) {
  if (!resumeState.projects[projIdx].subsections) {
    resumeState.projects[projIdx].subsections = [];
  }
  resumeState.projects[projIdx].subsections.push({ label: 'Key Technologies', text: '' });
  renderProjectsList();
  updatePreviews();
}
window.addProjSubsection = addProjSubsection;

function removeProjSubsection(projIdx, sIdx) {
  if (resumeState.projects[projIdx].subsections) {
    resumeState.projects[projIdx].subsections.splice(sIdx, 1);
    renderProjectsList();
    updatePreviews();
  }
}
window.removeProjSubsection = removeProjSubsection;

function updateProjSubsection(projIdx, sIdx, field, val) {
  if (resumeState.projects[projIdx].subsections && resumeState.projects[projIdx].subsections[sIdx]) {
    resumeState.projects[projIdx].subsections[sIdx][field] = val;
    updatePreviews();
  }
}
window.updateProjSubsection = updateProjSubsection;

function addProject() {
  resumeState.projects.push({
    title: 'New Project',
    techStack: 'Python, React, PostgreSQL',
    dates: 'Jan. 2024 -- Present',
    liveUrl: '',
    liveLabel: 'Live Demo',
    githubUrl: '',
    githubLabel: 'GitHub',
    bullets: ['Developed a web application featuring REST API and real-time dashboard.']
  });
  renderProjectsList();
  updatePreviews();
}

function removeProject(idx) {
  resumeState.projects.splice(idx, 1);
  renderProjectsList();
  updatePreviews();
}

// 4. Certifications
function renderCertificationsList() {
  const container = document.getElementById('certifications-list');
  container.innerHTML = '';
  if (!resumeState.certifications) resumeState.certifications = [];
  resumeState.certifications.forEach((cert, idx) => {
    const item = document.createElement('div');
    item.className = 'repeatable-item';
    item.dataset.index = idx;
    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">
          <span class="item-drag-handle" draggable="true" title="Drag to reorder" onclick="event.stopPropagation()">⋮⋮</span>
          Certification #${idx + 1}
        </span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('certifications', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('certifications', ${idx}, 1)" ${idx === resumeState.certifications.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeCertification(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Certificate Name</label>
          <input type="text" id="cert-${idx}-name" class="form-control" value="${escapeHtml(cert.name)}" oninput="updateCertField(${idx}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label>Issuing Organization</label>
          <input type="text" id="cert-${idx}-issuer" class="form-control" value="${escapeHtml(cert.issuer)}" oninput="updateCertField(${idx}, 'issuer', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Issue Date</label>
          <input type="text" id="cert-${idx}-date" class="form-control" value="${escapeHtml(cert.date)}" oninput="updateCertField(${idx}, 'date', this.value)">
        </div>
        <div class="form-group">
          <label>Credential ID (Optional)</label>
          <input type="text" id="cert-${idx}-credentialId" class="form-control" value="${escapeHtml(cert.credentialId || '')}" oninput="updateCertField(${idx}, 'credentialId', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Verification URL (Clickable)</label>
        <div class="input-with-action">
          <input type="url" id="cert-${idx}-url" class="form-control" value="${escapeHtml(cert.url || '')}" placeholder="https://..." oninput="updateCertField(${idx}, 'url', this.value)">
          ${cert.url ? `<a href="${normalizeUrl(cert.url)}" target="_blank" class="test-link-btn">Verify ↗</a>` : ''}
        </div>
      </div>
    `;
    container.appendChild(item);
    attachItemDragEvents(item, 'certifications', idx, renderCertificationsList);
  });
}

function updateCertField(idx, field, val) {
  resumeState.certifications[idx][field] = val;
  updatePreviews();
}

function addCertification() {
  if (!resumeState.certifications) resumeState.certifications = [];
  resumeState.certifications.push({
    name: 'Certificate Title',
    issuer: 'Issuing Organization',
    date: 'Issued 2024',
    credentialId: '',
    url: ''
  });
  renderCertificationsList();
  updatePreviews();
}

function removeCertification(idx) {
  resumeState.certifications.splice(idx, 1);
  renderCertificationsList();
  updatePreviews();
}

// 5. Honors & Achievements
function renderAchievementsList() {
  const container = document.getElementById('achievements-list');
  container.innerHTML = '';
  if (!resumeState.achievements) resumeState.achievements = [];
  resumeState.achievements.forEach((ach, idx) => {
    const item = document.createElement('div');
    item.className = 'repeatable-item';
    item.dataset.index = idx;
    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">
          <span class="item-drag-handle" draggable="true" title="Drag to reorder" onclick="event.stopPropagation()">⋮⋮</span>
          Achievement #${idx + 1}
        </span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('achievements', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('achievements', ${idx}, 1)" ${idx === resumeState.achievements.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeAchievement(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="ach-${idx}-title" class="form-control" value="${escapeHtml(ach.title)}" oninput="updateAchField(${idx}, 'title', this.value)">
        </div>
        <div class="form-group">
          <label>Proof URL (Optional)</label>
          <div class="input-with-action">
            <input type="url" id="ach-${idx}-url" class="form-control" value="${escapeHtml(ach.url || '')}" oninput="updateAchField(${idx}, 'url', this.value)">
            ${ach.url ? `<a href="${normalizeUrl(ach.url)}" target="_blank" class="test-link-btn">Open ↗</a>` : ''}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="ach-${idx}-description" class="form-control" value="${escapeHtml(ach.description || '')}" oninput="updateAchField(${idx}, 'description', this.value)">
      </div>
    `;
    container.appendChild(item);
    attachItemDragEvents(item, 'achievements', idx, renderAchievementsList);
  });
}

function updateAchField(idx, field, val) {
  resumeState.achievements[idx][field] = val;
  updatePreviews();
}

function addAchievement() {
  if (!resumeState.achievements) resumeState.achievements = [];
  resumeState.achievements.push({
    title: 'Award / Honor Title',
    description: 'Description of accomplishment',
    url: '',
    linkLabel: 'Link'
  });
  renderAchievementsList();
  updatePreviews();
}

function removeAchievement(idx) {
  resumeState.achievements.splice(idx, 1);
  renderAchievementsList();
  updatePreviews();
}

/* ==========================================================================
   Dynamic Technical Skills Category Management
   ========================================================================== */

function renderSkillsList() {
  const container = document.getElementById('skills-list');
  if (!container) return;
  container.innerHTML = '';

  if (typeof normalizeSkills === 'function') {
    resumeState.skills = normalizeSkills(resumeState.skills);
  }

  if (!Array.isArray(resumeState.skills) || resumeState.skills.length === 0) {
    container.innerHTML = `
      <div style="padding: 0.8rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; border: 1px dashed var(--border-subtle); border-radius: var(--radius-sm);">
        No skill categories yet. Use the quick buttons above or click below to add one.
      </div>
    `;
    return;
  }

  resumeState.skills.forEach((skill, idx) => {
    const item = document.createElement('div');
    item.className = 'repeatable-item skill-card-item';
    item.dataset.index = idx;
    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">
          <span class="item-drag-handle" draggable="true" title="Drag to reorder" onclick="event.stopPropagation()">⋮⋮</span>
          <span class="sub-order-pill">${idx + 1}</span>
          <strong>${escapeHtml(skill.category || 'Untitled Category')}</strong>
        </span>
        <div class="reorder-group">
          <button type="button" class="btn btn-sm btn-secondary btn-icon" onclick="moveSkillCategory(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button type="button" class="btn btn-sm btn-secondary btn-icon" onclick="moveSkillCategory(${idx}, 1)" ${idx === resumeState.skills.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="removeSkillCategory(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Category Title</label>
          <input type="text" id="skill-${idx}-category" class="form-control" value="${escapeHtml(skill.category || '')}" placeholder="e.g. Languages, Cloud & DevOps" oninput="updateSkillField(${idx}, 'category', this.value)">
        </div>
        <div class="form-group">
          <label>Skills &amp; Technologies (Sub-section)</label>
          <input type="text" id="skill-${idx}-items" class="form-control" value="${escapeHtml(skill.items || '')}" placeholder="e.g. Python, Java, C++, Docker, AWS" oninput="updateSkillField(${idx}, 'items', this.value)">
        </div>
      </div>
    `;
    container.appendChild(item);
    attachItemDragEvents(item, 'skills', idx, renderSkillsList);
  });
}

function updateSkillField(idx, field, val) {
  if (resumeState.skills && resumeState.skills[idx]) {
    resumeState.skills[idx][field] = val;
    // Update live card title
    const container = document.getElementById('skills-list');
    if (container && container.children[idx]) {
      const titleSpan = container.children[idx].querySelector('.repeatable-item-title strong');
      if (titleSpan && field === 'category') {
        titleSpan.textContent = val || 'Untitled Category';
      }
    }
    updatePreviews();
  }
}

function addSkillCategory(catName = '', defaultItems = '') {
  if (typeof normalizeSkills === 'function') {
    resumeState.skills = normalizeSkills(resumeState.skills);
  }
  if (!Array.isArray(resumeState.skills)) resumeState.skills = [];

  resumeState.skills.push({
    category: catName || 'New Skill Category',
    items: defaultItems || ''
  });

  renderSkillsList();
  updatePreviews();
  showToast('✓ Added skill category!');
}
window.addSkillCategory = addSkillCategory;

function quickAddSkillCategory(category, items) {
  addSkillCategory(category, items);
}
window.quickAddSkillCategory = quickAddSkillCategory;

function removeSkillCategory(idx) {
  if (resumeState.skills && resumeState.skills[idx]) {
    resumeState.skills.splice(idx, 1);
    renderSkillsList();
    updatePreviews();
    showToast('Removed skill category');
  }
}
window.removeSkillCategory = removeSkillCategory;

function moveSkillCategory(idx, direction) {
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= resumeState.skills.length) return;
  const temp = resumeState.skills[idx];
  resumeState.skills[idx] = resumeState.skills[targetIdx];
  resumeState.skills[targetIdx] = temp;
  renderSkillsList();
  updatePreviews();
}
window.moveSkillCategory = moveSkillCategory;

/* ==========================================================================
   Main Resume Section Reordering (Sequence Manager)
   ========================================================================== */

function moveSection(sectionKey, direction) {
  if (!resumeState.sectionOrder) {
    resumeState.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
  }
  const idx = resumeState.sectionOrder.indexOf(sectionKey);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= resumeState.sectionOrder.length) return;

  const temp = resumeState.sectionOrder[idx];
  resumeState.sectionOrder[idx] = resumeState.sectionOrder[targetIdx];
  resumeState.sectionOrder[targetIdx] = temp;

  reorderFormSectionCards();
  updatePreviews();

  // Clear active state on preset buttons if custom order
  document.querySelectorAll('.order-chip-btn').forEach(btn => btn.classList.remove('active'));

  let secTitle = SECTION_METADATA[sectionKey]?.title;
  if (!secTitle && (sectionKey.startsWith('custom_') || sectionKey.startsWith('sec-custom_'))) {
    const cId = sectionKey.replace(/^sec-/, '');
    const c = (resumeState.customSections || []).find(cs => cs.id === cId || cs.id === sectionKey);
    if (c) secTitle = c.title;
  }
  secTitle = secTitle || sectionKey;
  showToast(`Moved ${secTitle} ${direction < 0 ? '↑ Up' : '↓ Down'}`);
}
window.moveSection = moveSection;

function setSectionOrderPreset(presetKey) {
  const presets = {
    standard: ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'],
    fresher: ['introduction', 'education', 'skills', 'projects', 'experience', 'certifications', 'achievements'],
    experienced: ['introduction', 'experience', 'projects', 'skills', 'education', 'certifications', 'achievements'],
    skillsFirst: ['introduction', 'skills', 'projects', 'experience', 'education', 'certifications', 'achievements']
  };

  if (presets[presetKey]) {
    const currentCustoms = (resumeState.sectionOrder || []).filter(k => k.startsWith('custom_'));
    resumeState.sectionOrder = [...presets[presetKey], ...currentCustoms];

    // Update active button state
    document.querySelectorAll('.order-chip-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-order-${presetKey}`);
    if (activeBtn) activeBtn.classList.add('active');

    reorderFormSectionCards();
    updatePreviews();
    showToast(`Applied ${presetKey.toUpperCase()} section order!`);
  }
}
window.setSectionOrderPreset = setSectionOrderPreset;

function reorderFormSectionCards() {
  const container = document.getElementById('reorderable-sections-container');
  if (!container) return;

  const order = resumeState.sectionOrder || ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];

  order.forEach((secKey, index) => {
    let card = null;
    const meta = SECTION_METADATA[secKey];
    if (meta) {
      card = document.getElementById(meta.id);
    } else if (secKey.startsWith('custom_') || secKey.startsWith('sec-custom_')) {
      const cId = secKey.replace(/^sec-/, '');
      card = document.getElementById(`sec-${cId}`);
    }

    if (card) {
      container.appendChild(card);
      // Update badge number
      const badge = card.querySelector('.section-order-badge');
      if (badge) badge.textContent = index + 1;
      // Update buttons disabled status
      const btnUp = card.querySelector('.btn-order-up');
      const btnDown = card.querySelector('.btn-order-down');
      if (btnUp) btnUp.disabled = (index === 0);
      if (btnDown) btnDown.disabled = (index === order.length - 1);
    }
  });

  updateQuickNavChips(order);
  setupSectionDragAndDrop();
}

function updateQuickNavChips(order) {
  const navContainer = document.querySelector('.quick-nav-chips');
  if (!navContainer) return;

  const chips = [
    { id: 'sec-header', label: '👤 Header' }
  ];

  order.forEach(secKey => {
    const meta = SECTION_METADATA[secKey];
    if (meta) {
      const label = meta.shortTitle ? `${meta.icon} ${meta.shortTitle}` : `${meta.icon} ${meta.title.split(' ')[0]}`;
      chips.push({ id: meta.id, label });
    } else if (secKey.startsWith('custom_') || secKey.startsWith('sec-custom_')) {
      const cId = secKey.replace(/^sec-/, '');
      const c = (resumeState.customSections || []).find(cs => cs.id === cId || cs.id === secKey);
      if (c) {
        const shortName = c.title.split(' ')[0] || 'Custom';
        chips.push({ id: `sec-${c.id}`, label: `📌 ${escapeHtml(shortName)}` });
      }
    }
  });

  navContainer.innerHTML = chips.map(c => `
    <button type="button" class="chip-btn" onclick="scrollToSection('${c.id}')">${c.label}</button>
  `).join('');
}

function scrollToSection(secId) {
  const el = document.getElementById(secId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('collapsed');
  }
}

/* ==========================================================================
   Dynamic Custom Sections Management
   ========================================================================== */

function renderCustomSectionVisual(customSec) {
  if (!customSec || !customSec.title || !customSec.title.trim()) return '';
  const title = customSec.title.trim();
  const cId = customSec.id;

  let html = `
    <section class="res-section" id="res-section-${cId}">
      ${getSectionTitleHtml(title, `sec-${cId}`)}
  `;

  if (customSec.items && customSec.items.length > 0) {
    const hasSubheadings = customSec.items.some(item => item.title || item.subtitle || item.dates || item.location);

    if (hasSubheadings) {
      customSec.items.forEach((item, idx) => {
        html += `
          <div class="res-subheading">
            <div class="res-row-between">
              <span class="res-bold" data-jump-target="custom-${cId}-item-${idx}-title">${formatBulletHtml(item.title || '')}</span>
              <span class="res-dates" data-jump-target="custom-${cId}-item-${idx}-dates">${formatBulletHtml(item.dates || '')}</span>
            </div>
            <div class="res-row-between">
              <span class="res-italic" data-jump-target="custom-${cId}-item-${idx}-subtitle">${formatBulletHtml(item.subtitle || '')}</span>
              <span class="res-location" data-jump-target="custom-${cId}-item-${idx}-location">${formatBulletHtml(item.location || '')}</span>
            </div>
            ${item.bullets && item.bullets.length > 0 ? `
              <ul class="res-bullets">
                ${item.bullets.filter(b => b && b.trim()).map((b, bIdx) => `<li data-jump-target="custom-${cId}-item-${idx}-bullet-${bIdx}">${formatBulletHtml(b)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `;
      });
    } else {
      html += `<ul class="res-bullets">`;
      customSec.items.forEach((item, idx) => {
        if (item.bullets && item.bullets.length > 0) {
          item.bullets.forEach((b, bIdx) => {
            if (b && b.trim()) {
              html += `<li data-jump-target="custom-${cId}-item-${idx}-bullet-${bIdx}">${formatBulletHtml(b)}</li>`;
            }
          });
        }
      });
      html += `</ul>`;
    }
  }

  html += `</section>`;
  return html;
}

function renderCustomSectionsList() {
  const container = document.getElementById('reorderable-sections-container');
  if (!container) return;

  if (!resumeState.customSections) {
    resumeState.customSections = [];
  }

  // Remove any stale custom section cards from DOM that are no longer in state
  container.querySelectorAll('.section-card[data-is-custom="true"]').forEach(card => {
    const key = card.getAttribute('data-section-key');
    if (!resumeState.customSections.some(cs => cs.id === key)) {
      card.remove();
    }
  });

  resumeState.customSections.forEach((c) => {
    let card = document.getElementById(`sec-${c.id}`);
    if (!card) {
      card = document.createElement('div');
      card.id = `sec-${c.id}`;
      card.className = 'section-card';
      card.dataset.sectionKey = c.id;
      card.dataset.isCustom = 'true';
      container.appendChild(card);
    }

    card.innerHTML = `
      <div class="section-header">
        <div class="section-title">
          <span class="section-drag-handle" draggable="true" title="Drag to reorder section" onclick="event.stopPropagation()">⋮⋮</span>
          <span class="section-order-badge">?</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <input type="text" class="custom-section-title-input" value="${escapeHtml(c.title)}" placeholder="Section Title (e.g. Certifications, Leadership)" oninput="updateCustomSectionTitle('${c.id}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="section-header-actions" onclick="event.stopPropagation()">
          <div class="section-reorder-group">
            <button type="button" class="btn-order-arrow btn-order-up" onclick="moveSection('${c.id}', -1)" title="Move Section Up">↑</button>
            <button type="button" class="btn-order-arrow btn-order-down" onclick="moveSection('${c.id}', 1)" title="Move Section Down">↓</button>
          </div>
          <button type="button" class="btn btn-sm btn-danger" onclick="removeCustomSection('${c.id}')">Delete Section</button>
          <svg class="section-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      <div class="section-body">
        <div class="custom-items-list" id="custom-items-${c.id}"></div>
        <button type="button" class="btn btn-secondary btn-block" style="margin-top: 10px;" onclick="addCustomSectionItem('${c.id}')">+ Add Entry to ${escapeHtml(c.title || 'Section')}</button>
      </div>
    `;

    // Reattach accordion header click listener
    const header = card.querySelector('.section-header');
    header.addEventListener('click', () => {
      card.classList.toggle('collapsed');
    });

    const itemsContainer = card.querySelector(`#custom-items-${c.id}`);
    (c.items || []).forEach((item, itmIdx) => {
      const itmEl = document.createElement('div');
      itmEl.className = 'repeatable-item';
      itmEl.dataset.index = itmIdx;

      itmEl.innerHTML = `
        <div class="repeatable-item-header">
          <span class="repeatable-item-title">
            <span class="item-drag-handle" draggable="true" title="Drag to reorder" onclick="event.stopPropagation()">⋮⋮</span>
            Entry #${itmIdx + 1}
          </span>
          <div class="reorder-group">
            <button type="button" class="btn btn-sm btn-secondary btn-icon" onclick="moveCustomItem('${c.id}', ${itmIdx}, -1)" ${itmIdx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
            <button type="button" class="btn btn-sm btn-secondary btn-icon" onclick="moveCustomItem('${c.id}', ${itmIdx}, 1)" ${itmIdx === c.items.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
            <button type="button" class="btn btn-sm btn-danger" onclick="removeCustomSectionItem('${c.id}', ${itmIdx})">Remove</button>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Title / Heading</label>
            <input type="text" id="custom-${c.id}-item-${itmIdx}-title" class="form-control" value="${escapeHtml(item.title || '')}" placeholder="e.g. AWS Certified Solutions Architect or Team Lead" oninput="updateCustomItemField('${c.id}', ${itmIdx}, 'title', this.value)">
          </div>
          <div class="form-group">
            <label>Dates / Duration (Optional)</label>
            <input type="text" id="custom-${c.id}-item-${itmIdx}-dates" class="form-control" value="${escapeHtml(item.dates || '')}" placeholder="e.g. 2024 or May 2023 -- Present" oninput="updateCustomItemField('${c.id}', ${itmIdx}, 'dates', this.value)">
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Organization / Subtitle (Optional)</label>
            <input type="text" id="custom-${c.id}-item-${itmIdx}-subtitle" class="form-control" value="${escapeHtml(item.subtitle || '')}" placeholder="e.g. Amazon Web Services or Open Source" oninput="updateCustomItemField('${c.id}', ${itmIdx}, 'subtitle', this.value)">
          </div>
          <div class="form-group">
            <label>Location (Optional)</label>
            <input type="text" id="custom-${c.id}-item-${itmIdx}-location" class="form-control" value="${escapeHtml(item.location || '')}" placeholder="e.g. Seattle, WA or Remote" oninput="updateCustomItemField('${c.id}', ${itmIdx}, 'location', this.value)">
          </div>
        </div>
        <div class="form-group">
          <label>Bullet Points / Details <button type="button" class="btn btn-sm btn-secondary" onclick="addCustomItemBullet('${c.id}', ${itmIdx})">+ Add Bullet</button></label>
          <div class="bullet-list" id="custom-${c.id}-item-${itmIdx}-bullets"></div>
        </div>
      `;
      itemsContainer.appendChild(itmEl);
      attachCustomItemDragEvents(itmEl, c.id, itmIdx);

      const bulletsContainer = itmEl.querySelector(`#custom-${c.id}-item-${itmIdx}-bullets`);
      (item.bullets || []).forEach((bullet, bIdx) => {
        const bItem = document.createElement('div');
        bItem.className = 'bullet-item';
        bItem.innerHTML = `
          <span class="bullet-drag-handle" draggable="true" title="Drag to reorder bullet" onclick="event.stopPropagation()">⋮⋮</span>
          <span class="bullet-indicator">&bull;</span>
          <input type="text" id="custom-${c.id}-item-${itmIdx}-bullet-${bIdx}" class="form-control" value="${escapeHtml(bullet)}" placeholder="Key highlight or summary description" oninput="updateCustomItemBullet('${c.id}', ${itmIdx}, ${bIdx}, this.value)">
          <button type="button" class="btn btn-sm btn-danger" onclick="removeCustomItemBullet('${c.id}', ${itmIdx}, ${bIdx})">&times;</button>
        `;
        bulletsContainer.appendChild(bItem);
        attachCustomBulletDragEvents(bItem, c.id, itmIdx, bIdx);
      });
    });
  });
}

function addCustomSection(customTitle = '') {
  let title = customTitle;
  if (!title) {
    title = prompt('Enter the title for your new section (e.g. Certifications & Licenses, Leadership & Activities, Publications):', 'Certifications & Activities');
  }
  if (!title || !title.trim()) return;
  title = title.trim();

  if (!resumeState.customSections) {
    resumeState.customSections = [];
  }
  if (!resumeState.sectionOrder) {
    resumeState.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
  }

  const newId = 'custom_' + Date.now();
  const newSection = {
    id: newId,
    title: title,
    items: [
      {
        title: title + ' Item #1',
        subtitle: 'Organization / Issuer',
        dates: '2024',
        location: '',
        bullets: ['Key achievement, certification verification link, or highlight']
      }
    ]
  };

  resumeState.customSections.push(newSection);
  resumeState.sectionOrder.push(newId);

  renderCustomSectionsList();
  reorderFormSectionCards();
  updatePreviews();
  scheduleAutoSave();
  showToast(`Added custom section: "${title}"`);

  setTimeout(() => {
    scrollToSection(`sec-${newId}`);
  }, 100);
}
window.addCustomSection = addCustomSection;
window.promptAddCustomSection = addCustomSection;

function removeCustomSection(customId) {
  if (!confirm('Are you sure you want to remove this custom section?')) return;
  if (resumeState.customSections) {
    resumeState.customSections = resumeState.customSections.filter(c => c.id !== customId);
  }
  if (resumeState.sectionOrder) {
    resumeState.sectionOrder = resumeState.sectionOrder.filter(s => s !== customId && s !== `sec-${customId}`);
  }
  const el = document.getElementById(`sec-${customId}`);
  if (el) el.remove();

  renderCustomSectionsList();
  reorderFormSectionCards();
  updatePreviews();
  scheduleAutoSave();
  showToast('Removed custom section');
}
window.removeCustomSection = removeCustomSection;

function updateCustomSectionTitle(customId, title) {
  if (!resumeState.customSections) return;
  const c = resumeState.customSections.find(sec => sec.id === customId);
  if (c) {
    c.title = title;
    updateQuickNavChips(resumeState.sectionOrder);
    updatePreviews();
    scheduleAutoSave();
  }
}
window.updateCustomSectionTitle = updateCustomSectionTitle;

function addCustomSectionItem(customId) {
  const c = (resumeState.customSections || []).find(sec => sec.id === customId);
  if (!c) return;
  if (!c.items) c.items = [];
  c.items.push({
    title: '',
    subtitle: '',
    dates: '',
    location: '',
    bullets: ['']
  });
  renderCustomSectionsList();
  updatePreviews();
  scheduleAutoSave();
}
window.addCustomSectionItem = addCustomSectionItem;

function removeCustomSectionItem(customId, itemIdx) {
  const c = (resumeState.customSections || []).find(sec => sec.id === customId);
  if (!c || !c.items) return;
  c.items.splice(itemIdx, 1);
  renderCustomSectionsList();
  updatePreviews();
  scheduleAutoSave();
}
window.removeCustomSectionItem = removeCustomSectionItem;

function moveCustomItem(customId, itemIdx, direction) {
  const c = (resumeState.customSections || []).find(sec => sec.id === customId);
  if (!c || !c.items) return;
  const targetIdx = itemIdx + direction;
  if (targetIdx < 0 || targetIdx >= c.items.length) return;
  const temp = c.items[itemIdx];
  c.items[itemIdx] = c.items[targetIdx];
  c.items[targetIdx] = temp;
  renderCustomSectionsList();
  updatePreviews();
  scheduleAutoSave();
}
window.moveCustomItem = moveCustomItem;

function updateCustomItemField(customId, itemIdx, field, val) {
  const c = (resumeState.customSections || []).find(sec => sec.id === customId);
  if (!c || !c.items || !c.items[itemIdx]) return;
  c.items[itemIdx][field] = val;
  updatePreviews();
  scheduleAutoSave();
}
window.updateCustomItemField = updateCustomItemField;

function addCustomItemBullet(customId, itemIdx) {
  const c = (resumeState.customSections || []).find(sec => sec.id === customId);
  if (!c || !c.items || !c.items[itemIdx]) return;
  if (!c.items[itemIdx].bullets) c.items[itemIdx].bullets = [];
  c.items[itemIdx].bullets.push('');
  renderCustomSectionsList();
  updatePreviews();
  scheduleAutoSave();
}
window.addCustomItemBullet = addCustomItemBullet;

function removeCustomItemBullet(customId, itemIdx, bIdx) {
  const c = (resumeState.customSections || []).find(sec => sec.id === customId);
  if (!c || !c.items || !c.items[itemIdx] || !c.items[itemIdx].bullets) return;
  c.items[itemIdx].bullets.splice(bIdx, 1);
  renderCustomSectionsList();
  updatePreviews();
  scheduleAutoSave();
}
window.removeCustomItemBullet = removeCustomItemBullet;

function updateCustomItemBullet(customId, itemIdx, bIdx, val) {
  const c = (resumeState.customSections || []).find(sec => sec.id === customId);
  if (!c || !c.items || !c.items[itemIdx] || !c.items[itemIdx].bullets) return;
  c.items[itemIdx].bullets[bIdx] = val;
  updatePreviews();
  scheduleAutoSave();
}
window.updateCustomItemBullet = updateCustomItemBullet;

/* ==========================================================================
   Introduction / Summary Section Management
   ========================================================================== */

function renderIntroductionSection() {
  if (!resumeState.introduction) {
    resumeState.introduction = { enabled: false, text: '' };
  }
  const intro = resumeState.introduction;
  const textarea = document.getElementById('inp-intro-text');
  const btnToggle = document.getElementById('btn-toggle-intro');
  const notice = document.getElementById('intro-hidden-notice');
  const formGroup = document.getElementById('intro-form-group');
  const countSpan = document.getElementById('intro-char-count');

  if (textarea) {
    textarea.value = intro.text || '';
    if (countSpan) countSpan.textContent = `${(intro.text || '').length} chars`;
  }

  if (btnToggle) {
    if (intro.enabled) {
      btnToggle.textContent = 'Remove Section';
      btnToggle.className = 'btn btn-sm btn-danger';
      if (formGroup) formGroup.style.display = 'flex';
      if (notice) notice.style.display = 'none';
    } else {
      btnToggle.textContent = '+ Add Introduction';
      btnToggle.className = 'btn btn-sm btn-emerald';
      if (formGroup) formGroup.style.display = 'none';
      if (notice) notice.style.display = 'block';
    }
  }
}

function updateIntroductionText(val) {
  if (!resumeState.introduction) {
    resumeState.introduction = { enabled: true, text: '' };
  }
  resumeState.introduction.text = val;
  const countSpan = document.getElementById('intro-char-count');
  if (countSpan) countSpan.textContent = `${val.length} chars`;
  updatePreviews();
}

function toggleIntroductionSection(forceState) {
  if (!resumeState.introduction) {
    resumeState.introduction = { enabled: false, text: '' };
  }
  if (typeof forceState === 'boolean') {
    resumeState.introduction.enabled = forceState;
  } else {
    resumeState.introduction.enabled = !resumeState.introduction.enabled;
  }

  // If newly enabled and empty, provide a quality starter draft
  if (resumeState.introduction.enabled && (!resumeState.introduction.text || !resumeState.introduction.text.trim())) {
    resumeState.introduction.text = 'Dynamic and results-driven B.Tech Computer Science undergraduate with strong foundations in Data Structures, Algorithms, and Software Engineering. Eager to contribute to scalable, high-impact software solutions.';
  }

  renderIntroductionSection();
  updatePreviews();
  showToast(resumeState.introduction.enabled ? '✓ Enabled Introduction section on resume' : 'Removed Introduction section from resume');
}

function applyIntroTemplate(type) {
  const templates = {
    sde: 'Results-driven B.Tech Computer Science graduate specializing in scalable backend architectures, distributed systems, and modern cloud infrastructure. Experienced with high-traffic web applications in Java, Python, and Node.js.',
    aiml: 'Passionate B.Tech Computer Science student specializing in Machine Learning, Computer Vision, and Deep Learning pipelines. Hands-on experience developing neural networks with PyTorch and deploying scalable ML models.',
    fresher: 'Motivated B.Tech Computer Science undergraduate with strong problem-solving skills in Data Structures & Algorithms. Eager to contribute to high-impact projects with proficiency in modern web development and software design.',
    clear: ''
  };

  if (!resumeState.introduction) {
    resumeState.introduction = { enabled: true, text: '' };
  }
  resumeState.introduction.enabled = (type !== 'clear');
  resumeState.introduction.text = templates[type] !== undefined ? templates[type] : '';
  renderIntroductionSection();
  updatePreviews();
  showToast(type === 'clear' ? 'Cleared introduction text' : `Applied ${type.toUpperCase()} introduction template!`);
}

/* ==========================================================================
   Resume Upload & Auto-Extraction Controller
   ========================================================================== */

let pendingExtractedData = null;

function openUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (!modal) return;
  resetUploadModal();
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });
}

function closeUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 220);
}

function handleModalBackdropClick(e) {
  if (e.target.id === 'upload-modal') {
    closeUploadModal();
  }
}

function switchUploadTab(tabKey) {
  const btnFile = document.getElementById('tab-btn-file');
  const btnPaste = document.getElementById('tab-btn-paste');
  const contentFile = document.getElementById('tab-content-file');
  const contentPaste = document.getElementById('tab-content-paste');

  if (tabKey === 'file') {
    btnFile?.classList.add('active');
    btnPaste?.classList.remove('active');
    contentFile?.classList.add('active');
    contentPaste?.classList.remove('active');
  } else {
    btnPaste?.classList.add('active');
    btnFile?.classList.remove('active');
    contentPaste?.classList.add('active');
    contentFile?.classList.remove('active');
  }
}

function triggerFileInput() {
  const fileInput = document.getElementById('resume-file-input');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function setParseLoading(isLoading, message = 'Extracting and analyzing resume...') {
  const progressContainer = document.getElementById('parse-progress-container');
  const progressLabel = document.getElementById('parse-progress-label');
  const tabsContainer = document.querySelector('.modal-tabs');
  const contentFile = document.getElementById('tab-content-file');
  const contentPaste = document.getElementById('tab-content-paste');
  const resultsContainer = document.getElementById('parse-results-container');

  if (isLoading) {
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressLabel) progressLabel.textContent = message;
    if (tabsContainer) tabsContainer.style.display = 'none';
    if (contentFile) contentFile.style.display = 'none';
    if (contentPaste) contentPaste.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'none';
  } else {
    if (progressContainer) progressContainer.style.display = 'none';
  }
}

function resetUploadModal() {
  pendingExtractedData = null;
  const tabsContainer = document.querySelector('.modal-tabs');
  const contentFile = document.getElementById('tab-content-file');
  const contentPaste = document.getElementById('tab-content-paste');
  const progressContainer = document.getElementById('parse-progress-container');
  const resultsContainer = document.getElementById('parse-results-container');
  const pasteTextarea = document.getElementById('paste-resume-textarea');
  const fileInput = document.getElementById('resume-file-input');

  if (tabsContainer) tabsContainer.style.display = 'flex';
  if (contentFile) {
    contentFile.style.display = '';
    contentFile.classList.add('active');
  }
  if (contentPaste) {
    contentPaste.style.display = '';
    contentPaste.classList.remove('active');
  }
  if (progressContainer) progressContainer.style.display = 'none';
  if (resultsContainer) resultsContainer.style.display = 'none';
  if (pasteTextarea) pasteTextarea.value = '';
  if (fileInput) fileInput.value = '';

  const btnFile = document.getElementById('tab-btn-file');
  const btnPaste = document.getElementById('tab-btn-paste');
  btnFile?.classList.add('active');
  btnPaste?.classList.remove('active');
}

async function handleFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await processResumeFile(file);
}

async function processResumeFile(file) {
  const filename = file.name.toLowerCase();
  setParseLoading(true, `Reading ${file.name}...`);

  try {
    let parsedResult = null;

    if (filename.endsWith('.json')) {
      setParseLoading(true, 'Reading resume backup file...');
      const jsonContent = await file.text();
      const backupData = JSON.parse(jsonContent);
      const stateToLoad = backupData.state || backupData;
      if (!stateToLoad || typeof stateToLoad !== 'object' || !stateToLoad.personal) {
        throw new Error('Invalid resume backup file. Missing personal info or resume structure.');
      }
      parsedResult = stateToLoad;
    } else if (filename.endsWith('.pdf')) {
      if (typeof ResumeParser === 'undefined' || !ResumeParser.extractTextFromPdf) {
        throw new Error('PDF extraction engine not loaded. Please ensure you are connected or refresh the page.');
      }
      setParseLoading(true, 'Extracting text and hyperlinks from PDF...');
      const arrayBuffer = await file.arrayBuffer();
      const pdfExtraction = await ResumeParser.extractTextFromPdf(arrayBuffer, (percent) => {
        setParseLoading(true, `Reading PDF pages & hyperlinks (${percent}%)...`);
      });
      setParseLoading(true, 'Analyzing sections, contact links, and experiences...');
      const text = (pdfExtraction && typeof pdfExtraction === 'object' && pdfExtraction.text) ? pdfExtraction.text : pdfExtraction;
      const links = (pdfExtraction && typeof pdfExtraction === 'object' && pdfExtraction.links) ? pdfExtraction.links : [];
      parsedResult = ResumeParser.parseText(text, links);
    } else if (filename.endsWith('.tex')) {
      setParseLoading(true, 'Parsing LaTeX document...');
      const texContent = await file.text();
      parsedResult = ResumeParser.parseLatex(texContent);
    } else {
      setParseLoading(true, 'Parsing text document...');
      const textContent = await file.text();
      parsedResult = ResumeParser.parseText(textContent);
    }

    if (!parsedResult) {
      throw new Error('Could not extract resume information from this file.');
    }

    showExtractionSummary(parsedResult);
  } catch (err) {
    console.error('Resume extraction error:', err);
    setParseLoading(false);
    resetUploadModal();
    alert(`Could not extract resume: ${err.message || err}`);
  }
}

function handlePasteExtraction() {
  const textarea = document.getElementById('paste-resume-textarea');
  const text = textarea?.value?.trim();
  if (!text) {
    alert('Please paste some resume text into the box first.');
    return;
  }

  setParseLoading(true, 'Analyzing pasted resume text...');
  try {
    let parsedResult = null;
    if (text.includes('\\documentclass') || text.includes('\\begin{document}')) {
      parsedResult = ResumeParser.parseLatex(text);
    } else {
      parsedResult = ResumeParser.parseText(text);
    }
    showExtractionSummary(parsedResult);
  } catch (err) {
    console.error('Paste extraction error:', err);
    setParseLoading(false);
    resetUploadModal();
    alert(`Failed to analyze resume text: ${err.message || err}`);
  }
}

function showExtractionSummary(data) {
  setParseLoading(false);
  pendingExtractedData = data;

  const resultsContainer = document.getElementById('parse-results-container');
  const summaryName = document.getElementById('summary-name');
  const summaryBadges = document.getElementById('summary-badges');

  if (summaryName) {
    summaryName.textContent = data.personal?.fullName || 'Extracted Candidate Profile';
  }

  if (summaryBadges) {
    let contactCount = 0;
    if (data.personal?.phone) contactCount++;
    if (data.personal?.email) contactCount++;
    if (data.personal?.linkedin) contactCount++;
    if (data.personal?.github) contactCount++;
    if (data.personal?.leetcode) contactCount++;
    if (data.personal?.portfolio) contactCount++;

    const badges = [
      { count: data.education?.length || 0, label: 'Education' },
      { count: data.experience?.length || 0, label: 'Experience' },
      { count: data.projects?.length || 0, label: 'Projects' },
      { count: data.skills?.length || 0, label: 'Skill Categories' },
      { count: data.certifications?.length || 0, label: 'Certificates' },
      { count: data.achievements?.length || 0, label: 'Honors' }
    ];

    if (contactCount > 0) {
      badges.unshift({ count: contactCount, label: 'Contact & Links' });
    }

    if (data.introduction?.enabled && data.introduction?.text) {
      badges.unshift({ count: '✓', label: 'Introduction' });
    }

    summaryBadges.innerHTML = badges.map(b => `
      <div class="summary-badge-item">
        <div class="summary-badge-count">${b.count}</div>
        <div class="summary-badge-label">${b.label}</div>
      </div>
    `).join('');
  }

  if (resultsContainer) {
    resultsContainer.style.display = 'block';
  }
}

function applyExtractedResume(mergeMode = false) {
  if (!pendingExtractedData) return;

  const data = pendingExtractedData;

  if (!data.personal) data.personal = {};
  if (!Array.isArray(data.education)) data.education = [];
  if (!Array.isArray(data.experience)) data.experience = [];
  if (!Array.isArray(data.projects)) data.projects = [];
  if (!Array.isArray(data.skills)) data.skills = [];
  if (!Array.isArray(data.certifications)) data.certifications = [];
  if (!Array.isArray(data.achievements)) data.achievements = [];
  if (!Array.isArray(data.customSections)) data.customSections = [];
  if (!data.introduction) data.introduction = { enabled: false, text: '' };
  if (!data.sectionOrder) {
    data.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
  }

  if (typeof normalizeSkills === 'function') {
    data.skills = normalizeSkills(data.skills);
  }

  // Update global application state
  resumeState = JSON.parse(JSON.stringify(data));

  // Populate form fields, re-order cards, and update visual preview & LaTeX code
  populateFormFromState();
  updatePreviews();

  // Close modal and show confirmation toast
  closeUploadModal();
  showToast('✓ Resume imported and loaded into editor!');
}

/* ==========================================================================
   Draft Backup Export & Reset
   ========================================================================== */

function exportResumeBackupJson() {
  const payload = {
    app: 'Jake Resume LaTeX Builder',
    version: '3.4.3',
    format: 'jake-resume-backup',
    exportedAt: new Date().toISOString(),
    activeProfileId: activeProfileId,
    profileName: getActiveProfileName(),
    state: resumeState,
    options: currentOptions,
    profiles: resumeProfiles
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const cleanName = (resumeState.personal?.fullName || 'resume')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename = `${cleanName || 'resume'}-backup.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`✓ Downloaded ${filename}`);
}

function resetToDefaultDraft() {
  const confirmed = confirm(
    'Are you sure you want to reset?\n\nThis will clear your auto-saved draft and restore the original Jake Gutierrez template. (Tip: Click "Backup" first if you want to keep a copy of your work).'
  );
  if (!confirmed) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn(e);
  }

  isAutoSaveSuspended = true;
  resumeState = JSON.parse(JSON.stringify(BTECH_PRESETS.jake));
  if (!resumeState.sectionOrder) {
    resumeState.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
  }
  resumeState.customSections = [];
  if (!resumeState.introduction) {
    resumeState.introduction = { enabled: false, text: '' };
  }
  if (typeof normalizeSkills === 'function') {
    resumeState.skills = normalizeSkills(resumeState.skills);
  }

  currentOptions = {
    fontSize: '11pt',
    paperSize: 'letterpaper',
    sectionSpacing: '-4pt',
    itemSpacing: '-2pt',
    showCertifications: true,
    showAchievements: true
  };

  const presetSelect = document.getElementById('preset-select');
  if (presetSelect) presetSelect.value = 'jake';

  // Synchronize with active profile
  const profIdx = resumeProfiles.findIndex(p => p.id === activeProfileId);
  if (profIdx !== -1) {
    resumeProfiles[profIdx].state = JSON.parse(JSON.stringify(resumeState));
    resumeProfiles[profIdx].options = JSON.parse(JSON.stringify(currentOptions));
    resumeProfiles[profIdx].updatedAt = Date.now();
  }
  saveProfilesToStorage();

  populateFormFromState();
  updatePreviews(false);
  isAutoSaveSuspended = false;

  updateAutosaveStatus('saved', 'Default Loaded');
  showToast('✓ Restored default Jake Gutierrez template');
}

// Explicit Global Window Bindings for Inline HTML Event Handlers
window.initApp = initApp;
window.scrollToSection = scrollToSection;
window.setSectionOrderPreset = setSectionOrderPreset;
window.moveSection = moveSection;
window.reorderFormSectionCards = reorderFormSectionCards;
window.renderIntroductionSection = renderIntroductionSection;
window.updateIntroductionText = updateIntroductionText;
window.toggleIntroductionSection = toggleIntroductionSection;
window.applyIntroTemplate = applyIntroTemplate;
window.addEducation = addEducation;
window.removeEducation = removeEducation;
window.updateEduField = updateEduField;
window.addExperience = addExperience;
window.removeExperience = removeExperience;
window.updateExpField = updateExpField;
window.insertActionVerb = insertActionVerb;
window.addProject = addProject;
window.removeProject = removeProject;
window.updateProjField = updateProjField;
window.addExpBullet = addExpBullet;
window.removeExpBullet = removeExpBullet;
window.updateExpBullet = updateExpBullet;
window.addProjBullet = addProjBullet;
window.removeProjBullet = removeProjBullet;
window.updateProjBullet = updateProjBullet;
window.renderSkillsList = renderSkillsList;
window.updateSkillField = updateSkillField;
window.addSkillCategory = addSkillCategory;
window.quickAddSkillCategory = quickAddSkillCategory;
window.removeSkillCategory = removeSkillCategory;
window.moveSkillCategory = moveSkillCategory;
window.addCertification = addCertification;
window.removeCertification = removeCertification;
window.updateCertField = updateCertField;
window.addAchievement = addAchievement;
window.removeAchievement = removeAchievement;
window.updateAchField = updateAchField;
window.moveItem = moveItem;
window.autoFitToOnePage = autoFitToOnePage;
window.exportCleanPdf = exportCleanPdf;
window.copyLatexCode = copyLatexCode;
window.downloadTexFile = downloadTexFile;
window.openInOverleaf = openInOverleaf;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.handleModalBackdropClick = handleModalBackdropClick;
window.switchUploadTab = switchUploadTab;
window.triggerFileInput = triggerFileInput;
window.handleFileSelected = handleFileSelected;
window.handlePasteExtraction = handlePasteExtraction;
window.applyExtractedResume = applyExtractedResume;
window.resetUploadModal = resetUploadModal;
window.exportResumeBackupJson = exportResumeBackupJson;
window.resetToDefaultDraft = resetToDefaultDraft;
window.getResumeState = () => resumeState;
window.setResumeState = (st) => { resumeState = st; };
window.scheduleAutoSave = scheduleAutoSave;
window.loadDraftFromStorage = initProfiles;
window.formatBulletHtml = formatBulletHtml;
window.showDownloadOverflowWarningModal = showDownloadOverflowWarningModal;
window.closeDownloadWarningModal = closeDownloadWarningModal;
window.proceedWithDownloadAnyway = proceedWithDownloadAnyway;
window.autoFitAndDownload = autoFitAndDownload;
window.showTrimLinesModal = showTrimLinesModal;
window.closeTrimLinesModal = closeTrimLinesModal;
window.openTrimModalFromBanner = openTrimModalFromBanner;
window.openTrimModalFromDownload = openTrimModalFromDownload;
window.generateTrimRecommendations = generateTrimRecommendations;

// Multi-Resume Profiles & Power Editor UX Exports
window.handleProfileSelectChange = handleProfileSelectChange;
window.switchProfile = switchProfile;
window.openProfilesModal = openProfilesModal;
window.closeProfilesModal = closeProfilesModal;
window.renderProfilesModalList = renderProfilesModalList;
window.handleCreateNewProfile = handleCreateNewProfile;
window.handleDuplicateProfile = handleDuplicateProfile;
window.handleRenameProfile = handleRenameProfile;
window.handleDeleteProfile = handleDeleteProfile;
window.jumpToFormInput = jumpToFormInput;
window.setupSectionDragAndDrop = setupSectionDragAndDrop;
window.attachCustomItemDragEvents = attachCustomItemDragEvents;
window.attachCustomBulletDragEvents = attachCustomBulletDragEvents;
window.setupDragAndDropReordering = setupDragAndDropReordering;
window.setupSplitterResizer = setupSplitterResizer;

// Typography & Rich Formatting Exports
window.updateNameFontSize = updateNameFontSize;
window.updateSectionHeaderSize = updateSectionHeaderSize;
window.updateBodyFontSize = updateBodyFontSize;
window.updateSectionAccentColor = updateSectionAccentColor;
window.openTypographyModal = openTypographyModal;
window.closeTypographyModal = closeTypographyModal;
window.applyTextFormat = applyTextFormat;
window.smartApplyFormat = smartApplyFormat;
window.toggleColorPalette = toggleColorPalette;
window.toggleSizePalette = toggleSizePalette;

// Subsections & Custom Sections Exports
window.addProjSubsection = addProjSubsection;
window.removeProjSubsection = removeProjSubsection;
window.updateProjSubsection = updateProjSubsection;
window.addExpSubsection = addExpSubsection;
window.removeExpSubsection = removeExpSubsection;
window.updateExpSubsection = updateExpSubsection;
window.addCustomSection = addCustomSection;
window.promptAddCustomSection = addCustomSection;
window.removeCustomSection = removeCustomSection;
window.updateCustomSectionTitle = updateCustomSectionTitle;
window.addCustomSectionItem = addCustomSectionItem;
window.removeCustomSectionItem = removeCustomSectionItem;
window.moveCustomItem = moveCustomItem;
window.updateCustomItemField = updateCustomItemField;
window.addCustomItemBullet = addCustomItemBullet;
window.removeCustomItemBullet = removeCustomItemBullet;
window.updateCustomItemBullet = updateCustomItemBullet;
window.renderCustomSectionsList = renderCustomSectionsList;
window.renderCustomSectionVisual = renderCustomSectionVisual;

/* ==========================================================================
   FORGE STUDIO — More Actions Dropdown Toggle
   ========================================================================== */
function toggleMoreActionsMenu() {
  const menu = document.getElementById('more-actions-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    menu.classList.remove('open');
  } else {
    menu.classList.add('open');
    const closeOutside = (e) => {
      const trigger = document.getElementById('btn-more-actions');
      if (!menu.contains(e.target) && !(trigger && trigger.contains(e.target))) {
        menu.classList.remove('open');
        document.removeEventListener('click', closeOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOutside, true), 10);
  }
}
window.toggleMoreActionsMenu = toggleMoreActionsMenu;

/* ==========================================================================
   FORGE STUDIO — Sidebar Progress Ring & Step Tracker
   ========================================================================== */
function updateSidebarProgress() {
  try {
    const s = resumeState;
    let filled = 0;
    let total = 0;
    total += 3;
    if (s.personal && s.personal.fullName && s.personal.fullName.trim()) filled++;
    if (s.personal && s.personal.email && s.personal.email.trim()) filled++;
    if (s.personal && s.personal.phone && s.personal.phone.trim()) filled++;
    total += 1;
    const hasEdu = s.education && s.education.length > 0 && s.education[0].school && s.education[0].school.trim();
    if (hasEdu) filled++;
    total += 1;
    const hasExp = s.experience && s.experience.length > 0 && s.experience[0].company && s.experience[0].company.trim();
    if (hasExp) filled++;
    total += 1;
    const hasProj = s.projects && s.projects.length > 0 && s.projects[0].name && s.projects[0].name.trim();
    if (hasProj) filled++;
    total += 1;
    const hasSkills = s.skills && s.skills.length > 0 && s.skills[0].category && s.skills[0].category.trim();
    if (hasSkills) filled++;
    total += 1;
    if ((s.personal && s.personal.github && s.personal.github.trim()) ||
        (s.personal && s.personal.linkedin && s.personal.linkedin.trim())) filled++;

    const pct = Math.round((filled / total) * 100);
    const pctEl = document.getElementById('sidebar-progress-pct');
    if (pctEl) pctEl.textContent = pct;
    const ringFill = document.getElementById('sidebar-ring-fill');
    if (ringFill) {
      const circumference = 201;
      const offset = (circumference - (pct / 100) * circumference).toFixed(1);
      ringFill.style.strokeDashoffset = offset;
      ringFill.style.stroke = pct >= 80 ? '#10b981' : '#6366f1';
    }
    const stepMap = {
      'step-personal':   !!(s.personal && s.personal.fullName && s.personal.fullName.trim()),
      'step-intro':      !!(s.introduction && s.introduction.enabled && s.introduction.text && s.introduction.text.trim()),
      'step-education':  !!hasEdu,
      'step-experience': !!hasExp,
      'step-projects':   !!hasProj,
      'step-skills':     !!hasSkills,
      'step-certs':      !!(s.certifications && s.certifications.length > 0),
      'step-honors':     !!(s.achievements && s.achievements.length > 0),
    };
    Object.entries(stepMap).forEach(([id, isDone]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('done', isDone);
    });
  } catch(e) {}
}
window.updateSidebarProgress = updateSidebarProgress;

function updateSidebarActiveStep(sectionId) {
  const map = {
    'sec-header':'step-personal','sec-intro':'step-intro','sec-education':'step-education',
    'sec-experience':'step-experience','sec-projects':'step-projects','sec-skills':'step-skills',
    'sec-certs':'step-certs','sec-honors':'step-honors'
  };
  document.querySelectorAll('.sidebar-step').forEach(el => el.classList.remove('active'));
  const target = map[sectionId];
  if (target) { const el = document.getElementById(target); if (el) el.classList.add('active'); }
}
window.updateSidebarActiveStep = updateSidebarActiveStep;

const _origScroll = window.scrollToSection;
window.scrollToSection = function(id) { if(_origScroll) _origScroll(id); updateSidebarActiveStep(id); };

const _origPreviews = window.updatePreviews;
window.updatePreviews = function(s) { if(_origPreviews) _origPreviews(s); updateSidebarProgress(); };

document.addEventListener('DOMContentLoaded', () => { setTimeout(updateSidebarProgress, 500); });
