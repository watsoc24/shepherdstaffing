import { DANCE_LEVELS } from "@/lib/validation";
import { Select, TextField } from "@/components/fields";

type Child = { nickname: string; birth_year: number | null; dance_level: string | null; school_id: string | null };

export function ChildFields({ child, schools }: { child?: Child; schools: { id: string; name: string }[] }) {
  const year = new Date().getFullYear();
  const years = Array.from({ length: 31 }, (_, i) => String(year - i)).map((y) => [y, y] as const);
  return (
    <>
      <TextField
        label="Nickname or first name"
        name="nickname"
        required
        maxLength={40}
        defaultValue={child?.nickname}
        hint="Only you can see this. A nickname is fine."
      />
      <Select label="Birth year (optional)" name="birthYear" options={years} placeholder="Prefer not to say" defaultValue={child?.birth_year ? String(child.birth_year) : ""} />
      <Select label="Level (optional)" name="danceLevel" options={DANCE_LEVELS} placeholder="Not set" defaultValue={child?.dance_level ?? ""} />
      <Select
        label="School (optional)"
        name="schoolId"
        options={schools.map((s) => [s.id, s.name] as const)}
        placeholder="Not set"
        defaultValue={child?.school_id ?? ""}
      />
    </>
  );
}
