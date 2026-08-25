import { SensitiveContent } from 'lions-of-zion';

/**
 * Difficult material behind an explicit reveal. The card shows the closed
 * state, which is the state that matters — it is what a reader meets first,
 * and it deliberately remembers nothing between visits.
 */
export function BeforeReveal() {
  return (
    <SensitiveContent warning="Survivor testimony describing the attack on Kfar Aza.">
      <p>
        The revealed material sits here. It is part of the client bundle, so it stays
        serializable — plain JSX and strings, with no second interactive boundary inside.
      </p>
    </SensitiveContent>
  );
}

export function ShorterWarning() {
  return (
    <SensitiveContent warning="Contains graphic description of injury.">
      <p>Revealed content.</p>
    </SensitiveContent>
  );
}
