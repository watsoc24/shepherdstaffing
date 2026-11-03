import { CATEGORIES, CONDITIONS } from "@/lib/validation";
import { COUNTRIES } from "@/lib/money";
import { Select, TextArea, TextField } from "@/components/fields";

export type ListingDefaults = {
  title: string;
  description: string;
  category: string;
  size_label: string;
  price_cents: number;
  shipping_cents: number;
  condition: string;
  city: string;
  region: string;
  country: string;
};

const cents = (n?: number) => (n === undefined ? undefined : (n / 100).toFixed(2));

export function ListingFields({ listing }: { listing?: ListingDefaults }) {
  return (
    <>
      <TextField label="Title" name="title" required minLength={3} maxLength={100} defaultValue={listing?.title} hint="For example: Blue and gold solo dress" />
      <Select label="Category" name="category" options={CATEGORIES} placeholder="Choose…" required defaultValue={listing?.category ?? ""} />
      <TextField label="Size" name="size_label" required maxLength={40} defaultValue={listing?.size_label} hint="Age range, measurements or shoe size" />
      <Select label="Condition" name="condition" options={CONDITIONS} placeholder="Choose…" required defaultValue={listing?.condition ?? ""} />
      <TextField label="Price" name="price" inputMode="decimal" required defaultValue={cents(listing?.price_cents)} hint="Minimum 10.00" />
      <TextField label="Shipping (0 for local pickup only)" name="shipping" inputMode="decimal" defaultValue={cents(listing?.shipping_cents) ?? "0"} />
      <TextArea label="Description" name="description" maxLength={2000} defaultValue={listing?.description} hint="Don't include your address, phone number, or your child's name or school." />
      <TextField label="City or town" name="city" required maxLength={80} defaultValue={listing?.city} />
      <TextField label="State / region" name="region" required maxLength={80} defaultValue={listing?.region} />
      <Select label="Country" name="country" options={COUNTRIES.map((c) => [c.code, c.name] as const)} required defaultValue={listing?.country ?? "US"} />
    </>
  );
}
