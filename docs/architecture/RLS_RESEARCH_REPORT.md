# RLS Algoritme Wetenschappelijk Onderzoek

## Probleemstelling

De huidige implementatie gebruikt een **vaste forgetting factor λ = 0.999**, wat twee tegenstrijdige problemen veroorzaakt:

1. **Confidence bleef steken** → oplossing was λ verlagen van ~0.9999 naar 0.999
2. **C daalt te snel** (13→5 in korte tijd) → gevolg van lagere λ

Dit is een bekend trade-off in RLS literatuur.

---

## Wetenschappelijke Bevindingen

### 1. Het Fundamentele Trade-Off

| λ waarde | Effect | Probleem |
|----------|--------|----------|
| **λ → 1** (0.9999) | Stabiel, maar traag | Covariance wind-up, confidence stopt |
| **λ → 0.99** | Snel adapteren | Overgevoelig voor ruis, divergentie |
| **λ = 0.999** (huidig) | Compromis | Nog steeds te gevoelig voor uitschieters |

### 2. Wetenschappelijk Aanbevolen Oplossingen

#### A. Variable Forgetting Factor RLS (VFF-RLS)

**Referentie:** University of Michigan, IEEE

```
λ(k) = λ_min + (λ_max - λ_min) × f(error)
```

- **Kleine error** → λ → 1 (stabiel, weinig leren)
- **Grote error** → λ → 0.99 (snel leren)
- **Sigmoid functie** voor smooth transitie

**Implementatie voor gebouwmodel:**

```typescript
// Adaptive lambda based on prediction error
const predictionError = Math.abs(actualT - predictedT);
const errorThreshold = 0.5; // °C
const sigmoid = 1 / (1 + Math.exp(-5 * (predictionError - errorThreshold)));
const adaptiveLambda = 0.9999 - sigmoid * (0.9999 - 0.995);
// Range: 0.9999 (stabiel) → 0.995 (snel leren)
```

#### B. Bounded Covariance (aI ≤ P ≤ bI)

**Probleem:** Covariance matrix kan divergeren OF te klein worden

**Oplossing:** Forceer bounds op P matrix:

```typescript
const P_MIN = 0.001;  // Minimum onzekerheid (voorkomt "bevriezing")
const P_MAX = 10.0;   // Maximum onzekerheid (voorkomt explosie)

// Na elke P update:
this.P = this.P.map((row, i) => row.map((val, j) => 
  i === j ? Math.max(P_MIN, Math.min(P_MAX, val)) : val
));
```

#### C. Exponential Resetting RLS (ER-RLS)

**Referentie:** University of Michigan

Periodiek reset covariance naar baseline om wind-up te voorkomen:

```typescript
const RESET_INTERVAL_SAMPLES = 1000; // ~3-4 dagen bij 10min interval

if (this.sampleCount % RESET_INTERVAL_SAMPLES === 0) {
  // Partial reset: mix current P with initial P
  const resetRatio = 0.1; // 10% reset
  this.P = this.P.map((row, i) => row.map((val, j) => 
    val * (1 - resetRatio) + this.initialP[i][j] * resetRatio
  ));
}
```

#### D. Parameter Rate Limiting

**Nieuw concept:** Beperk hoe snel parameters kunnen veranderen

```typescript
const MAX_C_CHANGE_PER_HOUR = 0.2; // Max 20% change per hour
const C_new = 1 / this.theta[0];
const C_old = this.lastC;
const maxChange = C_old * MAX_C_CHANGE_PER_HOUR * dt_hours;

if (Math.abs(C_new - C_old) > maxChange) {
  // Clamp the change
  const clampedC = C_old + Math.sign(C_new - C_old) * maxChange;
  this.theta[0] = 1 / clampedC;
}
```

---

## Analyse Huidige Implementatie

| Aspect | Huidige Status | Probleem | Oplossing |
|--------|---------------|----------|-----------|
| λ (forgetting) | Vast 0.999 | Geen adaptatie aan error | VFF-RLS |
| P bounds | Floor alleen (0.0001) | Geen upper bound | Bounded P |
| θ bounds | Ja (regel 165-176) | Bounds te wijd (C: 5-40) | Strakker of rate limit |
| Covariance reset | Nee | Wind-up bij lage excitatie | ER-RLS |

---

## Aanbevolen Implementatie

### Prioriteit 1: Variable Forgetting Factor

```typescript
// In updateRLS() - vervang vaste adaptiveLambda

// Calculate prediction error from last cycle
const lastError = Math.abs(this.lastPredictionError || 0);
const errorNormalized = Math.min(lastError / 2.0, 1.0); // 2°C = max error

// Sigmoid mapping: large error → lower lambda
const sigmoid = 1 / (1 + Math.exp(-5 * (errorNormalized - 0.25)));
const adaptiveLambda = 0.9999 - sigmoid * (0.9999 - 0.995);
// Range: 0.9999 (stable) to 0.995 (fast tracking)
```

### Prioriteit 2: Parameter Rate Limiting

```typescript
// Na theta update, voor bounds check

const MAX_THETA_CHANGE_RATIO = 0.05; // Max 5% per sample
for (let i = 0; i < 4; i++) {
  const maxChange = Math.abs(thetaPrevious[i]) * MAX_THETA_CHANGE_RATIO;
  const actualChange = this.theta[i] - thetaPrevious[i];
  if (Math.abs(actualChange) > maxChange) {
    this.theta[i] = thetaPrevious[i] + Math.sign(actualChange) * maxChange;
    this.logger(`Rate-limited θ[${i}] change from ${actualChange.toFixed(6)} to ±${maxChange.toFixed(6)}`);
  }
}
```

### Prioriteit 3: Covariance Upper Bound

```typescript
const P_MAX = 1.0; // Current initCov is 1.0, so cap at initial value

// After P matrix update
this.P = this.P.map((row, i) => row.map((val, j) => {
  if (i === j) {
    return Math.max(P_FLOOR, Math.min(P_MAX, val));
  }
  return val;
}));
```

---

## Verwachte Resultaten

| Metric | Nu | Na implementatie |
|--------|-----|-----------------|
| C stabiliteit | Kan 13→5 in uren | Max ~20% per dag |
| Confidence groei | OK met λ=0.999 | Behouden |
| Tracking vermogen | Te agressief | Adaptief per situatie |
| Divergentie risico | Hoog | Laag (bounded) |

---

## Bronnen

1. University of Michigan - "Recursive Least Squares with Forgetting"
2. IEEE - "Variable Forgetting Factor RLS for Time-Varying Systems"
3. MDPI - "Adaptive Forgetting Factor for Battery Parameter Estimation"
4. Wikipedia - "Recursive Least Squares Filter"
