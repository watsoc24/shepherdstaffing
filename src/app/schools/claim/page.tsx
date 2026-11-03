import { requireSchoolAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { TextArea, TextField } from "@/components/fields";
import { uuidSchema } from "@/lib/validation";
import { submitClaim } from "../actions";

export const metadata = { title: "Claim your school" };

export default async function ClaimPage({ searchParams }: PageProps<"/schools/claim">) {
  const { school: schoolParam } = await searchParams;
  await requireSchoolAdmin("/schools/claim");
  const supabase = await createClient();
  const schoolId = uuidSchema.safeParse(schoolParam).success ? (schoolParam as string) : null;
  const { data: school } = schoolId
    ? await supabase.from("schools").select("id, name, status").eq("id", schoolId).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="page-title">{school ? `Claim ${school.name}` : "Add your school"}</h1>
      <p className="text-sm text-gray-600">
        A member of our team checks every claim by hand before you can edit the listing — usually by emailing the
        address on your school&apos;s official website or confirming your registration with your governing body.
      </p>
      <div className="card">
        <ActionForm action={submitClaim} submitLabel="Submit claim">
          {school ? (
            <input type="hidden" name="schoolId" value={school.id} />
          ) : (
            <>
              <TextField label="School name" name="proposedName" required maxLength={120} />
              <TextField label="City" name="proposedCity" maxLength={80} />
              <TextField label="State / region" name="proposedRegion" maxLength={80} />
              <TextField label="Country" name="proposedCountry" maxLength={56} defaultValue="US" />
              <TextField label="School website (optional)" name="proposedWebsite" type="url" placeholder="https://" maxLength={300} />
            </>
          )}
          <TextField label="Your role at the school" name="claimantTitle" required maxLength={80} hint="For example: Owner, TCRG, Office manager" />
          <TextField
            label="Contact email for verification"
            name="contactEmail"
            type="email"
            required
            maxLength={254}
            hint="Ideally an address on your school's own website domain."
          />
          <TextArea
            label="How can we verify you?"
            name="evidence"
            required
            minLength={10}
            maxLength={1000}
            hint="For example: your name is on our website's About page; our TCRG registration number; a phone number listed publicly for the school."
          />
        </ActionForm>
      </div>
    </div>
  );
}
