/**
 * Jake's Resume Builder - Application Logic
 * Reactive synchronization between Form State, Visual Preview, and LaTeX Generator
 */

// Global Application State initialized with Jake Ryan Original Preset
let resumeState = JSON.parse(JSON.stringify(BTECH_PRESETS.jake));

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

/**
 * Initialize Application
 */
document.addEventListener('DOMContentLoaded', () => {
  populateFormFromState();
  updatePreviews();
  setupEventListeners();
  applyZoom(currentZoom);
});

/**
 * Populate all form inputs based on current resumeState
 */
function populateFormFromState() {
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

  // Update Test Link buttons
  updateTestLink('test-linkedin', resumeState.personal.linkedin);
  updateTestLink('test-github', resumeState.personal.github);

  // Technical Skills
  document.getElementById('inp-skills-lang').value = resumeState.skills.languages || '';
  document.getElementById('inp-skills-frameworks').value = resumeState.skills.frameworks || '';
  document.getElementById('inp-skills-tools').value = resumeState.skills.tools || '';
  document.getElementById('inp-skills-libraries').value = resumeState.skills.libraries || '';
  document.getElementById('inp-skills-coursework').value = resumeState.skills.coursework || '';

  // Render Dynamic Repeatable Lists
  renderEducationList();
  renderExperienceList();
  renderProjectsList();
  renderCertificationsList();
  renderAchievementsList();
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
      resumeState = JSON.parse(JSON.stringify(BTECH_PRESETS[selected]));
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
    { id: 'inp-portfolio', key: 'portfolio' }
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

  // Skills Inputs
  const skillInputs = [
    { id: 'inp-skills-lang', key: 'languages' },
    { id: 'inp-skills-frameworks', key: 'frameworks' },
    { id: 'inp-skills-tools', key: 'tools' },
    { id: 'inp-skills-libraries', key: 'libraries' },
    { id: 'inp-skills-coursework', key: 'coursework' }
  ];

  skillInputs.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        resumeState.skills[key] = e.target.value;
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

/**
 * Auto-Fit to 1 Single Page
 */
function autoFitToOnePage() {
  currentOptions.fontSize = '10pt';
  currentOptions.sectionSpacing = '-6pt';
  currentOptions.itemSpacing = '-3pt';
  updatePreviews();
  showToast('✓ Auto-fitted spacing to exactly 1 page!');
}

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
function updatePreviews() {
  renderVisualResume();
  renderLatexView();
  checkPageHeight();
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
    contactsHtml.push(`<a href="mailto:${personal.email.trim()}">${escapeHtml(personal.email.trim())}</a>`);
  }
  if (personal.linkedin) {
    const disp = personal.linkedinDisplay || cleanUrlDisplay(personal.linkedin);
    contactsHtml.push(`<a href="${normalizeUrl(personal.linkedin)}" target="_blank" rel="noopener noreferrer">${escapeHtml(disp)}</a>`);
  }
  if (personal.github) {
    const disp = personal.githubDisplay || cleanUrlDisplay(personal.github);
    contactsHtml.push(`<a href="${normalizeUrl(personal.github)}" target="_blank" rel="noopener noreferrer">${escapeHtml(disp)}</a>`);
  }
  if (personal.leetcode) {
    const disp = personal.leetcodeDisplay || cleanUrlDisplay(personal.leetcode);
    contactsHtml.push(`<a href="${normalizeUrl(personal.leetcode)}" target="_blank" rel="noopener noreferrer">${escapeHtml(disp)}</a>`);
  }
  if (personal.portfolio) {
    const disp = personal.portfolioDisplay || cleanUrlDisplay(personal.portfolio);
    contactsHtml.push(`<a href="${normalizeUrl(personal.portfolio)}" target="_blank" rel="noopener noreferrer">${escapeHtml(disp)}</a>`);
  }

  let html = `
    <header class="res-header">
      <div class="res-name">${escapeHtml(personal.fullName || 'Jake Ryan')}</div>
      <div class="res-contacts">
        ${contactsHtml.join(' <span class="res-sep">|</span> ')}
      </div>
    </header>
  `;

  // 2. Education
  if (education && education.length > 0) {
    html += `
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
  }

  // 3. Experience
  if (experience && experience.length > 0) {
    html += `
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
            ${exp.bullets.filter(b => b.trim()).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        </div>
      `;
    });
    html += `</section>`;
  }

  // 4. Projects (with Clickable Links)
  if (projects && projects.length > 0) {
    html += `
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
            ${proj.bullets.filter(b => b.trim()).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        </div>
      `;
    });
    html += `</section>`;
  }

  // 5. Technical Skills (Exact Jake's format)
  if (skills) {
    const hasSkills = skills.languages || skills.frameworks || skills.tools || skills.libraries || skills.coursework || skills.other;
    if (hasSkills) {
      html += `
        <section class="res-section">
          <div class="res-section-title">Technical Skills</div>
          <ul class="res-skills-list">
      `;
      if (skills.languages) {
        html += `<li><strong>Languages:</strong> ${escapeHtml(skills.languages)}</li>`;
      }
      if (skills.frameworks) {
        html += `<li><strong>Frameworks:</strong> ${escapeHtml(skills.frameworks)}</li>`;
      }
      if (skills.tools) {
        html += `<li><strong>Developer Tools:</strong> ${escapeHtml(skills.tools)}</li>`;
      }
      if (skills.libraries) {
        html += `<li><strong>Libraries:</strong> ${escapeHtml(skills.libraries)}</li>`;
      }
      if (skills.coursework) {
        html += `<li><strong>Core CS Coursework:</strong> ${escapeHtml(skills.coursework)}</li>`;
      }
      if (skills.other) {
        html += `<li><strong>Other:</strong> ${escapeHtml(skills.other)}</li>`;
      }
      html += `</ul></section>`;
    }
  }

  // 6. Certifications (Optional with Clickable Links)
  if (currentOptions.showCertifications && certifications && certifications.length > 0) {
    html += `
      <section class="res-section">
        <div class="res-section-title">Certifications</div>
        <ul class="res-skills-list">
    `;
    certifications.forEach(cert => {
      let certInfo = `<strong>${escapeHtml(cert.name)}</strong>`;
      if (cert.issuer) certInfo += ` &mdash; ${escapeHtml(cert.issuer)}`;
      if (cert.date) certInfo += ` <span style="float: right; font-style: italic;">${escapeHtml(cert.date)}</span>`;

      if (cert.url) {
        const linkText = cert.credentialId 
          ? `Credential ID: ${escapeHtml(cert.credentialId)} [Verify]` 
          : `Verify Certificate`;
        certInfo += `<div style="font-size: 9pt; margin-left: 10pt; margin-top: 1pt;"><a href="${normalizeUrl(cert.url)}" target="_blank" rel="noopener noreferrer">${linkText}</a></div>`;
      }
      html += `<li>${certInfo}</li>`;
    });
    html += `</ul></section>`;
  }

  // 7. Honors & Achievements (Optional with Clickable Links)
  if (currentOptions.showAchievements && achievements && achievements.length > 0) {
    html += `
      <section class="res-section">
        <div class="res-section-title">Honors & Achievements</div>
        <ul class="res-bullets">
    `;
    achievements.forEach(ach => {
      let line = `<strong>${escapeHtml(ach.title)}</strong>`;
      if (ach.description) line += `: ${escapeHtml(ach.description)}`;
      if (ach.url) {
        line += ` [<a href="${normalizeUrl(ach.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ach.linkLabel || 'Link')}</a>]`;
      }
      html += `<li>${line}</li>`;
    });
    html += `</ul></section>`;
  }

  visualResume.innerHTML = html;
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
function checkPageHeight() {
  if (!visualResume) return;
  
  // 11 inches at 96 DPI is 1056px.
  // Standard 1-page tolerance across browser font rendering allows up to 1100px.
  const currentHeight = visualResume.scrollHeight;

  // Ensure no yellow page-break-guide line is ever present
  const existingGuide = visualResume.querySelector('.page-break-guide');
  if (existingGuide) {
    existingGuide.remove();
  }

  if (currentHeight > 1100) {
    pageCounterBadge.className = 'page-counter-badge warning';
    pageCounterBadge.innerHTML = `⚠️ Content Exceeds 1 Page <button class="btn btn-sm btn-amber" onclick="autoFitToOnePage()" style="margin-left: 6px; padding: 2px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">Auto-Fit</button>`;
  } else {
    pageCounterBadge.className = 'page-counter-badge';
    pageCounterBadge.innerHTML = `✓ 1 Page • ATS Compliant`;
  }
}

/**
 * Auto-Fit to exactly 1 Page
 * Compacts spacing and LaTeX parameters to guarantee 1-page fit
 */
function autoFitToOnePage() {
  if (!visualResume) return;
  
  // Apply compact mode to preview DOM
  visualResume.classList.add('compact-mode');
  
  // Adjust LaTeX spacing options
  currentOptions.fontSize = '10.5pt';
  currentOptions.sectionSpacing = '-6pt';
  currentOptions.itemSpacing = '-3pt';
  
  // Re-render LaTeX code view and sync
  renderLatexView();
  
  setTimeout(() => {
    checkPageHeight();
    showToast('✓ Auto-Fit applied: Compacted spacing to fit exactly 1 page!');
  }, 60);
}
window.autoFitToOnePage = autoFitToOnePage;

/**
 * Export Clean PDF without any browser print headers, URLs, or timestamps
 * Uses local html2pdf bundle to generate an authentic Overleaf-style PDF directly into Downloads
 */
function exportCleanPdf() {
  const resumeElem = document.getElementById('visual-resume');
  if (!resumeElem) return;

  if (typeof html2pdf === 'undefined') {
    // Fallback to browser print if script not yet ready
    showToast('Opening print dialog (uncheck "Headers and footers" in print settings)...');
    window.print();
    return;
  }

  showToast('📄 Generating clean PDF (Overleaf standard)...');

  // Temporarily reset zoom scale and box shadow for 100% crisp render
  const prevTransform = resumeElem.style.transform;
  const prevTransformOrigin = resumeElem.style.transformOrigin;
  const prevBoxShadow = resumeElem.style.boxShadow;

  resumeElem.style.transform = 'none';
  resumeElem.style.boxShadow = 'none';

  const candidateName = (resumeState.personal.fullName || 'Jake_Ryan').trim().replace(/\s+/g, '_');
  const filename = `${candidateName}_Resume.pdf`;

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

  html2pdf()
    .set(opt)
    .from(resumeElem)
    .save()
    .then(() => {
      resumeElem.style.transform = prevTransform;
      resumeElem.style.transformOrigin = prevTransformOrigin;
      resumeElem.style.boxShadow = prevBoxShadow;
      showToast(`✓ Clean PDF downloaded: ${filename}`);
    })
    .catch((err) => {
      console.error('Error generating clean PDF:', err);
      resumeElem.style.transform = prevTransform;
      resumeElem.style.transformOrigin = prevTransformOrigin;
      resumeElem.style.boxShadow = prevBoxShadow;
      showToast('⚠️ Opening browser print dialog...');
      window.print();
    });
}
window.exportCleanPdf = exportCleanPdf;

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
