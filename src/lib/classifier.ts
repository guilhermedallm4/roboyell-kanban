/**
 * Classificador automático de tarefas.
 *
 * Funciona 100% no navegador, sem chamadas externas, e é explicável:
 *  1. Léxico ponderado por equipe (PT-BR + EN). O texto é normalizado (minúsculas, sem acentos) e
 *     passa por um "stemmer" leve de plural, então "requisitos" casa "requisito" e "integrações"
 *     casa "integração". Termos com "*" casam por prefixo ("otimiz*" → otimizar, otimização).
 *  2. Tolerância a erros de digitação: palavras longas (6+ letras) com 1 letra trocada, faltando ou
 *     sobrando ainda casam, com peso menor ("requisitso" → requisito).
 *  3. Palavras do título valem mais que as da descrição.
 *  4. Aprendizado por feedback: quando alguém troca manualmente a equipe de uma tarefa, as palavras
 *     daquela tarefa passam a puxar para a equipe escolhida (um Naive-Bayes simplificado).
 *  5. As pontuações viram probabilidades por softmax. Sem nenhum sinal, a tarefa vai para a triagem
 *     de Produto & Requisitos — toda tarefa sempre sai com uma equipe.
 */
import type { Severity, Task, TaskType, TeamId } from '../types';

type Lexicon<K extends string> = Record<K, ReadonlyArray<readonly [term: string, weight: number]>>;

const TITLE_BOOST = 1.6;
const FUZZY_FACTOR = 0.7;
/** Equipe que faz a triagem quando o texto não tem sinal nenhum. */
export const FALLBACK_TEAM: TeamId = 'product';

export const TEAM_LEXICON: Lexicon<TeamId> = {
  ai: [
    ['inteligencia artificial', 3], ['ia', 2], ['machine learning', 3], ['ml', 2], ['deep learning', 3],
    ['rede neural', 3], ['modelo', 2], ['treinamento do modelo', 3], ['treinamento', 1.5], ['treinar', 2.5],
    ['retreinar', 3], ['inferencia', 2.5], ['acuracia', 3], ['precisao', 1.5], ['recall', 2.5],
    ['falso positivo', 2.5], ['falso negativo', 2.5], ['visao computacional', 3], ['computer vision', 3],
    ['reconhecimento facial', 3], ['reconhecimento', 1.5], ['facial', 2], ['face', 1.5], ['biometria', 2.5],
    ['detecc*', 2], ['detectar', 2], ['detector', 2.5], ['classificador', 2], ['classificacao', 1.5],
    ['segmentacao', 2.5], ['rastreamento', 2], ['tracking', 2], ['reidentificacao', 3], ['contagem de pessoa', 3],
    ['contagem', 1.5], ['ocr', 3], ['lpr', 3], ['leitura de placa', 3], ['yolo', 3], ['cnn', 3],
    ['pytorch', 3], ['tensorflow', 3], ['onnx', 2.5], ['tensorrt', 2], ['dataset', 1.5], ['anotacao', 2],
    ['rotulagem', 2.5], ['fine tuning', 3], ['transfer learning', 3], ['quantizacao', 2], ['epoch', 2.5],
    ['overfitting', 3], ['embedding', 2], ['llm', 3], ['gpt', 2.5], ['prompt', 2], ['chatbot', 3], ['nlp', 3],
    ['pose', 1.5], ['estimativa de pose', 3], ['epi', 1.5], ['algoritmo', 1.5], ['predicao', 2.5],
    ['imagem', 1], ['video analytics', 3], ['analise de video', 3], ['analitico de video', 3], ['kayla', 0.5],
  ],
  frontend: [
    ['front end', 3], ['frontend', 3], ['front', 2], ['interface', 2], ['ui', 1.5], ['tela', 2.5],
    ['tela de login', 3], ['pagina', 2], ['botao', 2.5], ['layout', 2.5], ['css', 3], ['html', 2.5],
    ['react', 3], ['vue', 3], ['angular', 3], ['tailwind', 3], ['componente', 2], ['responsiv*', 2.5],
    ['dark mode', 2.5], ['modo escuro', 2.5], ['tema', 1.5], ['modal', 2.5], ['formulario', 2],
    ['dashboard', 1.5], ['painel', 1.5], ['painel web', 3], ['grafico', 1.5], ['navegador', 2.5],
    ['browser', 2.5], ['chrome', 2], ['safari', 2], ['firefox', 2], ['renderiza*', 2], ['acessibilidade', 2.5],
    ['animacao', 2], ['menu', 2], ['sidebar', 2.5], ['dropdown', 2.5], ['input', 1.5], ['alinhamento', 1.5],
    ['fonte', 1], ['icone', 1.5], ['spa', 2], ['vite', 2], ['next js', 3], ['typescript', 1], ['web', 1],
    ['site', 2], ['landing page', 3], ['portal', 1.5], ['aplicativo', 2], ['app', 1], ['mobile', 2],
    ['android', 2.5], ['ios', 2.5], ['pwa', 3], ['player de video', 2], ['exibir', 1.5], ['visualizacao', 1.5],
    ['tabela', 1.5], ['filtro', 1], ['paginacao', 1.5],
  ],
  backend: [
    ['back end', 3], ['backend', 3], ['api', 3], ['endpoint', 3], ['rest', 2], ['graphql', 3],
    ['servidor', 1.5], ['banco de dado', 3], ['database', 3], ['sql', 3], ['postgres', 3], ['postgresql', 3],
    ['mysql', 3], ['mongodb', 3], ['redis', 2.5], ['query', 2], ['migracao', 1.5], ['migration', 2],
    ['autenticacao', 2.5], ['autorizacao', 2], ['jwt', 3], ['token', 1.5], ['oauth', 2.5], ['sso', 2.5],
    ['microservico', 3], ['fila', 2], ['rabbitmq', 3], ['kafka', 3], ['mqtt', 2], ['webhook', 3],
    ['integracao', 2], ['node', 2], ['django', 3], ['fastapi', 3], ['flask', 3], ['spring', 3], ['java', 2],
    ['golang', 3], ['timeout', 2], ['erro 500', 3], ['cache', 1.5], ['orm', 3], ['crud', 2.5], ['permiss*', 1.5],
    ['rota', 1.5], ['payload', 2.5], ['json', 1.5], ['websocket', 2.5], ['notificacao', 1.5], ['email', 1.5],
    ['multi tenant', 3], ['regra de negocio', 2], ['servico', 1.5], ['sincronizacao', 2], ['login', 1],
    ['cadastro', 1], ['pagamento', 2], ['importacao', 1.5], ['sdk', 2], ['calculo', 1.5], ['agendamento', 1.5],
  ],
  devops: [
    ['devops', 3], ['deploy', 3], ['deployment', 3], ['ci', 2.5], ['cd', 2], ['ci cd', 3], ['pipeline', 1.5],
    ['docker', 3], ['container', 2.5], ['kubernetes', 3], ['k8s', 3], ['helm', 3], ['aws', 3], ['azure', 3],
    ['gcp', 3], ['cloud', 2.5], ['nuvem', 2.5], ['infraestrutura', 3], ['infra', 3], ['terraform', 3],
    ['ansible', 3], ['monitoramento', 2.5], ['monitorar', 2], ['grafana', 3], ['prometheus', 3], ['zabbix', 3],
    ['log', 1.5], ['alerta', 1], ['backup', 2.5], ['ssl', 3], ['certificado', 2.5], ['dns', 3], ['dominio', 2],
    ['nginx', 3], ['load balancer', 3], ['balanceamento', 2], ['escalabilidade', 2], ['autoscaling', 3],
    ['uptime', 2.5], ['disponibilidade', 2], ['github action', 3], ['gitlab', 2.5], ['staging', 2.5],
    ['ambiente', 1.5], ['producao', 1.5], ['rollback', 2.5], ['vpn', 3], ['firewall', 3], ['custo', 1],
    ['linux', 1.5], ['hospedagem', 3], ['implantacao', 2.5], ['acesso remoto', 2.5], ['seguranca', 1],
  ],
  embedded: [
    ['embarcado', 3], ['hardware', 3], ['firmware', 3], ['jetson', 3], ['raspberry', 3], ['arm', 2],
    ['edge', 2.5], ['borda', 2], ['dispositivo', 2], ['camera', 2.5], ['camera ip', 3], ['sensor', 2.5],
    ['gpio', 3], ['rtsp', 3], ['onvif', 3], ['dvr', 3], ['nvr', 3], ['stream', 1.5], ['streaming', 1.5],
    ['cpu', 1.5], ['gpu', 1], ['memoria', 1.5], ['ram', 2], ['baixo recurso', 3], ['temperatura', 2],
    ['superaquec*', 3], ['consumo de energia', 3], ['energia', 1.5], ['usb', 2.5], ['serial', 2.5],
    ['yocto', 3], ['linux embarcado', 3], ['cross compil*', 3], ['compilacao cruzada', 3], ['fps', 1.5],
    ['latencia', 1], ['codec', 2.5], ['h264', 3], ['h265', 3], ['gstreamer', 3], ['ffmpeg', 2.5], ['iot', 3],
    ['equipamento', 2], ['instalacao de camera', 3], ['cabeamento', 3], ['poe', 3], ['rede local', 2],
  ],
  qa: [
    ['qa', 3], ['teste', 2.5], ['testar', 2], ['test', 2], ['regressao', 3], ['automacao de teste', 3],
    ['e2e', 3], ['end to end', 3], ['cypress', 3], ['playwright', 3], ['selenium', 3], ['unitario', 2.5],
    ['teste de carga', 3], ['cobertura', 2.5], ['coverage', 2.5], ['caso de teste', 3], ['homologacao', 1.5],
    ['validar', 1], ['validacao', 1], ['reproduzir', 1.5], ['cenario', 1.5], ['smoke', 2.5], ['stress', 2],
    ['plano de teste', 3], ['qualidade', 1.5], ['flaky', 3], ['verificar', 1], ['conferir', 1],
  ],
  design: [
    ['design', 2], ['ux', 3], ['ui ux', 3], ['figma', 3], ['prototipo', 3], ['wireframe', 3],
    ['usabilidade', 3], ['jornada', 2.5], ['persona', 2.5], ['identidade visual', 3], ['logo', 2],
    ['paleta', 2.5], ['cor', 1.5], ['cores', 1.5], ['tipografia', 3], ['mockup', 3], ['experiencia do usuario', 3],
    ['pesquisa com usuario', 3], ['teste de usabilidade', 3], ['design system', 3], ['style guide', 3],
    ['guia de estilo', 3], ['heuristica', 2.5], ['onboarding', 1.5], ['fluxo', 1], ['ux writing', 3],
    ['microinteracao', 3], ['ilustracao', 2.5],
  ],
  data: [
    ['dado', 1.5], ['etl', 3], ['elt', 3], ['pipeline de dado', 3], ['data lake', 3], ['data warehouse', 3],
    ['bi', 3], ['power bi', 3], ['metabase', 3], ['looker', 3], ['relatorio', 2.5], ['kpi', 3], ['metrica', 1.5],
    ['analytics', 3], ['estatistica', 2], ['bigquery', 3], ['spark', 3], ['airflow', 3], ['csv', 2],
    ['exportacao', 1.5], ['exportar', 1.5], ['planilha', 2.5], ['agregacao', 2], ['historico', 1.5],
    ['heatmap', 2], ['mapa de calor', 2.5], ['indicador', 2], ['consolidado', 2], ['analise de dado', 3],
    ['tendencia', 2], ['ciencia de dado', 3],
  ],
  product: [
    ['requisito', 3], ['levantamento', 2.5], ['levantamento de requisito', 3], ['requisitos funcionais', 3],
    ['escopo', 2.5], ['stakeholder', 3], ['cliente', 1], ['reuniao', 2.5], ['entrevista com cliente', 3],
    ['roadmap', 3], ['priorizacao', 2.5], ['priorizar', 2.5], ['user story', 3], ['historia de usuario', 3],
    ['criterio de aceite', 3], ['especificacao', 2.5], ['documento de requisito', 3], ['regra de negocio', 1.5],
    ['proposta', 2], ['proposta comercial', 3], ['orcamento', 2.5], ['cronograma', 3], ['planejamento', 2.5],
    ['sprint', 2], ['kickoff', 3], ['alinhamento com', 2], ['alinhar', 1.5], ['apresentacao', 2],
    ['demonstracao', 2], ['demo', 1.5], ['mvp', 2.5], ['produto', 1.5], ['mercado', 2], ['concorrente', 2.5],
    ['contrato', 2], ['licitacao', 3], ['treinamento de cliente', 3], ['feedback de cliente', 3],
    ['pesquisa de mercado', 3], ['negocio', 2], ['business', 2], ['mapear', 1.5], ['mapeamento', 2],
    ['processo', 1.5], ['brainstorm', 3], ['ideacao', 3], ['prd', 3], ['documentacao funcional', 3],
    ['product owner', 3], ['po', 1.5], ['backlog', 1.5], ['refinamento', 2.5], ['estimativa', 2],
    ['viabilidade', 1.5], ['necessidade', 2], ['demanda', 1.5], ['parceiro', 1.5], ['comercial', 2],
  ],
};

export const TYPE_LEXICON: Lexicon<TaskType> = {
  bugfix: [
    ['bug', 3], ['erro', 2.5], ['error', 2.5], ['falha', 2], ['falhando', 2.5], ['quebr*', 2], ['crash', 3],
    ['trav*', 2], ['nao funciona', 3], ['parou de funcionar', 3], ['corrigir', 3], ['correcao', 3], ['fix', 3],
    ['defeito', 3], ['incorret*', 2], ['exception', 2.5], ['excecao', 2.5], ['erro 500', 3], ['inconsisten*', 1.5],
  ],
  feature: [
    ['nova', 1.5], ['novo', 1.5], ['criar', 2], ['adicionar', 2], ['implementar', 2], ['permitir', 2],
    ['suporte a', 2], ['funcionalidade', 2.5], ['feature', 3], ['integrar', 1.5], ['modulo', 1.5],
  ],
  improvement: [
    ['melhorar', 3], ['melhoria', 3], ['otimiz*', 3], ['performance', 2.5], ['desempenho', 2.5],
    ['reduzir', 2], ['aumentar', 1.5], ['acelerar', 2], ['ajustar', 1.5], ['aprimorar', 3],
  ],
  refactor: [
    ['refator*', 3], ['reestrutur*', 3], ['limpar codigo', 3], ['debito tecnico', 3], ['divida tecnica', 3],
    ['legado', 2], ['desacopl*', 2.5], ['modularizar', 2.5],
  ],
  research: [
    ['pesquisar', 3], ['pesquisa', 2], ['investigar', 3], ['estudo', 2.5], ['estudar', 2.5], ['poc', 3],
    ['prova de conceito', 3], ['avaliar', 2], ['benchmark', 2.5], ['spike', 3], ['viabilidade', 3], ['comparar', 2],
    ['levantamento', 2.5], ['levantar', 2], ['mapear', 1.5], ['mapeamento', 2], ['analisar', 2], ['entender', 1.5],
  ],
  docs: [
    ['document*', 3], ['readme', 3], ['manual', 2.5], ['wiki', 3], ['guia', 1.5], ['tutorial', 3], ['changelog', 3],
    ['especificacao', 1.5],
  ],
  chore: [
    ['atualizar dependencia', 3], ['dependencia', 2], ['upgrade', 2.5], ['renovar', 2.5], ['backup', 1.5],
    ['rotina', 2], ['configurar', 1.5], ['manutencao', 3], ['limpeza', 2], ['versao', 1], ['reuniao', 1.5],
  ],
};

export const SEVERITY_LEXICON: Lexicon<Exclude<Severity, 'medium'>> = {
  critical: [
    ['critico', 3], ['critica', 3], ['urgente', 3], ['urgencia', 3], ['fora do ar', 3], ['producao parada', 3],
    ['parado', 2], ['parada', 2], ['indisponivel', 3], ['vazamento', 3], ['vulnerabilidade', 3],
    ['seguranca', 2], ['perda de dado', 3], ['todos os cliente', 3], ['bloqueante', 3], ['blocker', 3],
    ['emergencia', 3], ['hotfix', 3],
  ],
  high: [
    ['importante', 2], ['alta prioridade', 3], ['cliente', 1.5], ['prazo', 1.5], ['impacto', 1.5],
    ['grave', 2.5], ['crash', 2], ['producao', 1.5], ['contrato', 1.5], ['demo', 1.5],
  ],
  low: [
    ['cosmetico', 3], ['pequeno', 2], ['detalhe', 2], ['typo', 3], ['texto', 1], ['nice to have', 3],
    ['quando possivel', 3], ['futuramente', 2.5], ['opcional', 2.5], ['baixa prioridade', 3], ['alinhamento', 1],
  ],
};

const STOPWORDS = new Set(
  ('a o e de da do das dos em no na nos nas um uma uns umas para por com sem que se ao aos as os ou mais ' +
    'menos muito pouco ser estar esta este isso essa esse como quando onde qual quais the and for with of to in on ' +
    'is be it this that from nao sim tambem ja ainda apos antes sobre entre todo toda todos todas cada')
    .split(' '),
);

// ---------------------------------------------------------------------------------------------
// Normalização e stemming

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Stemmer leve de plural (PT + EN). Não precisa ser linguisticamente perfeito: o mesmo stem é aplicado
 * ao léxico e ao texto, então o que importa é a consistência.
 */
export function stem(word: string): string {
  const w = word;
  if (w.length <= 3) return w;
  if (w.endsWith('oes') || w.endsWith('aes')) return `${w.slice(0, -3)}ao`; // integrações → integracao
  if (w.endsWith('ais')) return `${w.slice(0, -3)}al`; // funcionais → funcional
  if (w.endsWith('eis') && w.length > 4) return `${w.slice(0, -3)}el`; // painéis → painel
  if (w.endsWith('ns')) return `${w.slice(0, -2)}m`; // imagens → imagem
  if ((w.endsWith('res') || w.endsWith('zes')) && w.length > 5) return w.slice(0, -2); // servidores → servidor
  if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1); // requisitos → requisito
  return w;
}

const tokenize = (normalized: string): string[] => (normalized ? normalized.split(' ') : []);

interface Doc {
  rawPadded: string;
  rawTokens: string[];
  stemPadded: string;
  stemTokens: string[];
}

function toDoc(text: string): Doc {
  const rawTokens = tokenize(normalize(text));
  const stemTokens = rawTokens.map(stem);
  return { rawPadded: ` ${rawTokens.join(' ')} `, rawTokens, stemPadded: ` ${stemTokens.join(' ')} `, stemTokens };
}

/** true if a and b differ by at most one edit (insert, delete, substitute or adjacent swap). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let i = 0;
    while (i < la && a[i] === b[i]) i++;
    if (i === la) return true;
    // substitution or adjacent transposition
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0;
  while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
}

interface CompiledTerm {
  label: string;
  weight: number;
  prefix: string | null; // for "foo*" terms (matched on raw text)
  key: string; // stemmed phrase, e.g. "levantamento de requisito"
  fuzzy: boolean; // single long word → typo tolerant
}

type CompiledLexicon<K extends string> = Record<K, CompiledTerm[]>;

function compile<K extends string>(lexicon: Lexicon<K>): CompiledLexicon<K> {
  const out = {} as CompiledLexicon<K>;
  for (const key of Object.keys(lexicon) as K[]) {
    out[key] = lexicon[key].map(([term, weight]) => {
      const isPrefix = term.endsWith('*');
      const base = normalize(term.replace('*', ''));
      const words = tokenize(base);
      return {
        label: base,
        weight,
        prefix: isPrefix ? base : null,
        key: words.map(stem).join(' '),
        fuzzy: !isPrefix && words.length === 1 && base.length >= 6,
      };
    });
  }
  return out;
}

function matchTerm(doc: Doc, term: CompiledTerm): 'exact' | 'fuzzy' | null {
  if (term.prefix !== null) {
    if (term.prefix.includes(' ')) return doc.rawPadded.includes(` ${term.prefix}`) ? 'exact' : null;
    return doc.rawTokens.some((t) => t.startsWith(term.prefix!)) ? 'exact' : null;
  }
  if (doc.stemPadded.includes(` ${term.key} `)) return 'exact';
  if (term.fuzzy && doc.stemTokens.some((t) => t.length >= 6 && withinOneEdit(t, term.key))) return 'fuzzy';
  return null;
}

interface LexiconScore<K extends string> {
  scores: Record<K, number>;
  hits: Record<K, string[]>;
}

function scoreLexicon<K extends string>(title: string, description: string, lexicon: CompiledLexicon<K>): LexiconScore<K> {
  const t = toDoc(title);
  const d = toDoc(description);
  const scores = {} as Record<K, number>;
  const hits = {} as Record<K, string[]>;
  for (const key of Object.keys(lexicon) as K[]) {
    let score = 0;
    const found: string[] = [];
    for (const term of lexicon[key]) {
      const inTitle = matchTerm(t, term);
      const inDesc = inTitle === 'exact' ? null : matchTerm(d, term);
      const kind = inTitle ?? inDesc;
      if (!kind) continue;
      const factor = (inTitle ? TITLE_BOOST : 1) * (kind === 'fuzzy' ? FUZZY_FACTOR : 1);
      score += term.weight * factor;
      found.push(kind === 'fuzzy' ? `${term.label}~` : term.label);
    }
    scores[key] = score;
    hits[key] = found;
  }
  return { scores, hits };
}

const TEAM_C = compile(TEAM_LEXICON);
const TYPE_C = compile(TYPE_LEXICON);
const SEVERITY_C = compile(SEVERITY_LEXICON);

// ---------------------------------------------------------------------------------------------
// Aprendizado por feedback

export interface FeedbackModel {
  /** token (stem) -> contagem por equipe, apenas de tarefas cuja equipe foi definida manualmente */
  counts: Map<string, Partial<Record<TeamId, number>>>;
  examples: number;
}

const feedbackTokens = (text: string) =>
  new Set(tokenize(normalize(text)).filter((w) => w.length >= 4 && !STOPWORDS.has(w)).map(stem));

export function buildFeedbackModel(tasks: Iterable<Task>): FeedbackModel {
  const counts: FeedbackModel['counts'] = new Map();
  let examples = 0;
  for (const task of tasks) {
    if (task.teamSource !== 'manual') continue;
    examples++;
    for (const token of feedbackTokens(`${task.title} ${task.description}`)) {
      const entry = counts.get(token) ?? {};
      entry[task.team] = (entry[task.team] ?? 0) + 1;
      counts.set(token, entry);
    }
  }
  return { counts, examples };
}

const FEEDBACK_WEIGHT = 1.2;

// ---------------------------------------------------------------------------------------------

export interface TeamCandidate {
  team: TeamId;
  probability: number;
  score: number;
  keywords: string[];
  learned: string[];
}

export interface TeamPrediction {
  team: TeamId;
  confidence: number;
  /** true quando nenhum termo foi reconhecido e a tarefa foi para a triagem padrão */
  fallback: boolean;
  ranking: TeamCandidate[];
}

const TEMPERATURE = 1.4;

export function classifyTeam(title: string, description: string, model?: FeedbackModel): TeamPrediction {
  const { scores, hits } = scoreLexicon(title, description, TEAM_C);
  const teams = Object.keys(scores) as TeamId[];
  const learned = Object.fromEntries(teams.map((k) => [k, [] as string[]])) as Record<TeamId, string[]>;

  if (model && model.examples > 0) {
    for (const token of feedbackTokens(`${title} ${description}`)) {
      const entry = model.counts.get(token);
      if (!entry) continue;
      const total = Object.values(entry).reduce((a, b) => a + (b ?? 0), 0);
      for (const [team, count] of Object.entries(entry) as [TeamId, number][]) {
        const share = count / total;
        if (share < 0.5) continue; // token ambíguo: ignora
        scores[team] += FEEDBACK_WEIGHT * share * Math.min(count, 3);
        learned[team].push(token);
      }
    }
  }

  const max = Math.max(...teams.map((k) => scores[k]));
  const exps = teams.map((k) => Math.exp((scores[k] - max) / TEMPERATURE));
  const sum = exps.reduce((a, b) => a + b, 0);

  const ranking: TeamCandidate[] = teams
    .map((team, i) => ({ team, probability: exps[i] / sum, score: scores[team], keywords: hits[team], learned: learned[team] }))
    .sort((a, b) => b.score - a.score);

  if (max <= 0) return { team: FALLBACK_TEAM, confidence: 0, fallback: true, ranking };
  return { team: ranking[0].team, confidence: ranking[0].probability, fallback: false, ranking };
}

export interface SimpleSuggestion<K extends string> {
  value: K;
  keywords: string[];
}

export function suggestType(title: string, description: string): SimpleSuggestion<TaskType> | null {
  return pickBest(scoreLexicon(title, description, TYPE_C));
}

export function suggestSeverity(title: string, description: string): SimpleSuggestion<Severity> | null {
  const result = scoreLexicon(title, description, SEVERITY_C);
  // A clear critical signal ("urgente", "fora do ar"…) wins over softer "high" hints.
  if (result.scores.critical >= 3) return { value: 'critical', keywords: result.hits.critical };
  return pickBest(result);
}

function pickBest<K extends string>({ scores, hits }: LexiconScore<K>): SimpleSuggestion<K> | null {
  let best: K | null = null;
  for (const k of Object.keys(scores) as K[]) if (best === null || scores[k] > scores[best]) best = k;
  if (best === null || scores[best] <= 0) return null;
  return { value: best, keywords: hits[best] };
}

export function confidenceLabel(confidence: number): 'alta' | 'média' | 'baixa' {
  if (confidence >= 0.75) return 'alta';
  if (confidence >= 0.45) return 'média';
  return 'baixa';
}
