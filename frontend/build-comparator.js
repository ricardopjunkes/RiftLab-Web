const BUILD_KEY = 'riftlab-build-lab-v1';
const $ = (selector) => document.querySelector(selector);
const state = {
  data: null,
  saved: [],
  activeSide: 'a',
  sides: {
    a: { championId: '', detail: null, slots: Array(6).fill(null), activeSlot: 0 },
    b: { championId: '', detail: null, slots: Array(6).fill(null), activeSlot: 0 },
  },
};
const labels = [
  ['attackDamage', 'Dano de ataque', 'flat'],
  ['abilityPower', 'Poder de habilidade', 'flat'],
  ['health', 'Vida', 'flat'],
  ['armor', 'Armadura', 'flat'],
  ['magicResist', 'Resistência mágica', 'flat'],
  ['attackSpeed', 'Velocidade de ataque', 'attackSpeed'],
  ['mana', 'Mana', 'flat'],
  ['haste', 'Aceleração de habilidade', 'flat'],
  ['critChance', 'Chance de crítico', 'percent'],
  ['movementSpeed', 'Velocidade de movimento', 'flat'],
  ['lifeSteal', 'Roubo de vida', 'percent'],
  ['cost', 'Custo em ouro', 'flat'],
];

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function format(value, type = 'flat') {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: type === 'attackSpeed' ? 2 : 1,
  }).format(number);
  return type === 'percent'
    ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(number * 100)}%`
    : type === 'attackSpeed'
      ? `${formatted} ataques/s`
      : formatted;
}

function normalize(value) {
  return window.RiftBuildCore.normalize(value);
}

function itemCategory(item) {
  const tags = item.tags || [];
  if (tags.includes('Boots')) return 'boots';
  if (
    tags.some((tag) =>
      [
        'Damage',
        'CriticalStrike',
        'AttackSpeed',
        'LifeSteal',
        'ArmorPenetration',
      ].includes(tag),
    )
  )
    return 'attack';
  if (tags.some((tag) => ['SpellDamage', 'MagicPenetration', 'Mana'].includes(tag)))
    return 'magic';
  if (
    tags.some((tag) => ['Health', 'Armor', 'SpellBlock', 'HealthRegen'].includes(tag))
  )
    return 'defense';
  return 'other';
}

function savedBuilds() {
  try {
    const value = JSON.parse(localStorage.getItem(BUILD_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(
          (build) =>
            build && typeof build.id === 'string' && typeof build.name === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function renderChampionOptions() {
  const options = `<option value="">Selecione um campeão</option>${state.data.champions.map((champion) => `<option value="${escapeHtml(champion.id)}">${escapeHtml(champion.name)}</option>`).join('')}`;
  ['a', 'b'].forEach((side) => {
    $(`#cmp-champion-${side}`).innerHTML = options;
  });
}

function renderSavedOptions() {
  const options = `<option value="">Escolha uma build salva</option>${state.saved
    .map((build) => {
      const champion = state.data.champions.find(
        (candidate) => candidate.id === build.championId,
      );
      return `<option value="${escapeHtml(build.id)}">${escapeHtml(build.name)} · ${escapeHtml(champion?.name || build.championId)}</option>`;
    })
    .join('')}`;
  ['a', 'b'].forEach((side) => {
    $(`#cmp-saved-${side}`).innerHTML = options;
  });
}

async function loadChampion(side, id) {
  const current = state.sides[side];
  current.championId = id;
  current.detail = null;
  if (id) {
    try {
      const result = await window.RiftBuildCore.fetchJson(
        `https://ddragon.leagueoflegends.com/cdn/${state.data.patch}/data/pt_BR/champion/${encodeURIComponent(id)}.json`,
      );
      if (state.sides[side].championId === id) current.detail = result.data[id];
    } catch {
      $('#cmp-status').textContent = `Atributos oficiais de ${id} não carregaram.`;
    }
  }
  renderSide(side);
  renderComparison();
}

function renderSide(side) {
  const current = state.sides[side];
  const summary = window.RiftBuildCore.calculateBuild(current.detail, current.slots);
  $(`#cmp-cost-${side}`).textContent =
    `${new Intl.NumberFormat('pt-BR').format(summary.cost)} ouro`;
  const container = $(`#cmp-slots-${side}`);
  container.innerHTML = current.slots
    .map((item, index) =>
      item
        ? `<div class="compare-slot filled ${current.activeSlot === index ? 'active' : ''}"><button type="button" class="compare-slot-item" data-slot="${index}" aria-label="Selecionar ${item.displayName || item.name}, espaço ${index + 1}"><img src="https://ddragon.leagueoflegends.com/cdn/${state.data.patch}/img/item/${escapeHtml(item.image.full)}" alt=""><span>${escapeHtml(item.displayName || item.name)}</span></button><button type="button" class="compare-slot-remove" data-remove="${index}" aria-label="Remover ${escapeHtml(item.name)} do espaço ${index + 1}">×</button></div>`
        : `<button type="button" class="compare-slot empty ${current.activeSlot === index ? 'active' : ''}" data-slot="${index}" aria-label="Selecionar espaço vazio ${index + 1}"><span>＋</span><small>${index + 1}</small></button>`,
    )
    .join('');
  container.querySelectorAll('[data-slot]').forEach((button) =>
    button.addEventListener('click', () => {
      current.activeSlot = Number(button.dataset.slot);
      state.activeSide = side;
      renderSide(side);
      renderActiveSide();
    }),
  );
  container.querySelectorAll('[data-remove]').forEach((button) =>
    button.addEventListener('click', () => {
      const index = Number(button.dataset.remove);
      current.slots[index] = null;
      current.activeSlot = index;
      renderSide(side);
      renderComparison();
    }),
  );
  const rows = labels
    .slice(0, -1)
    .map(([key, name, type]) => {
      const value = summary.total[key];
      const baseValue = summary.base[key] || 0;
      const bonusValue =
        key === 'movementSpeed'
          ? (summary.bonuses.FlatMovementSpeedMod || 0) +
            baseValue * (summary.bonuses.PercentMovementSpeedMod || 0)
          : key === 'attackSpeed'
            ? value - baseValue
            : key === 'critChance' || key === 'lifeSteal'
              ? value
              : value - baseValue;
      if (!current.championId && !current.slots.some(Boolean)) return '';
      if (
        !value &&
        !bonusValue &&
        !['abilityPower', 'haste', 'critChance', 'lifeSteal'].includes(key)
      )
        return '';
      return `<div class="compare-stat"><span>${name}</span><strong>${format(value, type)}</strong></div>`;
    })
    .join('');
  $(`#cmp-stats-${side}`).innerHTML =
    rows || '<p>Selecione um campeão para calcular os atributos.</p>';
}

function renderComparison() {
  const a = window.RiftBuildCore.calculateBuild(
    state.sides.a.detail,
    state.sides.a.slots,
  );
  const b = window.RiftBuildCore.calculateBuild(
    state.sides.b.detail,
    state.sides.b.slots,
  );
  const valuesA = { ...a.total, cost: a.cost };
  const valuesB = { ...b.total, cost: b.cost };
  const ready = Boolean(
    state.sides.a.championId ||
    state.sides.a.slots.some(Boolean) ||
    state.sides.b.championId ||
    state.sides.b.slots.some(Boolean),
  );
  if (!ready) {
    $('#cmp-differences').innerHTML = '<p>Escolha campeões e itens para comparar.</p>';
    return;
  }
  $('#cmp-differences').innerHTML = labels
    .map(([key, name, type]) => {
      const left = valuesA[key] || 0;
      const right = valuesB[key] || 0;
      const difference = left - right;
      const magnitude = Math.max(Math.abs(left), Math.abs(right), 1);
      const leftWidth = Math.min(100, Math.max(3, Math.abs(left / magnitude) * 100));
      const rightWidth = Math.min(100, Math.max(3, Math.abs(right / magnitude) * 100));
      const diffText =
        Math.abs(difference) < 0.0001
          ? 'Empate numérico'
          : `${difference > 0 ? 'Build A' : 'Build B'} tem ${format(Math.abs(difference), type)} a mais`;
      return `<article class="compare-diff-row"><div class="compare-diff-heading"><span>${name}</span><strong>${diffText}</strong></div><div class="compare-bars"><div class="compare-bar-line"><b>A</b><span><i style="width:${leftWidth}%"></i></span><small>${format(left, type)}</small></div><div class="compare-bar-line"><b>B</b><span><i class="bar-b" style="width:${rightWidth}%"></i></span><small>${format(right, type)}</small></div></div></article>`;
    })
    .join('');
}

function renderItems() {
  const query = normalize($('#cmp-item-search').value);
  const category = $('#cmp-category').value;
  const items = state.data.items.filter(
    (item) =>
      (normalize(item.name).includes(query) ||
        normalize(item.id).includes(query) ||
        normalize(item.description).includes(query)) &&
      (category === 'all' || itemCategory(item) === category),
  );
  $('#cmp-item-count').textContent =
    `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;
  $('#cmp-items').innerHTML = items.length
    ? items
        .map(
          (item) =>
            `<button type="button" class="compare-item" data-add-item="${item.id}" aria-label="Adicionar ${escapeHtml(item.displayName || item.name)} à Build ${state.activeSide.toUpperCase()}"><img src="https://ddragon.leagueoflegends.com/cdn/${state.data.patch}/img/item/${escapeHtml(item.image.full)}" alt=""><span><strong>${escapeHtml(item.displayName || item.name)}</strong><small>ID ${escapeHtml(item.id)} · ${new Intl.NumberFormat('pt-BR').format(item.gold.total)} ouro</small></span><b>＋</b></button>`,
        )
        .join('')
    : '<p class="tool-empty">Nenhum item corresponde a esta busca.</p>';
  $('#cmp-items').setAttribute('aria-busy', 'false');
  $('#cmp-items')
    .querySelectorAll('[data-add-item]')
    .forEach((button) =>
      button.addEventListener('click', () => addItem(button.dataset.addItem)),
    );
}

function renderActiveSide() {
  document
    .querySelectorAll('[data-edit-side]')
    .forEach((button) =>
      button.classList.toggle(
        'is-active',
        button.dataset.editSide === state.activeSide,
      ),
    );
  const side = state.sides[state.activeSide];
  $('#cmp-active-side').textContent =
    `Build ${state.activeSide.toUpperCase()} · espaço ${side.activeSlot + 1}`;
}

function addItem(id) {
  const current = state.sides[state.activeSide];
  const item = state.data.itemById.get(String(id));
  let target = current.activeSlot;
  if (current.slots[target]) target = current.slots.findIndex((slot) => !slot);
  if (target < 0) {
    $('#cmp-status').textContent = 'Inventário completo: o limite é de seis espaços.';
    return;
  }
  const selected = current.slots.filter((slot, index) => slot && index !== target);
  const validation = window.RiftBuildCore.canAddItem(
    item,
    selected,
    current.championId || '',
  );
  if (!validation.allowed) {
    $('#cmp-status').textContent = validation.reason;
    return;
  }
  current.slots[target] = item;
  current.activeSlot = current.slots.findIndex((slot) => !slot);
  if (current.activeSlot < 0) current.activeSlot = 5;
  $('#cmp-status').textContent =
    `${item.displayName || item.name} adicionado à Build ${state.activeSide.toUpperCase()}.`;
  renderSide(state.activeSide);
  renderComparison();
  renderActiveSide();
}

async function loadSaved(side, id) {
  const build = state.saved.find((entry) => entry.id === id);
  if (!build) return;
  const result = window.RiftBuildCore.sanitizeBuildIds(
    build.itemIds,
    state.data.itemById,
    build.championId || '',
  );
  state.sides[side].slots = result.slots;
  state.sides[side].activeSlot = Math.max(
    0,
    result.slots.findIndex((item) => !item),
  );
  const select = $(`#cmp-champion-${side}`);
  select.value = build.championId;
  await loadChampion(side, build.championId);
  $('#cmp-status').textContent = result.warnings.length
    ? `${build.name}: ${result.warnings.length} item(ns) inválido(s) ignorado(s) nesta sessão; a build salva foi preservada.`
    : `${build.name} carregada na Build ${side.toUpperCase()}.`;
}

async function initialize() {
  try {
    state.data = await window.RiftBuildCore.loadStaticData();
    state.saved = savedBuilds();
    $('#cmp-patch').textContent = `Data Dragon · patch ${state.data.patch}`;
    renderChampionOptions();
    renderSavedOptions();
    ['a', 'b'].forEach((side) => {
      $(`#cmp-champion-${side}`).addEventListener('change', (event) =>
        loadChampion(side, event.target.value),
      );
      $(`#cmp-saved-${side}`).addEventListener('change', (event) =>
        loadSaved(side, event.target.value),
      );
      $(`[data-clear-side="${side}"]`).addEventListener('click', () => {
        state.sides[side] = {
          championId: '',
          detail: null,
          slots: Array(6).fill(null),
          activeSlot: 0,
        };
        $(`#cmp-champion-${side}`).value = '';
        $(`#cmp-saved-${side}`).value = '';
        renderSide(side);
        renderComparison();
        renderActiveSide();
      });
      renderSide(side);
    });
    document.querySelectorAll('[data-edit-side]').forEach((button) =>
      button.addEventListener('click', () => {
        state.activeSide = button.dataset.editSide;
        renderActiveSide();
        $('#cmp-item-search').focus();
      }),
    );
    $('#cmp-item-search').addEventListener('input', renderItems);
    $('#cmp-category').addEventListener('change', renderItems);
    renderItems();
    renderComparison();
    renderActiveSide();
  } catch (error) {
    $('#cmp-patch').textContent = 'Data Dragon indisponível';
    $('#cmp-status').textContent =
      'Confira a conexão e atualize a página. Nenhum dado fictício foi carregado.';
    console.error('Build Comparator: falha ao carregar catálogo oficial.', error);
  }
}

initialize();
