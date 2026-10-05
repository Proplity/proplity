// Auto-generated from docs/proplity-guide.html
export const guideStyles = "\n:root {\n  --bg: #0a0f1e;\n  --surface: #111827;\n  --surface2: #1a2235;\n  --border: #1e2d45;\n  --accent: #3b82f6;\n  --accent2: #8b5cf6;\n  --accent3: #10b981;\n  --text: #e2e8f0;\n  --text-muted: #94a3b8;\n  --warn: #f59e0b;\n  --danger: #ef4444;\n  --success: #10b981;\n  --radius: 12px;\n  --shadow: 0 4px 24px rgba(0,0,0,0.4);\n}\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody {\n  background: var(--bg);\n  color: var(--text);\n  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;\n  font-size: 15px;\n  line-height: 1.7;\n}\n@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');\n\n/* LAYOUT */\n.layout { display: flex; min-height: 100vh; }\n.sidebar {\n  width: 280px;\n  min-width: 280px;\n  background: var(--surface);\n  border-right: 1px solid var(--border);\n  padding: 24px 16px;\n  position: sticky;\n  top: 0;\n  height: 100vh;\n  overflow-y: auto;\n  scrollbar-width: thin;\n}\n.main { flex: 1; padding: 48px 56px; max-width: 960px; }\n\n/* SIDEBAR */\n.sidebar-logo {\n  display: flex; align-items: center; gap: 10px;\n  font-size: 18px; font-weight: 800;\n  color: var(--text);\n  margin-bottom: 32px;\n  padding: 0 8px;\n}\n.sidebar-logo span { \n  background: linear-gradient(135deg, var(--accent), var(--accent2));\n  -webkit-background-clip: text; -webkit-text-fill-color: transparent;\n}\n.sidebar-section { margin-bottom: 24px; }\n.sidebar-section-title {\n  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;\n  text-transform: uppercase; color: var(--text-muted);\n  padding: 0 8px; margin-bottom: 8px;\n}\n.sidebar-link {\n  display: block; padding: 7px 12px; border-radius: 8px;\n  color: var(--text-muted); text-decoration: none;\n  font-size: 13px; transition: all 0.15s; margin-bottom: 2px;\n  border: 1px solid transparent;\n}\n.sidebar-link:hover { background: var(--surface2); color: var(--text); border-color: var(--border); }\n.sidebar-link.active { background: rgba(59,130,246,0.15); color: var(--accent); border-color: rgba(59,130,246,0.3); }\n\n/* HEADER BANNER */\n.hero-banner {\n  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);\n  border: 1px solid var(--border);\n  border-radius: 20px;\n  padding: 48px 56px;\n  margin-bottom: 48px;\n  position: relative;\n  overflow: hidden;\n}\n.hero-banner::before {\n  content: '';\n  position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;\n  background: radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.15) 0%, transparent 60%),\n              radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.1) 0%, transparent 60%);\n}\n.hero-banner h1 {\n  font-size: 36px; font-weight: 800; position: relative;\n  background: linear-gradient(135deg, #fff 0%, var(--accent) 100%);\n  -webkit-background-clip: text; -webkit-text-fill-color: transparent;\n  margin-bottom: 12px;\n}\n.hero-banner p { color: var(--text-muted); font-size: 16px; position: relative; max-width: 600px; }\n.hero-meta { display: flex; gap: 24px; margin-top: 24px; position: relative; flex-wrap: wrap; }\n.hero-badge {\n  display: flex; align-items: center; gap: 8px;\n  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);\n  border-radius: 100px; padding: 6px 16px; font-size: 13px;\n}\n\n/* SECTION HEADERS */\n.section-header {\n  display: flex; align-items: center; gap: 14px;\n  padding: 20px 24px; border-radius: var(--radius);\n  margin: 48px 0 24px; border-left: 4px solid var(--accent);\n  background: linear-gradient(90deg, rgba(59,130,246,0.08), transparent);\n}\n.section-icon { font-size: 28px; }\n.section-title { font-size: 22px; font-weight: 700; }\n.section-subtitle { color: var(--text-muted); font-size: 13px; margin-top: 2px; }\n\n/* STEP CARDS */\n.step-card {\n  background: var(--surface);\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  padding: 28px 32px;\n  margin-bottom: 24px;\n  transition: border-color 0.2s;\n}\n.step-card:hover { border-color: rgba(59,130,246,0.3); }\n.step-num {\n  display: inline-flex; align-items: center; justify-content: center;\n  width: 28px; height: 28px; border-radius: 8px;\n  background: linear-gradient(135deg, var(--accent), var(--accent2));\n  font-size: 12px; font-weight: 700; margin-right: 10px; flex-shrink: 0;\n}\n.step-card h3 {\n  display: flex; align-items: center;\n  font-size: 17px; font-weight: 700; margin-bottom: 14px;\n  padding-bottom: 12px; border-bottom: 1px solid var(--border);\n}\n.step-card p { color: var(--text-muted); margin-bottom: 14px; }\n.step-card ul, .step-card ol { padding-left: 20px; color: var(--text-muted); }\n.step-card li { margin-bottom: 6px; }\n.step-card strong { color: var(--text); }\n\n/* WHAT YOU SEE BOX */\n.what-box {\n  background: var(--surface2);\n  border: 1px solid var(--border);\n  border-radius: 10px;\n  padding: 16px 20px;\n  margin: 14px 0;\n}\n.what-box-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); margin-bottom: 10px; }\n.what-box ul { list-style: none; padding: 0; }\n.what-box li { padding: 4px 0; color: var(--text-muted); font-size: 14px; }\n.what-box li::before { content: \"\u203a \"; color: var(--accent); font-weight: 700; }\n\n/* SCREENSHOTS - ENLARGED DISPLAY */\n.screenshot-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));\n  gap: 24px;\n  margin: 24px 0 32px 0;\n}\n.screenshot-item {\n  background: var(--surface2);\n  border: 1px solid var(--border);\n  border-radius: 14px;\n  overflow: hidden;\n  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);\n  cursor: pointer;\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);\n}\n.screenshot-item:hover {\n  transform: translateY(-4px);\n  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(59, 130, 246, 0.4);\n  border-color: var(--accent);\n}\n.screenshot-item:hover .zoom-badge {\n  opacity: 1;\n  transform: translateY(0);\n}\n.screenshot-item img {\n  width: 100%;\n  height: auto;\n  min-height: 240px;\n  max-height: 480px;\n  object-fit: contain;\n  object-position: top center;\n  display: block;\n  background: #060a14;\n  transition: transform 0.25s ease;\n}\n.screenshot-item:hover img {\n  transform: scale(1.015);\n}\n.zoom-badge {\n  position: absolute;\n  top: 14px;\n  right: 14px;\n  background: rgba(15, 23, 42, 0.85);\n  backdrop-filter: blur(8px);\n  color: #fff;\n  font-size: 12px;\n  font-weight: 600;\n  padding: 6px 12px;\n  border-radius: 20px;\n  border: 1px solid rgba(255, 255, 255, 0.18);\n  opacity: 0;\n  transform: translateY(-4px);\n  transition: all 0.2s ease;\n  pointer-events: none;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);\n  z-index: 2;\n}\n.screenshot-label {\n  padding: 12px 16px;\n  font-size: 13px;\n  color: var(--text);\n  border-top: 1px solid var(--border);\n  background: rgba(17, 24, 39, 0.95);\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n.screenshot-label .badge {\n  display: inline-block; padding: 2px 8px; border-radius: 4px;\n  font-size: 10px; font-weight: 700; margin-left: 6px;\n}\n.badge-desktop { background: rgba(59,130,246,0.2); color: var(--accent); }\n.badge-tablet { background: rgba(139,92,246,0.2); color: var(--accent2); }\n.badge-mobile { background: rgba(16,185,129,0.2); color: var(--accent3); }\n\n/* STEPS LIST */\n.steps-list { list-style: none; padding: 0; margin: 16px 0; }\n.steps-list li {\n  display: flex; gap: 14px; padding: 12px 0;\n  border-bottom: 1px solid var(--border);\n}\n.steps-list li:last-child { border-bottom: none; }\n.step-dot {\n  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;\n  background: linear-gradient(135deg, var(--accent), var(--accent2));\n  display: flex; align-items: center; justify-content: center;\n  font-size: 11px; font-weight: 700;\n}\n.step-content { flex: 1; }\n.step-label { font-weight: 600; color: var(--text); font-size: 14px; }\n.step-desc { color: var(--text-muted); font-size: 13px; margin-top: 3px; }\n\n/* ALERTS */\n.alert {\n  border-radius: 10px; padding: 14px 18px; margin: 16px 0;\n  display: flex; gap: 12px; align-items: flex-start; font-size: 14px;\n}\n.alert-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }\n.alert-warn { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; }\n.alert-info { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); color: #93c5fd; }\n.alert-success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; }\n.alert-security { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }\n\n/* TABLES */\ntable { width: 100%; border-collapse: collapse; margin: 16px 0; }\nth { background: var(--surface2); padding: 10px 14px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); text-align: left; border-bottom: 1px solid var(--border); }\ntd { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 14px; }\ntr:last-child td { border-bottom: none; }\ncode { background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 5px; font-family: monospace; font-size: 13px; color: #e2e8f0; }\n\n/* CROSS-REF LINKS */\n.cross-ref {\n  display: inline-flex; align-items: center; gap: 6px;\n  background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3);\n  color: var(--accent2); border-radius: 6px; padding: 3px 10px;\n  font-size: 12px; font-weight: 600; text-decoration: none; margin: 4px 2px;\n  transition: all 0.15s;\n}\n.cross-ref:hover { background: rgba(139,92,246,0.2); }\n\n/* LIFECYCLE DIAGRAM */\n.lifecycle {\n  background: var(--surface2);\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  padding: 24px 32px; margin: 24px 0;\n}\n.lifecycle-title { font-weight: 700; font-size: 16px; margin-bottom: 20px; }\n.lifecycle-row {\n  display: grid; grid-template-columns: 180px 1fr 180px;\n  gap: 16px; align-items: center; padding: 10px 0;\n  border-bottom: 1px dashed var(--border);\n}\n.lifecycle-row:last-child { border-bottom: none; }\n.lifecycle-actor { font-size: 13px; font-weight: 600; }\n.lifecycle-action {\n  display: flex; align-items: center; gap: 10px;\n  font-size: 13px; color: var(--text-muted);\n}\n.lifecycle-arrow { color: var(--accent); font-weight: 700; }\n\n/* RESPONSIVE GRID */\n.resp-grid {\n  display: grid; grid-template-columns: repeat(3, 1fr);\n  gap: 12px; margin: 16px 0;\n}\n.resp-card {\n  background: var(--surface2); border: 1px solid var(--border);\n  border-radius: 10px; padding: 16px; text-align: center;\n}\n.resp-card .bp { font-size: 22px; font-weight: 800; color: var(--accent); }\n.resp-card .label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }\n\n/* ROLE BADGE */\n.role-badge {\n  display: inline-block; padding: 4px 14px; border-radius: 100px;\n  font-size: 12px; font-weight: 700; margin: 0 4px;\n}\n.role-tenant { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }\n.role-landlord { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }\n.role-manager { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }\n.role-vendor { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }\n.role-admin { background: rgba(139,92,246,0.15); color: #a78bfa; border: 1px solid rgba(139,92,246,0.3); }\n\n/* DIVIDER */\nhr { border: none; border-top: 1px solid var(--border); margin: 40px 0; }\n\n/* PRINT - ENLARGED FOR HIGH RESOLUTION PDF */\n@media print {\n  .sidebar, .zoom-badge, #lightbox { display: none !important; }\n  .layout { display: block !important; }\n  .main { padding: 10px !important; max-width: 100% !important; }\n  .hero-banner { padding: 32px 36px !important; margin-bottom: 30px !important; }\n  .hero-banner h1 { font-size: 28px !important; }\n  .screenshot-grid {\n    display: block !important;\n    margin: 20px 0 !important;\n  }\n  .screenshot-item {\n    display: block !important;\n    page-break-inside: avoid !important;\n    break-inside: avoid !important;\n    margin-bottom: 30px !important;\n    border: 1px solid #2d3b55 !important;\n    border-radius: 10px !important;\n    background: #111827 !important;\n    box-shadow: none !important;\n  }\n  .screenshot-item img {\n    width: 100% !important;\n    height: auto !important;\n    max-height: 660px !important;\n    object-fit: contain !important;\n    display: block !important;\n    margin: 0 auto !important;\n    background: #060a14 !important;\n    transform: none !important;\n  }\n  .screenshot-label {\n    font-size: 13px !important;\n    padding: 12px 16px !important;\n    color: #e2e8f0 !important;\n    border-top: 1px solid #2d3b55 !important;\n    background: #1a2235 !important;\n  }\n  .step-card {\n    page-break-inside: auto !important;\n    break-inside: auto !important;\n    margin-bottom: 36px !important;\n  }\n  .section-header {\n    page-break-before: always !important;\n    break-before: always !important;\n    padding-top: 16px !important;\n    margin-top: 24px !important;\n  }\n}\n\n@media (max-width: 900px) {\n  .sidebar { display: none; }\n  .main { padding: 24px 20px; }\n  .resp-grid { grid-template-columns: 1fr; }\n  .hero-banner { padding: 28px 24px; }\n  .hero-banner h1 { font-size: 26px; }\n}\n\n/* FULLSCREEN CAROUSEL LIGHTBOX */\n.lightbox {\n  position: fixed;\n  top: 0; left: 0; right: 0; bottom: 0;\n  width: 100vw; height: 100vh;\n  z-index: 99999;\n  display: flex;\n  flex-direction: column;\n  user-select: none;\n  animation: lbFadeIn 0.2s ease-out;\n}\n@keyframes lbFadeIn {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n.lightbox-backdrop {\n  position: absolute;\n  top: 0; left: 0; right: 0; bottom: 0;\n  background: rgba(5, 8, 16, 0.94);\n  backdrop-filter: blur(14px);\n  z-index: 1;\n}\n.lightbox-header {\n  position: relative;\n  z-index: 10;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 16px 28px;\n  background: linear-gradient(180deg, rgba(10, 15, 30, 0.9) 0%, transparent 100%);\n}\n.lightbox-title-box {\n  display: flex;\n  align-items: center;\n  gap: 14px;\n}\n.lightbox-counter {\n  background: linear-gradient(135deg, var(--accent), var(--accent2));\n  color: #fff;\n  padding: 4px 12px;\n  border-radius: 20px;\n  font-size: 13px;\n  font-weight: 700;\n  letter-spacing: 0.05em;\n  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.4);\n}\n.lightbox-title {\n  color: #f1f5f9;\n  font-size: 15px;\n  font-weight: 600;\n  max-width: 65vw;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.lightbox-controls {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n.lightbox-btn {\n  background: rgba(255, 255, 255, 0.08);\n  border: 1px solid rgba(255, 255, 255, 0.18);\n  color: #e2e8f0;\n  padding: 8px 16px;\n  border-radius: 8px;\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n  text-decoration: none;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  transition: all 0.18s ease;\n}\n.lightbox-btn:hover {\n  background: rgba(255, 255, 255, 0.18);\n  color: #fff;\n  border-color: rgba(255, 255, 255, 0.35);\n  transform: translateY(-1px);\n}\n.lightbox-btn-close {\n  background: rgba(239, 68, 68, 0.2);\n  border-color: rgba(239, 68, 68, 0.4);\n  color: #fca5a5;\n  font-size: 16px;\n  padding: 8px 18px;\n}\n.lightbox-btn-close:hover {\n  background: rgba(239, 68, 68, 0.4);\n  color: #fff;\n  border-color: rgba(239, 68, 68, 0.7);\n}\n.lightbox-stage {\n  position: relative;\n  z-index: 5;\n  flex: 1;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0 20px;\n  overflow: hidden;\n}\n.lightbox-nav-btn {\n  background: rgba(17, 24, 39, 0.75);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  color: #fff;\n  width: 56px;\n  height: 56px;\n  border-radius: 50%;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);\n  backdrop-filter: blur(10px);\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);\n  flex-shrink: 0;\n  z-index: 10;\n}\n.lightbox-nav-btn:hover {\n  background: var(--accent);\n  border-color: var(--accent);\n  transform: scale(1.1);\n  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.6);\n}\n.lightbox-nav-btn:active {\n  transform: scale(0.96);\n}\n.lightbox-image-wrap {\n  flex: 1;\n  height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 10px 24px;\n  max-width: calc(100vw - 160px);\n}\n.lightbox-image-wrap img {\n  max-width: 100%;\n  max-height: 80vh;\n  object-fit: contain;\n  border-radius: 10px;\n  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.85);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  transition: transform 0.2s ease, opacity 0.15s ease;\n  background: #050810;\n}\n.lightbox-footer {\n  position: relative;\n  z-index: 10;\n  padding: 14px 24px;\n  text-align: center;\n  background: linear-gradient(0deg, rgba(10, 15, 30, 0.9) 0%, transparent 100%);\n}\n.lightbox-hint {\n  font-size: 13px;\n  color: var(--text-muted);\n}\n.lightbox-hint strong {\n  color: var(--accent);\n  background: rgba(59, 130, 246, 0.15);\n  padding: 2px 7px;\n  border-radius: 4px;\n}\n\n";

export const guideBodyHtml = "\n<div class=\"layout\">\n<nav class=\"sidebar\">\n  <div class=\"sidebar-logo\">\ud83c\udfe0 <span>Proplity</span> Guide</div>\n  <div class=\"sidebar-section\">\n    <div class=\"sidebar-section-title\">Getting Started</div>\n    <a href=\"#setup\" class=\"sidebar-link\">\u2699\ufe0f Platform Setup</a>\n    <a href=\"#visitor\" class=\"sidebar-link\">\ud83c\udf0d Visitor / Public</a>\n  </div>\n  <div class=\"sidebar-section\">\n    <div class=\"sidebar-section-title\">User Roles</div>\n    <a href=\"#tenant\" class=\"sidebar-link\">\ud83c\udfe0 Tenant</a>\n    <a href=\"#landlord\" class=\"sidebar-link\">\ud83c\udfd7 Landlord</a>\n    <a href=\"#manager\" class=\"sidebar-link\">\ud83d\udc54 Property Manager</a>\n    <a href=\"#vendor\" class=\"sidebar-link\">\ud83d\udd27 Vendor / Service</a>\n    <a href=\"#admin\" class=\"sidebar-link\">\ud83d\udee1 Admin</a>\n  </div>\n  <div class=\"sidebar-section\">\n    <div class=\"sidebar-section-title\">Workflows</div>\n    <a href=\"#lifecycle\" class=\"sidebar-link\">\ud83d\udd00 Full Lifecycle</a>\n    <a href=\"#responsive\" class=\"sidebar-link\">\ud83d\udcf1 Responsive Design</a>\n  </div>\n  <div class=\"sidebar-section\">\n    <div class=\"sidebar-section-title\">Quick Reference</div>\n    <a href=\"#accounts\" class=\"sidebar-link\">\ud83d\udd11 Test Accounts</a>\n  </div>\n</nav>\n<main class=\"main\">\n\n<!-- HERO -->\n<div class=\"hero-banner\">\n  <h1>Proplity Complete Guide</h1>\n  <p>Step-by-step visual walkthrough of every page, feature, role, and workflow \u2014 in plain language anyone can understand.</p>\n  <div class=\"hero-meta\">\n    <span class=\"hero-badge\">\ud83d\udcc5 Updated: 2026-10-04</span>\n    <span class=\"hero-badge\">\ud83d\udcf8 100+ Screenshots</span>\n    <span class=\"hero-badge\">\ud83d\udc65 6 Roles Covered</span>\n    <span class=\"hero-badge\">\ud83d\udcf1 3 Screen Sizes</span>\n  </div>\n</div>\n\n\n<!-- WHAT IS PROPLITY -->\n<h2 style=\"font-size:24px;font-weight:800;margin-bottom:16px;\">What is Proplity?</h2>\n<p style=\"color:var(--text-muted);margin-bottom:20px;\">Proplity is an all-in-one property management platform built for the Nigerian real estate market. Think of it like a <strong style=\"color:var(--text)\">digital property office</strong> that connects everyone involved in renting a home.</p>\n\n<div class=\"resp-grid\" style=\"grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0;\">\n  <div class=\"resp-card\"><div class=\"bp\">\ud83c\udfe0</div><div class=\"label\" style=\"color:var(--text);font-weight:600;margin-top:6px;\">Tenant</div><div class=\"label\">Pays rent, reports repairs, manages lease</div></div>\n  <div class=\"resp-card\"><div class=\"bp\">\ud83c\udfd7</div><div class=\"label\" style=\"color:var(--text);font-weight:600;margin-top:6px;\">Landlord</div><div class=\"label\">Owns properties, tracks revenue</div></div>\n  <div class=\"resp-card\"><div class=\"bp\">\ud83d\udc54</div><div class=\"label\" style=\"color:var(--text);font-weight:600;margin-top:6px;\">Manager</div><div class=\"label\">Runs daily operations for landlords</div></div>\n  <div class=\"resp-card\"><div class=\"bp\">\ud83d\udd27</div><div class=\"label\" style=\"color:var(--text);font-weight:600;margin-top:6px;\">Vendor</div><div class=\"label\">Fulfils repair and maintenance jobs</div></div>\n  <div class=\"resp-card\"><div class=\"bp\">\ud83d\udee1</div><div class=\"label\" style=\"color:var(--text);font-weight:600;margin-top:6px;\">Admin</div><div class=\"label\">Oversees the entire platform</div></div>\n</div>\n\n<hr>\n\n<!-- ACCOUNTS TABLE -->\n<h2 id=\"accounts\" style=\"font-size:20px;font-weight:700;margin-bottom:16px;\">\ud83d\udd11 Quick Reference: Test Login Accounts</h2>\n<table>\n<thead><tr><th>Role</th><th>Email</th><th>Password</th><th>Primary Purpose</th></tr></thead>\n<tbody>\n<tr><td><span class=\"role-badge role-tenant\">Tenant</span></td><td><code>tenant@proplity.com</code></td><td><code>Password123!</code></td><td>Pay rent, report repairs, view lease</td></tr>\n<tr><td><span class=\"role-badge role-landlord\">Landlord</span></td><td><code>landlord@proplity.com</code></td><td><code>Password123!</code></td><td>Manage portfolio, track revenue</td></tr>\n<tr><td><span class=\"role-badge role-manager\">Manager</span></td><td><code>manager@proplity.com</code></td><td><code>Password123!</code></td><td>Daily operations for landlords</td></tr>\n<tr><td><span class=\"role-badge role-vendor\">Vendor</span></td><td><code>vendor@proplity.com</code></td><td><code>Password123!</code></td><td>Complete repair jobs, submit invoices</td></tr>\n<tr><td><span class=\"role-badge role-admin\">Admin</span></td><td><code>admin@proplity.com</code></td><td><code>Password123!</code></td><td>Platform governance and oversight</td></tr>\n</tbody>\n</table>\n\n<hr>\n\n<!-- SETUP SECTION -->\n<div id=\"setup\" class=\"section-header\">\n  <span class=\"section-icon\">\ud83c\udfc1</span>\n  <div>\n    <div class=\"section-title\">First-Time Platform Setup</div>\n    <div class=\"section-subtitle\">Super Admin Bootstrap \u2014 one-time only \u2014 done before anyone else can use the platform</div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">0</span>The Setup Page <code>/setup</code></h3>\n  <p>When Proplity is installed for the very first time, there are <strong>no admin accounts at all</strong>. The <code>/setup</code> page is a special one-time wizard to create the first \"super admin\" account. After the first admin is created, this page permanently disables itself for security \u2014 it can never be used again.</p>\n  \n  <div class=\"alert alert-warn\">\n    <span class=\"alert-icon\">\u26a0\ufe0f</span>\n    <div>If you navigate to <code>/setup</code> and get redirected to the login page, the platform was already set up. The super admin already exists.</div>\n  </div>\n\n  <div class=\"what-box\">\n    <div class=\"what-box-title\">What you see on the setup form</div>\n    <ul>\n      <li>Full name field for the first admin account</li>\n      <li>Email address (becomes the admin login email)</li>\n      <li>Password (must be strong \u2014 letters, numbers, symbols)</li>\n      <li>A single \"Create Admin Account\" submit button</li>\n    </ul>\n  </div>\n\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div>\n      <img src=\"/screenshots/setup_01_setup_page_desktop.png\" alt=\"Setup page \u2014 if already done, redirects to login\" onerror=\"this.style.background='#1a2235';this.style.height='180px';this.alt='Screenshot: setup_01_setup_page_desktop.png'\">\n      <div class=\"screenshot-label\">Setup page / redirect to login <span class=\"badge badge-desktop\">Desktop</span></div>\n    </div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div>\n      <img src=\"/screenshots/setup_01b_setup_complete.png\" alt=\"Setup already complete\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\">\n      <div class=\"screenshot-label\">Setup already complete \u2014 login redirect <span class=\"badge badge-desktop\">Desktop</span></div>\n    </div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div>\n      <img src=\"/screenshots/setup_01_setup_page_mobile.png\" alt=\"Setup page mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\">\n      <div class=\"screenshot-label\">Setup page <span class=\"badge badge-mobile\">Mobile 390px</span></div>\n    </div>\n  </div>\n\n  <h4 style=\"margin:20px 0 12px;font-size:15px;\">Step-by-step setup instructions:</h4>\n  <ol class=\"steps-list\" style=\"list-style:decimal;padding-left:20px;\">\n    <li style=\"margin-bottom:8px;color:var(--text-muted);\">Open <code>http://yourdomain.com/setup</code> (or <code>http://localhost:3000/setup</code> in development)</li>\n    <li style=\"margin-bottom:8px;color:var(--text-muted);\">If the form appears, fill in your <strong style=\"color:var(--text)\">Full Name</strong>, <strong style=\"color:var(--text)\">Email</strong>, and a strong <strong style=\"color:var(--text)\">Password</strong></li>\n    <li style=\"margin-bottom:8px;color:var(--text-muted);\">Click <strong style=\"color:var(--text)\">Create Admin Account</strong></li>\n    <li style=\"margin-bottom:8px;color:var(--text-muted);\">You'll be redirected to the login page automatically</li>\n    <li style=\"margin-bottom:8px;color:var(--text-muted);\">Log in with the email and password you just set</li>\n    <li style=\"margin-bottom:8px;color:var(--text-muted);\">\ud83c\udf89 You are now inside the Admin Dashboard \u2014 setup is complete!</li>\n  </ol>\n\n  <div class=\"alert alert-security\">\n    <span class=\"alert-icon\">\ud83d\udd10</span>\n    <div><strong>Security note:</strong> This page cannot be accessed again after setup. To reset admin access, a developer must modify the database directly.</div>\n  </div>\n</div>\n\n<hr>\n\n<!-- VISITOR SECTION -->\n<div id=\"visitor\" class=\"section-header\" style=\"border-left-color:#10b981;\">\n  <span class=\"section-icon\">\ud83c\udf0d</span>\n  <div>\n    <div class=\"section-title\">Visitor / Public Experience</div>\n    <div class=\"section-subtitle\">No login required \u2014 anyone who opens the website</div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">1.1</span>The Homepage</h3>\n  <p>The very first thing anyone sees when they visit Proplity. Designed to immediately showcase what the platform is about and display real rental properties across Nigerian cities like Lagos, Abuja, and Port Harcourt.</p>\n  <div class=\"what-box\">\n    <div class=\"what-box-title\">What you see</div>\n    <ul>\n      <li>A large hero banner with \"Get Started\" and \"Browse Properties\" buttons</li>\n      <li>A \"How it works\" section (step-by-step for tenants and landlords)</li>\n      <li>Featured Properties section with real cards pulled from the live database</li>\n      <li>Platform trust badges and statistics</li>\n    </ul>\n  </div>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_01_homepage_desktop.png\" alt=\"Homepage desktop\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Homepage (full) <span class=\"badge badge-desktop\">Desktop 1400px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_01_homepage_tablet.png\" alt=\"Homepage tablet\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Homepage <span class=\"badge badge-tablet\">Tablet 768px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_01_homepage_mobile.png\" alt=\"Homepage mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Homepage <span class=\"badge badge-mobile\">Mobile 390px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_01b_homepage_hero_desktop.png\" alt=\"Hero section\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Hero / Banner section <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_01c_homepage_features_desktop.png\" alt=\"Features section\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">How it works section <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_01d_homepage_properties_desktop.png\" alt=\"Featured properties\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Featured Properties section <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">1.2</span>Property Preview Modal (Pop-up Card)</h3>\n  <p>When you click a property card on the homepage, a <strong>modal</strong> (pop-up overlay) appears \u2014 letting you quickly preview a property without leaving the homepage. Click left/right arrows to browse multiple properties. Press <strong>Esc</strong> or click outside to close.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_02_property_modal_desktop.png\" alt=\"Property modal\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property preview modal (1st property) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_02b_property_modal_slide2_desktop.png\" alt=\"Property modal slide 2\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property modal (2nd property \u2014 arrow navigation) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">1.3</span>Full Property Detail Page</h3>\n  <p>The complete page for a single rental property. Everything a prospective tenant needs to decide if they want to apply \u2014 photos, amenities, neighbourhood scores, and action buttons.</p>\n  <div class=\"what-box\">\n    <div class=\"what-box-title\">What you see</div>\n    <ul>\n      <li>High-resolution photo gallery at the top</li>\n      <li>Property name, location (area + city), and rent price</li>\n      <li>Full description from the landlord or manager</li>\n      <li>Complete amenities list (power, water, security, internet, parking...)</li>\n      <li>Neighbourhood metrics scored out of 10: Safety, Flood Risk, Road Infrastructure</li>\n      <li><strong>Schedule a Viewing</strong> and <strong>Apply for this Property</strong> buttons</li>\n    </ul>\n  </div>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_03_property_detail_desktop.png\" alt=\"Property detail desktop\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property detail (top) <span class=\"badge badge-desktop\">Desktop 1400px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_03b_property_detail_scroll_desktop.png\" alt=\"Property detail scrolled\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property detail (scrolled \u2014 amenities + scores) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_03_property_detail_tablet.png\" alt=\"Property detail tablet\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property detail <span class=\"badge badge-tablet\">Tablet 768px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_03_property_detail_mobile.png\" alt=\"Property detail mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property detail <span class=\"badge badge-mobile\">Mobile 390px</span></div></div>\n  </div>\n  <div class=\"alert alert-info\" style=\"margin-top:16px;\">\n    <span class=\"alert-icon\">\u2139\ufe0f</span>\n    <div><strong>Cross-reference:</strong> When a logged-in tenant views this page, the \"Apply\" button becomes fully active. <a href=\"#tenant-apply\" class=\"cross-ref\">\u2192 See Tenant: Apply for Property</a></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">1.4</span>Login Page</h3>\n  <p>The sign-in page for all registered users. After login, each role is automatically sent to the right dashboard.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_04_login_desktop.png\" alt=\"Login desktop\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Login page <span class=\"badge badge-desktop\">Desktop 1400px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_04_login_tablet.png\" alt=\"Login tablet\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Login page <span class=\"badge badge-tablet\">Tablet 768px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_04_login_mobile.png\" alt=\"Login mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Login page <span class=\"badge badge-mobile\">Mobile 390px</span></div></div>\n  </div>\n  <div class=\"alert alert-warn\" style=\"margin-top:16px;\">\n    <span class=\"alert-icon\">\u26a0\ufe0f</span>\n    <div>Login is blocked if your email is not yet verified. A \"Resend verification email\" link appears on the error message.</div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">1.5</span>Registration / Sign-Up</h3>\n  <p>Where new users create their Proplity account. The <strong>first step is choosing your role</strong> \u2014 each role unlocks different features and dashboards.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_05_register_roles_desktop.png\" alt=\"Role selection desktop\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Role selection \u2014 Step 1 <span class=\"badge badge-desktop\">Desktop 1400px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_05_register_roles_mobile.png\" alt=\"Role selection mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Role selection <span class=\"badge badge-mobile\">Mobile 390px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_06_register_tenant_form_desktop.png\" alt=\"Tenant registration form\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Tenant registration form \u2014 Step 2 <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_reg_02_form.png\" alt=\"Registration Form Fields\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Form fields detail view <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_reg_01_select_role.png\" alt=\"Role cards\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Role selection cards (full width) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_reg_03_notice.png\" alt=\"Verification notice\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Email verification notice (after submitting) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_reg_04_verified.png\" alt=\"Email verified\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Email verified \u2014 account activated <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n  <div class=\"alert alert-info\" style=\"margin-top:12px;\">\n    <span class=\"alert-icon\">\ud83d\udce7</span>\n    <div>After submitting the form, a verification email is sent. <strong>You cannot log in until you click the link.</strong> Use the \"Resend Verification\" link on the login page if you don't receive it.</div>\n  </div>\n</div>\n<div id=\"forgot-password\" class=\"step-card\">\n  <h3><span class=\"step-num\">1.6</span>Forgot Password & Password Recovery</h3>\n  <p>When a user forgets their password, they click <strong>\"Forgot password?\"</strong> on the login screen to access the recovery page at <code>/forgot-password</code>.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_07_forgot_password_desktop.png\" alt=\"Forgot password desktop\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Forgot password form <span class=\"badge badge-desktop\">Desktop 1280px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/visitor_07_forgot_password_mobile.png\" alt=\"Forgot password mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Forgot password <span class=\"badge badge-mobile\">Mobile 390px</span></div></div>\n  </div>\n  <div class=\"alert alert-info\" style=\"margin-top:12px;\">\n    <span class=\"alert-icon\">\ud83d\udd10</span>\n    <div><strong>Security & Anti-Enumeration:</strong> Proplity always displays the same generic confirmation message whether the email address exists in the system or not, preventing bad actors from guessing valid user accounts. Password reset tokens expire automatically after 60 minutes.</div>\n  </div>\n</div>\n\n\n<hr>\n\n<!-- TENANT SECTION -->\n<div id=\"tenant\" class=\"section-header\" style=\"border-left-color:#10b981;\">\n  <span class=\"section-icon\">\ud83c\udfe0</span>\n  <div>\n    <div class=\"section-title\">Tenant Flow</div>\n    <div class=\"section-subtitle\">Login: tenant@proplity.com / Password123! \u2014 Pays rent, reports repairs, manages tenancy</div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.1</span>Tenant Dashboard (Home Screen)</h3>\n  <p>After logging in, the tenant lands on their personal dashboard \u2014 the command centre showing everything important at a glance: current property, rent due, maintenance status, and quick actions.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_01_dashboard_desktop.png\" alt=\"Tenant dashboard desktop\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Tenant dashboard (top section) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_01b_dashboard_scroll_desktop.png\" alt=\"Tenant dashboard scrolled\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Tenant dashboard (scrolled \u2014 lease + maintenance) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_01_dashboard_mobile.png\" alt=\"Tenant dashboard mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Tenant dashboard <span class=\"badge badge-mobile\">Mobile 390px</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.2</span>My Lease / Rentals</h3>\n  <p>Shows all lease agreements \u2014 current and past. If a lease is awaiting your digital signature, a \"Sign Lease\" button appears here. No printing needed \u2014 sign right in the browser.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_02_my_lease_desktop.png\" alt=\"My lease\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">My Rentals / Lease view <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_08_lease_documents_desktop.png\" alt=\"Lease documents\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Lease documents and history <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_07_lease_details_desktop.png\" alt=\"Lease details\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Active lease details breakdown <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.3</span>Pay Rent (Paystack Payment Flow)</h3>\n  <p>Rent is paid directly through Proplity using Paystack (Nigeria's leading payment gateway). Monthly invoices are generated automatically \u2014 just click to pay. Supports card, bank transfer, and USSD.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_payment_01_initiate.png\" alt=\"Payment checkout initiate\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Payment checkout initiation <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_03_pay_rent_modal_desktop.png\" alt=\"Pay rent modal\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Pay Now modal (amount + confirm) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/mock_01_paystack_gateway.png\" alt=\"Paystack gateway\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Paystack checkout (mock gateway for testing) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_payment_02_paystack_checkout.png\" alt=\"Paystack checkout\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Paystack real checkout page <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_payment_03_payment_success.png\" alt=\"Payment success\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Payment successful confirmation <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_10_payment_receipt_desktop.png\" alt=\"Payment receipt\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Payment history / receipts <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_06_payment_history.png\" alt=\"Payment history\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Payment history (legacy view) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.4</span>Browse Properties</h3>\n  <p>Tenants can browse all published rental properties \u2014 useful when looking to move or find a new home in a different area.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_02_browse_properties_desktop.png\" alt=\"Browse properties\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Browse properties (grid view) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_03_property_detail_desktop.png\" alt=\"Property detail tenant view\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property detail (tenant view with Apply button active) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.5</span>Schedule a Viewing (Book Inspection)</h3>\n  <p>Before applying, you can request a physical visit to see the property in person. The manager receives the request and confirms a time. A confirmation email is sent once confirmed.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_04_schedule_viewing_desktop.png\" alt=\"Schedule viewing desktop\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Schedule Viewing modal (date picker) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_04_schedule_viewing_mobile.png\" alt=\"Schedule viewing mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Schedule Viewing modal <span class=\"badge badge-mobile\">Mobile 390px</span></div></div>\n  </div>\n</div>\n\n<div id=\"tenant-apply\" class=\"step-card\">\n  <h3><span class=\"step-num\">2.6</span>Apply for a Property (3-Step Application)</h3>\n  <p>A formal 3-step online application form. The manager reviews and approves or rejects. <strong>Note: your tenant profile must be complete before you can apply.</strong> If key details are missing, the system redirects you to complete your profile first.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_apply_00_complete_profile.png\" alt=\"Complete profile gate\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 0: Complete Your Profile (required gate) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_apply_01_property.png\" alt=\"Apply - property view\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property page with Apply button <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_apply_02_step1_personal.png\" alt=\"Apply step 1\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 1: Personal Information <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_apply_03_step2_employment.png\" alt=\"Apply step 2\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 2: Employment & Financial Info <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_apply_04_step3_review.png\" alt=\"Apply step 3\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 3: Review & Submit <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_apply_06_submitted_confirmation.png\" alt=\"Apply submitted\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Application submitted confirmation <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n  <div class=\"alert alert-info\" style=\"margin-top:12px;\">\n    <span class=\"alert-icon\">\ud83d\udd17</span>\n    <div><strong>Cross-reference:</strong> After submission, the manager reviews it. <a href=\"#manager-applications\" class=\"cross-ref\">\u2192 See Manager: Reviewing Applications</a></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.7</span>Maintenance Request (Report a Repair)</h3>\n  <p>Something broken? Submit a maintenance request \u2014 the manager assigns a tradesperson (vendor) to fix it. Pick a category, urgency, describe the problem, and optionally attach photos.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_04_maintenance_list_desktop.png\" alt=\"Maintenance list\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Maintenance requests list (tracker) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_05_create_maintenance_modal_desktop.png\" alt=\"Create maintenance modal\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Create maintenance request modal (filled in) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_09_maintenance_form_desktop.png\" alt=\"Maintenance form\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Maintenance request form (full page) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n  <div class=\"alert alert-info\" style=\"margin-top:12px;\">\n    <span class=\"alert-icon\">\ud83d\udd17</span>\n    <div><strong>Cross-reference:</strong> This request appears in the manager's Maintenance Board. <a href=\"#manager-maintenance\" class=\"cross-ref\">\u2192 See Manager: Maintenance Board</a></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.8</span>Messages</h3>\n  <p>Built-in messaging with your property manager and landlord. One thread per tenancy \u2014 created automatically the first time you message. Press Enter or click \u27a4 to send.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_07_messages.png\" alt=\"Messages inbox\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Messages inbox <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_msg_typing.png\" alt=\"Typing message\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Typing a message in the chat <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_msg_sent.png\" alt=\"Message sent\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Message sent and delivered <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.9</span>Notifications</h3>\n  <p>A notification centre keeping you informed \u2014 new invoices, maintenance updates, lease changes, and application status updates. Access via the \ud83d\udd14 bell icon (top-right) or from the sidebar.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_08_notifications.png\" alt=\"Notifications\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Notifications panel <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">2.10</span>Tenant AI Assistant</h3>\n  <p>An intelligent in-app assistant that helps tenants understand their tenancy agreement, draft maintenance reports, answer rent calculation questions, or inquire about Nigerian tenancy rights.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/tenant_06_ai_chat_desktop.png\" alt=\"Tenant AI chat\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">AI Chat Assistant <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<hr>\n\n<!-- LANDLORD SECTION -->\n<div id=\"landlord\" class=\"section-header\" style=\"border-left-color:#f59e0b;\">\n  <span class=\"section-icon\">\ud83c\udfd7</span>\n  <div>\n    <div class=\"section-title\">Landlord Flow</div>\n    <div class=\"section-subtitle\">Login: landlord@proplity.com / Password123! \u2014 Portfolio owner, delegates daily ops to manager</div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">3.1</span>Landlord Dashboard</h3>\n  <p>Bird's-eye view of the entire property portfolio \u2014 total properties, units occupied vs. vacant, monthly revenue summary, and recent activity.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_01_dashboard_desktop.png\" alt=\"Landlord dashboard\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Landlord dashboard <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_01_dashboard_overview_desktop.png\" alt=\"Landlord dashboard overview\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Landlord dashboard (overview variant) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">3.2</span>My Properties (Portfolio List)</h3>\n  <p>Full list of all owned properties with occupancy status for each one.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_02_properties_desktop.png\" alt=\"Properties list\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Properties portfolio cards <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_02_properties_list_desktop.png\" alt=\"Properties table\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Properties tabular directory <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_02_property_detail.png\" alt=\"Property detail landlord\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property detail (landlord view) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">3.3</span>List a New Property (3-Step Wizard)</h3>\n  <p>Add a new rental property to the platform in 3 steps \u2014 basic info \u2192 units & amenities \u2192 photos & publish.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_03_add_property_desktop.png\" alt=\"Add property modal\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Add property modal dialog <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_03_list_step1.png\" alt=\"List step 1\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 1: Basic Info (name, address, description) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_04_list_step2.png\" alt=\"List step 2\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 2: Units, rent & amenities <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_05_list_step3.png\" alt=\"List step 3\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 3: Photos, preview & publish <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_04_unit_management_desktop.png\" alt=\"Unit management\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Unit management view <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">3.4</span>Tenant Overview & Applicant Screening</h3>\n  <p>See all current tenants across all properties, and monitor incoming rental applications.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_06_tenants.png\" alt=\"Tenant overview\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">All tenants list <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_06_tenant_details_desktop.png\" alt=\"Tenant detail\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Individual tenant detail <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_05_applicant_screening_desktop.png\" alt=\"Applicant screening\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Applicant screening / pending applications <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">3.5</span>Financial Summary & Revenue Reports</h3>\n  <p>Overview of all financial activity \u2014 total rent collected, outstanding payments, and maintenance costs.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_07_financial_summary_desktop.png\" alt=\"Financial summary\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Financial dashboard & revenue summary <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/landlord_07_maintenance.png\" alt=\"Maintenance costs\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Maintenance costs overview <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<hr>\n\n<!-- MANAGER SECTION -->\n<div id=\"manager\" class=\"section-header\" style=\"border-left-color:#3b82f6;\">\n  <span class=\"section-icon\">\ud83d\udc54</span>\n  <div>\n    <div class=\"section-title\">Property Manager Flow</div>\n    <div class=\"section-subtitle\">Login: manager@proplity.com / Password123! \u2014 Handles daily operations (must register with landlord invite code)</div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">4.1</span>Manager Dashboard</h3>\n  <p>The most information-dense dashboard \u2014 key stats, recent activity, and quick access to all management functions.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_01_dashboard_desktop.png\" alt=\"Manager dashboard desktop\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Manager dashboard <span class=\"badge badge-desktop\">Desktop 1400px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_01b_dashboard_metrics_desktop.png\" alt=\"Manager metrics\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Manager dashboard (metrics section) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_01_dashboard_tablet.png\" alt=\"Manager dashboard tablet\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Manager dashboard <span class=\"badge badge-tablet\">Tablet 768px</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_01_dashboard_mobile.png\" alt=\"Manager dashboard mobile\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Manager dashboard <span class=\"badge badge-mobile\">Mobile 390px</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">4.2</span>Properties List & Property Detail</h3>\n  <p>All properties the manager oversees, with occupancy status. Click into a property to see all units, who occupies them, and what's vacant.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_02_properties_list_desktop.png\" alt=\"Manager properties list\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Properties list (manager view) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_03_add_property_modal_desktop.png\" alt=\"Manager add property modal\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Add property modal dialog <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_04_property_detail_desktop.png\" alt=\"Manager property detail\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Property detail (all units view) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">4.3</span>Add Tenant \u2014 Direct Invite (3 Steps)</h3>\n  <p>The manager can directly invite a tenant to a vacant unit \u2014 bypassing the online application flow. The tenant receives an email with a link to accept and set their password.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_03_add_tenant_step1.png\" alt=\"Add tenant step 1\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 1: Select unit, enter tenant email & rent <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_04_add_tenant_step2.png\" alt=\"Add tenant step 2\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 2: Configure lease dates and schedule <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_05_add_tenant_step3.png\" alt=\"Add tenant step 3\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Step 3: Review and send invite <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_06_add_tenant_modal_desktop.png\" alt=\"Add tenant modal\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Add tenant modal (compact view) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div id=\"manager-applications\" class=\"step-card\">\n  <h3><span class=\"step-num\">4.4</span>Reviewing Tenant Applications (4-Stage Approval)</h3>\n  <p>When a tenant applies online, it arrives in the manager's queue. The manager reviews, approves, creates the lease, then activates it. Four distinct stages.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_review_01_pending_applications.png\" alt=\"Pending applications\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Stage 1: Pending applications queue <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_review_02_application_approved.png\" alt=\"Application approved\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Stage 2: Application approved <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_review_03_create_tenancy.png\" alt=\"Create tenancy\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Stage 3: Create tenancy (set lease terms) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_review_04_activate_lease.png\" alt=\"Activate lease\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Stage 4: Send for e-signatures \u2192 Lease ACTIVE <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div id=\"manager-maintenance\" class=\"step-card\">\n  <h3><span class=\"step-num\">4.5</span>Maintenance Board (Kanban View)</h3>\n  <p>The manager's maintenance control centre \u2014 a Kanban board (like Trello) showing all repair requests from all tenants. Manager assigns vendors to jobs and tracks progress through New \u2192 In Progress \u2192 Resolved \u2192 Closed.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_07_maintenance_desktop.png\" alt=\"Maintenance kanban\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Maintenance Kanban board <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_08_maintenance_detail_desktop.png\" alt=\"Maintenance ticket detail\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Maintenance ticket detail (assign vendor) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n  <div class=\"alert alert-info\" style=\"margin-top:12px;\">\n    <span class=\"alert-icon\">\ud83d\udd17</span>\n    <div><strong>Cross-reference:</strong> After assigning a vendor, they see the job in their dashboard. <a href=\"#vendor\" class=\"cross-ref\">\u2192 See Vendor: Job Detail</a></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">4.6</span>Tenant Management, Financials & Messages</h3>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_05_tenants_list_desktop.png\" alt=\"Tenant management\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Tenant management list <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_09_financials_desktop.png\" alt=\"Financials\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Financial overview (rent, invoices, history) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_08_messages.png\" alt=\"Manager messages\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Messages inbox (all tenant conversations) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/manager_10_ai_assistant_desktop.png\" alt=\"AI assistant\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">AI Assistant (property management queries) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<hr>\n\n<!-- VENDOR SECTION -->\n<div id=\"vendor\" class=\"section-header\" style=\"border-left-color:#ef4444;\">\n  <span class=\"section-icon\">\ud83d\udd27</span>\n  <div>\n    <div class=\"section-title\">Vendor / Service Provider Flow</div>\n    <div class=\"section-subtitle\">Login: vendor@proplity.com / Password123! \u2014 Receives and fulfils maintenance jobs</div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">5.1</span>Vendor Dashboard & Job List</h3>\n  <p>Home screen showing all maintenance jobs assigned to this vendor \u2014 property address, tenant name, problem description, urgency, and current status.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/vendor_01_dashboard_desktop.png\" alt=\"Vendor dashboard\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Vendor dashboard <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/vendor_02_ticket_list_desktop.png\" alt=\"Vendor ticket list\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Maintenance ticket / job list <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">5.2</span>Job Detail & Status Updates</h3>\n  <p>Full details of a single maintenance job \u2014 problem description, tenant photos, property address, preferred access time, and timeline. Vendor clicks \"Update Status\" to move from In Progress \u2192 Completed.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/vendor_02_job_detail_desktop.png\" alt=\"Job detail\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Job detail page <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/vendor_03_ticket_details_desktop.png\" alt=\"Ticket details\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Ticket detail (full info) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/vendor_04_ticket_update_desktop.png\" alt=\"Status update\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Update job status (In Progress \u2192 Completed) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">5.3</span>Submit an Invoice & Messages</h3>\n  <p>After completing a job, the vendor submits an itemised invoice to the manager for payment. Also access messages to communicate with the manager directly.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/vendor_03_create_invoice.png\" alt=\"Create invoice\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Create invoice (line items + total) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/vendor_04_messages.png\" alt=\"Vendor messages\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Messages with property manager <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<hr>\n\n<!-- ADMIN SECTION -->\n<div id=\"admin\" class=\"section-header\" style=\"border-left-color:#8b5cf6;\">\n  <span class=\"section-icon\">\ud83d\udee1</span>\n  <div>\n    <div class=\"section-title\">Admin Flow</div>\n    <div class=\"section-subtitle\">Login: admin@proplity.com / Password123! \u2014 Platform-wide governance. Goes to /admin (not /dashboard)</div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">6.1</span>Admin Overview & User Management</h3>\n  <p>Platform-wide statistics and a searchable table of every registered user. The admin can view, suspend, reactivate, and manage any account on the system.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/admin_01_overview.png\" alt=\"Admin overview\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Admin overview dashboard <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/admin_02_users.png\" alt=\"User management\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">User management (all users table) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<div class=\"step-card\">\n  <h3><span class=\"step-num\">6.2</span>Properties Moderation, Reports, Audit Logs & Settings</h3>\n  <p>Every property listing is reviewed before going live. Platform-wide reports, security audit logs (every action logged), and system configuration settings.</p>\n  <div class=\"screenshot-grid\">\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/admin_06_properties.png\" alt=\"Properties moderation\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Properties moderation queue (approve/reject listings) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/admin_03_reports.png\" alt=\"Reports\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Platform-wide reports & analytics <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/admin_05_notifications.png\" alt=\"Audit logs\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Security & audit logs (every action logged) <span class=\"badge badge-desktop\">Desktop</span></div></div>\n    <div class=\"screenshot-item\">\n    <div class=\"zoom-badge\">\ud83d\udd0d Click to expand</div><img src=\"/screenshots/admin_04_settings.png\" alt=\"Platform settings\" onerror=\"this.style.background='#1a2235';this.style.height='180px'\"><div class=\"screenshot-label\">Platform settings & configuration <span class=\"badge badge-desktop\">Desktop</span></div></div>\n  </div>\n</div>\n\n<hr>\n\n<!-- LIFECYCLE -->\n<div id=\"lifecycle\" class=\"section-header\" style=\"border-left-color:#10b981;\">\n  <span class=\"section-icon\">\ud83d\udd00</span>\n  <div>\n    <div class=\"section-title\">Full Cross-Role Lifecycle</div>\n    <div class=\"section-subtitle\">How Tenant \u2192 Manager \u2192 Vendor \u2192 System work together on a complete tenancy</div>\n  </div>\n</div>\n\n<div class=\"lifecycle\">\n  <div class=\"lifecycle-title\">Tenant Application \u2192 Active Lease \u2192 Rent Payment \u2192 Repair \u2192 Resolution</div>\n  <div style=\"overflow-x:auto;\">\n    <table style=\"min-width:600px;\">\n      <thead><tr><th>Who</th><th>Action</th><th>Result</th></tr></thead>\n      <tbody>\n        <tr><td><span class=\"role-badge role-tenant\">Tenant</span></td><td>Browses properties and schedules a viewing</td><td>Manager receives viewing request</td></tr>\n        <tr><td><span class=\"role-badge role-manager\">Manager</span></td><td>Confirms viewing time</td><td>Tenant gets confirmation email</td></tr>\n        <tr><td><span class=\"role-badge role-tenant\">Tenant</span></td><td>Submits 3-step rental application</td><td>Application arrives in manager's queue</td></tr>\n        <tr><td><span class=\"role-badge role-manager\">Manager</span></td><td>Reviews application \u2192 Approves</td><td>Tenant gets \"Approved\" notification</td></tr>\n        <tr><td><span class=\"role-badge role-manager\">Manager</span></td><td>Creates lease agreement (dates, rent, terms)</td><td>Lease sent to both parties for e-sign</td></tr>\n        <tr><td><span class=\"role-badge role-tenant\">Tenant</span></td><td>Signs lease digitally</td><td>Lease status \u2192 <strong style=\"color:var(--success)\">ACTIVE</strong></td></tr>\n        <tr><td>System</td><td>Auto-generates monthly rent invoice</td><td>Tenant sees \"Pay Now\" on dashboard</td></tr>\n        <tr><td><span class=\"role-badge role-tenant\">Tenant</span></td><td>Pays rent via Paystack</td><td>Payment recorded, receipt generated</td></tr>\n        <tr><td><span class=\"role-badge role-tenant\">Tenant</span></td><td>Reports a repair (e.g. leaking tap)</td><td>Maintenance ticket created</td></tr>\n        <tr><td><span class=\"role-badge role-manager\">Manager</span></td><td>Assigns ticket to a vendor (plumber)</td><td>Vendor gets notified</td></tr>\n        <tr><td><span class=\"role-badge role-vendor\">Vendor</span></td><td>Visits property, fixes the tap</td><td>Updates status to \"Completed\"</td></tr>\n        <tr><td><span class=\"role-badge role-vendor\">Vendor</span></td><td>Submits invoice for labour + parts</td><td>Manager receives invoice for payment</td></tr>\n        <tr><td><span class=\"role-badge role-tenant\">Tenant</span></td><td>Confirms repair complete</td><td>Ticket closed</td></tr>\n      </tbody>\n    </table>\n  </div>\n</div>\n\n<hr>\n\n<!-- RESPONSIVE -->\n<div id=\"responsive\" class=\"section-header\" style=\"border-left-color:#6366f1;\">\n  <span class=\"section-icon\">\ud83d\udcf1</span>\n  <div>\n    <div class=\"section-title\">Responsive Design</div>\n    <div class=\"section-subtitle\">Proplity works on all screen sizes \u2014 desktop, tablet, and mobile</div>\n  </div>\n</div>\n\n<div class=\"resp-grid\">\n  <div class=\"resp-card\"><div class=\"bp\">1400px</div><div class=\"label\">Desktop<br>Large monitor</div></div>\n  <div class=\"resp-card\"><div class=\"bp\">768px</div><div class=\"label\">Tablet<br>iPad portrait</div></div>\n  <div class=\"resp-card\"><div class=\"bp\">390px</div><div class=\"label\">Mobile<br>iPhone 14</div></div>\n</div>\n\n<p style=\"color:var(--text-muted);margin:16px 0;\">Screenshots captured at all three breakpoints for: Homepage, Login, Registration, Property detail, Tenant dashboard, Schedule viewing, Manager dashboard, and Vendor dashboard.</p>\n\n<hr>\n<p style=\"color:var(--text-muted);font-size:13px;text-align:center;padding:24px 0;\">\n  Proplity Complete Guide \u00b7 Version 3.0 \u00b7 Generated 2026-10-04 \u00b7 100+ Screenshots \u00b7 All roles covered\n</p>\n\n</main>\n</div>\n\n";

export const guideScreenshots = [
  {
    "src": "/screenshots/setup_01_setup_page_desktop.png",
    "alt": "Setup page \u2014 if already done, redirects to login",
    "title": "Setup page / redirect to login \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/setup_01b_setup_complete.png",
    "alt": "Setup already complete",
    "title": "Setup already complete \u2014 login redirect \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/setup_01_setup_page_mobile.png",
    "alt": "Setup page mobile",
    "title": "Setup page \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/visitor_01_homepage_desktop.png",
    "alt": "Homepage desktop",
    "title": "Homepage (full) \u2014 Desktop 1400px",
    "badge": "Desktop 1400px"
  },
  {
    "src": "/screenshots/visitor_01_homepage_tablet.png",
    "alt": "Homepage tablet",
    "title": "Homepage \u2014 Tablet 768px",
    "badge": "Tablet 768px"
  },
  {
    "src": "/screenshots/visitor_01_homepage_mobile.png",
    "alt": "Homepage mobile",
    "title": "Homepage \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/visitor_01b_homepage_hero_desktop.png",
    "alt": "Hero section",
    "title": "Hero / Banner section \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/visitor_01c_homepage_features_desktop.png",
    "alt": "Features section",
    "title": "How it works section \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/visitor_01d_homepage_properties_desktop.png",
    "alt": "Featured properties",
    "title": "Featured Properties section \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/visitor_02_property_modal_desktop.png",
    "alt": "Property modal",
    "title": "Property preview modal (1st property) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/visitor_02b_property_modal_slide2_desktop.png",
    "alt": "Property modal slide 2",
    "title": "Property modal (2nd property \u2014 arrow navigation) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/visitor_03_property_detail_desktop.png",
    "alt": "Property detail desktop",
    "title": "Property detail (top) \u2014 Desktop 1400px",
    "badge": "Desktop 1400px"
  },
  {
    "src": "/screenshots/visitor_03b_property_detail_scroll_desktop.png",
    "alt": "Property detail scrolled",
    "title": "Property detail (scrolled \u2014 amenities + scores) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/visitor_03_property_detail_tablet.png",
    "alt": "Property detail tablet",
    "title": "Property detail \u2014 Tablet 768px",
    "badge": "Tablet 768px"
  },
  {
    "src": "/screenshots/visitor_03_property_detail_mobile.png",
    "alt": "Property detail mobile",
    "title": "Property detail \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/visitor_04_login_desktop.png",
    "alt": "Login desktop",
    "title": "Login page \u2014 Desktop 1400px",
    "badge": "Desktop 1400px"
  },
  {
    "src": "/screenshots/visitor_04_login_tablet.png",
    "alt": "Login tablet",
    "title": "Login page \u2014 Tablet 768px",
    "badge": "Tablet 768px"
  },
  {
    "src": "/screenshots/visitor_04_login_mobile.png",
    "alt": "Login mobile",
    "title": "Login page \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/visitor_05_register_roles_desktop.png",
    "alt": "Role selection desktop",
    "title": "Role selection \u2014 Step 1 \u2014 Desktop 1400px",
    "badge": "Desktop 1400px"
  },
  {
    "src": "/screenshots/visitor_05_register_roles_mobile.png",
    "alt": "Role selection mobile",
    "title": "Role selection \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/visitor_06_register_tenant_form_desktop.png",
    "alt": "Tenant registration form",
    "title": "Tenant registration form \u2014 Step 2 \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_reg_02_form.png",
    "alt": "Registration Form Fields",
    "title": "Form fields detail view \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_reg_01_select_role.png",
    "alt": "Role cards",
    "title": "Role selection cards (full width) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_reg_03_notice.png",
    "alt": "Verification notice",
    "title": "Email verification notice (after submitting) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_reg_04_verified.png",
    "alt": "Email verified",
    "title": "Email verified \u2014 account activated \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/visitor_07_forgot_password_desktop.png",
    "alt": "Forgot password desktop",
    "title": "Forgot password form \u2014 Desktop 1280px",
    "badge": "Desktop 1280px"
  },
  {
    "src": "/screenshots/visitor_07_forgot_password_mobile.png",
    "alt": "Forgot password mobile",
    "title": "Forgot password \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/tenant_01_dashboard_desktop.png",
    "alt": "Tenant dashboard desktop",
    "title": "Tenant dashboard (top section) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_01b_dashboard_scroll_desktop.png",
    "alt": "Tenant dashboard scrolled",
    "title": "Tenant dashboard (scrolled \u2014 lease + maintenance) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_01_dashboard_mobile.png",
    "alt": "Tenant dashboard mobile",
    "title": "Tenant dashboard \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/tenant_02_my_lease_desktop.png",
    "alt": "My lease",
    "title": "My Rentals / Lease view \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_08_lease_documents_desktop.png",
    "alt": "Lease documents",
    "title": "Lease documents and history \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_07_lease_details_desktop.png",
    "alt": "Lease details",
    "title": "Active lease details breakdown \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_payment_01_initiate.png",
    "alt": "Payment checkout initiate",
    "title": "Payment checkout initiation \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_03_pay_rent_modal_desktop.png",
    "alt": "Pay rent modal",
    "title": "Pay Now modal (amount + confirm) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/mock_01_paystack_gateway.png",
    "alt": "Paystack gateway",
    "title": "Paystack checkout (mock gateway for testing) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_payment_02_paystack_checkout.png",
    "alt": "Paystack checkout",
    "title": "Paystack real checkout page \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_payment_03_payment_success.png",
    "alt": "Payment success",
    "title": "Payment successful confirmation \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_10_payment_receipt_desktop.png",
    "alt": "Payment receipt",
    "title": "Payment history / receipts \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_06_payment_history.png",
    "alt": "Payment history",
    "title": "Payment history (legacy view) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_02_browse_properties_desktop.png",
    "alt": "Browse properties",
    "title": "Browse properties (grid view) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_03_property_detail_desktop.png",
    "alt": "Property detail tenant view",
    "title": "Property detail (tenant view with Apply button active) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_04_schedule_viewing_desktop.png",
    "alt": "Schedule viewing desktop",
    "title": "Schedule Viewing modal (date picker) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_04_schedule_viewing_mobile.png",
    "alt": "Schedule viewing mobile",
    "title": "Schedule Viewing modal \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/tenant_apply_00_complete_profile.png",
    "alt": "Complete profile gate",
    "title": "Step 0: Complete Your Profile (required gate) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_apply_01_property.png",
    "alt": "Apply - property view",
    "title": "Property page with Apply button \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_apply_02_step1_personal.png",
    "alt": "Apply step 1",
    "title": "Step 1: Personal Information \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_apply_03_step2_employment.png",
    "alt": "Apply step 2",
    "title": "Step 2: Employment & Financial Info \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_apply_04_step3_review.png",
    "alt": "Apply step 3",
    "title": "Step 3: Review & Submit \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_apply_06_submitted_confirmation.png",
    "alt": "Apply submitted",
    "title": "Application submitted confirmation \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_04_maintenance_list_desktop.png",
    "alt": "Maintenance list",
    "title": "Maintenance requests list (tracker) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_05_create_maintenance_modal_desktop.png",
    "alt": "Create maintenance modal",
    "title": "Create maintenance request modal (filled in) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_09_maintenance_form_desktop.png",
    "alt": "Maintenance form",
    "title": "Maintenance request form (full page) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_07_messages.png",
    "alt": "Messages inbox",
    "title": "Messages inbox \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_msg_typing.png",
    "alt": "Typing message",
    "title": "Typing a message in the chat \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_msg_sent.png",
    "alt": "Message sent",
    "title": "Message sent and delivered \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_08_notifications.png",
    "alt": "Notifications",
    "title": "Notifications panel \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/tenant_06_ai_chat_desktop.png",
    "alt": "Tenant AI chat",
    "title": "AI Chat Assistant \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_01_dashboard_desktop.png",
    "alt": "Landlord dashboard",
    "title": "Landlord dashboard \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_01_dashboard_overview_desktop.png",
    "alt": "Landlord dashboard overview",
    "title": "Landlord dashboard (overview variant) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_02_properties_desktop.png",
    "alt": "Properties list",
    "title": "Properties portfolio cards \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_02_properties_list_desktop.png",
    "alt": "Properties table",
    "title": "Properties tabular directory \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_02_property_detail.png",
    "alt": "Property detail landlord",
    "title": "Property detail (landlord view) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_03_add_property_desktop.png",
    "alt": "Add property modal",
    "title": "Add property modal dialog \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_03_list_step1.png",
    "alt": "List step 1",
    "title": "Step 1: Basic Info (name, address, description) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_04_list_step2.png",
    "alt": "List step 2",
    "title": "Step 2: Units, rent & amenities \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_05_list_step3.png",
    "alt": "List step 3",
    "title": "Step 3: Photos, preview & publish \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_04_unit_management_desktop.png",
    "alt": "Unit management",
    "title": "Unit management view \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_06_tenants.png",
    "alt": "Tenant overview",
    "title": "All tenants list \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_06_tenant_details_desktop.png",
    "alt": "Tenant detail",
    "title": "Individual tenant detail \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_05_applicant_screening_desktop.png",
    "alt": "Applicant screening",
    "title": "Applicant screening / pending applications \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_07_financial_summary_desktop.png",
    "alt": "Financial summary",
    "title": "Financial dashboard & revenue summary \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/landlord_07_maintenance.png",
    "alt": "Maintenance costs",
    "title": "Maintenance costs overview \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_01_dashboard_desktop.png",
    "alt": "Manager dashboard desktop",
    "title": "Manager dashboard \u2014 Desktop 1400px",
    "badge": "Desktop 1400px"
  },
  {
    "src": "/screenshots/manager_01b_dashboard_metrics_desktop.png",
    "alt": "Manager metrics",
    "title": "Manager dashboard (metrics section) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_01_dashboard_tablet.png",
    "alt": "Manager dashboard tablet",
    "title": "Manager dashboard \u2014 Tablet 768px",
    "badge": "Tablet 768px"
  },
  {
    "src": "/screenshots/manager_01_dashboard_mobile.png",
    "alt": "Manager dashboard mobile",
    "title": "Manager dashboard \u2014 Mobile 390px",
    "badge": "Mobile 390px"
  },
  {
    "src": "/screenshots/manager_02_properties_list_desktop.png",
    "alt": "Manager properties list",
    "title": "Properties list (manager view) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_03_add_property_modal_desktop.png",
    "alt": "Manager add property modal",
    "title": "Add property modal dialog \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_04_property_detail_desktop.png",
    "alt": "Manager property detail",
    "title": "Property detail (all units view) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_03_add_tenant_step1.png",
    "alt": "Add tenant step 1",
    "title": "Step 1: Select unit, enter tenant email & rent \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_04_add_tenant_step2.png",
    "alt": "Add tenant step 2",
    "title": "Step 2: Configure lease dates and schedule \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_05_add_tenant_step3.png",
    "alt": "Add tenant step 3",
    "title": "Step 3: Review and send invite \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_06_add_tenant_modal_desktop.png",
    "alt": "Add tenant modal",
    "title": "Add tenant modal (compact view) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_review_01_pending_applications.png",
    "alt": "Pending applications",
    "title": "Stage 1: Pending applications queue \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_review_02_application_approved.png",
    "alt": "Application approved",
    "title": "Stage 2: Application approved \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_review_03_create_tenancy.png",
    "alt": "Create tenancy",
    "title": "Stage 3: Create tenancy (set lease terms) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_review_04_activate_lease.png",
    "alt": "Activate lease",
    "title": "Stage 4: Send for e-signatures \u2192 Lease ACTIVE \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_07_maintenance_desktop.png",
    "alt": "Maintenance kanban",
    "title": "Maintenance Kanban board \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_08_maintenance_detail_desktop.png",
    "alt": "Maintenance ticket detail",
    "title": "Maintenance ticket detail (assign vendor) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_05_tenants_list_desktop.png",
    "alt": "Tenant management",
    "title": "Tenant management list \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_09_financials_desktop.png",
    "alt": "Financials",
    "title": "Financial overview (rent, invoices, history) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_08_messages.png",
    "alt": "Manager messages",
    "title": "Messages inbox (all tenant conversations) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/manager_10_ai_assistant_desktop.png",
    "alt": "AI assistant",
    "title": "AI Assistant (property management queries) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/vendor_01_dashboard_desktop.png",
    "alt": "Vendor dashboard",
    "title": "Vendor dashboard \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/vendor_02_ticket_list_desktop.png",
    "alt": "Vendor ticket list",
    "title": "Maintenance ticket / job list \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/vendor_02_job_detail_desktop.png",
    "alt": "Job detail",
    "title": "Job detail page \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/vendor_03_ticket_details_desktop.png",
    "alt": "Ticket details",
    "title": "Ticket detail (full info) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/vendor_04_ticket_update_desktop.png",
    "alt": "Status update",
    "title": "Update job status (In Progress \u2192 Completed) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/vendor_03_create_invoice.png",
    "alt": "Create invoice",
    "title": "Create invoice (line items + total) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/vendor_04_messages.png",
    "alt": "Vendor messages",
    "title": "Messages with property manager \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/admin_01_overview.png",
    "alt": "Admin overview",
    "title": "Admin overview dashboard \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/admin_02_users.png",
    "alt": "User management",
    "title": "User management (all users table) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/admin_06_properties.png",
    "alt": "Properties moderation",
    "title": "Properties moderation queue (approve/reject listings) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/admin_03_reports.png",
    "alt": "Reports",
    "title": "Platform-wide reports & analytics \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/admin_05_notifications.png",
    "alt": "Audit logs",
    "title": "Security & audit logs (every action logged) \u2014 Desktop",
    "badge": "Desktop"
  },
  {
    "src": "/screenshots/admin_04_settings.png",
    "alt": "Platform settings",
    "title": "Platform settings & configuration \u2014 Desktop",
    "badge": "Desktop"
  }
];
