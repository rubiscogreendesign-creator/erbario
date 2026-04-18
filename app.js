// ===== Il mio erbario - logica principale =====

const DATA_URL = 'data/plants.json';

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
  // Prende le iniziali delle due parole: "Echium wildpretii" -> "EW"
  const parts = sci.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return sci.slice(0, 2).toUpperCase();
}

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ===== Caricamento immagine: se provided URL, usa quella; altrimenti Wikipedia =====
async function loadPlantImage(card, plant) {
  const img = card.querySelector('img');

  // 1. se c'è un URL esplicito, usa quello
  if (plant.images && plant.images.length > 0 && plant.images[0]) {
    img.onload = () => img.classList.add('loaded');
    img.src = plant.images[0];
    return;
  }

  // 2. fallback su Wikipedia
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
        img.onload = () => img.classList.add('loaded');
        img.src = url;
        return;
      }
    } catch(e) { /* try next */ }
  }
  // Niente immagine -> rimane il placeholder con iniziali
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
    ? `<div class="plant-tags">${plant.tags.map(t => `<span class="plant-tag">${t}</span>`).join('')}</div>`
    : '';

  card.innerHTML = `
    <div class="plant-image">
      <div class="placeholder"><span>${speciesInitials(plant.scientific_name)}</span></div>
      <img alt="${plant.scientific_name}" loading="lazy" />
    </div>
    <div class="plant-body">
      <h3 class="plant-scientific">${plant.scientific_name}</h3>
      ${commons ? `<p class="plant-common">${commons}</p>` : ''}
      ${tagsHtml}
    </div>
  `;
  loadPlantImage(card, plant);
  return card;
}

function renderFamilySection(family, plants) {
  const section = document.createElement('section');
  section.className = 'family-section';
  section.id = 'family-' + slugify(family);

  const header = document.createElement('header');
  header.className = 'family-header';
  header.innerHTML = `
    <h2 class="family-name">${family}</h2>
    <span class="family-count">${plants.length} ${plants.length === 1 ? 'scheda' : 'schede'}</span>
  `;
  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'plant-grid';
  plants.forEach(p => grid.appendChild(renderPlantCard(p)));
  section.appendChild(grid);
  return section;
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

  // Ordina famiglie alfabeticamente, piante all'interno alfabeticamente per nome scientifico
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
