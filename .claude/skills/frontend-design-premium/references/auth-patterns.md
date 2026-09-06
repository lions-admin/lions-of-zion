# Auth Patterns

Authentication UI must support:

- password managers;
- paste;
- keyboard use;
- useful autocomplete;
- clear failure recovery;
- session expiration handling.

Do not:

- disable paste;
- expose secret values in logs;
- conflate authentication with authorization;
- rely on hidden frontend controls as security.

When a session expires during work, preserve recoverable user state when safe and provide a clear re-authentication path.
