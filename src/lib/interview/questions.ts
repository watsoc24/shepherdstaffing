/**
 * M7 Interview — the async structured interview. One interview per
 * candidate: six written questions, answered in their own time, encrypted
 * at rest. A recruiter (admin) scores each answer 0–4 and writes an
 * evaluation; the candidate chooses which matched churches may see the
 * evaluation. Churches see the score and the evaluation — never the
 * candidate's raw answers. Those stay between the candidate and Shepherd.
 *
 * Score: sum of the six 0–4 question scores (max 24), scaled to 0–100.
 */

export interface InterviewQuestion {
  id: string;
  prompt: string;
  hint: string;
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: "calling",
    prompt: "Tell us about the moment you knew ministry was your calling — and how that calling has been tested since.",
    hint: "We are listening for a real story, not a slogan. Name the moment and the cost.",
  },
  {
    id: "doctrine",
    prompt: "In your own words, what do you believe about Scripture, and how does that shape the way you preach and lead?",
    hint: "Say what you believe, not what you think we want to hear.",
  },
  {
    id: "conflict",
    prompt: "Describe a conflict with a leader or a team member that you handled badly, and what you would do differently now.",
    hint: "Own it. Everyone has one; the question is what you learned.",
  },
  {
    id: "team",
    prompt: "What does a healthy ministry team look like to you, and what is your part in building one?",
    hint: "Think about the last team you were part of, not an ideal one.",
  },
  {
    id: "failure",
    prompt: "Tell us about a ministry initiative that failed. What did you learn, and what did you change?",
    hint: "A specific failure, with a specific lesson.",
  },
  {
    id: "family",
    prompt: "Ministry and family compete for the same hours. How do you protect your family, and what do you need from a church to do that well?",
    hint: "Be concrete — rhythms, boundaries, and what you actually ask for.",
  },
];

export const INTERVIEW_CONSENT_TEXT =
  "By starting this interview you agree that Shepherd Staffing may store your answers encrypted, share the evaluation — not your raw answers — only with churches you choose, and keep your answers private from other candidates and churches. You can request a copy or a deletion of your answers at any time.";

export const ANSWER_MIN_LENGTH = 10;
export const ANSWER_MAX_LENGTH = 2000;

/** Every question answered, within length limits. Returns the problems, if any. */
export function validateAnswers(answers: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const q of INTERVIEW_QUESTIONS) {
    const a = (answers[q.id] ?? "").trim();
    if (a.length < ANSWER_MIN_LENGTH) problems.push(`"${q.prompt.slice(0, 40)}…" needs at least ${ANSWER_MIN_LENGTH} characters.`);
    if (a.length > ANSWER_MAX_LENGTH) problems.push(`"${q.prompt.slice(0, 40)}…" must be under ${ANSWER_MAX_LENGTH} characters.`);
  }
  return problems;
}

/** Evaluation scores: each question 0–4, whole numbers. Returns the problems, if any. */
export function validateEvaluation(scores: Record<string, number>): string[] {
  const problems: string[] = [];
  for (const q of INTERVIEW_QUESTIONS) {
    const s = scores[q.id];
    if (!Number.isInteger(s) || s < 0 || s > 4) problems.push(`Score for "${q.id}" must be a whole number from 0 to 4.`);
  }
  return problems;
}

export function scoreEvaluation(scores: Record<string, number>): number {
  const total = INTERVIEW_QUESTIONS.reduce((sum, q) => sum + (scores[q.id] ?? 0), 0);
  return Math.round((total / (INTERVIEW_QUESTIONS.length * 4)) * 100);
}
