---
description: Implementatie workflow - leest CLAUDE.md conventies en voert code wijzigingen uit conform projectstandaarden
---

## Pre-implementatie: Projectconventies laden

// turbo

1. Lees `CLAUDE.md` in de project root voor alle projectconventies
   // turbo
2. Lees de relevante ADR of implementatieplan onder `plans/decisions/`

## Homey-specifieke conventies (samenvatting uit CLAUDE.md)

Tijdens implementatie, volg deze regels:

### Timers

- **ALTIJD** `this.homey.setTimeout()` / `this.homey.setInterval()` in plaats van globale `setTimeout()` / `setInterval()`

### Type Safety

- **NOOIT** `as any` — gebruik `@ts-expect-error` met uitleg als het nodig is

### Logging

- **NOOIT** `console.log()` — gebruik de structured Logger (`this.logger.error/warn/info/debug`)
- In services: gebruik het logger callback pattern (zie CLAUDE.md §Logging)

### Bestandsstructuur

- Capabilities: individuele JSON bestanden in `.homeycompose/capabilities/` met verplicht `"id"` en `"icon"` property
- Settings: in `driver.settings.compose.json` (NIET in `driver.compose.json`)
- Flow cards: in `.homeycompose/flow/` directory
- **NOOIT** `app.json` handmatig bewerken — wordt gegenereerd door Homey Compose

### Capability Migratie

- Nieuwe capabilities worden NIET automatisch toegevoegd aan bestaande devices
- Voeg migratie-code toe in `device.ts` `onInit()`:
  ```typescript
  const newCapabilities = ["capability_name"];
  for (const cap of newCapabilities) {
    if (!this.hasCapability(cap)) {
      await this.addCapability(cap);
      this.log(`Migration: Added ${cap}`);
    }
  }
  ```

## Implementatie

3. Implementeer de wijzigingen conform bovenstaande conventies
4. Controleer dat alle bestanden in de juiste Homey Compose structuur staan

## Verificatie

// turbo 5. Voer `npm run build` uit om TypeScript compilatie te verifiëren
// turbo 6. Voer `homey app validate` uit om de Homey app structuur te valideren
