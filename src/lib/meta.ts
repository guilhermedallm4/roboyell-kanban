import {
  BarChart3,
  Bug,
  BookOpen,
  ClipboardList,
  Brain,
  Cloud,
  Cpu,
  FlaskConical,
  Microscope,
  Monitor,
  Palette,
  Recycle,
  Server,
  Sparkles,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Severity, Status, TaskType, TeamId } from '../types';

export interface Meta<K extends string> {
  id: K;
  label: string;
  /** Compact label for tight spaces like cards. */
  short?: string;
  color: string;
  description?: string;
  icon?: LucideIcon;
}

export const STATUSES: Meta<Status>[] = [
  { id: 'backlog', label: 'Backlog', color: '#8A93A6', description: 'Demandas ainda não priorizadas' },
  { id: 'analysis', label: 'Em análise', color: '#845AFF', description: 'Entendimento, escopo e estimativa' },
  { id: 'todo', label: 'A fazer', color: '#2286C8', description: 'Priorizado e com escopo definido' },
  { id: 'doing', label: 'Em execução', color: '#F08C2E', description: 'Alguém está trabalhando nisso agora' },
  { id: 'review', label: 'Em revisão / QA', color: '#D6458B', description: 'Code review, testes e homologação' },
  { id: 'done', label: 'Concluído', color: '#2E9D5B', description: 'Entregue e validado' },
];

/** Soft WIP limits — the column header warns when exceeded. */
export const WIP_LIMITS: Partial<Record<Status, number>> = { doing: 5, review: 4 };

export const SEVERITIES: Meta<Severity>[] = [
  { id: 'low', label: 'Baixa', color: '#2E9D5B' },
  { id: 'medium', label: 'Média', color: '#C98F00' },
  { id: 'high', label: 'Alta', color: '#E8681A' },
  { id: 'critical', label: 'Crítica', color: '#E0262B' },
];

export const TYPES: Meta<TaskType>[] = [
  { id: 'feature', label: 'Feature', color: '#7C4DFF', icon: Sparkles },
  { id: 'bugfix', label: 'Bugfix', color: '#E5484D', icon: Bug },
  { id: 'improvement', label: 'Melhoria', color: '#2286C8', icon: TrendingUp },
  { id: 'refactor', label: 'Refatoração', color: '#0F9D8A', icon: Recycle },
  { id: 'research', label: 'Pesquisa / PoC', color: '#9B59D0', icon: Microscope },
  { id: 'docs', label: 'Documentação', color: '#64748B', icon: BookOpen },
  { id: 'chore', label: 'Manutenção', color: '#D9822B', icon: Wrench },
];

export const TEAMS: Meta<TeamId>[] = [
  { id: 'ai', label: 'Inteligência Artificial', short: 'IA', color: '#7C4DFF', icon: Brain, description: 'Modelos, visão computacional, treinamento e inferência' },
  { id: 'frontend', label: 'Front-End', short: 'Front', color: '#2286C8', icon: Monitor, description: 'Interfaces web, dashboards e experiência no navegador' },
  { id: 'backend', label: 'Back-End', short: 'Back', color: '#0F9D8A', icon: Server, description: 'APIs, banco de dados, integrações e regras de negócio' },
  { id: 'devops', label: 'DevOps & Infra', short: 'DevOps', color: '#E07A1F', icon: Cloud, description: 'Deploy, CI/CD, nuvem, monitoramento e segurança de infra' },
  { id: 'embedded', label: 'Embarcados & Edge', short: 'Edge', color: '#B98A00', icon: Cpu, description: 'Hardware, câmeras, dispositivos de borda e firmware' },
  { id: 'qa', label: 'QA & Testes', short: 'QA', color: '#2E9D5B', icon: FlaskConical, description: 'Testes automatizados, regressão e homologação' },
  { id: 'design', label: 'UX/UI Design', short: 'UX/UI', color: '#D6458B', icon: Palette, description: 'Pesquisa com usuários, protótipos e design system' },
  { id: 'product', label: 'Produto & Requisitos', short: 'Produto', color: '#4338CA', icon: ClipboardList, description: 'Levantamento de requisitos, escopo, roadmap e triagem de demandas' },
  { id: 'data', label: 'Dados & BI', short: 'Dados', color: '#0090B8', icon: BarChart3, description: 'Relatórios, ETL, métricas e analytics' },
];

const byId = <K extends string>(list: Meta<K>[]) =>
  Object.fromEntries(list.map((m) => [m.id, m])) as Record<K, Meta<K>>;

export const STATUS_BY_ID = byId(STATUSES);
export const SEVERITY_BY_ID = byId(SEVERITIES);
export const TYPE_BY_ID = byId(TYPES);
export const TEAM_BY_ID = byId(TEAMS);

/** The only people who can be assigned to a task. */
export const ASSIGNEES = ['Guilherme Lima', 'Pedro Rosa'] as const;

export const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
