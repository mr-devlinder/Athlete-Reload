export function buildPainIssueReport(issue = {}, summary = {}, recipient = '') {
  const currentSeverity = normalizeSeverity(summary.currentSeverity)
  const peakSeverity = normalizeSeverity(summary.peakSeverity)
  const tone = getSeverityTone(currentSeverity)
  const generatedAt = new Date().toLocaleString()
  const notes = [
    ['Athlete notes', issue.athleteNotes, noteIcon('person')],
    ['Trainer notes', issue.trainerNotes, noteIcon('clipboard')],
    ['Clinician notes', issue.clinicianNotes, noteIcon('medical')],
  ].filter(([, value]) => value)
    .map(([label, value, icon]) => `<section class="note-card">${icon}<div><h3>${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p></div></section>`)
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Athlete Reload pain summary</title>
  <style>
    :root{--ink:#171817;--muted:#666b67;--line:#dcded9;--paper:#f4f3ee;--surface:#fff;--green:#337255;--amber:#9a6419;--red:#a83e35;--tone:${tone.color};--tone-soft:${tone.soft}}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:"Avenir Next","Century Gothic",Segoe UI,sans-serif;line-height:1.5}
    .page{width:min(860px,calc(100% - 32px));margin:32px auto;background:var(--surface);border:1px solid var(--line);border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(20,20,18,.12)}
    .masthead{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:30px 34px;background:#111;color:#fff}
    .brand{display:flex;align-items:center;gap:14px}.mark{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(255,255,255,.28);border-radius:15px;background:#fff;color:#111}.mark svg{width:28px;height:28px}.brand small,.brand strong{display:block}.brand small{color:#bbbdb8;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.brand strong{font-size:20px;letter-spacing:-.03em}.confidential{padding:7px 11px;border:1px solid rgba(255,255,255,.2);border-radius:999px;color:#d6d7d3;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .content{padding:36px 34px 30px}.eyebrow{margin:0;color:var(--tone);font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.title-row{display:flex;align-items:start;justify-content:space-between;gap:20px;margin:8px 0 10px}.title-row h1{margin:0;max-width:620px;font-size:clamp(30px,5vw,48px);line-height:1;letter-spacing:-.055em}.status{flex:none;padding:8px 12px;border:1px solid var(--tone);border-radius:999px;background:var(--tone-soft);color:var(--tone);font-size:11px;font-weight:900;text-transform:uppercase}.meta{margin:0 0 30px;color:var(--muted);font-size:12px}
    .metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.metric{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:center;padding:18px;border:1px solid var(--line);border-radius:18px;background:#fafaf7;break-inside:avoid}.metric-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--tone-soft);color:var(--tone)}.metric-icon svg{width:22px;height:22px}.metric span,.metric strong{display:block}.metric span{color:var(--muted);font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.metric strong{margin-top:2px;font-size:20px;line-height:1.15;letter-spacing:-.025em}
    .section-title{display:flex;align-items:center;gap:10px;margin:32px 0 12px;padding-bottom:10px;border-bottom:1px solid var(--line)}.section-title svg{width:21px;height:21px;color:var(--tone)}.section-title h2{margin:0;font-size:17px;letter-spacing:-.02em}.note-list{display:grid;gap:10px}.note-card{display:grid;grid-template-columns:34px 1fr;gap:12px;padding:16px;border:1px solid var(--line);border-radius:16px;break-inside:avoid}.note-card>svg{width:22px;height:22px;color:var(--tone)}.note-card h3,.note-card p{margin:0}.note-card h3{font-size:12px}.note-card p{margin-top:4px;color:#414541;font-size:13px;white-space:pre-wrap}.empty{margin:0;color:var(--muted);font-size:13px}
    .notice{display:grid;grid-template-columns:32px 1fr;gap:12px;margin-top:30px;padding:17px;border-left:4px solid var(--amber);border-radius:4px 15px 15px 4px;background:#fbf5e9;break-inside:avoid}.notice svg{width:24px;height:24px;color:var(--amber)}.notice strong,.notice p{display:block;margin:0}.notice strong{font-size:12px}.notice p{margin-top:3px;color:#5e5548;font-size:11px}
    footer{display:flex;justify-content:space-between;gap:20px;padding:18px 34px;border-top:1px solid var(--line);color:var(--muted);font-size:10px}.icon{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    @media(max-width:620px){.page{width:100%;margin:0;border:0;border-radius:0}.masthead,.content{padding:24px 20px}.metric-grid{grid-template-columns:1fr}.title-row{display:grid}.status{justify-self:start}footer{padding:16px 20px}}
    @page{size:auto;margin:14mm}
    @media print{body{background:#fff}.page{width:100%;margin:0;border:0;border-radius:0;box-shadow:none}.masthead{border-radius:0}.content{padding:28px 0 22px}footer{padding:14px 0}.metric,.note-card,.notice,.masthead{break-inside:avoid}}
  </style>
</head>
<body>
  <main class="page">
    <header class="masthead">
      <div class="brand"><span class="mark">${brandIcon()}</span><span><small>Athlete Reload</small><strong>Readiness Planner</strong></span></div>
      <span class="confidential">Private report</span>
    </header>
    <div class="content">
      <p class="eyebrow">Pain and soreness summary</p>
      <div class="title-row"><h1>${escapeHtml(summary.label || 'Reported pain')} summary</h1><span class="status">${tone.label}</span></div>
      <p class="meta">Generated ${escapeHtml(generatedAt)}${recipient ? ` &middot; Prepared for ${escapeHtml(recipient)}` : ''}</p>
      <section class="metric-grid">
        ${metricCard('Current severity', `${currentSeverity}/10`, severityIcon())}
        ${metricCard('Highest recorded', `${peakSeverity}/10`, trendIcon())}
        ${metricCard('First reported', escapeHtml(summary.firstReportedDate || 'Not recorded'), calendarIcon())}
        ${metricCard('Current status', escapeHtml(issue.status || 'Not yet tracked'), statusIcon())}
      </section>
      ${summary.trigger ? `<div class="section-title">${activityIcon()}<h2>Reported trigger</h2></div><section class="note-card">${activityIcon()}<div><h3>Movement or activity</h3><p>${escapeHtml(summary.trigger)}</p></div></section>` : ''}
      <div class="section-title">${notesIcon()}<h2>Notes and observations</h2></div>
      <div class="note-list">${notes || '<p class="empty">No additional notes were included in this report.</p>'}</div>
      <aside class="notice">${alertIcon()}<div><strong>Training information, not medical clearance</strong><p>This summary contains athlete-entered information and is not medical advice, a diagnosis, or clearance to participate. Seek prompt medical attention for severe pain, instability, numbness, inability to bear weight, trouble breathing, fainting, or rapidly worsening symptoms.</p></div></aside>
    </div>
    <footer><span>Athlete Reload &middot; Private athlete information</span><span>Generated for informed discussion</span></footer>
  </main>
</body>
</html>`
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character])
}

function normalizeSeverity(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(10, Math.round(number))) : 0
}

function getSeverityTone(severity) {
  if (severity >= 6) return { color: '#a83e35', soft: '#faece9', label: 'Higher concern' }
  if (severity >= 3) return { color: '#9a6419', soft: '#fbf2df', label: 'Monitor closely' }
  return { color: '#337255', soft: '#eaf4ee', label: 'Low reported severity' }
}

function metricCard(label, value, icon) {
  return `<article class="metric"><span class="metric-icon">${icon}</span><div><span>${label}</span><strong>${value}</strong></div></article>`
}

function svg(paths) {
  return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">${paths}</svg>`
}

function brandIcon() { return svg('<path d="M5 18 12 4l7 14M8 13h8"/>') }
function severityIcon() { return svg('<path d="m13 2-2 7h5l-6 13 2-9H7l6-11Z"/>') }
function trendIcon() { return svg('<path d="M4 17 9 12l3 3 7-8M14 7h5v5"/>') }
function calendarIcon() { return svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/>') }
function statusIcon() { return svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>') }
function activityIcon() { return svg('<path d="M3 12h4l2-5 5 11 2-6h5"/>') }
function notesIcon() { return svg('<path d="M6 3h9l3 3v15H6zM15 3v4h4M9 11h6M9 15h6"/>') }
function alertIcon() { return svg('<path d="M12 3 2.8 20h18.4L12 3ZM12 9v4.5M12 17h.01"/>') }
function noteIcon(type) {
  if (type === 'medical') return svg('<path d="M9 4h6v16H9zM4 9h16v6H4z"/>')
  if (type === 'clipboard') return svg('<path d="M7 5h10v16H7zM9 3h6v4H9zM10 11h4M10 15h4"/>')
  return svg('<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>')
}
