import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Meta } from '../lib/meta';

interface FilterMenuProps<K extends string> {
  label: string;
  options: Meta<K>[];
  selected: K[];
  counts?: Partial<Record<K, number>>;
  onChange: (next: K[]) => void;
}

/** Multi-select popover with checkboxes. Closes on outside click and Esc. */
export function FilterMenu<K extends string>({ label, options, selected, counts, onChange }: FilterMenuProps<K>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = (id: K) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div
      className="fmenu"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`btn btn--filter${selected.length ? ' btn--filter-on' : ''}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {selected.length > 0 && <span className="badge">{selected.length}</span>}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="fmenu__pop" id={menuId} role="group" aria-label={`Filtrar por ${label}`}>
          {options.map((o) => {
            const Icon = o.icon;
            const on = selected.includes(o.id);
            return (
              <label key={o.id} className={`fmenu__item${on ? ' is-on' : ''}`} style={{ '--c': o.color } as CSSProperties}>
                <input type="checkbox" checked={on} onChange={() => toggle(o.id)} />
                <span className="fmenu__check" aria-hidden="true">{on && <Check size={12} />}</span>
                {Icon ? <Icon size={14} className="fmenu__icon" aria-hidden="true" /> : <span className="choice__dot" aria-hidden="true" />}
                <span className="fmenu__label">{o.label}</span>
                {counts && <span className="fmenu__count">{counts[o.id] ?? 0}</span>}
              </label>
            );
          })}
          {selected.length > 0 && (
            <button type="button" className="link fmenu__clear" onClick={() => onChange([])}>Limpar seleção</button>
          )}
        </div>
      )}
    </div>
  );
}
