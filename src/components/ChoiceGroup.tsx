import type { CSSProperties, ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { Meta } from '../lib/meta';

interface ChoiceGroupProps<K extends string> {
  name: string;
  legend: ReactNode;
  options: Meta<K>[];
  value: K;
  onChange: (value: K) => void;
  /** Option the classifier recommends; gets a sparkle marker. */
  suggested?: K | null;
  variant?: 'pill' | 'tile';
  hint?: ReactNode;
}

/** Segmented control built on native radios, so arrow-key navigation and screen readers work out of the box. */
export function ChoiceGroup<K extends string>({
  name, legend, options, value, onChange, suggested, variant = 'pill', hint,
}: ChoiceGroupProps<K>) {
  return (
    <fieldset className={`choices choices--${variant}`}>
      <legend className="field__label">{legend}</legend>
      {hint}
      <div className="choices__list">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSuggested = suggested === opt.id;
          return (
            <label
              key={opt.id}
              className={`choice${value === opt.id ? ' choice--on' : ''}`}
              style={{ '--c': opt.color } as CSSProperties}
              title={opt.description}
            >
              <input type="radio" name={name} value={opt.id} checked={value === opt.id} onChange={() => onChange(opt.id)} />
              {Icon ? <Icon size={14} aria-hidden="true" /> : <span className="choice__dot" aria-hidden="true" />}
              <span className="choice__label">{opt.label}</span>
              {isSuggested && (
                <Sparkles size={12} className="choice__spark" aria-label="(sugerido)" />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
