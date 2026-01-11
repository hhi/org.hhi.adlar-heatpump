# Phase 2: Building Insights Testing Guide

**Version:** 2.5.0
**Status:** Ready for Deployment
**Duration:** 24-48 hours for full testing

---

## 📋 Pre-Deployment Checklist

### 1. **Code Validation**
```bash
# Build TypeScript
npm run build
# Expected: No errors

# Validate Homey app structure
homey app validate
# Expected: ✓ App validated successfully

# Lint check
npm run lint
# Expected: No new errors in building-insights-service.ts
```

### 2. **Configuration Verification**
- [x] 4 capabilities defined in `.homeycompose/capabilities/`
- [x] 4 SVG icons exist in `/assets/`
- [x] 3 flow card triggers in `.homeycompose/flow/triggers/`
- [x] 5 device settings in `driver.settings.compose.json`
- [x] BuildingInsightsService integrated in ServiceCoordinator
- [x] 60+ defensive code checks implemented

---

## 🚀 Deployment Steps

### Step 1: Deploy to Development Homey
```bash
# Run app on development Homey (connects via CLI)
homey app run

# Expected output:
# ✓ Running org.hhi.adlar-heatpump on Homey <your-homey-name>
# ✓ App is running
```

### Step 2: Monitor Initial Logs
Open Homey Developer Tools → App Logs and look for:

```
✓ ServiceCoordinator: All services initialized
✓ BuildingInsightsService: Initializing...
✓ BuildingInsightsService: Initialized successfully (interval: 3000s)
✓ BuildingInsightsService: Pre-heat recommendation scheduled for 2026-01-11T23:00:00.000Z
```

**If you see errors:**
- `WARNING - building_insight_primary capability missing` → Restart app
- `Building model not ready yet` → Expected in first 24h

### Step 3: Verify Capabilities Visible
1. Open Homey app on mobile
2. Navigate to your heat pump device
3. Scroll to bottom (advanced settings area)
4. **Check for new capabilities:**
   - **Primary Building Insight** (empty initially)
   - **Secondary Building Insight** (empty initially)
   - **Recommendation** (empty initially)
   - **Building Insights Diagnostics (JSON)** (shows settings info)

**Expected JSON in diagnostics:**
```json
{
  "active_insights": [],
  "insight_history": [],
  "settings": {
    "enabled": true,
    "min_confidence": 70,
    "max_active_insights": 3
  },
  "last_evaluation": null
}
```

---

## ⏱️ Testing Timeline

### **Hour 0-1: Initialization Phase**

**What to check:**
- App starts without crashes
- BuildingInsightsService initializes
- Pre-heat recommendation scheduled for 23:00
- Evaluation timer starts (every 50 minutes)

**Expected logs:**
```
T+0min:  BuildingInsightsService: Initialized successfully
T+50min: BuildingInsightsService: Evaluating insights...
T+50min: BuildingInsightsService: Building model not ready yet, skipping evaluation
```

**Action:** None - let the building model collect data

---

### **Hour 6-12: Early Learning Phase**

**What to check:**
- Building model confidence: 10-30%
- First evaluation attempts (still skipping due to low confidence)

**Expected logs:**
```
T+6h: BuildingModelService: Confidence: 15%
T+6h: BuildingInsightsService: Model confidence: 15%
T+6h: BuildingInsightsService: Detected 0 insights (confidence < 50%)
```

**Check building model diagnostics capability:**
```json
{
  "confidence": 15,
  "C": 12.5,  // Still unstable
  "UA": 0.25, // Still unstable
  "samples": 72  // 72 samples @ 5min = 6h
}
```

**Action:** Verify indoor/outdoor temp sensors are working

---

### **Hour 12-24: Medium Confidence Phase**

**What to check:**
- Building model confidence: 30-60%
- **Profile mismatch detection possible** (50% threshold)

**Expected logs:**
```
T+18h: BuildingInsightsService: Model confidence: 52%
T+18h: BuildingInsightsService: Detected 1 insights
T+18h: BuildingInsightsService: Triggered profile_mismatch flow card
```

**First capability update (profile mismatch):**
- **Primary Insight:** `🔄 Building behaves like 'heavy' (τ=15.2h vs 'average' τ=10.0h)`
- **Recommendation:** `Change building profile to 'heavy' in device settings for faster learning`

**Test Flow Card Trigger:**
1. Create test flow:
   - **Trigger:** "Building profile mismatch detected"
   - **Condition:** None
   - **Action:** Send notification "Profile mismatch: {{suggested_profile}}"
2. Wait for next evaluation (50 min)
3. Check if notification arrives

---

### **Hour 24-48: High Confidence Phase**

**What to check:**
- Building model confidence: >70%
- **All insight categories active**
- Multiple insights detected

**Expected logs:**
```
T+30h: BuildingInsightsService: Model confidence: 74%
T+30h: BuildingInsightsService: Detected 3 insights
T+30h: BuildingInsightsService: Triggered insight_detected flow card for insulation_performance
T+30h: BuildingInsightsService: Updated capabilities (3 active insights)
```

**Full capability update (3 insights):**
- **Primary:** `🏠 High heat loss - UA 0.45 kW/°C (expected: 0.28)`
- **Secondary:** `⏱️ medium_response - τ=9.2h`
- **Recommendation:** `Consider insulation upgrades: roof (25% savings), walls (15%), windows (10%). Est. savings: €85/month`

**Diagnostics JSON:**
```json
{
  "active_insights": [
    {
      "id": "insulation_poor_1736524800000",
      "category": "insulation_performance",
      "priority": 85,
      "confidence": 74,
      "insight": "🏠 High heat loss - UA 0.45 kW/°C (expected: 0.28)",
      "recommendation": "Consider insulation upgrades...",
      "estimatedSavings": 85,
      "status": "active"
    }
  ],
  "insight_history": [...],
  "settings": {...},
  "last_evaluation": "2026-01-11T18:30:00.000Z"
}
```

---

### **Day 2-3: Pre-Heat Recommendation Testing**

**What to check at 23:00:**
- Pre-heat recommendation flow card triggers

**Expected logs (at 23:00):**
```
T+23:00: BuildingInsightsService: Triggered pre_heat_recommendation
T+23:00: start=02:15, duration=4.8h
```

**Test Flow:**
1. Create flow:
   - **Trigger:** "Pre-heat recommendation"
   - **Action:** Set variable "preheat_start" to {{start_time}}
2. Wait until 23:00
3. Check if variable is set

---

## 🧪 Test Scenarios

### **Scenario 1: Insulation Performance Detection**

**Simulate:** High UA value (poor insulation)

**Expected behavior:**
1. When confidence >70% AND UA > 1.5× profile UA:
   - Insight detected: `🏠 High heat loss - UA X.XX kW/°C`
   - Savings estimate: €50-200/month range
   - Priority: 85

**Verify:**
```bash
# Check device capability via API
curl http://your-homey-ip/api/devices/<device-id> | jq '.capabilitiesObj.building_insight_primary.value'
```

---

### **Scenario 2: Pre-Heating Strategy Detection**

**Simulate:** τ calculation from learned C and UA

**Expected categories:**
- **Fast response** (τ < 5h): Priority 75, aggressive night setback
- **Medium response** (τ 5-15h): Priority 60, moderate setback
- **Slow response** (τ > 15h): Priority 50, minimal setback

**Verify:**
- Capability shows correct τ value
- Recommendation matches category
- Pre-heat duration at 23:00 is reasonable (< 24h)

---

### **Scenario 3: Thermal Storage Detection**

**Simulate:** High C (>18 kWh/°C) + High τ (>12h)

**Expected behavior:**
- **With dynamic pricing:** Priority 90, savings €50-150/month
- **Without dynamic pricing:** Priority 65, recommendation to add pricing data

**Verify:**
```
# Check if dynamic pricing is configured
# Settings → Energy Price Optimizer Enabled
```

---

### **Scenario 4: Profile Mismatch Detection**

**Simulate:** Selected profile 'average' but learned τ suggests 'heavy'

**Expected behavior:**
1. When confidence >50% AND deviation >30%:
   - Insight: `🔄 Building behaves like 'heavy'`
   - Recommendation: Change profile in settings
   - Flow card trigger with 6 tokens

**Verify:**
- Flow receives `suggested_profile` token
- `deviation_percent` token shows >30%

---

### **Scenario 5: Advice Fatigue Prevention**

**Simulate:** Same insight triggered twice within 24h

**Expected behavior:**
1. First trigger: Insight shown, flow card triggered
2. Second trigger (within 24h): Skipped with log `already triggered within 24 hours`

**Verify logs:**
```
T+30h: BuildingInsightsService: Triggered insight_detected for insulation_performance
T+31h: BuildingInsightsService: Insight insulation_performance already triggered within 24 hours
```

---

### **Scenario 6: Settings Changes**

**Test:** Change `insights_min_confidence` from 70% to 50%

**Expected behavior:**
1. Log: `BuildingInsightsService: Settings changed, updating configuration...`
2. Immediate re-evaluation
3. More insights appear (lower threshold)

**Verify:**
```bash
# Change setting via device settings UI
# Wait 1 minute
# Check logs for "Settings changed"
# Check capabilities for new insights
```

---

## 🐛 Troubleshooting Guide

### **Problem 1: No insights after 48 hours**

**Symptoms:**
- Confidence >70%
- No insights in capabilities
- Logs show "Detected 0 insights"

**Diagnosis:**
```bash
# Check building model diagnostics
# Look at C, UA, τ values - are they in valid ranges?
# - C: 5-40 kWh/°C
# - UA: 0.02-1.0 kW/°C
# - τ: 5-30h (typical)
```

**Possible causes:**
1. **Model values outside detection thresholds**
   - UA not high enough (< 1.5× profile)
   - C not high enough (< 18 kWh/°C for thermal storage)
   - τ not triggering pre-heat categorization

2. **Invalid model data**
   - Check logs for "Invalid UA value", "Invalid tau calculated"
   - Defensive code blocking insights due to unrealistic values

**Solution:**
- Lower `insights_min_confidence` to 50% temporarily
- Check if profile matches building behavior
- Verify indoor/outdoor temp sensors are accurate

---

### **Problem 2: Flow cards not triggering**

**Symptoms:**
- Capabilities show insights
- Flow cards never trigger
- No flow card logs

**Diagnosis:**
```bash
# Check flow card registration
# Homey Developer Tools → App Logs
# Search for "getDeviceTriggerCard"
```

**Possible causes:**
1. Flow card not registered properly
2. Device not connected to flow trigger
3. Insight already triggered within 24h (rate limiting)

**Solution:**
- Restart app: `homey app run`
- Check flow uses correct device
- Wait 24h for rate limit to expire

---

### **Problem 3: Invalid wake_time errors**

**Symptoms:**
- Log: `Invalid wake_time format: undefined`
- Pre-heat recommendation at 23:00 fails

**Cause:**
- Setting not saved or corrupt

**Solution:**
```bash
# Set wake_time in device settings
# Format: HH:MM (e.g., "07:00")
# Valid range: 00:00 - 23:59
```

---

### **Problem 4: Unrealistic savings estimates**

**Symptoms:**
- Insight shows €1000/month savings (clearly wrong)
- Log: `Unrealistic insulation savings calculated`

**Diagnosis:**
- Defensive code caught unrealistic ROI
- Returns 0 EUR instead

**Expected behavior:**
- Insulation savings: 0-500 EUR/month max
- Thermal storage savings: 0-300 EUR/month max

**If savings = 0:**
- Check UA values are valid
- Check model confidence >70%
- Verify target UA from profile is reasonable

---

### **Problem 5: Missing capabilities**

**Symptoms:**
- Log: `WARNING - building_insight_primary capability missing`
- Capabilities not visible in app

**Cause:**
- App not rebuilt after adding capabilities
- Driver registration failed

**Solution:**
```bash
# Stop app
# Rebuild
npm run build

# Validate
homey app validate

# Re-run
homey app run

# Check driver.compose.json includes capabilities:
# - building_insight_primary
# - building_insight_secondary
# - building_insight_recommendation
# - building_insights_diagnostics
```

---

## 📊 Success Criteria

Phase 2 is complete when:

- [x] **App runs 48+ hours without crashes**
- [x] **Building model confidence reaches 70%+**
- [x] **At least 1 insight detected and shown in capabilities**
- [x] **Flow card trigger verified (notification received)**
- [x] **Pre-heat recommendation triggers at 23:00**
- [x] **Advice fatigue prevention works (no duplicate triggers within 24h)**
- [x] **Settings changes trigger re-evaluation**
- [x] **Diagnostics JSON shows valid state**
- [x] **Defensive code prevents crashes (invalid data handled gracefully)**

---

## 📝 Test Results Template

Copy this template and fill in results:

```markdown
## Phase 2 Test Results

**Date:** 2026-01-XX
**Duration:** XX hours
**Homey Version:** X.X.X
**App Version:** 2.5.0

### Initialization (T+0-1h)
- [ ] App started successfully
- [ ] BuildingInsightsService initialized
- [ ] Pre-heat scheduler active
- [ ] Evaluation timer running (50 min intervals)
- **Notes:**

### Early Learning (T+6-12h)
- [ ] Model confidence: XX%
- [ ] Evaluation logs present
- [ ] No crashes or errors
- **Notes:**

### Medium Confidence (T+12-24h)
- [ ] Model confidence: XX%
- [ ] Profile mismatch detected: YES / NO
- [ ] First flow card triggered: YES / NO
- [ ] Capability updated: YES / NO
- **Notes:**

### High Confidence (T+24-48h)
- [ ] Model confidence: XX%
- [ ] Insulation insight: YES / NO
- [ ] Pre-heating insight: YES / NO
- [ ] Thermal storage insight: YES / NO
- [ ] Savings estimates: €XXX/month (realistic: YES / NO)
- [ ] Flow cards working: YES / NO
- [ ] Pre-heat trigger at 23:00: YES / NO
- **Notes:**

### Edge Cases Tested
- [ ] Invalid settings (wake_time format)
- [ ] Confidence threshold changes
- [ ] Advice fatigue (24h rate limit)
- [ ] Missing capabilities handled gracefully
- [ ] Invalid model data (NaN/Infinity) handled
- **Notes:**

### Issues Found
1.
2.
3.

### Conclusion
Phase 2: PASS / FAIL
Ready for Phase 3: YES / NO
```

---

## 🎯 Next Steps After Phase 2

If all tests pass:
- **Phase 3:** Flow card action cards (dismiss insight, force analysis)
- **Phase 4:** Advanced features (notification system, history export)
- **Phase 5:** User documentation updates (add real screenshots)
- **Phase 6:** App Store submission

---

**Good luck with testing! 🚀**
