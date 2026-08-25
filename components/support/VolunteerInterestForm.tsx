'use client';

/**
 * Volunteer interest intake. No backend endpoint exists for this yet — only
 * the public report endpoint is real (`ReportClaimForm.tsx`). Faking a
 * "Submitted!" state here would contradict this project's own "no false
 * live state" principle (see `.ai/DECISIONS.md`), so this composes a
 * pre-filled email instead: honest about what is and isn't wired up.
 *
 * VOLUNTEER_INBOX is a placeholder pending a confirmed real address —
 * flag before this ships to production.
 */
import { FormEvent, useState } from 'react';
import styles from './support.module.css';

const VOLUNTEER_INBOX = 'volunteers@lionsofzion.io';

const SKILL_AREAS = [
  'Open-source investigation',
  'Languages / translation',
  'Design and development',
] as const;

export function VolunteerInterestForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState('');
  const [availability, setAvailability] = useState('');

  const toggleSkill = (skill: string) => {
    setSkills((current) =>
      current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill],
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lines = [
      name ? `Name: ${name}` : null,
      email ? `Reply-to: ${email}` : null,
      skills.length ? `Skill areas: ${skills.join(', ')}` : null,
      languages ? `Languages: ${languages}` : null,
      availability ? `Availability: ${availability}` : null,
    ].filter((line): line is string => Boolean(line));

    const subject = encodeURIComponent('Volunteering with Lions of Zion');
    const bodyText = encodeURIComponent(
      lines.length ? lines.join('\n') : 'I would like to volunteer.',
    );
    window.location.href = `mailto:${VOLUNTEER_INBOX}?subject=${subject}&body=${bodyText}`;
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor="volunteer-name">Name (optional)</label>
        <input
          id="volunteer-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="volunteer-email">Email</label>
        <input
          id="volunteer-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Skill areas</legend>
        {SKILL_AREAS.map((skill) => (
          <label key={skill} className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={skills.includes(skill)}
              onChange={() => toggleSkill(skill)}
            />
            {skill}
          </label>
        ))}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="volunteer-languages">Languages you work in</label>
        <input
          id="volunteer-languages"
          type="text"
          value={languages}
          onChange={(event) => setLanguages(event.target.value)}
          placeholder="Hebrew, Arabic, English…"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="volunteer-availability">Availability</label>
        <input
          id="volunteer-availability"
          type="text"
          value={availability}
          onChange={(event) => setAvailability(event.target.value)}
          placeholder="A few hours a week, evenings…"
        />
      </div>

      <button type="submit">Continue by email</button>
      <p className={styles.formNote}>
        This opens your email client with the details above filled in — nothing is sent
        automatically.
      </p>
    </form>
  );
}
