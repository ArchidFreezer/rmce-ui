import { useEffect, useMemo, useState } from 'react';

import {
  applyLevelUpgrade,
  fetchCultures,
  fetchProfessions,
  fetchRaces,
  fetchSkillCategories,
  fetchSkills,
  fetchTrainingPackages,
  generatePotentialStat,
  generatePotentialStats,
} from '../../api';

import {
  CheckboxInput,
  LabeledInput,
  LabeledSelect,
  Spinner,
  useToast,
} from '../../components';

import type {
  Culture,
  Profession,
  Race,
  Skill,
  SkillCategory,
  TrainingPackage,
} from '../../types';

import { SPELL_REALMS, STATS, type Realm, type Stat } from '../../types/enum';
import { isValidUnsignedInt, sanitizeUnsignedInt } from '../../utils';

type CharacterStep =
  | 'initial'
  | 'stats'
  | 'adolescent'
  | 'background'
  | 'apprenticeship'
  | 'apply';

const STEP_ORDER: CharacterStep[] = [
  'initial',
  'stats',
  'adolescent',
  'background',
  'apprenticeship',
  'apply',
];

const STEP_LABELS: Record<CharacterStep, string> = {
  initial: '1. Initial Choices',
  stats: '2. Stat Generation',
  adolescent: '3. Adolescent Skills',
  background: '4. Background Options',
  apprenticeship: '5. Apprenticeship Skills',
  apply: '6. Apply Level Upgrade',
};

type StepErrors = {
  initial?: string | undefined;
  stats?: string | undefined;
  adolescent?: string | undefined;
  background?: string | undefined;
  apprenticeship?: string | undefined;
  apply?: string | undefined;
};

type BackgroundOption = {
  id: string;
  label: string;
  source: 'Generic' | 'Race' | 'Profession';
};

function makeStatStringMap(seed = ''): Record<Stat, string> {
  return STATS.reduce((acc, s) => {
    acc[s] = seed;
    return acc;
  }, {} as Record<Stat, string>);
}

function makeStatBooleanMap(seed = false): Record<Stat, boolean> {
  return STATS.reduce((acc, s) => {
    acc[s] = seed;
    return acc;
  }, {} as Record<Stat, boolean>);
}

function makeStatPotentialMap(seed: number | null = null): Record<Stat, number | null> {
  return STATS.reduce((acc, s) => {
    acc[s] = seed;
    return acc;
  }, {} as Record<Stat, number | null>);
}

function randomD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function skillChoiceKey(id: string, subcategory?: string | undefined): string {
  return subcategory?.trim() ? `${id}::${subcategory.trim()}` : id;
}

function parseSkillChoiceKey(key: string): { id: string; subcategory?: string | undefined } {
  const idx = key.indexOf('::');
  if (idx < 0) return { id: key };
  const id = key.slice(0, idx);
  const subcategory = key.slice(idx + 2).trim();
  return {
    id,
    subcategory: subcategory || undefined,
  };
}

export default function CharacterCreationView() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [races, setRaces] = useState<Race[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [trainingPackages, setTrainingPackages] = useState<TrainingPackage[]>([]);

  const [step, setStep] = useState<CharacterStep>('initial');
  const [errors, setErrors] = useState<StepErrors>({});

  const [raceId, setRaceId] = useState('');
  const [cultureId, setCultureId] = useState('');
  const [professionId, setProfessionId] = useState('');
  const [selectedRealms, setSelectedRealms] = useState<Realm[]>([]);

  const [temporaryStats, setTemporaryStats] = useState<Record<Stat, string>>(() => makeStatStringMap(''));
  const [potentialStats, setPotentialStats] = useState<Record<Stat, number | null>>(() => makeStatPotentialMap(null));
  const [autoPotentialForStat, setAutoPotentialForStat] = useState<Record<Stat, boolean>>(() => makeStatBooleanMap(false));
  const [generatingStats, setGeneratingStats] = useState(false);

  const [raceCategorySelections, setRaceCategorySelections] = useState<string[][]>([]);
  const [professionSkillSelections, setProfessionSkillSelections] = useState<string[][]>([]);

  const [backgroundSelections, setBackgroundSelections] = useState<string[]>([]);

  const [trainingPackageId, setTrainingPackageId] = useState('');
  const [tpStatGainChoices, setTpStatGainChoices] = useState<Stat[]>([]);
  const [tpSkillRankChoiceSelections, setTpSkillRankChoiceSelections] = useState<string[][]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [raceData, cultureData, professionData, skillData, categoryData, tpData] = await Promise.all([
          fetchRaces(),
          fetchCultures(),
          fetchProfessions(),
          fetchSkills(),
          fetchSkillCategories(),
          fetchTrainingPackages(),
        ]);

        setRaces(raceData);
        setCultures(cultureData);
        setProfessions(professionData);
        setSkills(skillData);
        setCategories(categoryData);
        setTrainingPackages(tpData);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const race = useMemo(
    () => races.find((x) => x.id === raceId),
    [races, raceId],
  );

  const culture = useMemo(
    () => cultures.find((x) => x.id === cultureId),
    [cultures, cultureId],
  );

  const profession = useMemo(
    () => professions.find((x) => x.id === professionId),
    [professions, professionId],
  );

  const skillNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of skills) map.set(s.id, s.name);
    return map;
  }, [skills]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const restrictedProfessions = useMemo(
    () => new Set(culture?.restrictedProfessions ?? []),
    [culture],
  );

  const preferredProfessions = useMemo(
    () => new Set(culture?.preferredProfessions ?? []),
    [culture],
  );

  const professionOptions = useMemo(() => {
    return professions
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const isRestricted = restrictedProfessions.has(p.id);
        const isPreferred = preferredProfessions.has(p.id);
        return {
          value: p.id,
          label: isPreferred ? `${p.name} (Preferred)` : p.name,
          disabled: isRestricted,
        };
      });
  }, [professions, preferredProfessions, restrictedProfessions]);

  const predefinedSpellRealms = useMemo(() => {
    if (!profession) return [];
    return profession.realms.filter((r): r is Realm => SPELL_REALMS.includes(r));
  }, [profession]);

  const requiresRealmSelection = predefinedSpellRealms.length === 0;

  const realmOptionsForProfession = useMemo(() => {
    if (!profession || !requiresRealmSelection) return [];
    return SPELL_REALMS.map((r) => ({ value: r, label: r }));
  }, [profession, requiresRealmSelection]);

  const primeStats = useMemo(() => {
    if (!profession) return [];
    return uniqStrings(profession.stats).slice(0, 10) as Stat[];
  }, [profession]);

  const predefinedAdolescentSkillIds = useMemo(() => {
    const fromRace = (race?.everymanSkills ?? []).map((x) => x.id);
    const fromCulture = (culture?.hobbySkills ?? []).map((x) => x.id);
    return uniqStrings([...fromRace, ...fromCulture]);
  }, [race, culture]);

  const raceCategoryChoiceDefs = useMemo(
    () => race?.skillCategoryChoicesEveryman ?? [],
    [race],
  );

  const professionSkillChoiceDefs = useMemo(
    () => profession?.skillDevelopmentTypeChoices ?? [],
    [profession],
  );

  const backgroundBudget = Math.max(0, race?.backgroundOptions ?? 0);

  const backgroundOptions = useMemo<BackgroundOption[]>(() => {
    const generic: BackgroundOption[] = [
      { id: 'GENERIC_CONTACTS', label: 'Useful Contacts', source: 'Generic' },
      { id: 'GENERIC_EQUIPMENT', label: 'Better Starting Gear', source: 'Generic' },
      { id: 'GENERIC_LANGUAGE', label: 'Extra Language Exposure', source: 'Generic' },
      { id: 'GENERIC_WEALTH', label: 'Bonus Starting Wealth', source: 'Generic' },
      { id: 'GENERIC_REPUTATION', label: 'Favorable Reputation', source: 'Generic' },
      { id: 'GENERIC_TRAINING', label: 'Additional Early Training', source: 'Generic' },
    ];

    const raceSpecific = uniqStrings([
      ...(race?.everymanSkills ?? []).map((x) => `RACE_SKILL_${x.id}`),
      ...(race?.skillBonuses ?? []).map((x) => `RACE_BONUS_${x.id}`),
    ]).map((id) => ({
      id,
      label: id.replace(/^RACE_(SKILL|BONUS)_/, 'Race: '),
      source: 'Race' as const,
    }));

    const professionSpecific = uniqStrings([
      ...(profession?.skillBonuses ?? []).map((x) => `PROF_SKILL_${skillChoiceKey(x.id, x.subcategory)}`),
      ...(profession?.skillCategoryProfessionBonuses ?? []).map((x) => `PROF_CATEGORY_${x.id}`),
    ]).map((id) => ({
      id,
      label: id.replace(/^PROF_(SKILL|CATEGORY)_/, 'Profession: '),
      source: 'Profession' as const,
    }));

    return [...generic, ...raceSpecific, ...professionSpecific];
  }, [race, profession]);

  const availableTrainingPackages = useMemo(() => {
    if (!raceId) return [];
    const raceFiltered = trainingPackages.filter((tp) => {
      const races = Array.isArray(tp.races) ? tp.races : [];
      return races.length === 0 || races.includes(raceId);
    });

    if (!culture) return raceFiltered;

    const modifierIds = new Set(culture.trainingPackageModifiers.map((m) => m.id));
    const preferred = raceFiltered.filter((tp) => modifierIds.has(tp.id));
    const rest = raceFiltered.filter((tp) => !modifierIds.has(tp.id));
    return [...preferred, ...rest];
  }, [trainingPackages, raceId, culture]);

  const selectedTrainingPackage = useMemo(
    () => availableTrainingPackages.find((tp) => tp.id === trainingPackageId),
    [availableTrainingPackages, trainingPackageId],
  );

  useEffect(() => {
    if (!culture) return;
    if (professionId && restrictedProfessions.has(professionId)) {
      setProfessionId('');
    }
  }, [culture, professionId, restrictedProfessions]);

  useEffect(() => {
    if (!profession) {
      setSelectedRealms([]);
      return;
    }

    if (!requiresRealmSelection) {
      setSelectedRealms(predefinedSpellRealms);
      return;
    }

    setSelectedRealms((current) => {
      const [first] = current;
      if (first && SPELL_REALMS.includes(first)) {
        return [first];
      }
      return [];
    });
  }, [profession, predefinedSpellRealms, requiresRealmSelection]);

  useEffect(() => {
    setRaceCategorySelections((prev) => {
      const next = raceCategoryChoiceDefs.map((_, i) => prev[i] ?? []);
      return next;
    });
  }, [raceCategoryChoiceDefs]);

  useEffect(() => {
    setProfessionSkillSelections((prev) => {
      const next = professionSkillChoiceDefs.map((_, i) => prev[i] ?? []);
      return next;
    });
  }, [professionSkillChoiceDefs]);

  useEffect(() => {
    setTpSkillRankChoiceSelections((prev) => {
      const len = selectedTrainingPackage?.skillRankChoices.length ?? 0;
      const next = Array.from({ length: len }, (_, i) => prev[i] ?? []);
      return next;
    });
  }, [selectedTrainingPackage]);

  useEffect(() => {
    if (!backgroundSelections.length) return;
    if (backgroundSelections.length <= backgroundBudget) return;
    setBackgroundSelections((prev) => prev.slice(0, backgroundBudget));
  }, [backgroundSelections, backgroundBudget]);

  const validateInitial = (): string | undefined => {
    if (!raceId) return 'Race is required.';
    if (!cultureId) return 'Culture is required.';
    if (!professionId) return 'Profession is required.';
    if (restrictedProfessions.has(professionId)) {
      return 'Selected profession is restricted by the selected culture.';
    }
    if (!profession) {
      return 'Selected profession has no valid realms.';
    }

    if (!requiresRealmSelection) {
      if (selectedRealms.length === 0) return 'Selected profession has no valid spell realms.';
      return undefined;
    }

    if (selectedRealms.length !== 1) return 'Exactly one realm is required.';
    if (!realmOptionsForProfession.some((r) => r.value === selectedRealms[0])) return 'Selected realm is not valid for this profession.';
    return undefined;
  };

  const validateStats = (): string | undefined => {
    for (const stat of STATS) {
      const temp = temporaryStats[stat];
      if (!isValidUnsignedInt(temp)) {
        return `Temporary value for ${stat} must be an integer between 1 and 100.`;
      }
      const num = Number(temp);
      if (num < 1 || num > 100) {
        return `Temporary value for ${stat} must be between 1 and 100.`;
      }
      if (potentialStats[stat] == null) {
        return `Potential value for ${stat} has not been generated yet.`;
      }
    }
    return undefined;
  };

  const validateAdolescent = (): string | undefined => {
    for (let i = 0; i < raceCategoryChoiceDefs.length; i++) {
      const def = raceCategoryChoiceDefs[i];
      if (!def) continue;
      const picked = raceCategorySelections[i] ?? [];
      if (picked.length !== def.numChoices) {
        return `Race category choice #${i + 1} requires exactly ${def.numChoices} selections.`;
      }
    }

    for (let i = 0; i < professionSkillChoiceDefs.length; i++) {
      const def = professionSkillChoiceDefs[i];
      if (!def) continue;
      const picked = professionSkillSelections[i] ?? [];
      if (picked.length !== def.numChoices) {
        return `Profession skill choice #${i + 1} requires exactly ${def.numChoices} selections.`;
      }
    }

    return undefined;
  };

  const validateBackground = (): string | undefined => {
    if (backgroundBudget === 0) return undefined;
    if (backgroundSelections.length !== backgroundBudget) {
      return `Select exactly ${backgroundBudget} background options.`;
    }
    return undefined;
  };

  const validateApprenticeship = (): string | undefined => {
    if (!trainingPackageId) return 'Training package selection is required.';
    const tp = selectedTrainingPackage;
    if (!tp) return 'Selected training package is not valid.';

    if (tp.statGainChoices) {
      const required = tp.statGainChoices.numChoices;
      if (tpStatGainChoices.length !== required) {
        return `Training package requires exactly ${required} stat gain choices.`;
      }
    }

    for (let i = 0; i < tp.skillRankChoices.length; i++) {
      const def = tp.skillRankChoices[i];
      if (!def) continue;
      const selected = tpSkillRankChoiceSelections[i] ?? [];
      if (selected.length !== def.numChoices) {
        return `Skill rank choice #${i + 1} requires exactly ${def.numChoices} selections.`;
      }
    }

    return undefined;
  };

  const recomputeErrors = () => {
    const next: StepErrors = {
      initial: validateInitial(),
      stats: validateStats(),
      adolescent: validateAdolescent(),
      background: validateBackground(),
      apprenticeship: validateApprenticeship(),
    };
    setErrors(next);
    return next;
  };

  useEffect(() => {
    recomputeErrors();
  }, [
    raceId,
    cultureId,
    professionId,
    selectedRealms,
    temporaryStats,
    potentialStats,
    raceCategorySelections,
    professionSkillSelections,
    backgroundSelections,
    trainingPackageId,
    tpStatGainChoices,
    tpSkillRankChoiceSelections,
  ]);

  const canGoNext = (() => {
    if (step === 'apply') return false;
    const e = errors[step];
    return !e;
  })();

  const goPrev = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx <= 0) return;
    const prev = STEP_ORDER[idx - 1];
    if (prev) setStep(prev);
  };

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < 0 || idx >= STEP_ORDER.length - 1) return;
    if (!canGoNext) return;
    const next = STEP_ORDER[idx + 1];
    if (next) setStep(next);
  };

  const generateAllTemporary = () => {
    setTemporaryStats((prev) => {
      const next = { ...prev };
      for (const stat of STATS) {
        next[stat] = String(randomD100());
      }
      return next;
    });
    setPotentialStats(makeStatPotentialMap(null));
  };

  const onChangeTemporaryStat = (stat: Stat, value: string) => {
    const next = sanitizeUnsignedInt(value);
    setTemporaryStats((prev) => ({ ...prev, [stat]: next }));
    setPotentialStats((prev) => ({ ...prev, [stat]: null }));
  };

  const generatePotentialForSingle = async (stat: Stat) => {
    if (!raceId || !cultureId || !professionId || selectedRealms.length === 0) return;

    const autoGenerate = autoPotentialForStat[stat];
    const temp = temporaryStats[stat];

    if (!autoGenerate) {
      if (!isValidUnsignedInt(temp)) {
        toast({ variant: 'warning', title: 'Invalid temporary stat', description: `${stat} must be an integer between 1 and 100.` });
        return;
      }
      const tempNum = Number(temp);
      if (tempNum < 1 || tempNum > 100) {
        toast({ variant: 'warning', title: 'Invalid temporary stat', description: `${stat} must be between 1 and 100.` });
        return;
      }
    }

    setGeneratingStats(true);
    try {
      const result = await generatePotentialStat({
        raceId,
        cultureId,
        professionId,
        realms: selectedRealms,
        stat,
        temporary: autoGenerate ? undefined : Number(temp),
        autoGenerate,
      });

      setTemporaryStats((prev) => ({ ...prev, [stat]: String(result.temporary) }));
      setPotentialStats((prev) => ({ ...prev, [stat]: result.potential }));
    } catch (e) {
      toast({
        variant: 'danger',
        title: 'Potential generation failed',
        description: String(e instanceof Error ? e.message : e),
      });
    } finally {
      setGeneratingStats(false);
    }
  };

  const generatePotentialForAll = async () => {
    if (!raceId || !cultureId || !professionId || selectedRealms.length === 0) return;

    for (const stat of STATS) {
      const autoGenerate = autoPotentialForStat[stat];
      if (!autoGenerate) {
        const temp = temporaryStats[stat];
        if (!isValidUnsignedInt(temp) || Number(temp) < 1 || Number(temp) > 100) {
          toast({
            variant: 'warning',
            title: 'Invalid temporary stats',
            description: `All temporary stats must be valid (1-100) unless server auto generation is enabled for that stat.`,
          });
          return;
        }
      }
    }

    setGeneratingStats(true);
    try {
      const response = await generatePotentialStats({
        raceId,
        cultureId,
        professionId,
        realms: selectedRealms,
        stats: STATS.map((stat) => {
          const autoGenerate = autoPotentialForStat[stat];
          return {
            stat,
            temporary: autoGenerate ? undefined : Number(temporaryStats[stat]),
            autoGenerate,
          };
        }),
      });

      setTemporaryStats((prev) => {
        const next = { ...prev };
        for (const r of response.results) {
          next[r.stat] = String(r.temporary);
        }
        return next;
      });

      setPotentialStats((prev) => {
        const next = { ...prev };
        for (const r of response.results) {
          next[r.stat] = r.potential;
        }
        return next;
      });

      toast({ variant: 'success', title: 'Potential stats generated', description: 'All potential values were generated from the server.' });
    } catch (e) {
      toast({
        variant: 'danger',
        title: 'Potential generation failed',
        description: String(e instanceof Error ? e.message : e),
      });
    } finally {
      setGeneratingStats(false);
    }
  };

  const toggleStringSelection = (
    selected: string[],
    value: string,
    max: number,
  ): string[] => {
    const has = selected.includes(value);
    if (has) return selected.filter((x) => x !== value);
    if (selected.length >= max) return selected;
    return [...selected, value];
  };

  const toggleBackgroundOption = (id: string) => {
    setBackgroundSelections((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= backgroundBudget) return prev;
      return [...prev, id];
    });
  };

  const resetWorkflow = () => {
    setStep('initial');
    setRaceId('');
    setCultureId('');
    setProfessionId('');
    setSelectedRealms([]);
    setTemporaryStats(makeStatStringMap(''));
    setPotentialStats(makeStatPotentialMap(null));
    setAutoPotentialForStat(makeStatBooleanMap(false));
    setRaceCategorySelections([]);
    setProfessionSkillSelections([]);
    setBackgroundSelections([]);
    setTrainingPackageId('');
    setTpStatGainChoices([]);
    setTpSkillRankChoiceSelections([]);
    setErrors({});
  };

  const submitLevelUpgrade = async () => {
    if (!raceId || !cultureId || !professionId || selectedRealms.length === 0 || !selectedTrainingPackage) return;

    const nextErrors = recomputeErrors();
    if (Object.values(nextErrors).some(Boolean)) {
      toast({
        variant: 'warning',
        title: 'Cannot apply level upgrade',
        description: 'Please resolve validation issues in earlier steps.',
      });
      return;
    }

    const tempStatsAsNumbers = STATS.reduce((acc, stat) => {
      acc[stat] = Number(temporaryStats[stat]);
      return acc;
    }, {} as Record<Stat, number>);

    const potentialStatsAsNumbers = STATS.reduce((acc, stat) => {
      acc[stat] = potentialStats[stat] ?? 0;
      return acc;
    }, {} as Record<Stat, number>);

    setApplying(true);
    try {
      const payload = {
        character: {
          raceId,
          cultureId,
          professionId,
          realms: selectedRealms,
        },
        temporaryStats: tempStatsAsNumbers,
        potentialStats: potentialStatsAsNumbers,
        selectedAdolescentSkills: {
          predefinedSkillIds: predefinedAdolescentSkillIds,
          selectedRaceCategoryChoices: raceCategorySelections,
          selectedProfessionSkillChoices: professionSkillSelections,
        },
        selectedBackgroundOptions: backgroundSelections,
        apprenticeship: {
          trainingPackageId,
          selectedStatGainChoices: tpStatGainChoices,
          selectedSkillRankChoices: tpSkillRankChoiceSelections.map((row) => row.map(parseSkillChoiceKey)),
        },
      };

      const response = await applyLevelUpgrade(payload);

      toast({
        variant: 'success',
        title: 'Level upgrade applied',
        description: response.message ?? 'Server accepted level-up application.',
      });
    } catch (e) {
      toast({
        variant: 'danger',
        title: 'Apply level upgrade failed',
        description: String(e instanceof Error ? e.message : e),
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div>Loading character workflow…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Character Creation</h2>
      <p style={{ color: 'var(--muted)' }}>
        Complete each step in order. Progression is locked until the current step is valid.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {STEP_ORDER.map((s, i) => {
          const active = s === step;
          const hasError = !!errors[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                const targetIndex = STEP_ORDER.indexOf(s);
                const currentIndex = STEP_ORDER.indexOf(step);
                if (targetIndex <= currentIndex) setStep(s);
              }}
              disabled={STEP_ORDER.indexOf(s) > STEP_ORDER.indexOf(step)}
              style={{
                border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'var(--primary-weak)' : undefined,
                opacity: STEP_ORDER.indexOf(s) > STEP_ORDER.indexOf(step) ? 0.65 : 1,
              }}
              title={hasError ? errors[s] : STEP_LABELS[s]}
            >
              {i + 1}
              {hasError ? ' ⚠' : ''}
            </button>
          );
        })}
      </div>

      <div className="form-container">
        {(generatingStats || applying) && (
          <div className="overlay">
            <Spinner size={24} />
            <span>{applying ? 'Applying level upgrade…' : 'Generating stats…'}</span>
          </div>
        )}

        <div className="form-panel" style={{ display: 'grid', gap: 14 }}>
          <h3>{STEP_LABELS[step]}</h3>

          {step === 'initial' && (
            <section style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                <LabeledSelect
                  label="Race"
                  value={raceId}
                  onChange={(v) => {
                    setRaceId(v);
                    setTrainingPackageId('');
                    setBackgroundSelections([]);
                  }}
                  options={races
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((r) => ({ value: r.id, label: r.name }))}
                  error={errors.initial && !raceId ? 'Required' : undefined}
                />

                <LabeledSelect
                  label="Culture"
                  value={cultureId}
                  onChange={(v) => {
                    setCultureId(v);
                    setTrainingPackageId('');
                  }}
                  options={cultures
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => ({ value: c.id, label: c.name }))}
                  error={errors.initial && !cultureId ? 'Required' : undefined}
                />

                <LabeledSelect
                  label="Profession"
                  value={professionId}
                  onChange={(v) => {
                    setProfessionId(v);
                    setSelectedRealms([]);
                    setBackgroundSelections([]);
                  }}
                  options={professionOptions}
                  helperText={
                    culture
                      ? `Preferred: ${culture.preferredProfessions.length}, Restricted: ${culture.restrictedProfessions.length}`
                      : undefined
                  }
                  error={errors.initial && !professionId ? 'Required' : undefined}
                />

                {!requiresRealmSelection ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span>Realms</span>
                    <div style={{ minHeight: 38, padding: 8, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--panel)' }}>
                      {selectedRealms.join(', ') || 'No predefined spell realms'}
                    </div>
                    <small style={{ color: 'var(--muted)' }}>Defined by profession. No selection allowed.</small>
                  </div>
                ) : (
                  <LabeledSelect
                    label="Realm"
                    value={selectedRealms[0] ?? ''}
                    onChange={(v) => setSelectedRealms(v ? [v as Realm] : [])}
                    options={realmOptionsForProfession}
                    disabled={!profession}
                    error={errors.initial && selectedRealms.length !== 1 ? 'Required' : undefined}
                  />
                )}
              </div>

              {errors.initial && (
                <div style={{ color: '#b00020' }}>{errors.initial}</div>
              )}
            </section>
          )}

          {step === 'stats' && (
            <section style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={generateAllTemporary}>Randomize All Temporary (d100)</button>
                <button type="button" onClick={generatePotentialForAll} disabled={generatingStats}>Generate All Potentials (REST)</button>
              </div>

              <div style={{ color: 'var(--muted)' }}>
                Prime stats from profession: {primeStats.length ? primeStats.join(', ') : 'None defined'}
              </div>

              {STATS.map((stat) => {
                const isPrime = primeStats.includes(stat);
                const potentialValue = potentialStats[stat];
                return (
                  <div key={stat} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: isPrime ? 'var(--primary-weak)' : 'transparent' }}>
                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(180px, 1fr) 160px 180px auto', alignItems: 'end' }}>
                      <LabeledInput
                        label={isPrime ? `${stat} (Prime)` : stat}
                        value={temporaryStats[stat]}
                        onChange={(v) => onChangeTemporaryStat(stat, v)}
                        helperText="Temporary d100"
                      />

                      <LabeledInput
                        label="Potential"
                        value={potentialValue == null ? '' : String(potentialValue)}
                        onChange={() => { }}
                        disabled
                        helperText="From REST"
                      />

                      <CheckboxInput
                        label="Auto on server"
                        checked={autoPotentialForStat[stat]}
                        onChange={(checked) => setAutoPotentialForStat((prev) => ({ ...prev, [stat]: checked }))}
                      />

                      <button
                        type="button"
                        onClick={() => generatePotentialForSingle(stat)}
                        disabled={generatingStats}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                );
              })}

              {errors.stats && <div style={{ color: '#b00020' }}>{errors.stats}</div>}
            </section>
          )}

          {step === 'adolescent' && (
            <section style={{ display: 'grid', gap: 14 }}>
              <div>
                <h4 style={{ margin: '0 0 8px' }}>Predefined Skills</h4>
                {predefinedAdolescentSkillIds.length === 0 ? (
                  <div style={{ color: 'var(--muted)' }}>No predefined adolescent skills for the selected combination.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {predefinedAdolescentSkillIds.map((id) => (
                      <li key={id}>{skillNameById.get(id) ?? id}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px' }}>Race Choice Requirements</h4>
                {raceCategoryChoiceDefs.length === 0 ? (
                  <div style={{ color: 'var(--muted)' }}>No race-based adolescent choices required.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {raceCategoryChoiceDefs.map((choice, i) => {
                      const selected = raceCategorySelections[i] ?? [];
                      return (
                        <div key={`race-choice-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                          <strong>Choice #{i + 1}</strong>
                          <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Pick {choice.numChoices}</div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {choice.options.map((id) => (
                              <CheckboxInput
                                key={id}
                                label={categoryNameById.get(id) ?? id}
                                checked={selected.includes(id)}
                                onChange={() => {
                                  setRaceCategorySelections((prev) => {
                                    const copy = prev.map((row) => row.slice());
                                    const row = copy[i] ?? [];
                                    copy[i] = toggleStringSelection(row, id, choice.numChoices);
                                    return copy;
                                  });
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px' }}>Profession Choice Requirements</h4>
                {professionSkillChoiceDefs.length === 0 ? (
                  <div style={{ color: 'var(--muted)' }}>No profession-based adolescent choices required.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {professionSkillChoiceDefs.map((choice, i) => {
                      const selected = professionSkillSelections[i] ?? [];
                      return (
                        <div key={`prof-choice-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                          <strong>Choice #{i + 1}</strong>
                          <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Pick {choice.numChoices}</div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {choice.options.map((opt) => {
                              const key = skillChoiceKey(opt.id, opt.subcategory);
                              const label = `${skillNameById.get(opt.id) ?? opt.id}${opt.subcategory ? ` (${opt.subcategory})` : ''}`;
                              return (
                                <CheckboxInput
                                  key={key}
                                  label={label}
                                  checked={selected.includes(key)}
                                  onChange={() => {
                                    setProfessionSkillSelections((prev) => {
                                      const copy = prev.map((row) => row.slice());
                                      const row = copy[i] ?? [];
                                      copy[i] = toggleStringSelection(row, key, choice.numChoices);
                                      return copy;
                                    });
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {errors.adolescent && <div style={{ color: '#b00020' }}>{errors.adolescent}</div>}
            </section>
          )}

          {step === 'background' && (
            <section style={{ display: 'grid', gap: 10 }}>
              <div>
                Budget: <strong>{backgroundBudget}</strong> | Selected: <strong>{backgroundSelections.length}</strong>
              </div>
              <div style={{ color: 'var(--muted)' }}>
                Generic options are always available. Race and profession options are derived from your earlier choices.
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {backgroundOptions.map((opt) => (
                  <CheckboxInput
                    key={opt.id}
                    label={`${opt.label} [${opt.source}]`}
                    checked={backgroundSelections.includes(opt.id)}
                    onChange={() => toggleBackgroundOption(opt.id)}
                    disabled={
                      !backgroundSelections.includes(opt.id)
                      && backgroundSelections.length >= backgroundBudget
                    }
                  />
                ))}
              </div>

              {errors.background && <div style={{ color: '#b00020' }}>{errors.background}</div>}
            </section>
          )}

          {step === 'apprenticeship' && (
            <section style={{ display: 'grid', gap: 12 }}>
              <div style={{ color: 'var(--muted)' }}>
                This step applies level 0 to level 1 and is structured for reuse in later level-ups.
              </div>

              <LabeledSelect
                label="Training Package"
                value={trainingPackageId}
                onChange={(v) => {
                  setTrainingPackageId(v);
                  setTpStatGainChoices([]);
                  setTpSkillRankChoiceSelections([]);
                }}
                options={availableTrainingPackages
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((tp) => ({ value: tp.id, label: tp.name }))}
                error={errors.apprenticeship && !trainingPackageId ? 'Required' : undefined}
              />

              {selectedTrainingPackage?.statGainChoices && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <h4 style={{ margin: '0 0 8px' }}>Stat Gain Choices</h4>
                  <div style={{ color: 'var(--muted)' }}>
                    Pick {selectedTrainingPackage.statGainChoices.numChoices}
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                    {selectedTrainingPackage.statGainChoices.options.map((s) => (
                      <CheckboxInput
                        key={s}
                        label={s}
                        checked={tpStatGainChoices.includes(s)}
                        onChange={() => {
                          setTpStatGainChoices((prev) => {
                            const has = prev.includes(s);
                            if (has) return prev.filter((x) => x !== s);
                            if (prev.length >= selectedTrainingPackage.statGainChoices!.numChoices) return prev;
                            return [...prev, s];
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedTrainingPackage && selectedTrainingPackage.skillRankChoices.length > 0 && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <h4 style={{ margin: 0 }}>Skill Rank Choices</h4>
                  {selectedTrainingPackage.skillRankChoices.map((choice, i) => {
                    const selected = tpSkillRankChoiceSelections[i] ?? [];
                    return (
                      <div key={`tp-skill-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                        <div style={{ color: 'var(--muted)', marginBottom: 6 }}>
                          Choice #{i + 1}: pick {choice.numChoices} (value {choice.value})
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {choice.options.map((opt) => {
                            const key = skillChoiceKey(opt.id, opt.subcategory);
                            const label = `${skillNameById.get(opt.id) ?? opt.id}${opt.subcategory ? ` (${opt.subcategory})` : ''}`;
                            return (
                              <CheckboxInput
                                key={key}
                                label={label}
                                checked={selected.includes(key)}
                                onChange={() => {
                                  setTpSkillRankChoiceSelections((prev) => {
                                    const copy = prev.map((row) => row.slice());
                                    const row = copy[i] ?? [];
                                    copy[i] = toggleStringSelection(row, key, choice.numChoices);
                                    return copy;
                                  });
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {errors.apprenticeship && <div style={{ color: '#b00020' }}>{errors.apprenticeship}</div>}
            </section>
          )}

          {step === 'apply' && (
            <section style={{ display: 'grid', gap: 12 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <h4 style={{ margin: '0 0 8px' }}>Summary</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Race: {race?.name ?? raceId}</li>
                  <li>Culture: {culture?.name ?? cultureId}</li>
                  <li>Profession: {profession?.name ?? professionId}</li>
                  <li>Realms: {selectedRealms.join(', ') || 'None'}</li>
                  <li>Prime Stats: {primeStats.join(', ') || 'None'}</li>
                  <li>Background selections: {backgroundSelections.length}</li>
                  <li>Training package: {selectedTrainingPackage?.name ?? trainingPackageId}</li>
                </ul>
              </div>

              {(errors.initial || errors.stats || errors.adolescent || errors.background || errors.apprenticeship) && (
                <div style={{ color: '#b00020' }}>
                  There are validation issues in previous steps. Please go back and correct them before applying level upgrade.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={submitLevelUpgrade}
                  disabled={applying || Boolean(errors.initial || errors.stats || errors.adolescent || errors.background || errors.apprenticeship)}
                >
                  {applying ? 'Applying…' : 'Apply Level Upgrade'}
                </button>
                <button type="button" onClick={resetWorkflow}>
                  Start Over
                </button>
              </div>
            </section>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={goPrev} disabled={step === 'initial'}>Back</button>
            <button type="button" onClick={goNext} disabled={!canGoNext || step === 'apply'}>Next</button>
          </div>
        </div>
      </div>
    </>
  );
}
