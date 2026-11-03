import { TextField } from "@/components/fields";

export function FeisFields() {
  return (
    <>
      <TextField label="Event name" name="name" required minLength={3} maxLength={150} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="First day" name="startsOn" type="date" required />
        <TextField label="Last day" name="endsOn" type="date" required />
      </div>
      <TextField label="Venue (optional)" name="venueName" maxLength={150} />
      <TextField label="City" name="city" required maxLength={80} />
      <TextField label="State / region" name="region" maxLength={80} />
      <TextField label="Country" name="country" required maxLength={56} defaultValue="US" />
      <TextField
        label="Official registration link"
        name="registrationUrl"
        type="url"
        required
        maxLength={500}
        placeholder="https://"
        hint="Link to the organizer's registration or syllabus page. Must start with https://"
      />
    </>
  );
}
