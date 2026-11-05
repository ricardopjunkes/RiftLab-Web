const BUILD_STORAGE_KEY = 'riftlab-build-lab-v1';
const BUILD_SLOT_COUNT = 6;
const BUILD_STATS = window.RiftBuildCore.BUILD_STATS;
const ui = {
  patch: document.querySelector('#build-patch'),
  champions: document.querySelector('#build-champions'),
  championCount: document.querySelector('#build-champion-count'),
  championSearch: document.querySelector('#build-champion-search'),
  selectedChampion: document.querySelector('#build-selected-champion'),
  items: document.querySelector('#build-items'),
  itemSearch: document.querySelector('#build-item-search'),
  category: document.querySelector('#build-item-category'),
  itemCount: document.querySelector('#build-item-count'),
  slots: document.querySelector('#build-slots'),
  cost: document.querySelector('#build-total-cost'),
  baseStats: document.querySelector('#build-base-stats'),
  bonusStats: document.querySelector('#build-bonus-stats'),
  totalStats: document.querySelector('#build-total-stats'),
  save: document.querySelector('#build-save'),
  status: document.querySelector('#build-status'),
  saved: document.querySelector('#build-saved-list'),
  savedCount: document.querySelector('#build-saved-count'),
  saveDialog: document.querySelector('#build-save-dialog'),
  name: document.querySelector('#build-name'),
  itemDialog: document.querySelector('#build-item-dialog'),
  itemDialogTitle: document.querySelector('#build-item-dialog-title'),
  itemDialogContent: document.querySelector('#build-item-dialog-content'),
};
const state = {
  patch: '',
  champions: [],
  champion: null,
  championDetail: null,
  items: [],
  groups: {},
  itemById: new Map(),
  slots: Array(BUILD_SLOT_COUNT).fill(null),
  activeSlot: 0,
  recentSlot: -1,
  saved: readSavedBuilds(),
  loadError: false,
};

function readSavedBuilds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BUILD_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedBuilds() {
  localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify(state.saved));
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
}

function cleanDescription(description = '') {
  const node = document.createElement('div');
  node.innerHTML = description;
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(
    value,
  );
}

async function fetchJson(url) {
  return window.RiftBuildCore.fetchJson(url);
}

async function initializeBuildLab() {
  try {
    const data = await window.RiftBuildCore.loadStaticData();
    state.patch = data.patch;
    ui.patch.textContent = `Data Dragon · patch ${state.patch}`;
    state.champions = data.champions;
    state.items = data.items;
    state.groups = data.groups;
    state.itemById = data.itemById;
    ui.champions.setAttribute('aria-busy', 'false');
    ui.items.setAttribute('aria-busy', 'false');
    renderChampions();
    renderItems();
    renderSlots();
    renderStats();
    renderSavedBuilds();
    restoreBuildFromUrl();
  } catch (error) {
    state.loadError = true;
    ui.patch.textContent = 'Dados oficiais indisponíveis';
    ui.champions.setAttribute('aria-busy', 'false');
    ui.items.setAttribute('aria-busy', 'false');
    ui.champions.innerHTML =
      '<p class="build-empty">Não foi possível carregar os campeões. Confira sua conexão e atualize esta página.</p>';
    ui.items.innerHTML =
      '<p class="build-empty">Não foi possível carregar o catálogo oficial de itens. Tente novamente ao atualizar a página.</p>';
    ui.status.textContent =
      'Os dados oficiais não carregaram. Nenhum dado foi substituído por valores fictícios.';
    console.error('Build Lab: erro ao carregar o Data Dragon.', error);
  }
}

function renderChampions() {
  const query = normalize(ui.championSearch.value);
  const filtered = state.champions.filter((champion) =>
    normalize(champion.name).includes(query),
  );
  ui.championCount.textContent = query
    ? `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}`
    : `${state.champions.length} disponíveis`;
  ui.champions.innerHTML = filtered.length
    ? filtered
        .map(
          (champion) => `
    <button class="build-champion-option ${state.champion?.id === champion.id ? 'selected' : ''}" type="button" data-champion-id="${escapeHtml(champion.id)}" aria-pressed="${state.champion?.id === champion.id}">
      <img src="https://ddragon.leagueoflegends.com/cdn/${state.patch}/img/champion/${escapeHtml(champion.image.full)}" alt="" loading="lazy" />
      <span>${escapeHtml(champion.name)}</span>
    </button>`,
        )
        .join('')
    : '<p class="build-empty">Nenhum campeão encontrado.</p>';
  ui.champions
    .querySelectorAll('[data-champion-id]')
    .forEach((button) =>
      button.addEventListener('click', () => selectChampion(button.dataset.championId)),
    );
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function selectChampion(id) {
  state.champion = state.champions.find((champion) => champion.id === id) || null;
  state.championDetail = null;
  renderChampions();
  if (!state.champion) return;
  ui.selectedChampion.innerHTML = `<div class="build-champion-loading">Carregando atributos de ${escapeHtml(state.champion.name)}…</div>`;
  ui.save.disabled = false;
  try {
    const data = await fetchJson(
      `https://ddragon.leagueoflegends.com/cdn/${state.patch}/data/pt_BR/champion/${encodeURIComponent(id)}.json`,
    );
    if (state.champion?.id !== id) return;
    state.championDetail = data.data[id];
    renderSelectedChampion();
    renderStats();
  } catch (error) {
    if (state.champion?.id !== id) return;
    ui.selectedChampion.innerHTML = `<div class="build-selected-copy"><img src="https://ddragon.leagueoflegends.com/cdn/${state.patch}/img/champion/${escapeHtml(state.champion.image.full)}" alt=""><div><span class="build-step">CAMPEÃO SELECIONADO</span><h3>${escapeHtml(state.champion.name)}</h3><p>Atributos base indisponíveis no momento.</p></div></div>`;
    ui.baseStats.innerHTML =
      '<p>Não foi possível carregar os atributos base oficiais.</p>';
    ui.totalStats.innerHTML =
      '<p>Selecione outro campeão ou tente novamente mais tarde.</p>';
  }
}

function renderSelectedChampion() {
  const champion = state.champion;
  const detail = state.championDetail;
  const artUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion.id}_0.jpg`;
  ui.selectedChampion.innerHTML = `<div class="build-selected-art" role="img" aria-label="Arte oficial de ${escapeHtml(champion.name)}" style="--build-champion-art:url('${artUrl}')"></div><div class="build-selected-copy"><img src="https://ddragon.leagueoflegends.com/cdn/${state.patch}/img/champion/${escapeHtml(champion.image.full)}" alt=""><div><span class="build-champion-classes">${escapeHtml(champion.tags.map(localizeClass).join(' · '))}</span><h3>${escapeHtml(champion.name)}</h3><p>${escapeHtml(champion.title)}</p></div></div><div class="build-champion-level">Nível 1 <span>·</span> atributos base oficiais</div>`;
  ui.baseStats.innerHTML = renderStatRows(baseStats(detail));
}

function localizeClass(role) {
  return (
    {
      Assassin: 'Assassino',
      Fighter: 'Lutador',
      Mage: 'Mago',
      Marksman: 'Atirador',
      Support: 'Suporte',
      Tank: 'Tanque',
    }[role] || role
  );
}

function baseStats(detail) {
  const stats = detail?.stats;
  if (!stats) return [];
  return [
    ['Dano de ataque', stats.attackdamage],
    ['Poder de habilidade', 0],
    ['Vida', stats.hp],
    ['Armadura', stats.armor],
    ['Resistência mágica', stats.spellblock],
    ['Velocidade de ataque', stats.attackspeed, 'attackSpeed'],
    ['Mana', stats.mp],
    ['Aceleração de habilidade', 0],
    ['Chance de crítico', 0, 'percent'],
    ['Velocidade de movimento', stats.movespeed, 'flat'],
  ];
}

function renderItems() {
  const query = normalize(ui.itemSearch.value);
  const category = ui.category.value;
  const list = state.items.filter((item) => {
    const searchMatch =
      normalize(item.name).includes(query) ||
      normalize(cleanDescription(item.description)).includes(query) ||
      normalize(item.id).includes(query);
    return searchMatch && (category === 'all' || itemCategory(item) === category);
  });
  ui.itemCount.textContent = `${list.length} ${list.length === 1 ? 'item' : 'itens'}`;
  ui.items.innerHTML = list.length
    ? list
        .map((item) => {
          return `<article class="build-item-card">
      <button class="build-item-add-button" type="button" data-item-id="${item.id}" aria-label="Adicionar ${escapeHtml(item.name)} à build">
        <span class="build-item-image"><img src="https://ddragon.leagueoflegends.com/cdn/${state.patch}/img/item/${escapeHtml(item.image.full)}" alt="" loading="lazy"></span>
        <span class="build-item-copy"><strong>${escapeHtml(item.displayName || item.name)}</strong><small>${formatNumber(item.gold.total)} ouro · ID ${escapeHtml(item.id)}</small><span>${escapeHtml(itemSummary(item))}</span></span>
        <span class="build-item-add" aria-hidden="true">＋</span>
      </button><button class="build-item-info" type="button" data-item-info="${item.id}" aria-label="Ver descrição de ${escapeHtml(item.name)}">i</button>
    </article>`;
        })
        .join('')
    : '<p class="build-empty">Nenhum item encontrado. Tente outro termo ou categoria.</p>';
  ui.items
    .querySelectorAll('[data-item-id]')
    .forEach((button) =>
      button.addEventListener('click', () => addItem(button.dataset.itemId)),
    );
  ui.items.querySelectorAll('[data-item-info]').forEach((button) =>
    button.addEventListener('click', () => {
      openItemDetail(button.dataset.itemInfo);
      ui.itemDialog.showModal();
    }),
  );
}

function itemCategory(item) {
  if (item.tags?.includes('Boots')) return 'boots';
  if (
    item.tags?.some((tag) =>
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
  if (
    item.tags?.some((tag) => ['SpellDamage', 'MagicPenetration', 'Mana'].includes(tag))
  )
    return 'magic';
  if (
    item.tags?.some((tag) =>
      ['Health', 'Armor', 'SpellBlock', 'HealthRegen'].includes(tag),
    )
  )
    return 'defense';
  return 'other';
}

function itemSummary(item) {
  const pieces = [];
  const statLabels = [
    ['FlatPhysicalDamageMod', ' AD'],
    ['FlatMagicDamageMod', ' AP'],
    ['FlatHPPoolMod', ' vida'],
    ['FlatArmorMod', ' armadura'],
    ['FlatSpellBlockMod', ' RM'],
    ['FlatMPPoolMod', ' mana'],
    ['FlatHasteMod', ' aceleração'],
    ['FlatMovementSpeedMod', ' de movimento'],
  ];
  for (const [key, label] of statLabels) {
    if (item.stats?.[key]) pieces.push(`+${formatNumber(item.stats[key])}${label}`);
  }
  const percentLabels = [
    ['PercentAttackSpeedMod', ' velocidade de ataque'],
    ['FlatCritChanceMod', ' crítico'],
    ['PercentLifeStealMod', ' roubo de vida'],
    ['PercentMovementSpeedMod', ' velocidade de movimento'],
  ];
  for (const [key, label] of percentLabels) {
    if (item.stats?.[key])
      pieces.push(`+${formatNumber(item.stats[key] * 100, 1)}%${label}`);
  }
  if (!pieces.length)
    pieces.push(
      Object.values(item.stats || {}).some((value) => Number(value))
        ? 'Outros atributos'
        : 'Efeito especial',
    );
  return pieces.join(' · ');
}

function addItem(id) {
  const item = state.itemById.get(id);
  if (!item || state.loadError) return;
  let target = state.activeSlot;
  if (!state.slots[target]) {
    const firstEmpty = state.slots.findIndex((slot) => !slot);
    if (firstEmpty !== -1) target = firstEmpty;
  }
  if (!state.slots[target] && state.slots.every(Boolean)) {
    notifyBuild('Inventário completo: o limite é de seis itens.');
    return;
  }
  const selected = state.slots.filter(
    (existing, index) => existing && index !== target,
  );
  const validation = window.RiftBuildCore.canAddItem(
    item,
    selected,
    state.champion?.id || '',
  );
  if (!validation.allowed) {
    notifyBuild(validation.reason);
    return;
  }
  state.slots[target] = item;
  state.activeSlot = Math.min(target + 1, BUILD_SLOT_COUNT - 1);
  state.recentSlot = target;
  notifyBuild(`${item.name} adicionado à build.`);
  renderSlots();
  window.setTimeout(() => {
    ui.slots.querySelector('.build-slot-recent')?.classList.remove('build-slot-recent');
    state.recentSlot = -1;
  }, 620);
  renderStats();
}

function renderSlots() {
  ui.slots.innerHTML = state.slots
    .map((item, index) =>
      item
        ? `
    <div class="build-slot filled ${state.activeSlot === index ? 'active' : ''} ${state.recentSlot === index ? 'build-slot-recent' : ''}">
      <button type="button" class="build-slot-select" data-slot-index="${index}" aria-label="Selecionar espaço ${index + 1}: ${escapeHtml(item.displayName || item.name)}"><img src="https://ddragon.leagueoflegends.com/cdn/${state.patch}/img/item/${escapeHtml(item.image.full)}" alt="${escapeHtml(item.displayName || item.name)}"><span class="build-slot-number">${index + 1}</span></button>
      <span class="build-slot-name" title="${escapeHtml(item.displayName || item.name)}">${escapeHtml(item.displayName || item.name)}</span><button class="build-slot-remove" type="button" data-remove-slot="${index}" aria-label="Remover ${escapeHtml(item.name)}">×</button>
    </div>`
        : `
    <button class="build-slot empty ${state.activeSlot === index ? 'active' : ''}" type="button" data-slot-index="${index}" aria-label="Selecionar espaço vazio ${index + 1}"><span class="build-slot-plus">＋</span><small>Espaço ${index + 1}</small></button>`,
    )
    .join('');
  ui.slots.querySelectorAll('[data-slot-index]').forEach((button) =>
    button.addEventListener('click', () => {
      state.activeSlot = Number(button.dataset.slotIndex);
      renderSlots();
    }),
  );
  ui.slots.querySelectorAll('[data-remove-slot]').forEach((button) =>
    button.addEventListener('click', () => {
      const index = Number(button.dataset.removeSlot);
      const removed = state.slots[index];
      state.slots[index] = null;
      state.activeSlot = index;
      notifyBuild(`${removed.name} removido da build.`);
      renderSlots();
      renderStats();
    }),
  );
}

function itemBonuses() {
  return window.RiftBuildCore.calculateBuild(state.championDetail, state.slots).bonuses;
}

function renderStats() {
  const chosen = state.slots.filter(Boolean);
  const calculated = window.RiftBuildCore.calculateBuild(
    state.championDetail,
    state.slots,
  );
  const { bonuses, cost, base, total } = calculated;
  ui.cost.innerHTML = `${formatNumber(cost)} <small>ouro</small>`;
  if (!state.championDetail) {
    ui.baseStats.innerHTML = '<p>Selecione um campeão.</p>';
    ui.totalStats.innerHTML = '<p>Os totais aparecerão após selecionar o campeão.</p>';
    ui.bonusStats.innerHTML = chosen.length
      ? renderBonusRows(bonuses)
      : '<p>Adicione itens para ver os bônus.</p>';
    ui.save.disabled = !chosen.length;
    return;
  }
  const baseRows = [
    ['Dano de ataque', base.attackDamage, 'flat'],
    ['Vida', base.health, 'flat'],
    ['Armadura', base.armor, 'flat'],
    ['Resistência mágica', base.magicResist, 'flat'],
    ['Velocidade de ataque', base.attackSpeed, 'attackSpeed'],
    ['Mana', base.mana, 'flat'],
    ['Velocidade de movimento', base.movementSpeed, 'flat'],
  ];
  ui.baseStats.innerHTML = renderStatRows(baseRows);
  ui.bonusStats.innerHTML = renderBonusRows(bonuses);
  const totalRows = [
    [
      'Dano de ataque',
      total.attackDamage,
      'flat',
      base.attackDamage,
      bonuses.FlatPhysicalDamageMod,
    ],
    ['Poder de habilidade', total.abilityPower, 'flat', 0, bonuses.FlatMagicDamageMod],
    ['Vida', total.health, 'flat', base.health, bonuses.FlatHPPoolMod],
    ['Armadura', total.armor, 'flat', base.armor, bonuses.FlatArmorMod],
    [
      'Resistência mágica',
      total.magicResist,
      'flat',
      base.magicResist,
      bonuses.FlatSpellBlockMod,
    ],
    [
      'Velocidade de ataque',
      total.attackSpeed,
      'attackSpeed',
      base.attackSpeed,
      bonuses.PercentAttackSpeedMod,
    ],
    ['Mana', total.mana, 'flat', base.mana, bonuses.FlatMPPoolMod],
    ['Aceleração de habilidade', total.haste, 'flat', 0, bonuses.FlatHasteMod],
    ['Chance de crítico', total.critChance, 'percent', 0, bonuses.FlatCritChanceMod],
    [
      'Velocidade de movimento',
      total.movementSpeed,
      'flat',
      base.movementSpeed,
      bonuses.FlatMovementSpeedMod || bonuses.PercentMovementSpeedMod,
    ],
    ['Roubo de vida', total.lifeSteal, 'percent', 0, bonuses.PercentLifeStealMod],
  ].filter(([, , , baseValue, bonus]) => baseValue || bonus);
  ui.totalStats.innerHTML =
    totalRows
      .map(
        ([name, value, format, , bonus]) =>
          `<div class="build-stat-row ${bonus > 0 ? 'is-increased' : ''}"><span>${statIcon(name)}${escapeHtml(name)}</span><strong>${formatStat(value, format)}</strong></div>`,
      )
      .join('') || '<p>Adicione itens para visualizar os totais.</p>';
  ui.save.disabled = false;
}

function renderBonusRows(bonuses) {
  const rows = BUILD_STATS.filter(([, , key]) => bonuses[key]).map(
    ([id, name, key, format]) => [name, bonuses[key], format],
  );
  return rows.length
    ? renderStatRows(rows, true)
    : '<p>Os itens selecionados não têm bônus numéricos interpretáveis.</p>';
}

function renderStatRows(rows, bonus = false) {
  return (
    rows
      .map(
        ([name, value, format]) =>
          `<div class="build-stat-row ${bonus && value > 0 ? 'is-bonus is-increased' : ''}"><span>${statIcon(name)}${escapeHtml(name)}</span><strong>${bonus && value > 0 ? '+' : ''}${formatStat(value, format)}</strong></div>`,
      )
      .join('') || '<p>Sem atributos disponíveis.</p>'
  );
}

function statIcon(name) {
  const normalized = normalize(name);
  const paths = [
    [
      /dano de ataque|poder de habilidade/,
      'M14.5 3.5 20 9l-7.5 7.5-3.2-3.2L3 19l2-6.3L14.5 3.5Z',
    ],
    [
      /vida/,
      'M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 3c0 5.6-7.5 10-7.5 10Z',
    ],
    [
      /armadura|resistencia magica/,
      'M12 3 19 6v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6l7-3Z',
    ],
    [
      /velocidade|movimento/,
      'M3 15.5c2.5-3.1 5.2-4.7 8-4.7 2.4 0 4.1 1 5.2 2.5L21 8M3 19h4M2 12h4M7 8h3',
    ],
    [/mana/, 'M12 3s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11Z'],
    [/aceleracao/, 'M12 7v5l3 2M12 3a9 9 0 1 0 9 9M12 3v3m9-3v6h-6'],
    [/critico/, 'm12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2Z'],
    [
      /roubo de vida/,
      'M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 3c0 5.6-7.5 10-7.5 10Z',
    ],
  ];
  const match = paths.find(([pattern]) => pattern.test(normalized));
  return `<svg class="build-stat-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${match?.[1] || 'M12 3 4 7v5c0 4 3.2 7.3 8 9 4.8-1.7 8-5 8-9V7l-8-4Z'}"/></svg>`;
}

function formatStat(value, format = 'flat') {
  const number = Number(value || 0);
  if (format === 'attackSpeed') return `${formatNumber(number, 2)} ataques/s`;
  if (format === 'percent') return `${formatNumber(number * 100, 1)}%`;
  return formatNumber(number, number % 1 ? 2 : 0);
}

function notifyBuild(message) {
  ui.status.textContent = message;
  ui.status.classList.remove('build-status-show');
  requestAnimationFrame(() => ui.status.classList.add('build-status-show'));
}

function openItemDetail(id) {
  const item = state.itemById.get(id);
  if (!item) return;
  ui.itemDialogTitle.textContent = item.name;
  ui.itemDialogContent.innerHTML = `<div class="build-item-detail"><img src="https://ddragon.leagueoflegends.com/cdn/${state.patch}/img/item/${escapeHtml(item.image.full)}" alt=""><div><strong>${formatNumber(item.gold.total)} ouro</strong><p>${escapeHtml(cleanDescription(item.description) || 'Sem descrição oficial disponível.')}</p></div></div>`;
}

function openSaveDialog() {
  if (!state.champion) {
    notifyBuild('Selecione um campeão antes de salvar a build.');
    return;
  }
  ui.name.value = `${state.champion.name} · Build`;
  ui.saveDialog.showModal();
  ui.name.focus();
  ui.name.select();
}

ui.saveDialog.addEventListener('close', () => {
  if (ui.saveDialog.returnValue !== 'save') return;
  const name = ui.name.value.trim();
  if (!name || !state.champion) return;
  const build = {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name,
    championId: state.champion.id,
    itemIds: state.slots.map((item) => item?.id || null),
    patch: state.patch,
    createdAt: new Date().toISOString(),
  };
  state.saved.unshift(build);
  state.saved = state.saved.slice(0, 30);
  persistSavedBuilds();
  renderSavedBuilds();
  notifyBuild('Build salva com sucesso neste navegador.');
});

function renderSavedBuilds() {
  ui.savedCount.textContent = `${state.saved.length} ${state.saved.length === 1 ? 'build' : 'builds'}`;
  ui.saved.innerHTML = state.saved.length
    ? state.saved
        .map((build) => {
          const champ = state.champions.find(
            (candidate) => candidate.id === build.championId,
          );
          const itemCount = (build.itemIds || []).filter(Boolean).length;
          return `<article class="build-saved-row"><img src="https://ddragon.leagueoflegends.com/cdn/${state.patch}/img/champion/${escapeHtml(champ?.image.full || `${build.championId}.png`)}" alt=""><div><strong>${escapeHtml(build.name)}</strong><small>${escapeHtml(champ?.name || build.championId)} · ${itemCount}/6 itens · patch ${escapeHtml(build.patch || '—')}</small></div><button type="button" data-load-build="${escapeHtml(build.id)}">Carregar</button><button type="button" class="build-delete-button" data-delete-build="${escapeHtml(build.id)}" aria-label="Excluir ${escapeHtml(build.name)}">×</button></article>`;
        })
        .join('')
    : '<p class="build-empty">Suas builds salvas aparecerão aqui.</p>';
  ui.saved
    .querySelectorAll('[data-load-build]')
    .forEach((button) =>
      button.addEventListener('click', () => loadSavedBuild(button.dataset.loadBuild)),
    );
  ui.saved.querySelectorAll('[data-delete-build]').forEach((button) =>
    button.addEventListener('click', () => {
      state.saved = state.saved.filter(
        (build) => build.id !== button.dataset.deleteBuild,
      );
      persistSavedBuilds();
      renderSavedBuilds();
      notifyBuild('Build removida.');
    }),
  );
}

async function loadSavedBuild(id) {
  const build = state.saved.find((item) => item.id === id);
  if (!build) return;
  const result = window.RiftBuildCore.sanitizeBuildIds(
    build.itemIds,
    state.itemById,
    build.championId || '',
  );
  state.slots = result.slots;
  state.activeSlot = state.slots.findIndex((item) => !item);
  if (state.activeSlot < 0) state.activeSlot = BUILD_SLOT_COUNT - 1;
  await selectChampion(build.championId);
  renderSlots();
  renderStats();
  notifyBuild(
    result.warnings.length
      ? `Build carregada. ${result.warnings.length} item(ns) inválido(s) foram ignorados nesta sessão; o registro salvo foi preservado.`
      : `Build “${build.name}” carregada.`,
  );
}

function restoreBuildFromUrl() {
  const buildId = new URLSearchParams(window.location.search).get('build');
  if (buildId) loadSavedBuild(buildId);
}

ui.championSearch.addEventListener('input', renderChampions);
ui.itemSearch.addEventListener('input', renderItems);
ui.category.addEventListener('change', renderItems);
document.querySelector('#build-clear').addEventListener('click', () => {
  state.slots = Array(BUILD_SLOT_COUNT).fill(null);
  state.activeSlot = 0;
  renderSlots();
  renderStats();
  notifyBuild('Inventário limpo.');
});
ui.save.addEventListener('click', openSaveDialog);
document
  .querySelector('#build-item-dialog-close')
  .addEventListener('click', () => ui.itemDialog.close());
ui.items.addEventListener('contextmenu', (event) => {
  const card = event.target.closest('[data-item-id]');
  if (!card) return;
  event.preventDefault();
  openItemDetail(card.dataset.itemId);
  ui.itemDialog.showModal();
});
ui.items.addEventListener('keydown', (event) => {
  if (event.key !== 'i' || !event.target.matches('[data-item-id]')) return;
  openItemDetail(event.target.dataset.itemId);
  ui.itemDialog.showModal();
});

initializeBuildLab();
