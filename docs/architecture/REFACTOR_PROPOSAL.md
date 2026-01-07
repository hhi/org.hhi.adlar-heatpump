# Refactor Proposal: Flow Card Trigger Consolidation

**Parent Documentation**: [CLAUDE.md](../../CLAUDE.md)
**Related**: [SERVICE_ARCHITECTURE.md](SERVICE_ARCHITECTURE.md), [KEY_PATTERNS.md](KEY_PATTERNS.md)

**Status**: 🔴 PROPOSAL - Requires review and approval
**Created**: 2026-01-07
**Priority**: HIGH - Architectural debt impacting maintainability

---

## Executive Summary

**Problem**: Trigger invocation logic is scattered across multiple components (device.ts + 4 services), violating Single Responsibility Principle and creating maintenance overhead. FlowCardManagerService was designed to centralize flow card operations but only handles CONDITIONS and ACTION handlers - TRIGGER invocation was never migrated.

**Impact**:
- 4,696-line device.ts with 16 embedded trigger calls
- Duplicate trigger invocation patterns across 4 services
- Misleading code comments suggesting delegation that doesn't exist
- Recent bugs (v2.4.14) caused by wrong trigger method usage

**Solution**: Complete the service extraction by consolidating all trigger invocation into FlowCardManagerService, reducing device.ts complexity and establishing clear architectural boundaries.

---

## Current State Analysis

### Trigger Invocation Distribution

| Component | Trigger Calls | Pattern | Status |
|-----------|--------------|---------|--------|
| **device.ts** | 16 | Direct `triggerFlowCard()` | ❌ Should be delegated |
| **adaptive-control-service.ts** | 6 | Direct `getDeviceTriggerCard()` | ⚠️ Recently fixed, but wrong layer |
| **building-model-service.ts** | 1 | Direct trigger | ⚠️ Wrong layer |
| **energy-tracking-service.ts** | 2 | Direct trigger | ⚠️ Wrong layer |
| **flow-card-manager-service.ts** | 0 (has unused private method) | N/A | ❌ Should own this responsibility |

**Total**: 25 scattered trigger invocations across 5 components

### Device.ts Trigger Inventory (16 calls)

```typescript
// Line 1118: COP Analysis
this.triggerFlowCard('cop_trend_detected', tokens);

// Line 2019, 2088: Outlier Detection (2x)
this.triggerFlowCard('cop_outlier_detected', { ... });

// Line 2043, 2446: Efficiency Changes (2x)
this.triggerFlowCard('cop_efficiency_changed', { ... });

// Line 2655: Fault Detection
this.triggerFlowCard('fault_detected', { fault_code, fault_description });

// Lines 2737, 2754, 2771: Mode Changes (3x)
this.triggerFlowCard('heating_mode_changed', { mode, mode_name });
this.triggerFlowCard('work_mode_changed', { mode, mode_name });
this.triggerFlowCard('water_mode_changed', { mode, mode_name });

// Lines 2792, 2810, 2830: Temperature Changes (3x)
this.triggerFlowCard('inlet_temperature_changed', { ... });
this.triggerFlowCard('outlet_temperature_changed', { ... });
this.triggerFlowCard('ambient_temperature_changed', { ... });

// Lines 2858, 2879, 2900: Expert Alerts (3x)
this.triggerFlowCard('compressor_efficiency_alert', { ... });
this.triggerFlowCard('fan_motor_efficiency_alert', { ... });
this.triggerFlowCard('water_flow_alert', { ... });
```

### AdaptiveControlService Trigger Inventory (6 calls)

```typescript
// Lines 871, 894: Status & Recommendations (2x) - RECENTLY FIXED
this.device.homey.flow.getDeviceTriggerCard('adaptive_status_change');
this.device.homey.flow.getDeviceTriggerCard('temperature_adjustment_recommended');

// Lines 1457, 1472, 1487, 1598: COP & Cost Thresholds (4x)
this.device.homey.flow.getDeviceTriggerCard('cop_threshold_reached');
this.device.homey.flow.getDeviceTriggerCard('cop_threshold_dropped');
this.device.homey.flow.getDeviceTriggerCard('building_model_updated');
this.device.homey.flow.getDeviceTriggerCard('daily_cost_threshold');
```

### What FlowCardManagerService Actually Does

**✅ DOES Handle:**
- 13 CONDITION card registrations (`registerRunListener`)
- 4 ACTION handlers (external data reception: power, flow, ambient, prices)
- Flow card categorization and health-based filtering
- User preference management (disabled/auto/enabled modes)

**❌ DOES NOT Handle:**
- TRIGGER invocation (has `private triggerFlowCard()` method that's never called)
- Event-driven trigger logic
- Capability change-based triggers

---

## Root Cause Analysis

### Timeline: How Did This Happen?

1. **Initial Architecture** (v0.x): All flow logic in device.ts (monolithic)
2. **Service Extraction** (v1.0): FlowCardManagerService created for new CONDITION cards
3. **Incomplete Migration**: Existing TRIGGER patterns stayed in device.ts ("it works, don't touch")
4. **Scope Creep**: New services (AdaptiveControl, EnergyTracking, BuildingModel) added own triggers
5. **Result**: Split-brain architecture where inbound (conditions) migrated, outbound (triggers) didn't

### Architectural Debt Pattern: "Path of Least Resistance"

```
New Feature → Shortest Implementation Path → Technical Debt
    ↓
Condition Card → Added to FlowCardManagerService ✅
    ↓
Trigger Card → Added to device.ts/service directly ❌ (faster, less refactoring)
    ↓
Result: Service became facade without real trigger responsibility
```

### The V2.4.14 Bug Symptom

**Bug**: `adaptive_simulation_update` and `temperature_adjustment_recommended` triggers never fired
**Cause**: Used `getTriggerCard()` instead of `getDeviceTriggerCard()`
**Root Issue**: Trigger logic scattered across components without clear ownership

This bug wouldn't have occurred if FlowCardManagerService had centralized trigger responsibility with consistent patterns.

---

## Proposed Architecture

### Design Principle: **Single Source of Trigger Truth**

```
┌─────────────────────────────────────────────────────┐
│              FlowCardManagerService                 │
│  ┌───────────────────────────────────────────────┐ │
│  │  OWNS: All trigger invocation logic           │ │
│  │  - Registration (existing ✅)                  │ │
│  │  - Invocation (NEW 🆕)                         │ │
│  │  - Capability-based triggers                   │ │
│  │  - Service event triggers                      │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                         ▲
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────────┐    ┌─────────────┐   ┌──────────┐
    │device.ts│    │  Services   │   │ Events   │
    │         │    │(Adaptive,   │   │capability│
    │ Emits   │    │ Energy,     │   │  :changed│
    │ Events  │    │ Building)   │   │          │
    └────────┘    └─────────────┘   └──────────┘
                  Notify via Events
```

### Refactored Responsibility Matrix

| Component | **Current** | **After Refactor** |
|-----------|-------------|-------------------|
| **FlowCardManagerService** | Conditions + Action handlers | **+ ALL trigger invocation** |
| **device.ts** | Orchestration + 16 triggers | **Orchestration only** (emit events) |
| **AdaptiveControlService** | Logic + 6 triggers | **Logic only** (emit events) |
| **BuildingModelService** | Logic + 1 trigger | **Logic only** (emit events) |
| **EnergyTrackingService** | Logic + 2 triggers | **Logic only** (emit events) |

---

## Implementation Plan

### Phase 1: Foundation (Estimated: 2-3 hours)

**Goal**: Make FlowCardManagerService the single point of trigger invocation

**Steps**:

1. **Rename existing `triggerFlowCard` in FlowCardManagerService** (line 519)
   - From: `private async triggerFlowCard()`
   - To: `private async legacyTriggerFlowCard()` (mark for deletion)
   - Reason: This method uses wrong pattern (stored listeners)

2. **Create new public `triggerFlowCard` method in FlowCardManagerService**:
   ```typescript
   /**
    * Centralized flow card trigger invocation with proper device-level handling.
    * @param cardId - Flow card ID
    * @param tokens - Token values
    * @param state - Optional state for runListener filtering
    */
   public async triggerFlowCard(
     cardId: string,
     tokens: Record<string, unknown>,
     state: Record<string, unknown> = {}
   ): Promise<void> {
     try {
       const triggerCard = this.device.homey.flow.getDeviceTriggerCard(cardId);
       await triggerCard.trigger(this.device, tokens, state);
       this.logger(`FlowCardManagerService: Triggered ${cardId}`, tokens);
     } catch (error) {
       this.logger(`FlowCardManagerService: Failed to trigger ${cardId}:`, error);
       // Non-fatal: trigger cards may not exist in all user flows
     }
   }
   ```

3. **Add event-based trigger handlers**:
   ```typescript
   /**
    * Subscribe to device events for automatic trigger invocation
    */
   private subscribeToEvents(): void {
     // Capability changes
     this.device.on('capability:changed', (data) => {
       this.handleCapabilityChange(data);
     });

     // Service events
     this.device.on('adaptive:recommendation', (data) => {
       this.triggerFlowCard('temperature_adjustment_recommended', data);
     });

     this.device.on('adaptive:status-change', (data) => {
       this.triggerFlowCard('adaptive_status_change', data);
     });

     // Add more event handlers...
   }

   private async handleCapabilityChange(data: {
     capability: string;
     value: unknown;
     previousValue: unknown;
   }): Promise<void> {
     const { capability, value, previousValue } = data;

     // Mode changes
     if (capability === 'adlar_enum_mode' && value !== previousValue) {
       await this.triggerFlowCard('heating_mode_changed', {
         mode: value,
         mode_name: this.getModeLabel(value as string),
       });
     }

     // Temperature changes
     if (capability === 'measure_temperature.inlet' && value !== previousValue) {
       await this.triggerFlowCard('inlet_temperature_changed', {
         temperature: value,
         previous_temperature: previousValue,
         delta: (value as number) - (previousValue as number),
       });
     }

     // Add more capability-based triggers...
   }
   ```

**Deliverables**:
- [ ] New `triggerFlowCard()` method (public, correct pattern)
- [ ] Event subscription system in FlowCardManagerService
- [ ] Unit tests for trigger invocation
- [ ] Update SERVICE_ARCHITECTURE.md documentation

---

### Phase 2: Device.ts Migration (Estimated: 2-4 hours)

**Goal**: Remove all 16 trigger calls from device.ts, replace with event emissions

**Migration Pattern**:
```typescript
// BEFORE (device.ts line 2737):
this.triggerFlowCard('heating_mode_changed', {
  mode: newValue,
  mode_name: modeName,
});

// AFTER (device.ts):
this.emit('capability:changed', {
  capability: 'adlar_enum_mode',
  value: newValue,
  previousValue: oldValue,
});
// FlowCardManagerService now listens to this event and triggers the flow card
```

**Steps**:

1. **Identify trigger clusters** (lines with common patterns):
   - Mode changes (3x: heating, work, water)
   - Temperature changes (3x: inlet, outlet, ambient)
   - Expert alerts (3x: compressor, fan, water flow)
   - COP events (4x: trend, outlier, efficiency change)
   - Fault detection (1x)

2. **Replace with event emissions** for each cluster:
   ```typescript
   // Example: Mode changes cluster
   if (capability === 'adlar_enum_mode' && newValue !== oldValue) {
     this.emit('capability:changed', {
       capability,
       value: newValue,
       previousValue: oldValue,
     });
   }
   ```

3. **Remove device.ts `triggerFlowCard` method** (lines 3122-3139)
   - This becomes unnecessary after migration
   - Comment in SERVICE_ARCHITECTURE.md: "Removed v2.5.0 - migrated to FlowCardManagerService"

4. **Update misleading comment** (line 3117):
   - From: "delegated to FlowCardManagerService"
   - Delete this entire comment block (no longer applicable)

**Testing**:
- [ ] Verify each of 16 triggers still fires after migration
- [ ] Test with user flows to ensure tokens are passed correctly
- [ ] Validate state parameter handling (runListener filtering)

---

### Phase 3: Service Migration (Estimated: 2-3 hours)

**Goal**: Remove trigger invocations from AdaptiveControlService, BuildingModelService, EnergyTrackingService

#### 3.1 AdaptiveControlService (6 triggers)

**Replace direct triggers with event emissions**:

```typescript
// BEFORE (line 871):
const trigger = this.device.homey.flow.getDeviceTriggerCard('adaptive_status_change');
await trigger.trigger(this.device, { status, reason });

// AFTER:
this.device.emit('adaptive:status-change', { status, reason });
```

**Event names**:
- `adaptive:status-change` → `adaptive_status_change`
- `adaptive:recommendation` → `temperature_adjustment_recommended`
- `adaptive:cop-threshold-reached` → `cop_threshold_reached`
- `adaptive:cop-threshold-dropped` → `cop_threshold_dropped`
- `adaptive:building-model-updated` → `building_model_updated`
- `adaptive:daily-cost-threshold` → `daily_cost_threshold`

#### 3.2 BuildingModelService (1 trigger)

Find and replace trigger call with event emission.

#### 3.3 EnergyTrackingService (2 triggers)

Find and replace trigger calls with event emissions.

**Testing**:
- [ ] Verify adaptive control recommendations still trigger
- [ ] Test building model update notifications
- [ ] Validate energy tracking alerts

---

### Phase 4: Cleanup & Documentation (Estimated: 1 hour)

**Goals**:
1. Remove dead code
2. Update documentation
3. Add architectural guardrails

**Steps**:

1. **Delete legacy code**:
   - FlowCardManagerService `legacyTriggerFlowCard()` method
   - flow-helpers.ts trigger storage (lines 49-118) - confirmed unused

2. **Update CLAUDE.md**:
   ```markdown
   ## Flow Card Architecture (v2.5.0+)

   **CRITICAL**: ALL flow card trigger invocations MUST go through FlowCardManagerService.

   - ✅ FlowCardManagerService.triggerFlowCard() - ONLY method for triggers
   - ❌ device.homey.flow.getDeviceTriggerCard() - DO NOT use directly
   - ✅ Event emission pattern - Services emit, FlowCardManager triggers

   **Pattern**:
   ```typescript
   // In service or device.ts:
   this.device.emit('capability:changed', { capability, value, previousValue });

   // FlowCardManagerService automatically handles trigger invocation
   ```

3. **Update SERVICE_ARCHITECTURE.md**:
   - Update FlowCardManagerService responsibilities
   - Add "Trigger Invocation" section
   - Document event-driven architecture

4. **Add ESLint rule** (optional but recommended):
   ```json
   {
     "rules": {
       "no-restricted-syntax": [
         "error",
         {
           "selector": "MemberExpression[object.property.name='flow'][property.name='getDeviceTriggerCard']",
           "message": "Direct trigger usage forbidden. Use FlowCardManagerService.triggerFlowCard() or emit events."
         }
       ]
     }
   }
   ```

---

## Migration Risks & Mitigation

### Risk 1: Breaking Existing User Flows

**Risk Level**: 🟡 MEDIUM

**Scenario**: Token structure changes during migration break existing user flows

**Mitigation**:
- Maintain exact token structures (verify with `.homeycompose/flow/triggers/*.json`)
- Test each trigger with actual flow cards before/after
- Add comprehensive logging during migration (`this.logger` statements)

### Risk 2: Event Timing Issues

**Risk Level**: 🟡 MEDIUM

**Scenario**: Async event emissions cause trigger delays or race conditions

**Mitigation**:
- Use synchronous `emit()` (EventEmitter is synchronous by default)
- Add event queue if needed (unlikely for flow triggers)
- Test with rapid capability changes

### Risk 3: Service Initialization Order

**Risk Level**: 🟢 LOW

**Scenario**: FlowCardManagerService not initialized when events are emitted

**Mitigation**:
- FlowCardManagerService already initializes early (ServiceCoordinator line 3565+)
- Add initialization checks in event handlers
- Queue events if manager not ready (buffer pattern)

### Risk 4: Incomplete Migration

**Risk Level**: 🔴 HIGH

**Scenario**: Some triggers missed during migration, causing silent failures

**Mitigation**:
- **MANDATORY**: Create checklist of all 25 trigger calls
- Grep verification after each phase: `grep -r "getDeviceTriggerCard" lib/`
- Automated tests for each trigger card
- Code review with explicit checklist sign-off

---

## Success Metrics

### Quantitative Goals

| Metric | Current | Target | Verification |
|--------|---------|--------|--------------|
| **device.ts line count** | 4,696 | < 4,500 | `wc -l device.ts` |
| **Trigger call sites** | 25 (5 files) | 1 (FlowCardManagerService) | `grep -r "getDeviceTriggerCard"` |
| **Service coupling** | HIGH (4 services call triggers) | LOW (event-driven) | Architecture review |
| **Dead code** | 2 unused methods | 0 | Manual review |

### Qualitative Goals

- ✅ Single source of truth for trigger invocation
- ✅ Clear separation of concerns (services emit events, manager triggers)
- ✅ No misleading comments or documentation
- ✅ Consistent trigger patterns across all flow cards
- ✅ Easier to add new triggers (single location, established pattern)

---

## Post-Migration Validation Checklist

**Phase 1 - Foundation**:
- [ ] New `triggerFlowCard()` method compiles without errors
- [ ] Event subscription system initialized in `initialize()` method
- [ ] Unit tests pass for trigger invocation
- [ ] SERVICE_ARCHITECTURE.md updated with new responsibilities

**Phase 2 - Device.ts Migration**:
- [ ] All 16 trigger calls replaced with event emissions
- [ ] `device.ts triggerFlowCard` method deleted
- [ ] Grep confirms no remaining `this.triggerFlowCard(` in device.ts
- [ ] Manual testing: Each trigger fires with correct tokens
- [ ] Flow cards work in Homey app (create test flows)

**Phase 3 - Service Migration**:
- [ ] AdaptiveControlService: 6 triggers migrated to events
- [ ] BuildingModelService: 1 trigger migrated to event
- [ ] EnergyTrackingService: 2 triggers migrated to events
- [ ] Grep confirms no remaining `getDeviceTriggerCard` in services (except FlowCardManagerService)

**Phase 4 - Cleanup**:
- [ ] Legacy code deleted (flow-helpers.ts trigger storage, old methods)
- [ ] CLAUDE.md updated with new patterns
- [ ] SERVICE_ARCHITECTURE.md reflects new architecture
- [ ] ESLint rule added (optional)

**Final Validation**:
- [ ] `npm run build` succeeds
- [ ] `homey app validate` passes
- [ ] All existing flow cards still trigger correctly
- [ ] No console errors or warnings in Homey app
- [ ] Architecture review confirms single source of trigger truth

---

## Alternative Approaches Considered

### Alternative A: Keep Current Architecture

**Pros**: No migration effort, no risk of breaking changes
**Cons**: Continued maintenance burden, architectural debt, future bugs likely
**Decision**: ❌ REJECTED - Debt will compound, v2.4.14 bug shows this is unsustainable

### Alternative B: Hybrid Approach (Device.ts keeps simple 1:1 triggers)

**Description**: Device.ts handles direct capability → trigger mapping (e.g., mode changes), services use FlowCardManagerService for complex logic

**Pros**: Less migration effort, pragmatic split
**Cons**: Unclear boundaries ("what's simple?"), doesn't solve split-brain problem
**Decision**: ❌ REJECTED - Violates "single source of truth" principle

### Alternative C: Full Event-Driven (Proposed Approach)

**Description**: All components emit events, FlowCardManagerService subscribes and triggers

**Pros**: Clean separation, single source of truth, testable, extensible
**Cons**: Requires comprehensive migration, event naming conventions needed
**Decision**: ✅ SELECTED - Best long-term architecture despite upfront cost

---

## Implementation Timeline

| Phase | Estimated Time | Dependencies | Priority |
|-------|---------------|--------------|----------|
| **Phase 1**: Foundation | 2-3 hours | None | CRITICAL |
| **Phase 2**: Device.ts | 2-4 hours | Phase 1 complete | HIGH |
| **Phase 3**: Services | 2-3 hours | Phase 1 complete | HIGH |
| **Phase 4**: Cleanup | 1 hour | Phases 2-3 complete | MEDIUM |

**Total Estimated Effort**: 7-11 hours (1-2 days)

**Recommended Schedule**:
- Week 1: Phase 1 (Foundation) + Phase 2 (Device.ts)
- Week 2: Phase 3 (Services) + Phase 4 (Cleanup) + Testing

---

## Approval Required

**This refactor requires explicit approval** due to:
1. Architectural scope (25 trigger call sites across 5 files)
2. Risk of breaking user flows
3. ~10 hours of development effort
4. Testing overhead (all 25+ trigger cards)

**Approval Checklist**:
- [ ] User reviewed and approved refactor approach
- [ ] Timeline and effort estimate accepted
- [ ] Risk mitigation strategy approved
- [ ] Success metrics agreed upon
- [ ] Testing plan validated

**Next Steps After Approval**:
1. Create feature branch: `refactor/flow-card-trigger-consolidation`
2. Implement Phase 1 (Foundation)
3. Request code review before proceeding to Phase 2
4. Incremental testing after each phase
5. Final validation before merge to main

---

## References

- [SERVICE_ARCHITECTURE.md](SERVICE_ARCHITECTURE.md) - Current service design
- [KEY_PATTERNS.md](KEY_PATTERNS.md) - Established patterns
- [CLAUDE.md](../../CLAUDE.md) - Development guidelines
- device.ts lines 3122-3139 - Current trigger implementation
- flow-card-manager-service.ts lines 519-548 - Legacy trigger method
- adaptive-control-service.ts lines 871, 894 - Recent bug fixes (v2.4.14)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-07
**Author**: Claude Code (Architectural Analysis)
**Status**: 🔴 AWAITING APPROVAL
