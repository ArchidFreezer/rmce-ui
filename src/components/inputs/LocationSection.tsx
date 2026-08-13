import type { Location } from '../../types';
import { PillList } from '../PillList';
import { CheckboxGroup, type CheckboxOption } from './CheckboxGroup';

export interface LocationSectionProps {
  value: Location;
  onChange: (next: Location) => void;
  viewing?: boolean;
  climateGroupOptions: readonly CheckboxOption<string>[];
  climateSubGroupOptions: readonly CheckboxOption<string>[];
  featureOptions: readonly CheckboxOption<string>[];
  terrainOptions: readonly CheckboxOption<string>[];
  vegetationOptions: readonly CheckboxOption<string>[];
  waterBodyOptions: readonly CheckboxOption<string>[];
}

export function LocationSection({
  value,
  onChange,
  viewing = false,
  climateGroupOptions,
  climateSubGroupOptions,
  featureOptions,
  terrainOptions,
  vegetationOptions,
  waterBodyOptions,
}: LocationSectionProps) {
  return (
    <section style={{ marginTop: 12 }} aria-label="Location">
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
            onChange={(next) => onChange({ ...value, climateGroups: next as Location['climateGroups'] })}
            options={climateGroupOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Climate Sub Groups"
            value={value.climateSubGroups}
            onChange={(next) => onChange({ ...value, climateSubGroups: next as Location['climateSubGroups'] })}
            options={climateSubGroupOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Features"
            value={value.features}
            onChange={(next) => onChange({ ...value, features: next as Location['features'] })}
            options={featureOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Terrains"
            value={value.terrains}
            onChange={(next) => onChange({ ...value, terrains: next as Location['terrains'] })}
            options={terrainOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Vegetation"
            value={value.vegetation}
            onChange={(next) => onChange({ ...value, vegetation: next as Location['vegetation'] })}
            options={vegetationOptions}
            columns={3}
          />
          <CheckboxGroup<string>
            label="Water Sources"
            value={value.waterSources}
            onChange={(next) => onChange({ ...value, waterSources: next as Location['waterSources'] })}
            options={waterBodyOptions}
            columns={3}
          />
        </div>
      )}
    </section>
  );
}