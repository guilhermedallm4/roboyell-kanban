# Roboyell · Kanban de Projetos

Quadro Kanban para organizar as tarefas dos projetos da Roboyell (KAyla). Usa a paleta e a tipografia de roboyell.com.

- **Site:** https://guilhermedallm4.github.io/roboyell-kanban/ (publicado pelo GitHub Actions a cada push na `main`)
- **Tarefas compartilhadas:** [`data/board.json`](data/board.json) neste mesmo repositório (privado)

## Como rodar localmente

```bash
npm install
npm run dev          # http://localhost:5173  (login validado no servidor local)
npm test             # testes do classificador e da mesclagem (Vitest)
npm run build        # build de produção em dist/
npm run build:pages  # build igual ao do GitHub Pages (login no navegador, base /roboyell-kanban/)
```

## Páginas

**`/login`** (entrada) e **`/home`** (o quadro). Quem abre `/home` sem estar logado vai para `/login` e, depois de entrar, volta para onde queria ir. Quem já está logado e abre `/login` vai direto para `/home`.

## Login

Há dois modos, com as mesmas senhas:

| | `npm run dev` / `npm run preview` | GitHub Pages (`build:pages`) |
|---|---|---|
| Onde a senha é conferida | no servidor (`server/auth.ts`) | no navegador (`src/auth/staticAuth.ts`) |
| Hash | scrypt em `server/users.json` (não versionado) | PBKDF2-SHA256, 600 mil iterações, em `src/auth/static-users.json` |
| Sessão | cookie HttpOnly assinado | `sessionStorage` (ou `localStorage` com "Manter conectado") |

Em ambos: 12 h de sessão (30 dias com "Manter conectado"), 5 senhas erradas bloqueiam por 5 min, e trocar a senha encerra as sessões abertas. Dá para entrar com o usuário (`guilherme`), o primeiro nome ou o nome completo.

**Importante sobre o Pages:** num site estático a tela de login roda no navegador de quem visita. As senhas não vazam (são longas e aleatórias, e só o hash é publicado), mas alguém com conhecimento técnico consegue pular a tela. Quem protege de verdade as tarefas é o repositório privado: sem um token com acesso a ele, ninguém lê nem grava `data/board.json`.

Para trocar uma senha ou criar um usuário (atualiza os dois arquivos de hash; depois faça commit e push de `src/auth/static-users.json`):

```bash
npm run user:password -- guilherme                       # gera e mostra uma senha nova
RY_PASSWORD='senha-escolhida' npm run user:password -- pedro
npm run user:password -- maria "Maria Souza"              # cria um usuário novo
```

## Sincronização das tarefas

As tarefas ficam sempre salvas no navegador (funciona offline) e são espelhadas em `data/board.json` deste repositório privado, pela API do GitHub:

- cada alteração é enviada ~1,5 s depois de feita (um commit "Atualiza quadro (Nome)");
- as alterações da outra pessoa chegam a cada 15 s, ao voltar para a aba ou ao reconectar;
- se os dois editarem ao mesmo tempo, os quadros são mesclados tarefa a tarefa: vale a edição mais recente, e exclusões não "ressuscitam";
- commits em `data/**` não disparam novo deploy do site.

Para ativar, cada pessoa clica no indicador de sincronização no cabeçalho (ou em Menu → Sincronização com GitHub) e cola um token **uma vez** por navegador:

- **Guilherme (dono):** [token refinado](https://github.com/settings/personal-access-tokens/new) com acesso só a `guilhermedallm4/roboyell-kanban` e permissão *Contents: Read and write*.
- **Pedro (colaborador):** aceite o convite do repositório e crie um [token clássico com escopo `repo`](https://github.com/settings/tokens/new?scopes=repo&description=Roboyell%20Kanban). Tokens refinados não acessam repositórios de outra conta.

Na primeira conexão, o navegador adota o quadro compartilhado. Se o arquivo ainda não existir, o quadro desse navegador vira o compartilhado.

## Funcionalidades

- **Cards** com título, descrição, severidade (Baixa → Crítica), tipo (Feature, Bugfix, Melhoria, Refatoração, Pesquisa/PoC, Documentação, Manutenção), status, equipe, responsável (Guilherme Lima ou Pedro Rosa) e prazo.
- **Colunas**: Backlog → Em análise → A fazer → Em execução → Em revisão/QA → Concluído, com limite de WIP em "Em execução" (5) e "Em revisão" (4).
- **Arrastar e soltar** com mouse, toque ou teclado: foque um card, aperte `Espaço`, use as setas `←/→` para trocar de coluna e `↑/↓` para trocar de posição, e `Espaço` para soltar.
- **Classificador automático de equipe**: sugere a equipe em tempo real a partir do título e da descrição, mostra a confiança e as palavras que pesaram, e aprende quando alguém corrige a equipe manualmente. Também sugere o tipo e a severidade.
- **Busca e filtros** por equipe, severidade e tipo.
- **Atalhos**: `N` cria uma tarefa, `/` vai para a busca, `Ctrl+Enter` salva, `Esc` fecha.
- **Exportar/importar** o quadro em JSON e "desfazer" ao excluir.

## Equipes

Inteligência Artificial · Front-End · Back-End · DevOps & Infra · Embarcados & Edge · QA & Testes · UX/UI Design · Produto & Requisitos · Dados & BI. Tarefas sem nenhuma palavra reconhecida vão para a triagem de **Produto & Requisitos**, então nenhuma fica sem equipe. Para mudar ou adicionar equipes, edite `src/lib/meta.ts` (rótulos e cores) e `src/lib/classifier.ts` (palavras-chave).

## Estrutura

```
src/
  lib/classifier.ts       classificador (léxico ponderado + aprendizado por correções)
  lib/meta.ts             status, severidades, tipos, equipes e responsáveis
  hooks/useBoard.ts       estado do quadro (reducer + localStorage)
  sync/                   sincronização com data/board.json (API do GitHub + mesclagem)
  auth/                   login: servidor (api.ts) ou navegador (staticAuth.ts)
  components/             Board, Column, TaskCard, TaskModal, LoginScreen, SyncDialog…
server/                   API de login do modo local e script de senhas
data/board.json           quadro compartilhado (gravado pelo app)
.github/workflows/        deploy no GitHub Pages
```

Stack: React 19, TypeScript, Vite, React Router, dnd-kit, lucide-react, Vitest.
