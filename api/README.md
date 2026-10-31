# API specifications

OpenAPI 3.1, one document per service. The conventions these follow, and the
reasoning behind them, are in [`../docs/api-design.md`](../docs/api-design.md);
the service boundaries are in
[`../docs/microservices-design.md`](../docs/microservices-design.md).

| File | Service |
|---|---|
| `common.yaml` | Shared schemas, parameters and responses. Defines no paths |
| `identity-and-firm.openapi.yaml` | Firm, users, roles, tenancy |
| `reference-data.openapi.yaml` | Instruments, prices, tax rules |
| `advisory-core.openapi.yaml` | Clients, holdings, taxonomy, models, targets, plans, recommendations |
| `analytics.openapi.yaml` | Drift, projections, scenarios |
| `ingestion.openapi.yaml` | Documents, imports, bank data |
| `audit.openapi.yaml` | The audit feed |

These are a design artefact, not generated from code. Nothing is implemented
yet. When implementation starts, decide deliberately whether the specification
leads the code or is generated from it — and if the code leads, delete these
rather than letting them drift.

## Validating

```
npx @redocly/cli lint api/*.openapi.yaml
```

`redocly.yaml` records which recommended rules are deliberately disabled and
why, so a clean run means something. All six documents currently validate with
no warnings.

## Previewing

```
npx @redocly/cli preview-docs api/advisory-core.openapi.yaml
```
