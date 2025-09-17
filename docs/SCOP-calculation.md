# SCOP Calculation - Seasonal Efficiency Explained

## What is SCOP?

**Seasonal Coefficient of Performance (SCOP)** is the official European measure of heat pump efficiency over an entire heating season, defined by standard EN 14825:

```
SCOP = Total Heat Output (entire season) / Total Electrical Energy Input (entire season)
```

Unlike COP which shows instant efficiency, SCOP shows your heat pump's **average efficiency over 6+ months** of heating season (October 1st to May 15th).

## Understanding SCOP vs COP

| Measurement | What It Shows | Time Period | Example |
|-------------|---------------|-------------|---------|
| **COP** | Instant efficiency | Right now | COP = 3.2 (current moment) |
| **SCOP** | Seasonal average efficiency | 6+ months | SCOP = 3.8 (heating season) |

**Think of it like fuel economy:**

- **COP** = instant MPG display in your car
- **SCOP** = average MPG over your entire road trip

## Why SCOP Matters More Than COP

### Real-World Performance

- **Weather variations**: Hot summer days vs. freezing winter nights
- **Load changes**: Light heating vs. maximum demand periods
- **System behavior**: Startup, defrost cycles, part-load operation
- **Seasonal patterns**: Your actual usage over time

### Energy Bills

SCOP directly relates to your **annual heating costs**:

- **SCOP 4.0** = €1000 heating bill
- **SCOP 3.0** = €1333 heating bill (+33% more expensive)
- **SCOP 5.0** = €800 heating bill (20% savings)

### System Health

Declining SCOP over years indicates:

- Maintenance needed
- Component wear
- System inefficiencies developing

---

## How SCOP is Calculated

### EN 14825 European Standard

Your system follows the official European standard for heat pump efficiency measurement:

#### Heating Season Definition

- **Start**: October 1st
- **End**: May 15th
- **Duration**: 228 days (6+ months)
- **Climate**: European average (Strasbourg reference)

#### Temperature Bins Method

The calculation divides the heating season into temperature ranges:

| Temperature | Hours/Year | Load Ratio | Conditions |
|-------------|------------|------------|------------|
| **-10°C** | 1 hour | 88% | Extreme cold |
| **-7°C** | 25 hours | 78% | Very cold |
| **2°C** | 167 hours | 55% | Cold |
| **7°C** | 250 hours | 42% | Cool |
| **12°C** | 250 hours | 29% | Mild |
| **20°C** | 0 hours | 10% | Bivalent point |

#### Weighted Average Calculation

```
SCOP = Σ(COP_at_temperature × hours × load_ratio) / Σ(hours × load_ratio)
```

Each temperature bin contributes based on:

- **How many hours** that temperature occurs
- **Heat pump load** at that temperature
- **Actual COP** measured at that temperature

---

## SCOP Data Quality Levels

Your system shows SCOP confidence based on data quality:

### 🟢 High Confidence (SCOP 4.2 ± 0.2)

- **400+ hours** of quality measurements
- **80%+ reliable methods** (direct thermal, power module)
- **≤30% temperature-only** calculations
- **Full seasonal coverage** (70%+ of heating season)

### 🟡 Medium Confidence (SCOP 3.8 ± 0.4)

- **200-400 hours** of measurements
- **50-79% reliable methods**
- **Partial seasonal coverage** (40-70%)
- **Some data gaps** but trending visible

### 🔴 Low Confidence (SCOP 3.5 ± 0.8)

- **<200 hours** of measurements
- **<50% reliable methods**
- **Limited seasonal coverage** (<40%)
- **Estimate only** - insufficient data

---

## Understanding Your SCOP Display

### SCOP Value Ranges

**Excellent Performance (SCOP ≥ 4.5)**

- Top-tier efficiency
- Optimal installation and operation
- Significant energy savings

**Good Performance (SCOP 3.5-4.4)**

- Above-average efficiency
- Well-functioning system
- Reasonable energy costs

**Average Performance (SCOP 2.5-3.4)**

- Basic efficiency
- Room for improvement
- Check maintenance and settings

**Poor Performance (SCOP < 2.5)**

- Below-average efficiency
- System issues likely
- Professional service recommended

### Method Contribution Breakdown

Your SCOP calculation uses different measurement methods with quality weighting:

| Method | Weight | Accuracy | When Used |
|--------|--------|----------|-----------|
| **Direct Thermal** | 100% | ±5% | With external power meter |
| **Power Module** | 95% | ±8% | Internal power calculation |
| **Refrigerant Circuit** | 90% | ±12% | Pressure/temperature analysis |
| **Carnot Estimation** | 85% | ±15% | Ambient temperature based |
| **Valve Correlation** | 75% | ±20% | Valve position analysis |
| **Temperature Difference** | 60% | ±30% | Basic estimation only |

**Quality Score Example:**

- 60% Direct Thermal + 30% Power Module + 10% Temperature = 94% quality score = High confidence

---

## Seasonal Coverage and Data Collection

### What Gets Measured

**Every Hour During Heating Season:**

- Instantaneous COP calculation
- Ambient temperature
- System load level
- Calculation method used
- Data quality assessment

**Daily Summary Creation:**

- Average daily COP (quality-weighted)
- Method breakdown percentages
- Quality score (0-100%)
- Temperature bin classification

**Seasonal SCOP Calculation:**

- Weekly SCOP updates
- Method contribution analysis
- Quality confidence determination
- European standard compliance

### Data Requirements

**Minimum for SCOP Calculation:**

- **100+ hours** of heating season data
- **At least 30 days** with measurements
- **Basic temperature sensors** functional

**Recommended for Accuracy:**

- **400+ hours** of quality data
- **Full heating season** coverage
- **Multiple measurement methods** available
- **External power monitoring** installed

---

## Factors Affecting Your SCOP

### Weather Conditions

- **Mild winters** → Higher SCOP (less work required)
- **Harsh winters** → Lower SCOP (more work required)
- **Variable climate** → More realistic SCOP

### System Installation

- **Proper sizing** → Optimal SCOP
- **Oversized system** → Lower SCOP (cycling losses)
- **Undersized system** → Lower SCOP (continuous high load)

### Maintenance Level

- **Clean heat exchangers** → Higher SCOP
- **Optimal refrigerant charge** → Higher SCOP
- **Regular servicing** → Sustained SCOP

### Usage Patterns

- **Consistent temperatures** → Higher SCOP
- **Frequent adjustments** → Lower SCOP
- **Smart scheduling** → Optimized SCOP

---

## Improving Your SCOP

### User Actions

**Temperature Management:**

- Set consistent temperatures (don't constantly adjust)
- Use night setback carefully (small reductions only)
- Optimize supply water temperature for your system

**System Maintenance:**

- Annual professional service
- Keep outdoor unit clear of debris
- Check and clean filters regularly
- Monitor refrigerant levels

**Smart Operation:**

- Use weather compensation if available
- Schedule heating during off-peak hours
- Avoid manual overrides when possible

### Professional Optimization

**System Tuning:**

- Heat curve adjustment
- Flow rate optimization
- Control parameter fine-tuning
- Defrost cycle optimization

**Hardware Upgrades:**

- Variable speed pump installation
- Smart thermostats
- Weather sensors
- External power monitoring

---

## SCOP Troubleshooting

### SCOP Lower Than Expected?

**Check These First:**

1. **System maintenance** - when was last service?
2. **Temperature settings** - are they realistic?
3. **Data quality** - is confidence level high enough?
4. **Seasonal coverage** - do you have full winter data?

**Common Causes:**

- **Cold winter** → naturally lower SCOP
- **Poor insulation** → system works harder
- **Incorrect sizing** → efficiency penalties
- **Maintenance needed** → declining performance

### SCOP Calculation Not Available?

**Requirements Check:**

- Heating season must be active (Oct 1 - May 15)
- Minimum 100 hours of operation data
- Basic temperature sensors functional
- System properly configured

**Data Quality Issues:**

- Check sensor health diagnostics
- Verify flow rate measurements
- Confirm temperature readings reasonable
- Review method contribution breakdown

---

## SCOP vs Energy Labels

### European Energy Label Ratings

Heat pumps are rated A+++ to D based on SCOP:

| Rating | SCOP Range | Performance |
|--------|------------|-------------|
| **A+++** | ≥ 5.1 | Exceptional |
| **A++** | 4.6 - 5.0 | Excellent |
| **A+** | 4.0 - 4.5 | Very Good |
| **A** | 3.4 - 3.9 | Good |
| **B** | 3.1 - 3.3 | Average |
| **C** | 2.8 - 3.0 | Below Average |
| **D** | < 2.8 | Poor |

### Real vs Laboratory SCOP

**Laboratory SCOP** (Energy Label):

- Standardized test conditions
- Perfect maintenance
- Optimal installation
- May be 10-20% higher than real-world

**Your Actual SCOP**:

- Real weather conditions
- Actual installation quality
- Real usage patterns
- More representative of energy bills

**Typical Real-World Results:**

- Laboratory SCOP 4.5 → Actual SCOP 3.8-4.2
- Laboratory SCOP 3.8 → Actual SCOP 3.2-3.6

---

## SCOP Best Practices

### For Homeowners

**Daily Operation:**

- Set temperature and leave it alone
- Use programmable schedules wisely
- Keep outdoor unit area clear
- Monitor system alerts

**Seasonal Preparation:**

- Annual professional maintenance
- Clean or replace filters
- Check antifreeze levels
- Test backup heating systems

**Long-term Monitoring:**

- Track SCOP trends year-to-year
- Compare against energy bills
- Note any significant changes
- Schedule service if SCOP declines

### For Installers

**System Design:**

- Proper heat pump sizing
- Optimal heat curve settings
- Quality sensor placement
- Professional commissioning

**Data Quality:**

- External power monitoring recommended
- All temperature sensors calibrated
- Flow measurement accuracy verified
- Regular system diagnostics

---

This comprehensive SCOP monitoring with **EN 14825 compliance** provides you with accurate, real-world efficiency data to optimize your heat pump performance and minimize energy costs throughout each heating season! 🌡️⚡
