# Token Mapping

Every durable visual token should have one canonical path.

Example:

`Owner's current direction → runtime CSS variables → shared component`

Avoid:

- duplicating the same hex value in unrelated files;
- copying radius/spacing constants into screen-local CSS;
- maintaining separate dark/light values with no canonical mapping;
- letting design documentation and runtime tokens drift.

For each changed token, document:

- normative name;
- runtime owner;
- generated/adapted outputs;
- affected shared primitives.
