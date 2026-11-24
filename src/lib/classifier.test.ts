import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { FALLBACK_TEAM, buildFeedbackModel, classifyTeam, normalize, stem, suggestSeverity, suggestType } from './classifier';

const cases: [string, string, string][] = [
  ['Retreinar modelo de reconhecimento facial', 'Muitos falsos positivos com máscara e boné', 'ai'],
  ['Botão de exportar desalinhado no Safari', 'Layout quebra em telas menores que 768px', 'frontend'],
  ['Endpoint /cameras retorna erro 500', 'Query no PostgreSQL estoura timeout', 'backend'],
  ['Pipeline de CI/CD com GitHub Actions', 'Deploy automático em staging via Docker', 'devops'],
  ['KAyla superaquecendo na Jetson Nano', 'Temperatura passa de 80°C com 4 câmeras RTSP', 'embedded'],
  ['Testes E2E do fluxo de cadastro', 'Cobrir cenários de regressão com Playwright', 'qa'],
  ['Protótipo no Figma do novo onboarding', 'Wireframes e teste de usabilidade com 5 usuários', 'design'],
  ['Relatório mensal de contagem por loja', 'KPIs consolidados no Power BI e exportação CSV', 'data'],
  // Produto & Requisitos
  ['Levantamento de Requisitos', '', 'product'],
  ['Levantamento de requisitos do KAyla Agro', 'Reunião com o cliente para entender o escopo', 'product'],
  ['Definir roadmap do segundo semestre', '', 'product'],
  ['Escrever user stories e critérios de aceite', '', 'product'],
  ['Proposta comercial para prefeitura', 'Cronograma e orçamento', 'product'],
  // plural / variações
  ['Integrações com câmeras Hikvision', '', 'embedded'],
  ['Novos relatórios de permanência', '', 'data'],
  ['Ajustar servidores de homologação', 'Configurar nginx', 'devops'],
];

describe('classifyTeam', () => {
  it.each(cases)('"%s" → %s', (title, description, expected) => {
    const p = classifyTeam(title, description);
    expect(p.team).toBe(expected);
    expect(p.fallback).toBe(false);
  });

  it('always returns a team: no signal goes to triage', () => {
    const p = classifyTeam('Ajuste', 'Ver isso depois');
    expect(p.team).toBe(FALLBACK_TEAM);
    expect(p.fallback).toBe(true);
    expect(p.confidence).toBe(0);
  });

  it('tolerates typos in long words', () => {
    const p = classifyTeam('Levantamento de requisitso', '');
    expect(p.team).toBe('product');
    expect(p.ranking[0].keywords).toContain('requisito~');
  });

  it('is accent and case insensitive', () => {
    expect(normalize('Visão Computacional — INFERÊNCIA')).toBe('visao computacional inferencia');
  });

  it('stems plurals consistently', () => {
    expect(stem('requisitos')).toBe('requisito');
    expect(stem('integracoes')).toBe('integracao');
    expect(stem('servidores')).toBe('servidor');
    expect(stem('imagens')).toBe('imagem');
    expect(stem('status')).toBe('status');
  });

  it('learns from manual corrections', () => {
    const base = { description: '', severity: 'medium', type: 'feature', status: 'backlog', createdAt: 0, updatedAt: 0 } as const;
    const tasks: Task[] = [1, 2, 3].map((i) => ({
      ...base, id: String(i), title: `Configurar Nagios no cliente ${i}`, team: 'devops', teamSource: 'manual',
    }));
    expect(classifyTeam('Nagios sem coletar', '').fallback).toBe(true);
    const learned = classifyTeam('Nagios sem coletar', '', buildFeedbackModel(tasks));
    expect(learned.team).toBe('devops');
    expect(learned.fallback).toBe(false);
  });
});

describe('type & severity suggestions', () => {
  it('detects bugs', () => {
    expect(suggestType('Corrigir crash ao abrir câmera', '')?.value).toBe('bugfix');
  });
  it('detects research', () => {
    expect(suggestType('PoC de rastreamento multi-câmera', 'Avaliar viabilidade')?.value).toBe('research');
  });
  it('treats requirements gathering as research', () => {
    expect(suggestType('Levantamento de Requisitos', '')?.value).toBe('research');
  });
  it('detects critical severity', () => {
    expect(suggestSeverity('Sistema fora do ar', 'Todos os clientes afetados')?.value).toBe('critical');
  });
  it('critical signal wins over high hints', () => {
    expect(suggestSeverity('Login com erro em produção', 'Clientes sem acesso. Urgente.')?.value).toBe('critical');
  });
  it('returns null without signal', () => {
    expect(suggestSeverity('Ajuste', '')).toBeNull();
  });
});
