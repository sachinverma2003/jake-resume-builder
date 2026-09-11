# Jake's Resume LaTeX Builder 🚀

A modern, web-based builder for the industry-standard **Jake Gutierrez LaTeX Resume**, designed specifically for **B.Tech campus placements, SDE, AI/ML, and tech roles**.

Live Demo: [https://sachinverma2003.github.io/jake-resume-builder/](https://sachinverma2003.github.io/jake-resume-builder/)

---

## ✨ Features
- **Authentic Jake Gutierrez Format**: Single-column ATS format with Computer Modern typography and 0.5-inch margins.
- **Clickable Social & Certificate Links**: Generates error-free `\href{...}` links with automated escaping of special characters (`$`, `&`, `%`, `_`, `#`).
- **1-Click Clean PDF Export**: Directly downloads an Overleaf-standard PDF without browser print headers, dates, URLs, or footers.
- **Direct Overleaf Integration**: 1-click button to open and compile directly in Overleaf without manual copying.
- **Smart 1-Page Height Detection & Auto-Fit**: Real-time ATS compliance validation and spacing compaction.
- **Placement-Ready Presets**:
  1. Jake Ryan (Original Standard Template)
  2. B.Tech CSE / SDE Profile (NIT Trichy)
  3. AI / ML & Data Science (IIT Kharagpur)
  4. Fresher / Campus Placements (VIT)

---

## 🛠️ Tech Stack
- **HTML5 & Vanilla CSS**: Custom modern dark studio theme with high-contrast scrollbars and exact LaTeX paper sizing.
- **Pure JavaScript**: Reactive state management, regex escaping, and DOM syncing.
- **html2pdf.js**: Standalone client-side PDF generation at 2.5x retina resolution.

---

## 🚀 How to Run Locally
```bash
# Clone the repository
git clone https://github.com/sachinverma2003/jake-resume-builder.git
cd jake-resume-builder

# Run with any static server
python -m http.server 5173
```
Then open `http://localhost:5173` in your browser.
