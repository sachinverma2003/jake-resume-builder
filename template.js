/**
 * Jake's Resume LaTeX Generator & Escaping Engine
 * Based exactly on Jake Gutierrez's standard template:
 * https://github.com/sb2nov/resume
 */

// Escape characters that break LaTeX compilation
function escapeLatex(text) {
  if (!text) return '';
  let str = String(text);
  
  // Use function replacers to prevent JS String.prototype.replace '$' evaluation bugs
  str = str.replace(/\\/g, () => '\\textbackslash{}');
  str = str.replace(/&/g, () => '\\&')
           .replace(/%/g, () => '\\%')
           .replace(/\$/g, () => '\\$')
           .replace(/#/g, () => '\\#')
           .replace(/_/g, () => '\\_')
           .replace(/\{/g, () => '\\{')
           .replace(/\}/g, () => '\\}')
           .replace(/~/g, () => '\\textasciitilde{}')
           .replace(/\^/g, () => '\\textasciicircum{}');
           
  return str;
}

/**
 * Format bullet text for LaTeX:
 * Escapes special characters while converting markdown bold (**...**) to \textbf{...}
 */
function formatBulletLatex(text) {
  if (!text) return '';
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map(part => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2);
      return `\\textbf{${escapeLatex(inner)}}`;
    }
    return escapeLatex(part);
  }).join('');
}

// Clean and normalize URLs for safe href and display
function normalizeUrl(url) {
  if (!url) return '';
  let clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) {
    clean = 'https://' + clean;
  }
  return clean;
}

// Clean display string from full URL (e.g. https://linkedin.com/in/jake -> linkedin.com/in/jake)
function cleanUrlDisplay(url) {
  if (!url) return '';
  return url.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

// Clean site name for link display (e.g. LinkedIn, GitHub, LeetCode, Portfolio)
function getSiteDisplayName(url, customDisplay, defaultSiteName = '') {
  if (customDisplay && typeof customDisplay === 'string') {
    const trimmed = customDisplay.trim();
    if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.includes('/') && !trimmed.includes('.com') && !trimmed.includes('.org') && !trimmed.includes('.io') && !trimmed.includes('.dev') && !trimmed.includes('.net')) {
      return trimmed;
    }
  }
  if (!url) return defaultSiteName || 'Link';
  const lower = url.toLowerCase();
  if (lower.includes('linkedin.com')) return 'LinkedIn';
  if (lower.includes('github.com')) return 'GitHub';
  if (lower.includes('leetcode.com')) return 'LeetCode';
  if (lower.includes('codeforces.com')) return 'Codeforces';
  if (lower.includes('kaggle.com')) return 'Kaggle';
  if (lower.includes('codechef.com')) return 'CodeChef';
  if (lower.includes('hackerrank.com')) return 'HackerRank';
  if (lower.includes('geeksforgeeks.org')) return 'GeeksforGeeks';
  if (lower.includes('gitlab.com')) return 'GitLab';
  if (lower.includes('bitbucket.org')) return 'Bitbucket';
  if (defaultSiteName) return defaultSiteName;
  return 'Portfolio';
}

// Helper to clean trailing certification annotations
function cleanCertTitle(text) {
  if (!text) return '';
  return text.trim()
    .replace(/\s*(?:\[|\()?cert(?:ificate)?s?(?:\]|\))?$/i, '')
    .replace(/\s*(?:\[|\()?verify(?: certificate)?(?:\]|\))?$/i, '')
    .replace(/\s*(?:\[|\()?(?:view|link|credential)(?:\]|\))?$/i, '')
    .replace(/[|,\-–—\s]+$/, '')
    .trim();
}

/**
 * Creates safe LaTeX \href link
 * - Ensures url has protocol
 * - Escapes '#' or '%' in URLs for LaTeX hyperref compatibility
 * - Escapes display text safely
 */
function createLatexHref(url, displayText = null) {
  if (!url || !url.trim()) return '';
  const fullUrl = normalizeUrl(url);
  const display = displayText ? displayText.trim() : cleanUrlDisplay(url);
  
  // In LaTeX hyperref, URLs with # or % should have \# / \% so they do not cause runaway arguments
  const safeUrl = fullUrl.replace(/#/g, () => '\\#').replace(/%/g, () => '\\%');
  const safeDisplay = escapeLatex(display);
  
  return `\\href{${safeUrl}}{\\underline{${safeDisplay}}}`;
}

/**
 * Normalizes skills structure into an array of { category, items }
 */
function normalizeSkills(skills) {
  if (Array.isArray(skills)) {
    return skills.map(s => ({
      category: s.category || '',
      items: s.items || ''
    }));
  }
  if (!skills || typeof skills !== 'object') {
    return [];
  }
  const list = [];
  if (skills.languages) list.push({ category: 'Languages', items: skills.languages });
  if (skills.frameworks) list.push({ category: 'Frameworks', items: skills.frameworks });
  if (skills.tools) list.push({ category: 'Developer Tools', items: skills.tools });
  if (skills.libraries) list.push({ category: 'Libraries', items: skills.libraries });
  if (skills.coursework) list.push({ category: 'Core CS Coursework', items: skills.coursework });
  if (skills.other) list.push({ category: 'Other', items: skills.other });
  return list;
}

// 0. Introduction / Professional Summary Section LaTeX
function generateIntroductionLatex(intro) {
  if (!intro) return '';
  const isEnabled = typeof intro === 'object' ? intro.enabled !== false : Boolean(intro);
  const text = typeof intro === 'object' ? (intro.text || '') : String(intro);
  if (!isEnabled || !text.trim()) return '';

  let latex = `\n%-----------INTRODUCTION / PROFESSIONAL SUMMARY-----------\n\\section{Introduction}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n     ${escapeLatex(text.trim())}\n    }}\n \\end{itemize}\n`;
  return latex;
}

// 1. Education Section LaTeX
function generateEducationLatex(education) {
  if (!education || education.length === 0) return '';
  let latex = `\n%-----------EDUCATION-----------\n\\section{Education}\n  \\resumeSubHeadingListStart\n`;
  education.forEach(edu => {
    let degreeLine = escapeLatex(edu.degree);
    if (edu.gpa) {
      degreeLine += ` \\hspace{1pt}$|$\\hspace{1pt} CGPA/Percentage: ${escapeLatex(edu.gpa)}`;
    }
    if (edu.coursework) {
      degreeLine += ` \\\\ \\small{\\textbf{Relevant Coursework:} ${escapeLatex(edu.coursework)}}`;
    }
    latex += `    \\resumeSubheading\n      {${escapeLatex(edu.institution)}}{${escapeLatex(edu.location)}}\n      {${degreeLine}}{${escapeLatex(edu.dates)}}\n`;
  });
  latex += `  \\resumeSubHeadingListEnd\n`;
  return latex;
}

// 2. Experience Section LaTeX
function generateExperienceLatex(experience) {
  if (!experience || experience.length === 0) return '';
  let latex = `\n%-----------EXPERIENCE-----------\n\\section{Experience}\n  \\resumeSubHeadingListStart\n`;
  experience.forEach(exp => {
    latex += `    \\resumeSubheading\n      {${escapeLatex(exp.role)}}{${escapeLatex(exp.dates)}}\n      {${escapeLatex(exp.company)}}{${escapeLatex(exp.location)}}\n      \\resumeItemListStart\n`;
    if (exp.bullets && exp.bullets.length > 0) {
      exp.bullets.forEach(bullet => {
        if (bullet.trim()) {
          latex += `        \\resumeItem{${formatBulletLatex(bullet)}}\n`;
        }
      });
    }
    latex += `      \\resumeItemListEnd\n`;
  });
  latex += `  \\resumeSubHeadingListEnd\n`;
  return latex;
}

// 3. Projects Section LaTeX
function generateProjectsLatex(projects) {
  if (!projects || projects.length === 0) return '';
  let latex = `\n%-----------PROJECTS-----------\n\\section{Projects}\n    \\resumeSubHeadingListStart\n`;
  projects.forEach(proj => {
    let titlePart = `\\textbf{${escapeLatex(proj.title)}}`;
    if (proj.techStack) {
      titlePart += ` $|$ \\emph{${escapeLatex(proj.techStack)}}`;
    }
    if (proj.liveUrl) {
      titlePart += ` $|$ ${createLatexHref(proj.liveUrl, proj.liveLabel || 'Live Demo')}`;
    }
    if (proj.githubUrl) {
      titlePart += ` $|$ ${createLatexHref(proj.githubUrl, proj.githubLabel || 'GitHub')}`;
    }

    latex += `      \\resumeProjectHeading\n          {${titlePart}}{${escapeLatex(proj.dates)}}\n          \\resumeItemListStart\n`;
    if (proj.bullets && proj.bullets.length > 0) {
      proj.bullets.forEach(bullet => {
        if (bullet.trim()) {
          latex += `            \\resumeItem{${formatBulletLatex(bullet)}}\n`;
        }
      });
    }
    latex += `          \\resumeItemListEnd\n`;
  });
  latex += `    \\resumeSubHeadingListEnd\n`;
  return latex;
}

// 4. Technical Skills Section LaTeX (Supports dynamic categories & sub-sections)
function generateSkillsLatex(skills) {
  const normSkills = normalizeSkills(skills);
  if (!normSkills || normSkills.length === 0) return '';
  const activeRows = normSkills.filter(s => s.category && s.category.trim() && s.items && s.items.trim());
  if (activeRows.length === 0) return '';

  let latex = `\n%-----------TECHNICAL SKILLS-----------\n\\section{Technical Skills}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n`;
  const skillRows = activeRows.map(s => `     \\textbf{${escapeLatex(s.category.trim())}}{: ${escapeLatex(s.items.trim())}}`);
  latex += skillRows.join(' \\\\\n') + `\n    }}\n \\end{itemize}\n`;
  return latex;
}

// 5. Certifications Section LaTeX (Single-line bullet list matching standard format)
function generateCertificationsLatex(certifications, showCertifications = true) {
  if (!showCertifications || !certifications || certifications.length === 0) return '';
  let latex = `\n%-----------CERTIFICATIONS-----------\n\\section{Certifications}\n \\resumeItemListStart\n`;
  
  certifications.forEach(cert => {
    let name = cleanCertTitle(cert.name || '');
    let issuer = cleanCertTitle(cert.issuer || '');

    let boldPrefix = '';
    let restText = '';

    if (name && issuer) {
      boldPrefix = name;
      restText = issuer;
    } else if (name) {
      if (name.includes(' – ') || name.includes(' — ') || name.includes(' - ') || name.includes(' -- ')) {
        const parts = name.split(/\s+[—–\-]+\s+/);
        boldPrefix = parts[0];
        restText = parts.slice(1).join(' -- ');
      } else {
        boldPrefix = name;
        restText = '';
      }
    } else if (issuer) {
      boldPrefix = issuer;
      restText = '';
    }

    let line = `\\textbf{${escapeLatex(boldPrefix)}}`;
    if (restText) {
      line += ` -- ${escapeLatex(restText)}`;
    }

    let rightParts = [];
    if (cert.date) {
      rightParts.push(`\\textit{${escapeLatex(cert.date)}}`);
    }
    if (cert.url) {
      const fullUrl = normalizeUrl(cert.url);
      const safeUrl = fullUrl.replace(/#/g, () => '\\#').replace(/%/g, () => '\\%');
      rightParts.push(`\\href{${safeUrl}}{\\color{blue}Certificate}`);
    }

    if (rightParts.length > 0) {
      line += ` \\hfill ${rightParts.join(' \\quad ')}`;
    }

    latex += `    \\resumeItem{${line}}\n`;
  });

  latex += ` \\resumeItemListEnd\n`;
  return latex;
}

// 6. Honors & Achievements Section LaTeX
function generateAchievementsLatex(achievements, showAchievements = true) {
  if (!showAchievements || !achievements || achievements.length === 0) return '';
  let latex = `\n%-----------HONORS & ACHIEVEMENTS-----------\n\\section{Honors \\& Achievements}\n \\resumeItemListStart\n`;
  achievements.forEach(ach => {
    let line = escapeLatex(ach.title);
    if (ach.description) {
      line += `: ${formatBulletLatex(ach.description)}`;
    }
    if (ach.url) {
      line += ` [${createLatexHref(ach.url, ach.linkLabel || 'Proof/Link')}]`;
    }
    latex += `    \\resumeItem{${line}}\n`;
  });
  latex += ` \\resumeItemListEnd\n`;
  return latex;
}

/**
 * Generate Complete Jake's Resume LaTeX Code
 * Matches Jake Gutierrez resume structure 100%
 */
function generateLatexCode(resumeData, options = {}) {
  const {
    fontSize = '11pt',
    paperSize = 'letterpaper',
    showCertifications = true,
    showAchievements = true
  } = options;

  const { personal, education, experience, projects, skills, certifications, achievements } = resumeData;

  // Format Header Links
  const headerLinks = [];
  if (personal.phone) {
    headerLinks.push(escapeLatex(personal.phone));
  }
  if (personal.email) {
    headerLinks.push(`\\href{mailto:${personal.email.trim()}}{\\underline{${escapeLatex(personal.email.trim())}}}`);
  }
  if (personal.linkedin) {
    const disp = getSiteDisplayName(personal.linkedin, personal.linkedinDisplay, 'LinkedIn');
    headerLinks.push(createLatexHref(personal.linkedin, disp));
  }
  if (personal.github) {
    const disp = getSiteDisplayName(personal.github, personal.githubDisplay, 'GitHub');
    headerLinks.push(createLatexHref(personal.github, disp));
  }
  if (personal.leetcode) {
    const disp = getSiteDisplayName(personal.leetcode, personal.leetcodeDisplay, 'LeetCode');
    headerLinks.push(createLatexHref(personal.leetcode, disp));
  }
  if (personal.portfolio) {
    const disp = getSiteDisplayName(personal.portfolio, personal.portfolioDisplay, 'Portfolio');
    headerLinks.push(createLatexHref(personal.portfolio, disp));
  }

  const headerLine = headerLinks.join(' $|$ \n    ');

  let latex = `%-------------------------
% Resume in Latex
% Author : Jake Gutierrez
% Based off of: https://github.com/sb2nov/resume
% License : MIT
%------------------------

\\documentclass[${paperSize},${fontSize}]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}


%----------FONT OPTIONS----------
% sans-serif
% \\usepackage[sfdefault]{FiraSans}
% \\usepackage[sfdefault]{roboto}
% \\usepackage[sfdefault]{noto-sans}
% \\usepackage[default]{sourcesanspro}

% serif
% \\usepackage{CormorantGaramond}
% \\usepackage{charter}


\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%


\\begin{document}

%----------HEADING----------
\\begin{center}
    \\textbf{\\Huge \\scshape ${escapeLatex(personal.fullName || 'Jake Ryan')}} \\\\ \\vspace{1pt}
    \\small ${headerLine}
\\end{center}
`;

  // Dynamic Reorderable Sections Rendering
  const sectionGenerators = {
    introduction: () => generateIntroductionLatex(resumeData.introduction),
    education: () => generateEducationLatex(education),
    experience: () => generateExperienceLatex(experience),
    projects: () => generateProjectsLatex(projects),
    skills: () => generateSkillsLatex(skills),
    certifications: () => generateCertificationsLatex(certifications, showCertifications),
    achievements: () => generateAchievementsLatex(achievements, showAchievements)
  };

  const defaultOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];
  const order = (resumeData.sectionOrder && resumeData.sectionOrder.length > 0)
    ? resumeData.sectionOrder
    : defaultOrder;

  order.forEach(secKey => {
    if (sectionGenerators[secKey]) {
      latex += sectionGenerators[secKey]();
    }
  });

  latex += `\n%-------------------------------------------
\\end{document}
`;

  return latex;
}

/**
 * Standard Presets:
 * 1. Jake Ryan (Official Standard Template)
 * 2. B.Tech SDE / Full Stack Profile (NIT Trichy)
 * 3. B.Tech AI / ML & Data Science (IIT Kharagpur)
 * 4. B.Tech Fresher / Campus Placements (VIT)
 */
const BTECH_PRESETS = {
  jake: {
    personal: {
      fullName: 'Jake Ryan',
      phone: '123-456-7890',
      email: 'jake@su.edu',
      linkedin: 'https://linkedin.com/in/jake',
      linkedinDisplay: 'LinkedIn',
      github: 'https://github.com/jake',
      githubDisplay: 'GitHub',
      leetcode: '',
      leetcodeDisplay: '',
      portfolio: '',
      portfolioDisplay: ''
    },
    education: [
      {
        institution: 'Southwestern University',
        location: 'Georgetown, TX',
        degree: 'Bachelor of Arts in Computer Science, Minor in Business',
        dates: 'Aug. 2018 -- May 2021',
        gpa: '',
        coursework: ''
      },
      {
        institution: 'Blinn College',
        location: 'Bryan, TX',
        degree: "Associate's in Liberal Arts",
        dates: 'Aug. 2014 -- May 2018',
        gpa: '',
        coursework: ''
      }
    ],
    experience: [
      {
        role: 'Undergraduate Research Assistant',
        company: 'Texas A&M University',
        location: 'College Station, TX',
        dates: 'June 2020 -- Present',
        bullets: [
          'Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems',
          'Developed a full-stack web application using Flask, React, PostgreSQL and Docker to analyze GitHub data',
          'Explored ways to visualize GitHub collaboration in a classroom setting'
        ]
      },
      {
        role: 'Information Technology Support Specialist',
        company: 'Southwestern University',
        location: 'Georgetown, TX',
        dates: 'Sep. 2018 -- Present',
        bullets: [
          'Communicate with managers to set up campus computers used on campus',
          'Assess and troubleshoot computer problems brought by students, faculty and staff',
          'Maintain upkeep of computers, classroom equipment, and 200 printers across campus'
        ]
      },
      {
        role: 'Artificial Intelligence Research Assistant',
        company: 'Southwestern University',
        location: 'Georgetown, TX',
        dates: 'May 2019 -- July 2019',
        bullets: [
          'Explored methods to generate video game dungeons based off of The Legend of Zelda',
          'Developed a game in Java to test the generated dungeons',
          'Contributed 50K+ lines of code to an established codebase via Git',
          'Conducted a human subject study to determine which video game dungeon generation technique is enjoyable',
          'Wrote an 8-page paper and gave multiple presentations on-campus',
          'Presented virtually to the World Conference on Computational Intelligence'
        ]
      }
    ],
    projects: [
      {
        title: 'Gitlytics',
        techStack: 'Python, Flask, React, PostgreSQL, Docker',
        dates: 'June 2020 -- Present',
        liveUrl: '',
        liveLabel: '',
        githubUrl: '',
        githubLabel: '',
        bullets: [
          'Developed a full-stack web application using with Flask serving a REST API with React as the frontend',
          'Implemented GitHub OAuth to get data from user’s repositories',
          'Visualized GitHub data to show collaboration',
          'Used Celery and Redis for asynchronous tasks'
        ]
      },
      {
        title: 'Simple Paintball',
        techStack: 'Spigot API, Java, Maven, TravisCI, Git',
        dates: 'May 2018 -- May 2020',
        liveUrl: '',
        liveLabel: '',
        githubUrl: '',
        githubLabel: '',
        bullets: [
          'Developed a Minecraft server plugin to entertain kids during free time for a previous job',
          'Published plugin to websites gaining 2K+ downloads and an average 4.5/5-star review',
          'Implemented continuous delivery using TravisCI to build the plugin upon new a release',
          'Collaborated with Minecraft server administrators to suggest features and get feedback about the plugin'
        ]
      }
    ],
    introduction: {
      enabled: false,
      text: 'Dedicated Computer Science student with practical experience in full stack software development, system design, and algorithms. Proven track record in developing high-throughput web applications and open-source software.'
    },
    sectionOrder: ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'],
    skills: [
      { category: 'Languages', items: 'Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS, R' },
      { category: 'Frameworks', items: 'React, Node.js, Flask, JUnit, WordPress, Material-UI, FastAPI' },
      { category: 'Developer Tools', items: 'Git, Docker, TravisCI, Google Cloud Platform, VS Code, Visual Studio, PyCharm, IntelliJ, Eclipse' },
      { category: 'Libraries', items: 'pandas, NumPy, Matplotlib' }
    ],
    certifications: [],
    achievements: []
  },

  sde: {
    personal: {
      fullName: 'Aarav Sharma',
      phone: '+91 98765 43210',
      email: 'aarav.sharma@gmail.com',
      linkedin: 'https://linkedin.com/in/aarav-sharma-dev',
      linkedinDisplay: 'LinkedIn',
      github: 'https://github.com/aaravsharma',
      githubDisplay: 'GitHub',
      leetcode: 'https://leetcode.com/u/aarav_codes',
      leetcodeDisplay: 'LeetCode',
      portfolio: 'https://aaravsharma.dev',
      portfolioDisplay: 'Portfolio'
    },
    education: [
      {
        institution: 'National Institute of Technology (NIT), Trichy',
        location: 'Tamil Nadu, India',
        degree: 'B.Tech in Computer Science and Engineering',
        dates: 'Dec 2022 -- May 2026',
        gpa: '9.24 / 10.0',
        coursework: 'Data Structures, Operating Systems, DBMS, Computer Networks, System Design'
      },
      {
        institution: 'Delhi Public School, R.K. Puram',
        location: 'New Delhi, India',
        degree: 'CBSE Class XII (Senior Secondary)',
        dates: 'Apr 2020 -- May 2022',
        gpa: '96.4%',
        coursework: ''
      }
    ],
    experience: [
      {
        role: 'Software Development Engineer Intern',
        company: 'Zomato',
        location: 'Gurugram, India',
        dates: 'May 2025 -- July 2025',
        bullets: [
          'Architected an asynchronous notification pipeline using Go and Kafka, processing 1.2M+ daily notifications with 99.98% delivery rate.',
          'Reduced Redis memory usage by 32% by redesigning cache eviction strategies and serializing payloads with Protobuf.'
        ]
      }
    ],
    projects: [
      {
        title: 'DevCollab: Real-Time Collaborative IDE',
        techStack: 'React, Node.js, WebSockets, Redis, Docker',
        dates: 'Jan 2025 -- Mar 2025',
        liveUrl: 'https://devcollab-ide.live',
        liveLabel: 'Live Demo',
        githubUrl: 'https://github.com/aaravsharma/devcollab-realtime',
        githubLabel: 'GitHub',
        bullets: [
          'Built collaborative code editor with real-time cursor sync using Operational Transformation (OT) supporting 50+ concurrent users.',
          'Isolated code execution environments within sandboxed Docker containers, completing compiles in <650ms.'
        ]
      },
      {
        title: 'Distributed Key-Value Store',
        techStack: 'C++, Raft Consensus Algorithm, gRPC, LevelDB',
        dates: 'Aug 2024 -- Nov 2024',
        liveUrl: '',
        liveLabel: '',
        githubUrl: 'https://github.com/aaravsharma/raft-distributed-kv',
        githubLabel: 'GitHub',
        bullets: [
          'Built fault-tolerant distributed key-value store using Raft Consensus Protocol handling leader election and log replication.',
          'Benchmarked performance using multi-threaded client, achieving 18,000 read QPS and 6,500 write QPS.'
        ]
      }
    ],
    introduction: {
      enabled: true,
      text: 'Results-driven B.Tech Computer Science graduate specializing in scalable backend architectures, distributed systems, and modern cloud infrastructure. Experienced with high-traffic web applications in Java and Node.js.'
    },
    sectionOrder: ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'],
    skills: [
      { category: 'Languages', items: 'C++, Java, Python, JavaScript, TypeScript, SQL, Go' },
      { category: 'Frameworks', items: 'React, Next.js, Node.js, Express.js, Tailwind CSS, Spring Boot' },
      { category: 'Developer Tools', items: 'Git, GitHub, Docker, Kubernetes, AWS (EC2, S3), Redis, PostgreSQL, MongoDB, Linux' },
      { category: 'Libraries', items: 'Prisma ORM, Redux Toolkit, Socket.io, gRPC' },
      { category: 'Core CS Coursework', items: 'Object-Oriented Programming, Data Structures & Algorithms, Distributed Systems' }
    ],
    certifications: [
      {
        name: 'AWS Certified Solutions Architect -- Associate',
        issuer: 'Amazon Web Services',
        date: 'Issued Jan 2025',
        credentialId: 'AWS-SAA-849204',
        url: 'https://cp.certmetrics.com/amazon/public/verify'
      }
    ],
    achievements: [
      {
        title: 'LeetCode Knight',
        description: 'Global Rating 2048 (Top 2.1% globally), solved 550+ problems in Data Structures & Algorithms',
        url: 'https://leetcode.com/u/aarav_codes',
        linkLabel: 'LeetCode Profile'
      },
      {
        title: 'Smart India Hackathon (SIH 2024)',
        description: 'National Finalist among 1,200+ teams; built an automated supply chain dispute resolver for Ministry of Coal',
        url: '',
        linkLabel: ''
      }
    ]
  },

  aiml: {
    personal: {
      fullName: 'Priya Iyer',
      phone: '+91 91234 56789',
      email: 'priya.iyer@gmail.com',
      linkedin: 'https://linkedin.com/in/priya-iyer-ai',
      linkedinDisplay: 'LinkedIn',
      github: 'https://github.com/priyaiyer-ai',
      githubDisplay: 'GitHub',
      leetcode: 'https://kaggle.com/priyaiyer',
      leetcodeDisplay: 'Kaggle',
      portfolio: 'https://priyaiyer.github.io',
      portfolioDisplay: 'Portfolio'
    },
    education: [
      {
        institution: 'Indian Institute of Technology (IIT), Kharagpur',
        location: 'West Bengal, India',
        degree: 'B.Tech in Artificial Intelligence & Data Science',
        dates: 'Nov 2022 -- Jun 2026',
        gpa: '9.41 / 10.0',
        coursework: 'Deep Learning, Computer Vision, Natural Language Processing, Linear Algebra, Probability'
      }
    ],
    experience: [
      {
        role: 'Machine Learning Research Intern',
        company: 'Wadhwani AI',
        location: 'Bengaluru, India',
        dates: 'May 2025 -- Jul 2025',
        bullets: [
          'Trained lightweight Vision Transformer (ViT) and MobileNetV3 architectures for automated pest disease detection on low-resource mobile edge devices.',
          'Quantized PyTorch weights to INT8 via TensorRT, cutting inference latency by 48% (110ms to 57ms) with less than 0.8% drop in Top-1 Accuracy.',
          'Preprocessed and curated a diverse dataset of 45,000+ agricultural field images with advanced geometric augmentations and contrastive learning.'
        ]
      }
    ],
    projects: [
      {
        title: 'DocuChat: Retrieval-Augmented Generation (RAG) Engine',
        techStack: 'Python, LangChain, PyTorch, ChromaDB, LLaMA-3, FastAPI, Streamlit',
        dates: 'Jan 2025 -- Mar 2025',
        liveUrl: 'https://docuchat-rag.hf.space',
        liveLabel: 'Hugging Face Space',
        githubUrl: 'https://github.com/priyaiyer-ai/rag-docuchat',
        githubLabel: 'GitHub',
        bullets: [
          'Developed an end-to-end RAG system capable of accurately querying complex 500+ page financial PDFs with verified page-level source citations.',
          'Implemented hybrid search combining dense semantic embeddings (BGE-large) and sparse BM25 keyword rankings, improving MRR@10 by 24%.',
          'Deployed scalable microservice API backend on FastAPI, achieving sub-1.2s round-trip response time for conversational queries.'
        ]
      },
      {
        title: 'MedSeg: Automated Tumor Segmentation in MRI Scans',
        techStack: 'PyTorch, U-Net, MONAI, OpenCV, CUDA',
        dates: 'Sep 2024 -- Dec 2024',
        liveUrl: '',
        liveLabel: '',
        githubUrl: 'https://github.com/priyaiyer-ai/brain-mri-segmentation',
        githubLabel: 'GitHub',
        bullets: [
          'Designed a 3D Attention U-Net model for multi-modal brain tumor segmentation on the BraTS2023 benchmark dataset.',
          'Achieved an average Dice Similarity Coefficient of 0.892, outperforming baseline 2D CNN models by 8.4% on boundary voxels.'
        ]
      }
    ],
    introduction: {
      enabled: true,
      text: 'Pre-final B.Tech Computer Science student specializing in Machine Learning, Computer Vision, and Deep Learning pipelines. Experienced in developing neural network architectures using PyTorch and deploying scalable ML models.'
    },
    sectionOrder: ['introduction', 'education', 'skills', 'projects', 'experience', 'certifications', 'achievements'],
    skills: [
      { category: 'Languages', items: 'Python, C++, SQL, R, Bash' },
      { category: 'AI & Deep Learning', items: 'PyTorch, TensorFlow, Hugging Face Transformers, LangChain, FastAPI' },
      { category: 'MLOps & Cloud Tools', items: 'Docker, MLflow, Weights & Biases, Git, CUDA, Linux, AWS Sagemaker' },
      { category: 'Libraries', items: 'scikit-learn, OpenCV, NumPy, pandas, Matplotlib, ChromaDB' },
      { category: 'Core Coursework', items: 'Statistical Machine Learning, Deep Neural Networks, Vector Databases' }
    ],
    certifications: [
      {
        name: 'Deep Learning Specialization (5 Courses)',
        issuer: 'DeepLearning.AI / Andrew Ng (Coursera)',
        date: 'Issued Sep 2024',
        credentialId: 'COURSERA-DLS-9912',
        url: 'https://coursera.org/verify/specialization/XYZ789'
      }
    ],
    achievements: [
      {
        title: 'Kaggle Notebooks Expert',
        description: 'Ranked in Top 1.5% globally with 3 Gold and 5 Silver medals in Computer Vision & NLP competitions',
        url: 'https://kaggle.com/priyaiyer',
        linkLabel: 'Kaggle Profile'
      }
    ]
  },

  fresher: {
    personal: {
      fullName: 'Rohan Verma',
      phone: '+91 98111 22334',
      email: 'rohan.verma.cse@gmail.com',
      linkedin: 'https://linkedin.com/in/rohanverma-dev',
      linkedinDisplay: 'LinkedIn',
      github: 'https://github.com/rohan-verma',
      githubDisplay: 'GitHub',
      leetcode: 'https://leetcode.com/u/rohan_v',
      leetcodeDisplay: 'LeetCode',
      portfolio: '',
      portfolioDisplay: ''
    },
    education: [
      {
        institution: 'Vellore Institute of Technology (VIT), Vellore',
        location: 'Tamil Nadu, India',
        degree: 'B.Tech in Computer Science and Engineering',
        dates: 'Jul 2022 -- Jun 2026',
        gpa: '8.92 / 10.0',
        coursework: 'Data Structures & Algorithms, Database Management Systems, Computer Networks, Software Engineering'
      },
      {
        institution: 'St. Xavier High School',
        location: 'Jaipur, Rajasthan',
        degree: 'CBSE Class XII (Science Stream)',
        dates: '2020 -- 2022',
        gpa: '95.2%',
        coursework: ''
      }
    ],
    experience: [
      {
        role: 'Technical Team Lead',
        company: 'Google Developer Student Clubs (GDSC) VIT',
        location: 'Vellore, India',
        dates: 'Aug 2024 -- Present',
        bullets: [
          'Conducted 6 hands-on workshops on Web Development, Git/GitHub, and Cloud fundamentals for 800+ freshman and sophomore engineering students.',
          'Spearheaded the technical track of annual college hackathon, curating problem statements and mentoring 45 participating teams.'
        ]
      }
    ],
    projects: [
      {
        title: 'CampusPlacementHub: Automated Drive & Interview Tracker',
        techStack: 'Next.js 14, TypeScript, Prisma, PostgreSQL, TailwindCSS, NextAuth',
        dates: 'Nov 2024 -- Feb 2025',
        liveUrl: 'https://campusplacementhub.vercel.app',
        liveLabel: 'Live Website',
        githubUrl: 'https://github.com/rohan-verma/placement-hub',
        githubLabel: 'GitHub',
        bullets: [
          'Built a full-stack portal used by 600+ students to track on-campus recruitment eligibility criteria, company test deadlines, and interview rounds.',
          'Engineered real-time automated email notifications for shortlists using Resend and cron jobs on Vercel.',
          'Designed relational database schema with PostgreSQL and Prisma ORM, optimizing query speeds with B-tree indices on student roll numbers.'
        ]
      },
      {
        title: 'CryptoTrack: Live Web3 Portfolio & Alert Bot',
        techStack: 'React, Node.js, Express, CoinGecko API, Telegram Bot API',
        dates: 'Jun 2024 -- Aug 2024',
        liveUrl: '',
        liveLabel: '',
        githubUrl: 'https://github.com/rohan-verma/cryptotrack-bot',
        githubLabel: 'GitHub',
        bullets: [
          'Constructed a live crypto price monitoring application featuring interactive Chart.js sparkline visualizations and real-time polling.',
          'Integrated a background Telegram bot that broadcasts instantaneous volatility alerts whenever selected assets swing by >5% within 1 hour.'
        ]
      }
    ],
    introduction: {
      enabled: true,
      text: 'Motivated B.Tech Computer Science undergraduate with strong problem-solving skills in Data Structures & Algorithms. Eager to contribute to software development projects with expertise in Java, Python, and modern web frameworks.'
    },
    sectionOrder: ['introduction', 'education', 'skills', 'projects', 'experience', 'certifications', 'achievements'],
    skills: [
      { category: 'Languages', items: 'Java, C++, JavaScript, TypeScript, SQL, HTML5, CSS3' },
      { category: 'Frameworks', items: 'React, Node.js, Express.js, Next.js, Tailwind CSS, Bootstrap' },
      { category: 'Developer Tools', items: 'Git, GitHub, VS Code, Postman, MongoDB, PostgreSQL, Vercel, Netlify, Linux' },
      { category: 'Libraries', items: 'Chart.js, Axios, Mongoose, Prisma' },
      { category: 'Core CS Coursework', items: 'Operating Systems, Object-Oriented Analysis & Design, Cloud Computing Basics' }
    ],
    certifications: [
      {
        name: 'HackerRank Problem Solving (Advanced) Certificate',
        issuer: 'HackerRank',
        date: 'Issued Jul 2024',
        credentialId: 'HACKERRANK-PS-99201',
        url: 'https://www.hackerrank.com/certificates/verified'
      }
    ],
    achievements: [
      {
        title: 'Winner - HackVIT 2024',
        description: 'Won 1st prize worth INR 40,000 among 150+ teams for building an AI-powered offline disaster response mapping tool',
        url: 'https://github.com/rohan-verma/hackvit-winning-project',
        linkLabel: 'Hackathon Submission'
      },
      {
        title: 'CodeChef 3-Star Coder',
        description: 'Peak rating 1685; consistently participated in 20+ Starters contests',
        url: 'https://codechef.com/users/rohan_v',
        linkLabel: 'CodeChef Profile'
      }
    ]
  }
};

// Export to window in browser, or module.exports in Node
if (typeof window !== 'undefined') {
  window.escapeLatex = escapeLatex;
  window.formatBulletLatex = formatBulletLatex;
  window.normalizeUrl = normalizeUrl;
  window.cleanUrlDisplay = cleanUrlDisplay;
  window.getSiteDisplayName = getSiteDisplayName;
  window.cleanCertTitle = cleanCertTitle;
  window.createLatexHref = createLatexHref;
  window.normalizeSkills = normalizeSkills;
  window.generateIntroductionLatex = generateIntroductionLatex;
  window.generateLatexCode = generateLatexCode;
  window.BTECH_PRESETS = BTECH_PRESETS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeLatex,
    formatBulletLatex,
    normalizeUrl,
    cleanUrlDisplay,
    getSiteDisplayName,
    cleanCertTitle,
    createLatexHref,
    normalizeSkills,
    generateIntroductionLatex,
    generateLatexCode,
    BTECH_PRESETS
  };
}
