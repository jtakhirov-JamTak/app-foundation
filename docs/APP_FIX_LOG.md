# App Fix Log

One entry per defect found in **this app's own code** — the product half of
[`.claude/ENGINEERING_PLAYBOOK.md`](../.claude/ENGINEERING_PLAYBOOK.md) §4 step 2. Same five
fields as the foundation log: date/version · problem · fix · regression test · where it was
found. Newest first.

[`FIX_LOG.md`](FIX_LOG.md) beside this file is the **foundation's** log, inherited from the
template. It records defects in the template, not in this app, and its `**Version:**` values
are template versions. Read it — several of its entries are gates that passed vacuously, which
is the fastest way to judge what the checks here are worth — but do not add to it unless you
are working in the template repository itself.

Which file an entry goes in is settled by playbook §4 step 2: _would the next
template-derived app hit this?_ No → it belongs here. Yes → the product-neutral version goes to
the template's `docs/FIX_LOG.md` per §4 steps 3–8, **and** an entry stays here recording the
app-side fix that prompted it, citing the template version in `foundation.json` so a later
reader can tell whether this app has already picked the fix back up.

In the template repository this file stays empty by design: the foundation is the product
there, so its defects go to `FIX_LOG.md`.

_No entries yet._
