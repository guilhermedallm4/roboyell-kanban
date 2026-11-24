import type { CSSProperties } from 'react';
import { Sparkles, RotateCcw, Info } from 'lucide-react';
import type { FieldSource, TeamId } from '../types';
import { TEAM_BY_ID } from '../lib/meta';
import { confidenceLabel, type TeamPrediction } from '../lib/classifier';

interface ClassifierPanelProps {
  prediction: TeamPrediction;
  hasText: boolean;
  currentTeam: TeamId;
  teamSource: FieldSource;
  onUseSuggestion: () => void;
}

export function ClassifierPanel({ prediction, hasText, currentTeam, teamSource, onUseSuggestion }: ClassifierPanelProps) {
  const top = prediction.fallback ? null : TEAM_BY_ID[prediction.team];
  const fallbackTeam = TEAM_BY_ID[prediction.team];
  const first = prediction.ranking[0];
  const alternatives = prediction.ranking.slice(1, 3).filter((c) => c.score > 0 && c.probability >= 0.01);
  const pct = Math.round(prediction.confidence * 100);
  const overridden = teamSource === 'manual' && !prediction.fallback && prediction.team !== currentTeam;

  return (
    <div className="ai" aria-live="polite">
      <div className="ai__head">
        <Sparkles size={14} aria-hidden="true" />
        <span>Classificação automática de equipe</span>
        <span
          className="ai__info"
          tabIndex={0}
          title="Analisa palavras-chave do título (peso maior) e da descrição. Quando você corrige a equipe manualmente, o classificador aprende com isso."
          aria-label="Como funciona: analisa palavras-chave do título e da descrição e aprende com correções manuais."
        >
          <Info size={13} />
        </span>
      </div>

      {!hasText && <p className="ai__muted">Digite o título e a descrição — a equipe é sugerida em tempo real.</p>}

      {hasText && !top && (
        <p className="ai__muted">
          Nenhuma palavra-chave reconhecida — encaminhada para triagem em <strong>{fallbackTeam.label}</strong>.
          Se souber a equipe, escolha abaixo: o classificador aprende com a sua escolha.
        </p>
      )}

      {hasText && top && first && (
        <>
          <div className="ai__result" style={{ '--c': top.color } as CSSProperties}>
            {top.icon && <top.icon size={18} aria-hidden="true" />}
            <strong>{top.label}</strong>
            <span className={`ai__conf ai__conf--${confidenceLabel(prediction.confidence)}`}>
              confiança {confidenceLabel(prediction.confidence)} · {pct}%
            </span>
          </div>
          <div className="meter" style={{ '--c': top.color } as CSSProperties} aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
          {(first.keywords.length > 0 || first.learned.length > 0) && (
            <div className="ai__kw">
              <span className="ai__muted">Baseado em:</span>
              {first.keywords.slice(0, 6).map((k) => <code key={k}>{k}</code>)}
              {first.learned.slice(0, 3).map((k) => <code key={`l-${k}`} className="learned" title="Aprendido com correções manuais">{k}</code>)}
            </div>
          )}
          {alternatives.length > 0 && (
            <ul className="ai__alts" aria-label="Outras equipes possíveis">
              {alternatives.map((c) => (
                <li key={c.team} style={{ '--c': TEAM_BY_ID[c.team].color } as CSSProperties}>
                  <span>{TEAM_BY_ID[c.team].label}</span>
                  <span className="meter meter--sm" aria-hidden="true"><span style={{ width: `${Math.round(c.probability * 100)}%` }} /></span>
                  <span className="ai__pct">{Math.round(c.probability * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
          {overridden && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onUseSuggestion}>
              <RotateCcw size={13} /> Usar sugestão ({top.label})
            </button>
          )}
        </>
      )}
    </div>
  );
}
