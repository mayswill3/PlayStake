# PlayStake compliance documents

Drafts prepared for the Gambling Commission remote operating licence
application. Each is available as Markdown (here) and PDF (`pdf/`), plus one
combined PDF of the whole set (`pdf/PlayStake-Compliance-Manual-complete.pdf`).

| No. | Document |
|---|---|
| 00 | [Master Compliance Manual](00-master-compliance-manual.md) — governance, key people, cross-cutting controls, and the list of items still outstanding before submission (§8) |
| 01 | [Crime Prevention and Fraud Controls](01-crime-prevention-and-fraud-controls.md) |
| 02 | [Complaints Procedure and ADR (IBAS)](02-complaints-and-adr.md) |
| 03 | [Self-Exclusion](03-self-exclusion.md) |
| 04 | [Multi-Operator Self-Exclusion (GAMSTOP)](04-multi-operator-self-exclusion-gamstop.md) |
| 05 | [Customer Interaction and Harm Prevention](05-customer-interaction-and-harm-prevention.md) |
| 06 | [Age Verification](06-age-verification.md) |
| 07 | [AML Risk Assessment and Controls](07-aml-risk-assessment-and-controls.md) |
| 08 | [System Diagram and Outsourcing Map](08-system-diagram-and-outsourcing-map.md) |
| 09 | [End-to-End Customer and System Flow](09-end-to-end-flow.md) |
| 10 | [Operational Model Map](10-operational-model-map.md) |
| 11 | [Testing Strategy](11-testing-strategy.md) |
| 12 | [RTS Compliance Statement and Change Register](12-rts-compliance-and-change-register.md) |
| 13 | [Information Security Policy (ISO/IEC 27001:2022 mapping)](13-information-security.md) |
| 14 | [Incident Response and Key Event Reporting](14-incident-response-and-key-events.md) |
| 15 | [UAE (GCGRA) Certification Plan](15-uae-gcgra-certification-plan.md) — planning draft |

**Before submission:**
- Replace every `[PLACEHOLDER]`.
- Work through the outstanding items in the Master Manual §8.
- Have the set reviewed by a gambling-compliance adviser or solicitor. LCCP references and Commission thresholds must be confirmed against the current versions.

**Keeping them in step with the code:**
- The documents describe controls that exist in the code (mainly `src/lib/compliance`, `src/lib/responsible-play`, `src/lib/complaints`, `src/lib/games`, `src/lib/ledger`).
- Diagrams in 08–10 are Mermaid; the PDFs render them. Regenerate the PDFs with `make-pdfs.mjs` (instructions at the top of the file).
- Update them whenever those controls change, then regenerate the PDFs from the Markdown.
