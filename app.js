/* ══════════════════════════════════════════
   MINHA DOCERIA — app.js
   ══════════════════════════════════════════ */

const SB_URL = 'https://jirrnzmysqusuezmjqgt.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcnJuem15c3F1c3Vlem1qcWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTI2OTIsImV4cCI6MjA4OTg2ODY5Mn0.adDRbR6VBLVF69_qooBQX19MR4oXOOvNRbI05no-syI';
const H = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
const STORAGE_BUCKET = 'insumos-fotos';

// ── SUPABASE REST ──
async function sbGet(table, params = '') {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: H });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(table, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPatch(table, id, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'PATCH', headers: { ...H, 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbDelete(table, id) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: H });
  if (!r.ok) throw new Error(await r.text());
}

// ── STORAGE: removido (sem foto) ──

// ── UTILS ──
const fmt = v => 'R$\u00a0' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const loadingHtml = () => `<div class="loading"><div class="spinner"></div>Carregando...</div>`;

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3200);
}
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.querySelectorAll('#' + id + ' input[type=date]').forEach(i => { if (!i.value) i.value = today(); });
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.querySelector('.sidebar-overlay').classList.toggle('open'); }
function closeSidebar()  { document.querySelector('.sidebar').classList.remove('open'); document.querySelector('.sidebar-overlay').classList.remove('open'); }

function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('[data-page="' + name + '"]').forEach(b => b.classList.add('active'));
  closeSidebar();
  const loaders = { dashboard: loadDashboard, insumos: loadInsumos, precificacao: loadPrecificacoes, vendas: loadVendas, compras: loadCompras, financeiro: loadMovimentacoes, relatorio: initRelatorio };
  if (loaders[name]) loaders[name]();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); }));
  document.querySelectorAll('input[type=month]').forEach(i => i.value = thisMonth());
  loadDashboard();
});

// ══ CHARTS ══
let chartMensal, chartPizza;
function renderChartMensal(labels, vendas, compras) {
  if (chartMensal) chartMensal.destroy();
  chartMensal = new Chart(document.getElementById('chart-mensal').getContext('2d'), {
    type: 'bar', data: { labels, datasets: [
      { label: 'Vendas', data: vendas, backgroundColor: '#00a5c230', borderColor: '#00a5c2', borderWidth: 2, borderRadius: 6 },
      { label: 'Compras', data: compras, backgroundColor: '#d94f4f30', borderColor: '#d94f4f', borderWidth: 2, borderRadius: 6 }
    ]},
    options: { responsive: true, maintainAspectRatio: true,
      plugins: { legend: { labels: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#4a7080' } } },
      scales: { y: { ticks: { callback: v => 'R$' + v.toLocaleString('pt-BR'), font: { family: 'Poppins', size: 10 }, color: '#4a7080' }, grid: { color: '#e8f4f7' } }, x: { ticks: { font: { family: 'Plus Jakarta Sans', size: 10 }, color: '#4a7080' }, grid: { display: false } } }
    }
  });
}
function renderChartPizza(tv, tc) {
  if (chartPizza) chartPizza.destroy();
  if (!tv && !tc) return;
  chartPizza = new Chart(document.getElementById('chart-pizza').getContext('2d'), {
    type: 'doughnut', data: { labels: ['Vendas', 'Compras'], datasets: [{ data: [tv, tc], backgroundColor: ['#00a5c2', '#d94f4f'], borderWidth: 0, hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#4a7080', padding: 12 } } } }
  });
}

// ══ DASHBOARD ══
async function loadDashboard() {
  document.getElementById('dash-data').textContent = 'Atualizado em ' + new Date().toLocaleString('pt-BR');
  try {
    const [vendas, compras, todasMovs] = await Promise.all([
      sbGet('vendas', 'select=valor,data,status_pagamento'),
      sbGet('compras', 'select=valor,data'),
      sbGet('movimentacoes', 'select=valor,tipo,categoria')
    ]);
    const m = thisMonth();
    const vMes = vendas.filter(x => x.data && x.data.startsWith(m));
    const cMes = compras.filter(x => x.data && x.data.startsWith(m));
    const totalV = vMes.reduce((a, x) => a + Number(x.valor), 0);
    const totalC = cMes.reduce((a, x) => a + Number(x.valor), 0);
    const totV = vendas.reduce((a, x) => a + Number(x.valor), 0);
    const totC = compras.reduce((a, x) => a + Number(x.valor), 0);
    // Saldo = todas entradas (vendas + manuais) - todas saídas (compras + manuais)
    const totalEntradas = todasMovs.filter(x => x.tipo === 'entrada').reduce((a, x) => a + Number(x.valor), 0);
    const totalSaidas   = todasMovs.filter(x => x.tipo === 'saida').reduce((a, x) => a + Number(x.valor), 0);
    const saldo = totalEntradas - totalSaidas;
    const lucro = totalV - totalC;
    document.getElementById('c-saldo').textContent = fmt(saldo); document.getElementById('c-saldo').className = 'card-value ' + (saldo >= 0 ? 'green' : 'red');
    document.getElementById('c-vendas').textContent = fmt(totalV); document.getElementById('c-compras').textContent = fmt(totalC);
    document.getElementById('c-vendas-n').textContent = vMes.length + ' transações'; document.getElementById('c-compras-n').textContent = cMes.length + ' transações';
    document.getElementById('c-lucro').textContent = fmt(lucro); document.getElementById('c-lucro').className = 'card-value ' + (lucro >= 0 ? 'green' : 'red');
    const meses = [], dadosV = [], dadosC = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const key = d.toISOString().slice(0, 7); meses.push(d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })); dadosV.push(vendas.filter(x => x.data && x.data.startsWith(key)).reduce((a, x) => a + Number(x.valor), 0)); dadosC.push(compras.filter(x => x.data && x.data.startsWith(key)).reduce((a, x) => a + Number(x.valor), 0)); }
    renderChartMensal(meses, dadosV, dadosC); renderChartPizza(totV, totC);
    const movs = await sbGet('movimentacoes', 'select=*&order=criado_em.desc&limit=8');
    const el = document.getElementById('dash-ultimas');
    if (!movs.length) { el.innerHTML = '<div class="empty"><p>Nenhuma movimentação ainda</p></div>'; return; }
    el.innerHTML = `<div class="table-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${movs.map(r => `<tr><td>${fmtDate(r.data)}</td><td><strong>${r.descricao || '—'}</strong></td><td><span class="badge ${r.categoria || r.tipo}">${r.categoria || r.tipo}</span></td><td><span class="num" style="font-weight:600;color:${r.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}">${r.tipo === 'entrada' ? '+' : '-'}${fmt(r.valor)}</span></td></tr><div class="row-card"><div class="row-card-top"><span class="row-card-title">${r.descricao || '—'}</span><span class="row-card-value" style="color:${r.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}">${r.tipo === 'entrada' ? '+' : '-'}${fmt(r.valor)}</span></div><div class="row-card-meta"><span class="row-card-date">${fmtDate(r.data)}</span><span class="badge ${r.categoria || r.tipo}">${r.categoria || r.tipo}</span></div></div>`).join('')}</tbody></table></div>`;
  } catch (e) { showToast('Erro no dashboard: ' + e.message, 'error'); }
}

// ══════════════════════════════════════════
// INSUMOS — custo unitário por unidade base
// ══════════════════════════════════════════

// Mapeia unidade → {base, fator} para conversão
// ex: kg → base='g', fator=1000 (1kg=1000g)
const UNID_MAP = {
  'kg':  { base: 'g',  fator: 1000 },
  'L':   { base: 'ml', fator: 1000 },
  'g':   { base: 'g',  fator: 1 },
  'ml':  { base: 'ml', fator: 1 },
  'un':  { base: 'un', fator: 1 },
  'cx':  { base: 'cx', fator: 1 },
  'pct': { base: 'pct',fator: 1 },
};

// Calcula custo por unidade base dado: custo embalagem, tamanho embalagem, unidade
function calcCustoBase(custo, embalagem, unidade) {
  const map = UNID_MAP[unidade] || { base: unidade, fator: 1 };
  // pct: divide pelo número de unidades no pacote
  if (unidade === 'pct') {
    const qtd = embalagem || 1;
    return qtd > 0 ? custo / qtd : 0;
  }
  const qtd = (unidade === 'kg' || unidade === 'L' || unidade === 'g' || unidade === 'ml') ? (embalagem || map.fator) : map.fator;
  return qtd > 0 ? custo / qtd : 0;
}

function updateCustoLabel() {
  const un = document.getElementById('mi-unidade').value;
  const wrap = document.getElementById('mi-embalagem-wrap');
  const lbl  = document.getElementById('mi-custo-label');
  const embUnit = document.getElementById('mi-embalagem-unit');
  const embLbl  = document.getElementById('mi-embalagem-label');
  if (un === 'kg') {
    wrap.style.display = 'block'; lbl.textContent = 'Custo da embalagem (R$)';
    embUnit.textContent = 'g'; embLbl.textContent = 'Tamanho da embalagem (g)';
    document.getElementById('mi-embalagem').placeholder = '1000';
  } else if (un === 'L') {
    wrap.style.display = 'block'; lbl.textContent = 'Custo da embalagem (R$)';
    embUnit.textContent = 'ml'; embLbl.textContent = 'Tamanho da embalagem (ml)';
    document.getElementById('mi-embalagem').placeholder = '1000';
  } else if (un === 'g') {
    wrap.style.display = 'block'; lbl.textContent = 'Custo do pacote (R$)';
    embUnit.textContent = 'g'; embLbl.textContent = 'Gramagem do pacote (g)';
    document.getElementById('mi-embalagem').placeholder = '500';
  } else if (un === 'ml') {
    wrap.style.display = 'block'; lbl.textContent = 'Custo da embalagem (R$)';
    embUnit.textContent = 'ml'; embLbl.textContent = 'Volume da embalagem (ml)';
    document.getElementById('mi-embalagem').placeholder = '500';
  } else if (un === 'pct') {
    wrap.style.display = 'block'; lbl.textContent = 'Custo do pacote (R$)';
    embUnit.textContent = 'un'; embLbl.textContent = 'Unidades por pacote';
    document.getElementById('mi-embalagem').placeholder = '10';
  } else {
    wrap.style.display = 'none'; lbl.textContent = 'Custo por unidade (R$)';
  }
  updateCustoUnitInfo();
}

function updateCustoUnitInfo() {
  const un    = document.getElementById('mi-unidade').value;
  const custo = parseFloat(document.getElementById('mi-custo').value) || 0;
  const emb   = parseFloat(document.getElementById('mi-embalagem')?.value) || 0;
  const info  = document.getElementById('custo-unit-info');
  if (!custo) { info.style.display = 'none'; return; }
  const map = UNID_MAP[un] || { base: un, fator: 1 };
  let custoBase;
  if (un === 'kg' || un === 'L' || un === 'g' || un === 'ml' || un === 'pct') {
    const qtd = emb || map.fator;
    custoBase = qtd > 0 ? custo / qtd : 0;
    const baseLabel = un === 'pct' ? 'un' : map.base;
    document.getElementById('custo-unit-valor').textContent = fmt(custoBase) + ' / ' + baseLabel;
  } else {
    custoBase = custo;
    document.getElementById('custo-unit-valor').textContent = fmt(custoBase) + ' / ' + map.base;
  }
  info.style.display = 'block';
}

function abrirModalInsumo(insumo = null) {
  document.getElementById('mi-id').value = '';
  document.getElementById('mi-nome').value = '';
  document.getElementById('mi-unidade').value = 'un';
  document.getElementById('mi-custo').value = '';
  document.getElementById('mi-fornecedor').value = '';
  document.getElementById('mi-obs').value = '';
  if (document.getElementById('mi-embalagem')) document.getElementById('mi-embalagem').value = '';
  document.getElementById('custo-unit-info').style.display = 'none';
  document.getElementById('mi-embalagem-wrap').style.display = 'none';
  document.getElementById('modal-insumo-title').textContent = 'Novo Insumo';

  if (insumo) {
    document.getElementById('modal-insumo-title').textContent = 'Editar Insumo';
    document.getElementById('mi-id').value = insumo.id;
    document.getElementById('mi-nome').value = insumo.nome || '';
    document.getElementById('mi-unidade').value = insumo.unidade || 'un';
    document.getElementById('mi-custo').value = insumo.custo_embalagem || insumo.custo_unitario || '';
    document.getElementById('mi-fornecedor').value = insumo.fornecedor || '';
    document.getElementById('mi-obs').value = insumo.observacoes || '';
    if (insumo.embalagem_qtd) document.getElementById('mi-embalagem').value = insumo.embalagem_qtd;
    updateCustoLabel();
    updateCustoUnitInfo();
  }
  openModal('modal-insumo');
}

async function saveInsumo() {
  const id         = document.getElementById('mi-id').value;
  const nome       = document.getElementById('mi-nome').value.trim();
  const unidade    = document.getElementById('mi-unidade').value;
  const custoEmb   = parseFloat(document.getElementById('mi-custo').value) || 0;
  const embQtd     = parseFloat(document.getElementById('mi-embalagem')?.value) || 0;
  const fornecedor = document.getElementById('mi-fornecedor').value.trim();
  const obs        = document.getElementById('mi-obs').value;
  if (!nome) { showToast('Informe o nome do insumo', 'error'); return; }

  const custoBase = calcCustoBase(custoEmb, embQtd, unidade);
  try {
    const payload = { nome, unidade, custo_unitario: custoBase, custo_embalagem: custoEmb, embalagem_qtd: embQtd || null, fornecedor, observacoes: obs };
    if (id) await sbPatch('insumos', id, payload);
    else    await sbPost('insumos', payload);
    closeModal('modal-insumo');
    showToast(id ? 'Insumo atualizado!' : 'Insumo salvo!', 'success');
    loadInsumos();
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

async function loadInsumos() {
  document.getElementById('grid-insumos').innerHTML = loadingHtml();
  try {
    const data = await sbGet('insumos', 'select=*&order=nome.asc');
    if (!data.length) { document.getElementById('grid-insumos').innerHTML = '<div class="empty"><p>Nenhum insumo cadastrado. Clique em "+ Novo Insumo" para começar.</p></div>'; return; }
    document.getElementById('grid-insumos').innerHTML = data.map(r => {
      const map = UNID_MAP[r.unidade] || { base: r.unidade };
      return `<div class="insumo-card">
        <div class="insumo-card-body">
          <div class="insumo-card-nome">${r.nome}</div>
          <div class="insumo-card-custo">${fmt(r.custo_unitario)} / ${map.base}</div>
          ${r.custo_embalagem ? `<div class="insumo-card-unit">Embalagem: ${fmt(r.custo_embalagem)}${r.embalagem_qtd ? ' — ' + r.embalagem_qtd + map.base : ''}</div>` : ''}
          ${r.fornecedor ? `<div class="insumo-card-forn">${r.fornecedor}</div>` : ''}
          <div class="insumo-card-actions">
            <button class="btn btn-edit btn-sm" onclick='abrirModalInsumo(${JSON.stringify(r)})'>Editar</button>
            <button class="btn btn-danger btn-sm" onclick="del('insumos','${r.id}',loadInsumos)">Excluir</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

// ══════════════════════════════════════════
// PRECIFICAÇÃO — com linhas de insumos
// ══════════════════════════════════════════
let _insumos = []; // cache para os selects
let _linhaCont = 0;

async function abrirModalPrec(prec = null) {
  _linhaCont = 0;
  document.getElementById('mp-id').value = '';
  document.getElementById('mp-nome').value = '';
  document.getElementById('mp-rendimento').value = '1';
  document.getElementById('mp-obs').value = '';
  document.getElementById('mp-insumos-lista').innerHTML = '';
  document.getElementById('modal-prec-title').textContent = prec ? 'Editar Precificação' : 'Nova Precificação';

  // Carrega insumos
  try { _insumos = await sbGet('insumos', 'select=*&order=nome.asc'); } catch { _insumos = []; }

  if (prec) {
    document.getElementById('mp-id').value = prec.id;
    document.getElementById('mp-nome').value = prec.produto_nome || '';
    document.getElementById('mp-rendimento').value = (() => { try { const p = prec.insumos_json ? JSON.parse(prec.insumos_json) : {}; return Array.isArray(p) ? (prec.rendimento || 1) : (p.rendimento || 1); } catch { return prec.rendimento || 1; } })();
    document.getElementById('mp-obs').value = prec.observacoes || '';
    // Carrega linhas de insumos salvas
    const linhas = (() => { try { const p = prec.insumos_json ? JSON.parse(prec.insumos_json) : []; return Array.isArray(p) ? p : (p.linhas || []); } catch { return []; } })();
    linhas.forEach(l => addInsumoLinha(l));
  } else {
    addInsumoLinha();
  }
  recalcPrec();
  openModal('modal-prec');
}

function addInsumoLinha(dados = null) {
  const id = _linhaCont++;
  const opts = _insumos.map(i => `<option value="${i.id}" data-custo="${i.custo_unitario}" data-unid="${UNID_MAP[i.unidade]?.base || i.unidade}" ${dados && dados.insumo_id === i.id ? 'selected' : ''}>${i.nome} (${fmt(i.custo_unitario)}/${UNID_MAP[i.unidade]?.base || i.unidade})</option>`).join('');
  const div = document.createElement('div');
  div.className = 'prec-insumo-linha';
  div.id = 'linha-' + id;
  div.innerHTML = `
    <select onchange="recalcPrec()" id="linha-sel-${id}">
      <option value="">Selecionar insumo...</option>${opts}
    </select>
    <div style="display:flex;gap:4px;align-items:center">
      <input type="number" id="linha-qtd-${id}" placeholder="0" step="0.01" min="0" value="${dados?.quantidade || ''}" oninput="recalcPrec()" style="width:80px">
      <span id="linha-unid-${id}" style="font-size:.78rem;color:var(--text3);white-space:nowrap">${dados ? (UNID_MAP[_insumos.find(i=>i.id===dados.insumo_id)?.unidade]?.base || '') : ''}</span>
    </div>
    <span class="prec-insumo-custo linha-custo-display" id="linha-custo-${id}">—</span>
    <button class="btn-remove-linha" onclick="removeLinha('linha-${id}')">&#215;</button>
  `;
  document.getElementById('mp-insumos-lista').appendChild(div);
  // Atualiza unidade quando seleciona insumo
  document.getElementById('linha-sel-' + id).addEventListener('change', function() {
    const opt = this.options[this.selectedIndex];
    const custo = opt.getAttribute('data-custo');
    const unid  = opt.getAttribute('data-unid');
    document.getElementById('linha-unid-' + id).textContent = unid || '';
    recalcPrec();
  });
  if (dados?.insumo_id) {
    const sel = document.getElementById('linha-sel-' + id);
    sel.value = dados.insumo_id;
    sel.dispatchEvent(new Event('change'));
  }
}

function removeLinha(idDiv) { const el = document.getElementById(idDiv); if (el) { el.remove(); recalcPrec(); } }

function recalcPrec() {
  let totalInsumos = 0;
  document.querySelectorAll('#mp-insumos-lista .prec-insumo-linha').forEach(linha => {
    const idN     = linha.id.replace('linha-','');
    const sel     = document.getElementById('linha-sel-'  + idN);
    const qtdEl   = document.getElementById('linha-qtd-'  + idN);
    const custoEl = document.getElementById('linha-custo-'+ idN);
    if (!sel || !qtdEl) return;
    const opt       = sel.options[sel.selectedIndex];
    const custoUnit = parseFloat(opt?.getAttribute('data-custo')) || 0;
    const qtd       = parseFloat(qtdEl.value) || 0;
    const subtotal  = custoUnit * qtd;
    if (custoEl) custoEl.textContent = fmt(subtotal);
    totalInsumos += subtotal;
  });

  const lucroInsumos = totalInsumos * 0.20;          // +20% sobre insumos
  const subtotal1    = totalInsumos + lucroInsumos;  // subtotal

  const rendimento   = Math.max(1, parseInt(document.getElementById('mp-rendimento')?.value) || 1);
  const custoUnit    = subtotal1 / rendimento;        // custo por unidade
  const maoObra      = custoUnit * 0.20;             // +20% de mão de obra por unidade
  const sugerido     = custoUnit + maoObra;           // preço sugerido por unidade

  document.getElementById('mp-custo-insumos').textContent  = fmt(totalInsumos);
  document.getElementById('mp-lucro-insumos').textContent  = fmt(lucroInsumos);
  document.getElementById('mp-subtotal').textContent       = fmt(subtotal1);
  document.getElementById('mp-custo-unit').textContent     = fmt(custoUnit);
  document.getElementById('mp-margem-final').textContent   = fmt(maoObra);
  document.getElementById('mp-preco-sugerido').textContent = fmt(sugerido);
}

async function savePrec() {
  const id   = document.getElementById('mp-id').value;
  const nome = document.getElementById('mp-nome').value.trim();
  const obs  = document.getElementById('mp-obs').value;
  if (!nome) { showToast('Informe o nome do produto', 'error'); return; }

  const linhas = [];
  document.querySelectorAll('#mp-insumos-lista .prec-insumo-linha').forEach(linha => {
    const idN = linha.id.replace('linha-','');
    const sel = document.getElementById('linha-sel-' + idN);
    const qtd = parseFloat(document.getElementById('linha-qtd-' + idN)?.value) || 0;
    if (!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    linhas.push({ insumo_id: sel.value, nome: opt.text.split(' (')[0], quantidade: qtd, custo_unit: parseFloat(opt.getAttribute('data-custo')) || 0 });
  });

  const totalInsumos = linhas.reduce((a, l) => a + l.custo_unit * l.quantidade, 0);
  const rendimento   = Math.max(1, parseInt(document.getElementById('mp-rendimento').value) || 1);
  const subtotal1    = totalInsumos * 1.20;
  const custoUnit    = subtotal1 / rendimento;
  const preco_final  = custoUnit * 1.20;   // + 20% mão de obra por unidade

  const payload = { produto_nome: nome, custo_ingredientes: totalInsumos, mao_de_obra: 0, preco_final, observacoes: obs, insumos_json: JSON.stringify({ linhas, rendimento }) };
  try {
    if (id) await sbPatch('precificacoes', id, payload);
    else    await sbPost('precificacoes', payload);
    closeModal('modal-prec');
    showToast(id ? 'Precificação atualizada!' : 'Precificação salva!', 'success');
    loadPrecificacoes();
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

async function loadPrecificacoes() {
  document.getElementById('lista-precificacoes').innerHTML = loadingHtml();
  try {
    const data = await sbGet('precificacoes', 'select=*&order=criado_em.desc');
    if (!data.length) { document.getElementById('lista-precificacoes').innerHTML = '<div class="empty"><p>Nenhuma precificação salva. Clique em "+ Nova Precificação".</p></div>'; return; }
    document.getElementById('lista-precificacoes').innerHTML = data.map(p => {
      const _parsed = p.insumos_json ? JSON.parse(p.insumos_json) : []; const linhas = Array.isArray(_parsed) ? _parsed : (_parsed.linhas || []); const _rend = Array.isArray(_parsed) ? (p.rendimento || 1) : (_parsed.rendimento || 1);
      const tags = linhas.map(l => `<span class="prec-card-tag">${l.nome} — ${l.quantidade}${UNID_MAP[_insumos.find(i=>i.id===l.insumo_id)?.unidade]?.base || ''}</span>`).join('');
      return `<div class="prec-card">
        <div class="prec-card-header">
          <span class="prec-card-nome">${p.produto_nome}</span>
          <span class="prec-card-preco">${fmt(p.preco_final)}</span>
        </div>
        ${tags ? `<div class="prec-card-insumos">${tags}</div>` : ''}
        <div style="font-size:.82rem;color:var(--text3);margin-bottom:10px">
          Insumos: ${fmt(p.custo_ingredientes)} | Rende: ${_rend} un | Preço/un: ${fmt(p.preco_final)}
          ${p.observacoes ? ' | ' + p.observacoes : ''}
        </div>
        <div class="prec-card-actions">
          <button class="btn btn-edit btn-sm" onclick='abrirModalPrec(${JSON.stringify(p).replace(/'/g,"&#39;")})'>Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('precificacoes','${p.id}',loadPrecificacoes)">Excluir</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

// ══════════════════════════════════════════
// VENDAS — com produto + qty + pagamento
// ══════════════════════════════════════════
let _precCache = [];
let _pagStatus = 'pago';

function setPagStatus(status) {
  _pagStatus = status;
  document.getElementById('pag-pago').classList.toggle('active', status === 'pago');
  document.getElementById('pag-pendente').classList.toggle('active', status === 'pendente');
}

async function abrirModalVenda(venda = null) {
  _pagStatus = 'pago';
  setPagStatus('pago');
  document.getElementById('mv-id').value = '';
  document.getElementById('mv-produto').value = '';
  document.getElementById('mv-qty').value = '1';
  document.getElementById('mv-preco-unit').value = '';
  document.getElementById('mv-desc').value = '';
  document.getElementById('mv-obs').value = '';
  document.getElementById('mv-total-preview').textContent = 'R$ 0,00';
  document.getElementById('modal-venda-title').textContent = venda ? 'Editar Venda' : 'Registrar Venda';
  try { _precCache = await sbGet('precificacoes', 'select=id,produto_nome,preco_final&order=produto_nome.asc'); } catch { _precCache = []; }
  document.getElementById('mv-produto').innerHTML = '<option value="">Selecionar produto...</option>' +
    _precCache.map(p => `<option value="${p.id}" data-nome="${p.produto_nome}" data-preco="${p.preco_final}">${p.produto_nome} — ${fmt(p.preco_final)}</option>`).join('');
  if (venda) {
    document.getElementById('mv-id').value = venda.id;
    document.getElementById('mv-desc').value = venda.descricao || '';
    document.getElementById('mv-qty').value  = venda.quantidade || 1;
    document.getElementById('mv-preco-unit').value = venda.preco_unitario || '';
    document.getElementById('mv-data').value = venda.data || today();
    document.getElementById('mv-obs').value  = venda.observacoes || '';
    setPagStatus(venda.status_pagamento || 'pago');
    recalcVenda();
  } else {
    document.getElementById('mv-data').value = today();
  }
  openModal('modal-venda');
}

function onProdutoSelect() {
  const sel = document.getElementById('mv-produto');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  document.getElementById('mv-desc').value = opt.getAttribute('data-nome') || '';
  document.getElementById('mv-preco-unit').value = parseFloat(opt.getAttribute('data-preco') || 0).toFixed(2);
  recalcVenda();
}
function changeQty(delta) { const el = document.getElementById('mv-qty'); el.value = Math.max(1, (parseInt(el.value) || 1) + delta); recalcVenda(); }
function recalcVenda() {
  const qty = parseInt(document.getElementById('mv-qty').value) || 1;
  const preco = parseFloat(document.getElementById('mv-preco-unit').value) || 0;
  document.getElementById('mv-total-preview').textContent = fmt(qty * preco);
}

async function saveVenda() {
  const id    = document.getElementById('mv-id').value;
  const qty   = parseInt(document.getElementById('mv-qty').value)  || 1;
  const unit  = parseFloat(document.getElementById('mv-preco-unit').value) || 0;
  const valor = qty * unit;
  const desc  = document.getElementById('mv-desc').value.trim();
  const data  = document.getElementById('mv-data').value;
  const obs   = document.getElementById('mv-obs').value;
  if (!desc)  { showToast('Informe a descrição', 'error'); return; }
  if (!valor) { showToast('Informe o preço unitário', 'error'); return; }
  const payload = { descricao: desc, valor, data, observacoes: obs, quantidade: qty, preco_unitario: unit, status_pagamento: _pagStatus };
  try {
    if (id) {
      await sbPatch('vendas', id, payload);
    } else {
      await sbPost('vendas', payload);
      await sbPost('movimentacoes', { tipo: 'entrada', descricao: 'Venda: ' + desc, valor, data, categoria: 'venda' });
    }
    closeModal('modal-venda'); showToast(id ? 'Venda atualizada!' : 'Venda registrada!', 'success'); loadVendas();
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

async function loadVendas() {
  document.getElementById('lista-vendas').innerHTML = loadingHtml();
  const mes = document.getElementById('filtro-vendas-mes').value;
  const ord = document.getElementById('filtro-vendas-ord').value;
  let params = `select=*&order=data.${ord},criado_em.${ord}`;
  if (mes) params += `&data=gte.${mes}-01&data=lte.${mes}-31`;
  try {
    const data = await sbGet('vendas', params);
    const total = data.reduce((a, x) => a + Number(x.valor), 0);
    document.getElementById('total-vendas-label').textContent = `Total: ${fmt(total)} (${data.length} venda${data.length !== 1 ? 's' : ''})`;
    if (!data.length) { document.getElementById('lista-vendas').innerHTML = '<div class="empty"><p>Nenhuma venda no período</p></div>'; return; }
    const rows = data.map(r => {
      const pend = r.status_pagamento === 'pendente';
      return `<tr class="${pend ? 'pendente' : ''}">
        <td>${fmtDate(r.data)}</td>
        <td><strong>${r.descricao}</strong></td>
        <td><span class="num">${r.quantidade || 1}</span></td>
        <td><span class="num">${fmt(r.preco_unitario || r.valor)}</span></td>
        <td><span class="num" style="font-weight:700;color:var(--green)">${fmt(r.valor)}</span></td>
        <td><span class="badge ${r.status_pagamento || 'pago'}">${r.status_pagamento === 'pendente' ? 'Pendente' : 'Pago'}</span></td>
        <td style="color:var(--text3);font-size:.82rem">${r.observacoes || '—'}</td>
        <td class="td-actions">
          <button class="btn btn-edit btn-sm" onclick='abrirModalVenda(${JSON.stringify(r).replace(/'/g,"&#39;")})'>Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('vendas','${r.id}',loadVendas)">Excluir</button>
        </td>
      </tr>
      <div class="row-card ${pend ? 'pendente' : ''}">
        <div class="row-card-top">
          <span class="row-card-title">${r.descricao}</span>
          <span class="row-card-value" style="color:var(--green)">${fmt(r.valor)}</span>
        </div>
        <div class="row-card-meta">
          <span class="row-card-date">${fmtDate(r.data)}</span>
          <span style="font-size:.74rem;color:var(--text3)">${r.quantidade || 1}x — ${fmt(r.preco_unitario || r.valor)}</span>
          <span class="badge ${r.status_pagamento || 'pago'}">${r.status_pagamento === 'pendente' ? 'Pendente' : 'Pago'}</span>
          <button class="btn btn-edit btn-sm" onclick='abrirModalVenda(${JSON.stringify(r).replace(/'/g,"&#39;")})'>Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('vendas','${r.id}',loadVendas)">Excluir</button>
        </div>
      </div>`;
    }).join('');
    document.getElementById('lista-vendas').innerHTML = `<div class="table-scroll"><table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Qtd.</th><th>Unit.</th><th>Total</th><th>Pagamento</th><th>Obs.</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

// ══ COMPRAS ══
async function saveCompra() {
  const id    = document.getElementById('mc-id').value;
  const desc  = document.getElementById('mc-desc').value.trim();
  const valor = parseFloat(document.getElementById('mc-valor').value) || 0;
  const data  = document.getElementById('mc-data').value;
  const obs   = document.getElementById('mc-obs').value;
  if (!desc || !valor) { showToast('Preencha descrição e valor', 'error'); return; }
  const payload = { descricao: desc, valor, data, observacoes: obs };
  try {
    if (id) { await sbPatch('compras', id, payload); }
    else { await sbPost('compras', payload); await sbPost('movimentacoes', { tipo: 'saida', descricao: 'Compra: ' + desc, valor, data, categoria: 'compra' }); }
    closeModal('modal-compra'); showToast(id ? 'Compra atualizada!' : 'Compra registrada!', 'success'); loadCompras();
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

function abrirModalCompra(compra = null) {
  document.getElementById('mc-id').value = '';
  document.getElementById('mc-desc').value = '';
  document.getElementById('mc-valor').value = '';
  document.getElementById('mc-obs').value = '';
  document.getElementById('modal-compra-title').textContent = compra ? 'Editar Compra' : 'Registrar Compra';
  if (compra) {
    document.getElementById('mc-id').value    = compra.id;
    document.getElementById('mc-desc').value  = compra.descricao || '';
    document.getElementById('mc-valor').value = compra.valor || '';
    document.getElementById('mc-data').value  = compra.data || today();
    document.getElementById('mc-obs').value   = compra.observacoes || '';
  } else {
    document.getElementById('mc-data').value = today();
  }
  openModal('modal-compra');
}

async function loadCompras() {
  document.getElementById('lista-compras').innerHTML = loadingHtml();
  const mes = document.getElementById('filtro-compras-mes').value;
  const ord = document.getElementById('filtro-compras-ord').value;
  let params = `select=*&order=data.${ord},criado_em.${ord}`;
  if (mes) params += `&data=gte.${mes}-01&data=lte.${mes}-31`;
  try {
    const data = await sbGet('compras', params);
    const total = data.reduce((a, x) => a + Number(x.valor), 0);
    document.getElementById('total-compras-label').textContent = `Total: ${fmt(total)} (${data.length} compra${data.length !== 1 ? 's' : ''})`;
    if (!data.length) { document.getElementById('lista-compras').innerHTML = '<div class="empty"><p>Nenhuma compra no período</p></div>'; return; }
    const rows = data.map(r => `
      <tr>
        <td>${fmtDate(r.data)}</td><td><strong>${r.descricao}</strong></td>
        <td><span class="num" style="font-weight:700;color:var(--red)">${fmt(r.valor)}</span></td>
        <td style="color:var(--text3);font-size:.82rem">${r.observacoes || '—'}</td>
        <td class="td-actions">
          <button class="btn btn-edit btn-sm" onclick='abrirModalCompra(${JSON.stringify(r).replace(/'/g,"&#39;")})'>Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('compras','${r.id}',loadCompras)">Excluir</button>
        </td>
      </tr>
      <div class="row-card">
        <div class="row-card-top"><span class="row-card-title">${r.descricao}</span><span class="row-card-value" style="color:var(--red)">${fmt(r.valor)}</span></div>
        <div class="row-card-meta">
          <span class="row-card-date">${fmtDate(r.data)}</span>
          <span class="row-card-obs">${r.observacoes || ''}</span>
          <button class="btn btn-edit btn-sm" onclick='abrirModalCompra(${JSON.stringify(r).replace(/'/g,"&#39;")})'>Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('compras','${r.id}',loadCompras)">Excluir</button>
        </div>
      </div>`).join('');
    document.getElementById('lista-compras').innerHTML = `<div class="table-scroll"><table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Obs.</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

// ══ FINANCEIRO ══
function abrirModalMov(mov = null) {
  document.getElementById('mm-id').value = '';
  document.getElementById('mm-desc').value = '';
  document.getElementById('mm-valor').value = '';
  document.getElementById('modal-mov-title').textContent = mov ? 'Editar Movimentação' : 'Movimentação Manual';
  if (mov) {
    document.getElementById('mm-id').value    = mov.id;
    document.getElementById('mm-tipo').value  = mov.tipo;
    document.getElementById('mm-desc').value  = mov.descricao || '';
    document.getElementById('mm-valor').value = mov.valor || '';
    document.getElementById('mm-data').value  = mov.data || today();
  } else {
    document.getElementById('mm-tipo').value = 'entrada';
    document.getElementById('mm-data').value = today();
  }
  openModal('modal-mov');
}

async function saveMov() {
  const id    = document.getElementById('mm-id').value;
  const tipo  = document.getElementById('mm-tipo').value;
  const desc  = document.getElementById('mm-desc').value.trim();
  const valor = parseFloat(document.getElementById('mm-valor').value) || 0;
  const data  = document.getElementById('mm-data').value;
  if (!desc || !valor) { showToast('Preencha todos os campos', 'error'); return; }
  const payload = { tipo, descricao: desc, valor, data, categoria: 'manual' };
  try {
    if (id) await sbPatch('movimentacoes', id, payload);
    else    await sbPost('movimentacoes', payload);
    closeModal('modal-mov'); showToast(id ? 'Atualizado!' : 'Movimentação salva!', 'success'); loadMovimentacoes();
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

async function loadMovimentacoes() {
  document.getElementById('lista-movimentacoes').innerHTML = loadingHtml();
  const mes  = document.getElementById('filtro-mov-mes').value;
  const tipo = document.getElementById('filtro-mov-tipo').value;
  let params = 'select=*&order=data.desc,criado_em.desc';
  if (mes)  params += `&data=gte.${mes}-01&data=lte.${mes}-31`;
  if (tipo) params += `&tipo=eq.${tipo}`;
  try {
    const all  = await sbGet('movimentacoes', 'select=valor,tipo');
    const entT = all.filter(x => x.tipo === 'entrada').reduce((a, x) => a + Number(x.valor), 0);
    const saiT = all.filter(x => x.tipo === 'saida').reduce((a, x) => a + Number(x.valor), 0);
    document.getElementById('fin-entradas').textContent = fmt(entT);
    document.getElementById('fin-saidas').textContent   = fmt(saiT);
    const saldo = entT - saiT;
    document.getElementById('fin-saldo').textContent = fmt(saldo);
    document.getElementById('fin-saldo').className   = 'card-value ' + (saldo >= 0 ? 'green' : 'red');
    const data = await sbGet('movimentacoes', params);
    if (!data.length) { document.getElementById('lista-movimentacoes').innerHTML = '<div class="empty"><p>Nenhuma movimentação no período</p></div>'; return; }
    const rows = data.map(r => `
      <tr>
        <td>${fmtDate(r.data)}</td><td><strong>${r.descricao}</strong></td>
        <td><span class="badge ${r.categoria}">${r.categoria}</span></td>
        <td><span class="badge ${r.tipo}">${r.tipo}</span></td>
        <td><span class="num" style="font-weight:700;color:${r.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}">${r.tipo === 'entrada' ? '+' : '-'}${fmt(r.valor)}</span></td>
        <td class="td-actions">
          <button class="btn btn-edit btn-sm" onclick='abrirModalMov(${JSON.stringify(r).replace(/'/g,"&#39;")})'>Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('movimentacoes','${r.id}',loadMovimentacoes)">Excluir</button>
        </td>
      </tr>
      <div class="row-card">
        <div class="row-card-top"><span class="row-card-title">${r.descricao}</span><span class="row-card-value" style="color:${r.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}">${r.tipo === 'entrada' ? '+' : '-'}${fmt(r.valor)}</span></div>
        <div class="row-card-meta">
          <span class="row-card-date">${fmtDate(r.data)}</span>
          <span class="badge ${r.tipo}">${r.tipo}</span><span class="badge ${r.categoria}">${r.categoria}</span>
          <button class="btn btn-edit btn-sm" onclick='abrirModalMov(${JSON.stringify(r).replace(/'/g,"&#39;")})'>Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('movimentacoes','${r.id}',loadMovimentacoes)">Excluir</button>
        </div>
      </div>`).join('');
    document.getElementById('lista-movimentacoes').innerHTML = `<div class="table-scroll"><table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

// ══ RELATÓRIO ══
function initRelatorio() {
  const now = new Date();
  if (!document.getElementById('rel-inicio').value) document.getElementById('rel-inicio').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  if (!document.getElementById('rel-fim').value)    document.getElementById('rel-fim').value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
}
async function gerarRelatorio() {
  const ini = document.getElementById('rel-inicio').value; const fim = document.getElementById('rel-fim').value;
  if (!ini || !fim) { showToast('Selecione o período', 'error'); return; }
  try {
    const [vendas, compras] = await Promise.all([sbGet('vendas', `select=*&data=gte.${ini}&data=lte.${fim}&order=data.asc`), sbGet('compras', `select=*&data=gte.${ini}&data=lte.${fim}&order=data.asc`)]);
    const tv = vendas.reduce((a, x) => a + Number(x.valor), 0); const tc = compras.reduce((a, x) => a + Number(x.valor), 0); const lucro = tv - tc;
    document.getElementById('rel-cards').style.display = 'grid';
    document.getElementById('rel-v').textContent = fmt(tv); document.getElementById('rel-c').textContent = fmt(tc); document.getElementById('rel-l').textContent = fmt(lucro);
    document.getElementById('rel-l').className = 'card-value ' + (lucro >= 0 ? 'green' : 'red');
    document.getElementById('rel-vn').textContent = vendas.length + ' vendas'; document.getElementById('rel-cn').textContent = compras.length + ' compras';
    let html = '';
    if (vendas.length) html += `<div class="table-wrap" style="margin-bottom:16px"><div class="table-header"><h3>Vendas no período</h3></div><div class="table-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Qtd.</th><th>Valor</th><th>Pagamento</th></tr></thead><tbody>${vendas.map(r => `<tr class="${r.status_pagamento==='pendente'?'pendente':''}"><td>${fmtDate(r.data)}</td><td>${r.descricao}</td><td><span class="num">${r.quantidade||1}</span></td><td><span class="num" style="color:var(--green);font-weight:600">${fmt(r.valor)}</span></td><td><span class="badge ${r.status_pagamento||'pago'}">${r.status_pagamento==='pendente'?'Pendente':'Pago'}</span></td></tr><div class="row-card ${r.status_pagamento==='pendente'?'pendente':''}"><div class="row-card-top"><span class="row-card-title">${r.descricao}</span><span class="row-card-value" style="color:var(--green)">${fmt(r.valor)}</span></div><div class="row-card-meta"><span class="row-card-date">${fmtDate(r.data)}</span><span class="badge ${r.status_pagamento||'pago'}">${r.status_pagamento==='pendente'?'Pendente':'Pago'}</span></div></div>`).join('')}</tbody></table></div></div>`;
    if (compras.length) html += `<div class="table-wrap"><div class="table-header"><h3>Compras no período</h3></div><div class="table-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Obs.</th></tr></thead><tbody>${compras.map(r => `<tr><td>${fmtDate(r.data)}</td><td>${r.descricao}</td><td><span class="num" style="color:var(--red);font-weight:600">${fmt(r.valor)}</span></td><td style="color:var(--text3)">${r.observacoes||'—'}</td></tr><div class="row-card"><div class="row-card-top"><span class="row-card-title">${r.descricao}</span><span class="row-card-value" style="color:var(--red)">${fmt(r.valor)}</span></div><div class="row-card-meta"><span class="row-card-date">${fmtDate(r.data)}</span></div></div>`).join('')}</tbody></table></div></div>`;
    if (!html) html = '<div class="empty"><p>Nenhum dado neste período</p></div>';
    document.getElementById('rel-detalhe').innerHTML = html; showToast('Relatório gerado!', 'success');
  } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

// ══ DELETE ══
async function del(table, id, reload) {
  if (!confirm('Excluir este registro?')) return;
  try { await sbDelete(table, id); showToast('Excluído!', 'success'); reload(); }
  catch (e) { showToast('Erro: ' + e.message, 'error'); }
}
