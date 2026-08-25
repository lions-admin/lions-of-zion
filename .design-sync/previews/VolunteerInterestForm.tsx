import { VolunteerInterestForm } from 'lions-of-zion';

/**
 * Volunteer intake. There is no endpoint for this — it composes a `mailto:`
 * rather than faking a "sent" state, which was a deliberate choice recorded in
 * `.ai/DECISIONS.md`.
 */
export function EmptyForm() {
  return <VolunteerInterestForm />;
}
