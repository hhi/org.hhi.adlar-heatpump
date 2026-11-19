---
name: changelog
description: How to write entries in .homeychangelog.json for this Homey app: end-user audience, state what changed, no why/how, four languages, and when to clean up the changelog (only at certification, owner decides); examples of good and bad entries.
---

# Changelog Management

When updating `.homeychangelog.json`:

**Target Audience**: Regular end users (not developers)

**Writing Guidelines**:

- ✅ **State WHAT changed** - Be factual and direct
- ✅ **Include concrete examples** - Show before/after when relevant
  (e.g., "3-Oct 14:25" instead of "03-10 14:25")
- ❌ **Do NOT explain WHY** - Avoid phrases like "makes it more
  readable", "for cleaner interface", "for better user experience"
- ❌ **Do NOT explain HOW** - Skip technical details like
  "supports both languages", implementation details
- ❌ **Do NOT add marketing language** - No justifications or
  selling points

**Structure**: Keep entries concise (1-2 sentences maximum). A cleanup summary
at certification (see below) may be a short paragraph.

**Languages and wording**: Every entry in all four languages (en, nl, de, fr).
No technical terms (DPS, registers), no developer prefixes such as "Fixed:",
no file paths, and no references to dashboards or local web pages (call it
"live monitoring").

**Per version or cleaned up**:

- During development, each version gets its own short entry.
- At certification, the owner may decide to clean up the changelog to a summary
  since the last published version plus a few milestones (as done for 3.12.4).
  Propose this when a certification is coming up; never do it on your own.
- Details per version belong in the GitHub release, not in the changelog.

**Good Examples**:

```text
"Connection status now shows month abbreviations
(e.g., '3-Oct 14:25' instead of '03-10 14:25')."

"Device credentials can now be updated directly in settings."
```

**Bad Examples**:

```text
"Improved connection status display with month abbreviations.
Supports both English and Dutch.
Makes timestamps more readable at a glance."

"Simplified credential management for cleaner interface
and better user experience."
```
