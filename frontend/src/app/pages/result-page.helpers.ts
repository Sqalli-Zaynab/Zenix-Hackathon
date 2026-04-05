import {
  CareerChoice,
  CareerRecommendations,
  Diagnosis,
  NormalizedProfile,
} from '../profile-flow.types';

export type RadarAxisLabel = 'Logic' | 'Build' | 'People' | 'Impact' | 'Creative';

export interface RadarAxis {
  label: RadarAxisLabel;
  lineX: number;
  lineY: number;
  labelX: number;
  labelY: number;
}

export interface ToneConfig {
  iconClass: string;
  badgeClass: string;
  accent: [number, number, number];
  surface: [number, number, number];
  text: [number, number, number];
}

export interface SkillBuildMetric {
  label: string;
  progress: number;
}

export interface StrengthMetric {
  label: string;
  progress: number;
}

export const RADAR_AXIS_LABELS: RadarAxisLabel[] = [
  'Logic',
  'Build',
  'People',
  'Impact',
  'Creative',
];

export const RADAR_LEVELS = [0.28, 0.52, 0.76, 1];

export const PROFILE_TITLE_BY_CAREER: Record<string, string> = {
  'software-engineering': 'The Logical Builder',
  'data-and-ai': 'The Insight Architect',
  cybersecurity: 'The Digital Guardian',
  'ui-ux-design': 'The Empathetic Designer',
  'product-management': 'The Systems Strategist',
  'digital-marketing': 'The Audience Builder',
};

export const RADAR_SCORES_BY_CAREER: Record<string, number[]> = {
  'software-engineering': [0.88, 0.84, 0.58, 0.74, 0.62],
  'data-and-ai': [0.94, 0.72, 0.5, 0.76, 0.46],
  cybersecurity: [0.91, 0.7, 0.44, 0.72, 0.48],
  'ui-ux-design': [0.56, 0.68, 0.82, 0.7, 0.92],
  'product-management': [0.7, 0.8, 0.9, 0.82, 0.66],
  'digital-marketing': [0.5, 0.68, 0.88, 0.68, 0.84],
};

export const EMPTY_RADAR_SCORES = [0.62, 0.62, 0.62, 0.62, 0.62];

export const CARD_TONES_BY_LABEL: Record<CareerChoice['label'], ToneConfig> = {
  best_fit: {
    iconClass: 'recommendation-card__icon--purple',
    badgeClass: 'recommendation-card__badge--purple',
    accent: [69, 58, 166],
    surface: [236, 233, 255],
    text: [69, 58, 166],
  },
  alternative: {
    iconClass: 'recommendation-card__icon--green',
    badgeClass: 'recommendation-card__badge--green',
    accent: [31, 161, 118],
    surface: [223, 243, 236],
    text: [14, 100, 80],
  },
  safe_option: {
    iconClass: 'recommendation-card__icon--sand',
    badgeClass: 'recommendation-card__badge--sand',
    accent: [239, 159, 39],
    surface: [249, 237, 214],
    text: [135, 83, 31],
  },
};

const CAREER_SKILLS_BY_ID: Record<string, SkillBuildMetric[]> = {
  'software-engineering': [
    { label: 'JavaScript / TypeScript', progress: 0.9 },
    { label: 'React / Angular', progress: 0.82 },
    { label: 'Node.js + APIs', progress: 0.76 },
    { label: 'Git & version control', progress: 0.68 },
    { label: 'Algorithms & DSA', progress: 0.58 },
    { label: 'System design basics', progress: 0.42 },
  ],
  'data-and-ai': [
    { label: 'Python + notebooks', progress: 0.9 },
    { label: 'SQL + data analysis', progress: 0.82 },
    { label: 'Statistics fundamentals', progress: 0.76 },
    { label: 'Data visualization', progress: 0.68 },
    { label: 'Machine learning basics', progress: 0.56 },
    { label: 'Prompting + AI workflows', progress: 0.44 },
  ],
  cybersecurity: [
    { label: 'Networking basics', progress: 0.88 },
    { label: 'Linux command line', progress: 0.78 },
    { label: 'Security fundamentals', progress: 0.74 },
    { label: 'Risk & threat modeling', progress: 0.64 },
    { label: 'Scripting for security', progress: 0.54 },
    { label: 'Cloud security basics', progress: 0.42 },
  ],
  'ui-ux-design': [
    { label: 'UX research', progress: 0.88 },
    { label: 'Wireframes & flows', progress: 0.8 },
    { label: 'UI systems', progress: 0.72 },
    { label: 'Prototyping', progress: 0.64 },
    { label: 'Accessibility', progress: 0.56 },
    { label: 'Design storytelling', progress: 0.44 },
  ],
  'product-management': [
    { label: 'Problem framing', progress: 0.88 },
    { label: 'Roadmapping', progress: 0.8 },
    { label: 'User research', progress: 0.74 },
    { label: 'Delivery alignment', progress: 0.68 },
    { label: 'Analytics & prioritization', progress: 0.58 },
    { label: 'Stakeholder communication', progress: 0.48 },
  ],
  'digital-marketing': [
    { label: 'Content strategy', progress: 0.88 },
    { label: 'Audience research', progress: 0.78 },
    { label: 'Campaign planning', progress: 0.72 },
    { label: 'Analytics & reporting', progress: 0.64 },
    { label: 'Social growth systems', progress: 0.56 },
    { label: 'Brand storytelling', progress: 0.48 },
  ],
};

export function polarPoint(
  angleDeg: number,
  radius: number,
): { x: number; y: number } {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: Number((Math.cos(angle) * radius).toFixed(2)),
    y: Number((Math.sin(angle) * radius).toFixed(2)),
  };
}

export function serializePolygon(values: number[], radius: number): string {
  return values
    .map((value, index) => {
      const angle = -90 + (360 / values.length) * index;
      const point = polarPoint(angle, radius * value);
      return `${point.x},${point.y}`;
    })
    .join(' ');
}

export function toTitleCase(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getProfileTitle(careerId: string | null | undefined): string {
  if (!careerId) {
    return 'The Curious Builder';
  }

  return PROFILE_TITLE_BY_CAREER[careerId] ?? 'The Curious Builder';
}

export function buildTraitTags(
  profile: NormalizedProfile | null | undefined,
  summary: CareerRecommendations['profileSummary'] | null | undefined,
): string[] {
  if (!profile) {
    return [];
  }

  const values = [
    ...profile.strengths,
    ...(summary?.themes ?? []),
    ...profile.values,
  ];

  const unique = values.filter((item, index, array) => {
    const normalized = item.toLowerCase();
    return (
      array.findIndex(
        (candidate) => candidate.toLowerCase() === normalized,
      ) === index
    );
  });

  return unique.slice(0, 4).map((item) => toTitleCase(item));
}

export function getSkillLevelLabel(
  profile: Pick<NormalizedProfile, 'skillLevel'> | null | undefined,
): string {
  const level = profile?.skillLevel ?? 'intermediate';
  return toTitleCase(level);
}

export function getReadinessLabel(
  profile: Pick<NormalizedProfile, 'readiness'> | null | undefined,
): string {
  const readiness = profile?.readiness;

  if (typeof readiness !== 'number') {
    return 'Readiness building';
  }

  return `Readiness ${Math.round(readiness)}/100`;
}

export function getConfidenceLabel(
  score: number | null | undefined,
  readiness: number | null | undefined,
  diagnosis: Diagnosis | null | undefined,
): string {
  const normalizedScore = typeof score === 'number' ? score : 0;
  const readinessBoost =
    typeof readiness === 'number' && Number.isFinite(readiness)
      ? readiness
      : 0;

  if (normalizedScore >= 90 || readinessBoost >= 3) {
    return 'High';
  }

  if (normalizedScore >= 78 || diagnosis?.recommendationMode === 'compare') {
    return 'Medium';
  }

  return 'Emerging';
}

export function getFieldLabel(
  profile: Pick<NormalizedProfile, 'fieldOfStudy'> | null | undefined,
  fallbackCareerTitle?: string,
): string {
  if (profile?.fieldOfStudy.trim()) {
    return toTitleCase(profile.fieldOfStudy);
  }

  return fallbackCareerTitle ?? 'Career exploration';
}

export function getCareerSkills(choiceId: string | undefined): SkillBuildMetric[] {
  if (!choiceId) {
    return CAREER_SKILLS_BY_ID['software-engineering'];
  }

  return CAREER_SKILLS_BY_ID[choiceId] ?? CAREER_SKILLS_BY_ID['software-engineering'];
}

export function buildStrengthMetrics(
  profile: NormalizedProfile | null | undefined,
  summary: CareerRecommendations['profileSummary'] | null | undefined,
): StrengthMetric[] {
  if (!profile) {
    return [];
  }

  const labels = [
    ...profile.strengths,
    ...(summary?.themes ?? []),
    ...profile.values,
  ]
    .map((item) => toTitleCase(item))
    .filter(Boolean);

  const uniqueLabels = labels.filter(
    (item, index) =>
      labels.findIndex(
        (candidate) => candidate.toLowerCase() === item.toLowerCase(),
      ) === index,
  );

  const progressLevels = [0.91, 0.84, 0.76, 0.68, 0.6];

  return uniqueLabels.slice(0, progressLevels.length).map((label, index) => ({
    label,
    progress: progressLevels[index] ?? 0.52,
  }));
}

export function getCareerIconPath(choiceId: string): string {
  switch (choiceId) {
    case 'software-engineering':
      return 'M5 7h14M8 11l-3 3 3 3M16 11l3 3-3 3M12 7l-2 12';
    case 'data-and-ai':
      return 'M7 18h10M8 15l2-3 3 2 4-6M7 7h.01M12 7h.01M17 7h.01';
    case 'product-management':
      return 'M12 5v14M5 12h14M8 8h8v8H8z';
    case 'ui-ux-design':
      return 'M7 17l10-10M8 8h4v4H8zM12 12h4v4h-4z';
    case 'cybersecurity':
      return 'M12 4l6 3v4c0 4.5-2.6 7.7-6 9-3.4-1.3-6-4.5-6-9V7l6-3Z';
    default:
      return 'M5 18h14M7 14V8h10v6M9.5 18v-4m5 4v-4';
  }
}
