# Phase 2: Quick Reference Card

**Print/bookmark this for easy access during testing**

---

## 🚀 Quick Start

```bash
npm run build && homey app validate && homey app run
```

**Watch for:**
```
✓ BuildingInsightsService: Initialized successfully (interval: 3000s)
✓ BuildingInsightsService: Pre-heat recommendation scheduled
```

---

## ⏱️ Timeline Cheat Sheet

| **Time** | **Confidence** | **What to Expect** |
|----------|----------------|--------------------|
| 0-6h | <10% | "Building model not ready yet" |
| 6-12h | 10-30% | Early evaluations, no insights yet |
| 12-24h | 30-60% | **Profile mismatch possible** (50% threshold) |
| 24-48h | 70%+ | **All insights active**, flow cards trigger |
| 23:00 daily | 70%+ | **Pre-heat recommendation** triggers |

---

## 🔍 Log Patterns to Watch

### ✅ GOOD Logs
```
BuildingInsightsService: Evaluating insights...
BuildingInsightsService: Model confidence: 74%
BuildingInsightsService: Detected 3 insights
BuildingInsightsService: Triggered insight_detected flow card
BuildingInsightsService: Updated capabilities (3 active insights)
```

### ⚠️ WARNING Logs (Expected early on)
```
BuildingInsightsService: Building model not ready yet
BuildingInsightsService: Insufficient confidence for insights
BuildingInsightsService: Detected 0 insights
```

### ❌ ERROR Logs (Investigate!)
```
BuildingInsightsService: Invalid UA value: NaN
BuildingInsightsService: Unrealistic savings calculated: 1250
WARNING - building_insight_primary capability missing
```

---

## 📊 Capability Check Commands

### View Capability Value (API)
```bash
# Get all capabilities
curl http://<homey-ip>/api/devices/<device-id> | jq '.capabilitiesObj'

# Get specific insight
curl http://<homey-ip>/api/devices/<device-id> | \
  jq '.capabilitiesObj.building_insight_primary.value'
```

### View via Homey App
1. Open device
2. Scroll to bottom (advanced section)
3. Look for:
   - Primary Building Insight
   - Secondary Building Insight
   - Recommendation
   - Building Insights Diagnostics (JSON)

---

## 🧪 Quick Tests

### Test 1: Verify Initialization (5 min)
```bash
homey app run
# Wait 1 minute
# Check logs for "Initialized successfully"
# Check logs for "Pre-heat recommendation scheduled"
```

### Test 2: Check First Evaluation (50 min)
```bash
# Wait 50 minutes after start
# Check logs for "Evaluating insights..."
# Expected: "Building model not ready yet" (first 6-12h)
```

### Test 3: Flow Card Trigger (after 24h)
1. Create test flow:
   - Trigger: "New building insight detected"
   - Action: Push notification "{{insight}}"
2. Wait for evaluation (every 50 min)
3. Check notification

### Test 4: Pre-Heat Recommendation (at 23:00)
1. Create flow:
   - Trigger: "Pre-heat recommendation"
   - Action: Set variable "start={{start_time}}"
2. Wait until 23:00
3. Check variable value

### Test 5: Settings Change (2 min)
1. Go to device settings
2. Change "Minimum confidence threshold" from 70% to 50%
3. Save
4. Check logs: "Settings changed, updating configuration"
5. Check if new insights appear

---

## 🐛 Quick Troubleshooting

| **Problem** | **Quick Fix** |
|-------------|---------------|
| No insights after 48h | Lower confidence to 50%, check model values |
| Flow cards not triggering | Restart app, verify flow uses correct device |
| "Invalid wake_time" error | Set wake_time in settings (format: HH:MM) |
| Missing capabilities | Rebuild: `npm run build && homey app run` |
| App crashes on start | Check logs for initialization errors |

---

## 📈 Model Value Ranges

**Valid ranges (for insights to trigger):**
- **C (Thermal Mass):** 5-40 kWh/°C (typical: 8-25)
- **UA (Heat Loss):** 0.02-1.0 kW/°C (typical: 0.15-0.45)
- **τ (Time Constant):** 0.5-100 hours (typical: 5-30)
- **Confidence:** >50% for profile mismatch, >70% for insights

**Defensive limits (beyond these = rejected):**
- C > 100 → Invalid
- UA > 2.0 → Invalid
- τ < 0.5 or > 100 → Invalid
- Savings > 500 EUR/month (insulation) → Unrealistic

---

## 🎯 Success Checklist

After 48 hours:
- [ ] App running without crashes
- [ ] Confidence >70%
- [ ] At least 1 insight visible in capability
- [ ] Flow card triggered successfully
- [ ] Pre-heat recommendation at 23:00 works
- [ ] JSON diagnostics shows valid state
- [ ] No "Invalid" errors in logs
- [ ] Savings estimates are realistic (<500 EUR/month)

**If all checked → Phase 2 COMPLETE** ✅

---

## 📞 Need Help?

Check full guide: `/docs/Dev support/PHASE2_TESTING_GUIDE.md`

**Common questions:**
- "Why no insights after 24h?" → Check model confidence and values
- "Flow cards silent?" → Verify device in flow, check rate limiting (24h)
- "Unrealistic savings?" → Defensive code working, returns 0 instead
- "Capabilities empty?" → Expected first 24h, model still learning

---

**Good luck! 🚀**
