const DRAFT_LANES = ['Topo', 'Selva', 'Meio', 'Atirador', 'Suporte'];
const DRAFT_ORDER = [
  ...['blue', 'red', 'blue', 'red', 'blue', 'red'].map((side) => ({
    side,
    kind: 'ban',
    round: 1,
  })),
  ...['blue', 'red', 'red', 'blue', 'blue', 'red'].map((side) => ({
    side,
    kind: 'pick',
    round: 1,
  })),
  ...['red', 'blue', 'red', 'blue'].map((side) => ({
    side,
    kind: 'ban',
    round: 2,
  })),
  ...['red', 'blue', 'blue', 'red'].map((side) => ({
    side,
    kind: 'pick',
    round: 2,
  })),
];
const draftState = {
  step: 0,
  picks: { blue: {}, red: {} },
  bans: [],
  analysisRendered: false,
};
let draftChampionsReady = false;

function draftCurrentTurn() {
  return DRAFT_ORDER[draftState.step] || null;
}

function draftUsedIds() {
  return new Set([
    ...draftState.bans.map((ban) => ban.champion.id),
    ...Object.values(draftState.picks).flatMap((team) =>
      Object.values(team).map((champion) => champion.id),
    ),
  ]);
}

function renderDraftLineup(side) {
  const target = document.querySelector(
    side === 'blue' ? '#draft-blue-lineup' : '#draft-red-lineup',
  );
  target.innerHTML = DRAFT_LANES.map((lane) => {
    const champion = draftState.picks[side][lane];
    return `<div class="draft-slot"><span>${lane}</span>${champion ? `<img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${champion.image.full}" alt=""><strong>${champion.name}</strong>` : '<small>Aguardando escolha</small>'}</div>`;
  }).join('');
}

function renderDraftBans() {
  const target = document.querySelector('#draft-bans');
  target.innerHTML = draftState.bans.length
    ? draftState.bans
        .map(
          ({ champion, side }) =>
            `<span class="draft-ban ${side}"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${champion.image.full}" alt=""><span>${champion.name}</span></span>`,
        )
        .join('')
    : '<p class="note">Nenhum campeão banido ainda.</p>';
}

function setDraftPositionOptions(turn) {
  const select = document.querySelector('#draft-position');
  const used = Object.keys(draftState.picks[turn.side]);
  const available = DRAFT_LANES.filter((lane) => !used.includes(lane));
  const previous = select.value;
  select.innerHTML = available
    .map((lane) => `<option value="${lane}">${lane}</option>`)
    .join('');
  if (available.includes(previous)) select.value = previous;
}

function draftSuggestionScore(champion, lane, side) {
  const team = Object.values(draftState.picks[side]);
  const enemy = Object.values(draftState.picks[side === 'blue' ? 'red' : 'blue']);
  let score = 0;
  const physical = team.filter((pick) => pick.info.attack >= pick.info.magic).length;
  const magical = team.length - physical;
  if (champion.info.attack >= champion.info.magic && physical > magical) score += 3;
  if (champion.info.magic > champion.info.attack && magical > physical) score += 3;
  const frontliners = team.filter((pick) =>
    pick.tags.some((tag) => ['Tank', 'Fighter'].includes(tag)),
  ).length;
  if (frontliners < 2 && champion.tags.some((tag) => ['Tank', 'Fighter'].includes(tag)))
    score += 2;
  if (
    !team.some((pick) => pick.tags.includes('Support')) &&
    champion.tags.includes('Support')
  )
    score += 1;
  if (
    !team.some((pick) => pick.tags.includes('Mage')) &&
    champion.tags.includes('Mage')
  )
    score += 1;
  if (champion.roles.includes(lane)) score += 5;
  return score;
}

function renderDraftSuggestions(turn) {
  const target = document.querySelector('#draft-suggestions');
  const note = document.querySelector('#draft-suggestions-note');
  if (!turn || turn.kind !== 'pick') {
    target.replaceChildren();
    note.textContent = turn
      ? 'Sugestões aparecem nos turnos de escolha.'
      : 'O draft terminou. Veja a análise das equipes abaixo.';
    return;
  }
  const lane = document.querySelector('#draft-position').value;
  const team = draftState.picks[turn.side];
  const enemySide = turn.side === 'blue' ? 'red' : 'blue';
  const enemyClasses = [
    ...new Set(
      Object.values(draftState.picks[enemySide]).flatMap((champion) => champion.tags),
    ),
  ];
  note.textContent = `Turno da equipe ${turn.side === 'blue' ? 'azul' : 'vermelha'} · rota: ${lane || 'selecione uma rota'} · classes adversárias: ${enemyClasses.length ? enemyClasses.join(', ') : 'ainda não há escolhas'}. A lista prioriza cobertura de rota, classes e diversidade de atributos; não infere counters.`;
  const used = draftUsedIds();
  const candidates = champions
    .filter((champion) => !used.has(champion.id) && champion.roles.includes(lane))
    .sort(
      (a, b) =>
        draftSuggestionScore(b, lane, turn.side) -
          draftSuggestionScore(a, lane, turn.side) ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )
    .slice(0, 4);
  target.innerHTML = candidates
    .map(
      (champion) =>
        `<button type="button" class="draft-suggestion" data-draft-suggestion="${champion.id}"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${champion.image.full}" alt=""><span><strong>${champion.name}</strong><small>${champion.tags.join(' · ')}</small></span><b>＋</b></button>`,
    )
    .join('');
  target.querySelectorAll('[data-draft-suggestion]').forEach((button) => {
    button.addEventListener('click', () =>
      selectDraftChampion(button.dataset.draftSuggestion),
    );
  });
}

async function renderDraftAnalysis() {
  const target = document.querySelector('#draft-analysis');
  target.innerHTML =
    '<p class="note">Analisando as composições com o modelo do Rift Lab…</p>';
  const [blue, red] = await Promise.all([
    analyzeCompositionTeam(draftState.picks.blue),
    analyzeCompositionTeam(draftState.picks.red),
  ]);
  target.innerHTML = `<div class="synergy-scores">${renderTeamAnalysis(draftState.picks.blue, 'ally', blue)}${renderTeamAnalysis(draftState.picks.red, 'enemy', red)}</div><p class="model-note">Estimativas determinísticas baseadas em atributos, tags oficiais e sinais textuais das habilidades do Data Dragon. Não são taxas de vitória nem previsões do resultado.</p>`;
  const analyzeButton = document.createElement('a');
  analyzeButton.className = 'draft-analyze-compositions';
  analyzeButton.href = './composition-comparator.html?from=draft';
  analyzeButton.textContent = 'Analisar composição';
  analyzeButton.addEventListener('click', () => {
    localStorage.setItem(
      'riftlab:draft-comparison',
      JSON.stringify({ blue: draftState.picks.blue, red: draftState.picks.red }),
    );
  });
  target.append(analyzeButton);
}

function renderDraft() {
  renderDraftLineup('blue');
  renderDraftLineup('red');
  renderDraftBans();
  const turn = draftCurrentTurn();
  const action = document.querySelector('#draft-action');
  const positionWrap = document.querySelector('#draft-position-wrap');
  const position = document.querySelector('#draft-position');
  if (!draftChampionsReady) return;
  if (!turn) {
    document.querySelector('#draft-turn').textContent =
      'Draft finalizado · 10/10 escolhas';
    positionWrap.hidden = true;
    position.hidden = true;
    action.disabled = true;
    action.textContent = 'Draft concluído';
    renderDraftSuggestions(null);
    if (!draftState.analysisRendered) {
      draftState.analysisRendered = true;
      renderDraftAnalysis();
    }
    return;
  }
  positionWrap.hidden = turn.kind === 'ban';
  position.hidden = turn.kind === 'ban';
  if (turn.kind === 'pick') setDraftPositionOptions(turn);
  const teamName = turn.side === 'blue' ? 'Azul' : 'Vermelha';
  document.querySelector('#draft-turn').textContent =
    `${teamName} · ${turn.kind === 'ban' ? 'Banimento' : 'Escolha'} ${turn.round === 1 ? '1/2' : '2/2'} · ação ${draftState.step + 1} de 20`;
  action.disabled = false;
  action.textContent =
    turn.kind === 'ban' ? 'Banir campeão' : `Escolher para ${teamName}`;
  renderDraftSuggestions(turn);
}

function openDraftPicker() {
  if (!draftCurrentTurn()) return;
  const turn = draftCurrentTurn();
  document.querySelector('#draft-picker-title').textContent =
    turn.kind === 'ban' ? 'Escolha um campeão para banir' : 'Escolha um campeão';
  const search = document.querySelector('#draft-picker-search');
  search.value = '';
  renderDraftPickerResults();
  document.querySelector('#draft-picker-dialog').showModal();
  search.focus();
}

function renderDraftPickerResults() {
  const query = normalizeChampionName(
    document.querySelector('#draft-picker-search').value,
  );
  const used = draftUsedIds();
  const found = champions
    .filter(
      (champion) =>
        !used.has(champion.id) && normalizeChampionName(champion.name).includes(query),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const target = document.querySelector('#draft-picker-results');
  target.innerHTML = found.length
    ? found
        .map(
          (champion) =>
            `<button type="button" class="picker-option" data-draft-id="${champion.id}"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${champion.image.full}" alt=""><span><strong>${champion.name}</strong><small>${champion.roles.join(' / ')}</small></span></button>`,
        )
        .join('')
    : '<div class="picker-no-results">Nenhum campeão disponível com esse nome.</div>';
  target.querySelectorAll('[data-draft-id]').forEach((button) => {
    button.addEventListener('click', () => selectDraftChampion(button.dataset.draftId));
  });
}

function selectDraftChampion(id) {
  const turn = draftCurrentTurn();
  const champion = champions.find((item) => item.id === id);
  if (!turn || !champion || draftUsedIds().has(champion.id)) return;
  if (turn.kind === 'ban') draftState.bans.push({ champion, side: turn.side });
  else {
    const lane = document.querySelector('#draft-position').value;
    if (!lane || draftState.picks[turn.side][lane]) return;
    draftState.picks[turn.side][lane] = champion;
  }
  draftState.step++;
  draftState.analysisRendered = false;
  document.querySelector('#draft-picker-dialog').close();
  renderDraft();
}

function resetDraft() {
  draftState.step = 0;
  draftState.picks = { blue: {}, red: {} };
  draftState.bans = [];
  draftState.analysisRendered = false;
  document.querySelector('#draft-analysis').innerHTML =
    '<p class="note">Finalize as dez escolhas para ver a análise das duas composições.</p>';
  document.querySelector('#draft-picker-dialog').close();
  renderDraft();
}

function matchupSignals(detail) {
  const texts = [
    detail.passive?.description || '',
    ...detail.spells.map(
      (spell) => `${spell.description || ''} ${spell.tooltip || ''}`,
    ),
  ].map((text) => text.toLowerCase());
  const count = (pattern) => texts.filter((text) => pattern.test(text)).length;
  return {
    mobility: count(
      /dash|blink|avan[cç]|invest|salta|teleporta|pulo|movimento instant/,
    ),
    crowdControl: count(
      /atord|imobil|enraiz|silenc|arremess|derrub|lent|paralis|stun|root|airborne|knock.?up|suppress/,
    ),
    sustain: count(/cura|regenera|roubo de vida|lifesteal|heal|regenerate/),
    area: count(
      /inimigos? pr[oó]ximos|todos os inimigos|em [aá]rea|nearby enemies|all enemies|area of effect/,
    ),
  };
}

function matchupValue(champion, key, signals) {
  return key.startsWith('signal:') ? signals[key.slice(7)] : champion.stats[key] || 0;
}

function renderPhase(title, first, second, firstSignals, secondSignals, metrics) {
  let firstLeads = 0;
  let secondLeads = 0;
  const rows = metrics.map(([key, label, precision = 0]) => {
    const a = matchupValue(first, key, firstSignals);
    const b = matchupValue(second, key, secondSignals);
    if (a > b) firstLeads++;
    else if (b > a) secondLeads++;
    const format = (value) => (precision ? Number(value).toFixed(precision) : value);
    return `<li><span>${label}</span><strong>${format(a)}</strong><span class="phase-vs">vs</span><strong>${format(b)}</strong></li>`;
  });
  const headline =
    firstLeads === secondLeads
      ? 'Sem vantagem clara nos indicadores comparados'
      : `${firstLeads > secondLeads ? first.name : second.name} tem mais valores brutos superiores neste recorte`;
  return `<article class="phase-card"><div class="eyebrow">${title}</div><h3>${headline}</h3><ul>${rows.join('')}</ul><small>${first.name}: ${firstLeads} indicadores · ${second.name}: ${secondLeads} indicadores. Comparação de atributos base e sinais de texto, não resultado de partidas.</small></article>`;
}

function matchupChampionCard(champion, detail, signals, lane) {
  const stats = champion.stats;
  const routeWarning = champion.roles.includes(lane)
    ? ''
    : `<p class="matchup-role-warning">${champion.name} não aparece na rota ${lane} sugerida pelo Rift Lab (${champion.roles.join(', ')}).</p>`;
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
          character
        ],
    );
  const rawStats = [
    ['Alcance', stats.attackrange],
    ['Velocidade de movimento', stats.movespeed],
    ['Ataque base', stats.attackdamage],
    ['Vida base', stats.hp],
    ['Armadura base', stats.armor],
    ['Resistência mágica', stats.spellblock],
  ];
  const higher = rawStats
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])[0];
  const lower = rawStats
    .filter(([, value]) => value > 0)
    .sort((a, b) => a[1] - b[1])[0];
  const abilities = [detail.passive, ...detail.spells]
    .map(
      (spell) =>
        `<li><strong>${escape(spell.name)}</strong> — ${escape(
          spell.description
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 200),
        )}</li>`,
    )
    .join('');
  return `<article class="matchup-champion-card"><img src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(champion.id)}_0.jpg" onerror="this.onerror=null;this.src='https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(patchVersion)}/img/champion/${encodeURIComponent(champion.image.full)}'" alt="Arte de ${escape(champion.name)}"><div class="matchup-champion-copy"><div class="eyebrow">${champion.tags.map(escape).join(' · ')}</div><h3>${escape(champion.name)}</h3><p>${escape(champion.title)}</p>${routeWarning}<div class="matchup-quick-stats"><span>Rotas <b>${champion.roles.map(escape).join(' · ')}</b></span><span>Dificuldade do campeão <b>${champion.info.difficulty}/10</b></span><span>Alcance <b>${stats.attackrange}</b></span><span>Velocidade de movimento <b>${stats.movespeed}</b></span><span>Ataque base <b>${stats.attackdamage}</b></span><span>Magia/ataque <b>${champion.info.magic}/${champion.info.attack}</b></span><span>Vida · armadura · RM <b>${stats.hp} · ${stats.armor} · ${stats.spellblock}</b></span><span>Crescimento/nível: vida · ataque <b>${stats.hpperlevel} · ${stats.attackdamageperlevel}</b></span></div><div class="matchup-signals"><span>Mobilidade: ${signals.mobility} sinais</span><span>CC: ${signals.crowdControl} sinais</span><span>Sustentação: ${signals.sustain} sinais</span><span>Área: ${signals.area} sinais</span></div><p class="matchup-strengths">Maior valor bruto nesta ficha: ${higher ? `${higher[0]} (${higher[1]})` : 'sem dado'} · menor valor listado: ${lower ? `${lower[0]} (${lower[1]})` : 'sem dado'}. São atributos base, não pontos fortes e fracos em um confronto.</p><p class="matchup-difficulty">Dificuldade deste confronto: sem dado confiável disponível. A dificuldade oficial acima descreve aprender o campeão, não vencer este matchup.</p><details><summary>Habilidades consideradas</summary><ul>${abilities}</ul></details></div></article>`;
}

async function compareMatchup() {
  const first = champions.find(
    (champion) => champion.id === document.querySelector('#matchup-champion-a').value,
  );
  const second = champions.find(
    (champion) => champion.id === document.querySelector('#matchup-champion-b').value,
  );
  const lane = document.querySelector('#matchup-lane').value;
  const target = document.querySelector('#matchup-results');
  if (!first || !second || first.id === second.id) {
    target.innerHTML =
      '<p class="note">Selecione dois campeões diferentes para comparar.</p>';
    return;
  }
  const button = document.querySelector('#matchup-compare');
  button.disabled = true;
  button.textContent = 'Carregando habilidades…';
  target.innerHTML =
    '<p class="note">Buscando atributos e habilidades oficiais do patch atual…</p>';
  try {
    const [firstDetail, secondDetail] = await Promise.all([
      getChampionDetail(first.id),
      getChampionDetail(second.id),
    ]);
    const firstSignals = matchupSignals(firstDetail);
    const secondSignals = matchupSignals(secondDetail);
    target.innerHTML = `<div class="matchup-card-grid">${matchupChampionCard(first, firstDetail, firstSignals, lane)}${matchupChampionCard(second, secondDetail, secondSignals, lane)}</div><div class="matchup-phases"><h3>Indicadores por fase</h3><div class="phase-grid">${renderPhase(
      'Início da partida',
      first,
      second,
      firstSignals,
      secondSignals,
      [
        ['attackdamage', 'Ataque base'],
        ['attackspeed', 'Velocidade de ataque', 3],
        ['attackrange', 'Alcance'],
        ['hp', 'Vida base'],
      ],
    )}${renderPhase('Meio da partida', first, second, firstSignals, secondSignals, [
      ['movespeed', 'Velocidade de movimento'],
      ['signal:mobility', 'Sinais de mobilidade'],
      ['signal:crowdControl', 'Sinais de controle de grupo'],
      ['signal:sustain', 'Sinais de sustentação'],
    ])}${renderPhase('Final da partida', first, second, firstSignals, secondSignals, [
      ['attackdamageperlevel', 'Crescimento de ataque/nível', 1],
      ['hpperlevel', 'Crescimento de vida/nível', 1],
      ['armorperlevel', 'Crescimento de armadura/nível', 1],
      ['attackrange', 'Alcance'],
    ])}</div></div><p class="model-note">Leitura estimada: os valores numéricos vêm do Data Dragon; os sinais de kit são contagens simples de termos localizados nas descrições. Não são medições de força por fase. O modelo não dispõe de taxas de matchup, patch balanceado por elo, runas, builds nem execução dos jogadores; por isso, não afirma quem venceria.</p>`;
  } catch {
    target.innerHTML =
      '<p class="note">Não foi possível carregar as habilidades oficiais. Tente novamente.</p>';
  } finally {
    button.disabled = false;
    button.textContent = 'Comparar campeões';
  }
}

function populateMatchupChampions() {
  for (const id of ['matchup-champion-a', 'matchup-champion-b']) {
    const select = document.querySelector(`#${id}`);
    select.innerHTML = '<option value="">Selecione um campeão</option>';
    champions
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .forEach((champion) => {
        const option = document.createElement('option');
        option.value = champion.id;
        option.textContent = champion.name;
        select.append(option);
      });
  }
  document.querySelector('#matchup-compare').disabled = false;
  draftChampionsReady = true;
  renderDraft();
}

document.querySelector('#draft-action').addEventListener('click', openDraftPicker);
document.querySelector('#draft-reset').addEventListener('click', resetDraft);
document.querySelector('#draft-position').addEventListener('change', () => {
  const turn = draftCurrentTurn();
  if (turn) renderDraftSuggestions(turn);
});
document
  .querySelector('#draft-picker-search')
  .addEventListener('input', renderDraftPickerResults);
document
  .querySelector('#draft-picker-close')
  .addEventListener('click', () =>
    document.querySelector('#draft-picker-dialog').close(),
  );
document.querySelector('#matchup-compare').addEventListener('click', compareMatchup);
window.addEventListener('riftlab:champions-ready', populateMatchupChampions);
renderDraft();
if (champions.length) populateMatchupChampions();
