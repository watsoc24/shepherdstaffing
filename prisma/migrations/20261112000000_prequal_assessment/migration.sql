-- CreateEnum
CREATE TYPE "PreQualRecommendation" AS ENUM ('advance', 'review', 'not_advancing');

-- CreateTable
CREATE TABLE "PreQualAssessment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "churchId" TEXT,
    "applicantName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "recommendation" "PreQualRecommendation" NOT NULL,
    "knockoutFailed" BOOLEAN NOT NULL DEFAULT false,
    "flags" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreQualAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreQualAssessment_churchId_score_idx" ON "PreQualAssessment"("churchId", "score");

-- CreateIndex
CREATE INDEX "PreQualAssessment_candidateId_createdAt_idx" ON "PreQualAssessment"("candidateId", "createdAt");

-- AddForeignKey
ALTER TABLE "PreQualAssessment" ADD CONSTRAINT "PreQualAssessment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreQualAssessment" ADD CONSTRAINT "PreQualAssessment_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
