# Async Resilience

Every async action needs explicit states.

At minimum:

- idle;
- pending;
- success;
- empty when applicable;
- recoverable error;
- terminal error when applicable.

Consider:

- cancellation;
- stale request suppression;
- retry;
- offline behavior;
- session expiry;
- conflict/version mismatch;
- optimistic rollback;
- partial success;
- long-running progress.

Never allow an endless spinner to become the error state.

Reserve layout geometry so async state changes do not move primary controls unexpectedly.

When multiple requests can overlap, abort superseded work or ignore stale responses.
