# ⚔️ Rift Lab

### Plataforma interativa de análise, estratégia e aprendizado de League of Legends

**Rift Lab** é uma aplicação web desenvolvida para reunir ferramentas de estratégia, análise de campeões, criação de builds e simulação de partidas de League of Legends em um único ambiente.

O projeto combina dados oficiais da Riot Games, interfaces interativas e recursos de planejamento estratégico para oferecer uma experiência acessível tanto para jogadores iniciantes quanto para quem deseja aprofundar seus conhecimentos sobre o jogo.

🌐 **[Acessar Rift Lab](https://riftlab-web-frontend.vercel.app/)**

💻 **[Repositório no GitHub](https://github.com/ricardopjunkes/RiftLab-Web)**

---

## 🎯 Objetivo do projeto

O Rift Lab foi desenvolvido com o objetivo de aplicar conhecimentos de desenvolvimento web na construção de uma plataforma que reúne diferentes funcionalidades em um único sistema.

O projeto explora conceitos de:

- Desenvolvimento frontend e backend.
- Integração com APIs e dados externos.
- Manipulação e validação de dados.
- Persistência em banco de dados e armazenamento local.
- Construção de interfaces responsivas.
- Organização e reutilização de código.
- Simulações e algoritmos de análise.
- Experiência do usuário (UX/UI).

---

## 🚀 Funcionalidades

### 🧙 Guia de Campeões

Explore informações dos campeões de League of Legends utilizando dados oficiais do Data Dragon.

- Pesquisa de campeões.
- Informações e atributos.
- Habilidades.
- Imagens oficiais.
- Navegação interativa.

### ⚔️ Draft Simulator

Ferramenta para simular a fase de seleção e banimento de campeões.

- Escolhas e banimentos.
- Equipes azul e vermelha.
- Organização por rotas.
- Prevenção de seleções duplicadas.
- Análise das composições.
- Sugestões estratégicas baseadas em regras.

### 🛡️ Build Lab

Laboratório para criar e analisar builds de campeões.

- Seleção de campeões.
- Catálogo de itens.
- Inventário de até seis itens.
- Cálculo de atributos disponíveis.
- Custo total em ouro.
- Salvamento de builds no navegador.

### 📊 Build Comparator

Compare duas builds e visualize suas diferenças.

- Comparação de atributos.
- Comparação de custos.
- Importação de builds salvas.
- Análise visual das diferenças.
- Reutilização dos cálculos do Build Lab.

### ✨ Rune Lab

Ferramenta para criar páginas personalizadas de runas.

- Seleção das árvores de runas.
- Configuração de runas principais e secundárias.
- Fragmentos de atributos.
- Validação de combinações.
- Salvamento local das configurações.

### 🗺️ Rift Map

Mapa interativo de Summoner's Rift para planejamento estratégico.

- Posicionamento de campeões.
- Marcadores de visão e objetivos.
- Desenho de rotas e movimentações.
- Zoom e navegação pelo mapa.
- Camadas de visualização.
- Salvamento de estratégias.
- Exportação em PNG.

### 🔍 Matchup Explorer

Ferramenta de comparação entre campeões.

- Comparação de atributos.
- Análise por rota.
- Informações sobre habilidades.
- Visualização de características dos campeões.

As análises utilizam dados disponíveis e regras próprias, sem apresentar previsões como resultados garantidos.

### 🎮 Simulação de Partidas

Simulação recreativa de confrontos entre equipes.

- Montagem de equipes.
- Simulação de acontecimentos da partida.
- Evolução dos confrontos.
- Visualização de resultados.
- Análise simplificada das composições.

A simulação é baseada em modelos e regras aproximadas, não reproduzindo partidas reais.

### 🧠 Adivinhe o Campeão

Minigame interativo de conhecimento sobre League of Legends.

- Desafios de identificação.
- Sistema de tentativas.
- Pontuação.
- Histórico de resultados.
- Acompanhamento de sequência de acertos.

### 🎓 Rift Lab Academy

Área de aprendizado com desafios relacionados ao universo de League of Legends.

- Perguntas e desafios.
- Sistema de pontuação.
- Acompanhamento de progresso.
- Atividades interativas.

---

## 🛠️ Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| HTML5 | Estrutura das páginas |
| CSS3 | Estilização e responsividade |
| JavaScript | Interatividade e lógica do frontend |
| Node.js | Ambiente de execução do backend |
| Express.js | API e rotas do servidor |
| PostgreSQL | Persistência de dados |
| Neon | Hospedagem do banco PostgreSQL |
| Riot Data Dragon | Dados e imagens oficiais do jogo |
| LocalStorage | Armazenamento de configurações locais |
| Git e GitHub | Versionamento de código |
| Vercel | Publicação do frontend |
| Render | Infraestrutura prevista para a API |

---

## 🏗️ Arquitetura

O projeto está organizado em frontend, backend e testes.

```text
RiftLab-Web/
├── frontend/
│   ├── index.html
│   ├── build-lab.html
│   ├── simulation.html
│   ├── quiz.html
│   ├── academy.html
│   ├── app.js
│   ├── build-core.js
│   ├── config.js
│   └── ...
│
├── backend/
│   ├── server.js
│   └── schema.sql
│
├── tests/
├── .env.example
├── package.json
├── render.yaml
├── vercel.json
└── README.md
```

**Frontend:** responsável pela interface, interatividade, visualização de dados e ferramentas utilizadas pelo jogador.

**Backend:** API desenvolvida com Node.js e Express para operações como persistência e compartilhamento de composições.

**Banco de dados:** PostgreSQL, utilizado para armazenar informações das composições compartilhadas.

**Dados externos:** o Data Dragon fornece informações oficiais sobre campeões, itens e runas.

**Armazenamento local:** configurações de builds, desafios e estratégias podem ser mantidas no navegador por meio do LocalStorage.

---

## 💻 Como executar localmente

### Pré-requisitos

- Node.js 20 ou superior.
- npm.
- Git.
- Banco PostgreSQL ou instância no Neon para os recursos que dependem da API.

### 1. Clone o repositório

```bash
git clone https://github.com/ricardopjunkes/RiftLab-Web.git
```

### 2. Acesse o diretório

```bash
cd RiftLab-Web
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis necessárias, incluindo a conexão com o banco de dados.

Nunca publique credenciais ou informações sensíveis no GitHub.

### 5. Inicie o backend

```bash
npm start
```

A API utiliza, por padrão, o endereço:

```text
http://localhost:3000
```

### 6. Execute o frontend

Em outro terminal:

```bash
python -m http.server 8000 --directory frontend
```

Acesse:

```text
http://localhost:8000
```

O frontend deve ser servido por HTTP para que as integrações funcionem corretamente.

---

## 📡 Integração com dados oficiais

O Rift Lab utiliza o **Riot Games Data Dragon** para consultar informações disponibilizadas oficialmente sobre League of Legends.

Entre os dados utilizados estão:

- Campeões.
- Imagens.
- Habilidades.
- Atributos.
- Itens.
- Runas.

As ferramentas de análise e simulação também utilizam regras e cálculos desenvolvidos no próprio projeto.

Os resultados dessas ferramentas não devem ser interpretados como estatísticas competitivas oficiais ou previsões garantidas.

---

## 📱 Interface e experiência do usuário

A interface foi desenvolvida com uma identidade visual inspirada no universo de League of Legends, priorizando:

- Tema escuro.
- Destaques em verde-limão.
- Navegação entre ferramentas.
- Cards interativos.
- Organização de informações.
- Layouts responsivos.
- Feedback visual durante interações.

O objetivo é oferecer uma experiência consistente entre as diferentes ferramentas da plataforma.

---

## 🔮 Evolução do projeto

O Rift Lab é um projeto em desenvolvimento contínuo.

Entre as melhorias planejadas estão:

- Refinamento das ferramentas de estratégia.
- Evolução dos cálculos de builds.
- Melhorias na simulação de partidas.
- Expansão dos desafios da Academy.
- Aperfeiçoamento do mapa tático.
- Melhorias de acessibilidade e responsividade.
- Ampliação dos testes automatizados.
- Otimizações de desempenho.

---

## ⚠️ Aviso legal

Rift Lab é um projeto independente, desenvolvido para fins educacionais e de portfólio.

League of Legends, Riot Games, nomes de campeões, imagens e demais elementos relacionados pertencem aos seus respectivos titulares.

Este projeto não é afiliado, patrocinado ou endossado pela Riot Games.

---

## 👨‍💻 Desenvolvimento

Projeto desenvolvido por **Ricardo Junkes**, com foco no aprendizado e na aplicação prática de tecnologias de desenvolvimento web.

**GitHub:** [ricardopjunkes](https://github.com/ricardopjunkes)

**Aplicação:** [Rift Lab](https://riftlab-web-frontend.vercel.app/)

---

**Rift Lab — Explore campeões. Desenvolva estratégias. Domine o Rift.**