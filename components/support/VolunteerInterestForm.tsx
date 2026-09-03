'use client';

/**
 * Volunteer interest intake, wired to the public email-delivery endpoint.
 */
import { FormEvent, useState } from 'react';
import { Button, CheckboxField, Field, FieldGroup, assertiveLive, politeLive } from '@/components/ui';
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
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const toggleSkill = (skill: string) => {
    setSkills((current) =>
      current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill],
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const response = await fetch('/api/v1/volunteer-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, skills, languages, availability }),
      });
      if (!response.ok) throw new Error('send failed');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className={styles.receipt} {...politeLive}>
        <p>Thanks — your interest reached the volunteer desk.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {/*
        Same failure as the report form with scripting off — no `action`, so
        submit is a native GET to /support-us and the reload reads as a send.
        This form has somewhere honest to send people, though: the handler
        below only pre-fills an email, so a plain `mailto:` to the same inbox
        loses the typed fields but nothing else. The button is removed in this
        tier so the only visible affordance is the one that works. Replacing
        the whole form with this link is not on the table — the composed body
        carries five typed fields a fixed href cannot, and the mailto
        composition is a documented decision (`.ai/DECISIONS.md`, 2026-08-25).
      */}
      <noscript>
        <style>{`.${styles.form} button[type='submit'] { display: none; }`}</style>
        <p className={styles.formNote}>
          This form pre-fills an email, which needs JavaScript. Write to{' '}
          <a href={`mailto:${VOLUNTEER_INBOX}`}>{VOLUNTEER_INBOX}</a> instead and tell us your
          languages, skill areas and availability.
        </p>
      </noscript>

      <Field
        id="volunteer-name"
        label="Name (optional)"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <Field
        id="volunteer-email"
        label="Email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <FieldGroup legend="Skill areas">
        {SKILL_AREAS.map((skill) => (
          <CheckboxField
            key={skill}
            label={skill}
            checked={skills.includes(skill)}
            onChange={() => toggleSkill(skill)}
          />
        ))}
      </FieldGroup>

      <Field
        id="volunteer-languages"
        label="Languages you work in"
        type="text"
        value={languages}
        onChange={(event) => setLanguages(event.target.value)}
        placeholder="Hebrew, Arabic, English…"
      />

      <Field
        id="volunteer-availability"
        label="Availability"
        type="text"
        value={availability}
        onChange={(event) => setAvailability(event.target.value)}
        placeholder="A few hours a week, evenings…"
      />

      {status === 'error' ? (
        <p className={styles.fieldError} {...assertiveLive}>
          We could not send this right now. Email <a href={`mailto:${VOLUNTEER_INBOX}`}>{VOLUNTEER_INBOX}</a> instead.
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={status === 'sending'}
        isLoading={status === 'sending'}
      >
        {status === 'sending' ? 'Sending…' : 'Send interest'}
      </Button>
      <p className={styles.formNote}>Your message is sent securely to the volunteer desk.</p>
    </form>
  );
}
