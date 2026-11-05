const MAP_STORAGE_KEY = 'riftlab-rift-map-strategies-v1';
const MAP_COORDINATE_VERSION = 3;
const markerTypes = {
  'ward-ally': { name: 'Sentinela aliada', className: 'ally', icon: 'ward' },
  'ward-control': {
    name: 'Sentinela de controle',
    className: 'control',
    icon: 'control',
  },
  'ward-enemy': { name: 'Sentinela inimiga', className: 'enemy', icon: 'enemy-ward' },
  danger: { name: 'Perigo', className: 'danger', icon: 'danger' },
  interest: { name: 'Ponto de atenção', className: 'interest', icon: 'interest' },
  dragon: { name: 'Covil do Dragão', className: 'objective', icon: 'dragon' },
  baron: { name: 'Covil do Barão', className: 'objective', icon: 'baron' },
  herald: { name: 'Arauto do Vale', className: 'objective', icon: 'herald' },
  'champ-blue': { name: 'Campeão azul', className: 'champ-blue', icon: 'champion' },
  'champ-red': { name: 'Campeão vermelho', className: 'champ-red', icon: 'champion' },
};
const regionLabels = [
  ['Topo', 500, 104, true],
  ['Meio', 510, 505, true],
  ['Rota inferior', 535, 902, true],
  ['Selva azul', 278, 704, false],
  ['Selva vermelha', 724, 298, false],
  ['Rio', 510, 455, true],
  ['Covil do Barão', 390, 280, true],
  ['Covil do Dragão', 620, 526, true],
  ['Base azul', 148, 846, false],
  ['Base vermelha', 752, 116, false],
];
const layerState = {
  regions: true,
  blue: true,
  red: true,
  vision: true,
  objectives: true,
  alerts: true,
  routes: true,
};
const mapUi = {
  status: document.querySelector('#map-status'),
  patch: document.querySelector('#map-patch'),
  viewport: document.querySelector('#map-viewport'),
  canvas: document.querySelector('#map-canvas'),
  image: document.querySelector('#map-image'),
  routes: document.querySelector('#map-routes'),
  regions: document.querySelector('#map-region-labels'),
  markers: document.querySelector('#map-markers'),
  zoom: document.querySelector('#map-zoom'),
  champion: document.querySelector('#map-champion-select'),
  routeWeight: document.querySelector('#map-route-weight'),
  routeWeightValue: document.querySelector('#map-route-weight-value'),
  name: document.querySelector('#map-strategy-name'),
  saved: document.querySelector('#map-saved-strategies'),
};
const mapState = {
  patch: '',
  tool: 'pan',
  zoom: 1,
  panX: 0,
  panY: 0,
  markers: [],
  routes: [],
  saved: readSaved(),
  editingId: null,
  history: [],
  historyIndex: 0,
  pointerMode: '',
  pointerId: null,
  startPointer: null,
  draftPoints: [],
  markerDrag: null,
  champions: [],
  selectedChampion: null,
  pendingChampionTool: '',
};

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(MAP_STORAGE_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(
          (entry) =>
            entry && typeof entry.id === 'string' && typeof entry.name === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function persistSaved() {
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(mapState.saved));
}
function escapeMap(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function snapshot() {
  return JSON.stringify({ markers: mapState.markers, routes: mapState.routes });
}

function pushHistory() {
  mapState.history = mapState.history.slice(0, mapState.historyIndex + 1);
  mapState.history.push(snapshot());
  mapState.historyIndex = mapState.history.length - 1;
  updateHistoryButtons();
}

function restoreSnapshot(value) {
  try {
    const parsed = JSON.parse(value);
    mapState.markers = Array.isArray(parsed.markers) ? parsed.markers : [];
    mapState.routes = Array.isArray(parsed.routes) ? parsed.routes : [];
    renderMapContent();
  } catch {
    mapUi.status.textContent = 'Não foi possível restaurar este estado do mapa.';
  }
}

function updateHistoryButtons() {
  document.querySelector('#map-undo').disabled = mapState.historyIndex <= 0;
  document.querySelector('#map-redo').disabled =
    mapState.historyIndex >= mapState.history.length - 1;
}

function setTool(tool) {
  if (tool.startsWith('champ-') && !mapState.selectedChampion) {
    mapState.pendingChampionTool = tool;
    mapUi.status.textContent = 'Escolha um campeão antes de posicioná-lo no mapa.';
    mapUi.champion.focus();
    return;
  }
  mapState.pendingChampionTool = '';
  mapState.tool = tool;
  mapUi.viewport.dataset.tool = tool;
  document
    .querySelectorAll('[data-map-tool]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.mapTool === tool)),
    );
  const mode =
    tool.startsWith('route-') || tool.startsWith('arrow-')
      ? 'Arraste pelo mapa para desenhar.'
      : tool === 'pan'
        ? 'Arraste pelo mapa para mover a vista.'
        : tool === 'select'
          ? 'Toque ou clique em uma marcação para ver seus detalhes. Arraste para reposicionar.'
          : tool === 'eraser'
            ? 'Clique perto de uma marcação ou rota para removê-la.'
            : `Clique no mapa para adicionar: ${markerTypes[tool]?.name || tool}.`;
  mapUi.status.textContent = mode;
}

function applyTransform() {
  mapUi.canvas.style.transform = `translate(${mapState.panX}px, ${mapState.panY}px) scale(${mapState.zoom})`;
  mapUi.zoom.value = String(mapState.zoom);
  mapUi.canvas.style.setProperty('--map-marker-scale', String(1 / mapState.zoom));
}

function pointFromEvent(event) {
  const rect = mapUi.canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function svgPath(points) {
  if (!points.length) return '';
  const scaled = points.map((point) => ({ x: point.x * 1000, y: point.y * 1000 }));
  if (scaled.length < 3)
    return `M ${scaled[0].x} ${scaled[0].y} L ${scaled.at(-1).x} ${scaled.at(-1).y}`;
  let path = `M ${scaled[0].x} ${scaled[0].y}`;
  for (let index = 1; index < scaled.length - 1; index++) {
    const current = scaled[index];
    const next = scaled[index + 1];
    path += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`;
  }
  const last = scaled.at(-1);
  path += ` T ${last.x} ${last.y}`;
  return path;
}

function iconSvg(name) {
  const paths = {
    select: '<path d="m5 3 14 10-6 1.2L10 20 5 3Z"/>',
    pan: '<path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M21 12l-3-3m3 3-3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3"/>',
    champion: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>',
    ward: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/>',
    control:
      '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><path d="m9 9 3-3 3 3-3 3-3-3Z"/>',
    enemy:
      '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><path d="m9 9 6 0m-3-3v6"/>',
    dragon:
      '<path d="M4 15c3-1 3-5 6-7l2 3 3-5 1 5 4 2-4 2-2 4-3-3-4 2 1-4Z"/><path d="m7 10-3-2m12 0 3-3"/>',
    baron:
      '<path d="M5 19c2-5 1-10 7-14 6 4 5 9 7 14-3-1-5-2-7-2s-4 1-7 2Z"/><path d="M9 12h6m-3-4v8"/>',
    herald:
      '<path d="M4 18c2-6 2-10 8-13 6 3 6 7 8 13l-8-2-8 2Z"/><circle cx="12" cy="12" r="2"/>',
    route:
      '<path d="M4 18c5-12 10 6 16-8"/><circle cx="4" cy="18" r="1"/><circle cx="20" cy="10" r="1"/>',
    arrow: '<path d="M4 17c5-10 10 4 16-8"/><path d="m15 8 5 1-1 5"/>',
    danger: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
    interest:
      '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9L12 3Z"/>',
    eraser: '<path d="m3 15 9-10 9 8-7 7H8l-5-5Z"/><path d="m9 8 8 8"/>',
  };
  const type = name.startsWith('route-')
    ? 'route'
    : name.startsWith('arrow-')
      ? 'arrow'
      : name.startsWith('champ-')
        ? 'champion'
        : name;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type] || paths.select}</svg>`;
}

function markerMarkup(marker, data) {
  if (marker.type.startsWith('champ-') && marker.champion) {
    const champion = mapState.champions.find((entry) => entry.id === marker.champion);
    if (champion)
      return `<img src="https://ddragon.leagueoflegends.com/cdn/${mapState.patch}/img/champion/${escapeMap(champion.image.full)}" alt="" loading="lazy" />`;
  }
  const shapes = {
    ward: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/>',
    control:
      '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><path d="m9 9 3-3 3 3-3 3-3-3Z"/>',
    'enemy-ward':
      '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><path d="m9 9 6 0m-3-3v6"/>',
    dragon: '<path d="M4 15c3-1 3-5 6-7l2 3 3-5 1 5 4 2-4 2-2 4-3-3-4 2 1-4Z"/>',
    baron:
      '<path d="M5 19c2-5 1-10 7-14 6 4 5 9 7 14-3-1-5-2-7-2s-4 1-7 2Z"/><path d="M9 12h6"/>',
    herald:
      '<path d="M4 18c2-6 2-10 8-13 6 3 6 7 8 13l-8-2-8 2Z"/><circle cx="12" cy="12" r="2"/>',
    danger: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
    interest:
      '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9L12 3Z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${shapes[data.icon] || shapes.interest}</svg>`;
}

function renderRegions() {
  mapUi.regions.dataset.layer = 'regions';
  mapUi.regions.classList.toggle('layer-hidden', !layerState.regions);
  mapUi.regions.innerHTML = regionLabels
    .map(
      ([name, x, y, essential]) =>
        `<text class="region-label ${essential ? 'is-essential' : 'is-optional'}" x="${x}" y="${y}" text-anchor="middle">${escapeMap(name)}</text>`,
    )
    .join('');
  mapUi.regions.classList.toggle(
    'show-all',
    Boolean(document.querySelector('#map-show-all-regions')?.checked),
  );
}

function renderMapContent() {
  mapUi.routes.innerHTML =
    '<defs><marker id="map-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" fill="context-stroke"></path></marker></defs>' +
    mapState.routes
      .map((route) => {
        const cls = `route-${route.team || 'blue'}`;
        const arrow = route.arrow ? ' marker-end="url(#map-arrow)"' : '';
        return `<path class="${cls} ${layerState.routes ? '' : 'layer-hidden'}" data-layer="routes" stroke-width="${clamp(Number(route.width) || 2, 1, 4)}" d="${svgPath(route.points)}"${arrow}></path>`;
      })
      .join('') +
    (mapState.draftPoints.length > 1
      ? `<path class="route-${mapState.tool.endsWith('red') ? 'red' : mapState.tool.endsWith('neutral') ? 'neutral' : 'blue'} draft-route ${layerState.routes ? '' : 'layer-hidden'}" data-layer="routes" stroke-width="${Number(mapUi.routeWeight.value) || 2}" d="${svgPath(mapState.draftPoints)}"></path>`
      : '');
  mapUi.markers.innerHTML = mapState.markers
    .map((marker) => {
      const data = markerTypes[marker.type] || {
        name: 'Marcação',
        icon: 'interest',
        className: 'interest',
      };
      const layer = markerLayer(marker.type, data.className);
      const label =
        marker.label ||
        (marker.champion
          ? mapState.champions.find((champion) => champion.id === marker.champion)?.name
          : '');
      const title = `${data.name}${label ? ` · ${label}` : ''}`;
      return `<button type="button" class="map-marker ${data.className} ${layerState[layer] ? '' : 'layer-hidden'}" data-layer="${layer}" style="left:${marker.x * 100}%;top:${marker.y * 100}%" data-marker-id="${escapeMap(marker.id)}" aria-label="${escapeMap(title)}" title="${escapeMap(title)}">${markerMarkup(marker, data)}</button>`;
    })
    .join('');
  mapUi.markers.querySelectorAll('[data-marker-id]').forEach((button) =>
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      removeMarker(button.dataset.markerId);
    }),
  );
  mapUi.markers.querySelectorAll('[data-marker-id]').forEach((button) =>
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (mapState.tool !== 'select') return;
      const marker = mapState.markers.find(
        (entry) => entry.id === button.dataset.markerId,
      );
      if (!marker) return;
      event.preventDefault();
      event.stopPropagation();
      mapState.pointerMode = 'marker';
      mapState.pointerId = event.pointerId;
      mapState.markerDrag = { id: marker.id, before: snapshot() };
      mapUi.viewport.setPointerCapture(event.pointerId);
    }),
  );
}

function markerLayer(type, className = '') {
  if (type.startsWith('champ-blue') || className === 'champ-blue') return 'blue';
  if (type.startsWith('champ-red') || className === 'champ-red') return 'red';
  if (type.startsWith('ward-')) return 'vision';
  if (type === 'danger' || type === 'interest') return 'alerts';
  return 'objectives';
}

function setLayerVisibility(layer, visible) {
  layerState[layer] = visible;
  document
    .querySelectorAll(`[data-layer="${layer}"]`)
    .forEach((element) => element.classList.toggle('layer-hidden', !visible));
}

function rememberChange() {
  pushHistory();
  renderMapContent();
}

function addMarker(point, type) {
  const marker = {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    type,
    x: point.x,
    y: point.y,
    ...(type.startsWith('champ-') && mapState.selectedChampion
      ? {
          champion: mapState.selectedChampion.id,
          label: mapState.selectedChampion.name,
        }
      : {}),
  };
  mapState.markers.push(marker);
  rememberChange();
  mapUi.status.textContent = `${markerTypes[type]?.name || 'Marcação'} adicionada. Clique com o botão direito nela ou use a borracha para remover.`;
}

function removeMarker(id) {
  if (!mapState.markers.some((marker) => marker.id === id)) return;
  mapState.markers = mapState.markers.filter((marker) => marker.id !== id);
  rememberChange();
  mapUi.status.textContent = 'Marcação removida. Use Desfazer para restaurá-la.';
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length
    ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length, 0, 1)
    : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function eraseNear(point) {
  const marker = [...mapState.markers]
    .reverse()
    .find((entry) => Math.hypot(entry.x - point.x, entry.y - point.y) < 0.045);
  if (marker) {
    removeMarker(marker.id);
    return;
  }
  let candidate = null;
  for (const route of mapState.routes)
    for (let i = 1; i < route.points.length; i++) {
      const distance = distanceToSegment(point, route.points[i - 1], route.points[i]);
      if (distance < 0.025 && (!candidate || distance < candidate.distance))
        candidate = { route, distance };
    }
  if (candidate) {
    mapState.routes = mapState.routes.filter(
      (route) => route.id !== candidate.route.id,
    );
    rememberChange();
    mapUi.status.textContent = 'Rota removida. Use Desfazer para restaurá-la.';
  } else
    mapUi.status.textContent =
      'Nenhuma marcação próxima. Clique mais perto do elemento.';
}

function startDrawing(event) {
  const point = pointFromEvent(event);
  mapState.pointerMode = 'draw';
  mapState.pointerId = event.pointerId;
  mapState.draftPoints = [point];
  mapUi.viewport.setPointerCapture(event.pointerId);
  renderMapContent();
}

function finishDrawing() {
  if (mapState.pointerMode !== 'draw') return;
  const points = mapState.draftPoints;
  if (points.length >= 2) {
    const team = mapState.tool.endsWith('red')
      ? 'red'
      : mapState.tool.endsWith('neutral')
        ? 'neutral'
        : 'blue';
    mapState.routes.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      team,
      arrow: mapState.tool.startsWith('arrow-'),
      width: Number(mapUi.routeWeight.value) || 2,
      points,
    });
    mapState.draftPoints = [];
    mapState.pointerMode = '';
    rememberChange();
    mapUi.status.textContent =
      'Rota salva. Use Desfazer para remover a última marcação.';
  } else {
    mapState.draftPoints = [];
    mapState.pointerMode = '';
    renderMapContent();
  }
}

function resetView() {
  mapState.zoom = 1;
  mapState.panX = 0;
  mapState.panY = 0;
  applyTransform();
  mapUi.status.textContent = 'Zoom e posição do mapa restaurados.';
}

function renderSavedStrategies() {
  mapUi.saved.innerHTML = mapState.saved.length
    ? mapState.saved
        .map(
          (strategy) =>
            `<article class="saved-tool-row"><span class="strategy-icon">⌖</span><span><strong>${escapeMap(strategy.name)}</strong><small>${(strategy.markers || []).length} marcações · ${(strategy.routes || []).length} rotas · ${escapeMap(strategy.patch || '—')} · mapa v${strategy.coordinateVersion || 1}</small></span><button type="button" data-load-strategy="${escapeMap(strategy.id)}">Carregar</button><button type="button" class="saved-delete" data-delete-strategy="${escapeMap(strategy.id)}" aria-label="Excluir ${escapeMap(strategy.name)}">×</button></article>`,
        )
        .join('')
    : '<p class="tool-empty">Você ainda não salvou estratégias.</p>';
  mapUi.saved
    .querySelectorAll('[data-load-strategy]')
    .forEach((button) =>
      button.addEventListener('click', () => loadStrategy(button.dataset.loadStrategy)),
    );
  mapUi.saved.querySelectorAll('[data-delete-strategy]').forEach((button) =>
    button.addEventListener('click', () => {
      mapState.saved = mapState.saved.filter(
        (strategy) => strategy.id !== button.dataset.deleteStrategy,
      );
      persistSaved();
      renderSavedStrategies();
      if (mapState.editingId === button.dataset.deleteStrategy) newStrategy();
      mapUi.status.textContent = 'Estratégia removida do navegador.';
    }),
  );
}

function newStrategy() {
  mapState.editingId = null;
  mapUi.name.value = '';
  mapState.markers = [];
  mapState.routes = [];
  mapState.history = [];
  mapState.historyIndex = 0;
  pushHistory();
  resetView();
  renderMapContent();
  mapUi.status.textContent = 'Nova estratégia em branco.';
}

function loadStrategy(id) {
  const strategy = mapState.saved.find((entry) => entry.id === id);
  if (!strategy) return;
  mapState.editingId = strategy.id;
  mapUi.name.value = strategy.name;
  mapState.markers = Array.isArray(strategy.markers)
    ? JSON.parse(JSON.stringify(strategy.markers))
    : [];
  mapState.routes = Array.isArray(strategy.routes)
    ? JSON.parse(JSON.stringify(strategy.routes))
    : [];
  mapState.history = [];
  mapState.historyIndex = 0;
  pushHistory();
  resetView();
  renderMapContent();
  mapUi.status.textContent =
    strategy.coordinateVersion === MAP_COORDINATE_VERSION
      ? `“${strategy.name}” carregada. Edite o mapa e salve para atualizar.`
      : `“${strategy.name}” é de uma versão anterior do mapa. As coordenadas foram mantidas sem conversão; revise cada marcador antes de atualizar a estratégia.`;
}

function saveStrategy() {
  const name = mapUi.name.value.trim();
  if (!name) {
    mapUi.name.focus();
    mapUi.status.textContent = 'Dê um nome à estratégia antes de salvar.';
    return;
  }
  const strategy = {
    id: mapState.editingId || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name,
    patch: mapState.patch,
    coordinateVersion: MAP_COORDINATE_VERSION,
    markers: JSON.parse(JSON.stringify(mapState.markers)),
    routes: JSON.parse(JSON.stringify(mapState.routes)),
    updatedAt: new Date().toISOString(),
  };
  const index = mapState.saved.findIndex((entry) => entry.id === strategy.id);
  if (index >= 0) mapState.saved[index] = strategy;
  else mapState.saved.unshift(strategy);
  mapState.saved = mapState.saved.slice(0, 30);
  mapState.editingId = strategy.id;
  persistSaved();
  renderSavedStrategies();
  mapUi.status.textContent = `Estratégia “${name}” salva neste navegador.`;
}

async function exportMap() {
  try {
    const response = await fetch(mapUi.image.src, { mode: 'cors' });
    if (!response.ok) throw new Error('Mapa indisponível');
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1200;
    const context = canvas.getContext('2d');
    canvas.height = Math.round((canvas.width * bitmap.height) / bitmap.width);
    context.fillStyle = '#07101b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (layerState.regions) {
      context.font = '600 13px Inter, Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = 'rgba(6,12,19,.72)';
      context.strokeStyle = 'rgba(229,239,249,.78)';
      context.lineWidth = 3;
      regionLabels
        .filter(
          (region) =>
            region[3] || document.querySelector('#map-show-all-regions').checked,
        )
        .forEach(([name, x, y]) => {
          context.strokeText(
            name,
            (x / 1000) * canvas.width,
            (y / 1000) * canvas.height,
          );
          context.fillText(name, (x / 1000) * canvas.width, (y / 1000) * canvas.height);
        });
    }
    for (const route of mapState.routes.filter(() => layerState.routes)) {
      if (!route.points.length) continue;
      context.beginPath();
      route.points.forEach((point, index) =>
        index
          ? context.lineTo(point.x * canvas.width, point.y * canvas.height)
          : context.moveTo(point.x * canvas.width, point.y * canvas.height),
      );
      context.strokeStyle =
        route.team === 'red'
          ? '#ff858a'
          : route.team === 'neutral'
            ? '#d8dbab'
            : '#79bbff';
      context.lineWidth = (Number(route.width) || 2) * 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
      if (route.arrow && route.points.length > 1) {
        const end = route.points.at(-1),
          previous = route.points.at(-2);
        const angle = Math.atan2(end.y - previous.y, end.x - previous.x);
        const x = end.x * canvas.width,
          y = end.y * canvas.height,
          size = 14;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(
          x - size * Math.cos(angle - Math.PI / 6),
          y - size * Math.sin(angle - Math.PI / 6),
        );
        context.lineTo(
          x - size * Math.cos(angle + Math.PI / 6),
          y - size * Math.sin(angle + Math.PI / 6),
        );
        context.closePath();
        context.fillStyle =
          route.team === 'red'
            ? '#ff858a'
            : route.team === 'neutral'
              ? '#d8dbab'
              : '#79bbff';
        context.fill();
      }
    }
    for (const marker of mapState.markers.filter(
      (entry) =>
        layerState[markerLayer(entry.type, markerTypes[entry.type]?.className)],
    )) {
      const info = markerTypes[marker.type] || {
        name: 'Marcação',
        icon: 'interest',
        className: '',
      };
      const x = marker.x * canvas.width,
        y = marker.y * canvas.height;
      const color = ['enemy', 'champ-red'].includes(info.className)
        ? '#ff7c83'
        : ['objective', 'control'].includes(info.className)
          ? '#d9bf6d'
          : '#b9e970';
      context.beginPath();
      context.arc(x, y, marker.type.startsWith('champ-') ? 15 : 10, 0, Math.PI * 2);
      context.fillStyle = '#07101be8';
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = color;
      context.stroke();
      if (marker.type.startsWith('champ-') && marker.champion) {
        const champion = mapState.champions.find(
          (entry) => entry.id === marker.champion,
        );
        if (champion) {
          try {
            const portrait = new Image();
            portrait.crossOrigin = 'anonymous';
            portrait.src = `https://ddragon.leagueoflegends.com/cdn/${mapState.patch}/img/champion/${champion.image.full}`;
            await portrait.decode();
            context.save();
            context.beginPath();
            context.arc(x, y, 13, 0, Math.PI * 2);
            context.clip();
            context.drawImage(portrait, x - 13, y - 13, 26, 26);
            context.restore();
          } catch {
            // Keep the team-colored marker when a portrait cannot be loaded.
          }
        }
      } else {
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, 2.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    const output = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('Falha ao preparar PNG.')),
        'image/png',
      ),
    );
    const url = URL.createObjectURL(output);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(mapUi.name.value.trim() || 'riftlab-estrategia').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-')}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    mapUi.status.textContent = 'PNG da estratégia exportado.';
  } catch (error) {
    mapUi.status.textContent =
      'Não foi possível exportar o PNG. Verifique a conexão com o Data Dragon e tente novamente.';
    console.error('Rift Map: exportação falhou.', error);
  }
}

async function initializeMap() {
  try {
    const versions = await window.RiftBuildCore.fetchJson(
      'https://ddragon.leagueoflegends.com/api/versions.json',
    );
    mapState.patch = versions[0];
    mapUi.patch.textContent = `Data Dragon · patch ${mapState.patch}`;
    try {
      const response = await window.RiftBuildCore.fetchJson(
        `https://ddragon.leagueoflegends.com/cdn/${mapState.patch}/data/pt_BR/champion.json`,
      );
      mapState.champions = Object.values(response.data || {}).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      );
      mapUi.champion.innerHTML =
        '<option value="">Selecione um campeão</option>' +
        mapState.champions
          .map(
            (champion) =>
              `<option value="${escapeMap(champion.id)}">${escapeMap(champion.name)}</option>`,
          )
          .join('');
    } catch {
      mapUi.status.textContent =
        'Retratos de campeões indisponíveis; as demais marcações continuam funcionando.';
    }
    mapUi.image.src = './assets/summoners-rift-reference.png';
    mapUi.image.addEventListener('load', () => {
      mapUi.status.textContent =
        'Mapa oficial carregado. Escolha uma ferramenta para marcar.';
    });
    mapUi.image.addEventListener('error', () => {
      mapUi.status.textContent =
        'O mapa oficial não carregou. Confira a conexão e atualize a página.';
    });
    renderRegions();
    pushHistory();
    renderSavedStrategies();
    setTool('pan');
    document
      .querySelectorAll('[data-map-tool]')
      .forEach((button) =>
        button.addEventListener('click', () => setTool(button.dataset.mapTool)),
      );
    document.querySelectorAll('.map-tool-icon').forEach((icon) => {
      icon.innerHTML = iconSvg(icon.closest('[data-map-tool]').dataset.mapTool);
    });
    mapUi.champion.addEventListener('change', () => {
      mapState.selectedChampion =
        mapState.champions.find((champion) => champion.id === mapUi.champion.value) ||
        null;
      if (mapState.selectedChampion) {
        setTool(
          mapState.pendingChampionTool ||
            (mapState.tool.startsWith('champ-') ? mapState.tool : 'champ-blue'),
        );
      }
    });
    mapUi.routeWeight.addEventListener('input', () => {
      mapUi.routeWeightValue.textContent = mapUi.routeWeight.value;
      renderMapContent();
    });
    document.querySelectorAll('[data-map-layer]').forEach((input) => {
      layerState[input.dataset.mapLayer] = input.checked;
      input.addEventListener('change', () =>
        setLayerVisibility(input.dataset.mapLayer, input.checked),
      );
    });
    mapUi.viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (mapState.tool === 'pan') {
        mapState.pointerMode = 'pan';
        mapState.pointerId = event.pointerId;
        mapState.startPointer = {
          x: event.clientX,
          y: event.clientY,
          panX: mapState.panX,
          panY: mapState.panY,
        };
        mapUi.viewport.setPointerCapture(event.pointerId);
        return;
      }
      if (mapState.tool.startsWith('route-') || mapState.tool.startsWith('arrow-')) {
        startDrawing(event);
        return;
      }
      if (mapState.tool === 'eraser') {
        eraseNear(pointFromEvent(event));
        return;
      }
      if (markerTypes[mapState.tool]) addMarker(pointFromEvent(event), mapState.tool);
    });
    mapUi.viewport.addEventListener('pointermove', (event) => {
      if (mapState.pointerId !== event.pointerId) return;
      if (mapState.pointerMode === 'pan' && mapState.startPointer) {
        mapState.panX =
          mapState.startPointer.panX + event.clientX - mapState.startPointer.x;
        mapState.panY =
          mapState.startPointer.panY + event.clientY - mapState.startPointer.y;
        applyTransform();
      } else if (mapState.pointerMode === 'marker' && mapState.markerDrag) {
        const marker = mapState.markers.find(
          (entry) => entry.id === mapState.markerDrag.id,
        );
        if (marker) Object.assign(marker, pointFromEvent(event));
        renderMapContent();
      } else if (mapState.pointerMode === 'draw') {
        const point = pointFromEvent(event);
        const previous = mapState.draftPoints.at(-1);
        if (Math.hypot(point.x - previous.x, point.y - previous.y) > 0.004) {
          mapState.draftPoints.push(point);
          renderMapContent();
        }
      }
    });
    mapUi.viewport.addEventListener('pointerup', (event) => {
      if (mapState.pointerId !== event.pointerId) return;
      if (mapState.pointerMode === 'draw') finishDrawing();
      else if (mapState.pointerMode === 'marker' && mapState.markerDrag) {
        const marker = mapState.markers.find(
          (entry) => entry.id === mapState.markerDrag.id,
        );
        const changed = mapState.markerDrag.before !== snapshot();
        mapState.markerDrag = null;
        mapState.pointerMode = '';
        if (changed) {
          pushHistory();
          renderMapContent();
          mapUi.status.textContent =
            'Marcação reposicionada. Use Desfazer para voltar.';
        } else if (marker) {
          const detail = marker.label || markerTypes[marker.type]?.name || 'Marcação';
          mapUi.status.textContent = `${detail}. Arraste para reposicionar.`;
        }
      } else mapState.pointerMode = '';
      mapState.pointerId = null;
      mapState.startPointer = null;
      mapState.markerDrag = null;
    });
    mapUi.viewport.addEventListener('pointercancel', () => {
      mapState.pointerMode = '';
      mapState.pointerId = null;
      mapState.startPointer = null;
      mapState.draftPoints = [];
      renderMapContent();
    });
    mapUi.viewport.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const point = pointFromEvent(event);
      const marker = [...mapState.markers]
        .reverse()
        .find((entry) => Math.hypot(entry.x - point.x, entry.y - point.y) < 0.045);
      if (marker) removeMarker(marker.id);
    });
    mapUi.zoom.addEventListener('input', () => {
      mapState.zoom = Number(mapUi.zoom.value);
      applyTransform();
    });
    document.querySelector('#map-zoom-in').addEventListener('click', () => {
      mapState.zoom = clamp(Math.round((mapState.zoom + 0.1) * 10) / 10, 0.8, 2.4);
      applyTransform();
    });
    document.querySelector('#map-zoom-out').addEventListener('click', () => {
      mapState.zoom = clamp(Math.round((mapState.zoom - 0.1) * 10) / 10, 0.8, 2.4);
      applyTransform();
    });
    document.querySelector('#map-reset-view').addEventListener('click', resetView);
    document
      .querySelector('#map-show-all-regions')
      .addEventListener('change', renderRegions);
    document.querySelector('#map-undo').addEventListener('click', () => {
      if (mapState.historyIndex > 0) {
        mapState.historyIndex--;
        restoreSnapshot(mapState.history[mapState.historyIndex]);
        updateHistoryButtons();
      }
    });
    document.querySelector('#map-redo').addEventListener('click', () => {
      if (mapState.historyIndex < mapState.history.length - 1) {
        mapState.historyIndex++;
        restoreSnapshot(mapState.history[mapState.historyIndex]);
        updateHistoryButtons();
      }
    });
    document.querySelector('#map-clear').addEventListener('click', () => {
      if (!mapState.markers.length && !mapState.routes.length) {
        mapUi.status.textContent = 'O mapa já está limpo.';
        return;
      }
      mapState.markers = [];
      mapState.routes = [];
      rememberChange();
      mapUi.status.textContent =
        'Marcações e rotas limpas. Use Desfazer para restaurá-las.';
    });
    document
      .querySelector('#map-save-strategy')
      .addEventListener('click', saveStrategy);
    document.querySelector('#map-new-strategy').addEventListener('click', newStrategy);
    document.querySelector('#map-export').addEventListener('click', exportMap);
  } catch (error) {
    mapUi.patch.textContent = 'Dados oficiais indisponíveis';
    mapUi.status.textContent = 'Não foi possível localizar a versão do mapa oficial.';
    console.error('Rift Map: inicialização falhou.', error);
  }
}

initializeMap();
