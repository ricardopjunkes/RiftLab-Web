const TOTAL_ATTEMPTS = 5;
const quizState = {
  champions: [],
  championDetails: new Map(),
  patchVersion: '',
  challenge: null,
  attemptsRemaining: TOTAL_ATTEMPTS,
  guesses: new Set(),
  selectedChampionId: null,
  previousChampionId: null,
  finished: false,
};

const quizCard = document.querySelector('#quiz-card');
const quizImage = document.querySelector('#quiz-skill');
const quizInput = document.querySelector('#quiz-answer');
const quizSubmit = document.querySelector('#quiz-submit');
const quizNext = document.querySelector('#quiz-next');
const quizSuggestions = document.querySelector('#quiz-suggestions');
const quizMessage = document.querySelector('#quiz-message');

function normalizeChampionName(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function getChampionDetail(id) {
  if (!quizState.championDetails.has(id)) {
    const request = fetch(
      `https://ddragon.leagueoflegends.com/cdn/${quizState.patchVersion}/data/pt_BR/champion/${id}.json`,
    )
      .then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar campeão.');
        return response.json();
      })
      .then((result) => result.data[id])
      .catch((error) => {
        quizState.championDetails.delete(id);
        throw error;
      });
    quizState.championDetails.set(id, request);
  }
  return quizState.championDetails.get(id);
}

function updateAttempts() {
  document.querySelector('#quiz-attempts').textContent =
    `${quizState.attemptsRemaining}/${TOTAL_ATTEMPTS} tentativas`;
}

function setRevealLevel(level) {
  quizImage.dataset.level = String(level);
  const progress = document.querySelector('#quiz-progress-fill');
  progress.style.width = `${(level / TOTAL_ATTEMPTS) * 100}%`;
  progress.setAttribute('aria-valuenow', String(level));
  document.querySelector('#quiz-reveal').textContent =
    level === TOTAL_ATTEMPTS
      ? 'Imagem completamente revelada'
      : `Imagem oculta · ${level} de ${TOTAL_ATTEMPTS} pistas reveladas`;
  const initialRotation = Number.parseFloat(
    quizImage.style.getPropertyValue('--quiz-rotation'),
  );
  const rotationRecovery = Math.max(0, 1 - level / TOTAL_ATTEMPTS);
  quizImage.style.setProperty(
    '--quiz-current-rotation',
    `${initialRotation * rotationRecovery}deg`,
  );
  quizImage.style.setProperty(
    '--quiz-mirror',
    level >= 4 ? '1' : quizImage.dataset.mirror,
  );
}

function finishChallenge(won) {
  quizState.finished = true;
  setRevealLevel(TOTAL_ATTEMPTS);
  quizImage.style.setProperty('--quiz-current-rotation', '0deg');
  quizImage.style.setProperty('--quiz-mirror', '1');
  quizImage.alt = `Ícone original da habilidade ${quizState.challenge.spell.name} de ${quizState.challenge.champion.name}`;
  document.querySelector('#quiz-skill-label').textContent =
    `${quizState.challenge.spell.name} · ${['Q', 'W', 'E', 'R'][quizState.challenge.spellIndex] || 'Habilidade'}`;
  document.querySelector('#quiz-result-name').textContent =
    quizState.challenge.champion.name;
  quizMessage.textContent = won
    ? 'Você acertou! Resposta correta.'
    : 'As tentativas acabaram!';
  quizMessage.classList.toggle('is-correct', won);
  quizCard.classList.toggle('is-success', won);
  quizCard.classList.toggle('is-failure', !won);
  quizInput.classList.toggle('is-correct', won);
  quizInput.disabled = true;
  quizSubmit.disabled = true;
  quizNext.hidden = false;
  quizSuggestions.hidden = true;
}

function renderSuggestions() {
  const query = normalizeChampionName(quizInput.value);
  quizState.selectedChampionId = null;
  if (!query || quizState.finished) {
    quizSuggestions.replaceChildren();
    quizSuggestions.hidden = true;
    return;
  }
  const matches = quizState.champions
    .filter((champion) => normalizeChampionName(champion.name).includes(query))
    .slice(0, 8);
  quizSuggestions.innerHTML = matches
    .map(
      (champion) =>
        `<button type="button" role="option" data-quiz-id="${champion.id}"><img src="https://ddragon.leagueoflegends.com/cdn/${quizState.patchVersion}/img/champion/${champion.image.full}" alt=""><span>${champion.name}</span></button>`,
    )
    .join('');
  quizSuggestions.hidden = !matches.length;
  quizSuggestions.querySelectorAll('[data-quiz-id]').forEach((button) => {
    button.onclick = () => {
      const champion = quizState.champions.find(
        (item) => item.id === button.dataset.quizId,
      );
      if (!champion) return;
      quizInput.value = champion.name;
      quizState.selectedChampionId = champion.id;
      quizSuggestions.replaceChildren();
      quizSuggestions.hidden = true;
      quizInput.focus();
    };
  });
}

async function startNextChallenge() {
  quizNext.textContent = 'Próximo desafio';
  quizNext.hidden = true;
  quizNext.disabled = true;
  quizSubmit.disabled = true;
  quizMessage.classList.remove('is-correct');
  quizMessage.textContent = 'Preparando uma habilidade oficial...';
  try {
    const pool = quizState.champions.filter(
      (champion) => champion.id !== quizState.previousChampionId,
    );
    const champion =
      pool[Math.floor(Math.random() * pool.length)] || quizState.champions[0];
    const detail = await getChampionDetail(champion.id);
    const spells = detail.spells.filter((spell) => spell.image?.full);
    if (!spells.length) throw new Error('Nenhuma habilidade encontrada.');
    const spell = spells[Math.floor(Math.random() * spells.length)];
    quizState.challenge = {
      champion,
      spell,
      spellIndex: detail.spells.indexOf(spell),
    };
    quizState.previousChampionId = champion.id;
    quizState.attemptsRemaining = TOTAL_ATTEMPTS;
    quizState.guesses.clear();
    quizState.selectedChampionId = null;
    quizState.finished = false;
    quizCard.classList.remove('is-success', 'is-failure');
    quizInput.classList.remove('is-correct');
    quizInput.disabled = false;
    quizInput.value = '';
    quizSuggestions.replaceChildren();
    quizSuggestions.hidden = true;
    document.querySelector('#quiz-guesses').replaceChildren();
    document.querySelector('#quiz-result-name').textContent = '';
    document.querySelector('#quiz-skill-label').textContent = 'Habilidade misteriosa';
    quizImage.src = `https://ddragon.leagueoflegends.com/cdn/${quizState.patchVersion}/img/spell/${spell.image.full}`;
    quizImage.alt = 'Ícone distorcido de uma habilidade';
    const rotations = [-180, -90, 90, 180];
    const rotation = rotations[Math.floor(Math.random() * rotations.length)];
    quizImage.style.setProperty('--quiz-rotation', `${rotation}deg`);
    quizImage.style.setProperty('--quiz-current-rotation', `${rotation}deg`);
    quizState.mirror = Math.random() < 0.5 ? -1 : 1;
    quizImage.dataset.mirror = String(quizState.mirror);
    quizImage.style.setProperty('--quiz-mirror', String(quizState.mirror));
    setRevealLevel(0);
    updateAttempts();
    quizMessage.textContent = 'Digite um nome ou escolha uma sugestão.';
    quizMessage.classList.remove('is-correct');
    quizSubmit.disabled = false;
  } catch (error) {
    quizMessage.textContent = 'Não foi possível carregar o desafio. Tente novamente.';
    quizNext.textContent = 'Tentar novamente';
    quizNext.hidden = false;
  } finally {
    quizNext.disabled = false;
  }
}

function submitAnswer() {
  if (!quizState.challenge || quizState.finished) return;
  const value = quizInput.value.trim();
  const normalized = normalizeChampionName(value);
  const guess =
    quizState.champions.find(
      (champion) => champion.id === quizState.selectedChampionId,
    ) ||
    quizState.champions.find(
      (champion) => normalizeChampionName(champion.name) === normalized,
    );
  if (!value || !guess) {
    quizMessage.textContent = 'Escolha um campeão válido na lista de sugestões.';
    return;
  }
  if (quizState.guesses.has(guess.id)) {
    quizMessage.textContent = `${guess.name} já foi tentado. Escolha outro campeão.`;
    return;
  }
  quizState.guesses.add(guess.id);
  const chip = document.createElement('span');
  chip.textContent = guess.name;
  document.querySelector('#quiz-guesses').append(chip);
  quizSuggestions.replaceChildren();
  quizSuggestions.hidden = true;
  quizInput.value = '';
  quizState.selectedChampionId = null;
  if (guess.id === quizState.challenge.champion.id) {
    finishChallenge(true);
    return;
  }
  quizState.attemptsRemaining--;
  updateAttempts();
  setRevealLevel(TOTAL_ATTEMPTS - quizState.attemptsRemaining);
  if (quizState.attemptsRemaining === 0) {
    finishChallenge(false);
    return;
  }
  quizMessage.textContent = `Ainda não. Restam ${quizState.attemptsRemaining}/5 tentativas.`;
}

async function loadQuizData() {
  try {
    const versions = await fetch(
      'https://ddragon.leagueoflegends.com/api/versions.json',
    ).then((response) => {
      if (!response.ok) throw new Error('Falha ao carregar patch.');
      return response.json();
    });
    quizState.patchVersion = versions[0];
    const catalog = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${quizState.patchVersion}/data/pt_BR/champion.json`,
    ).then((response) => {
      if (!response.ok) throw new Error('Falha ao carregar catálogo.');
      return response.json();
    });
    quizState.champions = Object.values(catalog.data).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    document.querySelector('.patch').innerHTML =
      `<i></i>Dados oficiais · patch ${quizState.patchVersion}`;
    await startNextChallenge();
  } catch (error) {
    document.querySelector('.patch').innerHTML =
      '<i></i>Não foi possível carregar os dados';
    quizMessage.textContent =
      'Confira sua conexão e tente carregar o desafio novamente.';
    quizNext.hidden = false;
  }
}

quizInput.addEventListener('input', renderSuggestions);
quizInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitAnswer();
  }
});
quizSubmit.addEventListener('click', submitAnswer);
quizNext.addEventListener('click', startNextChallenge);

loadQuizData();
