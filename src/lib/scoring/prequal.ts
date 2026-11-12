/**
 * PreQual screening, ported from ~/workspace/projects/prequal-ai/app.js (Nov 10, 2026).
 *
 * Pure module: no DB, no Next, no network. Server-side scoring only — the API
 * re-scores from validated answers and never trusts a client-supplied score.
 *
 * Weights, question text and option values are verbatim from the PreQual build.
 * Bump MODEL_VERSION when they change; stored assessments keep their version
 * so an old score stays explainable.
 *
 * This is a transparent rubric, not an LLM judgement and not a hiring
 * decision. Knockout / background-check wording has not had legal review.
 */

export const PREQUAL_MODEL_VERSION = "prequal-v1";

export const PREQUAL_WEIGHTS = {
  experience: 25,
  availability: 20,
  practical: 20,
  mission: 20,
  communication: 15,
} as const;

export type PreQualCategory = keyof typeof PREQUAL_WEIGHTS;
export type PreQualRecommendation = "advance" | "review" | "not_advancing";

/** Max points per scored question. 2 questions per category x 4 = 8. */
export const MAX_PER_CATEGORY = 8;

export type PreQualOption = { value: number; label: string };
export type PreQualQuestion = {
  id: string;
  category?: PreQualCategory;
  knockout?: boolean;
  label: string;
  options: PreQualOption[];
};

const scored = (id: string, category: PreQualCategory, label: string, options: [number, string][]): PreQualQuestion => ({
  id, category, label, options: options.map(([value, label]) => ({ value, label })),
});

export const PREQUAL_KNOCKOUTS: PreQualQuestion[] = [
  { id: "authorized", knockout: true, label: "Are you authorized to work in the United States?", options: [{ value: 1, label: "Yes" }, { value: 0, label: "No" }] },
  { id: "schedule", knockout: true, label: "Can you work the schedule listed for this role (including evenings / weekends if listed)?", options: [{ value: 1, label: "Yes, I can work that schedule" }, { value: 0, label: "No, I cannot work that schedule" }] },
  { id: "background", knockout: true, label: "If this role requires a background check, are you willing to complete one?", options: [{ value: 1, label: "Yes" }, { value: 0, label: "No" }, { value: 1, label: "Not applicable to this role" }] },
];

export const PREQUAL_QUESTIONS: PreQualQuestion[] = [
  scored("exp_years", "experience", "How much directly relevant experience do you have for this type of role?", [[4, "3+ years"], [3, "1–2 years"], [2, "Less than 1 year, but some related experience"], [1, "No direct experience, but transferable skills"], [0, "No relevant experience"]]),
  scored("exp_example", "experience", "Have you done this kind of work in a small team, church, or small business before?", [[4, "Yes — same setting, similar role"], [3, "Yes — similar work, different setting"], [2, "Somewhat — volunteered or helped informally"], [1, "A little — I understand the work"], [0, "No"]]),
  scored("avail_start", "availability", "When could you start?", [[4, "Immediately / within 1 week"], [3, "Within 2 weeks"], [2, "Within 1 month"], [1, "In 1–2 months"], [0, "Not sure yet"]]),
  scored("avail_hours", "availability", "How many hours per week can you reliably work?", [[4, "The full hours listed for the role"], [3, "Most of the hours, with minor limits"], [2, "About half the hours"], [1, "Only a few hours a week"], [0, "My availability is very limited"]]),
  scored("skill_tools", "practical", "How comfortable are you with the day-to-day tools for this role (email, calendar, basic office / point-of-sale / childcare routines as relevant)?", [[4, "Very comfortable — I use them daily"], [3, "Comfortable"], [2, "Somewhat comfortable"], [1, "Learning, but willing"], [0, "Not comfortable yet"]]),
  scored("skill_learn", "practical", "When you do not know how to do something, what do you usually do?", [[4, "Ask, look it up, and learn it — then document it"], [3, "Ask someone and learn it"], [2, "Try on my own first, then ask"], [1, "Wait until someone shows me"], [0, "Avoid it if I can"]]),
  scored("mission_why", "mission", "Why does this kind of work — serving a small business or a church community — appeal to you?", [[4, "I care about the mission and the people served"], [3, "I like small teams and direct impact"], [2, "It sounds like a good fit for my skills"], [1, "I mainly need a job right now"], [0, "No particular reason"]]),
  scored("mission_team", "mission", "How do you handle working with people who hold different views or backgrounds than you?", [[4, "Respectfully, and I look for common ground"], [3, "Respectfully, and I focus on the work"], [2, "Usually fine"], [1, "It can be hard for me"], [0, "I prefer to avoid it"]]),
  scored("comm_example", "communication", "How would a previous manager, pastor, or teammate describe your communication?", [[4, "Clear, prompt, and reliable"], [3, "Clear and reliable"], [2, "Usually good"], [1, "Mixed — I am working on it"], [0, "Not sure / hard to say"]]),
  scored("reliability", "communication", "If you are running late or cannot make a shift, what do you do?", [[4, "Tell the team as early as possible and offer a plan"], [3, "Tell someone right away"], [2, "Tell someone when I can"], [1, "Usually just show up when I can"], [0, "Not sure"]]),
];

export const PREQUAL_ALL_QUESTIONS: PreQualQuestion[] = [...PREQUAL_KNOCKOUTS, ...PREQUAL_QUESTIONS];

export const PREQUAL_ROLES = ["Ministry Coordinator", "Office Assistant", "Retail Associate", "Childcare Assistant", "Other / General"];

export type PreQualAnswers = Record<string, number>;

export type PreQualResult = {
  score: number;
  breakdown: Record<PreQualCategory, number>;
  recommendation: PreQualRecommendation;
  knockoutFailed: boolean;
  knockoutReason: string | null;
  flags: string[];
  modelVersion: string;
};

export function scorePreQual(answers: PreQualAnswers): PreQualResult {
  const cats: Record<PreQualCategory, number> = {
    experience: 0,
    availability: 0,
    practical: 0,
    mission: 0,
    communication: 0,
  };
  let knockoutFailed = false;
  let knockoutReason: string | null = null;
  for (const q of PREQUAL_KNOCKOUTS) {
    if (answers[q.id] === 0) {
      knockoutFailed = true;
      knockoutReason = q.label;
      break;
    }
  }
  for (const q of PREQUAL_QUESTIONS) {
    const v = answers[q.id] ?? 0;
    if (q.category) cats[q.category] += v;
  }
  const breakdown = {} as Record<PreQualCategory, number>;
  let score = 0;
  (Object.keys(cats) as PreQualCategory[]).forEach((k) => {
    breakdown[k] = Math.round((cats[k] / MAX_PER_CATEGORY) * PREQUAL_WEIGHTS[k]);
    score += breakdown[k];
  });
  let recommendation: PreQualRecommendation = score >= 80 ? "advance" : score >= 60 ? "review" : "not_advancing";
  if (knockoutFailed) recommendation = "not_advancing";

  const flags: string[] = [];
  if (knockoutFailed && knockoutReason) flags.push(`Knockout: ${knockoutReason}`);
  const lowest = (Object.entries(breakdown) as [PreQualCategory, number][]).sort(
    (a, b) => a[1] / PREQUAL_WEIGHTS[a[0]] - b[1] / PREQUAL_WEIGHTS[b[0]],
  )[0];
  if (!knockoutFailed && lowest[1] / PREQUAL_WEIGHTS[lowest[0]] < 0.5) {
    flags.push(`Lowest area: ${lowest[0]} (${lowest[1]} / ${PREQUAL_WEIGHTS[lowest[0]]})`);
  }
  if (flags.length === 0) flags.push("No major flags");

  return { score, breakdown, recommendation, knockoutFailed, knockoutReason, flags, modelVersion: PREQUAL_MODEL_VERSION };
}

export const RECOMMENDATION_LABEL: Record<PreQualRecommendation, string> = {
  advance: "Advance",
  review: "Review",
  not_advancing: "Not advancing",
};
