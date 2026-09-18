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

  // Unified robust date matching patterns across Education, Experience, Projects, Certifications
  const MONTH_NAMES = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\\.?';
  const YEAR_DIGITS = '\\b(?:19|20)\\d{2}\\b';
  const SINGLE_DATE_PATTERN = `(?:${MONTH_NAMES}\\s*\\d{4}|${YEAR_DIGITS})`;
  const DATE_RANGE_PATTERN = `(?:${SINGLE_DATE_PATTERN}\\s*(?:--|-|to|–|—|\\s)\\s*(?:${SINGLE_DATE_PATTERN}|Present|Current|Expected\\s*\\d{4})|${SINGLE_DATE_PATTERN})`;
  const DATE_RANGE_REGEX = new RegExp(DATE_RANGE_PATTERN, 'i');

  function extractDateFromLine(line) {
    if (!line) return { dates: '', remaining: '' };
    const match = line.match(DATE_RANGE_REGEX);
    if (match) {
      let dates = match[0].trim();
      const twoDates = dates.match(new RegExp(`^(${SINGLE_DATE_PATTERN})\\s+(${SINGLE_DATE_PATTERN})$`, 'i'));
      if (twoDates) {
        dates = `${twoDates[1]} -- ${twoDates[2]}`;
      }
      const remaining = line.replace(match[0], '').trim();
      return { dates, remaining };
    }
    return { dates: '', remaining: line };
  }

  function extractOrgLocation(line) {
    if (!line) return { main: '', location: '' };
    if (line.includes('|')) {
      const p = line.split('|').map(s => s.trim()).filter(Boolean);
      return { main: p[0] || '', location: p.slice(1).join(', ') };
    }
    const orgMatch = line.match(/^(.*?\b(?:University|College|School|Institute|Academy|Corp|Inc|LLC|Ltd|Company|Technologies|niketan))\s+([A-Za-z0-9.\-\s]+,\s*(?:[A-Z]{2}|[A-Za-z]+))$/i);
    if (orgMatch) {
      return { main: orgMatch[1].trim(), location: orgMatch[2].trim() };
    }
    const cityMatch = line.match(/\s+([A-Za-z0-9.\-]+\s+[A-Za-z0-9.\-]+,\s*(?:[A-Z]{2}|[A-Za-z]+)|[A-Za-z0-9.\-]+,\s*(?:[A-Z]{2}|[A-Za-z]+))$/i);
    if (cityMatch) {
      return { main: line.slice(0, cityMatch.index).trim(), location: cityMatch[1].trim() };
    }
    return { main: line, location: '' };
  }

  /**
   * In-browser OCR fallback using Tesseract.js
   * Automatically triggered when a PDF is a flat image without a selectable text layer.
   */
  async function performPdfOcr(pdfDoc, progressCallback) {
    if (typeof Tesseract === 'undefined') {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        if (progressCallback) progressCallback('Initializing OCR recognition engine...');
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Tesseract.js engine from CDN'));
          document.head.appendChild(script);
        });
      } else {
        throw new Error('Tesseract OCR engine is not loaded');
      }
    }

    if (typeof Tesseract === 'undefined' || !Tesseract.createWorker) {
      throw new Error('Tesseract OCR engine could not be initialized');
    }

    const ocrLines = [];
    const ocrLinks = [];
    const numPages = pdfDoc.numPages;

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (progressCallback && m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          progressCallback(`Running Smart OCR (${pct}%)...`);
        }
      }
    });

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (progressCallback) progressCallback(`Rendering page ${pageNum} for OCR...`);
      const page = await pdfDoc.getPage(pageNum);

      try {
        const annots = await page.getAnnotations();
        if (Array.isArray(annots)) {
          annots.forEach(a => {
            const u = a.url || a.unsafeUrl || (a.action && a.action.uri);
            if (u && !ocrLinks.includes(u)) ocrLinks.push(u);
          });
        }
      } catch (e) {}

      const viewport = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      if (progressCallback) progressCallback(`Reading page ${pageNum} with Smart OCR...`);
      const ret = await worker.recognize(canvas);
      if (ret && ret.data && ret.data.text) {
        ocrLines.push(ret.data.text);
      }
    }

    await worker.terminate();

    let rawOcrText = ocrLines.join('\n');

    // Post-process OCR text:
    rawOcrText = rawOcrText
      .replace(/^[ \t]*E[dpo0][uv][cso]a[tli1]{1,2}[i1l][o0]n.*$/gmi, 'EDUCATION')
      .replace(/^[ \t]*Exp[eé]r[i1]ence.*$/gmi, 'EXPERIENCE')
      .replace(/^[ \t]*Pr[o0]j[eé]cts?.*$/gmi, 'PROJECTS')
      .replace(/^[ \t]*(?:Technical\s+)?Skills?.*$/gmi, 'TECHNICAL SKILLS')
      .replace(/^[ \t]*Certif[i1]cat[i1]ons?.*$/gmi, 'CERTIFICATIONS')
      .replace(/^[ \t]*Ach[i1]evements?.*$/gmi, 'ACHIEVEMENTS');

    rawOcrText = rawOcrText.replace(/^[ \t]*[®©oe•*·\u2022\u25cf\u25cb\u25e6\u2219]\s+/gmi, '• ');

    return {
      text: rawOcrText,
      links: ocrLinks
    };
  }

  /**
   * Main Parser Entry Points
   */
  const ResumeParser = {

    /**
     * Parse raw plain text into normalized resumeState
     */
    parseText: function (rawText, extractedLinks = []) {
      // Support object input { text, links }
      if (rawText && typeof rawText === 'object') {
        if (Array.isArray(rawText.links) && (!extractedLinks || extractedLinks.length === 0)) {
          extractedLinks = rawText.links;
        }
        rawText = rawText.text || '';
      }

      if (!rawText || typeof rawText !== 'string') {
        return createEmptyState();
      }

      // Normalize links
      const linkUrls = (Array.isArray(extractedLinks) ? extractedLinks : [])
        .map(l => (typeof l === 'string' ? l : (l && l.url ? l.url : ''))).filter(Boolean);

      // Normalize line breaks, clean whitespace, and normalize OCR bullet/header artifacts
      const lines = rawText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/^[ \t]*[®©oe•*·\u2022\u25cf\u25cb\u25e6\u2219]\s+/gmi, '• ')
        .replace(/^[ \t]*E[dpo0][uv][cso]a[tli1]{1,2}[i1l][o0]n.*$/gmi, 'EDUCATION')
        .replace(/^[ \t]*Exp[eé]r[i1]ence.*$/gmi, 'EXPERIENCE')
        .replace(/^[ \t]*Pr[o0]j[eé]cts?.*$/gmi, 'PROJECTS')
        .replace(/^[ \t]*(?:Technical\s+)?Skills?.*$/gmi, 'TECHNICAL SKILLS')
        .replace(/^[ \t]*Certif[i1]cat[i1]ons?.*$/gmi, 'CERTIFICATIONS')
        .replace(/^[ \t]*Ach[i1]evements?.*$/gmi, 'ACHIEVEMENTS')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length === 0) return createEmptyState();

      // 1. Extract Personal Info from top section (using lines, rawText, and linkUrls)
      const personal = extractPersonalInfo(lines, rawText, linkUrls);

      // 2. Segment lines into categorized sections
      const sections = segmentSections(lines);

      // 3. Parse individual sections
      const education = parseEducation(sections.education || []);
      const experience = parseExperience(sections.experience || []);
      const projects = parseProjects(sections.projects || [], linkUrls);
      const skills = parseSkills(sections.skills || []);
      const certifications = parseCertifications(sections.certifications || [], linkUrls);
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
        state.personal.linkedinDisplay = 'LinkedIn';
      }

      const githubMatch = latexSource.match(/href\{(https?:\/\/(?:www\.)?github\.com\/[^}]+)\}/i);
      if (githubMatch) {
        state.personal.github = githubMatch[1].trim();
        state.personal.githubDisplay = 'GitHub';
      }

      const leetcodeMatch = latexSource.match(/href\{(https?:\/\/(?:www\.)?(?:leetcode|codeforces|kaggle)\.com\/[^}]+)\}/i);
      if (leetcodeMatch) {
        state.personal.leetcode = leetcodeMatch[1].trim();
        state.personal.leetcodeDisplay = getSiteDisplayName(leetcodeMatch[1], '', 'LeetCode');
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
     * Reads all text elements and link annotations across all pages, sorts by coordinates,
     * and returns structured text + all hyperlink destinations.
     */
    extractTextFromPdf: async function (pdfDataBuffer, progressCallback) {
      function decodeResumePayload(str) {
        if (!str || typeof str !== 'string') return null;
        const clean = str.trim();
        // 1. Try Base64 decoding
        try {
          let byteStr = '';
          if (typeof atob === 'function') {
            byteStr = atob(clean);
          } else if (typeof Buffer !== 'undefined') {
            byteStr = Buffer.from(clean, 'base64').toString('binary');
          }
          if (byteStr && byteStr.length > 0) {
            const percentStr = Array.from(byteStr).map(c => {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('');
            const decoded = JSON.parse(decodeURIComponent(percentStr));
            if (decoded && typeof decoded === 'object') return decoded;
          }
        } catch (b64Err) {}

        // 2. Try URI-percent decoding
        try {
          const decoded = JSON.parse(decodeURIComponent(clean));
          if (decoded && typeof decoded === 'object') return decoded;
        } catch (uriErr) {}

        // 3. Try raw JSON parse
        try {
          const decoded = JSON.parse(clean);
          if (decoded && typeof decoded === 'object') return decoded;
        } catch (rawErr) {}

        return null;
      }

      // 0. Instant lossless check on raw binary buffer for embedded Jake resume state
      try {
        let rawStr = '';
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(pdfDataBuffer)) {
          rawStr = pdfDataBuffer.toString('latin1');
        } else if (pdfDataBuffer instanceof ArrayBuffer) {
          const u8 = new Uint8Array(pdfDataBuffer);
          const decoder = new TextDecoder('latin1');
          rawStr = decoder.decode(u8);
        } else if (pdfDataBuffer && pdfDataBuffer.buffer instanceof ArrayBuffer) {
          const decoder = new TextDecoder('latin1');
          rawStr = decoder.decode(pdfDataBuffer);
        }

        const match = rawStr.match(/JAKE_RESUME_DATA:([A-Za-z0-9+/=%_\-.~]+)/);
        if (match && match[1]) {
          const parsedState = decodeResumePayload(match[1]);
          if (parsedState && (parsedState.personal || parsedState.education || parsedState.experience)) {
            if (progressCallback) progressCallback('100% Exact Jake Resume Data detected!');
            return {
              isEmbeddedPayload: true,
              embeddedState: parsedState,
              text: '',
              links: []
            };
          }
        }
      } catch (bufCheckErr) {
        console.warn('Raw buffer metadata check note:', bufCheckErr);
      }

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

      // Check PDF.js getMetadata for embedded payload
      try {
        const meta = await pdf.getMetadata().catch(() => null);
        if (meta && meta.info) {
          const candidate = meta.info.Keywords || meta.info.Subject;
          if (candidate && candidate.includes('JAKE_RESUME_DATA:')) {
            const match = candidate.match(/JAKE_RESUME_DATA:([A-Za-z0-9+/=%_\-.~]+)/);
            if (match && match[1]) {
              const parsedState = decodeResumePayload(match[1]);
              if (parsedState && (parsedState.personal || parsedState.education || parsedState.experience)) {
                return {
                  isEmbeddedPayload: true,
                  embeddedState: parsedState,
                  text: '',
                  links: []
                };
              }
            }
          }
        }
      } catch (metaErr) {
        console.warn('PDF.js metadata check note:', metaErr);
      }

      const numPages = pdf.numPages;
      let fullTextLines = [];
      const extractedLinks = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (progressCallback) progressCallback(`Processing page ${pageNum} of ${numPages}...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // 1. Extract link annotations from this page
        try {
          const annotations = await page.getAnnotations();
          if (Array.isArray(annotations)) {
            annotations.forEach(annot => {
              if (annot.subtype === 'Link') {
                const linkUrl = annot.url || annot.unsafeUrl || (annot.action && annot.action.uri);
                if (linkUrl && typeof linkUrl === 'string' && linkUrl.trim()) {
                  const clean = linkUrl.trim();
                  if (!extractedLinks.includes(clean)) {
                    extractedLinks.push(clean);
                  }
                }
              }
            });
          }
        } catch (annotErr) {
          console.warn('Could not extract PDF annotations on page ' + pageNum, annotErr);
        }

        // 2. Group items by horizontal and vertical coordinate (approximate lines)
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

      // 3. Fallback scan on raw binary buffer for uncompressed /URI definitions
      try {
        const rawUris = extractUrisFromPdfBuffer(pdfDataBuffer);
        rawUris.forEach(u => {
          if (!extractedLinks.includes(u)) {
            extractedLinks.push(u);
          }
        });
      } catch (bufErr) {
        // optional fallback
      }

      const textResult = fullTextLines.join('\n');

      if (textResult.trim().length === 0) {
        if (progressCallback) progressCallback('Image PDF detected. Running Smart OCR...');
        try {
          const ocrResult = await performPdfOcr(pdf, progressCallback);
          if (ocrResult && ocrResult.text && ocrResult.text.trim().length > 0) {
            return {
              text: ocrResult.text,
              links: extractedLinks.concat(ocrResult.links || []),
              isOcrExtraction: true,
              toString: function () { return this.text; }
            };
          }
        } catch (ocrErr) {
          console.error('OCR Fallback error:', ocrErr);
          throw new Error('This PDF has no selectable text layer and OCR scanning could not read the text (' + (ocrErr.message || ocrErr) + '). Please use the Backup JSON or paste your text directly into the "Paste Plain Text" tab.');
        }

        throw new Error('This PDF appears to be a blank or unreadable image. Please use the Backup JSON or paste your text directly into the "Paste Plain Text" tab.');
      }

      return {
        text: textResult,
        links: extractedLinks,
        toString: function () { return this.text; }
      };
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
   * Helper: Scan binary buffer for URI annotations (fallback)
   */
  function extractUrisFromPdfBuffer(buffer) {
    const urls = [];
    if (!buffer) return urls;
    try {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }

      const uriRegex = /\/URI\s*\(([^)]+)\)/g;
      let match;
      while ((match = uriRegex.exec(binary)) !== null) {
        const u = match[1].trim();
        if (!urls.includes(u)) urls.push(u);
      }

      const httpRegex = /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s<>()"'\\\/]*[^\s<>()"',;.]/g;
      while ((match = httpRegex.exec(binary)) !== null) {
        const u = match[0].trim();
        if (!urls.includes(u) && !u.includes('ams.org') && !u.includes('sil.org') && !u.includes('w3.org') && !u.includes('adobe.com')) {
          urls.push(u);
        }
      }
    } catch (e) {
      // ignore
    }
    return urls;
  }

  /**
   * 1. Extract Personal Contact Information
   * Extracts Name, Phone, Email, LinkedIn, GitHub, LeetCode, Portfolio
   * using text content and all extracted PDF hyperlink annotations.
   */
  function extractPersonalInfo(lines, rawText, linkUrls = []) {
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

    // Extract Email: first from rawText, then fallback to linkUrls
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = rawText.match(emailRegex);
    if (emailMatch) {
      personal.email = emailMatch[1].trim();
    } else if (linkUrls.length > 0) {
      const mailto = linkUrls.find(u => u.startsWith('mailto:'));
      if (mailto) {
        personal.email = mailto.replace(/^mailto:/i, '').trim();
      }
    }

    // Extract Phone (Supports +91 98765 43210, +1 (123) 456-7890, 10-digit numbers)
    const phoneRegex = /(?:\+?91[-.\s]*)?[6-9]\d{4}[-.\s]?\d{5}|(?:\+?\d{1,3}[-.\s]*)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b[6-9]\d{9}\b/;
    const phoneMatch = rawText.match(phoneRegex);
    if (phoneMatch) personal.phone = phoneMatch[0].trim();

    // Extract LinkedIn: first from rawText, then fallback to linkUrls
    const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i;
    const linkedinMatch = rawText.match(linkedinRegex);
    if (linkedinMatch) {
      personal.linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`;
      personal.linkedinDisplay = 'LinkedIn';
    } else if (linkUrls.length > 0) {
      const lnk = linkUrls.find(u => linkedinRegex.test(u));
      if (lnk) {
        const m = lnk.match(linkedinRegex);
        personal.linkedin = `https://linkedin.com/in/${m[1]}`;
        personal.linkedinDisplay = 'LinkedIn';
      }
    }

    // Extract GitHub: first from rawText, then fallback to linkUrls
    const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i;
    const githubMatch = rawText.match(githubRegex);
    if (githubMatch && !['sponsors', 'features', 'topics', 'trending'].includes(githubMatch[1].toLowerCase())) {
      personal.github = `https://github.com/${githubMatch[1]}`;
      personal.githubDisplay = 'GitHub';
    } else if (linkUrls.length > 0) {
      const gh = linkUrls.find(u => {
        const m = u.match(githubRegex);
        return m && !['sponsors', 'features', 'topics', 'trending'].includes(m[1].toLowerCase());
      });
      if (gh) {
        const m = gh.match(githubRegex);
        personal.github = `https://github.com/${m[1]}`;
        personal.githubDisplay = 'GitHub';
      }
    }

    // Extract LeetCode / Coding Profile: first from rawText, then fallback to linkUrls
    const leetcodeRegex = /(?:https?:\/\/)?(?:www\.)?(leetcode\.com\/(?:u\/)?[a-zA-Z0-9_-]+|codeforces\.com\/profile\/[a-zA-Z0-9_-]+|kaggle\.com\/[a-zA-Z0-9_-]+)/i;
    const leetcodeMatch = rawText.match(leetcodeRegex);
    if (leetcodeMatch) {
      const url = leetcodeMatch[0].startsWith('http') ? leetcodeMatch[0] : `https://${leetcodeMatch[0]}`;
      personal.leetcode = url;
      personal.leetcodeDisplay = getSiteDisplayName(url, '', 'LeetCode');
    } else if (linkUrls.length > 0) {
      const lc = linkUrls.find(u => leetcodeRegex.test(u));
      if (lc) {
        const m = lc.match(leetcodeRegex);
        const url = m[0].startsWith('http') ? m[0] : `https://${m[0]}`;
        personal.leetcode = url;
        personal.leetcodeDisplay = getSiteDisplayName(url, '', 'LeetCode');
      }
    }

    // Extract Portfolio URL (any generic link not matched above)
    const urlRegex = /(?:https?:\/\/)(?!linkedin|github|leetcode|codeforces|kaggle)([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]>]*)?)/gi;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(rawText)) !== null) {
      const found = urlMatch[0];
      if (!found.includes('@') && !found.includes('pdf') && !found.includes('coursera') && !found.includes('aws') && !found.includes('drive.google.com')) {
        personal.portfolio = found;
        personal.portfolioDisplay = 'Portfolio';
        break;
      }
    }
    if (!personal.portfolio && linkUrls.length > 0) {
      const portLink = linkUrls.find(u => {
        return /^https?:\/\//i.test(u) &&
               !u.includes('linkedin.com') &&
               !u.includes('github.com') &&
               !u.includes('leetcode.com') &&
               !u.includes('codeforces.com') &&
               !u.includes('kaggle.com') &&
               !u.includes('drive.google.com') &&
               !u.includes('coursera.org') &&
               !u.includes('credly.com') &&
               !u.includes('certmetrics.com');
      });
      if (portLink) {
        personal.portfolio = portLink;
        personal.portfolioDisplay = 'Portfolio';
      }
    }

    // Extract Candidate Name from top 5 lines
    const ignoreNames = /^(?:resume|curriculum\s+vitae|cv|contact|personal|profile|page\s+\d+|phone|email|linkedin|leetcode|github|education|experience|projects|skills|technical\s+skills)$/i;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].replace(/[|•,;].*$/, '').trim();
      // Name candidate: 2 to 4 words, alphabetic, no @ or digits, reasonable length, not an institution
      if (line.length >= 3 && line.length <= 40 && !ignoreNames.test(line) && !line.includes('@') && !/\d/.test(line) && !/\b(?:university|college|school|institute|academy|technologies|corporation|solutions|services)\b/i.test(line)) {
        // Strip titles like "Mr.", "Ms.", "Dr."
        personal.fullName = line.replace(/^(?:mr\.|ms\.|mrs\.|dr\.)\s+/i, '').trim();
        break;
      }
    }

    // Fallback Candidate Name inference if missing, corrupted, or matching an ignored header
    const isBadName = !personal.fullName || 
                      ignoreNames.test(personal.fullName.trim()) ||
                      personal.fullName.length < 3;
    if (isBadName) {
      let inferred = '';
      if (personal.linkedin) {
        const m = personal.linkedin.match(/in\/([a-zA-Z0-9_-]+)/i);
        if (m) {
          let handle = m[1].replace(/-(?:[0-9a-f]{6,}|[0-9]{5,}|[a-z0-9]{8,})$/i, '');
          inferred = handle.replace(/[-_.]+/g, ' ').trim();
        }
      }
      if (!inferred && personal.email) {
        const prefix = personal.email.split('@')[0];
        inferred = prefix.replace(/\d+/g, '').replace(/[._-]+/g, ' ').trim();
      }
      if (inferred) {
        personal.fullName = inferred.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
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
    const gpaRegex = /(?:CGPA\/Percentage|CGPA|GPA|Percentage|Score|Marks)\s*[:|]?\s*(\d{1,3}(?:\.\d+)?%?|\d(?:\.\d{1,2})?(?:\s*\/\s*(?:10|4)(?:\.0)?)?)|\b(\d{1,3}(?:\.\d+)?%|\d\.\d{1,2}\s*\/\s*(?:10|4)(?:\.0)?|\b[6-9]\.\d{1,2}\b)/i;
    const degreeKeywords = /Bachelor|Master|B\.?Tech|B\.?E\.?|B\.?Sc|B\.?S\.?|M\.?Tech|M\.?S\.?|High\s+School|Senior\s+Secondary|Secondary|Class\s+(?:X|XII|10|12)|\b10\s*th\b|\b12\s*th\b/i;

    let currentEdu = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const { dates, remaining } = extractDateFromLine(line);
      const hasDegree = degreeKeywords.test(line);
      const hasGpa = gpaRegex.test(line);
      const hasCoursework = /coursework|courses|relevant/i.test(line);

      // Case 1: Coursework line
      if (hasCoursework && currentEdu) {
        currentEdu.coursework = line.replace(/^(?:relevant\s+)?coursework:?\s*/i, '').trim();
        continue;
      }

      // Case 2: Detail line (Degree, Dates, GPA)
      if (currentEdu && (hasDegree || (dates && (hasGpa || line.length <= 90)))) {
        let deg = remaining;
        let gpa = '';

        const gpaMatch = line.match(gpaRegex);
        if (gpaMatch) {
          gpa = (gpaMatch[1] || gpaMatch[2] || '').trim();
          deg = deg.replace(gpaMatch[0], '').trim();
        }

        deg = deg.replace(/[|,]$/, '').replace(/^[|,]/, '').trim();
        deg = deg.replace(/\s*\|\s*$/, '').replace(/^\s*\|\s*/, '').trim();

        if (/^\b12\s*th\b/i.test(deg)) {
          deg = 'Class XII (Senior Secondary)';
        } else if (/^\b10\s*th\b/i.test(deg)) {
          deg = 'Class X (Secondary School)';
        }

        if (deg) currentEdu.degree = deg;
        if (dates && !currentEdu.dates) currentEdu.dates = dates;
        if (gpa && !currentEdu.gpa) currentEdu.gpa = gpa;
        continue;
      }

      // Case 3: New Institution line
      if (currentEdu) {
        education.push(currentEdu);
        currentEdu = null;
      }

      const { main, location } = extractOrgLocation(dates ? remaining : line);

      currentEdu = {
        institution: main || line,
        location: location || '',
        degree: '',
        dates: dates || '',
        gpa: '',
        coursework: ''
      };
    }

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
    let currentExp = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const isBullet = /^[•\-*+]\s+/.test(line) || /^(\d+\.|\([a-z]\))\s+/.test(line);
      const cleanLine = line.replace(/^[•\-*+]\s+|^(\d+\.|\([a-z]\))\s+/, '').trim();
      const { dates, remaining } = extractDateFromLine(line);

      // If line has dates and is not a bullet -> Header line!
      if (!isBullet && dates) {
        if (currentExp) experience.push(currentExp);

        let role = remaining.replace(/[|,\-–—\s]+$/, '').replace(/^[|,\-–—\s]+/, '').trim();
        let company = '';
        let location = '';

        // Check if Company and Role are on the same line (e.g. Company | Role | Location)
        const parts = role.split(/\s+[—–|\-]+\s+/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          company = parts[0];
          role = parts[1];
          if (parts.length >= 3) location = parts[2];
        }

        currentExp = {
          role: role || 'Role / Position',
          company: company,
          location: location,
          dates: dates,
          bullets: []
        };

        // Check if next line is Line 2 of Jake's header (Company + Location)
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const nextIsBullet = /^[•\-*+]\s+/.test(nextLine) || /^(\d+\.|\([a-z]\))\s+/.test(nextLine);
          const { dates: nextDates } = extractDateFromLine(nextLine);

          // If next line is not a bullet and has no dates -> it is Company & Location!
          if (!nextIsBullet && !nextDates && nextLine.length > 0 && nextLine.length <= 120) {
            i++; // Consume next line
            const { main: compMain, location: compLoc } = extractOrgLocation(nextLine);
            if (!currentExp.company) {
              currentExp.company = compMain || nextLine;
              currentExp.location = compLoc || '';
            }
          }
        }
        continue;
      }

      // Check for standalone header without date (e.g. separated by | or —)
      const hasSeparators = line.includes('—') || line.includes('–') || line.includes('|');
      if (!isBullet && hasSeparators && (currentExp === null || currentExp.bullets.length > 0)) {
        if (currentExp) experience.push(currentExp);
        const parts = line.split(/\s+[—–|\-]+\s+/).map(p => p.trim()).filter(Boolean);
        currentExp = {
          role: parts[1] || parts[0] || 'Software Engineer',
          company: parts[0] || 'Company',
          location: parts[2] || '',
          dates: '',
          bullets: []
        };
        continue;
      }

      // Bullet point or job details
      if (currentExp) {
        if (isBullet || cleanLine.length > 10) {
          currentExp.bullets.push(cleanLine);
        }
      }
    }

    if (currentExp) experience.push(currentExp);

    return experience.map(exp => ({
      role: exp.role || 'Software Development Intern',
      company: exp.company || 'Company / Organization',
      location: exp.location || '',
      dates: exp.dates || 'June 2023 -- Aug. 2023',
      bullets: exp.bullets.length > 0 ? exp.bullets : ['Contributed to key software engineering initiatives.']
    }));
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

      const { dates, remaining } = extractDateFromLine(line);
      const hasDate = Boolean(dates);

      // If this line is just a date line right after project title (before any bullets)
      if (currentProj && currentProj.bullets.length === 0 && !currentProj.dates && hasDate) {
        const pureText = remaining.replace(/[|,\-–—\s]+$/, '').trim();
        if (!pureText || pureText.length < 3) {
          currentProj.dates = dates;
          continue;
        }
      }

      const techInParen = line.match(/\(([^)]+)\)/);
      const hasSeparators = line.includes('|') || line.includes(' — ') || line.includes(' – ');

      const isLikelyProjectTitle = !isBullet && (
        currentProj === null ||
        techInParen ||
        hasDate ||
        hasSeparators ||
        (currentProj.bullets.length > 0 && !line.endsWith('.'))
      );

      if (isLikelyProjectTitle) {
        if (currentProj) projects.push(currentProj);

        let title = hasDate ? remaining : line;
        let techStack = '';
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
  function parseCertifications(rawLines, linkUrls = []) {
    if (!rawLines || rawLines.length === 0) return [];
    const lines = stitchSectionBullets(rawLines);
    const certs = [];

    const certLinks = (linkUrls || []).filter(u => /drive\.google\.com|coursera\.org|credly\.com|certmetrics\.com|verify|certificate/i.test(u));
    let linkIdx = 0;

    lines.forEach(line => {
      let clean = line.replace(/^[•\-*+\s]+/, '').trim();
      if (!clean || clean.length < 4) return;

      // Clean trailing link annotations like "Certificate", "[Certificate]", "Verify", etc.
      clean = clean.replace(/\s*(?:\[|\()?cert(?:ificate)?s?(?:\]|\))?$/i, '').trim();
      clean = clean.replace(/\s*(?:\[|\()?verify(?: certificate)?(?:\]|\))?$/i, '').trim();
      clean = clean.replace(/\s*(?:\[|\()?(?:view|link|credential)(?:\]|\))?$/i, '').trim();

      const { dates: date, remaining } = extractDateFromLine(clean);
      let name = remaining;
      let issuer = '';
      let url = '';

      // Check for any dash or separator: en-dash, em-dash, hyphen, pipe, or colon
      if (name.includes(' – ') || name.includes(' — ') || name.includes(' - ') || name.includes(' -- ') || name.includes(' | ')) {
        const parts = name.split(/\s+[—–|\-]+\s+/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          name = parts[0];
          issuer = parts.slice(1).join(' - ');
        }
      }

      name = name.replace(/\s*(?:\[|\()?cert(?:ificate)?s?(?:\]|\))?$/i, '').trim();
      if (issuer) {
        issuer = issuer.replace(/\s*(?:\[|\()?cert(?:ificate)?s?(?:\]|\))?$/i, '').trim();
      }

      if (linkIdx < certLinks.length) {
        url = certLinks[linkIdx++];
      }

      certs.push({
        name: name.replace(/[|,\-–—\s]+$/, '').trim(),
        issuer: issuer.replace(/[|,\-–—\s]+$/, '').trim(),
        date: date || '',
        credentialId: '',
        url: url
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
        const parts = clean.split(/\s+[—–\-]+\s+/);
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

    // 1. Check for bullet list format: \resumeItem{\textbf{Prefix} -- Rest \hfill \href{url}{\color{blue}Certificate}}
    const resumeItemRegex = /\\resumeItem\{([\s\S]*?)\}(?=\s*\\resumeItem|\s*\\resumeItemListEnd|$)/gi;
    let bMatch;
    while ((bMatch = resumeItemRegex.exec(latex)) !== null) {
      const itemBody = bMatch[1].trim();
      let name = '';
      let issuer = '';
      let date = '';
      let url = '';

      const hrefMatch = itemBody.match(/\\href\{([^}]+)\}\{([^}]+)\}/i);
      if (hrefMatch) {
        url = hrefMatch[1].trim();
      }

      const dateMatch = itemBody.match(/\\textit\{([^}]+)\}/i);
      if (dateMatch) {
        date = cleanLatexText(dateMatch[1]);
      }

      let mainText = itemBody
        .replace(/\\hfill[\s\S]*$/, '')
        .replace(/\\href\{[^}]+\}\{[^}]+\}/g, '')
        .trim();

      const boldMatch = mainText.match(/\\textbf\{([^}]+)\}/i);
      if (boldMatch) {
        name = cleanLatexText(boldMatch[1]);
        const afterBold = mainText.replace(boldMatch[0], '').replace(/^[\s\-–—:]+/, '').trim();
        if (afterBold) {
          issuer = cleanLatexText(afterBold);
        }
      } else {
        name = cleanLatexText(mainText);
      }

      if (name) {
        list.push({
          name: name.trim(),
          issuer: issuer.trim(),
          date: date.trim(),
          credentialId: '',
          url: url
        });
      }
    }

    if (list.length > 0) return list;

    // Fallback: older \textbf{...} -- ... \hfill \textit{...}
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

  ResumeParser.cleanUrlDisplay = cleanUrlDisplay;
  ResumeParser.getSiteDisplayName = getSiteDisplayName;

  return ResumeParser;
}));
