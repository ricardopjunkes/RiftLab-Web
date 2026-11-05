const MAP_STORAGE_KEY = 'riftlab-rift-map-strategies-v1';
const MAP_COORDINATE_VERSION = 3;
const markerTypes = {
  'ward-ally': { name: 'Ward aliada', glyph: 'W', className: 'ally' },
  'ward-control': { name: 'Control ward', glyph: 'C', className: 'control' },
  'ward-enemy': { name: 'Ward inimiga', glyph: 'W', className: 'enemy' },
  danger: { name: 'Perigo', glyph: '!', className: 'danger' },
  interest: { name: 'Ponto de interesse', glyph: '★', className: 'interest' },
  dragon: { name: 'Dragão', glyph: 'D', className: 'objective' },
  baron: { name: 'Barão Nashor', glyph: 'B', className: 'objective' },
  herald: { name: 'Arauto do Vale', glyph: 'H', className: 'objective' },
  'champ-blue': { name: 'Campeão azul', glyph: '●', className: 'champ-blue' },
  'champ-red': { name: 'Campeão vermelho', glyph: '●', className: 'champ-red' },
};
const regionLabels = [
  ['TOPO', 500, 95],
  ['MEIO', 505, 490],
  ['ROTA INFERIOR', 520, 890],
  ['SELVA AZUL', 275, 700],
  ['SELVA VERMELHA', 720, 300],
  ['RIO', 530, 495],
  ['BARÃO', 390, 285],
  ['DRAGÃO', 620, 520],
  ['BASE AZUL', 145, 835],
  ['BASE VERMELHA', 755, 120],
];
const layerState = {
  blue: true,
  red: true,
  vision: true,
  objectives: true,
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
        : tool === 'eraser'
          ? 'Clique perto de uma marcação ou rota para removê-la.'
          : `Clique no mapa para adicionar: ${markerTypes[tool]?.name || tool}.`;
  mapUi.status.textContent = mode;
}

function applyTransform() {
  mapUi.canvas.style.transform = `translate(${mapState.panX}px, ${mapState.panY}px) scale(${mapState.zoom})`;
  mapUi.zoom.value = String(mapState.zoom);
}

function pointFromEvent(event) {
  const rect = mapUi.canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function svgPath(points) {
  return points
    .map(
      (point, index) =>
        `${index ? 'L' : 'M'} ${Math.round(point.x * 1000)} ${Math.round(point.y * 1000)}`,
    )
    .join(' ');
}

function renderRegions() {
  mapUi.regions.innerHTML = regionLabels
    .map(
      ([name, x, y]) => `<text x="${x}" y="${y}" text-anchor="middle">${name}</text>`,
    )
    .join('');
}

function renderMapContent() {
  mapUi.routes.innerHTML =
    '<defs><marker id="map-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke"></path></marker></defs>' +
    mapState.routes
      .map((route) => {
        const cls = route.team === 'red' ? 'route-red' : 'route-blue';
        const arrow = route.arrow ? ' marker-end="url(#map-arrow)"' : '';
        return `<path class="${cls} ${layerState.routes ? '' : 'layer-hidden'}" data-layer="routes" d="${svgPath(route.points)}"${arrow}></path>`;
      })
      .join('') +
    (mapState.draftPoints.length > 1
      ? `<path class="${mapState.tool.endsWith('red') ? 'route-red' : 'route-blue'} draft-route ${layerState.routes ? '' : 'layer-hidden'}" data-layer="routes" d="${svgPath(mapState.draftPoints)}"></path>`
      : '');
  mapUi.markers.innerHTML = mapState.markers
    .map((marker) => {
      const data = markerTypes[marker.type] || {
        name: 'Marcação',
        glyph: '•',
        className: 'interest',
      };
      const layer = markerLayer(marker.type, data.className);
      return `<button type="button" class="map-marker ${data.className} ${layerState[layer] ? '' : 'layer-hidden'}" data-layer="${layer}" style="left:${marker.x * 100}%;top:${marker.y * 100}%" data-marker-id="${escapeMap(marker.id)}" aria-label="${escapeMap(data.name)}${marker.label ? `: ${escapeMap(marker.label)}` : ''}" title="${escapeMap(data.name)}${marker.label ? ` · ${escapeMap(marker.label)}` : ''}"><span>${data.glyph}</span></button>`;
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
    const isRed = mapState.tool.endsWith('red');
    mapState.routes.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      team: isRed ? 'red' : 'blue',
      arrow: mapState.tool.startsWith('arrow-'),
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
    if (document.querySelector('#map-show-regions').checked) {
      context.font = 'bold 16px Inter, Arial, sans-serif';
      context.textAlign = 'center';
      context.fillStyle = 'rgba(229,239,249,.78)';
      regionLabels.forEach(([name, x, y]) =>
        context.fillText(name, (x / 1000) * canvas.width, (y / 1000) * canvas.height),
      );
    }
    for (const route of mapState.routes.filter(() => layerState.routes)) {
      if (!route.points.length) continue;
      context.beginPath();
      route.points.forEach((point, index) =>
        index
          ? context.lineTo(point.x * canvas.width, point.y * canvas.height)
          : context.moveTo(point.x * canvas.width, point.y * canvas.height),
      );
      context.strokeStyle = route.team === 'red' ? '#ff7c83' : '#70baff';
      context.lineWidth = 8;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
      if (route.arrow && route.points.length > 1) {
        const end = route.points.at(-1),
          previous = route.points.at(-2);
        const angle = Math.atan2(end.y - previous.y, end.x - previous.x);
        const x = end.x * canvas.width,
          y = end.y * canvas.height,
          size = 26;
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
        context.fillStyle = route.team === 'red' ? '#ff7c83' : '#70baff';
        context.fill();
      }
    }
    for (const marker of mapState.markers.filter(
      (entry) =>
        layerState[markerLayer(entry.type, markerTypes[entry.type]?.className)],
    )) {
      const info = markerTypes[marker.type] || {
        name: 'Marcação',
        glyph: '•',
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
      context.arc(x, y, 24, 0, Math.PI * 2);
      context.fillStyle = '#07101be8';
      context.fill();
      context.lineWidth = 4;
      context.strokeStyle = color;
      context.stroke();
      context.font = 'bold 22px Inter, Arial, sans-serif';
      context.fillStyle = color;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(info.glyph, x, y + 1);
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
        const changed = mapState.markerDrag.before !== snapshot();
        mapState.markerDrag = null;
        mapState.pointerMode = '';
        if (changed) {
          pushHistory();
          renderMapContent();
          mapUi.status.textContent =
            'Marcação reposicionada. Use Desfazer para voltar.';
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
      .querySelector('#map-show-regions')
      .addEventListener('change', (event) =>
        mapUi.regions.classList.toggle('hidden', !event.target.checked),
      );
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
