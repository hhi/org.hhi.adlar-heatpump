# Plans Directory

Gestructureerde opslag voor implementatieplannen, besluitvorming en feature designs.

## Directory Structuur

| Directory | Doel | Wanneer gebruiken |
|-----------|------|-------------------|
| `active/` | Lopende implementatieplannen | Features in ontwikkeling |
| `completed/` | Afgeronde plannen (archief) | Na implementatie verplaatsen |
| `decisions/` | Architecture Decision Records (ADRs) | Belangrijke technische keuzes |
| `templates/` | Herbruikbare templates | Basis voor nieuwe plannen |

## Naamgeving Conventies

### Feature Plans

```text
YYYY-MM-feature-naam.md
```

Voorbeelden:

- `2025-01-cop-optimization.md`
- `2025-02-multi-device-support.md`

### Decision Records (ADRs)

```text
ADR-NNN-korte-titel.md
```

Voorbeelden:

- `ADR-001-service-architecture.md`
- `ADR-002-error-handling-strategy.md`

## Workflow

```text
1. Nieuw plan      → Kopieer template naar active/
2. In uitvoering   → Update status in het plan
3. Afgerond        → Verplaats naar completed/
4. Beslissing      → Maak ADR in decisions/
```

## Status Indicatoren

Gebruik deze statussen in je plannen:

| Status | Betekenis |
|--------|-----------|
| `🟡 Planning` | Nog in ontwerp/analyse fase |
| `🔵 In Progress` | Actief in ontwikkeling |
| `🟢 Completed` | Volledig geïmplementeerd |
| `🔴 On Hold` | Gepauzeerd |
| `⚫ Cancelled` | Niet doorgegaan |

## Templates

Zie de `templates/` directory voor:

- [feature-plan.md](templates/feature-plan.md) - Template voor nieuwe features
- [decision-record.md](templates/decision-record.md) - Template voor ADRs

## Relatie met Andere Documentatie

| Locatie | Inhoud |
|---------|--------|
| `plans/` | **Wat we gaan bouwen** - toekomstgericht |
| `docs/architecture/` | **Hoe het werkt** - huidige staat |
| `docs/setup/` | **Hoe te gebruiken** - gebruikersdocumentatie |

## Best Practices

1. **Houd plannen up-to-date** - Update de status tijdens ontwikkeling
2. **Archiveer na afronding** - Verplaats naar `completed/` zodat `active/` overzichtelijk blijft
3. **Documenteer beslissingen** - Maak een ADR voor belangrijke technische keuzes
4. **Link naar code** - Verwijs naar relevante bestanden en commits
