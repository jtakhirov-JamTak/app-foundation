# App Decision log

Why **this app** is built the way it is, newest first. Product decisions: the data model this
domain needs, the trade-offs its users forced, the optimizations measured and rejected here.
Entries are kept verbatim, including the measurements that settled them — a rejected
optimization is only useful if the evidence against it survives.

[`DECISIONS.md`](DECISIONS.md) beside this file is the **foundation's** decision log, inherited
from the template. It explains why the foundation is shaped the way it is — the CSP's missing
`script-src`, the zod analytics catalog, WSL2-only development — and is the place to look
before re-arguing something the template already settled with numbers. Do not add app decisions
to it.

A decision that would change how the _template_ behaves does not belong here either. That is a
foundation change, and it goes through playbook §4: build it in this app first, then port the
product-neutral version to the template with its regression test.

Format: `### YYYY-MM-DD — <the claim>`, then paragraphs each opening with a bolded lead
sentence and the evidence behind it. Current-state architecture lives in
[`../ARCHITECTURE.md`](../ARCHITECTURE.md); defects and their regression tests live in
[`APP_FIX_LOG.md`](APP_FIX_LOG.md).

In the template repository this file stays empty by design: the foundation is the product
there, so its decisions go to `DECISIONS.md`.

_No entries yet._
