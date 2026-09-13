/**
 * Jake's Resume Builder - Client-Side Resume Parser & Entity Extractor
 * Extracts personal contact info, education, experience, projects, skills, certs, and summary
 * from PDF documents (using PDF.js), LaTeX (.tex) sources, and plain text.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ResumeParser = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // Common Section Header Regex Aliases
  const SECTION_PATTERNS = {
    introduction: /^(?:professional\s+summary|summary|profile|about\s+me|objective|career\s+objective|executive\s+summary|introduction)\b/i,
    education: /^(?:education|academic\s+background|educational\s+qualifications|academics|qualifications|academic\s+details)\b/i,
    experience: /^(?:work\s+experience|professional\s+experience|experience|employment\s+history|internships|work\s+history|industry\s+experience)\b/i,
    projects: /^(?:projects|technical\s+projects|academic\s+projects|personal\s+projects|key\s+projects|selected\s+projects)\b/i,
    skills: /^(?:technical\s+skills|skills\s*(?:&|and)\s*abilities|skills\s*(?:&|and)\s*tools|skills|core\s+competencies|technologies|tools\s*(?:&|and)\s*technologies)\b/i,
    certifications: /^(?:certifications|licenses\s*(?:&|and)\s*certifications|certificates|courses\s*(?:&|and)\s*certifications)\b/i,
    achievements: /^(?:honors\s*(?:&|and)\s*achievements|achievements|honors|awards\s*(?:&|and)\s*achievements|awards|accomplishments|extracurricular\s+activities)\b/i
  };

  /**
   * Main Parser Entry Points
   */
  const ResumeParser = {

    /**
     * Parse raw plain text into normalized resumeState
     */
    parseText: function (rawText) {
      if (!rawText || typeof rawText !== 'string') {
        return createEmptyState();
      }

      // Normalize line breaks and clean whitespace
      const lines = rawText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length === 0) return createEmptyState();

      // 1. Extract Personal Info from top section
      const personal = extractPersonalInfo(lines, rawText);

      // 2. Segment lines into categorized sections
      const sections = segmentSections(lines);

      // 3. Parse individual sections
      const education = parseEducation(sections.education || []);
      const experience = parseExperience(sections.experience || []);
      const projects = parseProjects(sections.projects || []);
      const skills = parseSkills(sections.skills || []);
      const certifications = parseCertifications(sections.certifications || []);
      const achievements = parseAchievements(sections.achievements || []);
      const introduction = parseIntroduction(sections.introduction || []);

      // 4. Construct Section Order
      const sectionOrder = ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements'];

      return {
        personal,
        introduction,
        education,
        experience,
        projects,
        skills,
        certifications,
        achievements,
        sectionOrder
      };
    },

    /**
     * Parse an existing LaTeX (.tex) resume source
     */
    parseLatex: function (latexSource) {
      if (!latexSource || typeof latexSource !== 'string') {
        return createEmptyState();
      }

      const state = createEmptyState();

      // 1. Extract Name
      const nameMatch = latexSource.match(/\\Huge\s*(?:\\scshape)?\s*\{?([^}\\\n]+)\}?/i) ||
                        latexSource.match(/\\textbf\{\\Huge\s*([^\}]+)\}/i);
      if (nameMatch) {
        state.personal.fullName = cleanLatexText(nameMatch[1]);
      }

      // 2. Extract Header Links
      const emailMatch = latexSource.match(/href\{mailto:([^}]+)\}/i) || latexSource.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (emailMatch) state.personal.email = emailMatch[1].trim();

      const phoneMatch = latexSource.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[-.\s]?\d{10}/);
      if (phoneMatch) state.personal.phone = phoneMatch[0].trim();

      const linkedinMatch = latexSource.match(/href\{(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^}]+)\}/i);
      if (linkedinMatch) {
        state.personal.linkedin = linkedinMatch[1].trim();
        state.personal.linkedinDisplay = cleanUrlDisplay(linkedinMatch[1]);
      }

      const githubMatch = latexSource.match(/href\{(https?:\/\/(?:www\.)?github\.com\/[^}]+)\}/i);
      if (githubMatch) {
        state.personal.github = githubMatch[1].trim();
        state.personal.githubDisplay = cleanUrlDisplay(githubMatch[1]);
      }

      const leetcodeMatch = latexSource.match(/href\{(https?:\/\/(?:www\.)?(?:leetcode|codeforces|kaggle)\.com\/[^}]+)\}/i);
      if (leetcodeMatch) {
        state.personal.leetcode = leetcodeMatch[1].trim();
        state.personal.leetcodeDisplay = cleanUrlDisplay(leetcodeMatch[1]);
      }

      // 3. Segment by \section{...}
      const sectionBlocks = {};
      const sectionRegex = /\\section\{([^}]+)\}([\s\S]*?)(?=\\section\{|\\end\{document\}|$)/gi;
      let match;
      while ((match = sectionRegex.exec(latexSource)) !== null) {
        const secTitle = match[1].toLowerCase().replace(/\\&/g, '&').trim();
        const secBody = match[2];

        for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
          if (pattern.test(secTitle)) {
            sectionBlocks[key] = secBody;
            break;
          }
        }
      }

      // Parse LaTeX sections
      if (sectionBlocks.introduction) {
        const raw = cleanLatexText(sectionBlocks.introduction);
        state.introduction = {
          enabled: true,
          text: raw.replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}|\\item/g, '').trim()
        };
      }

      if (sectionBlocks.education) {
        state.education = parseLatexEducation(sectionBlocks.education);
      }

      if (sectionBlocks.experience) {
        state.experience = parseLatexExperience(sectionBlocks.experience);
      }

      if (sectionBlocks.projects) {
        state.projects = parseLatexProjects(sectionBlocks.projects);
      }

      if (sectionBlocks.skills) {
        state.skills = parseLatexSkills(sectionBlocks.skills);
      }

      if (sectionBlocks.certifications) {
        state.certifications = parseLatexCertifications(sectionBlocks.certifications);
      }

      if (sectionBlocks.achievements) {
        state.achievements = parseLatexAchievements(sectionBlocks.achievements);
      }

      return state;
    },

    /**
     * In-browser PDF extraction using Mozilla PDF.js
     * Reads all text elements across all pages, sorts by coordinates, and returns structured text
     */
    extractTextFromPdf: async function (pdfDataBuffer, progressCallback) {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library is not loaded. Please ensure pdf.min.js is included.');
      }

      // Set worker if available
      if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const loadingTask = pdfjsLib.getDocument({ data: pdfDataBuffer });
      if (progressCallback) progressCallback('Loading PDF document...');

      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      let fullTextLines = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (progressCallback) progressCallback(`Processing page ${pageNum} of ${numPages}...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Group items by horizontal and vertical coordinate (approximate lines)
        const items = textContent.items.map(item => ({
          str: item.str,
          x: Math.round(item.transform[4]),
          y: Math.round(item.transform[5]),
          height: item.height,
          width: item.width
        })).filter(item => item.str.trim().length > 0);

        // Sort items: primarily by vertical y descending (top to bottom), then by x ascending (left to right)
        // Note: In PDF coordinate space, Y increases from bottom to top
        items.sort((a, b) => {
          const yDiff = Math.abs(a.y - b.y);
          if (yDiff <= 4) { // On the same line within 4pt tolerance
            return a.x - b.x;
          }
          return b.y - a.y; // Top line comes first
        });

        // Group into lines
        const pageLines = [];
        let currentLine = [];
        let lastY = null;

        for (const item of items) {
          if (lastY === null || Math.abs(item.y - lastY) <= 4) {
            currentLine.push(item.str);
          } else {
            if (currentLine.length > 0) {
              pageLines.push(currentLine.join(' ').trim());
            }
            currentLine = [item.str];
          }
          lastY = item.y;
        }
        if (currentLine.length > 0) {
          pageLines.push(currentLine.join(' ').trim());
        }

        fullTextLines = fullTextLines.concat(pageLines);
      }

      return fullTextLines.join('\n');
    }
  };

  /**
   * Helper: Segment text into section blocks
   */
  function segmentSections(lines) {
    const sections = {
      header: [],
      introduction: [],
      education: [],
      experience: [],
      projects: [],
      skills: [],
      certifications: [],
      achievements: []
    };

    let currentSection = 'header';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line is a section header
      let detectedSection = null;
      for (const [secKey, pattern] of Object.entries(SECTION_PATTERNS)) {
        // Line should be reasonably short (<= 45 chars) and match section pattern
        if (line.length <= 45 && pattern.test(line.replace(/^[#*_\-=\s]+|[#*_\-=\s]+$/g, '').trim())) {
          detectedSection = secKey;
          break;
        }
      }

      if (detectedSection) {
        currentSection = detectedSection;
      } else {
        sections[currentSection].push(line);
      }
    }

    return sections;
  }

  /**
   * 1. Extract Personal Contact Information
   */
  function extractPersonalInfo(lines, rawText) {
    const personal = {
      fullName: '',
      phone: '',
      email: '',
      linkedin: '',
      linkedinDisplay: '',
      github: '',
      githubDisplay: '',
      leetcode: '',
      leetcodeDisplay: '',
      portfolio: '',
      portfolioDisplay: ''
    };

    // Extract Email
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = rawText.match(emailRegex);
    if (emailMatch) personal.email = emailMatch[1].trim();

    // Extract Phone (Supports +91 98765 43210, +1 (123) 456-7890, 10-digit numbers)
    const phoneRegex = /(?:\+?91[-.\s]*)?[6-9]\d{4}[-.\s]?\d{5}|(?:\+?\d{1,3}[-.\s]*)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b[6-9]\d{9}\b/;
    const phoneMatch = rawText.match(phoneRegex);
    if (phoneMatch) personal.phone = phoneMatch[0].trim();

    // Extract LinkedIn
    const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i;
    const linkedinMatch = rawText.match(linkedinRegex);
    if (linkedinMatch) {
      personal.linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`;
      personal.linkedinDisplay = `linkedin.com/in/${linkedinMatch[1]}`;
    }

    // Extract GitHub
    const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i;
    const githubMatch = rawText.match(githubRegex);
    if (githubMatch && !['sponsors', 'features', 'topics', 'trending'].includes(githubMatch[1].toLowerCase())) {
      personal.github = `https://github.com/${githubMatch[1]}`;
      personal.githubDisplay = `github.com/${githubMatch[1]}`;
    }

    // Extract LeetCode / Coding Profile
    const leetcodeRegex = /(?:https?:\/\/)?(?:www\.)?(leetcode\.com\/(?:u\/)?[a-zA-Z0-9_-]+|codeforces\.com\/profile\/[a-zA-Z0-9_-]+|kaggle\.com\/[a-zA-Z0-9_-]+)/i;
    const leetcodeMatch = rawText.match(leetcodeRegex);
    if (leetcodeMatch) {
      const url = leetcodeMatch[0].startsWith('http') ? leetcodeMatch[0] : `https://${leetcodeMatch[0]}`;
      personal.leetcode = url;
      personal.leetcodeDisplay = cleanUrlDisplay(url);
    }

    // Extract Portfolio URL (any generic link not matched above)
    const urlRegex = /(?:https?:\/\/)(?!linkedin|github|leetcode|codeforces|kaggle)([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]>]*)?)/gi;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(rawText)) !== null) {
      const found = urlMatch[0];
      if (!found.includes('@') && !found.includes('pdf') && !found.includes('coursera') && !found.includes('aws')) {
        personal.portfolio = found;
        personal.portfolioDisplay = cleanUrlDisplay(found);
        break;
      }
    }

    // Extract Candidate Name from top 5 lines
    const ignoreNames = /^(?:resume|curriculum\s+vitae|cv|contact|personal|profile|page\s+\d+|phone|email)$/i;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].replace(/[|•,;].*$/, '').trim();
      // Name candidate: 2 to 4 words, alphabetic, no @ or digits, reasonable length
      if (line.length >= 3 && line.length <= 40 && !ignoreNames.test(line) && !line.includes('@') && !/\d/.test(line)) {
        // Strip titles like "Mr.", "Ms.", "Dr."
        personal.fullName = line.replace(/^(?:mr\.|ms\.|mrs\.|dr\.)\s+/i, '').trim();
        break;
      }
    }

    return personal;
  }

  /**
   * 2. Parse Education
   */
  function parseEducation(lines) {
    if (!lines || lines.length === 0) return [];
    const education = [];
    const dateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\b(?:19|20)\d{2}\s*(?:--|-|to|–)\s*(?:(?:19|20)\d{2}|Present|Current)\b|\b(?:19|20)\d{2}\b/i;
    const gpaRegex = /(?:CGPA|GPA|Score|Percentage|Marks)?:?\s*(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*10(?:\.0)?)?|\d{1,3}(?:\.\d{1,2})?%)/i;
    const degreeKeywords = /Bachelor|Master|B\.?Tech|B\.?E\.?|B\.?Sc|B\.?S\.?|M\.?Tech|M\.?S\.?|High\s+School|Senior\s+Secondary|Class\s+(?:X|XII|10|12)/i;

    let currentEdu = null;

    lines.forEach(line => {
      // Check if line looks like an institution or degree line
      const hasDate = dateRegex.test(line);
      const hasDegree = degreeKeywords.test(line);
      const isLikelySchool = /University|College|Institute|School|Academy|IIT|NIT|IIIT|BITS|VIT|SRM/i.test(line);

      if (isLikelySchool || (hasDegree && !currentEdu)) {
        if (currentEdu) education.push(currentEdu);

        let institution = line;
        let location = '';
        let dates = '';

        // Extract dates from institution line if present
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
          dates = dateMatch[0].trim();
          institution = institution.replace(dateMatch[0], '').replace(/[|,\-–]$/, '').trim();
        }

        // Extract location if separated by comma or pipe
        const parts = institution.split(/[|,]/).map(p => p.trim());
        if (parts.length > 1 && parts[parts.length - 1].length <= 25 && !parts[parts.length - 1].toLowerCase().includes('tech')) {
          location = parts.pop();
          institution = parts.join(', ').trim();
        }

        currentEdu = {
          institution: institution || 'University / Institution',
          location: location || '',
          degree: '',
          dates: dates || '',
          gpa: '',
          coursework: ''
        };
      } else if (currentEdu) {
        // Degree / GPA / Coursework lines
        const gpaMatch = line.match(gpaRegex);
        if (gpaMatch && !currentEdu.gpa) {
          currentEdu.gpa = gpaMatch[1].trim();
        }

        const dateMatch = line.match(dateRegex);
        if (dateMatch && !currentEdu.dates) {
          currentEdu.dates = dateMatch[0].trim();
        }

        if (/coursework|courses|relevant/i.test(line)) {
          currentEdu.coursework = line.replace(/^(?:relevant\s+)?coursework:?\s*/i, '').trim();
        } else if (!currentEdu.degree && (hasDegree || line.length <= 80)) {
          currentEdu.degree = line.replace(dateRegex, '').replace(/[|,]$/, '').trim();
        }
      }
    });

    if (currentEdu) education.push(currentEdu);

    // Fallback defaults
    return education.map(e => ({
      institution: e.institution || 'University Name',
      location: e.location || '',
      degree: e.degree || 'Bachelor of Technology in Computer Science',
      dates: e.dates || '2021 -- 2025',
      gpa: e.gpa || '',
      coursework: e.coursework || ''
    }));
  }

  /**
   * Helper: Check if a line is a continuation of an active bullet point
   * (e.g. wrapped lines from PDF extraction or pasted plain text)
   */
  function isBulletContinuation(line, currentBullet, nextLine) {
    if (!line || !currentBullet) return false;

    const trimmed = line.trim();
    if (!trimmed) return false;

    // If this line itself is clearly a bullet, it's NOT a continuation
    if (/^[•\-*+]\s+/.test(trimmed) || /^(\d+\.|\([a-z]\))\s+/.test(trimmed)) {
      return false;
    }

    // 1. Starts with lowercase letter -> definitely continuation
    if (/^[a-z]/.test(trimmed)) return true;

    // 2. Starts with continuation punctuation (comma, dash, em-dash, parenthesis, etc.)
    if (/^[,\-–—)\]};]/.test(trimmed)) return true;

    // 3. Starts with common conjunctions or prepositions (e.g. "and", "or", "with", "using", etc.)
    if (/^(?:and|or|but|so|with|using|in|for|to|at|by|from|as|that|which|where|when|while|into|over|under|including|such\s+as)\b/i.test(trimmed)) {
      return true;
    }

    // 4. Check if currentBullet ended mid-sentence (e.g. ends with a conjunction, preposition, comma, or hyphen)
    const prevEndsWithBreak = /(?:,\s*|\band\s*|\bor\s*|\bwith\s*|\busing\s*|\bfor\s*|\bto\s*|\bin\s*|\bof\s*|\bat\s*|\bby\s*|-\s*)$/i.test(currentBullet.trim());
    if (prevEndsWithBreak) {
      return true;
    }

    // 5. If this line ends with a period, but does NOT look like a title or heading:
    // A heading typically does NOT end with a period, whereas a sentence fragment wrapping to a period DOES.
    const hasDate = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\b(?:19|20)\d{2}\b/i.test(trimmed);
    const hasPipe = trimmed.includes('|');
    const endsWithPeriod = trimmed.endsWith('.');

    if (endsWithPeriod && !hasPipe && !hasDate) {
      return true;
    }

    return false;
  }

  /**
   * Helper: Seamlessly stitch multi-line wrapped bullet points
   * Works across PDF extractions, plain text imports, and pasted resumes
   */
  function stitchSectionBullets(lines) {
    if (!lines || lines.length === 0) return [];
    const stitched = [];
    let currentBullet = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const isBullet = /^[•\-*+]\s+/.test(line) || /^(\d+\.|\([a-z]\))\s+/.test(line);
      const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

      if (isBullet) {
        if (currentBullet) stitched.push(currentBullet);
        currentBullet = line;
      } else if (currentBullet) {
        if (isBulletContinuation(line, currentBullet, nextLine)) {
          if (currentBullet.endsWith('-') && !currentBullet.endsWith(' -')) {
            currentBullet = currentBullet.slice(0, -1) + line;
          } else if (line.startsWith('—') || line.startsWith('–')) {
            currentBullet += ' ' + line;
          } else {
            currentBullet += ' ' + line;
          }
        } else {
          stitched.push(currentBullet);
          currentBullet = null;
          stitched.push(line);
        }
      } else {
        stitched.push(line);
      }
    }

    if (currentBullet) stitched.push(currentBullet);
    return stitched;
  }

  /**
   * 3. Parse Work Experience
   */
  function parseExperience(rawLines) {
    if (!rawLines || rawLines.length === 0) return [];
    const lines = stitchSectionBullets(rawLines);
    const experience = [];
    const dateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\b(?:19|20)\d{2}\s*(?:--|-|to|–)\s*(?:(?:19|20)\d{2}|Present|Current)\b|\b(?:19|20)\d{2}\b/i;

    let currentExp = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;

      const isBullet = /^[•\-*+]\s+/.test(line) || /^(\d+\.|\([a-z]\))\s+/.test(line);
      const cleanLine = line.replace(/^[•\-*+]\s+|^(\d+\.|\([a-z]\))\s+/, '').trim();
      const dateMatch = line.match(dateRegex);

      const hasSeparators = line.includes('—') || line.includes('–') || line.includes('|');
      const isLikelyHeading = !isBullet && (
        currentExp === null ||
        dateMatch ||
        hasSeparators ||
        (currentExp.bullets.length > 0 && !line.endsWith('.'))
      );

      if (isLikelyHeading && (currentExp === null || currentExp.bullets.length > 0 || dateMatch)) {
        if (currentExp) experience.push(currentExp);

        const dates = dateMatch ? dateMatch[0].trim() : '';
        let titleLine = dateMatch ? line.replace(dateMatch[0], '') : line;
        titleLine = titleLine.replace(/[|,\-–—\s]+$/, '').replace(/^[|,\-–—\s]+/, '').trim();

        let role = titleLine;
        let company = '';
        let location = '';

        const splitParts = titleLine.split(/\s+[—–|-]+\s+/).map(p => p.trim()).filter(Boolean);
        if (splitParts.length >= 2) {
          company = splitParts[0];
          role = splitParts[1];
          if (splitParts.length >= 3) location = splitParts[2];
        }

        currentExp = {
          role: role || 'Software Development Intern',
          company: company || 'Company / Organization',
          location: location || '',
          dates: dates,
          bullets: []
        };
      } else if (currentExp) {
        if (isBullet || cleanLine.length > 15) {
          currentExp.bullets.push(cleanLine);
        }
      }
    }

    if (currentExp) experience.push(currentExp);
    return experience;
  }

  /**
   * 4. Parse Projects
   * Robustly extracts project titles with or without dates, parentheses, pipes, or inline tech lists.
   * Auto-stitches wrapped bullet lines and formats Tech: bullet points cleanly with bold.
   */
  function parseProjects(rawLines) {
    if (!rawLines || rawLines.length === 0) return [];
    const lines = stitchSectionBullets(rawLines);
    const projects = [];
    const dateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\b(?:19|20)\d{2}\s*(?:--|-|to|–)\s*(?:(?:19|20)\d{2}|Present|Current)\b|\b(?:19|20)\d{2}\b/i;
    const techSplitRegex = /^(.*?)(?:\s*\|\s*|\s*[-–—]\s*|\s{2,}|\s+(?=(?:React|Node|Express|Mongo|Postgre|Python|Java|C\+\+|Next|Vue|Angular|SQL|AWS|Docker|Flutter|TypeScript|JavaScript|HTML|Tailwind|FastAPI|Django|Flask|Firebase|Spring|Git|Redis|GraphQL)\b))(.*)$/i;

    let currentProj = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;

      const isBullet = /^[•\-*+]\s+/.test(line) || /^(\d+\.|\([a-z]\))\s+/.test(line);
      let cleanLine = line.replace(/^[•\-*+]\s+|^(\d+\.|\([a-z]\))\s+/, '').trim();

      // Check if this bullet line specifies "Tech: ..." or "Technologies: ..."
      // Format with markdown bold (**Tech:** ...) and preserve as a clean bullet
      const techBulletMatch = cleanLine.match(/^(tech(?:nologies)?|tools|tech\s+stack|stack|built\s+with)\s*[:\-–—]\s*(.+)$/i);
      if (techBulletMatch && currentProj) {
        const label = techBulletMatch[1].charAt(0).toUpperCase() + techBulletMatch[1].slice(1).toLowerCase();
        cleanLine = `**${label}:** ${techBulletMatch[2].trim()}`;
      }

      // If this line is just a URL for the current project
      const isJustUrl = /^(?:https?:\/\/|www\.|github\.com\/)[^\s]+$/i.test(line.trim());
      if (isJustUrl && currentProj && (!currentProj.liveUrl || !currentProj.githubUrl)) {
        if (line.includes('github.com')) {
          currentProj.githubUrl = line.trim();
          currentProj.githubLabel = 'GitHub';
        } else {
          currentProj.liveUrl = line.trim();
          currentProj.liveLabel = 'Live Demo';
        }
        continue;
      }

      const hasDate = dateRegex.test(line);

      // If this line is just a date line right after project title (before any bullets)
      if (currentProj && currentProj.bullets.length === 0 && !currentProj.dates && hasDate) {
        const pureText = line.replace(dateRegex, '').replace(/[|,\-–—\s]+$/, '').trim();
        if (!pureText || pureText.length < 3) {
          currentProj.dates = line.match(dateRegex)[0].trim();
          continue;
        }
      }

      const techInParen = line.match(/\(([^)]+)\)/);
      const hasSeparators = line.includes('|') || line.includes(' — ') || line.includes(' – ');

      // Since lines are pre-stitched, non-bullet lines that are headings start a project
      const isLikelyProjectTitle = !isBullet && (
        currentProj === null || // First non-bullet item in Projects is always a project
        techInParen ||         // Contains tech in parentheses
        hasDate ||             // Has date
        hasSeparators ||       // Has pipe or dash separator
        (currentProj.bullets.length > 0 && !line.endsWith('.'))
      );

      if (isLikelyProjectTitle) {
        if (currentProj) projects.push(currentProj);

        let title = line;
        let techStack = '';
        let dates = '';
        let liveUrl = '';
        let githubUrl = '';

        // Extract GitHub / Live URL if embedded in title line
        const gitMatch = title.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)\]]+/i);
        if (gitMatch) {
          githubUrl = gitMatch[0].startsWith('http') ? gitMatch[0] : `https://${gitMatch[0]}`;
          title = title.replace(gitMatch[0], '');
        }

        const urlMatch = title.match(/https?:\/\/[^\s)\]]+/i);
        if (urlMatch && !urlMatch[0].includes('github.com')) {
          liveUrl = urlMatch[0];
          title = title.replace(urlMatch[0], '');
        }

        // Extract dates
        if (hasDate) {
          const dMatch = title.match(dateRegex);
          if (dMatch) {
            dates = dMatch[0].trim();
            title = title.replace(dMatch[0], '');
          }
        }

        // Extract tech stack
        if (techInParen) {
          techStack = techInParen[1].trim();
          title = title.replace(techInParen[0], '');
        } else if (title.includes('|')) {
          const parts = title.split('|').map(p => p.trim()).filter(Boolean);
          title = parts[0] || '';
          techStack = parts.slice(1).join(', ');
        } else if (title.includes(' — ') || title.includes(' – ')) {
          const parts = title.split(/\s+[—–]\s+/).map(p => p.trim()).filter(Boolean);
          title = parts[0] || '';
          if (parts.length > 1) {
            techStack = parts.slice(1).join(', ');
          }
        } else {
          // Check for trailing tech list (e.g. "URL Shortener Node.js, Express.js, MongoDB")
          const splitMatch = title.match(techSplitRegex);
          if (splitMatch && splitMatch[1].trim().length >= 3 && splitMatch[2].trim().length >= 3) {
            title = splitMatch[1].trim();
            techStack = splitMatch[2].trim();
          }
        }

        title = title.replace(/[|,\-–—\s]+$/, '').replace(/^[|,\-–—\s]+/, '').trim();

        currentProj = {
          title: title || 'Project Title',
          techStack: techStack || '',
          dates: dates || '',
          liveUrl: liveUrl || '',
          liveLabel: liveUrl ? 'Live Demo' : '',
          githubUrl: githubUrl || '',
          githubLabel: githubUrl ? 'GitHub' : '',
          bullets: []
        };
      } else if (currentProj) {
        if (isBullet || cleanLine.length > 15) {
          const gitMatch = cleanLine.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)\]]+/i);
          if (gitMatch && !currentProj.githubUrl) {
            currentProj.githubUrl = gitMatch[0].startsWith('http') ? gitMatch[0] : `https://${gitMatch[0]}`;
            currentProj.githubLabel = 'GitHub';
          }
          currentProj.bullets.push(cleanLine);
        }
      }
    }

    if (currentProj) projects.push(currentProj);
    return projects;
  }

  /**
   * 5. Parse Technical Skills
   */
  function parseSkills(lines) {
    if (!lines || lines.length === 0) return [];
    const skills = [];

    lines.forEach(line => {
      if (!line || line.length < 3) return;

      // Detect "Category: Items" pattern
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < 35) {
        const category = line.substring(0, colonIdx).replace(/^[•\-*+\s]+|[•\-*+\s]+$/g, '').trim();
        const items = line.substring(colonIdx + 1).trim();
        if (category && items) {
          skills.push({ category, items });
          return;
        }
      }

      // If bulleted without colon, check for comma-separated items
      const clean = line.replace(/^[•\-*+\s]+/, '').trim();
      if (clean.includes(',')) {
        skills.push({
          category: 'Technologies',
          items: clean
        });
      }
    });

    // Default fallback category if empty
    if (skills.length === 0 && lines.length > 0) {
      skills.push({
        category: 'Technologies & Tools',
        items: lines.join(', ')
      });
    }

    return skills;
  }

  /**
   * 6. Parse Certifications
   */
  function parseCertifications(lines) {
    if (!lines || lines.length === 0) return [];
    const certs = [];
    const dateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\b(?:19|20)\d{2}\b/i;

    lines.forEach(line => {
      const clean = line.replace(/^[•\-*+\s]+/, '').trim();
      if (!clean || clean.length < 4) return;

      let name = clean;
      let issuer = '';
      let date = '';

      const dateMatch = clean.match(dateRegex);
      if (dateMatch) {
        date = dateMatch[0].trim();
        name = name.replace(dateMatch[0], '');
      }

      if (name.includes(' - ') || name.includes(' -- ') || name.includes(' | ')) {
        const parts = name.split(/\s+[-|–]+\s+/).map(p => p.trim());
        name = parts[0];
        issuer = parts.slice(1).join(' - ');
      }

      certs.push({
        name: name.replace(/[|,\-–\s]+$/, '').trim(),
        issuer: issuer || '',
        date: date || '',
        credentialId: '',
        url: ''
      });
    });

    return certs;
  }

  /**
   * 7. Parse Honors & Achievements
   */
  function parseAchievements(rawLines) {
    if (!rawLines || rawLines.length === 0) return [];
    const lines = stitchSectionBullets(rawLines);
    const achievements = [];

    lines.forEach(line => {
      const clean = line.replace(/^[•\-*+\s]+/, '').trim();
      if (!clean || clean.length < 4) return;

      let title = clean;
      let description = '';

      if (clean.includes(':')) {
        const parts = clean.split(':');
        title = parts[0].trim();
        description = parts.slice(1).join(':').trim();
      } else if (clean.includes(' — ') || clean.includes(' – ') || clean.includes(' - ')) {
        const parts = clean.split(/\s+[—–-]+\s+/);
        title = parts[0].trim();
        description = parts.slice(1).join(' — ').trim();
      }

      achievements.push({
        title: title || 'Honor / Achievement',
        description: description || '',
        url: '',
        linkLabel: ''
      });
    });

    return achievements;
  }

  /**
   * 8. Parse Introduction / Summary
   */
  function parseIntroduction(lines) {
    if (!lines || lines.length === 0) {
      return { enabled: false, text: '' };
    }
    const text = lines.join(' ').replace(/\s+/g, ' ').trim();
    return {
      enabled: text.length > 10,
      text: text
    };
  }

  /**
   * Helper: Extract balanced curly-braced arguments from LaTeX string
   */
  function extractBracedArgs(str, startIndex, count) {
    const args = [];
    let i = startIndex;
    while (i < str.length && args.length < count) {
      if (str[i] === '{') {
        let depth = 1;
        let start = i + 1;
        i++;
        while (i < str.length && depth > 0) {
          if (str[i] === '{') depth++;
          else if (str[i] === '}') depth--;
          i++;
        }
        args.push(str.substring(start, i - 1));
      } else {
        i++;
      }
    }
    return { args, nextIndex: i };
  }

  /**
   * LaTeX Sub-Parsers
   */
  function parseLatexEducation(latex) {
    const list = [];
    const keyword = '\\resumeSubheading';
    let idx = 0;
    while ((idx = latex.indexOf(keyword, idx)) !== -1) {
      const { args, nextIndex } = extractBracedArgs(latex, idx + keyword.length, 4);
      if (args.length === 4) {
        let degreeRaw = cleanLatexText(args[2]);
        let gpa = '';
        let coursework = '';

        const gpaMatch = degreeRaw.match(/(?:CGPA|Percentage)[:\s]*([^\s|]+)/i);
        if (gpaMatch) {
          gpa = gpaMatch[1];
          degreeRaw = degreeRaw.replace(/\|\s*CGPA\/Percentage:[^|]*/i, '').trim();
        }

        const cwMatch = degreeRaw.match(/Relevant Coursework:\s*([^\n\\]+)/i);
        if (cwMatch) {
          coursework = cwMatch[1].trim();
          degreeRaw = degreeRaw.replace(/Relevant Coursework:[^\n\\]*/i, '').trim();
        }

        list.push({
          institution: cleanLatexText(args[0]),
          location: cleanLatexText(args[1]),
          degree: degreeRaw.replace(/[|,\-–\s]+$/, '').trim(),
          dates: cleanLatexText(args[3]),
          gpa: gpa,
          coursework: coursework
        });
      }
      idx = nextIndex || idx + keyword.length;
    }
    return list;
  }

  function parseLatexExperience(latex) {
    const list = [];
    const keyword = '\\resumeSubheading';
    let idx = 0;
    while ((idx = latex.indexOf(keyword, idx)) !== -1) {
      const { args, nextIndex } = extractBracedArgs(latex, idx + keyword.length, 4);
      if (args.length === 4) {
        const nextSubheading = latex.indexOf(keyword, nextIndex);
        const nextEnd = latex.indexOf('\\resumeSubHeadingListEnd', nextIndex);
        const blockEnd = Math.min(
          nextSubheading !== -1 ? nextSubheading : Infinity,
          nextEnd !== -1 ? nextEnd : Infinity,
          latex.length
        );

        const subBody = latex.substring(nextIndex, blockEnd);
        const bullets = [];
        let bIdx = 0;
        while ((bIdx = subBody.indexOf('\\resumeItem', bIdx)) !== -1) {
          const bArg = extractBracedArgs(subBody, bIdx + '\\resumeItem'.length, 1);
          if (bArg.args.length > 0) {
            bullets.push(cleanLatexText(bArg.args[0]));
          }
          bIdx = bArg.nextIndex || bIdx + 11;
        }

        list.push({
          role: cleanLatexText(args[0]),
          dates: cleanLatexText(args[1]),
          company: cleanLatexText(args[2]),
          location: cleanLatexText(args[3]),
          bullets: bullets
        });
      }
      idx = nextIndex || idx + keyword.length;
    }
    return list;
  }

  function parseLatexProjects(latex) {
    const list = [];
    const itemRegex = /\\resumeProjectHeading\s*\{([^}]+)\}\s*\{([^}]+)\}([\s\S]*?)(?=\\resumeProjectHeading|\\resumeSubHeadingListEnd|$)/gi;
    let match;
    while ((match = itemRegex.exec(latex)) !== null) {
      const titleAndTech = match[1];
      const dates = cleanLatexText(match[2]);

      let title = cleanLatexText(titleAndTech);
      let techStack = '';

      const techMatch = titleAndTech.match(/\\emph\{([^}]+)\}/) || titleAndTech.match(/\|\s*(.+)$/);
      if (techMatch) {
        techStack = cleanLatexText(techMatch[1]);
        title = cleanLatexText(titleAndTech.replace(techMatch[0], ''));
      }

      const bullets = [];
      const bulletRegex = /\\resumeItem\{([^}]+)\}/gi;
      let bMatch;
      while ((bMatch = bulletRegex.exec(match[3])) !== null) {
        bullets.push(cleanLatexText(bMatch[1]));
      }

      list.push({
        title: title.trim(),
        techStack: techStack.trim(),
        dates: dates.trim(),
        liveUrl: '',
        liveLabel: '',
        githubUrl: '',
        githubLabel: '',
        bullets: bullets
      });
    }
    return list;
  }

  function parseLatexSkills(latex) {
    const list = [];
    const skillRegex = /\\textbf\{([^}]+)\}\{:\s*([^}]+)\}/gi;
    let match;
    while ((match = skillRegex.exec(latex)) !== null) {
      list.push({
        category: cleanLatexText(match[1]),
        items: cleanLatexText(match[2])
      });
    }
    return list;
  }

  function parseLatexCertifications(latex) {
    const list = [];
    const certRegex = /\\textbf\{([^}]+)\}(?:\s*--\s*([^\\}]+))?(?:\s*\\hfill\s*\\textit\{([^}]+)\})?/gi;
    let match;
    while ((match = certRegex.exec(latex)) !== null) {
      list.push({
        name: cleanLatexText(match[1]),
        issuer: match[2] ? cleanLatexText(match[2]) : '',
        date: match[3] ? cleanLatexText(match[3]) : '',
        credentialId: '',
        url: ''
      });
    }
    return list;
  }

  function parseLatexAchievements(latex) {
    const list = [];
    const achRegex = /\\resumeItem\{([^}]+)\}/gi;
    let match;
    while ((match = achRegex.exec(latex)) !== null) {
      const clean = cleanLatexText(match[1]);
      const colonIdx = clean.indexOf(':');
      if (colonIdx > 0) {
        list.push({
          title: clean.substring(0, colonIdx).trim(),
          description: clean.substring(colonIdx + 1).trim(),
          url: '',
          linkLabel: ''
        });
      } else {
        list.push({
          title: clean,
          description: '',
          url: '',
          linkLabel: ''
        });
      }
    }
    return list;
  }

  /**
   * Helper: Clean LaTeX escape sequences
   */
  function cleanLatexText(latexStr) {
    if (!latexStr) return '';
    return latexStr
      .replace(/\\textbf\{([^}]+)\}/g, '$1')
      .replace(/\\textit\{([^}]+)\}/g, '$1')
      .replace(/\\underline\{([^}]+)\}/g, '$1')
      .replace(/\\emph\{([^}]+)\}/g, '$1')
      .replace(/\\small\{([^}]+)\}/g, '$1')
      .replace(/\\footnotesize\{([^}]+)\}/g, '$1')
      .replace(/\\href\{[^}]+\}\{([^}]+)\}/g, '$1')
      .replace(/\\&/g, '&')
      .replace(/\\%/g, '%')
      .replace(/\\\$/g, '$')
      .replace(/\\#/g, '#')
      .replace(/\\_/g, '_')
      .replace(/\\textasciitilde\{\}/g, '~')
      .replace(/\\textasciicircum\{\}/g, '^')
      .replace(/\\textbackslash\{\}/g, '\\')
      .replace(/\\\\/g, ' ')
      .replace(/\$[^$]*\$/g, '')
      .replace(/\\vspace\{[^}]+\}/g, '')
      .replace(/\\hspace\{[^}]+\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanUrlDisplay(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/\/$/, '');
  }

  function createEmptyState() {
    return {
      personal: {
        fullName: '',
        phone: '',
        email: '',
        linkedin: '',
        linkedinDisplay: '',
        github: '',
        githubDisplay: '',
        leetcode: '',
        leetcodeDisplay: '',
        portfolio: '',
        portfolioDisplay: ''
      },
      introduction: { enabled: false, text: '' },
      education: [],
      experience: [],
      projects: [],
      skills: [],
      certifications: [],
      achievements: [],
      sectionOrder: ['introduction', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements']
    };
  }

  return ResumeParser;
}));
