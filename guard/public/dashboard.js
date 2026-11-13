'use strict';

const TERMINAL = new Set(['loop_done', 'loop_escalated', 'loop_would_act']);

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

async function load() {
  try {
    const res = await fetch('/api/ledger', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { events } = await res.json();
    render(events);
  } catch (err) {
    document.getElementById('status').textContent = 'error: ' + err.message;
  }
}

function groupByIteration(events) {
  // Kelompok hanya dipisah oleh `trigger`.
  //
  // Event terminal (loop_done / loop_escalated / loop_would_act) TIDAK menutup
  // grup. Alasannya: setelah `loop_would_act`, agent masih bertindak
  // (agent_acted / agent_blocked) sebelum run berikutnya. Aksi-aksi itu
  // milik iterasi yang memutuskan rutenya, bukan grup baru.
  //
  // Status akhir grup ditentukan oleh terminalOf(), yang mencari event
  // terminal terakhir di dalam grup.
  const groups = [];
  let current = null;
  for (const evt of events) {
    if (evt.type === 'trigger') {
      if (current) groups.push(current);
      current = { startTs: evt.ts, trigger: evt, events: [evt] };
    } else if (current) {
      current.events.push(evt);
    } else {
      // Event sebelum trigger pertama (mis. sisa seed) — biarkan jadi grup
      // sendiri agar tidak hilang dari pandangan.
      current = { startTs: evt.ts, trigger: null, events: [evt] };
    }
  }
  if (current) groups.push(current);
  return groups;
}

function terminalOf(iter) {
  // Cari event terakhir yang menentukan nasib iterasi.
  // agent_blocked lebih kuat dari loop_would_act: kalau agent mencoba
  // bertindak dan ditolak, itu cerita yang lebih penting daripada
  // "would act" yang cuma berarti "belum ada aksi".
  for (let i = iter.events.length - 1; i >= 0; i--) {
    const t = iter.events[i].type;
    if (t === 'loop_done') return { kind: 'done', label: 'DONE' };
    if (t === 'loop_escalated') return { kind: 'escalated', label: 'ESCALATED' };
    if (t === 'agent_blocked') return { kind: 'blocked', label: 'BLOCKED' };
    if (t === 'agent_acted') return { kind: 'acted', label: 'ACTED' };
    if (t === 'loop_would_act') return { kind: 'would_act', label: 'WOULD ACT' };
  }
  return { kind: 'running', label: 'RUNNING' };
}

function render(events) {
  const status = document.getElementById('status');
  const summary = document.getElementById('summary');
  const timeline = document.getElementById('timeline');

  if (!events.length) {
    status.textContent = 'ledger kosong';
    summary.innerHTML = '';
    timeline.innerHTML = '<p class="empty">Jalankan <code>node seed.js</code> untuk memuat data replay.</p>';
    return;
  }

  const groups = groupByIteration(events);
  const counts = { done: 0, escalated: 0, would_act: 0, running: 0 };
  for (const g of groups) counts[terminalOf(g).kind]++;

  status.textContent = `${groups.length} iterasi`;
  summary.innerHTML = [
    counts.done ? `<div class="pill done"><b>${counts.done}</b> done</div>` : '',
    counts.would_act ? `<div class="pill would_act"><b>${counts.would_act}</b> would act</div>` : '',
    counts.escalated ? `<div class="pill escalated"><b>${counts.escalated}</b> escalated</div>` : '',
    counts.running ? `<div class="pill running"><b>${counts.running}</b> running</div>` : '',
  ].join('');

  timeline.innerHTML = groups.map((g, i) => renderIteration(g, i + 1)).join('');
}

function renderIteration(group, index) {
  const term = terminalOf(group);
  const file = group.trigger && group.trigger.payload && group.trigger.payload.file
    ? group.trigger.payload.file
    : '(unknown)';
  return `
    <section class="iter iter-${term.kind}">
      <header class="iter-h">
        <span class="iter-num">#${index}</span>
        <span class="iter-file">${esc(file)}</span>
        <span class="iter-badge iter-badge-${term.kind}">${term.label}</span>
      </header>
      <ol class="events">
        ${group.events.map(renderEvent).join('')}
      </ol>
    </section>
  `;
}

function renderEvent(evt) {
  const cls = 'ev ev-' + evt.type.replace(/_/g, '-');
  return `<li class="${cls}">${evtBody(evt)}</li>`;
}

function evtBody(evt) {
  const p = evt.payload || {};
  switch (evt.type) {
    case 'trigger':
      return `<span class="ev-label">trigger</span>${esc(p.source)}${p.file ? ' \u00b7 ' + esc(p.file) : ''}`;
    case 'run_completed':
      return `<span class="ev-label">run</span>${esc(p.verdict)}${p.durationS != null ? ' \u00b7 ' + p.durationS + 's' : ''}`;
    case 'route_decided': {
      const bv = p.bugVerdict;
      const extra = bv ? ` \u00b7 ${esc(bv.family)} \u00b7 confirmed=${bv.confirmed}` : '';
      return `<span class="ev-label">route</span><b>${esc(p.route)}</b>${extra}<div class="ev-reason">${esc(p.reason)}</div>`;
    }
    case 'policy_decided':
      return `<span class="ev-label">policy</span>${p.allowed ? '\u2713 allow' : '\u2717 deny'} <code>${esc(p.action)}</code><div class="ev-reason">${esc(p.reason)}</div>`;
    case 'policy_probe':
      return `<span class="ev-label">probe</span>${p.allowed ? '\u2713 allow' : '\u2717 deny'} <code>${esc(p.action)}</code> <em>(aksi menggoda yang harus ditolak)</em><div class="ev-reason">${esc(p.reason)}</div>`;
    case 'loop_done':
      return `<span class="ev-label">done</span>${esc(p.reason || '')}`;
    case 'loop_would_act':
      return `<span class="ev-label">would act</span>${esc(p.route)} \u2014 ${esc(p.note || '')}`;
    case 'loop_escalated':
      return `<span class="ev-label">escalated</span>${esc(p.reason || '')}`;
    default:
      return `<span class="ev-label">${esc(evt.type)}</span>`;
  }
}

load();
setInterval(load, 2000);
