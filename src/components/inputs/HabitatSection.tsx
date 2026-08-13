import type { Habitat as c } from '../../types';
import { PillList } from '../PillList';
import { CheckboxGroup, type CheckboxOption } from './CheckboxGroup';

export interface HabitatSectionProps {
  value: c;
  onChange: (next: c) => void;
  viewing?: boolean;
  climateGroupOptions: readonly CheckboxOption<string>[];
  climateSubGroupOptions: readonly CheckboxOption<string>[];
  featureOptions: readonly CheckboxOption<string>[];
  terrainOptions: readonly CheckboxOption<string>[];
  vegetationOptions: readonly CheckboxOption<string>[];
  waterBodyOptions: readonly CheckboxOption<string>[];
}

export function HabitatSection({
  value,
  onChange,
  viewing = false,
  climateGroupOptions,
  climateSubGroupOptions,
  featureOptions,
  terrainOptions,
  vegetationOptions,
  waterBodyOptions,
}: HabitatSectionProps) {
  return (
    <section style={{ marginTop: 12 }} aria-label="Habitat">
      {viewing ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 14 }}>Climate Tags</span>
          <PillList
            values={[
              ...value.climateGroups.map((item) => `Climate Group: ${item}`),
              ...value.climateSubGroups.map((item) => `Climate Sub Group: ${item}`),
            ]}
            emptyLabel="No climate tags"
          />
          <span style={{ fontSize: 14 }}>Environment Tags</span>
          <PillList
            values={[
              ...value.features.map((item) => `Feature: ${item}`),
              ...value.terrains.map((item) => `Terrain: ${item}`),
              ...value.vegetation.map((item) => `Vegetation: ${item}`),
              ...value.waterSources.map((item) => `Water Source: ${item}`),
            ]}
            emptyLabel="No environment tags"
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <CheckboxGroup<string>
            label="Climate Groups"
            value={value.climateGroups}
            onChange={(next) => onChange({ ...value, climateGroups: next as c['climateGroups'] })}
            options={climateGroupOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Climate Sub Groups"
            value={value.climateSubGroups}
            onChange={(next) => onChange({ ...value, climateSubGroups: next as c['climateSubGroups'] })}
            options={climateSubGroupOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Features"
            value={value.features}
            onChange={(next) => onChange({ ...value, features: next as c['features'] })}
            options={featureOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Terrains"
            value={value.terrains}
            onChange={(next) => onChange({ ...value, terrains: next as c['terrains'] })}
            options={terrainOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Vegetation"
            value={value.vegetation}
            onChange={(next) => onChange({ ...value, vegetation: next as c['vegetation'] })}
            options={vegetationOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Water Sources"
            value={value.waterSources}
            onChange={(next) => onChange({ ...value, waterSources: next as c['waterSources'] })}
            options={waterBodyOptions}
            columns={3}
          />
        </div>
      )}
    </section>
  );
}