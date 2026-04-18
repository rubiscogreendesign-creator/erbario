// ===== Il mio erbario - logica principale =====

const DATA_URL = 'data/plants.json';
const GITHUB_USER = 'rubiscogreendesign-creator';
const GITHUB_REPO = 'erbario';
const GITHUB_BRANCH = 'main';

// Palette di colori rotanti per le card senza immagine (hash-based)
const CARD_PALETTE = [
  ['#3d5a7c', '#2d4560'], // blu
  ['#b85d5d', '#9c4848'], // rosso mattone
  ['#5d8a6b', '#416654'], // verde
  ['#c4974a', '#a67a34'], // oro
  ['#7a5b8a', '#5d446b'], // viola
  ['#4a7a94', '#345d75'], // azzurro
  ['#8a6a4a', '#6b5038'], // bronzo
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
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== Caricamento immagine: se URL esplicito, usa quello; altrimenti Wikipedia =====
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
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { 'Accept': 'application/json' } }
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
    } catch(e) { /* try next */ }
  }
}

// ===== Rendering card (lista) =====
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

  card.innerHTML = `
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

  // click = apri modal
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
  const taxHtml = taxFields
    .filter(f => f.value)
    .map(f => `<div class="modal-tax-row"><span class="modal-tax-label">${f.label}</span><span class="modal-tax-value">${escapeHtml(f.value)}</span></div>`)
    .join('');

  const commons = (plant.common_names && plant.common_names.length)
    ? plant.common_names.join(', ') : '';
  const tagsHtml = (plant.tags && plant.tags.length)
    ? `<div class="modal-tags">${plant.tags.map(t => `<span class="plant-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  const wikiTitle = plant.wikipedia_title || plant.scientific_name.replace(/\s+/g, '_');
  const wikiUrl = `https://en.wikipedia.org/wiki/${wikiTitle}`;
  const editUrl = `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/edit/${GITHUB_BRANCH}/data/plants.json`;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-label="Dettaglio pianta">
      <button class="modal-close" aria-label="Chiudi">×</button>
      <div class="modal-image" style="background: linear-gradient(135deg, ${c1}, ${c2});">
        <div class="placeholder"><span>${speciesInitials(plant.scientific_name)}</span></div>
        <img alt="${escapeHtml(plant.scientific_name)}" />
      </div>
      <div class="modal-body">
        <h2 class="modal-title">${escapeHtml(plant.scientific_name)}</h2>
        ${commons ? `<p class="modal-common">${escapeHtml(commons)}</p>` : ''}
        ${tagsHtml}

        ${taxHtml ? `
        <div class="modal-section">
          <h4>Classificazione</h4>
          <div class="modal-taxonomy">${taxHtml}</div>
        </div>` : ''}

        ${plant.origin ? `
        <div class="modal-section">
          <h4>Origine</h4>
          <p class="modal-text">${escapeHtml(plant.origin)}</p>
        </div>` : ''}

        ${plant.anecdote ? `
        <div class="modal-section">
          <h4>Aneddoto</h4>
          <p class="modal-text">${escapeHtml(plant.anecdote)}</p>
        </div>` : ''}

        ${plant.notes ? `
        <div class="modal-section">
          <h4>Note personali</h4>
          <p class="modal-text">${escapeHtml(plant.notes)}</p>
        </div>` : ''}

        <div class="modal-links">
          <a class="modal-link" href="${wikiUrl}" target="_blank" rel="noopener">Scheda Wikipedia →</a>
          <a class="modal-link" href="${editUrl}" target="_blank" rel="noopener">Modifica su GitHub →</a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  // forza layout per animazione
  void modal.offsetHeight;
  modal.classList.add('show');

  // carica immagine
  loadPlantImage(modal.querySelector('.modal-image img'), plant);

  // chiusura
  function close() {
    modal.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escHandler);
  }
  function escHandler(e) {
    if (e.key === 'Escape') close();
  }
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', escHandler);
}

function render(data) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const plants = data.plants || [];
  document.getElementById('count-display').textContent =
    `${plants.length} ${plants.length === 1 ? 'scheda' : 'schede'}`;

  if (plants.length === 0) {
    app.innerHTML = '<div class="empty-state">Nessuna pianta ancora archiviata. Modifica <code>data/plants.json</code> nel tuo repository per aggiungere la prima.</div>';
    return;
  }

  // Raggruppa per famiglia
  const families = {};
  for (const p of plants) {
    const fam = p.family || 'Senza famiglia';
    if (!families[fam]) families[fam] = [];
    families[fam].push(p);
  }

  const sortedFamilies = Object.keys(families).sort();
  for (const fam of sortedFamilies) {
    families[fam].sort((a, b) => a.scientific_name.localeCompare(b.scientific_name));
    app.appendChild(renderFamilySection(fam, families[fam]));
  }
}

// ===== Boot =====
fetch(DATA_URL)
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(render)
  .catch(err => {
    document.getElementById('app').innerHTML =
      `<div class="empty-state">Errore nel caricamento dei dati: ${err.message}</div>`;
    console.error(err);
  });
