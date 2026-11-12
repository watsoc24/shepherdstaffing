import { candidates, churches, interviews, matches } from "../db";
import { forbidden, notFound } from "../api/errors";
import { INTERVIEW_CONSENT_VERSION } from "../legal";
import { decrypt, encrypt } from "../security/crypto";
import { audit } from "../security/audit";
import { INTERVIEW_QUESTIONS, scoreEvaluation, validateAnswers, validateEvaluation } from "./questions";

const ANSWERS_FIELD = "interview.answers";

async function candidateFor(userId: string) {
  const c = await candidates.findByUserId(userId);
  if (!c) throw forbidden("Only candidates take the interview.");
  return c;
}

async function ownInterview(userId: string, interviewId: string) {
  const c = await candidateFor(userId);
  const interview = await interviews.findById(interviewId);
  if (!interview || interview.candidateId !== c.id) throw notFound("Interview not found");
  return { candidate: c, interview };
}

function decryptAnswers(answersEnc: string | null): Record<string, string> {
  if (!answersEnc) return {};
  try {
    return JSON.parse(decrypt(answersEnc, ANSWERS_FIELD)) as Record<string, string>;
  } catch {
    return {};
  }
}

/** The candidate's latest interview (with their own answers), plus the matched churches they may share it with. */
export async function getOwnInterview(userId: string) {
  const c = await candidateFor(userId);
  const latest = await interviews.latestForCandidate(c.id);
  const shareTargets = (await matches.forCandidate(c.id)).map((m) => ({
    id: m.church.id,
    displayCode: m.church.displayCode,
    position: m.church.position,
    shared: latest ? latest.shareWithChurchIds.includes(m.church.id) : false,
  }));
  if (!latest) return { interview: null, shareTargets };
  return {
    interview: {
      id: latest.id,
      status: latest.status,
      consentTextVersion: latest.consentTextVersion,
      answers: decryptAnswers(latest.answersEnc),
      submittedAt: latest.submittedAt?.toISOString() ?? null,
      score: latest.score,
      retakeAllowed: latest.retakeAllowed,
      shareWithChurchIds: latest.shareWithChurchIds,
    },
    shareTargets,
  };
}

/** Start a fresh draft, or return the open draft. A submitted interview can only be retaken after an admin allows it. */
export async function startInterview(userId: string) {
  const c = await candidateFor(userId);
  const latest = await interviews.latestForCandidate(c.id);
  if (latest && latest.status === "draft") return { interviewId: latest.id, isNew: false };
  if (latest && latest.status !== "draft" && !latest.retakeAllowed) {
    throw forbidden("You have already submitted an interview. Ask Shepherd Staffing for a retake if you need one.");
  }
  const created = await interviews.createDraft(c.id, INTERVIEW_CONSENT_VERSION);
  return { interviewId: created.id, isNew: true };
}

/** Save draft answers (encrypted at rest). Drafts only — a submitted interview is locked. */
export async function saveAnswers(userId: string, interviewId: string, answers: Record<string, string>) {
  const { interview } = await ownInterview(userId, interviewId);
  if (interview.status !== "draft") throw forbidden("This interview is already submitted and locked.");
  const problems = validateAnswers(answers);
  if (problems.length > 0) throw forbidden(problems.join(" "));
  await interviews.saveAnswers(interviewId, encrypt(JSON.stringify(answers), ANSWERS_FIELD));
}

/** Submit the interview. Every question answered, then the draft locks. */
export async function submitInterview(userId: string, interviewId: string) {
  const { interview } = await ownInterview(userId, interviewId);
  if (interview.status !== "draft") throw forbidden("This interview is already submitted.");
  const problems = validateAnswers(decryptAnswers(interview.answersEnc));
  if (problems.length > 0) throw forbidden(`Answer all six questions before submitting. ${problems.join(" ")}`);
  await interviews.submit(interviewId);
}

/** Choose which matched churches may see the evaluation. Sharing is the candidate's, not ours, to give. */
export async function setSharing(userId: string, interviewId: string, churchIds: string[]) {
  const { candidate, interview } = await ownInterview(userId, interviewId);
  const matched = (await matches.forCandidate(candidate.id)).map((m) => m.churchId);
  const unshared = churchIds.filter((id) => !matched.includes(id));
  if (unshared.length > 0) throw forbidden("You can only share with churches you matched with.");
  await interviews.setShare(interview.id, churchIds);
}

/** Recruiter/admin evaluation: a 0–4 score per question, notes, and an overall note. The score is the rubric, not a model. */
export async function evaluateInterview(input: {
  adminUserId: string;
  interviewId: string;
  scores: Record<string, number>;
  notes: Record<string, string>;
  recruiterNotes: string | null;
}) {
  const interview = await interviews.findById(input.interviewId);
  if (!interview) throw notFound("Interview not found");
  if (interview.status === "draft") throw forbidden("Only a submitted interview can be evaluated.");
  const problems = validateEvaluation(input.scores);
  if (problems.length > 0) throw forbidden(problems.join(" "));
  const score = scoreEvaluation(input.scores);
  const evaluationJson = {
    scores: input.scores,
    notes: input.notes,
    questions: INTERVIEW_QUESTIONS.map((q) => ({ id: q.id, prompt: q.prompt })),
  };
  await interviews.saveEvaluation(input.interviewId, evaluationJson, score);
  await interviews.setRecruiterNotes(input.interviewId, input.recruiterNotes);
  return { score };
}

/** Admin: allow the candidate to take the interview again. Audited. */
export async function allowInterviewRetake(adminUserId: string, interviewId: string) {
  const interview = await interviews.findById(interviewId);
  if (!interview) throw notFound("Interview not found");
  await interviews.allowRetake(interviewId);
  await audit("admin.interview_retake", { actorUserId: adminUserId, targetType: "interview", targetId: interviewId });
}

/** Evaluated interviews shared with this church. Scores and evaluations only — never raw answers. */
export async function listSharedForChurch(userId: string) {
  const church = await churches.findByUserId(userId);
  if (!church) throw forbidden("Only churches view shared results.");
  const rows = await interviews.sharedWithChurch(church.id);
  return rows.map((r) => ({
    id: r.id,
    candidate: { displayCode: r.candidate.displayCode, position: r.candidate.position },
    score: r.score,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    recruiterNotes: r.recruiterNotes,
  }));
}

/** One shared result, with the full evaluation. The church must be one the candidate chose. */
export async function getResultForChurch(userId: string, interviewId: string) {
  const church = await churches.findByUserId(userId);
  if (!church) throw forbidden("Only churches view shared results.");
  const interview = await interviews.findById(interviewId);
  if (!interview) throw notFound("Interview not found");
  if (interview.status !== "evaluated") throw forbidden("This interview has not been evaluated yet.");
  if (!interview.shareWithChurchIds.includes(church.id)) throw forbidden("This result was not shared with you.");
  return {
    id: interview.id,
    candidate: { displayCode: interview.candidate.displayCode, position: interview.candidate.position },
    score: interview.score,
    submittedAt: interview.submittedAt?.toISOString() ?? null,
    recruiterNotes: interview.recruiterNotes,
    evaluation: interview.evaluationJson,
  };
}
