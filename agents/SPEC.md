# AGENT ROLE REGISTRY — SPEC (skeleton)

> **Status: SKELETON.** `agents/index.js` publishes `PLANNED_ROLES` and returns
> `notImplemented(...)` for registration/authorization. The engine lives in
> `core/agent`; this directory is the CENSUS of roles.

Planned roles (least privilege, verification duties included):

| Role | Duty | May write |
| --- | --- | --- |
| contextualizer | load all four memories before any reasoning | no |
| planner | decision → ordered, verifiable, reversible steps | no |
| executor | minimal patches through the mutation protocol | yes, with checkpoint + verify |
| verifier | run the 4 verification levels, refuse what fails | no |
| recoverer | classify interruptions, execute recovery | yes, human approval for security_stop/scope_change |
| documenter | regenerate `documentation/generated` | that folder only |
| librarian | keep glossary, trilingual model and graph consistent | knowledge base only |

Rules: a role is DATA (validable, listable, comparable), not prose; an instance is
one run of a role; refusing an action emits `INTERRUPTION_RAISED / security_stop`.
