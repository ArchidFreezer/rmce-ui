import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchAnimals,
  upsertAnimal,
  deleteAnimal,
  fetchArmourTypes,
  fetchAttackTables,
  fetchClimates,
  fetchCreaturePaces,
  fetchDiseases,
  fetchPoisons,
  fetchSpecialAttackTables,
  fetchTreasureCodes,
} from '../../api';

import {
  CheckboxGroup,
  CheckboxInput,
  DataTable,
  type DataTableHandle,
  DataTableSearchInput,
  type ColumnDef,
  IdListEditor,
  LabeledInput,
  LabeledSelect,
  MarkupPreview,
  PillList,
  Spinner,
  useConfirm,
  useToast,
} from '../../components';

import type {
  Animal,
  AnimalAttackBase,
  AnimalConditionalAttack,
  AnimalGroupAttack,
  AnimalRangedAttack,
  AnimalStandardAttack,
  ArmourType,
  AttackTable,
  Climate,
  CreaturePace,
  Disease,
  Poison,
  SpecialAttackTable,
  TreasureCode,
} from '../../types';

import {
  ANIMAL_OUTLOOK_TYPES,
  ATTACK_SIZE_TYPES,
  CREATURE_BONUS_XP_TYPES,
  CREATURE_CONSTITUTION_VARIANCE_TYPES,
  CREATURE_MOVEMENT_SPEED_TYPES,
  CREATURE_SIZES,
  CRITICAL_MODIFIER_TYPES,
  CRITICAL_SIZE_TABLE_TYPES,
  CRITICAL_SIZES,
  CRITICAL_TYPES,
  ENVIRONMENT_FEATURES,
  ENVIRONMENT_TERRAINS,
  ENVIRONMENT_VEGETATIONS,
  ENVIRONMENT_WATER_BODIES,
  LEVEL_VARIANCE_TYPES,
  type AnimalOutlookType,
  type AttackSizeType,
  type CreatureBonusXpType,
  type CreatureConstitutionVarianceType,
  type CreatureMovementSpeedType,
  type CreatureSize,
  type CriticalModifierType,
  type CriticalSize,
  type CriticalSizeTableType,
  type CriticalType,
  type EnvironmentFeature,
  type EnvironmentTerrain,
  type EnvironmentVegetation,
  type EnvironmentWaterBody,
  type LevelVarianceType,
} from '../../types/enum';

import {
  isValidID,
  isValidSignedInt,
  isValidUnsignedInt,
  makeIDOnChange,
  sanitizeSignedInt,
  sanitizeUnsignedInt,
} from '../../utils';

const prefix = 'ANIMAL_';

type AttackKind = 'standard' | 'ranged' | 'conditional' | 'group';

type AttackBaseVM = {
  offensiveBonus: string;
  weaponAttack: string;
  nonWeaponAttackTable: string;
  nonWeaponAttackSize: string;
  useAllAttacks: boolean;
  attacksPerRound: string;
  special: string;
  poison: string;
  disease: string;
  autoCriticalType: string;
  autoCriticalSize: string;
  sameRoundConditionalAttackId: string;
  nextRoundConditionalAttackId: string;
};

type StandardAttackVM = AttackBaseVM & {
  chanceMin: string;
  chanceMax: string;
};

type RangedAttackVM = AttackBaseVM & {
  range: string;
};

type ConditionalAttackVM = AttackBaseVM & {
  id: string;
};

type GroupAttackVM = AttackBaseVM & {
  minGroupSize: string;
};

type FormState = {
  id: string;
  name: string;
  description: string;
  frequencyCode: string;
  bonusXpCode: CreatureBonusXpType;
  constitutionVarianceType: CreatureConstitutionVarianceType;
  levelVarianceType: LevelVarianceType;
  treasureCode: string;
  size: CreatureSize;
  armourType: string;
  movementSpeed: CreatureMovementSpeedType;
  attackQuickness: CreatureMovementSpeedType;
  maxPace: string;
  outlook: AnimalOutlookType;
  criticalTable: CriticalSizeTableType;
  criticalModifiers: CriticalModifierType[];
  locationFeatures: EnvironmentFeature[];
  locationTerrains: EnvironmentTerrain[];
  locationVegetation: EnvironmentVegetation[];
  locationWaterSources: EnvironmentWaterBody[];
  locationClimates: string[];
  standardAttacks: StandardAttackVM[];
  rangedAttacks: RangedAttackVM[];
  conditionalAttacks: ConditionalAttackVM[];
  groupAttacks: GroupAttackVM[];
};

type FormErrors = {
  id?: string | undefined;
  name?: string | undefined;
  frequencyCode?: string | undefined;
  standardAttacks?: string | undefined;
  rangedAttacks?: string | undefined;
  conditionalAttacks?: string | undefined;
  groupAttacks?: string | undefined;
};

const emptyAttackBase = (): AttackBaseVM => ({
  offensiveBonus: '',
  weaponAttack: '',
  nonWeaponAttackTable: '',
  nonWeaponAttackSize: '',
  useAllAttacks: false,
  attacksPerRound: '1',
  special: '',
  poison: '',
  disease: '',
  autoCriticalType: '',
  autoCriticalSize: '',
  sameRoundConditionalAttackId: '',
  nextRoundConditionalAttackId: '',
});

const createEmptyAttack = (kind: AttackKind): StandardAttackVM | RangedAttackVM | ConditionalAttackVM | GroupAttackVM => {
  const base = emptyAttackBase();
  switch (kind) {
    case 'standard':
      return { ...base, chanceMin: '', chanceMax: '' };
    case 'ranged':
      return { ...base, range: '' };
    case 'conditional':
      return { ...base, id: '' };
    case 'group':
      return { ...base, minGroupSize: '' };
  }
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  description: '',
  frequencyCode: '',
  bonusXpCode: 'None',
  constitutionVarianceType: 'None',
  levelVarianceType: 'None',
  treasureCode: '',
  size: 'Medium',
  armourType: '',
  movementSpeed: 'Medium',
  attackQuickness: 'Medium',
  maxPace: '',
  outlook: 'Normal',
  criticalTable: 'Normal',
  criticalModifiers: [],
  locationFeatures: [],
  locationTerrains: [],
  locationVegetation: [],
  locationWaterSources: [],
  locationClimates: [],
  standardAttacks: [],
  rangedAttacks: [],
  conditionalAttacks: [],
  groupAttacks: [],
});

function toAttackBaseVM<T extends AnimalAttackBase>(x: T): AttackBaseVM {
  return {
    offensiveBonus: String(x.offensiveBonus),
    weaponAttack: x.weaponAttack ?? '',
    nonWeaponAttackTable: x.nonWeaponAttack?.table ?? '',
    nonWeaponAttackSize: x.nonWeaponAttack?.size ?? '',
    useAllAttacks: !!x.useAllAttacks,
    attacksPerRound: String(x.attacksPerRound),
    special: x.special ?? '',
    poison: x.poison ?? '',
    disease: x.disease ?? '',
    autoCriticalType: x.autoCriticalType ?? '',
    autoCriticalSize: x.autoCriticalSize ?? '',
    sameRoundConditionalAttackId: x.sameRoundConditionalAttackId != null ? String(x.sameRoundConditionalAttackId) : '',
    nextRoundConditionalAttackId: x.nextRoundConditionalAttackId != null ? String(x.nextRoundConditionalAttackId) : '',
  };
}

const toVM = (x: Animal): FormState => ({
  id: x.id,
  name: x.name,
  description: x.description ?? '',
  frequencyCode: String(x.frequencyCode),
  bonusXpCode: x.bonusXpCode,
  constitutionVarianceType: x.constitutionVarianceType,
  levelVarianceType: x.levelVarianceType,
  treasureCode: x.treasureCode ?? '',
  size: x.size,
  armourType: x.armourType ?? '',
  movementSpeed: x.movementSpeed,
  attackQuickness: x.attackQuickness,
  maxPace: x.maxPace ?? '',
  outlook: x.outlook,
  criticalTable: x.criticalTable,
  criticalModifiers: x.criticalModifiers ?? [],
  locationFeatures: x.location?.features ?? [],
  locationTerrains: x.location?.terrains ?? [],
  locationVegetation: x.location?.vegetation ?? [],
  locationWaterSources: x.location?.waterSources ?? [],
  locationClimates: x.location?.climates ?? [],
  standardAttacks: (x.standardAttacks ?? []).map((attack) => ({
    ...toAttackBaseVM(attack),
    chanceMin: String(attack.chanceMin),
    chanceMax: String(attack.chanceMax),
  })),
  rangedAttacks: (x.rangedAttacks ?? []).map((attack) => ({
    ...toAttackBaseVM(attack),
    range: String(attack.range),
  })),
  conditionalAttacks: (x.conditionalAttacks ?? []).map((attack) => ({
    ...toAttackBaseVM(attack),
    id: String(attack.id),
  })),
  groupAttacks: (x.groupAttacks ?? []).map((attack) => ({
    ...toAttackBaseVM(attack),
    minGroupSize: String(attack.minGroupSize),
  })),
});

function fromAttackBaseVM<T extends AttackBaseVM>(x: T): AnimalAttackBase {
  return {
    offensiveBonus: Number(x.offensiveBonus),
    weaponAttack: x.weaponAttack || undefined,
    nonWeaponAttack: x.nonWeaponAttackTable
      ? {
        table: x.nonWeaponAttackTable,
        size: x.nonWeaponAttackSize as AttackSizeType,
      }
      : undefined,
    useAllAttacks: !!x.useAllAttacks,
    attacksPerRound: Number(x.attacksPerRound),
    special: x.special.trim() || undefined,
    poison: x.poison || undefined,
    disease: x.disease || undefined,
    autoCriticalType: (x.autoCriticalType || undefined) as CriticalType | undefined,
    autoCriticalSize: (x.autoCriticalSize || undefined) as CriticalSize | undefined,
    sameRoundConditionalAttackId: x.sameRoundConditionalAttackId ? Number(x.sameRoundConditionalAttackId) : undefined,
    nextRoundConditionalAttackId: x.nextRoundConditionalAttackId ? Number(x.nextRoundConditionalAttackId) : undefined,
  };
}

const fromVM = (vm: FormState): Animal => {
  const hasLocation =
    vm.locationFeatures.length > 0 ||
    vm.locationTerrains.length > 0 ||
    vm.locationVegetation.length > 0 ||
    vm.locationWaterSources.length > 0 ||
    vm.locationClimates.length > 0;

  return {
    id: vm.id.trim(),
    name: vm.name.trim(),
    description: vm.description.trim() || undefined,
    frequencyCode: Number(vm.frequencyCode),
    bonusXpCode: vm.bonusXpCode,
    constitutionVarianceType: vm.constitutionVarianceType,
    levelVarianceType: vm.levelVarianceType,
    treasureCode: vm.treasureCode || undefined,
    size: vm.size,
    armourType: vm.armourType || undefined,
    movementSpeed: vm.movementSpeed,
    attackQuickness: vm.attackQuickness,
    maxPace: vm.maxPace || undefined,
    outlook: vm.outlook,
    criticalTable: vm.criticalTable,
    criticalModifiers: vm.criticalModifiers.slice(),
    location: hasLocation
      ? {
        features: vm.locationFeatures.slice(),
        terrains: vm.locationTerrains.slice(),
        vegetation: vm.locationVegetation.slice(),
        waterSources: vm.locationWaterSources.slice(),
        climates: vm.locationClimates.slice(),
      }
      : undefined,
    standardAttacks: vm.standardAttacks.map((attack) => ({
      ...fromAttackBaseVM(attack),
      chanceMin: Number(attack.chanceMin),
      chanceMax: Number(attack.chanceMax),
    })),
    rangedAttacks: vm.rangedAttacks.map((attack) => ({
      ...fromAttackBaseVM(attack),
      range: Number(attack.range),
    })),
    conditionalAttacks: vm.conditionalAttacks.map((attack) => ({
      ...fromAttackBaseVM(attack),
      id: Number(attack.id),
    })),
    groupAttacks: vm.groupAttacks.map((attack) => ({
      ...fromAttackBaseVM(attack),
      minGroupSize: Number(attack.minGroupSize),
    })),
  };
};

function patchRow<T>(rows: T[], index: number, patch: Partial<T>): T[] {
  const copy = rows.slice();
  const current = copy[index];
  if (!current) return rows;
  copy[index] = { ...current, ...patch };
  return copy;
}

export default function AnimalView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [armours, setArmours] = useState<ArmourType[]>([]);
  const [attackTables, setAttackTables] = useState<AttackTable[]>([]);
  const [climates, setClimates] = useState<Climate[]>([]);
  const [paces, setPaces] = useState<CreaturePace[]>([]);
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [poisons, setPoisons] = useState<Poison[]>([]);
  const [specialAttackTables, setSpecialAttackTables] = useState<SpecialAttackTable[]>([]);
  const [treasureCodes, setTreasureCodes] = useState<TreasureCode[]>([]);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());
  const [previewDescription, setPreviewDescription] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    (async () => {
      try {
        const [animals, armourRows, attackRows, climateRows, paceRows, diseaseRows, poisonRows, specialRows, treasureRows] = await Promise.all([
          fetchAnimals(),
          fetchArmourTypes(),
          fetchAttackTables(),
          fetchClimates(),
          fetchCreaturePaces(),
          fetchDiseases(),
          fetchPoisons(),
          fetchSpecialAttackTables(),
          fetchTreasureCodes(),
        ]);
        setRows(animals);
        setArmours(armourRows);
        setAttackTables(attackRows);
        setClimates(climateRows);
        setPaces(paceRows);
        setDiseases(diseaseRows);
        setPoisons(poisonRows);
        setSpecialAttackTables(specialRows);
        setTreasureCodes(treasureRows);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const armourNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of armours) map.set(row.id, row.name);
    return map;
  }, [armours]);

  const paceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of paces) map.set(row.id, row.name);
    return map;
  }, [paces]);

  const treasureNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of treasureCodes) map.set(row.id, row.id);
    return map;
  }, [treasureCodes]);

  const armourOptions = useMemo(
    () => armours.map((row) => ({ value: row.id, label: `${row.name} (${row.type})` })),
    [armours],
  );
  const attackTableOptions = useMemo(
    () => attackTables.map((row) => ({ value: row.id, label: row.name })),
    [attackTables],
  );
  const climateOptions = useMemo(
    () => climates.map((row) => ({ value: row.id, label: row.name })),
    [climates],
  );
  const paceOptions = useMemo(
    () => paces.map((row) => ({ value: row.id, label: row.name })),
    [paces],
  );
  const diseaseOptions = useMemo(
    () => diseases.map((row) => ({ value: row.id, label: row.name })),
    [diseases],
  );
  const poisonOptions = useMemo(
    () => poisons.map((row) => ({ value: row.id, label: row.name })),
    [poisons],
  );
  const specialAttackTableOptions = useMemo(
    () => specialAttackTables.map((row) => ({ value: row.id, label: row.name })),
    [specialAttackTables],
  );
  const treasureCodeOptions = useMemo(
    () => treasureCodes.map((row) => ({ value: row.id, label: row.id })),
    [treasureCodes],
  );

  const bonusXpOptions = useMemo(() => CREATURE_BONUS_XP_TYPES.map((value) => ({ value, label: value })), []);
  const constitutionVarianceOptions = useMemo(() => CREATURE_CONSTITUTION_VARIANCE_TYPES.map((value) => ({ value, label: value })), []);
  const levelVarianceOptions = useMemo(() => LEVEL_VARIANCE_TYPES.map((value) => ({ value, label: value })), []);
  const sizeOptions = useMemo(() => CREATURE_SIZES.map((value) => ({ value, label: value })), []);
  const movementSpeedOptions = useMemo(() => CREATURE_MOVEMENT_SPEED_TYPES.map((value) => ({ value, label: value })), []);
  const outlookOptions = useMemo(() => ANIMAL_OUTLOOK_TYPES.map((value) => ({ value, label: value })), []);
  const criticalTableOptions = useMemo(() => CRITICAL_SIZE_TABLE_TYPES.map((value) => ({ value, label: value })), []);
  const criticalModifierOptions = useMemo(() => CRITICAL_MODIFIER_TYPES.map((value) => ({ value, label: value })), []);
  const attackSizeOptions = useMemo(() => ATTACK_SIZE_TYPES.map((value) => ({ value, label: value })), []);
  const criticalTypeOptions = useMemo(() => CRITICAL_TYPES.map((value) => ({ value, label: value })), []);
  const criticalSizeOptions = useMemo(() => CRITICAL_SIZES.map((value) => ({ value, label: value })), []);
  const featureOptions = useMemo(() => ENVIRONMENT_FEATURES.map((value) => ({ value, label: value })), []);
  const terrainOptions = useMemo(() => ENVIRONMENT_TERRAINS.map((value) => ({ value, label: value })), []);
  const vegetationOptions = useMemo(() => ENVIRONMENT_VEGETATIONS.map((value) => ({ value, label: value })), []);
  const waterBodyOptions = useMemo(() => ENVIRONMENT_WATER_BODIES.map((value) => ({ value, label: value })), []);

  const validateAttackBase = (label: string, row: AttackBaseVM, conditionalIds: Set<number>): string | undefined => {
    if (!isValidSignedInt(row.offensiveBonus)) {
      return `${label}: offensive bonus must be an integer`;
    }
    if (!isValidUnsignedInt(row.attacksPerRound) || Number(row.attacksPerRound) <= 0) {
      return `${label}: attacks per round must be a positive integer`;
    }
    if (!row.weaponAttack && !row.nonWeaponAttackTable) {
      return `${label}: select either a weapon attack or a non-weapon attack table`;
    }
    if (row.nonWeaponAttackTable && !row.nonWeaponAttackSize) {
      return `${label}: non-weapon attack size is required when a non-weapon attack table is selected`;
    }
    if ((row.autoCriticalType && !row.autoCriticalSize) || (!row.autoCriticalType && row.autoCriticalSize)) {
      return `${label}: auto critical type and size must either both be set or both be empty`;
    }
    if (row.sameRoundConditionalAttackId) {
      if (!isValidUnsignedInt(row.sameRoundConditionalAttackId) || Number(row.sameRoundConditionalAttackId) <= 0) {
        return `${label}: same-round conditional attack id must be a positive integer`;
      }
      if (!conditionalIds.has(Number(row.sameRoundConditionalAttackId))) {
        return `${label}: same-round conditional attack id must reference an existing conditional attack`;
      }
    }
    if (row.nextRoundConditionalAttackId) {
      if (!isValidUnsignedInt(row.nextRoundConditionalAttackId) || Number(row.nextRoundConditionalAttackId) <= 0) {
        return `${label}: next-round conditional attack id must be a positive integer`;
      }
      if (!conditionalIds.has(Number(row.nextRoundConditionalAttackId))) {
        return `${label}: next-round conditional attack id must reference an existing conditional attack`;
      }
    }
    return undefined;
  };

  const computeErrors = (draft: FormState): FormErrors => {
    const next: FormErrors = {};

    const id = draft.id.trim();
    if (!id) next.id = 'ID is required';
    else if (!editingId && rows.some((row) => row.id === id)) next.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) next.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!draft.name.trim()) next.name = 'Name is required';

    if (!isValidUnsignedInt(draft.frequencyCode)) {
      next.frequencyCode = 'Frequency code must be an integer from 1 to 9';
    } else {
      const value = Number(draft.frequencyCode);
      if (value < 1 || value > 9) next.frequencyCode = 'Frequency code must be an integer from 1 to 9';
    }

    const conditionalIdSet = new Set<number>();
    for (let index = 0; index < draft.conditionalAttacks.length; index++) {
      const attack = draft.conditionalAttacks[index];
      if (!attack) continue;
      if (!isValidUnsignedInt(attack.id) || Number(attack.id) <= 0) {
        next.conditionalAttacks = `Conditional Attack ${index + 1}: id must be a positive integer`;
        break;
      }
      const attackId = Number(attack.id);
      if (conditionalIdSet.has(attackId)) {
        next.conditionalAttacks = `Conditional Attack ${index + 1}: id ${attackId} is duplicated`;
        break;
      }
      conditionalIdSet.add(attackId);
    }

    if (!next.conditionalAttacks) {
      for (let index = 0; index < draft.conditionalAttacks.length; index++) {
        const attack = draft.conditionalAttacks[index];
        if (!attack) continue;
        const message = validateAttackBase(`Conditional Attack ${index + 1}`, attack, conditionalIdSet);
        if (message) {
          next.conditionalAttacks = message;
          break;
        }
      }
    }

    for (let index = 0; index < draft.standardAttacks.length; index++) {
      const attack = draft.standardAttacks[index];
      if (!attack) continue;
      if (!isValidUnsignedInt(attack.chanceMin) || !isValidUnsignedInt(attack.chanceMax)) {
        next.standardAttacks = `Standard Attack ${index + 1}: chance range must use positive integers`;
        break;
      }
      const chanceMin = Number(attack.chanceMin);
      const chanceMax = Number(attack.chanceMax);
      if (chanceMin < 1 || chanceMax > 100 || chanceMin > chanceMax) {
        next.standardAttacks = `Standard Attack ${index + 1}: chance range must be between 1 and 100 and min cannot exceed max`;
        break;
      }
      const message = validateAttackBase(`Standard Attack ${index + 1}`, attack, conditionalIdSet);
      if (message) {
        next.standardAttacks = message;
        break;
      }
    }

    for (let index = 0; index < draft.rangedAttacks.length; index++) {
      const attack = draft.rangedAttacks[index];
      if (!attack) continue;
      if (!isValidUnsignedInt(attack.range) || Number(attack.range) <= 0) {
        next.rangedAttacks = `Ranged Attack ${index + 1}: range must be a positive integer`;
        break;
      }
      const message = validateAttackBase(`Ranged Attack ${index + 1}`, attack, conditionalIdSet);
      if (message) {
        next.rangedAttacks = message;
        break;
      }
    }

    for (let index = 0; index < draft.groupAttacks.length; index++) {
      const attack = draft.groupAttacks[index];
      if (!attack) continue;
      if (!isValidUnsignedInt(attack.minGroupSize) || Number(attack.minGroupSize) <= 0) {
        next.groupAttacks = `Group Attack ${index + 1}: minimum group size must be a positive integer`;
        break;
      }
      const message = validateAttackBase(`Group Attack ${index + 1}`, attack, conditionalIdSet);
      if (message) {
        next.groupAttacks = message;
        break;
      }
    }

    return next;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  const columns: ColumnDef<Animal>[] = [
    { id: 'id', header: 'ID', accessor: (row) => row.id, minWidth: 260 },
    { id: 'name', header: 'Name', accessor: (row) => row.name, minWidth: 180 },
    { id: 'size', header: 'Size', accessor: (row) => row.size, minWidth: 120 },
    { id: 'outlook', header: 'Outlook', accessor: (row) => row.outlook, minWidth: 150 },
    { id: 'frequencyCode', header: 'Frequency', accessor: (row) => row.frequencyCode, minWidth: 100 },
    {
      id: 'actions',
      header: 'Actions',
      sortable: false,
      width: 360,
      render: (row) => (
        <>
          <button onClick={() => startView(row)}>View</button>
          <button onClick={() => startEdit(row)}>Edit</button>
          <button onClick={() => startDuplicate(row)}>Duplicate</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
  ];

  const globalFilter = (row: Animal, q: string) =>
    [row.id, row.name, row.description ?? '', row.outlook, row.size]
      .some((value) => String(value).toLowerCase().includes(q.toLowerCase()));

  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyVM());
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: Animal) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Animal) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Animal) => {
    setViewing(false);
    setEditingId(null);
    const vm = toVM(row);
    vm.id = prefix;
    vm.name += ' (Copy)';
    setForm(vm);
    setErrors({});
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setViewing(false);
    setEditingId(null);
    setErrors({});
  };

  const saveForm = async () => {
    if (submitting) return;

    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    const payload = fromVM(form);
    const isEditing = Boolean(editingId);

    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };
      await upsertAnimal(payload, opts);

      setRows((prev) => {
        if (isEditing) {
          const index = prev.findIndex((row) => row.id === payload.id);
          if (index >= 0) {
            const copy = prev.slice();
            copy[index] = { ...copy[index], ...payload };
            return copy;
          }
        }
        return [payload, ...prev];
      });

      setShowForm(false);
      setViewing(false);
      setEditingId(null);

      toast({
        variant: 'success',
        title: isEditing ? 'Updated' : 'Saved',
        description: `Animal "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (row: Animal) => {
    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Animal',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });

    if (!ok) {
      setSubmitting(false);
      return;
    }

    const previous = rows;
    setRows((current) => current.filter((item) => item.id !== row.id));
    setPage(1);

    try {
      await deleteAnimal(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Animal "${row.id}" deleted.` });
    } catch (err) {
      setRows(previous);
      toast({
        variant: 'danger',
        title: 'Delete failed',
        description: String(err instanceof Error ? err.message : err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderAttackSection = (
    title: string,
    kind: AttackKind,
    rowsValue: Array<StandardAttackVM | RangedAttackVM | ConditionalAttackVM | GroupAttackVM>,
    onChangeRows: (next: Array<StandardAttackVM | RangedAttackVM | ConditionalAttackVM | GroupAttackVM>) => void,
    errorText?: string,
  ) => {
    const addRow = () => onChangeRows([...rowsValue, createEmptyAttack(kind)]);
    const removeRow = (index: number) => onChangeRows(rowsValue.filter((_, rowIndex) => rowIndex !== index));
    const updateRow = (index: number, patch: Partial<StandardAttackVM | RangedAttackVM | ConditionalAttackVM | GroupAttackVM>) => {
      onChangeRows(patchRow(rowsValue, index, patch));
    };

    return (
      <section style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h4 style={{ margin: '8px 0' }}>{title}</h4>
          {!viewing && (
            <button type="button" onClick={addRow}>
              {`+ Add ${title.slice(0, -1).toLowerCase()}`}
            </button>
          )}
        </div>

        {!rowsValue.length && (
          <div style={{ color: 'var(--muted)' }}>
            No {title.toLowerCase()} configured.
          </div>
        )}

        {rowsValue.map((row, index) => (
          <div
            key={`${title}-${index}`}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
              marginTop: 12,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <strong>{title.slice(0, -1)} {index + 1}</strong>
              {!viewing && (
                <button type="button" onClick={() => removeRow(index)} style={{ color: '#b00020' }}>
                  Remove
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {kind === 'standard' && (
                <>
                  <LabeledInput
                    label="Chance Min"
                    value={(row as StandardAttackVM).chanceMin}
                    onChange={(value) => updateRow(index, { chanceMin: sanitizeUnsignedInt(value) } as Partial<StandardAttackVM>)}
                    disabled={viewing}
                  />
                  <LabeledInput
                    label="Chance Max"
                    value={(row as StandardAttackVM).chanceMax}
                    onChange={(value) => updateRow(index, { chanceMax: sanitizeUnsignedInt(value) } as Partial<StandardAttackVM>)}
                    disabled={viewing}
                  />
                </>
              )}
              {kind === 'ranged' && (
                <LabeledInput
                  label="Range"
                  value={(row as RangedAttackVM).range}
                  onChange={(value) => updateRow(index, { range: sanitizeUnsignedInt(value) } as Partial<RangedAttackVM>)}
                  disabled={viewing}
                />
              )}
              {kind === 'conditional' && (
                <LabeledInput
                  label="ID"
                  value={(row as ConditionalAttackVM).id}
                  onChange={(value) => updateRow(index, { id: sanitizeUnsignedInt(value) } as Partial<ConditionalAttackVM>)}
                  disabled={viewing}
                />
              )}
              {kind === 'group' && (
                <LabeledInput
                  label="Min Group Size"
                  value={(row as GroupAttackVM).minGroupSize}
                  onChange={(value) => updateRow(index, { minGroupSize: sanitizeUnsignedInt(value) } as Partial<GroupAttackVM>)}
                  disabled={viewing}
                />
              )}
              <LabeledInput
                label="Offensive Bonus"
                value={row.offensiveBonus}
                onChange={(value) => updateRow(index, { offensiveBonus: sanitizeSignedInt(value) })}
                disabled={viewing}
              />
              <LabeledInput
                label="Attacks Per Round"
                value={row.attacksPerRound}
                onChange={(value) => updateRow(index, { attacksPerRound: sanitizeUnsignedInt(value) })}
                disabled={viewing}
              />
            </div>

            <CheckboxInput
              label="Use All Attacks"
              checked={row.useAllAttacks}
              onChange={(checked) => updateRow(index, { useAllAttacks: checked })}
              disabled={viewing}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <LabeledSelect
                label="Weapon Attack"
                value={row.weaponAttack}
                onChange={(value) => updateRow(index, { weaponAttack: value })}
                options={attackTableOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Non-Weapon Attack Table"
                value={row.nonWeaponAttackTable}
                onChange={(value) => updateRow(index, { nonWeaponAttackTable: value })}
                options={specialAttackTableOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Non-Weapon Attack Size"
                value={row.nonWeaponAttackSize}
                onChange={(value) => updateRow(index, { nonWeaponAttackSize: value })}
                options={attackSizeOptions}
                disabled={viewing}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <LabeledSelect
                label="Poison"
                value={row.poison}
                onChange={(value) => updateRow(index, { poison: value })}
                options={poisonOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Disease"
                value={row.disease}
                onChange={(value) => updateRow(index, { disease: value })}
                options={diseaseOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Auto Critical Type"
                value={row.autoCriticalType}
                onChange={(value) => updateRow(index, { autoCriticalType: value })}
                options={criticalTypeOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Auto Critical Size"
                value={row.autoCriticalSize}
                onChange={(value) => updateRow(index, { autoCriticalSize: value })}
                options={criticalSizeOptions}
                disabled={viewing}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <LabeledInput
                label="Same Round Conditional Attack ID"
                value={row.sameRoundConditionalAttackId}
                onChange={(value) => updateRow(index, { sameRoundConditionalAttackId: sanitizeUnsignedInt(value) })}
                disabled={viewing}
              />
              <LabeledInput
                label="Next Round Conditional Attack ID"
                value={row.nextRoundConditionalAttackId}
                onChange={(value) => updateRow(index, { nextRoundConditionalAttackId: sanitizeUnsignedInt(value) })}
                disabled={viewing}
              />
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Special</span>
              <textarea
                value={row.special}
                onChange={(e) => updateRow(index, { special: e.target.value })}
                disabled={viewing}
                rows={4}
              />
            </label>
          </div>
        ))}

        {errorText && !viewing && (
          <div style={{ color: '#b00020', marginTop: 8 }}>{errorText}</div>
        )}
      </section>
    );
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <>
      <h2>Animals</h2>

      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Animal</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search animals…"
            aria-label="Search animals"
          />
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {showForm && (
        <div className="form-container">
          {submitting && (
            <div className="overlay">
              <Spinner size={24} />
              <span>Saving…</span>
            </div>
          )}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Animal</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput
                label="ID"
                value={form.id}
                onChange={makeIDOnChange<typeof form>('id', setForm, prefix)}
                disabled={!!editingId || viewing}
                error={viewing ? undefined : errors.id}
              />
              <LabeledInput
                label="Name"
                value={form.name}
                onChange={(value) => setForm((state) => ({ ...state, name: value }))}
                disabled={viewing}
                error={viewing ? undefined : errors.name}
              />
              <LabeledInput
                label="Frequency Code"
                value={form.frequencyCode}
                onChange={(value) => setForm((state) => ({ ...state, frequencyCode: sanitizeUnsignedInt(value) }))}
                disabled={viewing}
                error={viewing ? undefined : errors.frequencyCode}
              />
              <LabeledSelect
                label="Bonus XP Code"
                value={form.bonusXpCode}
                onChange={(value) => setForm((state) => ({ ...state, bonusXpCode: value as CreatureBonusXpType }))}
                options={bonusXpOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Constitution Variance"
                value={form.constitutionVarianceType}
                onChange={(value) => setForm((state) => ({ ...state, constitutionVarianceType: value as CreatureConstitutionVarianceType }))}
                options={constitutionVarianceOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Level Variance"
                value={form.levelVarianceType}
                onChange={(value) => setForm((state) => ({ ...state, levelVarianceType: value as LevelVarianceType }))}
                options={levelVarianceOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Treasure Code"
                value={form.treasureCode}
                onChange={(value) => setForm((state) => ({ ...state, treasureCode: value }))}
                options={treasureCodeOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Size"
                value={form.size}
                onChange={(value) => setForm((state) => ({ ...state, size: value as CreatureSize }))}
                options={sizeOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Armour Type"
                value={form.armourType}
                onChange={(value) => setForm((state) => ({ ...state, armourType: value }))}
                options={armourOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Movement Speed"
                value={form.movementSpeed}
                onChange={(value) => setForm((state) => ({ ...state, movementSpeed: value as CreatureMovementSpeedType }))}
                options={movementSpeedOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Attack Quickness"
                value={form.attackQuickness}
                onChange={(value) => setForm((state) => ({ ...state, attackQuickness: value as CreatureMovementSpeedType }))}
                options={movementSpeedOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Max Pace"
                value={form.maxPace}
                onChange={(value) => setForm((state) => ({ ...state, maxPace: value }))}
                options={paceOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Outlook"
                value={form.outlook}
                onChange={(value) => setForm((state) => ({ ...state, outlook: value as AnimalOutlookType }))}
                options={outlookOptions}
                disabled={viewing}
              />
              <LabeledSelect
                label="Critical Table"
                value={form.criticalTable}
                onChange={(value) => setForm((state) => ({ ...state, criticalTable: value as CriticalSizeTableType }))}
                options={criticalTableOptions}
                disabled={viewing}
              />
            </div>

            <section style={{ marginTop: 12 }}>
              <CheckboxGroup
                label="Critical Modifiers"
                value={form.criticalModifiers}
                onChange={(next) => setForm((state) => ({ ...state, criticalModifiers: next as CriticalModifierType[] }))}
                options={criticalModifierOptions}
                disabled={viewing}
                columns={2}
              />
            </section>

            <section style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ margin: '8px 0' }}>Description</h4>
                {!viewing && (
                  <button type="button" onClick={() => setPreviewDescription((value) => !value)}>
                    {previewDescription ? 'Edit' : 'Preview'}
                  </button>
                )}
              </div>
              {previewDescription || viewing ? (
                <MarkupPreview
                  content={form.description}
                  emptyHint="No description"
                  className="preview-html"
                  style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
                />
              ) : (
                <label style={{ display: 'grid', gap: 6 }}>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((state) => ({ ...state, description: e.target.value }))}
                    disabled={viewing}
                    rows={5}
                  />
                </label>
              )}
            </section>

            <section style={{ marginTop: 16, display: 'grid', gap: 16 }}>
              <h4 style={{ margin: 0 }}>Location</h4>
              <IdListEditor
                title="Climates"
                rows={form.locationClimates}
                onChangeRows={(next) => setForm((state) => ({ ...state, locationClimates: next }))}
                options={climateOptions}
                columnLabel="Climate"
                addButtonLabel="+ Add climate"
                viewing={viewing}
              />
              {viewing ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>Environment Tags</span>
                  <PillList
                    values={[
                      ...form.locationFeatures.map((value) => `Feature: ${value}`),
                      ...form.locationTerrains.map((value) => `Terrain: ${value}`),
                      ...form.locationVegetation.map((value) => `Vegetation: ${value}`),
                      ...form.locationWaterSources.map((value) => `Water Source: ${value}`),
                    ]}
                    emptyLabel="No environment tags"
                  />
                </div>
              ) : (
                <>
                  <CheckboxGroup
                    label="Features"
                    value={form.locationFeatures}
                    onChange={(next) => setForm((state) => ({ ...state, locationFeatures: next as EnvironmentFeature[] }))}
                    options={featureOptions}
                    disabled={viewing}
                    columns={2}
                  />
                  <CheckboxGroup
                    label="Terrains"
                    value={form.locationTerrains}
                    onChange={(next) => setForm((state) => ({ ...state, locationTerrains: next as EnvironmentTerrain[] }))}
                    options={terrainOptions}
                    disabled={viewing}
                    columns={2}
                  />
                  <CheckboxGroup
                    label="Vegetation"
                    value={form.locationVegetation}
                    onChange={(next) => setForm((state) => ({ ...state, locationVegetation: next as EnvironmentVegetation[] }))}
                    options={vegetationOptions}
                    disabled={viewing}
                    columns={2}
                  />
                  <CheckboxGroup
                    label="Water Sources"
                    value={form.locationWaterSources}
                    onChange={(next) => setForm((state) => ({ ...state, locationWaterSources: next as EnvironmentWaterBody[] }))}
                    options={waterBodyOptions}
                    disabled={viewing}
                    columns={2}
                  />
                </>
              )}
            </section>

            {renderAttackSection(
              'Standard Attacks',
              'standard',
              form.standardAttacks,
              (next) => setForm((state) => ({ ...state, standardAttacks: next as StandardAttackVM[] })),
              errors.standardAttacks,
            )}

            {renderAttackSection(
              'Ranged Attacks',
              'ranged',
              form.rangedAttacks,
              (next) => setForm((state) => ({ ...state, rangedAttacks: next as RangedAttackVM[] })),
              errors.rangedAttacks,
            )}

            {renderAttackSection(
              'Conditional Attacks',
              'conditional',
              form.conditionalAttacks,
              (next) => setForm((state) => ({ ...state, conditionalAttacks: next as ConditionalAttackVM[] })),
              errors.conditionalAttacks,
            )}

            {renderAttackSection(
              'Group Attacks',
              'group',
              form.groupAttacks,
              (next) => setForm((state) => ({ ...state, groupAttacks: next as GroupAttackVM[] })),
              errors.groupAttacks,
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {!viewing && <button onClick={saveForm} disabled={hasErrors || submitting}>{submitting ? 'Submitting…' : 'Save'}</button>}
              <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
            </div>

            {Object.values(errors).some(Boolean) && (
              <div style={{ marginTop: 12, color: '#b00020' }}>
                <h4 style={{ margin: '0 0 4px' }}>Please fix the following errors:</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Object.entries(errors).map(([field, message]) => (
                    message ? <li key={field}>{message}</li> : null
                  ))}
                </ul>
              </div>
            )}

            {viewing && (
              <section style={{ marginTop: 16, display: 'grid', gap: 8 }}>
                <h4 style={{ margin: 0 }}>Summary</h4>
                <div>Treasure Code: {(treasureNameById.get(form.treasureCode) ?? form.treasureCode) || 'None'}</div>
                <div>Armour Type: {(armourNameById.get(form.armourType) ?? form.armourType) || 'None'}</div>
                <div>Max Pace: {(paceNameById.get(form.maxPace) ?? form.maxPace) || 'None'}</div>
              </section>
            )}
          </div>
        </div>
      )}

      {!showForm && (
        <DataTable
          ref={dtRef}
          rows={rows}
          columns={columns}
          rowId={(row) => row.id}
          initialSort={{ colId: 'name', dir: 'asc' }}
          searchQuery={query}
          globalFilter={globalFilter}
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          tableMinWidth={0}
          persistKey="dt.animals.v1"
          ariaLabel="Animal data"
        />
      )}
    </>
  );
}