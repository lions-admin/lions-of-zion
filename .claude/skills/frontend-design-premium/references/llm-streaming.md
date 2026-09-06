# LLM Streaming Interfaces

Distinguish real states:

- ready;
- submitting;
- connecting;
- retrieving;
- tool-use;
- streaming;
- complete;
- cancelled;
- failed.

Do not fake progress percentages.

Keep the composer stable during generation.

Support cancellation when generation can be meaningfully stopped.

On recoverable failure, preserve partial output when safe and explain whether the answer is incomplete.

If the product claims grounded answers:

- show real citations/sources;
- never fabricate source count;
- never fabricate verification state;
- never fabricate confidence;
- clearly distinguish no evidence from model uncertainty.

For source-heavy answers, separate:

1. finding;
2. supporting evidence;
3. sources.

Use accessible live regions without reading every streaming token aloud.
