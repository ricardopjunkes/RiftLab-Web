const RUNE_STORAGE_KEY = 'riftlab-rune-pages-v1';
const runeUi = {
  patch: document.querySelector('#rune-patch'),
  status: document.querySelector('#rune-status'),
  champion: document.querySelector('#rune-champion'),
  championCard: document.querySelector('#rune-champion-card'),
  primaryTree: document.querySelector('#rune-primary-tree'),
  secondaryTree: document.querySelector('#rune-secondary-tree'),
  primarySlots: document.querySelector('#rune-primary-slots'),
  secondarySlots: document.querySelector('#rune-secondary-slots'),
  shards: document.querySelector('#rune-shards'),
  name: document.querySelector('#rune-page-name'),
  save: document.querySelector('#rune-save-button'),
  saved: document.querySelector('#rune-saved-pages'),
};
const shardRows = [
  [
    {
      id: 5008,
      name: 'Força adaptativa',
      effect: '9 de Força Adaptativa (5,4 de DdA ou 9 de PdH)',
      icon: 'StatModsAdaptiveForceIcon.png',
    },
    {
      id: 5005,
      name: 'Velocidade de ataque',
      effect: '10% de Velocidade de Ataque',
      icon: 'StatModsAttackSpeedIcon.png',
    },
    {
      id: 5007,
      name: 'Aceleração',
      effect: '8 de Aceleração de Habilidade',
      icon: 'StatModsCDRScalingIcon.png',
    },
  ],
  [
    {
      id: 5008,
      name: 'Força adaptativa',
      effect: '9 de Força Adaptativa (5,4 de DdA ou 9 de PdH)',
      icon: 'StatModsAdaptiveForceIcon.png',
    },
    {
      id: 5010,
      name: 'Velocidade de movimento',
      effect: '2,5% de Velocidade de Movimento',
      icon: 'StatModsMovementSpeedIcon.png',
    },
    {
      id: 5001,
      name: 'Vida escalável',
      effect: '10–180 de Vida adicional com base no nível',
      icon: 'StatModsHealthScalingIcon.png',
    },
  ],
  [
    {
      id: 5009,
      name: 'Vida',
      effect: '65 de Vida',
      icon: 'StatModsHealthPlusIcon.png',
    },
    {
      id: 5011,
      name: 'Tenacidade e resistência a lentidão',
      effect: '15% de Tenacidade e Resistência a Lentidão',
      icon: 'StatModsTenacityIcon.png',
    },
    {
      id: 5001,
      name: 'Vida escalável',
      effect: '10–180 de Vida adicional com base no nível',
      icon: 'StatModsHealthScalingIcon.png',
    },
  ],
];
const runeState = {
  data: null,
  championId: '',
  primaryTreeId: 0,
  primary: [],
  secondaryTreeId: 0,
  secondary: {},
  shards: [null, null, null],
  saved: readSavedPages(),
  editingId: null,
};

function readSavedPages() {
  try {
    const value = JSON.parse(localStorage.getItem(RUNE_STORAGE_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(
          (page) =>
            page && typeof page.id === 'string' && typeof page.name === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function persistSavedPages() {
  localStorage.setItem(RUNE_STORAGE_KEY, JSON.stringify(runeState.saved));
}

function escapeRune(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ],
  );
}

function runeText(value) {
  const node = document.createElement('div');
  node.innerHTML = value || '';
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

function iconUrl(icon) {
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`;
}

function getTree(id) {
  return runeState.data.runes.find((tree) => tree.id === Number(id));
}

function renderChampion() {
  const champion = runeState.data.champions.find(
    (entry) => entry.id === runeState.championId,
  );
  if (!champion) {
    runeUi.championCard.innerHTML =
      '<span class="rune-champion-emblem">✦</span><span>Escolha um campeão para começar</span>';
    return;
  }
  runeUi.championCard.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${runeState.data.patch}/img/champion/${escapeRune(champion.image.full)}" alt=""><span><small>${champion.tags.map(escapeRune).join(' · ')}</small><strong>${escapeRune(champion.name)}</strong><em>${escapeRune(champion.title)}</em></span>`;
}

function setTreeOptions() {
  const options = runeState.data.runes
    .map((tree) => `<option value="${tree.id}">${escapeRune(tree.name)}</option>`)
    .join('');
  runeUi.primaryTree.innerHTML = options;
  runeState.primaryTreeId ||= runeState.data.runes[0]?.id;
  runeUi.primaryTree.value = String(runeState.primaryTreeId);
  updateSecondaryOptions();
}

function updateSecondaryOptions() {
  const options = runeState.data.runes.filter(
    (tree) => tree.id !== Number(runeState.primaryTreeId),
  );
  if (!options.some((tree) => tree.id === Number(runeState.secondaryTreeId))) {
    runeState.secondaryTreeId = options[0]?.id || 0;
    runeState.secondary = {};
  }
  runeUi.secondaryTree.innerHTML = options
    .map((tree) => `<option value="${tree.id}">${escapeRune(tree.name)}</option>`)
    .join('');
  runeUi.secondaryTree.value = String(runeState.secondaryTreeId);
}

function renderPrimarySlots() {
  const tree = getTree(runeState.primaryTreeId);
  if (!tree) return;
  runeUi.primarySlots.innerHTML = tree.slots
    .map(
      (slot, index) =>
        `<section class="rune-row"><div class="rune-row-heading"><span>${index === 0 ? 'RUNA-CHAVE' : `LINHA ${index}`}</span><small>${index === 0 ? 'Escolha uma' : 'Escolha uma'}</small></div><div class="rune-choice-grid">${slot.runes
          .map((rune) => {
            const selected = runeState.primary[index] === rune.id;
            const description = runeText(rune.shortDesc || rune.longDesc);
            return `<button type="button" class="rune-choice ${selected ? 'selected' : ''}" data-primary-row="${index}" data-rune-id="${rune.id}" aria-pressed="${selected}" title="${escapeRune(description)}"><img src="${iconUrl(escapeRune(rune.icon))}" alt=""><span><strong>${escapeRune(rune.name)}</strong><small>${escapeRune(description)}</small></span></button>`;
          })
          .join('')}</div></section>`,
    )
    .join('');
  runeUi.primarySlots.querySelectorAll('[data-primary-row]').forEach((button) =>
    button.addEventListener('click', () => {
      const row = Number(button.dataset.primaryRow);
      runeState.primary[row] = Number(button.dataset.runeId);
      renderPrimarySlots();
      updateSaveState();
    }),
  );
}

function renderSecondarySlots() {
  const tree = getTree(runeState.secondaryTreeId);
  if (!tree) return;
  runeUi.secondarySlots.innerHTML = tree.slots
    .slice(1)
    .map((slot, offset) => {
      const row = offset + 1;
      return `<section class="rune-row"><div class="rune-row-heading"><span>LINHA ${row}</span><small>${runeState.secondary[row] ? 'Selecionada' : 'Escolha uma · máximo de 2 linhas'}</small></div><div class="rune-choice-grid">${slot.runes
        .map((rune) => {
          const selected = runeState.secondary[row] === rune.id;
          const description = runeText(rune.shortDesc || rune.longDesc);
          return `<button type="button" class="rune-choice ${selected ? 'selected' : ''}" data-secondary-row="${row}" data-rune-id="${rune.id}" aria-pressed="${selected}" title="${escapeRune(description)}"><img src="${iconUrl(escapeRune(rune.icon))}" alt=""><span><strong>${escapeRune(rune.name)}</strong><small>${escapeRune(description)}</small></span></button>`;
        })
        .join('')}</div></section>`;
    })
    .join('');
  runeUi.secondarySlots.querySelectorAll('[data-secondary-row]').forEach((button) =>
    button.addEventListener('click', () => {
      const row = Number(button.dataset.secondaryRow);
      const id = Number(button.dataset.runeId);
      if (runeState.secondary[row] === id) delete runeState.secondary[row];
      else {
        if (!runeState.secondary[row] && Object.keys(runeState.secondary).length >= 2) {
          runeUi.status.textContent =
            'Escolha duas runas secundárias em linhas diferentes. Remova uma antes de mudar a linha.';
          return;
        }
        runeState.secondary[row] = id;
      }
      renderSecondarySlots();
      updateSaveState();
    }),
  );
}

function renderShards() {
  runeUi.shards.innerHTML = shardRows
    .map(
      (row, rowIndex) =>
        `<div class="rune-shard-row"><div class="rune-row-heading"><span>FRAGMENTO ${rowIndex + 1}</span><small>Escolha um</small></div><div class="rune-shard-options">${row
          .map((shard, optionIndex) => {
            const selected = runeState.shards[rowIndex] === optionIndex;
            return `<button type="button" class="rune-shard ${selected ? 'selected' : ''}" data-shard-row="${rowIndex}" data-shard-choice="${optionIndex}" aria-pressed="${selected}" title="${escapeRune(shard.effect)}"><img src="${iconUrl(`perk-images/StatMods/${shard.icon}`)}" alt=""><span><strong>${escapeRune(shard.name)}</strong><small>${escapeRune(shard.effect)}</small></span></button>`;
          })
          .join('')}</div></div>`,
    )
    .join('');
  runeUi.shards.querySelectorAll('[data-shard-row]').forEach((button) =>
    button.addEventListener('click', () => {
      runeState.shards[Number(button.dataset.shardRow)] = Number(
        button.dataset.shardChoice,
      );
      renderShards();
      updateSaveState();
    }),
  );
}

function isComplete() {
  const primaryTree = getTree(runeState.primaryTreeId);
  const secondaryTree = getTree(runeState.secondaryTreeId);
  const primaryValid = Boolean(
    primaryTree &&
    primaryTree.slots.length === 4 &&
    primaryTree.slots.every((slot, index) =>
      slot.runes.some((rune) => rune.id === runeState.primary[index]),
    ),
  );
  const secondaryRows = Object.keys(runeState.secondary).map(Number);
  const secondaryValid = Boolean(
    secondaryTree &&
    secondaryTree.id !== primaryTree?.id &&
    secondaryRows.length === 2 &&
    new Set(secondaryRows).size === 2 &&
    secondaryRows.every((row) =>
      secondaryTree.slots[row]?.runes.some(
        (rune) => rune.id === runeState.secondary[row],
      ),
    ),
  );
  return Boolean(
    runeState.championId &&
    primaryValid &&
    secondaryValid &&
    runeState.shards.every(
      (shard, index) => Number.isInteger(shard) && Boolean(shardRows[index][shard]),
    ),
  );
}

function updateSaveState() {
  runeUi.save.disabled = !isComplete() || !runeUi.name.value.trim();
}

function currentPage() {
  return {
    id:
      runeState.editingId || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name: runeUi.name.value.trim(),
    patch: runeState.data.patch,
    championId: runeState.championId,
    primaryTreeId: Number(runeState.primaryTreeId),
    primary: [...runeState.primary],
    secondaryTreeId: Number(runeState.secondaryTreeId),
    secondary: { ...runeState.secondary },
    shards: [...runeState.shards],
    updatedAt: new Date().toISOString(),
  };
}

function renderSavedPages() {
  runeUi.saved.innerHTML = runeState.saved.length
    ? runeState.saved
        .map((page) => {
          const champion = runeState.data.champions.find(
            (entry) => entry.id === page.championId,
          );
          const tree = getTree(page.primaryTreeId);
          return `<article class="saved-tool-row"><img src="https://ddragon.leagueoflegends.com/cdn/${runeState.data.patch}/img/champion/${escapeRune(champion?.image.full || `${page.championId}.png`)}" alt=""><span><strong>${escapeRune(page.name)}</strong><small>${escapeRune(champion?.name || page.championId)} · ${escapeRune(tree?.name || 'Árvore')} · patch ${escapeRune(page.patch || '—')}</small></span><button type="button" data-load-rune="${escapeRune(page.id)}">Carregar</button><button type="button" class="saved-delete" data-delete-rune="${escapeRune(page.id)}" aria-label="Excluir ${escapeRune(page.name)}">×</button></article>`;
        })
        .join('')
    : '<p class="tool-empty">Você ainda não salvou páginas de runas.</p>';
  runeUi.saved
    .querySelectorAll('[data-load-rune]')
    .forEach((button) =>
      button.addEventListener('click', () => loadPage(button.dataset.loadRune)),
    );
  runeUi.saved.querySelectorAll('[data-delete-rune]').forEach((button) =>
    button.addEventListener('click', () => {
      runeState.saved = runeState.saved.filter(
        (page) => page.id !== button.dataset.deleteRune,
      );
      persistSavedPages();
      renderSavedPages();
      if (runeState.editingId === button.dataset.deleteRune) newPage();
      runeUi.status.textContent = 'Página de runas excluída.';
    }),
  );
}

function loadPage(id) {
  const page = runeState.saved.find((entry) => entry.id === id);
  if (!page) return;
  runeState.editingId = page.id;
  runeState.championId = page.championId;
  runeState.primaryTreeId = page.primaryTreeId;
  runeState.primary = Array.isArray(page.primary) ? [...page.primary].slice(0, 4) : [];
  runeState.secondaryTreeId = page.secondaryTreeId;
  runeState.secondary =
    page.secondary && typeof page.secondary === 'object' ? { ...page.secondary } : {};
  runeState.shards = Array.isArray(page.shards)
    ? [...page.shards].slice(0, 3)
    : [null, null, null];
  runeUi.champion.value = runeState.championId;
  runeUi.name.value = page.name;
  runeUi.primaryTree.value = String(runeState.primaryTreeId);
  updateSecondaryOptions();
  runeUi.secondaryTree.value = String(runeState.secondaryTreeId);
  renderChampion();
  renderPrimarySlots();
  renderSecondarySlots();
  renderShards();
  updateSaveState();
  runeUi.status.textContent = `Página “${page.name}” carregada. Você pode editar e salvar as alterações.`;
}

function newPage() {
  runeState.editingId = null;
  runeState.championId = '';
  runeState.primary = [];
  runeState.secondary = {};
  runeState.shards = [null, null, null];
  runeUi.champion.value = '';
  runeUi.name.value = '';
  renderChampion();
  renderPrimarySlots();
  renderSecondarySlots();
  renderShards();
  updateSaveState();
}

async function initializeRuneLab() {
  try {
    runeState.data = await window.RiftBuildCore.loadStaticData();
    runeUi.patch.textContent = `Data Dragon · patch ${runeState.data.patch}`;
    runeUi.champion.innerHTML += runeState.data.champions
      .map(
        (champion) =>
          `<option value="${escapeRune(champion.id)}">${escapeRune(champion.name)}</option>`,
      )
      .join('');
    runeUi.champion.addEventListener('change', (event) => {
      runeState.championId = event.target.value;
      renderChampion();
      updateSaveState();
    });
    runeState.primaryTreeId = runeState.data.runes[0]?.id || 0;
    runeState.secondaryTreeId = runeState.data.runes[1]?.id || 0;
    setTreeOptions();
    runeUi.primaryTree.addEventListener('change', () => {
      runeState.primaryTreeId = Number(runeUi.primaryTree.value);
      runeState.primary = [];
      updateSecondaryOptions();
      renderPrimarySlots();
      renderSecondarySlots();
      updateSaveState();
    });
    runeUi.secondaryTree.addEventListener('change', () => {
      runeState.secondaryTreeId = Number(runeUi.secondaryTree.value);
      runeState.secondary = {};
      renderSecondarySlots();
      updateSaveState();
    });
    runeUi.name.addEventListener('input', updateSaveState);
    runeUi.save.addEventListener('click', () => {
      if (!isComplete()) {
        runeUi.status.textContent =
          'Complete as escolhas de árvore principal, secundária e fragmentos antes de salvar.';
        return;
      }
      const page = currentPage();
      if (!page.name) return;
      const index = runeState.saved.findIndex((entry) => entry.id === page.id);
      if (index >= 0) runeState.saved[index] = page;
      else runeState.saved.unshift(page);
      runeState.saved = runeState.saved.slice(0, 30);
      runeState.editingId = page.id;
      persistSavedPages();
      renderSavedPages();
      runeUi.status.textContent = `Página “${page.name}” salva com sucesso neste navegador.`;
    });
    document.querySelector('#rune-new-button').addEventListener('click', newPage);
    renderPrimarySlots();
    renderSecondarySlots();
    renderShards();
    renderSavedPages();
    updateSaveState();
  } catch (error) {
    runeUi.patch.textContent = 'Dados oficiais indisponíveis';
    runeUi.status.textContent =
      'Não foi possível carregar runas e campeões do Data Dragon. Confira sua conexão e tente novamente.';
    console.error('Rune Lab: falha ao carregar dados oficiais.', error);
  }
}

initializeRuneLab();
