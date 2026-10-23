'use strict';

/**
 * Huidige learner (gecompileerd uit de werkboom) plus varianten met de
 * voorgestelde wijzigingen uit BUILDING_MODEL_REVIEW.md:
 *   psd    — §2.6: P-matrix via eigenwaarde-begrenzing in plaats van elementgewijze clipping
 *   bounds — §2.7: fysische grenzen op τ = 1/θ[1] en UA = θ[1]/θ[0] (ook bij restore)
 *   order  — §2.1: uniforme 5%-schaling van Δθ vóór de bounds-check
 *   vff    — §2.8: geconfigureerde λ als nominale waarde, VFF verlaagt bij grote fout
 * Alleen updateRLS() en restoreState() worden overschreven; de rest is de echte code.
 */

const { BuildingModelLearner } = require('../../../.homeybuild/lib/shared/adaptive/building-model-learner');

const { P_FLOOR, P_CEILING } = BuildingModelLearner.RLS_COVARIANCE;

// --- 4×4 symmetrische eigen-decompositie (Jacobi) ---------------------------
function jacobiEigen(A) {
  const n = A.length;
  const a = A.map((r) => [...r]);
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: a.map((r, i) => r[i]), vectors: v };
}

function minEigen(P) {
  const sym = P.map((r, i) => r.map((x, j) => (x + P[j][i]) / 2));
  return Math.min(...jacobiEigen(sym).values);
}

function clampSpectrum(P, lo, hi) {
  const sym = P.map((r, i) => r.map((x, j) => (x + P[j][i]) / 2));
  const { values, vectors } = jacobiEigen(sym);
  const lam = values.map((x) => Math.max(lo, Math.min(hi, x)));
  const n = P.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += vectors[i][k] * lam[k] * vectors[j][k];
      out[i][j] = s;
    }
  }
  return out;
}

// --- Grenzen ----------------------------------------------------------------
const CURRENT = {
  theta0_min: 1 / 40, theta0_max: 1 / 5,
  theta1_min: 0.05 / 40, theta1_max: 1.0 / 5,
  ratio_min: 0.002, ratio_max: 0.8, // werkt in de huidige code op UA = θ1/θ0
  g_c_min: 0.2 / 40, g_c_max: 0.8 / 5,
  pint_c_min: 0.1 / 40, pint_c_max: 0.6 / 5,
};

function validCurrent(t) {
  const b = CURRENT;
  return t[0] >= b.theta0_min && t[0] <= b.theta0_max
    && t[1] >= b.theta1_min && t[1] <= b.theta1_max
    && t[2] >= b.g_c_min && t[2] <= b.g_c_max
    && t[3] >= b.pint_c_min && t[3] <= b.pint_c_max
    && t[1] > t[0] * b.ratio_min && t[1] < t[0] * b.ratio_max;
}

// Voorstel §2.7: dezelfde componentgrenzen, maar τ = 1/θ1 ∈ [1,25; 500] h en UA = θ1/θ0 ∈ [0,03; 1,5] kW/°C
const FIXED = { tau_min: 1.25, tau_max: Number(process.env.TAU_MAX || 500), ua_min: 0.03, ua_max: 1.5 };

function validFixed(t) {
  const b = CURRENT;
  if (!(t[0] >= b.theta0_min && t[0] <= b.theta0_max)) return false;
  if (!(t[2] >= b.g_c_min && t[2] <= b.g_c_max)) return false;
  if (!(t[3] >= b.pint_c_min && t[3] <= b.pint_c_max)) return false;
  if (!(t[1] > 0)) return false;
  const tau = 1 / t[1];
  const ua = t[1] / t[0];
  return tau >= FIXED.tau_min && tau <= FIXED.tau_max && ua >= FIXED.ua_min && ua <= FIXED.ua_max;
}

// --- Variant-learner ----------------------------------------------------------
function makeLearner(opts = {}) {
  const {
    psd = false, bounds = false, order = false, vff = false,
    profile = 'average', lambda = 0.999,
    reimpl = false, // true: huidige semantiek via de herimplementatie (controle op gelijkheid)
  } = opts;
  const variant = { psd, bounds, order, vff };
  const isCurrent = !reimpl && !psd && !bounds && !order && !vff;

  const L = new BuildingModelLearner({
    forgettingFactor: lambda,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: profile,
    enableDynamicPInt: false,
    logger: () => {},
  });

  L.stats = { updates: 0, reverts: 0, rateLimited: 0, negXPX: 0, negEigUpdates: 0, minEig: Infinity, lambdas: [] };

  const baseUpdate = L.updateRLS.bind(L);

  L.updateRLS = function updateRLS(X, y) {
    if (isCurrent) {
      // Echte code; alleen meten (P vóór de update bepaalt de gain-noemer)
      const PX = this.matrixVectorMultiply(this.P, X);
      if (this.dotProduct(X, PX) < 0) this.stats.negXPX++;
      const revertsBefore = this.totalReverts;
      baseUpdate(X, y);
      if (this.totalReverts > revertsBefore) { this.stats.reverts++; return; }
      this.stats.updates++;
      const me = minEigen(this.P);
      this.stats.minEig = Math.min(this.stats.minEig, me);
      if (me < 0) this.stats.negEigUpdates++;
      return;
    }

    const prediction = this.dotProduct(X, this.theta);
    const err = y - prediction;
    const en = Math.min(Math.abs(err) / 2, 1);
    let lam;
    if (variant.vff) {
      // Nominale λ bij kleine fout, tot 0,995 bij grote fout
      const s = 1 / (1 + Math.exp(-8 * (en - 0.5)));
      lam = this.lambda - s * (this.lambda - 0.995);
    } else {
      const s = 1 / (1 + Math.exp(-5 * (en - 0.25)));
      lam = Math.max(0.9999 - s * (0.9999 - 0.995), this.lambda);
    }
    this.stats.lambdas.push(lam);

    const PX = this.matrixVectorMultiply(this.P, X);
    const xpx = this.dotProduct(X, PX);
    if (xpx < 0) this.stats.negXPX++;
    const K = PX.map((v) => v / (lam + xpx));
    const dTheta = K.map((k) => k * err);
    const prev = [...this.theta];
    let cand;
    let limited = false;
    if (variant.order) {
      let scale = 1;
      for (let i = 0; i < 4; i++) {
        const maxCh = Math.abs(prev[i]) * 0.05;
        if (Math.abs(dTheta[i]) > maxCh && maxCh > 0) scale = Math.min(scale, maxCh / Math.abs(dTheta[i]));
      }
      limited = scale < 1;
      cand = prev.map((v, i) => v + scale * dTheta[i]);
    } else {
      cand = prev.map((v, i) => v + dTheta[i]);
    }
    const ok = variant.bounds ? validFixed(cand) : validCurrent(cand);
    if (!ok) {
      this.totalReverts++;
      this.consecutiveReverts++;
      this.stats.reverts++;
      return; // zoals de huidige code: θ en P ongewijzigd
    }
    this.consecutiveReverts = 0;
    if (!variant.order) {
      for (let i = 0; i < 4; i++) {
        const maxCh = Math.abs(prev[i]) * 0.05;
        const ch = cand[i] - prev[i];
        if (Math.abs(ch) > maxCh && maxCh > 0) { cand[i] = prev[i] + Math.sign(ch) * maxCh; limited = true; }
      }
    }
    if (limited) { this.rateLimitActivations++; this.stats.rateLimited++; }
    this.theta = cand;
    this.stats.updates++;

    const KXP = this.matrixMultiply(this.outerProduct(K, X), this.P);
    let Pn = this.P.map((row, i) => row.map((v, j) => (v - KXP[i][j]) / lam));
    if (variant.psd) {
      Pn = clampSpectrum(Pn, P_FLOOR, P_CEILING);
    } else {
      Pn = Pn.map((row, i) => row.map((v, j) => (i === j ? Math.max(P_FLOOR, Math.min(P_CEILING, v)) : v)));
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const s = (Pn[i][j] + Pn[j][i]) / 2;
          const m = Math.sqrt(Pn[i][i] * Pn[j][j]);
          Pn[i][j] = Math.max(-m, Math.min(m, s));
          Pn[j][i] = Pn[i][j];
        }
      }
    }
    this.P = Pn;
    const me = minEigen(this.P);
    this.stats.minEig = Math.min(this.stats.minEig, me);
    if (me < 0) this.stats.negEigUpdates++;
  };

  // §2.2/§2.2-variant: invoer uitlijnen op het begin van het interval, optioneel over een venster van N samples
  const windowN = opts.window ?? (opts.align ? 1 : 0);
  if (windowN > 0) {
    const buf = [];
    L.addMeasurement = function addMeasurement(data) {
      const prev = buf[buf.length - 1];
      if (!prev || (data.timestamp - prev.timestamp) / 3600000 > 0.25) {
        buf.length = 0; buf.push(data);
        this.lastMeasurement = data;
        if (!prev) this.sampleCount++;
        return;
      }
      buf.push(data);
      if (buf.length > windowN + 1) buf.shift();
      if (buf.length < windowN + 1) { this.lastMeasurement = data; this.sampleCount++; return; }
      const base = buf[0];
      const inputs = buf.slice(0, windowN); // samples aan het begin van elk deelinterval
      const hours = (data.timestamp - base.timestamp) / 3600000;
      const y = (data.tIndoor - base.tIndoor) / hours;
      if (Math.abs(y) > 10) return;
      const mean = (f) => inputs.reduce((a, s) => a + f(s), 0) / inputs.length;
      const X = [
        mean((s) => s.pHeating),
        mean((s) => s.tOutdoor - s.tIndoor),
        mean((s) => (s.solarRadiation || 0) / 1000),
        1,
      ];
      this.updateRLS(X, y);
      this.lastMeasurement = data;
      this.sampleCount++;
    };
  }

  // ADR-062 B1/B2: tijdgebaseerd venster. Invoer tijdgewogen per deelinterval; een gat > 15 min
  // start het venster opnieuw. mode 'overlap' leert elke sample, 'block' één keer per venster.
  if (opts.windowMin) {
    const W = opts.windowMin * 60000;
    const mode = opts.windowMode || 'overlap';
    let buf = [];
    L.stats.windowResets = 0;
    L.addMeasurement = function addMeasurement(data) {
      const prev = buf[buf.length - 1];
      const maxGap = (opts.maxGapMin ?? 15) * 60000;
      if (!prev || data.timestamp - prev.timestamp > maxGap) {
        if (prev) L.stats.windowResets++;
        buf = [data];
        this.lastMeasurement = data;
        if (!prev) this.sampleCount++;
        return;
      }
      buf.push(data);
      while (buf.length > 2 && data.timestamp - buf[1].timestamp >= W) buf.shift();
      const span = data.timestamp - buf[0].timestamp;
      this.lastMeasurement = data;
      this.sampleCount++;
      if (span < W) return;
      let wP = 0; let wD = 0; let wS = 0;
      for (let j = 0; j < buf.length - 1; j++) {
        const dtj = buf[j + 1].timestamp - buf[j].timestamp;
        wP += buf[j].pHeating * dtj;
        wD += (buf[j].tOutdoor - buf[j].tIndoor) * dtj;
        wS += ((buf[j].solarRadiation || 0) / 1000) * dtj;
      }
      const y = (data.tIndoor - buf[0].tIndoor) / (span / 3600000);
      if (Math.abs(y) <= 10) this.updateRLS([wP / span, wD / span, wS / span, 1], y);
      if (mode === 'block') buf = [data];
    };
  }

  if (variant.bounds) {
    const baseRestore = L.restoreState.bind(L);
    L.restoreState = function restoreState(state) {
      if (!state.theta || !validFixed(state.theta)) {
        this.sampleCount = 0;
        this.lastMeasurement = null;
        return;
      }
      baseRestore(state);
    };
  }
  return L;
}

const projectPsd = (P) => clampSpectrum(P, P_FLOOR, P_CEILING);

module.exports = { makeLearner, minEigen, projectPsd, validCurrent, validFixed, BuildingModelLearner };
