// What a warung is known for.
//
// Single source of truth for the buyer home's filter chips AND the seller's
// picker. The slugs MUST stay in step with `stores_specialty_check` in
// 20260730000000_store_specialty_and_stats.sql — the database rejects anything
// outside this list, which is deliberate: a typo can't invent a category the
// chips are unable to render.

import { Feather } from '@expo/vector-icons';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type SpecialtySlug =
  | 'sembako'
  | 'bumbu'
  | 'jajanan'
  | 'gas_air'
  | 'beras'
  | 'rokok'
  | 'sayur_buah'
  | 'buka_24';

export type Specialty = {
  slug: SpecialtySlug;
  /** Shown on the chip and in the seller picker. */
  label: string;
  icon: FeatherName;
};

export const SPECIALTIES: Specialty[] = [
  { slug: 'sembako', label: 'Sembako', icon: 'shopping-bag' },
  { slug: 'beras', label: 'Beras', icon: 'package' },
  { slug: 'bumbu', label: 'Bumbu dapur', icon: 'feather' },
  { slug: 'sayur_buah', label: 'Sayur & buah', icon: 'sun' },
  { slug: 'jajanan', label: 'Jajanan', icon: 'coffee' },
  { slug: 'gas_air', label: 'Gas & air', icon: 'droplet' },
  { slug: 'rokok', label: 'Rokok', icon: 'wind' },
  { slug: 'buka_24', label: 'Buka 24 jam', icon: 'clock' },
];

const BY_SLUG = new Map(SPECIALTIES.map((s) => [s.slug, s]));

export const specialtyLabel = (slug: string): string => BY_SLUG.get(slug as SpecialtySlug)?.label ?? slug;

/**
 * "Bumbu dapur · Jajanan" for a warung's caption line. Unknown slugs fall
 * through as-is rather than being dropped, so bad data stays visible instead
 * of silently disappearing.
 */
export const specialtyCaption = (slugs: string[] | null | undefined): string =>
  (slugs ?? []).map(specialtyLabel).join(' · ');
