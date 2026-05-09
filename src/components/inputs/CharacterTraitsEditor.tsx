import { useId } from 'react';
import type { CharacterTraits } from '../../types/base';

export interface CharacterTraitsEditorProps {
  value: CharacterTraits;
  onChange: (next: CharacterTraits) => void;
  disabled?: boolean;
  error?: string | undefined;
}

type TraitKey = keyof CharacterTraits;

const TRAIT_META: { key: TraitKey; label: string; tooltip: string }[] = [
  {
    key: 'caster',
    label: 'Caster',
    tooltip: 'The extent to which this resource relates to or requires the use of magic',
  },
  {
    key: 'combat',
    label: 'Combat',
    tooltip: 'The extent to which this resource relates to combat or offensive actions',
  },
  {
    key: 'information',
    label: 'Information',
    tooltip: 'The extent to which this resource relates to information gathering or knowledge',
  },
  {
    key: 'stealth',
    label: 'Stealth',
    tooltip: 'The extent to which this resource relates to being undetected or actions that are best performed while undetected',
  },
  {
    key: 'support',
    label: 'Support',
    tooltip: 'The extent to which this resource aids other party members either in or out of combat without directly impacting enemies',
  },
  {
    key: 'utility',
    label: 'Utility',
    tooltip: 'The extent to which this, typically active, resource manipulates the state of the world to assist the party',
  },
];

export function CharacterTraitsEditor({ value, onChange, disabled = false, error }: CharacterTraitsEditorProps) {
  const baseId = useId();

  const handleChange = (key: TraitKey, raw: string) => {
    const n = parseInt(raw, 10);
    const clamped = Number.isFinite(n) ? Math.min(9, Math.max(1, n)) : value[key];
    onChange({ ...value, [key]: clamped });
  };

  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
      <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 4px' }}>Character Traits</legend>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TRAIT_META.length}, auto)`, gap: '8px 16px', alignItems: 'start' }}>
        {TRAIT_META.map(({ key, label, tooltip }) => {
          const inputId = `${baseId}-${key}`;
          return (
            <div key={key} title={tooltip} style={{ display: 'grid', gap: 4 }}>
              <label htmlFor={inputId} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{label}</label>
              <input
                id={inputId}
                type="number"
                min={1}
                max={9}
                step={1}
                value={value[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={disabled}
                aria-label={label}
                title={tooltip}
                style={{ width: 56, padding: '4px 6px', textAlign: 'center' }}
              />
            </div>
          );
        })}
      </div>
      {error && <div style={{ color: '#b00020', marginTop: 6, fontSize: 13 }}>{error}</div>}
    </fieldset>
  );
}
