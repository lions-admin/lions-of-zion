# Permission UI

The server is authoritative.

Frontend permission UI exists to explain and prevent impossible actions, not to provide security.

For unavailable actions:

- hide only when discovery would itself be inappropriate;
- otherwise disable with a clear reason when users benefit from understanding capability;
- do not imply the action succeeded if the server rejects it;
- handle authorization changes between page load and submit.

Never expose sensitive records merely because a UI control is hidden.
