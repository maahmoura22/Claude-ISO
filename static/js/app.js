/* Sistema de Gestão – Engenharia Metalúrgica ISO */

// ── Toast notifications ────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 350);
  }, 4000);
}

// ── Modal helpers ──────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Sidebar mobile toggle ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const ham = document.getElementById('hamburger');
  const sb  = document.querySelector('.sidebar');
  if (ham && sb) {
    ham.addEventListener('click', () => sb.classList.toggle('open'));
    document.addEventListener('click', function(e) {
      if (!sb.contains(e.target) && e.target !== ham) sb.classList.remove('open');
    });
  }

  // Confirma fechar modais via botão .modal-close
  document.querySelectorAll('.modal-close[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // Realça link ativo na sidebar
  const links = document.querySelectorAll('.nav-link');
  const path  = window.location.pathname.split('?')[0];
  links.forEach(l => {
    const href = l.getAttribute('href');
    if (href === path || (href !== '/' && path.startsWith(href))) {
      l.classList.add('active');
    }
  });
});

// ── Checklist dinâmico ─────────────────────────────────────────────
function initChecklist(osId) {
  const items    = document.querySelectorAll('.checklist-item input[type="checkbox"]');
  const bar      = document.getElementById('checklist-bar');
  const pct      = document.getElementById('checklist-pct');
  const btnAv    = document.getElementById('btn-avancar');

  function updateProgress() {
    const total   = items.length;
    const checked = Array.from(items).filter(i => i.checked).length;
    const percent = total ? Math.round(checked / total * 100) : 0;
    if (bar)  bar.style.width = percent + '%';
    if (pct)  pct.textContent = percent + '%';
    if (btnAv) {
      btnAv.disabled = percent < 100;
      btnAv.title = percent < 100 ? 'Complete o checklist (100%) para avançar' : 'Avançar para Processista';
    }
  }

  items.forEach(item => {
    item.addEventListener('change', function() {
      const li = this.closest('.checklist-item');
      if (li) li.classList.toggle('checked', this.checked);
      updateProgress();
      saveChecklist();
    });
  });
  updateProgress();

  function saveChecklist() {
    const data = { preenchido_por: document.getElementById('preenchido_por')?.value || '' };
    items.forEach(i => { data[i.name] = i.checked; });
    fetch(`/os/${osId}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()).then(d => {
      if (d.completo && btnAv) {
        showToast('Checklist completo! OS pode avançar.', 'success');
      }
    });
  }
}

// ── Avançar / Voltar status ────────────────────────────────────────
function avancarStatus(osId) {
  const usuario = document.getElementById('usuario-select')?.value || 'Patrick';
  const obs     = document.getElementById('obs-avancar')?.value || '';
  fetch(`/os/${osId}/avancar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, obs })
  }).then(r => r.json()).then(d => {
    if (d.error) { showToast(d.error, 'error'); return; }
    showToast(`Status avançado: ${d.icon} ${d.label}`, 'success');
    setTimeout(() => location.reload(), 1200);
  });
}

function voltarStatus(osId) {
  const usuario = document.getElementById('usuario-select')?.value || 'Patrick';
  const obs     = prompt('Motivo do retorno (opcional):') || 'Retornado pelo supervisor';
  fetch(`/os/${osId}/voltar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, obs })
  }).then(r => r.json()).then(d => {
    if (d.error) { showToast(d.error, 'error'); return; }
    showToast(`Status retornado: ${d.icon} ${d.label}`, 'info');
    setTimeout(() => location.reload(), 1200);
  });
}

// ── Resolver erro/NC ───────────────────────────────────────────────
function resolverErro(id) {
  const acao = document.getElementById(`acao-${id}`)?.value || '';
  if (!acao.trim()) { showToast('Informe a ação corretiva.', 'warning'); return; }
  fetch(`/erros/${id}/resolver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao })
  }).then(r => r.json()).then(d => {
    if (d.success) { showToast('Erro/NC marcado como resolvido.', 'success'); setTimeout(() => location.reload(), 1200); }
  });
}

// ── Filtro de tabela ───────────────────────────────────────────────
function initTableFilter(inputId, tableId) {
  const input = document.getElementById(inputId);
  const table = document.getElementById(tableId);
  if (!input || !table) return;
  input.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    table.querySelectorAll('tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ── Chart mini (canvas puro, sem dependências externas) ───────────
function drawPieChart(canvasId, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const total  = data.reduce((a, b) => a + b, 0);
  if (!total) return;
  let start = -Math.PI / 2;
  const cx = canvas.width / 2, cy = canvas.height / 2, r = Math.min(cx, cy) - 8;
  data.forEach((val, i) => {
    const angle = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i] || '#888';
    ctx.fill();
    start += angle;
  });
  // Furo (donut)
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#161b22';
  ctx.fill();
  // Total no centro
  ctx.fillStyle = '#e6edf3';
  ctx.font = `bold ${Math.round(r * 0.4)}px Segoe UI, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy);
}

function drawBarChart(canvasId, labels, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const pad    = { top: 16, right: 12, bottom: 36, left: 36 };
  const W      = canvas.width - pad.left - pad.right;
  const H      = canvas.height - pad.top - pad.bottom;
  const max    = Math.max(...data, 1);
  const bw     = W / data.length * 0.6;
  const gap    = W / data.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Gridlines
  ctx.strokeStyle = '#21262d';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + H - (i / 4) * H;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + W, y); ctx.stroke();
    ctx.fillStyle = '#6e7681';
    ctx.font = '10px Segoe UI';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(max * i / 4), pad.left - 4, y + 3);
  }

  // Bars
  data.forEach((val, i) => {
    const x = pad.left + i * gap + (gap - bw) / 2;
    const h = (val / max) * H;
    const y = pad.top + H - h;
    ctx.fillStyle = color || '#58a6ff';
    ctx.beginPath();
    ctx.roundRect(x, y, bw, h, [4, 4, 0, 0]);
    ctx.fill();
    // Label
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + bw / 2, pad.top + H + 16);
    // Valor
    if (val > 0) {
      ctx.fillStyle = '#e6edf3';
      ctx.fillText(val, x + bw / 2, y - 4);
    }
  });
}
