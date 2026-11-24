import type { BoardState, Status, Task, TaskDraft } from '../types';
import { assignNumbers } from './numbering';
import { classifyTeam } from './classifier';

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

type SeedItem = Omit<TaskDraft, 'team' | 'teamSource'> & Partial<Pick<TaskDraft, 'team' | 'teamSource'>>;

const ITEMS: SeedItem[] = [
  {
    title: 'Retreinar modelo de reconhecimento facial com máscaras',
    description: 'KAyla Faces está gerando falsos positivos com máscara e boné. Ampliar o dataset, rotular ~3k imagens e retreinar.',
    severity: 'high', type: 'improvement', status: 'doing', assignee: 'Guilherme Lima', dueDate: iso(6),
  },
  {
    title: 'Endpoint /cameras retorna erro 500 com mais de 200 dispositivos',
    description: 'Query no PostgreSQL sem paginação estoura timeout. Clientes do KAyla Security afetados.',
    severity: 'critical', type: 'bugfix', status: 'analysis', assignee: 'Pedro Rosa', dueDate: iso(1),
  },
  {
    title: 'Dashboard de contagem de pessoas com mapa de calor',
    description: 'Nova tela no painel web mostrando fluxo por hora e mapa de calor por zona da loja.',
    severity: 'medium', type: 'feature', status: 'todo', assignee: 'Guilherme Lima', dueDate: iso(14),
  },
  {
    title: 'KAyla superaquecendo na Jetson Nano com 4 câmeras RTSP',
    description: 'Temperatura passa de 80°C após 2h. Avaliar redução de FPS, decodificação por hardware (GStreamer) e quantização.',
    severity: 'high', type: 'bugfix', status: 'doing', assignee: 'Pedro Rosa',
  },
  {
    title: 'Pipeline de CI/CD com GitHub Actions para o KAyla Agro',
    description: 'Build das imagens Docker, testes e deploy automático em staging a cada merge.',
    severity: 'medium', type: 'chore', status: 'backlog',
  },
  {
    title: 'Levantamento de requisitos do KAyla Sports',
    description: 'Reuniões com clubes parceiros para definir escopo do MVP: contagem de público, heatmap de arquibancada e alertas.',
    severity: 'medium', type: 'research', status: 'analysis', assignee: 'Guilherme Lima', dueDate: iso(5),
  },
  {
    title: 'Testes E2E do fluxo de cadastro de faces',
    description: 'Cobrir cenários de regressão com Playwright: upload, recorte, duplicidade e exclusão (LGPD).',
    severity: 'medium', type: 'feature', status: 'review', assignee: 'Guilherme Lima',
  },
  {
    title: 'Protótipo no Figma do novo onboarding de câmeras',
    description: 'Wireframes e teste de usabilidade com 5 integradores para reduzir o tempo de configuração inicial.',
    severity: 'low', type: 'research', status: 'analysis', assignee: 'Pedro Rosa', dueDate: iso(10),
  },
  {
    title: 'Relatório mensal consolidado de KPIs por unidade',
    description: 'Exportação CSV e painel no Power BI com indicadores de contagem, permanência e alertas.',
    severity: 'low', type: 'feature', status: 'backlog',
  },
  {
    title: 'PoC de leitura de placas (LPR) para KAyla Traffic',
    description: 'Avaliar viabilidade de OCR de placas Mercosul em câmeras de 2MP, comparando YOLO + CRNN vs. solução comercial.',
    severity: 'medium', type: 'research', status: 'backlog',
  },
  {
    title: 'Botão "Exportar vídeo" desalinhado no Safari',
    description: 'Layout quebra em telas menores que 768px. Detalhe cosmético, mas aparece na demo para cliente.',
    severity: 'low', type: 'bugfix', status: 'todo',
  },
  {
    title: 'Renovar certificado SSL e configurar alertas de expiração',
    description: 'Certificado do domínio de produção expira em 12 dias. Adicionar alerta no Grafana.',
    severity: 'high', type: 'chore', status: 'todo', dueDate: iso(3),
  },
  {
    title: 'Documentar API pública de eventos (webhooks)',
    description: 'Guia de integração para parceiros: payload JSON, autenticação por token e reenvio.',
    severity: 'low', type: 'docs', status: 'done', assignee: 'Pedro Rosa',
  },
  {
    title: 'Detecção de EPI (capacete e colete) para KAyla Industry',
    description: 'Treinar detector para capacete, colete e óculos. Meta: recall > 92% no dataset de validação.',
    severity: 'medium', type: 'feature', status: 'done', assignee: 'Guilherme Lima',
  },
  {
    title: 'Design system: tokens de cor e tipografia da marca',
    description: 'Paleta Roboyell (índigo, violeta, azul) e tipografia Sora/DM Sans aplicadas aos componentes.',
    severity: 'low', type: 'improvement', status: 'review', assignee: 'Pedro Rosa',
  },
];

export function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const EMPTY_COLUMNS = (): Record<Status, string[]> => ({
  backlog: [], analysis: [], todo: [], doing: [], review: [], done: [],
});

export function createSeedState(): BoardState {
  const tasks: Record<string, Task> = {};
  const columns = EMPTY_COLUMNS();
  const now = Date.now();
  ITEMS.forEach((item, i) => {
    const id = makeId();
    const team = item.team ?? classifyTeam(item.title, item.description).team;
    tasks[id] = { ...item, id, team, teamSource: item.teamSource ?? 'auto', createdAt: now - i * 3_600_000, updatedAt: now };
    columns[item.status].push(id);
  });
  return assignNumbers({ tasks, columns });
}
