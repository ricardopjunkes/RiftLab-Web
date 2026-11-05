import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

class FakeElement {
  constructor() {
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = { toggle() {}, add() {}, remove() {} };
    this.value = '';
    this.innerHTML = '';
    this.disabled = false;
    this.hidden = false;
    this.clientWidth = 1000;
    this.clientHeight = 798;
    this.clientLeft = 1;
    this.clientTop = 1;
  }
  addEventListener() {}
  querySelectorAll() {
    return [];
  }
  setAttribute() {}
  focus() {}
  setPointerCapture() {}
  getBoundingClientRect() {
    return { left: 40, top: 20 };
  }
}

function createHarness() {
  const elements = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new FakeElement());
      return elements.get(selector);
    },
    querySelectorAll() {
      return [];
    },
  };
  const localStorage = {
    value: '[]',
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = value;
    },
  };
  const source = readFileSync(
    new URL('../frontend/rift-map.js', import.meta.url),
    'utf8',
  ).replace(/\ninitializeMap\(\);\s*$/, '\n');
  const context = { document, localStorage, crypto: webcrypto, console, window: {} };
  vm.createContext(context);
  vm.runInContext(
    `${source}\nglobalThis.riftTest = { mapState, mapUi, addMarker, removeMarker, selectMarker, beginMarkerDrag, moveDraggedMarker, finishMarkerDrag, normalizeSearch, normalizeSavedMarkers, findChampionMarker, moveMarkerTo, pointFromEvent, snapshot, restoreSnapshot, saveStrategy, loadStrategy, newStrategy, regionLabels };`,
    context,
  );
  return context.riftTest;
}

const bard = { id: 'Bard', name: 'Bardo', image: { full: 'Bard.png' } };
const ahri = { id: 'Ahri', name: 'Ahri', image: { full: 'Ahri.png' } };

test('um campeão oficial só ganha um marcador e a nova tentativa seleciona o existente', () => {
  const map = createHarness();
  map.mapState.champions = [bard];
  map.mapState.selectedChampion = bard;
  map.addMarker({ x: 0.2, y: 0.3 }, 'champ-blue');
  const originalId = map.mapState.markers[0].id;
  map.addMarker({ x: 0.8, y: 0.7 }, 'champ-blue');
  assert.equal(map.mapState.markers.length, 1);
  assert.equal(map.mapState.selectedMarkerId, originalId);
  assert.equal(map.mapState.tool, 'select');
});

test('campeões diferentes podem ser adicionados e selecionados para movimentação', () => {
  const map = createHarness();
  map.mapState.champions = [bard, ahri];
  map.mapState.selectedChampion = bard;
  map.addMarker({ x: 0.2, y: 0.3 }, 'champ-blue');
  map.mapState.selectedChampion = ahri;
  map.addMarker({ x: 0.7, y: 0.6 }, 'champ-red');
  assert.deepEqual(
    JSON.parse(JSON.stringify(map.mapState.markers.map((marker) => marker.champion))),
    ['Bard', 'Ahri'],
  );
  assert.equal(map.mapState.selectedMarkerId, map.mapState.markers[1].id);
});

test('personagens genéricos podem ser repetidos e mantêm identificadores únicos', () => {
  const map = createHarness();
  for (let index = 0; index < 5; index++) {
    map.addMarker({ x: index / 5, y: 0.5 }, 'generic-blue');
  }
  assert.equal(map.mapState.markers.length, 5);
  assert.equal(new Set(map.mapState.markers.map((marker) => marker.id)).size, 5);
  assert.ok(map.mapState.markers.every((marker) => !marker.champion));
});

test('pesquisa de nomes ignora caixa e acentos', () => {
  const map = createHarness();
  assert.equal(map.normalizeSearch('BÁrD'), map.normalizeSearch('bard'));
  assert.ok(map.normalizeSearch('Bard').includes(map.normalizeSearch('bar')));
});

test('coordenadas compensam zoom, deslocamento e borda do viewport', () => {
  const map = createHarness();
  map.mapState.zoom = 1.8;
  map.mapState.panX = 23;
  map.mapState.panY = -11;
  const x = 0.31;
  const y = 0.68;
  const event = {
    clientX: 40 + 1 + 23 + ((1 - 1.8) * 1000) / 2 + 1.8 * x * 1000,
    clientY: 20 + 1 - 11 + ((1 - 1.8) * 798) / 2 + 1.8 * y * 798,
  };
  const point = map.pointFromEvent(event);
  assert.ok(Math.abs(point.x - x) < 1e-10);
  assert.ok(Math.abs(point.y - y) < 1e-10);
});

test('arraste com ponteiro de mouse e toque move só o marcador, inclusive com zoom', () => {
  for (const pointerType of ['mouse', 'touch']) {
    const map = createHarness();
    map.addMarker({ x: 0.2, y: 0.3 }, 'generic-blue');
    const marker = map.mapState.markers[0];
    map.mapState.zoom = 1.6;
    map.mapState.panX = -14;
    map.mapState.panY = 9;
    const pointer = (x, y) => ({
      pointerId: pointerType === 'touch' ? 2 : 1,
      pointerType,
      clientX: 40 + 1 - 14 + ((1 - 1.6) * 1000) / 2 + 1.6 * x * 1000,
      clientY: 20 + 1 + 9 + ((1 - 1.6) * 798) / 2 + 1.6 * y * 798,
    });
    map.beginMarkerDrag(marker, {
      ...pointer(marker.x, marker.y),
      button: 0,
      preventDefault() {},
      stopPropagation() {},
    });
    assert.equal(map.mapState.tool, 'select');
    assert.equal(map.moveDraggedMarker(pointer(0.74, 0.29)), true);
    assert.ok(Math.abs(marker.x - 0.74) < 1e-10);
    assert.ok(Math.abs(marker.y - 0.29) < 1e-10);
    assert.equal(map.mapState.panX, -14);
    assert.equal(map.finishMarkerDrag(pointer(0.74, 0.29)), true);
    assert.equal(map.mapState.markers.length, 1);
    assert.equal(map.mapState.pointerMode, '');
  }
});

test('marcador acompanha o novo ponto e permanece serializável para salvar/carregar', () => {
  const map = createHarness();
  map.mapState.champions = [bard];
  map.mapState.selectedChampion = bard;
  map.addMarker({ x: 0.2, y: 0.3 }, 'champ-blue');
  const id = map.mapState.markers[0].id;
  assert.equal(map.moveMarkerTo(id, { x: 0.62, y: 0.44 }), true);
  const saved = map.snapshot();
  map.mapState.markers = [];
  map.restoreSnapshot(saved);
  assert.deepEqual(JSON.parse(JSON.stringify(map.mapState.markers[0])), {
    id,
    type: 'champ-blue',
    x: 0.62,
    y: 0.44,
    champion: 'Bard',
    label: 'Bardo',
  });
});

test('estratégia salva e carrega campeões e vários personagens genéricos', () => {
  const map = createHarness();
  map.mapState.champions = [bard];
  map.mapState.selectedChampion = bard;
  map.addMarker({ x: 0.2, y: 0.3 }, 'champ-blue');
  for (let index = 0; index < 5; index++) {
    map.addMarker({ x: index / 5, y: 0.6 }, 'generic-red');
  }
  map.mapUi.name.value = 'Teste de estratégia';
  map.saveStrategy();
  const id = map.mapState.saved[0].id;
  map.newStrategy();
  assert.equal(map.mapState.markers.length, 0);
  map.loadStrategy(id);
  assert.equal(map.mapState.markers.length, 6);
  assert.equal(map.findChampionMarker('Bard').label, 'Bardo');
  assert.equal(
    map.mapState.markers.filter((marker) => marker.type === 'generic-red').length,
    5,
  );
});

test('estratégias antigas são deduplicadas em memória e remover libera o campeão', () => {
  const map = createHarness();
  const oldMarkers = [
    { id: 'one', type: 'champ-blue', champion: 'Bard', x: 0.1, y: 0.2 },
    { id: 'two', type: 'champ-red', champion: 'Bard', x: 0.8, y: 0.9 },
    { id: 'generic-a', type: 'generic-blue', x: 0.3, y: 0.4 },
  ];
  const normalized = map.normalizeSavedMarkers(oldMarkers);
  assert.equal(normalized.length, 2);
  map.mapState.markers = normalized;
  assert.equal(map.findChampionMarker('Bard').id, 'one');
  map.removeMarker('one');
  map.mapState.champions = [bard];
  map.mapState.selectedChampion = bard;
  map.addMarker({ x: 0.5, y: 0.5 }, 'champ-blue');
  assert.equal(map.findChampionMarker('Bard').x, 0.5);
});

test('rótulos de Rio e Meio apontam para posições separadas no mapa', () => {
  const map = createHarness();
  const mid = map.regionLabels.find(([name]) => name === 'Meio');
  const river = map.regionLabels.find(([name]) => name === 'Rio');
  assert.deepEqual(JSON.parse(JSON.stringify([mid[1], mid[2]])), [625, 365]);
  assert.deepEqual(JSON.parse(JSON.stringify([river[1], river[2]])), [590, 590]);
});
