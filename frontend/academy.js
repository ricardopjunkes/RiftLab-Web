const ACADEMY_KEY = 'riftlab-academy-stats-v1';
const academy = { champs: [], patch: '', stats: loadAcademyStats(), locked: false };
function loadAcademyStats() {
  try {
    return {
      points: 0,
      correct: 0,
      streak: 0,
      best: 0,
      ...JSON.parse(localStorage.getItem(ACADEMY_KEY) || '{}'),
    };
  } catch {
    return { points: 0, correct: 0, streak: 0, best: 0 };
  }
}
function renderAcademyStats() {
  for (const [id, value] of [
    ['academy-points', academy.stats.points],
    ['academy-correct', academy.stats.correct],
    ['academy-streak', academy.stats.streak],
  ])
    document.querySelector(`#${id}`).textContent = value;
}
function choose(values) {
  return values[Math.floor(Math.random() * values.length)];
}
async function getCatalog() {
  const versions = await fetch(
    'https://ddragon.leagueoflegends.com/api/versions.json',
  ).then((r) => {
    if (!r.ok) throw new Error();
    return r.json();
  });
  academy.patch = versions[0];
  const data = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${academy.patch}/data/pt_BR/champion.json`,
  ).then((r) => {
    if (!r.ok) throw new Error();
    return r.json();
  });
  academy.champs = Object.values(data.data);
  document.querySelector('#academy-patch').innerHTML =
    `<i></i>Patch ${academy.patch} · ${academy.champs.length} campeões`;
  renderChallenge();
}
function makeQuestion() {
  const mode = Math.floor(Math.random() * 4);
  if (mode < 2) {
    const champ = choose(academy.champs);
    const key = mode === 0 ? 'passive' : 'spell';
    return fetch(
      `https://ddragon.leagueoflegends.com/cdn/${academy.patch}/data/pt_BR/champion/${champ.id}.json`,
    )
      .then((r) => r.json())
      .then(({ data }) => {
        const detail = data[champ.id];
        const spell = key === 'passive' ? detail.passive : choose(detail.spells);
        const correct = `${champ.name} · ${spell.name}`;
        const others = academy.champs
          .filter((c) => c.id !== champ.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((c) => c.name);
        return {
          type: key === 'passive' ? 'Passiva' : 'Habilidade',
          question: `${key === 'passive' ? 'Qual campeão possui esta passiva?' : 'Qual campeão usa esta habilidade?'} “${spell.name}” — ${spell.description
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 180)}`,
          answer: champ.name,
          options: [champ.name, ...others],
          explanation: `${spell.name} é ${key === 'passive' ? `a passiva de ${champ.name}` : `uma habilidade de ${champ.name}`}.`,
          image:
            key === 'passive'
              ? `https://ddragon.leagueoflegends.com/cdn/${academy.patch}/img/passive/${spell.image.full}`
              : `https://ddragon.leagueoflegends.com/cdn/${academy.patch}/img/spell/${spell.image.full}`,
        };
      });
  }
  if (mode === 2) {
    const pool = academy.champs.filter((c) => c.tags.includes('Tank'));
    const answer = choose(pool);
    const wrong = academy.champs
      .filter((c) => c.id !== answer.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return Promise.resolve({
      type: 'Composição · classe oficial',
      question: `Qual campeão tem a tag oficial Tank no Data Dragon?`,
      answer: answer.name,
      options: [answer.name, ...wrong.map((c) => c.name)],
      explanation: `${answer.name} tem as tags ${answer.tags.join(' e ')} na classificação do Data Dragon.`,
    });
  }
  const questions = [
    {
      question:
        'Quando uma onda de minions inimiga está avançando até sua torre, qual é a prioridade mais direta?',
      options: [
        'Coletar a onda com segurança',
        'Começar o Barão sozinho',
        'Invadir sem visão',
        'Perseguir um abate sem objetivo',
      ],
      answer: 'Coletar a onda com segurança',
      explanation:
        'A onda representa ouro e experiência disponíveis; avalie o mapa e o risco antes de sair da rota.',
    },
    {
      question:
        'Antes de iniciar um objetivo neutro, qual preparação costuma reduzir o risco?',
      options: [
        'Controlar visão e observar onde estão os adversários',
        'Ignorar as rotas laterais',
        'Gastar todo o ouro no inventário',
        'Separar os cinco jogadores sem comunicação',
      ],
      answer: 'Controlar visão e observar onde estão os adversários',
      explanation:
        'Visão, prioridade de rota e informação sobre o posicionamento inimigo ajudam a decidir se o objetivo é seguro.',
    },
    {
      question: 'O que significa “prioridade de rota” em uma decisão de objetivo?',
      options: [
        'Conseguir empurrar a onda e mover-se antes do adversário',
        'Ter mais abates que o outro jogador',
        'Sempre vencer o confronto individual',
        'Escolher primeiro no draft',
      ],
      answer: 'Conseguir empurrar a onda e mover-se antes do adversário',
      explanation:
        'Uma onda empurrada pode liberar tempo para ajudar o rio; a situação muda conforme o jogo.',
    },
  ];
  return Promise.resolve({ type: 'Mecânicas e estratégia', ...choose(questions) });
}
async function renderChallenge() {
  academy.locked = false;
  document.querySelector('#academy-next').hidden = true;
  document.querySelector('#academy-feedback').textContent = '';
  const answers = document.querySelector('#academy-answers');
  answers.innerHTML = '<p class="note">Preparando o próximo desafio…</p>';
  try {
    const challenge = await makeQuestion();
    document.querySelector('#academy-type').textContent = challenge.type;
    document.querySelector('#academy-question').textContent = challenge.question;
    answers.innerHTML = challenge.options
      .sort(() => Math.random() - 0.5)
      .map(
        (option) =>
          `<button type="button" class="academy-answer" data-answer="${option.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">${option}</button>`,
      )
      .join('');
    answers
      .querySelectorAll('button')
      .forEach((button) =>
        button.addEventListener('click', () => answerChallenge(button, challenge)),
      );
  } catch {
    document.querySelector('#academy-question').textContent =
      'Falha ao obter os dados oficiais. Confira a conexão e tente novamente.';
    answers.replaceChildren();
  }
}
function answerChallenge(button, challenge) {
  if (academy.locked) return;
  academy.locked = true;
  const won = button.dataset.answer === challenge.answer;
  document.querySelectorAll('.academy-answer').forEach((answer) => {
    answer.disabled = true;
    if (answer.dataset.answer === challenge.answer) answer.classList.add('correct');
    else if (answer === button && !won) answer.classList.add('incorrect');
  });
  if (won) {
    academy.stats.points += 100;
    academy.stats.correct++;
    academy.stats.streak++;
    academy.stats.best = Math.max(academy.stats.best, academy.stats.streak);
  } else academy.stats.streak = 0;
  localStorage.setItem(ACADEMY_KEY, JSON.stringify(academy.stats));
  renderAcademyStats();
  document.querySelector('#academy-feedback').textContent =
    `${won ? 'Correto! +100 pontos. ' : `A resposta era ${challenge.answer}. `}${challenge.explanation}`;
  document.querySelector('#academy-next').hidden = false;
}
document.querySelector('#academy-next').addEventListener('click', renderChallenge);
document.querySelector('#academy-reset').addEventListener('click', () => {
  if (!window.confirm('Zerar pontos, acertos e sequência da Academy neste navegador?'))
    return;
  academy.stats = { points: 0, correct: 0, streak: 0, best: 0 };
  localStorage.removeItem(ACADEMY_KEY);
  renderAcademyStats();
  document.querySelector('#academy-feedback').textContent = 'Pontuação zerada.';
});
renderAcademyStats();
getCatalog().catch(() => {
  document.querySelector('#academy-question').textContent =
    'Não foi possível carregar o catálogo oficial do Data Dragon. Tente atualizar a página.';
  document.querySelector('#academy-answers').replaceChildren();
});
