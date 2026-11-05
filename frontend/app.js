const laneGroups = {
  Topo: 'Aatrox Akali Akshan Ambessa Camille Cassiopeia Chogath Darius DrMundo Fiora Gangplank Garen Gnar Gragas Gwen Heimerdinger Illaoi Irelia Jax Jayce Kayle Kennen Kled KSante Malphite Mordekaiser Nasus Olaf Ornn Pantheon Poppy Quinn Renekton Riven Rumble Sett Shen Singed Sion Skarner Teemo Trundle Tryndamere Urgot Vayne Volibear Warwick MonkeyKing Yasuo Yone Yorick Zaahen',
  Selva:
    'Amumu Belveth Briar Diana Ekko Elise Evelynn Fiddlesticks Gragas Graves Hecarim Ivern JarvanIV Jax Karthus Kayn Khazix Kindred LeeSin Lillia MasterYi Morgana Nidalee Nocturne Nunu Olaf Poppy Rammus RekSai Rengar Sejuani Shaco Shyvana Skarner Taliyah Talon Trundle Udyr Vi Viego Volibear Warwick MonkeyKing XinZhao Zac',
  Meio: 'Ahri Akali Akshan Anivia Annie AurelionSol Aurora Azir Cassiopeia Corki Diana Ekko Fizz Galio Hwei Irelia Jayce Kassadin Katarina Leblanc Lissandra Locke Lucian Lux Malzahar Mel Naafiri Neeko Orianna Pantheon Qiyana Ryze Smolder Sylas Syndra Taliyah Talon Tristana TwistedFate Veigar Vex Viktor Vladimir Yasuo Yone Zed Ziggs Zilean Zoe',
  Atirador:
    'Aphelios Ashe Caitlyn Corki Draven Ezreal Jhin Jinx Kaisa Kalista KogMaw Lucian MissFortune Nilah Samira Senna Seraphine Sivir Smolder Tristana Twitch Varus Vayne Veigar Xayah Yasuo Yunara Zeri Ziggs',
  Suporte:
    'Alistar Annie Ashe Bard Blitzcrank Brand Braum Janna Karma Leona Lulu Lux Maokai Mel Milio Morgana Nami Nautilus Neeko Pantheon Poppy Pyke Rakan Rell RenataGlasc Senna Seraphine Sett Shaco Shen Sona Soraka Swain TahmKench Taric Thresh Twitch Velkoz Xerath Yuumi Zilean Zyra Heimerdinger',
};
const laneMap = {};
for (const [lane, names] of Object.entries(laneGroups))
  for (const id of names.split(/\s+/)) (laneMap[id] ??= []).push(lane);
function inferRole(tags) {
  if (tags.includes('Support')) return ['Suporte'];
  if (tags.includes('Marksman')) return ['Atirador'];
  if (tags.includes('Tank')) return ['Topo'];
  if (tags.includes('Assassin')) return ['Meio'];
  if (tags.includes('Mage')) return ['Meio'];
  return ['Topo'];
}
const roles = ['Todas', 'Topo', 'Selva', 'Meio', 'Atirador', 'Suporte'];
let champions = [],
  activeRole = 'Todas',
  patchVersion = '';
const championDetails = new Map();
const grid = document.querySelector('#grid'),
  search = document.querySelector('#search');
function metrics(tags) {
  const has = (v) => tags.includes(v);
  let p = has('Marksman')
    ? 88
    : has('Fighter')
      ? 76
      : has('Assassin')
        ? 72
        : has('Tank')
          ? 42
          : 35;
  let m = has('Mage') ? 88 : has('Support') ? 58 : has('Tank') ? 38 : 25;
  if (has('Mage') && has('Fighter')) {
    p = 55;
    m = 65;
  }
  const c = has('Tank')
    ? 88
    : has('Support')
      ? 78
      : has('Mage')
        ? 62
        : has('Fighter')
          ? 50
          : 40;
  return { p, m, c };
}
async function loadChampions() {
  grid.setAttribute('aria-busy', 'true');
  try {
    const versions = await fetch(
      'https://ddragon.leagueoflegends.com/api/versions.json',
    ).then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    });
    patchVersion = versions[0];
    const json = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/pt_BR/champion.json`,
    ).then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    });
    champions = Object.values(json.data).map((c) => ({
      ...c,
      roles: laneMap[c.id] || inferRole(c.tags),
      ...metrics(c.tags),
    }));
    loadDraftComparison();
    document.querySelector('.patch').innerHTML =
      `<i></i>Dados oficiais · patch ${patchVersion}`;
    renderGrid();
    grid.setAttribute('aria-busy', 'false');
    renderTeam();
    window.dispatchEvent(
      new CustomEvent('riftlab:champions-ready', {
        detail: { patchVersion, count: champions.length },
      }),
    );
    if (document.querySelector('#picker-dialog').open) renderPickerResults();
    await loadSharedComposition();
  } catch (e) {
    grid.setAttribute('aria-busy', 'false');
    document.querySelector('.patch').innerHTML =
      '<i></i>Não foi possível carregar os dados';
    grid.innerHTML =
      '<div class="empty">Não deu para carregar o catálogo oficial. Confira sua conexão e atualize a página.</div>';
  }
}
async function getChampionDetail(id) {
  if (!championDetails.has(id)) {
    const request = fetch(
      `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/pt_BR/champion/${id}.json`,
    )
      .then((response) => {
        if (!response.ok)
          throw new Error('Não foi possível carregar os dados do campeão.');
        return response.json();
      })
      .then((result) => result.data[id])
      .catch((error) => {
        championDetails.delete(id);
        throw error;
      });
    championDetails.set(id, request);
  }
  return championDetails.get(id);
}
function normalizeChampionName(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
function renderRoles() {
  document.querySelector('#roles').innerHTML = roles
    .map(
      (r) =>
        `<button class="role ${r === activeRole ? 'selected' : ''}" data-role="${r}">${r}</button>`,
    )
    .join('');
  document.querySelectorAll('.role').forEach(
    (b) =>
      (b.onclick = () => {
        activeRole = b.dataset.role;
        renderRoles();
        renderGrid();
      }),
  );
}
function renderGrid() {
  const classFilter = document.querySelector('#class-filter').value;
  const difficultyFilter = document.querySelector('#difficulty-filter').value;
  let list = champions.filter(
    (c) =>
      (activeRole === 'Todas' || c.roles.includes(activeRole)) &&
      (classFilter === 'Todas' || c.tags.includes(classFilter)) &&
      (difficultyFilter === 'Todas' ||
        (difficultyFilter === 'easy' && c.info.difficulty <= 3) ||
        (difficultyFilter === 'medium' &&
          c.info.difficulty >= 4 &&
          c.info.difficulty <= 6) ||
        (difficultyFilter === 'hard' && c.info.difficulty >= 7)) &&
      normalizeChampionName(c.name).includes(normalizeChampionName(search.value)),
  );
  if (document.querySelector('#sort').value === 'role')
    list.sort(
      (a, b) =>
        (a.roles[0] || '').localeCompare(b.roles[0] || '') ||
        a.name.localeCompare(b.name),
    );
  else list.sort((a, b) => a.name.localeCompare(b.name));
  document.querySelector('#champion-count').textContent = `${list.length} campeões`;
  grid.innerHTML = list.length
    ? list
        .map(
          (c) =>
            `<article class="champ" data-id="${c.id}"><div class="portrait"><img loading="lazy" class="champ-art" src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c.id}_0.jpg" onerror="this.onerror=null;this.src='https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${c.image.full}'" alt="Arte de ${c.name}"><button class="add" aria-label="Adicionar ${c.name} à sua equipe" data-add="${c.id}">＋</button><button class="info-btn" aria-label="Ver detalhes de ${c.name}" data-info="${c.id}">i</button></div><div class="champinfo"><div class="champname">${c.name}</div><div class="champmeta"><span>${c.roles.join(' / ')}</span><span>${c.title}</span></div></div></article>`,
        )
        .join('')
    : '<div class="empty">Nenhum campeão encontrado. Tente outro nome ou função.</div>';
  grid
    .querySelectorAll('.champ')
    .forEach((card) => (card.onclick = () => quickAddToAlly(card.dataset.id)));
  grid.querySelectorAll('[data-add]').forEach(
    (button) =>
      (button.onclick = (e) => {
        e.stopPropagation();
        quickAddToAlly(button.dataset.add);
      }),
  );
  grid.querySelectorAll('[data-info]').forEach(
    (button) =>
      (button.onclick = (e) => {
        e.stopPropagation();
        showChampion(button.dataset.info);
      }),
  );
}
function showChampion(id) {
  const champion = champions.find((c) => c.id === id);
  if (!champion) return;
  selectedChampion = id;
  document.querySelector('#position-select').value = laneMap[id]?.[0] || 'Topo';
  const dialog = document.querySelector('#champion-dialog');
  dialog.showModal();
  const art = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion.id}_0.jpg`;
  document.querySelector('#detail-content').innerHTML =
    `<section class="guide-hero" style="--guide-art:url('${art}')"><div><span class="eyebrow">${champion.tags.join(' · ')}</span><h2>${champion.name}</h2><p>${champion.title}</p></div></section><div class="guide-facts"><div><span>Rotas RiftLab</span><strong>${champion.roles.join(' · ')}</strong></div><div><span>Classe oficial</span><strong>${champion.tags.join(' · ')}</strong></div><div><span>Dificuldade</span><strong>${difficultyLabel(champion.info.difficulty)} · ${champion.info.difficulty}/10</strong></div></div><div class="detail-stats"><span>Ataque <b>${champion.info.attack}/10</b></span><span>Defesa <b>${champion.info.defense}/10</b></span><span>Magia <b>${champion.info.magic}/10</b></span><span>Dificuldade <b>${champion.info.difficulty}/10</b></span></div><section class="guide-lore"><h3>História</h3><p class="detail-blurb">Carregando história oficial...</p></section><section class="detail-skills">Carregando habilidades oficiais...</section><div class="guide-tips"><section><h3>Pontos fortes e dicas de aliados</h3><ul class="ally-tips"></ul></section><section><h3>Dicas para enfrentar</h3><ul class="enemy-tips"></ul></section></div><section class="guide-matchups"><h3>Confrontos</h3><p>Consulte taxas e tendências de confronto no OP.GG, com a rota selecionada abaixo. Esses dados são externos ao Data Dragon.</p><a id="detail-matchups-link" target="_blank" rel="noopener noreferrer">Ver confrontos no OP.GG ↗</a></section><p class="guide-disclaimer">Rotas sugeridas pelo mapa de funções do RiftLab. Dicas e habilidades fornecidas pelo Data Dragon; não são estatísticas de vitória nem uma lista de counters.</p>`;
  updateChampionMatchupLink();
  getChampionDetail(champion.id)
    .then((d) => {
      if (selectedChampion !== champion.id) return;
      const content = document.querySelector('#detail-content');
      content.querySelector('.detail-blurb').textContent = d.lore;
      const skillCards = [
        { ...d.passive, key: 'Passiva', type: 'passive' },
        ...d.spells.map((spell, i) => ({
          ...spell,
          key: ['Q', 'W', 'E', 'R'][i],
          type: 'spell',
        })),
      ];
      content.querySelector('.detail-skills').innerHTML =
        `<h3>Habilidades</h3><div class="skill-grid">${skillCards.map((skill) => `<article class="skill"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/${skill.type}/${skill.image.full}" alt="Ícone de ${skill.name}"><div><b>${skill.name} <span>${skill.key}</span></b><p>${skill.description}</p></div></article>`).join('')}</div>`;
      content.querySelector('.ally-tips').innerHTML = renderTips(
        d.allytips,
        'Este campeão não possui dicas de aliados no Data Dragon.',
      );
      content.querySelector('.enemy-tips').innerHTML = renderTips(
        d.enemytips,
        'Este campeão não possui dicas para adversários no Data Dragon.',
      );
    })
    .catch(() => {
      if (selectedChampion !== champion.id) return;
      document.querySelector('.detail-skills').textContent =
        'Não foi possível carregar as habilidades.';
    });
}
function difficultyLabel(value) {
  return value <= 3 ? 'Fácil' : value <= 6 ? 'Intermediária' : 'Difícil';
}
function renderTips(tips, emptyMessage) {
  return tips?.length
    ? tips.map((tip) => `<li>${tip}</li>`).join('')
    : `<li>${emptyMessage}</li>`;
}
function updateChampionMatchupLink() {
  const link = document.querySelector('#detail-matchups-link');
  if (!link || !selectedChampion) return;
  const lane = document.querySelector('#position-select').value;
  link.href = `https://op.gg/lol/champions/${opggSlug(selectedChampion)}/counters/${opggPosition(lane)}`;
  link.textContent = `Ver confrontos de ${lane} no OP.GG ↗`;
}
const laneKeys = ['Topo', 'Selva', 'Meio', 'Atirador', 'Suporte'];
let teams = { ally: {}, enemy: {} },
  selectedChampion = null,
  simulationInterval = null,
  simulationMotionInterval = null;
const COMPOSITION_STORAGE_KEY = 'riftlab-compositions-v1';
let editingCompositionId = null;
function readSavedCompositions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPOSITION_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            item &&
            typeof item.id === 'string' &&
            /^[\w-]{1,100}$/.test(item.id) &&
            typeof item.name === 'string' &&
            Array.isArray(item.ally) &&
            Array.isArray(item.enemy),
        )
      : [];
  } catch {
    return [];
  }
}
function writeSavedCompositions(items) {
  try {
    localStorage.setItem(COMPOSITION_STORAGE_KEY, JSON.stringify(items));
    document.querySelector('#history-status').textContent = '';
    renderCompositionHistory();
    return true;
  } catch {
    document.querySelector('#history-status').textContent =
      'Não foi possível salvar. Verifique o armazenamento do navegador.';
    return false;
  }
}
function renderCompositionHistory() {
  const list = document.querySelector('#composition-history-list');
  if (!list) return;
  const saved = readSavedCompositions();
  list.innerHTML = saved.length
    ? `<div class="history-grid">${saved.map((item) => `<article class="history-card"><div><strong>${escapeHtml(item.name)}</strong><small>Salva em ${new Date(item.updatedAt || item.createdAt).toLocaleDateString('pt-BR')}</small><p>${(item.ally || []).length} picks azuis · ${(item.enemy || []).length} picks vermelhos</p></div><div class="history-actions"><button data-history-action="load" data-history-id="${item.id}">Abrir e editar</button><button data-history-action="duplicate" data-history-id="${item.id}">Duplicar</button><button data-history-action="delete" data-history-id="${item.id}" aria-label="Excluir ${escapeHtml(item.name)}">Excluir</button></div></article>`).join('')}</div>`
    : '<p class="note">Suas composições salvas neste navegador aparecerão aqui.</p>';
  list.querySelectorAll('[data-history-action]').forEach((button) => {
    button.onclick = () =>
      handleCompositionHistory(button.dataset.historyAction, button.dataset.historyId);
  });
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}
function serializeTeam(team) {
  return laneKeys.flatMap((lane) =>
    team[lane] ? [{ lane, championId: team[lane].id }] : [],
  );
}
function requestCompositionName(defaultName, title) {
  const dialog = document.querySelector('#composition-name-dialog');
  const input = document.querySelector('#composition-name-input');
  document.querySelector('#composition-name-title').textContent = title;
  input.value = defaultName;
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => resolve(dialog.returnValue === 'save' ? input.value : null),
      { once: true },
    );
    dialog.showModal();
    input.focus();
    input.select();
  });
}
function confirmCompositionDelete(name) {
  const dialog = document.querySelector('#composition-confirm-dialog');
  document.querySelector('#composition-confirm-message').textContent =
    `A composição “${name}” será removida deste navegador.`;
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {
      once: true,
    });
    dialog.showModal();
  });
}
async function saveLocalComposition() {
  const hasPicks =
    serializeTeam(teams.ally).length || serializeTeam(teams.enemy).length;
  if (!hasPicks) {
    document.querySelector('#history-status').textContent =
      'Adicione ao menos um campeão antes de salvar.';
    return;
  }
  const existing = readSavedCompositions().find(
    (item) => item.id === editingCompositionId,
  );
  const name = await requestCompositionName(
    existing?.name || 'Minha composição',
    existing ? 'Atualizar composição' : 'Salvar composição',
  );
  if (name === null) return;
  const cleanName = name.trim();
  if (!cleanName) {
    document.querySelector('#history-status').textContent =
      'O nome da composição não pode ficar vazio.';
    return;
  }
  const now = new Date().toISOString();
  const entry = {
    id: editingCompositionId || createCompositionId(),
    name: cleanName,
    ally: serializeTeam(teams.ally),
    enemy: serializeTeam(teams.enemy),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const saved = readSavedCompositions();
  const next = existing
    ? saved.map((item) => (item.id === entry.id ? entry : item))
    : [entry, ...saved];
  if (writeSavedCompositions(next)) {
    editingCompositionId = entry.id;
    document.querySelector('#save-local-composition').textContent =
      'Atualizar composição';
    document.querySelector('#history-status').textContent =
      `“${cleanName}” salva neste navegador.`;
  }
}
function createCompositionId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
async function handleCompositionHistory(action, id) {
  const saved = readSavedCompositions();
  const item = saved.find((entry) => entry.id === id);
  if (!item) return;
  if (action === 'delete') {
    if (!(await confirmCompositionDelete(item.name))) return;
    writeSavedCompositions(saved.filter((entry) => entry.id !== id));
    if (editingCompositionId === id) resetEditingComposition();
    return;
  }
  if (action === 'duplicate') {
    const name = await requestCompositionName(
      `${item.name} (cópia)`,
      'Duplicar composição',
    );
    if (name === null || !name.trim()) return;
    const copy = {
      ...item,
      id: createCompositionId(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeSavedCompositions([copy, ...saved]);
    return;
  }
  if (action === 'load') {
    if (!champions.length) {
      document.querySelector('#history-status').textContent =
        'Aguarde o catálogo de campeões carregar.';
      return;
    }
    const hydrate = (entries = []) =>
      Object.fromEntries(
        entries
          .map(({ lane, championId }) => [
            lane,
            champions.find((champion) => champion.id === championId),
          ])
          .filter(([, champion]) => champion),
      );
    teams = { ally: hydrate(item.ally), enemy: hydrate(item.enemy) };
    editingCompositionId = item.id;
    document.querySelector('#save-local-composition').textContent =
      'Atualizar composição';
    document.querySelector('#history-status').textContent =
      `Editando “${item.name}”. Salve para atualizar.`;
    renderTeam();
    document
      .querySelector('#builder')
      .scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
function resetEditingComposition() {
  editingCompositionId = null;
  const button = document.querySelector('#save-local-composition');
  if (button) button.textContent = 'Salvar composição';
}
let analysisRequestId = 0;
function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
function scoreTeamComposition(team) {
  const picks = laneKeys.map((lane) => team[lane]);
  const physical = picks.filter(
    (champion) => champion.info.attack >= champion.info.magic,
  ).length;
  const magical = picks.length - physical;
  const magicShare = magical / picks.length;
  const balance =
    physical && magical
      ? clampScore(40 + 60 * (1 - Math.abs(0.5 - magicShare) / 0.5))
      : 48;
  const frontliners = picks.filter(
    (champion) =>
      champion.tags.some((tag) => ['Tank', 'Fighter'].includes(tag)) ||
      champion.info.defense >= 8,
  ).length;
  const supports = picks.filter((champion) => champion.tags.includes('Support')).length;
  const engageProxy = picks.filter(
    (champion) => champion.tags.includes('Tank') || champion.tags.includes('Fighter'),
  ).length;
  const magicClasses = picks.filter((champion) =>
    champion.tags.includes('Mage'),
  ).length;
  return {
    picks,
    physical,
    magical,
    magicShare,
    balance,
    frontliners,
    supports,
    engageProxy,
    magicClasses,
  };
}
function kitSignals(detail) {
  const descriptions = [
    detail.passive?.description,
    ...detail.spells.map(
      (spell) => `${spell.name} ${spell.description} ${spell.tooltip}`,
    ),
  ]
    .join(' ')
    .toLowerCase();
  return {
    engage:
      /avan[cç]|invest|arranc|salta|mergulh|arremess|puxa|dash|charge|leap|knock.?up|engage/.test(
        descriptions,
      ),
    cc: /atord|imobil|enraiz|silenc|arremess|derrub|lent|paralis|stun|root|airborne|knock.?up|suppress/.test(
      descriptions,
    ),
    protect:
      /escud|proteg|reduz.{0,30}dano|shield|protect|damage reduction|cura.{0,30}aliad|aliad.{0,30}cura|heal.{0,30}ally|ally.{0,30}heal/.test(
        descriptions,
      ),
    area: /inimigos? (pr[oó]ximos|na [aá]rea|atingidos)|todos os inimigos|em [aá]rea|nearby enemies|all enemies|area of effect/.test(
      descriptions,
    ),
  };
}
async function analyzeCompositionTeam(team) {
  const base = scoreTeamComposition(team);
  const details = await Promise.all(
    base.picks.map((champion) => getChampionDetail(champion.id).catch(() => null)),
  );
  const signals = details.filter(Boolean).map(kitSignals);
  const detected = (key) => signals.filter((signal) => signal[key]).length;
  const engage = detected('engage');
  const cc = detected('cc');
  const protect = detected('protect');
  const area = detected('area');
  const dimensions = {
    'Equilíbrio de dano': base.balance,
    'Linha de frente': clampScore(base.frontliners * 22 + (base.frontliners ? 15 : 0)),
    Iniciação: clampScore(
      Math.min(engage, 3) * 18 + Math.min(base.engageProxy, 2) * 10 + 8,
    ),
    'Controle de grupo': clampScore(
      Math.min(cc, 3) * 16 + Math.min(base.engageProxy + base.magicClasses, 2) * 8 + 8,
    ),
    Proteção: clampScore(Math.min(protect, 2) * 20 + base.supports * 8 + 8),
    'Luta em equipe': clampScore(
      Math.min(area, 3) * 14 +
        Math.min(base.magicClasses + base.supports + base.frontliners, 5) * 5 +
        8,
    ),
  };
  const score = clampScore(
    Object.values(dimensions).reduce((sum, value) => sum + value, 0) /
      Object.keys(dimensions).length,
  );
  return {
    ...base,
    dimensions,
    score,
    engage,
    cc,
    protect,
    area,
    detailsAvailable: details.filter(Boolean).length,
  };
}
function renderTeamAnalysis(_team, side, result) {
  const title = side === 'ally' ? 'Sua equipe · Azul' : 'Adversário · Vermelho';
  const strong = Object.entries(result.dimensions)
    .filter(([, value]) => value >= 70)
    .map(([label]) => label);
  const attention = Object.entries(result.dimensions)
    .filter(([, value]) => value < 55)
    .map(([label]) => label);
  const notes = [];
  if (result.physical && result.magical)
    notes.push(
      `Dano com fontes físicas e mágicas estimadas (${result.physical} / ${result.magical} campeões pelo atributo de maior peso).`,
    );
  else
    notes.push(
      'O dano está concentrado em um tipo; a estimativa usa Ataque/Magia do Data Dragon.',
    );
  if (result.frontliners >= 2)
    notes.push('Dois ou mais campeões com perfil de linha de frente (classe/Defesa).');
  if (result.engage >= 2)
    notes.push('Descrições oficiais indicam ferramentas de iniciação em vários kits.');
  if (result.cc >= 2)
    notes.push(
      'Descrições oficiais indicam controle de grupo distribuído pela equipe.',
    );
  if (result.protect >= 2)
    notes.push(
      'Há habilidades descritas como cura, escudo ou proteção em mais de um kit.',
    );
  if (result.area >= 2)
    notes.push('Várias descrições mencionam dano ou efeito em área.');
  if (!result.detailsAvailable)
    notes.push(
      'Habilidades não carregaram; alguns sinais usam apenas classes e atributos.',
    );
  const dimensionMarkup = Object.entries(result.dimensions)
    .map(
      ([label, value]) =>
        `<div class="dimension-row"><span>${label}</span><div><i style="width:${value}%"></i></div><b>${value}</b></div>`,
    )
    .join('');
  return `<article class="analysis-team ${side}"><div class="analysis-team-heading"><h4>${title}</h4><strong>${result.score}<small>/100</small></strong></div><div class="dimensions">${dimensionMarkup}</div><div class="analysis-notes"><h5>O que o modelo detectou</h5><ul>${notes.map((note) => `<li>${note}</li>`).join('')}</ul>${attention.length ? `<p class="attention-line">Pontos de atenção: ${attention.join(', ')}.</p>` : '<p class="positive-line">Nenhum ponto crítico neste modelo.</p>'}${strong.length ? `<p class="positive-line">Destaques: ${strong.join(', ')}.</p>` : ''}</div></article>`;
}
async function renderCompositionAnalysis() {
  const container = document.querySelector('#synergy-analysis');
  const requestId = ++analysisRequestId;
  const blueCount = laneKeys.filter((lane) => teams.ally[lane]).length;
  const redCount = laneKeys.filter((lane) => teams.enemy[lane]).length;
  if (blueCount < 5 || redCount < 5) {
    container.innerHTML = `<p class="note">Complete as duas equipes para comparar as composições. Sua equipe: ${blueCount}/5 · Adversário: ${redCount}/5.</p>`;
    return;
  }
  container.innerHTML =
    '<p class="note">Analisando atributos, classes e descrições oficiais das habilidades...</p>';
  const [blue, red] = await Promise.all([
    analyzeCompositionTeam(teams.ally),
    analyzeCompositionTeam(teams.enemy),
  ]);
  if (requestId !== analysisRequestId) return;
  const comparison = Object.keys(blue.dimensions).map((dimension) => {
    const difference = blue.dimensions[dimension] - red.dimensions[dimension];
    return Math.abs(difference) >= 12
      ? `${dimension}: ${difference > 0 ? 'Azul' : 'Vermelho'} tem mais ferramentas no modelo.`
      : `${dimension}: perfil semelhante.`;
  });
  const matchupNotes = [];
  if (red.magical >= 4)
    matchupNotes.push(
      `Vermelho concentra fontes de dano mágico estimadas (${red.magical}/5); Azul tem ${blue.frontliners} perfis de linha de frente por classe/atributo.`,
    );
  if (blue.magical >= 4)
    matchupNotes.push(
      `Azul concentra fontes de dano mágico estimadas (${blue.magical}/5); Vermelho tem ${red.frontliners} perfis de linha de frente por classe/atributo.`,
    );
  if (red.frontliners >= 3 && blue.magicClasses === 0)
    matchupNotes.push(
      'Contra uma linha de frente numerosa do Vermelho, Azul não tem campeões da classe Mago; considere adicionar dano mágico dedicado.',
    );
  if (blue.frontliners >= 3 && red.magicClasses === 0)
    matchupNotes.push(
      'Contra uma linha de frente numerosa do Azul, Vermelho não tem campeões da classe Mago; considere adicionar dano mágico dedicado.',
    );
  if (!matchupNotes.length)
    matchupNotes.push(
      'As equipes não apresentam concentração extrema de classes ou fontes de dano neste modelo.',
    );
  container.innerHTML = `<div class="synergy-scores">${renderTeamAnalysis(teams.ally, 'ally', blue)}${renderTeamAnalysis(teams.enemy, 'enemy', red)}</div><section class="composition-comparison"><h4>Comparação do draft</h4><p><strong>Sinergia estimada:</strong> Azul ${blue.score}/100 · Vermelho ${red.score}/100. A diferença mede apenas os critérios abaixo; não prevê o vencedor.</p><ul>${comparison.map((line) => `<li>${line}</li>`).join('')}</ul><h4>Cobertura contra a composição adversária</h4><ul>${matchupNotes.map((line) => `<li>${line}</li>`).join('')}</ul><p>O atributo Defesa não separa armadura e resistência mágica; por isso, a leitura de dano não garante que a equipe aguente o tipo de dano adversário.</p></section><p class="model-note">Como o modelo funciona: seis dimensões determinísticas usam os atributos Ataque/Magia/Defesa, classes do catálogo e sinais encontrados nas descrições oficiais das habilidades do patch ${patchVersion}. Pesos e limites são regras heurísticas do RiftLab, não estatísticas de partidas; combinações táticas específicas e vantagem real em confrontos não são inferidas.</p>`;
}
let pickerTarget = null;
function openPicker(side, lane) {
  pickerTarget = { side, lane };
  document.querySelector('#picker-context').textContent =
    `${side === 'ally' ? 'Sua equipe' : 'Adversário'} · ${lane}`;
  const input = document.querySelector('#picker-search');
  input.value = '';
  renderPickerResults();
  document.querySelector('#picker-dialog').showModal();
  input.focus();
}
function renderPickerResults() {
  const query = normalizeChampionName(
    document.querySelector('#picker-search').value.trim(),
  );
  const found = champions
    .filter((c) => normalizeChampionName(c.name).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
  const results = document.querySelector('#picker-results');
  results.innerHTML = found.length
    ? found
        .map(
          (c) =>
            `<button type="button" class="picker-option" data-picker-id="${c.id}"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${c.image.full}" alt=""><span><strong>${c.name}</strong><small>${c.roles.join(' / ')}</small></span></button>`,
        )
        .join('')
    : '<div class="picker-no-results">Nenhum campeão encontrado. Tente outro nome.</div>';
  results
    .querySelectorAll('[data-picker-id]')
    .forEach(
      (button) => (button.onclick = () => chooseForSlot(button.dataset.pickerId)),
    );
}
function chooseForSlot(id) {
  if (!pickerTarget) return;
  const champ = champions.find((c) => c.id === id);
  if (!champ) return;
  const { side, lane } = pickerTarget;
  if (
    Object.entries(teams[side]).some(
      ([otherLane, pick]) => otherLane !== lane && pick?.id === id,
    )
  ) {
    notify(`${champ.name} já está na composição dessa equipe.`);
    return;
  }
  teams[side][lane] = champ;
  document.querySelector('#picker-dialog').close();
  renderTeam();
  notify(
    `${champ.name} colocado em ${side === 'ally' ? 'sua equipe' : 'adversário'} · ${lane}.`,
  );
}
function quickAddToAlly(id) {
  const champ = champions.find((c) => c.id === id);
  if (!champ) return;
  if (Object.values(teams.ally).some((pick) => pick?.id === id)) {
    notify(`${champ.name} já está na sua equipe.`);
    return;
  }
  const lane = champ.roles.find((role) => !teams.ally[role]);
  if (!lane) {
    showChampion(id);
    return;
  }
  teams.ally[lane] = champ;
  renderTeam();
  notify(`${champ.name} adicionado à sua equipe · ${lane}.`);
}
function addToTeam(side) {
  if (!selectedChampion) return;
  const champ = champions.find((c) => c.id === selectedChampion);
  const lane = document.querySelector('#position-select').value;
  teams[side][lane] = champ;
  document.querySelector('#champion-dialog').close();
  renderTeam();
  notify(
    `${champ.name} adicionado ${side === 'ally' ? 'à sua equipe' : 'ao adversário'} na rota ${lane}.`,
  );
}
function removePick(side, lane) {
  delete teams[side][lane];
  renderTeam();
}
function opggPosition(lane) {
  return {
    Topo: 'top',
    Selva: 'jungle',
    Meio: 'mid',
    Atirador: 'adc',
    Suporte: 'support',
  }[lane];
}
function opggSlug(id) {
  return { MonkeyKing: 'wukong' }[id] || id.toLowerCase();
}
function renderTeam() {
  const count = (side) => Object.keys(teams[side]).length;
  document.querySelector('#count').textContent =
    `${count('ally')} / 5 · ${count('enemy')} / 5`;
  for (const [side, target] of [
    ['ally', '#ally-slots'],
    ['enemy', '#enemy-slots'],
  ]) {
    document.querySelector(target).innerHTML = laneKeys
      .map((lane) => {
        const champ = teams[side][lane];
        return `<div class="team-pick"><span class="lane-label">${lane}</span>${champ ? `<div class="pick-chip"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${champ.image.full}" alt=""><span>${champ.name}</span><button data-remove-side="${side}" data-remove-lane="${lane}" aria-label="Remover ${champ.name}">×</button></div>` : '<button type="button" class="pick-empty" data-pick-side="' + side + '" data-pick-lane="' + lane + '"><span>＋</span><span>Buscar campeão</span></button>'}</div>`;
      })
      .join('');
  }
  document
    .querySelectorAll('[data-remove-side]')
    .forEach(
      (b) => (b.onclick = () => removePick(b.dataset.removeSide, b.dataset.removeLane)),
    );
  document
    .querySelectorAll('[data-pick-side]')
    .forEach(
      (b) => (b.onclick = () => openPicker(b.dataset.pickSide, b.dataset.pickLane)),
    );
  document.querySelector('#matchups').innerHTML =
    laneKeys
      .map((lane) => {
        const ally = teams.ally[lane],
          enemy = teams.enemy[lane];
        if (!ally && !enemy) return '';
        if (!ally || !enemy)
          return `<div class="matchup-row"><span class="lane-label">${lane}</span><div class="matchup-versus">${ally ? `<strong>${ally.name}</strong>` : 'Sua equipe sem pick'} <span>vs</span> ${enemy ? `<strong>${enemy.name}</strong>` : 'adversário sem pick'}</div><span class="match-wait">Escolha os dois campeões da rota</span></div>`;
        const url = `https://op.gg/lol/champions/${opggSlug(ally.id)}/counters/${opggPosition(lane)}`;
        return `<div class="matchup-row"><span class="lane-label">${lane}</span><div class="matchup-versus"><strong>${ally.name}</strong> <span>vs</span> <strong>${enemy.name}</strong></div><a class="match-link" href="${url}" target="_blank" rel="noopener noreferrer">Ver confrontos no OP.GG ↗</a></div>`;
      })
      .join('') ||
    '<p class="note">Adicione campeões às equipes para comparar os confrontos de rota.</p>';
  const ready = count('ally') === 5 && count('enemy') === 5;
  const simButton = document.querySelector('#simulate');
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  if (simulationMotionInterval) {
    clearInterval(simulationMotionInterval);
    simulationMotionInterval = null;
  }
  if (simButton) {
    simButton.disabled = !ready;
    simButton.textContent = ready ? 'Simular uma partida' : 'Complete as duas equipes';
  }
  document.querySelector('#simulation-result').innerHTML =
    `<div class="sim-empty">${ready ? 'Pronto para a partida. Clique em “Simular uma partida” para acompanhar a animação.' : 'Monte as duas equipes com cinco campeões para liberar a simulação.'}</div>`;
  renderCompositionAnalysis();
  renderCompositionHistory();
}
function teamPower(team) {
  const picks = laneKeys.map((lane) => team[lane]);
  const average =
    picks.reduce(
      (sum, c) => sum + (c.info.attack + c.info.defense + c.info.magic) / 3,
      0,
    ) / picks.length;
  const tags = new Set(picks.flatMap((c) => c.tags));
  const frontline = picks.filter(
    (c) => c.tags.includes('Tank') || c.tags.includes('Fighter'),
  ).length;
  const support = picks.filter((c) => c.tags.includes('Support')).length;
  return (
    average +
    Math.min(tags.size, 5) * 0.08 +
    Math.min(frontline, 3) * 0.1 +
    Math.min(support, 2) * 0.06
  );
}
function simulateMatch() {
  if (laneKeys.some((l) => !teams.ally[l] || !teams.enemy[l])) return;
  if (simulationInterval) clearInterval(simulationInterval);
  if (simulationMotionInterval) clearInterval(simulationMotionInterval);
  const bluePower = teamPower(teams.ally),
    redPower = teamPower(teams.enemy),
    powerGap = (bluePower - redPower) / Math.max(bluePower + redPower, 1),
    blueChance = Math.max(
      35,
      Math.min(65, 50 + powerGap * 80 + (Math.random() - 0.5) * 10),
    );
  const result = document.querySelector('#simulation-result'),
    button = document.querySelector('#simulate');
  button.disabled = true;
  button.textContent = 'Partida em andamento…';
  result.innerHTML = `<div class="sim-stage"><div class="sim-live"><div class="sim-clock" id="sim-clock">00:00</div><div class="sim-live-copy"><small>O que está acontecendo</small><strong id="live-event">Os dez campeões entram no Rift e seguem para suas rotas.</strong></div></div><div class="sim-layout"><div><div class="map-viewport" id="map-viewport"><img class="map-image" src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/map/map11.png" alt="Mapa do Summoner’s Rift"><span class="map-label top">Topo</span><span class="map-label mid">Meio</span><span class="map-label bot">Inferior</span><span class="map-base">BASE AZUL</span><span class="map-base red-base">BASE VERMELHA</span><div class="objective-pin" id="dragon-pin">DRAGÃO</div><div class="objective-pin baron" id="baron-pin">ARAUTO</div><div class="unit-layer" id="unit-layer"></div></div><div class="map-legend"><span><i class="legend-dot"></i>Sua equipe</span><span><i class="legend-dot red"></i>Adversário</span><span><i class="legend-dot gold"></i>Objetivo</span></div></div><aside class="sim-rail"><div class="sim-scoreboard"><div class="score-card"><span>AZUL · SUA EQUIPE</span><strong id="blue-kills">0 abates</strong></div><div class="score-card red"><span>VERMELHO · ADVERSÁRIO</span><strong id="red-kills">0 abates</strong></div></div><div class="sim-economy"><div><b>Azul</b><span id="blue-economy">2.5k ouro · Nv. 1 · 11 torres · 0 dragões · 0 Barões</span></div><div><b>Vermelho</b><span id="red-economy">2.5k ouro · Nv. 1 · 11 torres · 0 dragões · 0 Barões</span></div></div><div class="sim-feed"><h3>Momentos importantes</h3><ol id="event-feed"></ol></div><div class="score-card"><span>VANTAGEM ESTIMADA DO MODELO</span><strong style="color:var(--text)" id="sim-chance">Azul ${blueChance.toFixed(1)}% · Vermelho ${(100 - blueChance).toFixed(1)}%</strong></div></aside></div><div id="sim-finish"></div></div>`;
  const teamsData = { blue: teams.ally, red: teams.enemy };
  const starts = {
    blue: {
      Topo: [16, 20],
      Selva: [29, 57],
      Meio: [39, 60],
      Atirador: [70, 82],
      Suporte: [65, 86],
    },
    red: {
      Topo: [78, 14],
      Selva: [72, 42],
      Meio: [62, 39],
      Atirador: [84, 68],
      Suporte: [89, 64],
    },
  };
  const lanePaths = {
    blue: {
      Topo: [
        [16, 20],
        [13, 14],
        [24, 10],
        [50, 8],
        [78, 14],
      ],
      Meio: [
        [39, 60],
        [50, 50],
        [65, 36],
        [81, 19],
      ],
      Atirador: [
        [70, 82],
        [82, 82],
        [90, 70],
        [90, 50],
        [88, 30],
        [86, 18],
      ],
    },
    red: {
      Topo: [
        [78, 14],
        [65, 10],
        [45, 8],
        [24, 10],
        [16, 20],
      ],
      Meio: [
        [62, 39],
        [50, 50],
        [35, 65],
        [19, 81],
      ],
      Atirador: [
        [84, 68],
        [89, 82],
        [70, 88],
        [42, 89],
        [15, 86],
      ],
    },
  };
  function routePoint(points, t) {
    const scaled = Math.max(0, Math.min(1, t)) * (points.length - 1),
      i = Math.min(points.length - 2, Math.floor(scaled)),
      f = scaled - i;
    return [
      points[i][0] + (points[i + 1][0] - points[i][0]) * f,
      points[i][1] + (points[i + 1][1] - points[i][1]) * f,
    ];
  }
  const layer = document.querySelector('#unit-layer');
  const units = new Map();
  const matchState = {
    blue: { gold: 2500, level: 1, towers: 11, dragons: 0, barons: 0 },
    red: { gold: 2500, level: 1, towers: 11, dragons: 0, barons: 0 },
    towerHealth: { blue: {}, red: {} },
    waveNumber: 0,
  };
  const minionMarkers = [];
  const towerMarkers = [];
  for (const side of ['blue', 'red']) {
    for (const lane of ['Topo', 'Meio', 'Atirador']) {
      const path = lanePaths[side][lane];
      const minion = document.createElement('div');
      minion.className = `minion-wave ${side}`;
      minion.setAttribute(
        'aria-label',
        `Onda de minions ${side === 'blue' ? 'azul' : 'vermelha'} na rota ${lane}`,
      );
      layer.append(minion);
      minionMarkers.push({ side, lane, marker: minion });
      matchState.towerHealth[side][lane] = [100, 100, 100];
      for (let index = 0; index < 3; index++) {
        const point = routePoint(path, 0.18 + index * 0.19);
        const tower = document.createElement('span');
        tower.className = `tower-marker ${side}`;
        tower.style.left = `${point[0]}%`;
        tower.style.top = `${point[1]}%`;
        tower.setAttribute('aria-label', `Torre ${index + 1} da rota ${lane}`);
        layer.append(tower);
        towerMarkers.push({ side, lane, index, marker: tower });
      }
    }
  }
  for (const side of ['blue', 'red'])
    for (const lane of laneKeys) {
      const c = teamsData[side][lane],
        p = starts[side][lane],
        marker = document.createElement('div');
      marker.className = `moving-champ ${side === 'red' ? 'red' : ''}`;
      marker.id = `unit-${side}-${lane}`;
      marker.style.left = p[0] + '%';
      marker.style.top = p[1] + '%';
      marker.dataset.x = String(p[0]);
      marker.dataset.y = String(p[1]);
      marker.dataset.targetX = String(p[0]);
      marker.dataset.targetY = String(p[1]);
      marker.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${c.image.full}" alt=""><span class="unit-name">${c.name}</span>`;
      layer.appendChild(marker);
      units.set(marker.id, marker);
    }
  const feed = document.querySelector('#event-feed');
  let blueKills = 0,
    redKills = 0;
  function fmt(min) {
    return `${String(min).padStart(2, '0')}:00`;
  }
  function move(side, lane, x, y) {
    const el = units.get(`unit-${side}-${lane}`);
    if (el) {
      el.dataset.targetX = String(Math.max(3, Math.min(97, x)));
      el.dataset.targetY = String(Math.max(3, Math.min(97, y)));
    }
  }
  function objectiveMove(which, onlySide = null) {
    const pit = which === 'dragon' ? [66, 64] : [42, 36],
      lanes =
        which === 'dragon'
          ? ['Selva', 'Meio', 'Atirador', 'Suporte']
          : ['Topo', 'Selva', 'Meio', 'Suporte'];
    for (const side of onlySide ? [onlySide] : ['blue', 'red'])
      lanes.forEach((lane, i) => {
        const d = side === 'blue' ? -1 : 1;
        move(
          side,
          lane,
          pit[0] + d * (8 + (i % 2 ? 4 : -4)),
          pit[1] + (i % 2 ? 5 : -5),
        );
      });
  }
  let lastMotionAt = performance.now();
  simulationMotionInterval = setInterval(() => {
    const now = performance.now();
    const dt = Math.min(100, now - lastMotionAt);
    lastMotionAt = now;
    for (const marker of units.values()) {
      let x = Number(marker.dataset.x),
        y = Number(marker.dataset.y);
      const tx = Number(marker.dataset.targetX),
        ty = Number(marker.dataset.targetY),
        dx = tx - x,
        dy = ty - y,
        distance = Math.hypot(dx, dy);
      if (distance < 0.025) {
        x = tx;
        y = ty;
      } else {
        const step = Math.min(distance * 0.22, (11 * dt) / 1000);
        x += (dx / distance) * step;
        y += (dy / distance) * step;
      }
      marker.dataset.x = String(x);
      marker.dataset.y = String(y);
      marker.style.left = `${x}%`;
      marker.style.top = `${y}%`;
    }
  }, 40);
  function publish(min, text, kind = '') {
    document.querySelector('#sim-clock').textContent = fmt(min);
    const live = document.querySelector('#live-event');
    live.textContent = text;
    live.classList.remove('sim-event-flash');
    void live.offsetWidth;
    live.classList.add('sim-event-flash');
    const item = document.createElement('li');
    if (kind) item.className = kind;
    item.innerHTML = `<time>${fmt(min)}</time><span>${text}</span>`;
    feed.prepend(item);
  }
  function renderMatchState() {
    for (const side of ['blue', 'red']) {
      const state = matchState[side];
      const label = side === 'blue' ? 'blue-economy' : 'red-economy';
      const output = document.querySelector(`#${label}`);
      if (output)
        output.textContent = `${(state.gold / 1000).toFixed(1)}k ouro · Nv. ${state.level} · ${state.towers} torres · ${state.dragons} dragões · ${state.barons} Barões`;
    }
    for (const { side, lane, index, marker } of towerMarkers) {
      const health = matchState.towerHealth[side][lane][index];
      marker.classList.toggle('destroyed', health <= 0);
      marker.title = health <= 0 ? 'Torre destruída' : `Torre: ${health}% de vida`;
    }
  }
  function tickEconomy(minute) {
    for (const side of ['blue', 'red']) {
      const state = matchState[side];
      state.gold += 800 + (minute % 2 === 0 ? 300 : 0);
      state.level = Math.min(18, 1 + Math.floor(minute / 2.4));
    }
    const waveNumber = Math.floor(minute / 1.5);
    if (waveNumber > matchState.waveNumber) {
      matchState.waveNumber = waveNumber;
      for (const { side, lane, marker } of minionMarkers) {
        const progress = Math.min(0.9, 0.08 + waveNumber * 0.022);
        const [x, y] = routePoint(lanePaths[side][lane], progress);
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        const opposing = side === 'blue' ? 'red' : 'blue';
        const pushAdvantage = side === 'blue' ? blueChance >= 50 : blueChance < 50;
        const pressure = pushAdvantage ? 16 : 10;
        const towerIndex = matchState.towerHealth[opposing][lane].findIndex(
          (hp) => hp > 0,
        );
        if (towerIndex >= 0) {
          const health = matchState.towerHealth[opposing][lane];
          const before = health[towerIndex];
          health[towerIndex] = Math.max(0, before - pressure);
          if (before > 0 && health[towerIndex] === 0) {
            matchState[side].gold += 250;
            matchState[opposing].towers--;
            publish(
              minute,
              `${side === 'blue' ? 'A onda azul' : 'A onda vermelha'} abriu espaço na rota ${lane}: a equipe ${side === 'blue' ? 'azul' : 'vermelha'} derrubou uma torre.`,
              'objective-event',
            );
          }
        }
      }
    }
    renderMatchState();
  }
  let mapMode = 'lane',
    pushSide = 'blue',
    fightLane = 'Meio',
    retreatSide = null;
  function moveLaneSide(side, progress, minute) {
    for (const lane of ['Topo', 'Meio', 'Atirador']) {
      const p = routePoint(lanePaths[side][lane], progress);
      move(side, lane, p[0], p[1]);
    }
    const adc = routePoint(lanePaths[side].Atirador, progress);
    move(
      side,
      'Suporte',
      adc[0] + (side === 'blue' ? -5 : 5),
      adc[1] + (side === 'blue' ? 4 : -4),
    );
    const jungle =
        side === 'blue'
          ? [
              [29, 57],
              [39, 48],
              [49, 57],
              [42, 67],
              [57, 47],
              [50, 50],
            ]
          : [
              [72, 42],
              [61, 51],
              [51, 42],
              [58, 33],
              [43, 53],
              [50, 50],
            ],
      ji = Math.floor(minute / 2) % jungle.length,
      jp = jungle[ji];
    move(
      side,
      'Selva',
      jp[0] + Math.sin(minute * 0.7) * 1.4,
      jp[1] + Math.cos(minute * 0.6) * 1.4,
    );
    if (retreatSide === side && minute < 15) {
      const retreatPoint = routePoint(
        lanePaths[side].Meio,
        Math.max(0, progress - 0.18),
      );
      move(side, 'Meio', retreatPoint[0], retreatPoint[1]);
      const marker = units.get(`unit-${side}-Meio`);
      if (marker) marker.dataset.state = 'retreat';
    } else {
      const marker = units.get(`unit-${side}-Meio`);
      if (marker) marker.dataset.state = 'lane';
    }
  }
  function tickMap(minute) {
    const progress = Math.max(0, Math.min((minute - 1) / 36, 0.72));
    if (mapMode === 'lane') {
      for (const side of ['blue', 'red']) moveLaneSide(side, progress, minute);
    } else if (mapMode === 'gank') {
      for (const side of ['blue', 'red']) moveLaneSide(side, progress, minute);
      if (gankSide && gankLane) {
        const p = routePoint(lanePaths[gankSide][gankLane], progress);
        move(gankSide, 'Selva', p[0] + (gankSide === 'blue' ? 2 : -2), p[1]);
      }
    } else if (
      ['dragon', 'herald', 'baron', 'soloDragon', 'soloBaron'].includes(mapMode)
    ) {
      const kind = mapMode.toLowerCase().includes('dragon') ? 'dragon' : 'baron',
        solo = mapMode.startsWith('solo'),
        owner = kind === 'dragon' ? dragonOwner : baronOwner,
        pit = kind === 'dragon' ? [66, 64] : [42, 36],
        lanes =
          kind === 'dragon'
            ? ['Selva', 'Meio', 'Atirador', 'Suporte']
            : ['Topo', 'Selva', 'Meio', 'Suporte'],
        slots = [
          [-7, 1],
          [-3, -5],
          [2, 5],
          [6, 0],
        ];
      for (const side of ['blue', 'red']) {
        if (solo && side !== owner) {
          moveLaneSide(side, progress, minute);
          continue;
        }
        lanes.forEach((lane, i) => {
          const d = side === 'blue' ? -1 : 1;
          move(
            side,
            lane,
            pit[0] + d * (8 + slots[i][0]) + Math.sin(minute + i) * 0.5,
            pit[1] + slots[i][1] + Math.cos(minute + i) * 0.5,
          );
        });
      }
    } else if (mapMode === 'fight') {
      for (const side of ['blue', 'red']) moveLaneSide(side, progress, minute);
      const blue = routePoint(lanePaths.blue[fightLane], progress),
        red = routePoint(lanePaths.red[fightLane], progress),
        dx = red[0] - blue[0],
        dy = red[1] - blue[1],
        distance = Math.hypot(dx, dy);
      if (distance < 22) {
        const center = [(blue[0] + red[0]) / 2, (blue[1] + red[1]) / 2],
          perpendicular = [
            -dy / Math.max(distance, 0.01),
            dx / Math.max(distance, 0.01),
          ];
        for (const side of ['blue', 'red']) {
          if (retreatSide === side && minute < 15) continue;
          const direction = side === 'blue' ? -1 : 1,
            mark = units.get(`unit-${side}-${fightLane}`);
          if (mark) mark.dataset.state = 'attacking';
          move(
            side,
            fightLane,
            center[0] + perpendicular[0] * direction * 1.7,
            center[1] + perpendicular[1] * direction * 1.7,
          );
        }
      }
      if (gankSide) {
        const target = gankSide === 'blue' ? blue : red;
        move(gankSide, 'Selva', target[0], target[1]);
      }
    } else if (mapMode === 'push') {
      const spread = Math.min(1, 0.72 + (minute - 27) * 0.09);
      for (const side of ['blue', 'red']) {
        const advancing = side === pushSide,
          t = Math.max(
            0.18,
            Math.min(0.93, advancing ? spread : 0.72 - (minute - 27) * 0.12),
          );
        for (const lane of ['Topo', 'Meio', 'Atirador']) {
          const p = routePoint(lanePaths[side][lane], t);
          move(side, lane, p[0], p[1]);
        }
        const adc = routePoint(lanePaths[side].Atirador, t);
        move(
          side,
          'Suporte',
          adc[0] + (side === 'blue' ? -3 : 3),
          adc[1] + (side === 'blue' ? 3 : -3),
        );
        const mid = routePoint(lanePaths[side].Meio, t);
        move(side, 'Selva', mid[0] + (side === 'blue' ? -4 : 4), mid[1] + 4);
      }
    }
  }
  const dragonType = ['Infernal', 'Montanha', 'Oceano', 'Nuvens'][
    Math.floor(Math.random() * 4)
  ];
  let dragonMode = 'contest',
    dragonOwner = null,
    baronMode = 'contest',
    baronOwner = null,
    gankSide = null,
    gankLane = null;
  const events = {
    3: () => {
      const side = Math.random() < blueChance / 100 ? 'blue' : 'red',
        lane = ['Topo', 'Meio', 'Atirador'][Math.floor(Math.random() * 3)],
        name = teamsData[side].Selva.name,
        p = routePoint(
          lanePaths[side][lane],
          Math.max(0, Math.min((3 - 1) / 36, 0.72)),
        );
      gankSide = side;
      gankLane = lane;
      mapMode = 'gank';
      move(side, 'Selva', p[0] + (side === 'blue' ? 2 : -2), p[1]);
      if (side === 'blue') blueKills++;
      else redKills++;
      matchState[side].gold += 300;
      renderMatchState();
      document.querySelector('#blue-kills').textContent = `${blueKills} abates`;
      document.querySelector('#red-kills').textContent = `${redKills} abates`;
      publish(3, `${name} aparece na rota ${lane} e garante o primeiro abate!`);
    },
    5: () => {
      const r = Math.random();
      dragonMode = r < 0.36 ? 'blueSolo' : r < 0.72 ? 'redSolo' : 'contest';
      dragonOwner =
        dragonMode === 'blueSolo' ? 'blue' : dragonMode === 'redSolo' ? 'red' : null;
      mapMode = dragonMode === 'contest' ? 'dragon' : 'soloDragon';
      document.querySelector('#dragon-pin').classList.add('visible');
      objectiveMove('dragon', dragonOwner);
      publish(
        5,
        dragonMode === 'contest'
          ? 'O Dragão surgiu e os dois times se aproximam para disputar visão.'
          : (dragonOwner === 'blue' ? 'Sua equipe azul' : 'O adversário vermelho') +
              ' iniciou o Dragão sem contestação.',
        'objective-event',
      );
    },
    7: () => {
      let owner =
        dragonMode === 'contest'
          ? Math.random() < blueChance / 100
            ? 'blue'
            : 'red'
          : dragonOwner;
      const stolen = dragonMode === 'contest' && Math.random() < 0.12;
      if (stolen) owner = owner === 'blue' ? 'red' : 'blue';
      const teamName = owner === 'blue' ? 'Sua equipe azul' : 'O adversário vermelho';
      document.querySelector('#dragon-pin').classList.add('done');
      document.querySelector('#dragon-pin').textContent =
        owner === 'blue' ? 'AZUL' : 'VERMELHO';
      matchState[owner].dragons++;
      matchState[owner].gold += 250;
      renderMatchState();
      publish(
        7,
        dragonMode === 'contest'
          ? stolen
            ? `${teamName} roubou o Dragão ${dragonType}!`
            : `${teamName} venceu a disputa e fez o Dragão ${dragonType}.`
          : `${teamName} fez o Dragão ${dragonType} sem luta; o outro lado continuou avançando nas rotas.`,
        'objective-event',
      );
    },
    11: () => {
      mapMode = 'lane';
      publish(11, 'Depois do objetivo, os campeões voltam a avançar pelas rotas.');
    },
    12: () => {
      mapMode = 'fight';
      fightLane = 'Meio';
      const winnerSide = Math.random() < blueChance / 100 ? 'blue' : 'red';
      retreatSide = winnerSide === 'blue' ? 'red' : 'blue';
      gankSide = winnerSide;
      if (winnerSide === 'blue') blueKills++;
      else redKills++;
      matchState[winnerSide].gold += 300;
      renderMatchState();
      document.querySelector('#blue-kills').textContent = `${blueKills} abates`;
      document.querySelector('#red-kills').textContent = `${redKills} abates`;
      publish(
        12,
        `As equipes se encontram no Meio; ${winnerSide === 'blue' ? 'sua equipe' : 'o adversário'} vence a troca, e o campeão ferido recua pela rota.`,
      );
    },
    15: () => {
      mapMode = 'lane';
      retreatSide = null;
      for (const side of ['blue', 'red']) {
        const marker = units.get(`unit-${side}-Meio`);
        if (marker) marker.dataset.state = 'lane';
      }
      publish(15, 'Com a vida recuperada, o campeão retorna gradualmente para o Meio.');
    },
    14: () =>
      publish(
        14,
        'As ondas chegam às estruturas: torres perdem vida apenas quando os minions alcançam a rota.',
      ),
    17: () => {
      mapMode = 'herald';
      document.querySelector('#baron-pin').classList.add('visible');
      objectiveMove('baron');
      publish(
        17,
        'O Arauto é disputado na parte superior do rio. Os times se aproximam.',
        'objective-event',
      );
    },
    18: () => {
      mapMode = 'lane';
      const side = Math.random() < blueChance / 100 ? 'blue' : 'red',
        name = side === 'blue' ? 'Sua equipe azul' : 'O adversário vermelho';
      document.querySelector('#baron-pin').classList.add('done');
      document.querySelector('#baron-pin').textContent =
        side === 'blue' ? 'AZUL' : 'VERMELHO';
      publish(
        18,
        `${name} conquistou o Arauto e abriu espaço para avançar.`,
        'objective-event',
      );
    },
    20: () => {
      const r = Math.random();
      baronMode = r < 0.36 ? 'blueSolo' : r < 0.72 ? 'redSolo' : 'contest';
      baronOwner =
        baronMode === 'blueSolo' ? 'blue' : baronMode === 'redSolo' ? 'red' : null;
      mapMode = baronMode === 'contest' ? 'baron' : 'soloBaron';
      const pin = document.querySelector('#baron-pin');
      pin.textContent = 'BARÃO';
      pin.classList.remove('done');
      pin.classList.add('visible');
      objectiveMove('baron', baronOwner);
      publish(
        20,
        baronMode === 'contest'
          ? 'Barão Nashor surgiu; as equipes decidem se disputam o rio superior.'
          : (baronOwner === 'blue' ? 'Sua equipe azul' : 'O adversário vermelho') +
              ' começou o Barão sem contestação.',
        'objective-event',
      );
    },
    22: () => {
      if (baronMode === 'contest') {
        mapMode = 'baron';
        objectiveMove('baron');
        publish(
          22,
          'Os dois times se aproximam do covil para contestar o Barão.',
          'objective-event',
        );
      }
    },
    23: () => {
      let side =
        baronMode === 'contest'
          ? Math.random() < blueChance / 100
            ? 'blue'
            : 'red'
          : baronOwner;
      const stolen = baronMode === 'contest' && Math.random() < 0.1;
      if (stolen) side = side === 'blue' ? 'red' : 'blue';
      matchState[side].barons++;
      matchState[side].gold += 300;
      renderMatchState();
      const name = side === 'blue' ? 'Sua equipe azul' : 'O adversário vermelho',
        pin = document.querySelector('#baron-pin');
      pin.classList.add('done');
      pin.textContent = side === 'blue' ? 'AZUL' : 'VERMELHO';
      publish(
        23,
        baronMode === 'contest'
          ? stolen
            ? `${name} roubou o Barão no último instante!`
            : `${name} conquistou o Barão após a disputa.`
          : `${name} fez o Barão sem luta; o adversário troca por pressão nas rotas.`,
        'objective-event',
      );
      mapMode = 'lane';
    },
    24: () => {
      publish(
        24,
        'Com o fortalecimento do Barão, os jogadores se espalham para pressionar as rotas e abrir caminho até a base.',
      );
    },
    27: () => {
      mapMode = 'push';
      const side =
        matchState.blue.towers > matchState.red.towers
          ? 'blue'
          : matchState.red.towers > matchState.blue.towers
            ? 'red'
            : blueKills > redKills ||
                (blueKills === redKills && matchState.blue.gold >= matchState.red.gold)
              ? 'blue'
              : 'red';
      pushSide = side;
      publish(
        27,
        side === 'blue'
          ? 'Sua equipe azul agrupa e avança em direção à base inimiga.'
          : 'O adversário vermelho agrupa e avança em direção à base inimiga.',
      );
    },
    30: () => {
      const blueWon =
          matchState.blue.towers > matchState.red.towers ||
          (matchState.blue.towers === matchState.red.towers &&
            (blueKills > redKills ||
              (blueKills === redKills && matchState.blue.gold >= matchState.red.gold))),
        winner = blueWon ? 'Sua equipe azul' : 'O adversário vermelho';
      pushSide = blueWon ? 'blue' : 'red';
      mapMode = 'push';
      tickMap(30);
      document.querySelector('#sim-finish').innerHTML =
        `<div class="sim-finish">${winner} venceu a partida!<small>Partida simulada em 30 minutos · desfecho definido pelo modelo e por sorte.</small></div>`;
      publish(30, `Fim de jogo: ${winner} destruiu o Nexus!`, 'result-event');
      button.disabled = false;
      button.textContent = 'Simular novamente';
      clearInterval(simulationInterval);
      simulationInterval = null;
      const finishedMotion = simulationMotionInterval;
      setTimeout(() => {
        if (simulationMotionInterval === finishedMotion) {
          clearInterval(simulationMotionInterval);
          simulationMotionInterval = null;
        }
      }, 2600);
    },
  };
  let minute = 0;
  publish(0, 'Os dez campeões chegam ao Rift e ocupam suas rotas.');
  renderMatchState();
  simulationInterval = setInterval(() => {
    minute++;
    tickMap(minute);
    tickEconomy(minute);
    document.querySelector('#sim-clock').textContent = fmt(minute);
    if (events[minute]) events[minute]();
    else if (minute % 4 === 0 && minute < 29)
      document.querySelector('#live-event').textContent =
        `Minuto ${minute}: ondas avançam; ouro e experiência acumulados conforme o tempo de jogo.`;
    if (minute >= 30 && !events[30]) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
  }, 1350);
}
let toastTimer;
function notify(t) {
  const e = document.querySelector('#toast');
  e.textContent = t;
  e.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove('show'), 1800);
}
search.addEventListener('input', renderGrid);
document.querySelector('#sort').addEventListener('change', renderGrid);
document.querySelector('#class-filter').addEventListener('change', renderGrid);
document.querySelector('#difficulty-filter').addEventListener('change', renderGrid);
document.querySelector('#clear').onclick = () => {
  teams = { ally: {}, enemy: {} };
  resetEditingComposition();
  renderTeam();
};
document
  .querySelector('#save-local-composition')
  .addEventListener('click', saveLocalComposition);
document.querySelector('#add-ally').onclick = () => addToTeam('ally');
document.querySelector('#add-enemy').onclick = () => addToTeam('enemy');
document
  .querySelector('#position-select')
  .addEventListener('change', updateChampionMatchupLink);
document.querySelector('#simulate').onclick = simulateMatch;
document.querySelector('#picker-search').addEventListener('input', renderPickerResults);
document.querySelectorAll('.nav [data-view]').forEach((link) =>
  link.addEventListener('click', () => {
    document
      .querySelectorAll('.nav [data-view]')
      .forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
  }),
);
renderRoles();
loadChampions();
renderTeam();
renderCompositionHistory();

const API_BASE_URL = (
  window.RIFTLAB_API_URL ||
  (['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:3000'
    : '')
).replace(/\/$/, '');
const saveCompositionButton = document.querySelector('#save-composition');
const saveStatus = document.querySelector('#save-status');
function setSaveStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.style.color = isError ? '#ffaaa2' : '';
}
async function saveComposition() {
  if (!API_BASE_URL) {
    setSaveStatus('Configure a URL da API em config.js antes de salvar.', true);
    return;
  }
  const ally = Object.fromEntries(
    laneKeys.map((lane) => [lane, teams.ally[lane]?.id || null]),
  );
  const enemy = Object.fromEntries(
    laneKeys.map((lane) => [lane, teams.enemy[lane]?.id || null]),
  );
  if (!Object.values(ally).some(Boolean) && !Object.values(enemy).some(Boolean)) {
    setSaveStatus('Adicione ao menos um campeão antes de salvar.', true);
    return;
  }
  saveCompositionButton.disabled = true;
  setSaveStatus('Salvando a composição...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/compositions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ally, enemy }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
    const shareUrl = new URL(location.href);
    shareUrl.searchParams.set('c', result.code);
    try {
      await navigator.clipboard.writeText(shareUrl.href);
      setSaveStatus(`Link copiado: ${shareUrl.href}`);
    } catch {
      setSaveStatus(`Composição salva. Copie este link: ${shareUrl.href}`);
    }
  } catch (error) {
    setSaveStatus(error.message || 'Erro ao salvar composição.', true);
  } finally {
    saveCompositionButton.disabled = false;
  }
}
async function loadSharedComposition() {
  const code = new URLSearchParams(location.search).get('c');
  if (!code) return;
  if (!API_BASE_URL) {
    setSaveStatus('Este link usa a API: configure a URL em config.js.', true);
    return;
  }
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/compositions/${encodeURIComponent(code)}`,
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Composição não encontrada.');
    const mapTeam = (stored) =>
      Object.fromEntries(
        laneKeys
          .map((lane) => {
            const id = stored?.[lane];
            return [lane, id ? champions.find((champion) => champion.id === id) : null];
          })
          .filter(([, champion]) => champion),
      );
    teams = { ally: mapTeam(result.ally), enemy: mapTeam(result.enemy) };
    resetEditingComposition();
    renderTeam();
    setSaveStatus(`Composição compartilhada carregada · código ${result.code}.`);
  } catch (error) {
    setSaveStatus(error.message || 'Não foi possível carregar a composição.', true);
  }
}

function loadDraftComparison() {
  if (new URLSearchParams(location.search).get('from') !== 'draft') return;
  try {
    const saved = JSON.parse(
      localStorage.getItem('riftlab:draft-comparison') || 'null',
    );
    if (!saved || typeof saved !== 'object') return;
    const toTeam = (picks) =>
      Object.fromEntries(
        laneKeys
          .map((lane) => {
            const pick = picks?.[lane];
            const id = typeof pick === 'string' ? pick : pick?.id;
            return [lane, champions.find((champion) => champion.id === id) || null];
          })
          .filter(([, champion]) => champion),
      );
    teams = { ally: toTeam(saved.blue), enemy: toTeam(saved.red) };
    resetEditingComposition();
    setSaveStatus('Draft carregado. Revise ou ajuste as equipes antes de analisar.');
    localStorage.removeItem('riftlab:draft-comparison');
  } catch {
    setSaveStatus('Não foi possível importar as equipes do draft.', true);
  }
}
saveCompositionButton.addEventListener('click', saveComposition);
