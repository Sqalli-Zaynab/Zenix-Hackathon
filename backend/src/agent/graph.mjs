import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const State = Annotation.Root({
  mode: Annotation({
    reducer: (_left, right) => right,
    default: () => "recommend",
  }),
  payload: Annotation({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),
  profile: Annotation({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),
  diagnosis: Annotation({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  scoredCareers: Annotation({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  recommendations: Annotation({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  plan: Annotation({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  trace: Annotation({
    reducer: (left, right) => left.concat(right || []),
    default: () => [],
  }),
});

const CAREERS_PATH = path.join(__dirname, "..", "data", "careers.json");
const OPPORTUNITIES_PATH = path.join(__dirname, "..", "data", "oportunities.json");

const skillRank = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const difficultyRank = {
  easy: 1,
  medium: 2,
  hard: 3,
};

async function readJson(filePath) {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(","))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function inferThemes(profile) {
  const allSignals = [
    ...profile.passions,
    ...profile.interests,
    ...profile.causes,
    ...profile.strengths,
    ...profile.values,
    ...profile.subjectsEnjoyed,
    ...profile.subjectsAvoided.map((item) => `avoid:${item}`),
    profile.personalGoal.toLowerCase(),
  ].join(" ");

  const buckets = {
    technology: ["ai", "software", "coding", "code", "data", "cyber", "web", "app", "apps", "tech", "logic"],
    business: ["business", "marketing", "management", "product", "startup", "entrepreneurship", "sales", "strategy"],
    creativity: ["design", "creative", "ui", "ux", "video", "content", "art", "branding"],
    impact: ["education", "health", "social", "community", "accessibility", "environment", "impact"],
    analysis: ["math", "analysis", "research", "problem solving", "statistics", "modeling"],
  };

  const scores = Object.entries(buckets).map(([theme, keywords]) => {
    const score = keywords.reduce((acc, keyword) => acc + (allSignals.includes(keyword) ? 1 : 0), 0);
    return { theme, score };
  });

  return scores.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.theme);
}

function profileReadiness(profile) {
  const base = skillRank[profile.skillLevel] || 1;
  const clarityBoost = {
    i_dont_know: 0,
    some_ideas: 0,
    i_know: 1,
  }[profile.careerClarity] || 0;
  return Math.min(base + clarityBoost, 3);
}

function textIncludesAny(text, keywords) {
  const lowered = String(text || "").toLowerCase();
  return keywords.some((keyword) => lowered.includes(String(keyword).toLowerCase()));
}

function overlap(listA, listB) {
  const setB = new Set(normalizeArray(listB));
  return normalizeArray(listA).filter((item) => setB.has(item));
}

function buildProfileNode(state) {
  const input = state.payload || {};
  const profile = {
    passions: normalizeArray(input.passions),
    interests: normalizeArray(input.interests),
    causes: normalizeArray(input.causes),
    strengths: normalizeArray(input.strengths),
    academicLevel: normalizeText(input.academicLevel || input.level || "high_school").toLowerCase(),
    fieldOfStudy: normalizeText(input.fieldOfStudy || input.field || "general").toLowerCase(),
    skillLevel: normalizeText(input.skillLevel || "beginner").toLowerCase(),
    careerClarity: normalizeText(input.careerClarity || "i_dont_know").toLowerCase().replace(/\s+/g, "_"),
    personalGoal: normalizeText(input.personalGoal),
    mainChallenge: normalizeText(input.mainChallenge || "").toLowerCase().replace(/\s+/g, "_"),
    opportunityTypes: normalizeArray(input.opportunityTypes),
    preferredLocation: normalizeText(input.preferredLocation || "remote").toLowerCase(),
    values: normalizeArray(input.values || input.workValues),
    workStyle: normalizeText(input.workStyle || "hybrid").toLowerCase(),
    subjectsEnjoyed: normalizeArray(input.subjectsEnjoyed),
    subjectsAvoided: normalizeArray(input.subjectsAvoided),
    languages: normalizeArray(input.languages),
  };

  const themes = inferThemes(profile);
  const readiness = profileReadiness(profile);

  return {
    profile: {
      ...profile,
      themes,
      readiness,
    },
    trace: [
      `ProfileAgent: normalized ${profile.interests.length + profile.passions.length + profile.strengths.length} preference signals`,
      `ProfileAgent: inferred themes -> ${themes.join(", ") || "general exploration"}`,
      `ProfileAgent: readiness level -> ${readiness}/3`,
    ],
  };
}

function routeFromMode(state) {
  if (state.mode === "analyze") return "diagnoseProfile";
  if (state.mode === "plan") return "buildPlan";
  return "scoreCareers";
}

function diagnoseProfileNode(state) {
  const profile = state.profile;

  let recommendationMode = "explore";
  if (profile.careerClarity === "some_ideas") recommendationMode = "compare";
  if (profile.careerClarity === "i_know") recommendationMode = "execute";

  const challengeLabels = {
    i_dont_know_what_fits_me: "fit discovery",
    i_dont_know_how_to_reach_my_goal: "execution gap",
    i_cant_find_opportunities: "opportunity discovery",
  };

  const diagnosis = {
    recommendationMode,
    mainNeed: challengeLabels[profile.mainChallenge] || "direction clarification",
    summary: `You seem driven by ${profile.themes.slice(0, 2).join(" and ") || "general exploration"}. The agent should use a ${recommendationMode} strategy.`,
    suggestedNextStep:
      recommendationMode === "explore"
        ? "Compare 3 different tracks and validate with small projects."
        : recommendationMode === "compare"
          ? "Rank your top options and test them with focused opportunities."
          : "Build a short action roadmap toward your chosen path.",
  };

  return {
    diagnosis,
    trace: [
      `DiagnosisAgent: mode -> ${recommendationMode}`,
      `DiagnosisAgent: main need -> ${diagnosis.mainNeed}`,
    ],
  };
}

async function scoreCareersNode(state) {
  const careers = await readJson(CAREERS_PATH);
  const profile = state.profile;

  const scoredCareers = careers.map((career) => {
    const reasons = [];
    let score = 0;

    const interestHits = overlap([...profile.passions, ...profile.interests], career.tags);
    if (interestHits.length) {
      score += Math.min(interestHits.length * 8, 24);
      reasons.push(`matches your interests: ${interestHits.slice(0, 3).join(", ")}`);
    }

    const strengthHits = overlap(profile.strengths, career.strengthTags);
    if (strengthHits.length) {
      score += Math.min(strengthHits.length * 7, 21);
      reasons.push(`fits your strengths: ${strengthHits.slice(0, 3).join(", ")}`);
    }

    const causeHits = overlap(profile.causes, career.causeTags);
    if (causeHits.length) {
      score += Math.min(causeHits.length * 5, 10);
      reasons.push(`connects with causes you care about: ${causeHits.slice(0, 2).join(", ")}`);
    }

    if (career.fieldTags.some((tag) => profile.fieldOfStudy.includes(tag))) {
      score += 10;
      reasons.push(`aligned with your current field: ${profile.fieldOfStudy}`);
    }

    const readinessGap = (skillRank[profile.skillLevel] || 1) - (difficultyRank[career.entryDifficulty] || 1);
    if (readinessGap >= 0) {
      score += 10;
      reasons.push(`your current skill level can support this path`);
    } else if (readinessGap === -1) {
      score += 4;
      reasons.push(`reachable with a short upskilling phase`);
    }

    if (textIncludesAny(profile.personalGoal, career.goalKeywords)) {
      score += 15;
      reasons.push(`matches your personal goal`);
    }

    if (profile.values.length && overlap(profile.values, career.valueTags).length) {
      score += 8;
      reasons.push(`fits your work values`);
    }

    if (profile.preferredLocation && career.locationOptions.includes(profile.preferredLocation)) {
      score += 4;
      reasons.push(`compatible with your preferred location`);
    }

    return {
      ...career,
      score,
      reasons,
    };
  });

  scoredCareers.sort((a, b) => b.score - a.score);

  return {
    scoredCareers,
    trace: [`MatchingAgent: evaluated ${scoredCareers.length} career paths`],
  };
}

function selectRecommendationsNode(state) {
  const profile = state.profile;
  const sorted = state.scoredCareers || [];
  const readiness = profile.readiness || 1;

  const main = sorted[0] || null;
  const alternative = sorted.find((item) => item.id !== main?.id) || null;
  const safe =
    sorted.find(
      (item) =>
        item.id !== main?.id &&
        item.id !== alternative?.id &&
        (difficultyRank[item.entryDifficulty] || 2) <= readiness,
    ) || sorted[2] || null;

  const recommendations = {
    profileSummary: {
      themes: profile.themes,
      readiness,
      careerClarity: profile.careerClarity,
    },
    topChoices: [
      main ? { label: "best_fit", ...formatCareer(main) } : null,
      alternative ? { label: "alternative", ...formatCareer(alternative) } : null,
      safe ? { label: "safe_option", ...formatCareer(safe) } : null,
    ].filter(Boolean),
  };

  return {
    recommendations,
    trace: [
      `ScenarioAgent: selected ${recommendations.topChoices.length} scenarios`,
      `ExplainabilityAgent: generated reasons for each scenario`,
    ],
  };
}

function formatCareer(career) {
  return {
    id: career.id,
    title: career.title,
    score: career.score,
    entryDifficulty: career.entryDifficulty,
    shortDescription: career.shortDescription,
    reasons: career.reasons.slice(0, 3),
    recommendedOpportunities: career.recommendedOpportunities,
  };
}

async function buildPlanNode(state) {
  const careers = await readJson(CAREERS_PATH);
  const opportunities = await readJson(OPPORTUNITIES_PATH);
  const payload = state.payload || {};
  const profile = state.profile;

  const selectedId = payload.selectedCareerId || payload.selectedPath || payload.careerId;
  const selectedCareer = careers.find(
    (career) => career.id === selectedId || career.title.toLowerCase() === String(selectedId || "").toLowerCase(),
  ) || careers[0];

  const preferredTypes = normalizeArray(payload.opportunityTypes || profile.opportunityTypes);
  const preferredLocation = normalizeText(payload.preferredLocation || profile.preferredLocation || "remote").toLowerCase();

  const filteredOpportunities = opportunities
    .filter((item) => {
      const typeOk = preferredTypes.length ? preferredTypes.includes(String(item.type).toLowerCase()) : true;
      const locationOk = preferredLocation ? item.location.toLowerCase() === preferredLocation || item.location.toLowerCase() === "flexible" : true;
      const tagOk = item.tags.some((tag) => selectedCareer.tags.includes(tag));
      return typeOk && locationOk && tagOk;
    })
    .slice(0, 5);

  const plan = {
    selectedPath: {
      id: selectedCareer.id,
      title: selectedCareer.title,
      shortDescription: selectedCareer.shortDescription,
    },
    roadmap: {
      first30Days: selectedCareer.roadmap.first30Days,
      next60Days: selectedCareer.roadmap.next60Days,
      next90Days: selectedCareer.roadmap.next90Days,
    },
    recommendedOpportunities: filteredOpportunities,
    explanation: `This plan focuses on ${selectedCareer.title} because it aligns with your strongest signals and keeps the next steps concrete.`,
  };

  return {
    plan,
    trace: [
      `PlannerAgent: built a 30-60-90 day roadmap for ${selectedCareer.title}`,
      `OpportunitiesAgent: found ${filteredOpportunities.length} matching opportunities`,
    ],
  };
}

const graph = new StateGraph(State)
  .addNode("buildProfile", buildProfileNode)
  .addNode("diagnoseProfile", diagnoseProfileNode)
  .addNode("scoreCareers", scoreCareersNode)
  .addNode("selectRecommendations", selectRecommendationsNode)
  .addNode("buildPlan", buildPlanNode)
  .addEdge(START, "buildProfile")
  .addConditionalEdges("buildProfile", routeFromMode, ["diagnoseProfile", "scoreCareers", "buildPlan"])
  .addEdge("diagnoseProfile", END)
  .addEdge("scoreCareers", "selectRecommendations")
  .addEdge("selectRecommendations", END)
  .addEdge("buildPlan", END)
  .compile();

export async function runAgentGraph(mode = "recommend", payload = {}) {
  const result = await graph.invoke({
    mode,
    payload,
  });

  if (mode === "analyze") {
    return {
      profile: result.profile,
      diagnosis: result.diagnosis,
      agentTrace: result.trace,
    };
  }

  if (mode === "plan") {
    return {
      profile: result.profile,
      ...result.plan,
      agentTrace: result.trace,
    };
  }

  return {
    profile: result.profile,
    ...result.recommendations,
    agentTrace: result.trace,
  };
}
