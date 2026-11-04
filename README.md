# RiftLab

Projeto de portfólio para montar composições de League of Legends, consultar os campeões oficiais via Data Dragon, simular partidas e salvar/compartilhar drafts.

## Tecnologias

- **Frontend:** HTML, CSS e JavaScript puro (`frontend/`). Não usa TypeScript nem framework.
- **API:** Node.js + Express (ackend/server.js).
- **Estilo:** Prettier com largura de linha de 88 caracteres (
  pm run format).
- **Banco:** PostgreSQL no Neon. A API cria a tabela ao iniciar usando `backend/schema.sql`.
- **Deploy sugerido:** Vercel para o frontend, Render para a API e Neon para o PostgreSQL.

O catálogo e as imagens dos campeões continuam vindo do Data Dragon da Riot diretamente no navegador. O banco guarda somente composições escolhidas pelo usuário. A simulação continua rodando no navegador.

## Estrutura

```text
frontend/
  index.html       página
  quiz.html        minigame Adivinhe o Campeão
  academy.html    desafios da Rift Lab Academy
  styles.css       estilos
  app.js           busca, composição e simulação
  quiz.js          pontuação, sequência e histórico do minigame
  academy.js       desafios e pontuação geral da Academy
  config.js        endereço público da API
backend/
  server.js        API para salvar e carregar composições
  schema.sql       tabela PostgreSQL
package.json       dependências e comando da API
render.yaml        configuração do serviço no Render
vercel.json        saída estática do frontend
.env.example       variáveis locais de exemplo
```

## Rodar localmente

1. Instale Node.js 20 ou mais recente e PostgreSQL (ou crie um banco no Neon).
2. Na raiz do projeto, instale as dependências: `npm install`.
3. Copie `.env.example` para `.env` e configure `DATABASE_URL` com a connection string do Neon. Mantenha `sslmode=require` no endereço fornecido pelo Neon.
4. Inicie a API com `npm start`. Ela escuta em `http://localhost:3000` e cria a tabela automaticamente.
5. Em outro terminal, sirva `frontend/` por HTTP. Com Python: `python -m http.server 8000 --directory frontend`.
6. Acesse `http://localhost:8000`. `config.js` detecta o ambiente local e aponta para `http://localhost:3000`.

Não abra `index.html` usando `file://`; o navegador precisa servir a página por HTTP para as chamadas funcionarem.

## Publicar

### 1. GitHub

Crie um repositório vazio no GitHub. Na pasta raiz deste projeto:

```bash
git init -b main
git add .
git commit -m "feat: prepara o RiftLab para deploy"
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

Nunca adicione o arquivo `.env` ou a senha do Neon ao repositório. O `.gitignore` já exclui esses arquivos.

### 2. Neon

Crie um projeto PostgreSQL no Neon e copie a connection string. A tabela `compositions` é criada automaticamente pela API no primeiro início. Configure essa string como `DATABASE_URL` no serviço da API, sem colocá-la no frontend.

### 3. Render (API)

Conecte o repositório no Render e crie um **Web Service**:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Environment variables: `DATABASE_URL` (connection string do Neon) e `FRONTEND_ORIGIN` (URL pública exata da Vercel, por exemplo `https://riftlab.vercel.app`).

O `render.yaml` deste projeto já declara esses campos; escolha **Blueprint** para usá-lo ou preencha os valores no painel. Serviços gratuitos do Render podem desligar após inatividade e demorar para responder à primeira chamada. O plano gratuito do Render Postgres expira; por isso o projeto usa Neon para o banco.

### 4. Vercel (frontend)

Importe o repositório do GitHub na Vercel com **Root Directory** na raiz do repositório, Framework **Other** e sem build command. O `vercel.json` publica a pasta `frontend` como site estático.

Depois que a API estiver no ar, abra `frontend/config.js`, defina `window.RIFTLAB_API_URL` para a URL HTTPS do Render (sem barra no final), faça commit e envie ao GitHub. A Vercel publica a atualização automaticamente.

## Compartilhamento e dados

“Salvar e compartilhar composição” grava os IDs dos campeões e as rotas no banco e copia um link com código aleatório. Quem tiver o link consegue abrir a composição. Não há login: não salve informações pessoais no draft. A API limita a criação de links para reduzir spam.

## Limitações

- Taxas de confronto não são extraídas do OP.GG; a página abre o OP.GG para consulta manual.
- A simulação é recreativa e probabilística, não reproduz partidas profissionais reais.
- Pontuação, histórico e sequência dos desafios ficam no LocalStorage do navegador usado; não sincronizam entre dispositivos.
- Ouro, níveis, ondas e torres da simulação são uma aproximação didática baseada no tempo, nas ondas e na vantagem estimada do draft; não são dados ao vivo nem estatísticas profissionais.
- A API precisa estar acessível pela internet para salvar e abrir links compartilhados.
