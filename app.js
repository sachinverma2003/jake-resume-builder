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
  showAchievements: true
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
   Continuous Local Auto-Save & Draft Recovery System
   ========================================================================== */
const STORAGE_KEY = 'jake_resume_draft_v1';
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
    indicator.title = `Last auto-saved: ${new Date(lastSavedTimestamp).toLocaleString()}. You can safely close or refresh this tab anytime.`;
  }
}

function scheduleAutoSave() {
  if (isAutoSaveSuspended) return;

  updateAutosaveStatus('saving', 'Saving...');
  clearTimeout(autoSaveTimer);

  autoSaveTimer = setTimeout(() => {
    try {
      lastSavedTimestamp = Date.now();
      const payload = {
        state: resumeState,
        options: currentOptions,
        updatedAt: lastSavedTimestamp
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      updateAutosaveStatus('saved', formatSavedTime(lastSavedTimestamp));
    } catch (err) {
      console.error('Failed to auto-save draft to localStorage:', err);
      updateAutosaveStatus('error', 'Save error');
    }
  }, 400);
}

function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.state && parsed.state.personal) {
      resumeState = parsed.state;
      if (parsed.options) {
        currentOptions = { ...currentOptions, ...parsed.options };
      }
      lastSavedTimestamp = parsed.updatedAt || Date.now();

      if (!resumeState.sectionOrder) {
        resumeState.sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
      }
      if (!resumeState.introduction) {
        resumeState.introduction = { enabled: false, text: '' };
      }
      if (typeof normalizeSkills === 'function') {
        resumeState.skills = normalizeSkills(resumeState.skills);
      }

      updateAutosaveStatus('saved', formatSavedTime(lastSavedTimestamp));

      setTimeout(() => {
        showToast('✓ Restored your in-progress resume draft');
      }, 400);

      return true;
    }
  } catch (err) {
    console.warn('Could not restore draft from localStorage:', err);
  }
  return false;
}

/**
 * Initialize Application
 */
function initApp() {
  isAutoSaveSuspended = true;
  const restored = loadDraftFromStorage();
  populateFormFromState();
  updatePreviews(false);
  setupEventListeners();
  applyZoom(currentZoom);
  isAutoSaveSuspended = false;

  if (!restored) {
    updateAutosaveStatus('saved', 'Ready');
  }
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

  // Reorder Form Section Cards in DOM
  reorderFormSectionCards();
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
 */
function renderVisualResume() {
  const { personal, education, experience, projects, skills, certifications, achievements } = resumeState;

  // 1. Header & Contacts
  let contactsHtml = [];
  if (personal.phone) contactsHtml.push(`<span>${escapeHtml(personal.phone)}</span>`);
  if (personal.email) {
    contactsHtml.push(`<a href="mailto:${personal.email.trim()}" style="text-decoration: none;">${escapeHtml(personal.email.trim())}</a>`);
  }
  if (personal.linkedin) {
    const disp = typeof getSiteDisplayName === 'function' ? getSiteDisplayName(personal.linkedin, personal.linkedinDisplay, 'LinkedIn') : (personal.linkedinDisplay || 'LinkedIn');
    contactsHtml.push(`<a href="${normalizeUrl(personal.linkedin)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">${escapeHtml(disp)}</a>`);
  }
  if (personal.github) {
    const disp = typeof getSiteDisplayName === 'function' ? getSiteDisplayName(personal.github, personal.githubDisplay, 'GitHub') : (personal.githubDisplay || 'GitHub');
    contactsHtml.push(`<a href="${normalizeUrl(personal.github)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">${escapeHtml(disp)}</a>`);
  }
  if (personal.leetcode) {
    const disp = typeof getSiteDisplayName === 'function' ? getSiteDisplayName(personal.leetcode, personal.leetcodeDisplay, 'LeetCode') : (personal.leetcodeDisplay || 'LeetCode');
    contactsHtml.push(`<a href="${normalizeUrl(personal.leetcode)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">${escapeHtml(disp)}</a>`);
  }
  if (personal.portfolio) {
    const disp = typeof getSiteDisplayName === 'function' ? getSiteDisplayName(personal.portfolio, personal.portfolioDisplay, 'Portfolio') : (personal.portfolioDisplay || 'Portfolio');
    contactsHtml.push(`<a href="${normalizeUrl(personal.portfolio)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">${escapeHtml(disp)}</a>`);
  }

  let html = `
    <header class="res-header">
      <div class="res-name">${escapeHtml(personal.fullName || 'Jake Ryan')}</div>
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
    }
  });

  visualResume.innerHTML = html;
}

// 0. Introduction / Summary Visual
function renderIntroductionVisual(intro) {
  if (!intro) return '';
  const isEnabled = typeof intro === 'object' ? intro.enabled !== false : Boolean(intro);
  const text = typeof intro === 'object' ? (intro.text || '') : String(intro);
  if (!isEnabled || !text.trim()) return '';

  return `
    <section class="res-section">
      <div class="res-section-title">Introduction</div>
      <div class="res-intro-text">${escapeHtml(text.trim())}</div>
    </section>
  `;
}

// 1. Education Visual
function renderEducationVisual(education) {
  if (!education || education.length === 0) return '';
  let html = `
    <section class="res-section">
      <div class="res-section-title">Education</div>
  `;
  education.forEach(edu => {
    const gpaText = edu.gpa ? ` | CGPA/Percentage: ${escapeHtml(edu.gpa)}` : '';
    const courseworkText = edu.coursework ? `<div class="res-subdetails"><strong>Relevant Coursework:</strong> ${escapeHtml(edu.coursework)}</div>` : '';
    html += `
      <div class="res-subheading">
        <div class="res-row-between">
          <span class="res-bold">${escapeHtml(edu.institution)}</span>
          <span class="res-location">${escapeHtml(edu.location)}</span>
        </div>
        <div class="res-row-between">
          <span class="res-italic">${escapeHtml(edu.degree)}${gpaText}</span>
          <span class="res-dates">${escapeHtml(edu.dates)}</span>
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
      <div class="res-section-title">Experience</div>
  `;
  experience.forEach(exp => {
    html += `
      <div class="res-subheading">
        <div class="res-row-between">
          <span class="res-bold">${escapeHtml(exp.role)}</span>
          <span class="res-dates">${escapeHtml(exp.dates)}</span>
        </div>
        <div class="res-row-between">
          <span class="res-italic">${escapeHtml(exp.company)}</span>
          <span class="res-location">${escapeHtml(exp.location)}</span>
        </div>
        <ul class="res-bullets">
          ${exp.bullets.filter(b => b.trim()).map(b => `<li>${formatBulletHtml(b)}</li>`).join('')}
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
      <div class="res-section-title">Projects</div>
  `;
  projects.forEach(proj => {
    let linkItems = [];
    if (proj.liveUrl) {
      linkItems.push(`<a href="${normalizeUrl(proj.liveUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(proj.liveLabel || 'Live Demo')}</a>`);
    }
    if (proj.githubUrl) {
      linkItems.push(`<a href="${normalizeUrl(proj.githubUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(proj.githubLabel || 'GitHub')}</a>`);
    }

    const techPart = proj.techStack ? ` | <em>${escapeHtml(proj.techStack)}</em>` : '';
    const linksPart = linkItems.length > 0 ? ` | ${linkItems.join(' | ')}` : '';

    html += `
      <div class="res-subheading">
        <div class="res-row-between">
          <span><strong class="res-bold">${escapeHtml(proj.title)}</strong>${techPart}${linksPart}</span>
          <span class="res-dates">${escapeHtml(proj.dates)}</span>
        </div>
        <ul class="res-bullets">
          ${proj.bullets.filter(b => b.trim()).map(b => `<li>${formatBulletHtml(b)}</li>`).join('')}
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
      <div class="res-section-title">Technical Skills</div>
      <ul class="res-skills-list">
  `;
  activeRows.forEach(item => {
    html += `<li><strong>${escapeHtml(item.category.trim())}:</strong> ${escapeHtml(item.items.trim())}</li>`;
  });
  html += `</ul></section>`;
  return html;
}

// 5. Certifications Visual (Single-line bullet list matching standard format & Image 3)
function renderCertificationsVisual(certifications, showCertifications = true) {
  if (!showCertifications || !certifications || certifications.length === 0) return '';
  let html = `
    <section class="res-section">
      <div class="res-section-title">Certifications</div>
      <ul class="res-bullets" style="padding-left: 1.15rem; margin-top: 3px; margin-bottom: 2px;">
  `;
  certifications.forEach(cert => {
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

    let titleHtml = `<strong>${escapeHtml(boldPrefix)}</strong>`;
    if (restText) {
      titleHtml += ` &ndash; ${escapeHtml(restText)}`;
    }

    let rightParts = [];
    if (cert.date) {
      rightParts.push(`<span style="font-style: italic; color: #4b5563;">${escapeHtml(cert.date)}</span>`);
    }
    if (cert.url) {
      rightParts.push(`<a href="${normalizeUrl(cert.url)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 500;">Certificate</a>`);
    }

    html += `
      <li style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
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
      <div class="res-section-title">Honors & Achievements</div>
      <ul class="res-bullets">
  `;
  achievements.forEach(ach => {
    let line = `<strong>${escapeHtml(ach.title)}</strong>`;
    if (ach.description) line += `: ${formatBulletHtml(ach.description)}`;
    if (ach.url) {
      line += ` [<a href="${normalizeUrl(ach.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ach.linkLabel || 'Link')}</a>]`;
    }
    html += `<li>${line}</li>`;
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

/**
 * Format bullet text for HTML preview:
 * Safely escapes HTML while converting markdown bold (**...**) to <strong>...</strong>
 */
function formatBulletHtml(text) {
  if (!text) return '';
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map(part => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2);
      return `<strong>${escapeHtml(inner)}</strong>`;
    }
    return escapeHtml(part);
  }).join('');
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
    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">School / College #${idx + 1}</span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('education', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('education', ${idx}, 1)" ${idx === resumeState.education.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeEducation(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>College / University Name</label>
          <input type="text" class="form-control" value="${escapeHtml(edu.institution)}" oninput="updateEduField(${idx}, 'institution', this.value)">
        </div>
        <div class="form-group">
          <label>Location (e.g. Georgetown, TX)</label>
          <input type="text" class="form-control" value="${escapeHtml(edu.location)}" oninput="updateEduField(${idx}, 'location', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Degree / Major</label>
          <input type="text" class="form-control" value="${escapeHtml(edu.degree)}" oninput="updateEduField(${idx}, 'degree', this.value)">
        </div>
        <div class="form-group">
          <label>Dates (e.g. Aug. 2018 -- May 2021)</label>
          <input type="text" class="form-control" value="${escapeHtml(edu.dates)}" oninput="updateEduField(${idx}, 'dates', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>CGPA / Percentage (Optional)</label>
          <input type="text" class="form-control" value="${escapeHtml(edu.gpa || '')}" placeholder="e.g. 9.2 / 10.0" oninput="updateEduField(${idx}, 'gpa', this.value)">
        </div>
        <div class="form-group">
          <label>Relevant Coursework (Optional)</label>
          <input type="text" class="form-control" value="${escapeHtml(edu.coursework || '')}" oninput="updateEduField(${idx}, 'coursework', this.value)">
        </div>
      </div>
    `;
    container.appendChild(item);
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
    
    let bulletsHtml = exp.bullets.map((bullet, bIdx) => `
      <div class="bullet-item">
        <span class="bullet-indicator">&bull;</span>
        <input type="text" class="form-control" value="${escapeHtml(bullet)}" placeholder="Action verb + task + quantifiable result" oninput="updateExpBullet(${idx}, ${bIdx}, this.value)">
        <button class="btn btn-sm btn-danger" onclick="removeExpBullet(${idx}, ${bIdx})">&times;</button>
      </div>
    `).join('');

    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">Experience #${idx + 1}</span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('experience', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('experience', ${idx}, 1)" ${idx === resumeState.experience.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeExperience(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Job Title / Role</label>
          <input type="text" class="form-control" value="${escapeHtml(exp.role)}" oninput="updateExpField(${idx}, 'role', this.value)">
        </div>
        <div class="form-group">
          <label>Dates (e.g. June 2020 -- Present)</label>
          <input type="text" class="form-control" value="${escapeHtml(exp.dates)}" oninput="updateExpField(${idx}, 'dates', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Company / Organization Name</label>
          <input type="text" class="form-control" value="${escapeHtml(exp.company)}" oninput="updateExpField(${idx}, 'company', this.value)">
        </div>
        <div class="form-group">
          <label>Location (e.g. College Station, TX)</label>
          <input type="text" class="form-control" value="${escapeHtml(exp.location)}" oninput="updateExpField(${idx}, 'location', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Bullet Points <button class="btn btn-sm btn-secondary" onclick="addExpBullet(${idx})">+ Add Bullet</button></label>
        <div class="bullet-list">${bulletsHtml}</div>
      </div>
    `;
    container.appendChild(item);
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

    let bulletsHtml = proj.bullets.map((bullet, bIdx) => `
      <div class="bullet-item">
        <span class="bullet-indicator">&bull;</span>
        <input type="text" class="form-control" value="${escapeHtml(bullet)}" placeholder="Developed X using Y for Z..." oninput="updateProjBullet(${idx}, ${bIdx}, this.value)">
        <button class="btn btn-sm btn-danger" onclick="removeProjBullet(${idx}, ${bIdx})">&times;</button>
      </div>
    `).join('');

    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">Project #${idx + 1}</span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('projects', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('projects', ${idx}, 1)" ${idx === resumeState.projects.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeProject(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Project Title</label>
          <input type="text" class="form-control" value="${escapeHtml(proj.title)}" oninput="updateProjField(${idx}, 'title', this.value)">
        </div>
        <div class="form-group">
          <label>Technologies Used</label>
          <input type="text" class="form-control" value="${escapeHtml(proj.techStack)}" placeholder="e.g. Python, Flask, React, PostgreSQL, Docker" oninput="updateProjField(${idx}, 'techStack', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Duration / Dates</label>
          <input type="text" class="form-control" value="${escapeHtml(proj.dates)}" placeholder="e.g. June 2020 -- Present" oninput="updateProjField(${idx}, 'dates', this.value)">
        </div>
        <div class="form-group">
          <label>GitHub Repository URL (Optional)</label>
          <div class="input-with-action">
            <input type="url" class="form-control" value="${escapeHtml(proj.githubUrl || '')}" placeholder="https://github.com/..." oninput="updateProjField(${idx}, 'githubUrl', this.value)">
            ${proj.githubUrl ? `<a href="${normalizeUrl(proj.githubUrl)}" target="_blank" class="test-link-btn">Test ↗</a>` : ''}
          </div>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Live Demo URL (Optional)</label>
          <div class="input-with-action">
            <input type="url" class="form-control" value="${escapeHtml(proj.liveUrl || '')}" placeholder="https://..." oninput="updateProjField(${idx}, 'liveUrl', this.value)">
            ${proj.liveUrl ? `<a href="${normalizeUrl(proj.liveUrl)}" target="_blank" class="test-link-btn">Test ↗</a>` : ''}
          </div>
        </div>
        <div class="form-group">
          <label>Live Demo Link Label</label>
          <input type="text" class="form-control" value="${escapeHtml(proj.liveLabel || 'Live Demo')}" oninput="updateProjField(${idx}, 'liveLabel', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Bullet Points <button class="btn btn-sm btn-secondary" onclick="addProjBullet(${idx})">+ Add Bullet</button></label>
        <div class="bullet-list">${bulletsHtml}</div>
      </div>
    `;
    container.appendChild(item);
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
    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">Certification #${idx + 1}</span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('certifications', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('certifications', ${idx}, 1)" ${idx === resumeState.certifications.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeCertification(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Certificate Name</label>
          <input type="text" class="form-control" value="${escapeHtml(cert.name)}" oninput="updateCertField(${idx}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label>Issuing Organization</label>
          <input type="text" class="form-control" value="${escapeHtml(cert.issuer)}" oninput="updateCertField(${idx}, 'issuer', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Issue Date</label>
          <input type="text" class="form-control" value="${escapeHtml(cert.date)}" oninput="updateCertField(${idx}, 'date', this.value)">
        </div>
        <div class="form-group">
          <label>Credential ID (Optional)</label>
          <input type="text" class="form-control" value="${escapeHtml(cert.credentialId || '')}" oninput="updateCertField(${idx}, 'credentialId', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Verification URL (Clickable)</label>
        <div class="input-with-action">
          <input type="url" class="form-control" value="${escapeHtml(cert.url || '')}" placeholder="https://..." oninput="updateCertField(${idx}, 'url', this.value)">
          ${cert.url ? `<a href="${normalizeUrl(cert.url)}" target="_blank" class="test-link-btn">Verify ↗</a>` : ''}
        </div>
      </div>
    `;
    container.appendChild(item);
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
    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">Achievement #${idx + 1}</span>
        <div class="reorder-group">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('achievements', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="moveItem('achievements', ${idx}, 1)" ${idx === resumeState.achievements.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
          <button class="btn btn-sm btn-danger" onclick="removeAchievement(${idx})">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Title</label>
          <input type="text" class="form-control" value="${escapeHtml(ach.title)}" oninput="updateAchField(${idx}, 'title', this.value)">
        </div>
        <div class="form-group">
          <label>Proof URL (Optional)</label>
          <div class="input-with-action">
            <input type="url" class="form-control" value="${escapeHtml(ach.url || '')}" oninput="updateAchField(${idx}, 'url', this.value)">
            ${ach.url ? `<a href="${normalizeUrl(ach.url)}" target="_blank" class="test-link-btn">Open ↗</a>` : ''}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" class="form-control" value="${escapeHtml(ach.description || '')}" oninput="updateAchField(${idx}, 'description', this.value)">
      </div>
    `;
    container.appendChild(item);
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
    item.innerHTML = `
      <div class="repeatable-item-header">
        <span class="repeatable-item-title">
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
          <input type="text" class="form-control" value="${escapeHtml(skill.category || '')}" placeholder="e.g. Languages, Cloud & DevOps" oninput="updateSkillField(${idx}, 'category', this.value)">
        </div>
        <div class="form-group">
          <label>Skills &amp; Technologies (Sub-section)</label>
          <input type="text" class="form-control" value="${escapeHtml(skill.items || '')}" placeholder="e.g. Python, Java, C++, Docker, AWS" oninput="updateSkillField(${idx}, 'items', this.value)">
        </div>
      </div>
    `;
    container.appendChild(item);
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

  const secTitle = SECTION_METADATA[sectionKey]?.title || sectionKey;
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
    resumeState.sectionOrder = [...presets[presetKey]];

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
    const meta = SECTION_METADATA[secKey];
    if (!meta) return;
    const card = document.getElementById(meta.id);
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
    version: '2.5',
    format: 'jake-resume-backup',
    exportedAt: new Date().toISOString(),
    state: resumeState,
    options: currentOptions
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
window.loadDraftFromStorage = loadDraftFromStorage;
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



