---
name: svg-icons
description: Rules for creating or editing SVG icons in this Homey app (iOS/Safari WebKit compatibility). Use for any new or changed SVG in assets/, and by the svg-icon-designer agent.
---

## 🎨 SVG Icon Guidelines (MANDATORY for svg-icon-designer agent)

**CRITICAL: iOS/Safari Compatibility Requirements**

SVG icons in this Homey app MUST be compatible with iOS/Safari (WebKit). WebKit has a known bug where it does NOT correctly inherit `stroke`, `fill`, and other styling attributes from the root `<svg>` element.

### ❌ FORBIDDEN - Do NOT use attributes on root SVG

```xml
<!-- WRONG - iOS will NOT render this correctly -->
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
     fill="none" stroke="currentColor" stroke-width="3"
     stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="10" width="80" height="80"/>
</svg>
```

### ✅ REQUIRED - Apply attributes to EACH element

```xml
<!-- CORRECT - iOS renders this properly -->
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="80" height="80"
        fill="none" stroke="currentColor" stroke-width="3"/>
</svg>
```

### SVG Icon Checklist

1. ✅ Root `<svg>` element ONLY contains: `viewBox="0 0 100 100"` and `xmlns="http://www.w3.org/2000/svg"`
2. ✅ EVERY shape element (`<rect>`, `<circle>`, `<line>`, `<path>`, etc.) has explicit `fill` and `stroke` attributes
3. ✅ Use `stroke="currentColor"` and `fill="currentColor"` for theme compatibility
4. ✅ Use `fill="none"` explicitly when no fill is needed (do NOT rely on inheritance)
5. ✅ Apply `stroke-linecap`, `stroke-linejoin` on individual elements, NOT on root
6. ✅ Test icons on iOS/iPhone before finalizing

### Reference: Working Icon Example

See `assets/compressor-state.svg` for a correctly structured icon that works on all platforms including iOS.
