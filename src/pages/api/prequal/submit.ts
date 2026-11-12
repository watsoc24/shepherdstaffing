import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { getAuth } from "@/lib/auth/guards";
import { candidates, churches, prequal } from "@/lib/db";
import { emailField, text } from "@/lib/security/sanitize";
import { PREQUAL_ALL_QUESTIONS, scorePreQual, type PreQualAnswers } from "@/lib/scoring/prequal";

const schema = z.object({
  name: text(120).pipe(z.string().min(1, "Please enter your name")),
  email: emailField,
  role: text(200).pipe(z.string().min(1, "Please choose a role")),
  churchId: z.string().max(50).optional(),
  answers: z.record(z.string(), z.number().int().min(0).max(4)),
});

/**
 * POST /api/prequal/submit — public lead-magnet endpoint.
 * Scores server-side from validated answers; a client-supplied score is never trusted.
 * Links the assessment to the signed-in candidate when one exists, and to a
 * church when a valid churchId is supplied. No free-text answers in v1.
 */
export default api({
  POST: async (req, res) => {
    const ip = clientIp(req);
    await limit("prequalSubmit", `ip:${ip}`);
    const body = parseBody(req, schema);

    for (const q of PREQUAL_ALL_QUESTIONS) {
      const v = body.answers[q.id];
      if (v === undefined || !q.options.some((o) => o.value === v)) {
        throw badRequest(`Please answer: ${q.label}`, [{ path: `answers.${q.id}`, message: "Please choose an answer" }]);
      }
    }
    const answers = body.answers as PreQualAnswers;
    const result = scorePreQual(answers);

    let candidateId: string | null = null;
    const auth = await getAuth(req, res).catch(() => null);
    if (auth?.user.role === "candidate") {
      const candidate = await candidates.findByUserId(auth.user.id);
      candidateId = candidate?.id ?? null;
    }

    let churchId: string | null = null;
    if (body.churchId) {
      const church = await churches.findById(body.churchId);
      if (!church) throw badRequest("That church could not be found.");
      churchId = church.id;
    }

    const assessment = await prequal.createAssessment({
      candidateId,
      churchId,
      applicantName: body.name,
      applicantEmail: body.email,
      role: body.role,
      answers,
      result,
    });

    res.status(201).json({
      ok: true,
      assessmentId: assessment.id,
      score: result.score,
      breakdown: result.breakdown,
      recommendation: result.recommendation,
      flags: result.flags,
      modelVersion: result.modelVersion,
    });
  },
});
