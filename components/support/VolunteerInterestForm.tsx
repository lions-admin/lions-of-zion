'use client';

/**
 * Volunteer interest intake, wired to the public email-delivery endpoint.
 */
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckboxField } from '@/components/ui/CheckboxField';
import { Field } from '@/components/ui/Field';
import { FieldGroup } from '@/components/ui/FieldGroup';
import { assertiveLive, politeLive } from '@/components/ui/live-region';
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

  const sending = status === 'sending';

  return (
    /*
      A11Y-007. The send failure is a fact about the submission, not about any
      one field — the endpoint composes a mail from all five and reports one
      result — so it stays a form-level summary and the form is described by
      it. The no-JavaScript notice is referenced the same way: with scripting
      on it is not in the DOM at all and the reference is simply ignored, which
      is the behaviour wanted in both tiers.
    */
    <form
      className={styles.form}
      onSubmit={submit}
      aria-busy={sending || undefined}
      aria-describedby={['volunteer-noscript', status === 'error' ? 'volunteer-failure' : null].filter(Boolean).join(' ')}
    >
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
        <p id="volunteer-noscript" className={styles.formNote}>
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
        disabled={sending}
        onChange={(event) => setName(event.target.value)}
      />

      <Field
        id="volunteer-email"
        label="Email"
        type="email"
        required
        value={email}
        disabled={sending}
        onChange={(event) => setEmail(event.target.value)}
      />

      {/* A11Y-007: a real `<fieldset>` with a `<legend>`, so the three boxes
          are announced as one named group rather than three loose controls.
          `disabled` on the fieldset reaches every box inside it. */}
      <FieldGroup legend="Skill areas" disabled={sending}>
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
        disabled={sending}
        onChange={(event) => setLanguages(event.target.value)}
        placeholder="Hebrew, Arabic, English…"
      />

      <Field
        id="volunteer-availability"
        label="Availability"
        type="text"
        value={availability}
        disabled={sending}
        onChange={(event) => setAvailability(event.target.value)}
        placeholder="A few hours a week, evenings…"
      />

      {status === 'error' ? (
        <p id="volunteer-failure" className={styles.fieldError} {...assertiveLive}>
          We could not send this right now. Nothing you typed was cleared — press Send interest
          again, or email <a href={`mailto:${VOLUNTEER_INBOX}`}>{VOLUNTEER_INBOX}</a> instead.
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={sending}
        isLoading={sending}
      >
        {sending ? 'Sending…' : 'Send interest'}
      </Button>
      <p className={styles.formNote}>Your message is sent securely to the volunteer desk.</p>
    </form>
  );
}
