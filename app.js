// ===== Il mio erbario - logica principale =====
const GITHUB_USER = 'rubiscogreendesign-creator';
const GITHUB_REPO = 'erbario';
const GITHUB_BRANCH = 'main';
const TOKEN_KEY = 'erbario_github_token';

// ===== Utilities =====
const CARD_PALETTE = [
  ['#3d5a7c', '#2d4560'], ['#b85d5d', '#9c4848'],
  ['#5d8a6b', '#416654'], ['#c4974a', '#a67a34'],
  ['#7a5b8a', '#5d446b'], ['#4a7a94', '#345d75'],
  ['#8a6a4a', '#6b5038'],
];

function colorFor(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return CARD_PALETTE[Math.abs(h) % CARD_PALETTE.length];
}

function speciesInitials(sci) {
  const parts = sci.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return sci.slice(0, 2).toUpperCase();
}

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function normalizeSearch(text) {
  return (text || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getToken() { return localStorage.getItem(TOKEN_KEY); }

// ===== Multi-file data loading =====
async function discoverDataFiles() {
  const mainFile = 'data/plants.json';
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/data?ref=${GITHUB_BRANCH}`
    );
    if (resp.ok) {
      const list = await resp.json();
      const files = list
        .filter(f => f.type === 'file' && f.name.endsWith('.json') && !f.name.startsWith('_'))
        .map(f => 'data/' + f.name);
      // Assicura che plants.json sia sempre incluso per primo (priorità in caso di ID duplicati)
      const sorted = files.sort((a, b) => {
        if (a === mainFile) return -1;
        if (b === mainFile) return 1;
        return a.localeCompare(b);
      });
      return sorted.length ? sorted : [mainFile];
    }
  } catch(e) { console.warn('Discovery failed, fallback to plants.json:', e); }
  return [mainFile];
}

async function loadAllPlants() {
  const files = await discoverDataFiles();
  const allPlants = [];
  const seen = new Set();
  for (const file of files) {
    try {
      const resp = await fetch(file + '?t=' + Date.now()); // bust cache
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.plants && Array.isArray(data.plants)) {
        for (const p of data.plants) {
          if (!p.id || seen.has(p.id)) continue;
          seen.add(p.id);
          p._source_file = file;
          p._searchIndex = buildSearchIndex(p);
          allPlants.push(p);
        }
      }
    } catch(e) { console.warn('Failed to load ' + file, e); }
  }
  return allPlants;
}

function buildSearchIndex(plant) {
  return [
    plant.scientific_name,
    (plant.common_names || []).join(' '),
    plant.family, plant.subfamily, plant.genus, plant.species,
    (plant.tags || []).join(' '),
    plant.origin,
    plant.anecdote
  ].filter(Boolean).map(normalizeSearch).join(' ');
}

function plantMatchesQuery(plant, query) {
  if (!query) return true;
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.every(t => plant._searchIndex.includes(t));
}

// ===== Image loading =====
async function loadPlantImage(imgElement, plant) {
  if (plant.images && plant.images.length > 0 && plant.images[0]) {
    imgElement.onload = () => imgElement.classList.add('loaded');
    imgElement.src = plant.images[0];
    return;
  }
  const title = plant.wikipedia_title || plant.scientific_name.replace(/\s+/g, '_');
  for (const lang of ['it', 'en', 'es']) {
    try {
      const resp = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const url = (data.originalimage && data.originalimage.source) ||
                  (data.thumbnail && data.thumbnail.source);
      if (url) {
        imgElement.onload = () => imgElement.classList.add('loaded');
        imgElement.src = url;
        return;
      }
    } catch(e) {}
  }
}

// ===== Rendering =====
function renderPlantCard(plant) {
  const [c1, c2] = colorFor(plant.scientific_name);
  const card = document.createElement('article');
  card.className = 'plant-card';
  card.style.setProperty('--card-color', c1);
  card.style.setProperty('--card-color-2', c2);

  const commons = (plant.common_names && plant.common_names.length)
    ? plant.common_names.join(', ') : '';
  const tagsHtml = (plant.tags && plant.tags.length)
    ? `<div class="plant-tags">${plant.tags.map(t => `<span class="plant-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  const invBadge = (plant.quantity !== undefined)
    ? `<div class="inventory-badge">${plant.quantity > 0 ? '×' + plant.quantity : '—'}</div>`
    : '';

  card.innerHTML = `
    ${invBadge}
    <div class="plant-image">
      <div class="placeholder"><span>${speciesInitials(plant.scientific_name)}</span></div>
      <img alt="${escapeHtml(plant.scientific_name)}" loading="lazy" />
    </div>
    <div class="plant-body">
      <h3 class="plant-scientific">${escapeHtml(plant.scientific_name)}</h3>
      ${commons ? `<p class="plant-common">${escapeHtml(commons)}</p>` : ''}
      ${tagsHtml}
    </div>
  `;
  loadPlantImage(card.querySelector('img'), plant);
  card.addEventListener('click', () => showPlantModal(plant));
  return card;
}

function renderFamilySection(family, plants) {
  const section = document.createElement('section');
  section.className = 'family-section';
  section.id = 'family-' + slugify(family);
  const header = document.createElement('header');
  header.className = 'family-header';
  header.innerHTML = `
    <h2 class="family-name">${escapeHtml(family)}</h2>
    <span class="family-count">${plants.length} ${plants.length === 1 ? 'scheda' : 'schede'}</span>
  `;
  section.appendChild(header);
  const grid = document.createElement('div');
  grid.className = 'plant-grid';
  plants.forEach(p => grid.appendChild(renderPlantCard(p)));
  section.appendChild(grid);
  return section;
}

// ===== Modal dettaglio scheda =====
function showPlantModal(plant) {
  const [c1, c2] = colorFor(plant.scientific_name);
  const taxFields = [
    { label: 'Famiglia', value: plant.family },
    { label: 'Sottofamiglia', value: plant.subfamily },
    { label: 'Genere', value: plant.genus },
    { label: 'Specie', value: plant.species }
  ];
  const taxHtml = taxFields.filter(f => f.value)
    .map(f => `<div class="modal-tax-row"><span class="modal-tax-label">${f.label}</span><span class="modal-tax-value">${escapeHtml(f.value)}</span></div>`)
    .join('');
  const commons = (plant.common_names && plant.common_names.length)
    ? plant.common_names.join(', ') : '';
  const tagsHtml = (plant.tags && plant.tags.length)
    ? `<div class="modal-tags">${plant.tags.map(t => `<span class="plant-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  const wikiTitle = plant.wikipedia_title || plant.scientific_name.replace(/\s+/g, '_');
  const wikiUrl = `https://en.wikipedia.org/wiki/${wikiTitle}`;
  const editUrl = `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/edit/${GITHUB_BRANCH}/${plant._source_file || 'data/plants.json'}`;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="Chiudi">×</button>
      <div class="modal-image" style="background: linear-gradient(135deg, ${c1}, ${c2});">
        <div class="placeholder"><span>${speciesInitials(plant.scientific_name)}</span></div>
        <img alt="${escapeHtml(plant.scientific_name)}" />
      </div>
      <div class="modal-body">
        <h2 class="modal-title">${escapeHtml(plant.scientific_name)}</h2>
        ${commons ? `<p class="modal-common">${escapeHtml(commons)}</p>` : ''}
        ${tagsHtml}

        ${taxHtml ? `<div class="modal-section"><h4>Classificazione</h4><div class="modal-taxonomy">${taxHtml}</div></div>` : ''}
        ${plant.origin ? `<div class="modal-section"><h4>Origine</h4><p class="modal-text">${escapeHtml(plant.origin)}</p></div>` : ''}
        ${plant.anecdote ? `<div class="modal-section"><h4>Aneddoto</h4><p class="modal-text">${escapeHtml(plant.anecdote)}</p></div>` : ''}
        ${plant.notes ? `<div class="modal-section"><h4>Note personali</h4><p class="modal-text">${escapeHtml(plant.notes)}</p></div>` : ''}

        <div class="modal-section">
          <h4>Inventario personale</h4>
          <div class="inv-control" id="inv-control-slot"></div>
        </div>

        <div class="modal-links">
          <a class="modal-link" href="${wikiUrl}" target="_blank" rel="noopener">Scheda Wikipedia →</a>
          <a class="modal-link" href="${editUrl}" target="_blank" rel="noopener">Modifica su GitHub →</a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  void modal.offsetHeight;
  modal.classList.add('show');
  loadPlantImage(modal.querySelector('.modal-image img'), plant);

  renderInventoryControl(modal.querySelector('#inv-control-slot'), plant);

  function close() {
    modal.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escHandler);
  }
  function escHandler(e) { if (e.key === 'Escape') close(); }
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', escHandler);
}

// ===== Inventory controls (nel modal) =====
function renderInventoryControl(slot, plant) {
  slot.innerHTML = '';
  if (plant.quantity === undefined) {
    // Non ancora in inventario
    const btn = document.createElement('button');
    btn.className = 'inv-btn-add';
    btn.textContent = '+ Aggiungi al mio inventario';
    btn.addEventListener('click', async () => {
      if (!getToken()) {
        alert('Per modificare l\'inventario serve il token GitHub. Vai su "Cerca specie" (🔍) e clicca ⚙️ Token per configurarlo.');
        return;
      }
      btn.disabled = true;
      const status = document.createElement('span');
      status.className = 'inv-status saving';
      status.textContent = 'Salvando…';
      slot.appendChild(status);
      try {
        await updatePlantField(plant, { quantity: 1 });
        renderInventoryControl(slot, plant);
      } catch(e) {
        console.error(e);
        status.className = 'inv-status error';
        status.textContent = 'Errore: ' + describeError(e);
        btn.disabled = false;
      }
    });
    slot.appendChild(btn);
  } else {
    // Già in inventario
    const group = document.createElement('div');
    group.className = 'inv-qty-group';
    const minus = document.createElement('button');
    minus.className = 'inv-qty-btn'; minus.textContent = '−';
    minus.disabled = plant.quantity <= 0;
    const qty = document.createElement('span');
    qty.className = 'inv-qty-display'; qty.textContent = plant.quantity;
    const plus = document.createElement('button');
    plus.className = 'inv-qty-btn'; plus.textContent = '+';
    group.append(minus, qty, plus);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'inv-btn-remove';
    removeBtn.textContent = 'Rimuovi dall\'inventario';

    const status = document.createElement('span');
    status.className = 'inv-status';

    slot.append(group, removeBtn, status);

    let saveTimer = null;
    const commitChange = async (newQty) => {
      clearTimeout(saveTimer);
      status.className = 'inv-status saving';
      status.textContent = 'Salvando…';
      try {
        await updatePlantField(plant, { quantity: newQty });
        status.className = 'inv-status saved';
        status.textContent = 'Salvato ✓';
      } catch(e) {
        console.error(e);
        status.className = 'inv-status error';
        status.textContent = 'Errore: ' + describeError(e);
      }
    };

    const schedule = (newQty) => {
      plant.quantity = newQty;
      qty.textContent = newQty;
      minus.disabled = newQty <= 0;
      status.className = 'inv-status';
      status.textContent = 'Modifica in attesa…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => commitChange(newQty), 900);
    };

    minus.addEventListener('click', () => {
      if (plant.quantity > 0) schedule(plant.quantity - 1);
    });
    plus.addEventListener('click', () => schedule(plant.quantity + 1));

    removeBtn.addEventListener('click', async () => {
      if (!confirm(`Rimuovere ${plant.scientific_name} dall'inventario?`)) return;
      clearTimeout(saveTimer);
      status.className = 'inv-status saving';
      status.textContent = 'Rimozione…';
      removeBtn.disabled = true;
      try {
        await updatePlantField(plant, { quantity: '__DELETE__' });
        renderInventoryControl(slot, plant);
      } catch(e) {
        console.error(e);
        status.className = 'inv-status error';
        status.textContent = 'Errore: ' + describeError(e);
        removeBtn.disabled = false;
      }
    });
  }
}

function describeError(err) {
  const msg = err.message || String(err);
  if (msg.includes('401') || msg.includes('Bad credentials')) {
    return 'token non valido. Riconfigura in Cerca specie → ⚙️ Token.';
  }
  if (msg.includes('403')) return 'permessi insufficienti.';
  if (msg.includes('409')) return 'conflitto, riprova tra poco.';
  return msg.length > 80 ? msg.slice(0, 80) + '…' : msg;
}

// ===== GitHub API write =====
async function updatePlantField(plant, updates) {
  const token = getToken();
  if (!token) throw new Error('Token non configurato');
  const file = plant._source_file || 'data/plants.json';

  // Fetch current
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${file}?ref=${GITHUB_BRANCH}`;
  const fetchResp = await fetch(apiUrl, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
  });
  if (!fetchResp.ok) {
    const t = await fetchResp.text().catch(() => '');
    throw new Error(`GitHub API ${fetchResp.status}: ${t || fetchResp.statusText}`);
  }
  const data = await fetchResp.json();
  const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));

  // Find and update plant
  const idx = content.plants.findIndex(p => p.id === plant.id);
  if (idx === -1) throw new Error('Pianta non trovata nel file');

  for (const [key, val] of Object.entries(updates)) {
    if (val === '__DELETE__') {
      delete content.plants[idx][key];
      delete plant[key];
    } else {
      content.plants[idx][key] = val;
      plant[key] = val;
    }
  }
  content.updated = new Date().toISOString().slice(0, 10);

  // Write back
  const jsonStr = JSON.stringify(content, null, 2) + '\n';
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
  const writeResp = await fetch(
    `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${file}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Aggiorno ${plant.scientific_name}`,
        content: base64, sha: data.sha, branch: GITHUB_BRANCH
      })
    }
  );
  if (!writeResp.ok) {
    const t = await writeResp.text().catch(() => '');
    throw new Error(`GitHub API ${writeResp.status}: ${t || writeResp.statusText}`);
  }
  // Ricostruisci l'indice di ricerca della scheda
  plant._searchIndex = buildSearchIndex(plant);
  return true;
}

// ===== State globale =====
let allPlantsLoaded = [];
let currentFilter = '';

function renderFiltered() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const filtered = currentFilter
    ? allPlantsLoaded.filter(p => plantMatchesQuery(p, currentFilter))
    : allPlantsLoaded;

  const countEl = document.getElementById('count-display');
  if (currentFilter) {
    countEl.textContent = `${filtered.length} di ${allPlantsLoaded.length}`;
  } else {
    const n = allPlantsLoaded.length;
    countEl.textContent = `${n} ${n === 1 ? 'scheda' : 'schede'}`;
  }

  if (filtered.length === 0) {
    app.innerHTML = currentFilter
      ? '<div class="empty-state">Nessuna pianta corrisponde alla ricerca.</div>'
      : '<div class="empty-state">Nessuna pianta ancora archiviata.</div>';
    return;
  }

  const families = {};
  for (const p of filtered) {
    const fam = p.family || 'Senza famiglia';
    (families[fam] = families[fam] || []).push(p);
  }
  Object.keys(families).sort().forEach(fam => {
    families[fam].sort((a, b) => a.scientific_name.localeCompare(b.scientific_name));
    app.appendChild(renderFamilySection(fam, families[fam]));
  });
}

// ===== Filter input =====
document.getElementById('search-filter-input').addEventListener('input', e => {
  currentFilter = e.target.value.trim();
  document.getElementById('clear-filter-btn').style.display = currentFilter ? 'block' : 'none';
  renderFiltered();
});
document.getElementById('clear-filter-btn').addEventListener('click', () => {
  const input = document.getElementById('search-filter-input');
  input.value = '';
  currentFilter = '';
  document.getElementById('clear-filter-btn').style.display = 'none';
  renderFiltered();
  input.focus();
});

// ===== Boot =====
loadAllPlants()
  .then(plants => {
    allPlantsLoaded = plants;
    renderFiltered();
  })
  .catch(err => {
    document.getElementById('app').innerHTML =
      `<div class="empty-state">Errore nel caricamento: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  });
