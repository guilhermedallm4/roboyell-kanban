import type { CSSProperties } from 'react';
import { AlertOctagon, CalendarX2, X } from 'lucide-react';
import type { Filters, Task, TeamId } from '../types';
import { SEVERITIES, SEVERITY_BY_ID, TEAMS, TEAM_BY_ID, TYPES, TYPE_BY_ID } from '../lib/meta';
import { daysUntil, pluralize } from '../lib/format';
import { FilterMenu } from './FilterMenu';

interface FilterBarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  tasks: Task[];
  visibleCount: number;
}

function countBy<K extends string>(tasks: Task[], key: (t: Task) => K) {
  const out: Partial<Record<K, number>> = {};
  for (const t of tasks) out[key(t)] = (out[key(t)] ?? 0) + 1;
  return out;
}

export function FilterBar({ filters, onChange, tasks, visibleCount }: FilterBarProps) {
  const open = tasks.filter((t) => t.status !== 'done');
  const critical = open.filter((t) => t.severity === 'critical').length;
  const overdue = open.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0).length;
  const teamCounts = countBy(open, (t) => t.team);
  const active = filters.teams.length + filters.severities.length + filters.types.length + (filters.query ? 1 : 0);

  const toggleTeam = (team: TeamId) =>
    onChange({ ...filters, teams: filters.teams.includes(team) ? filters.teams.filter((t) => t !== team) : [...filters.teams, team] });

  return (
    <section className="toolbar" aria-label="Filtros e resumo">
      <div className="toolbar__filters">
        <FilterMenu label="Equipe" options={TEAMS} selected={filters.teams} counts={countBy(tasks, (t) => t.team)} onChange={(teams) => onChange({ ...filters, teams })} />
        <FilterMenu label="Severidade" options={SEVERITIES} selected={filters.severities} counts={countBy(tasks, (t) => t.severity)} onChange={(severities) => onChange({ ...filters, severities })} />
        <FilterMenu label="Tipo" options={TYPES} selected={filters.types} counts={countBy(tasks, (t) => t.type)} onChange={(types) => onChange({ ...filters, types })} />

        {filters.teams.map((id) => (
          <Chip key={id} color={TEAM_BY_ID[id].color} label={TEAM_BY_ID[id].label} onRemove={() => onChange({ ...filters, teams: filters.teams.filter((x) => x !== id) })} />
        ))}
        {filters.severities.map((id) => (
          <Chip key={id} color={SEVERITY_BY_ID[id].color} label={SEVERITY_BY_ID[id].label} onRemove={() => onChange({ ...filters, severities: filters.severities.filter((x) => x !== id) })} />
        ))}
        {filters.types.map((id) => (
          <Chip key={id} color={TYPE_BY_ID[id].color} label={TYPE_BY_ID[id].label} onRemove={() => onChange({ ...filters, types: filters.types.filter((x) => x !== id) })} />
        ))}
        {active > 0 && (
          <>
            <span className="toolbar__result" aria-live="polite">{pluralize(visibleCount, 'resultado', 'resultados')}</span>
            <button className="link" onClick={() => onChange({ query: '', teams: [], severities: [], types: [] })}>Limpar filtros</button>
          </>
        )}
      </div>

      <div className="toolbar__stats">
        <span className="stat" title="Tarefas não concluídas">{pluralize(open.length, 'aberta', 'abertas')}</span>
        {critical > 0 && (
          <button className="stat stat--crit" onClick={() => onChange({ ...filters, severities: ['critical'] })} title="Filtrar críticas">
            <AlertOctagon size={13} aria-hidden="true" /> {pluralize(critical, 'crítica', 'críticas')}
          </button>
        )}
        {overdue > 0 && (
          <span className="stat stat--late"><CalendarX2 size={13} aria-hidden="true" /> {pluralize(overdue, 'atrasada', 'atrasadas')}</span>
        )}
        {open.length > 0 && (
          <div className="dist" role="group" aria-label="Distribuição de tarefas abertas por equipe (clique para filtrar)">
            {TEAMS.filter((t) => teamCounts[t.id]).map((t) => (
              <button
                key={t.id}
                className={`dist__seg${filters.teams.includes(t.id) ? ' is-on' : ''}`}
                style={{ '--c': t.color, flexGrow: teamCounts[t.id] } as CSSProperties}
                onClick={() => toggleTeam(t.id)}
                title={`${t.label}: ${teamCounts[t.id]}`}
                aria-label={`${t.label}: ${teamCounts[t.id]} abertas`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Chip({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <span className="fchip" style={{ '--c': color } as CSSProperties}>
      {label}
      <button onClick={onRemove} aria-label={`Remover filtro ${label}`}><X size={12} /></button>
    </span>
  );
}
