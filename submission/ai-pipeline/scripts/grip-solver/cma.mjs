// Minimal (mu/mu_w, lambda)-CMA-ES (Hansen's purecma), with a Jacobi eigen-decomposition. Minimises f(x).
export function cmaes(f, x0, sigma0, { lambda, maxEval = 20000, seed = 1, log = 0, stopSigma = 1e-3, scale } = {}) {
  const n = x0.length;
  let rs = seed >>> 0 || 1; const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const sc = scale || new Array(n).fill(1);
  lambda = lambda || 4 + Math.floor(3 * Math.log(n)); const mu = Math.floor(lambda / 2);
  let w = Array.from({ length: mu }, (_, i) => Math.log(mu + .5) - Math.log(i + 1)); const ws = w.reduce((a, b) => a + b, 0); w = w.map(x => x / ws);
  const mueff = 1 / w.reduce((a, b) => a + b * b, 0);
  const cc = (4 + mueff / n) / (n + 4 + 2 * mueff / n), cs = (mueff + 2) / (n + mueff + 5), c1 = 2 / ((n + 1.3) ** 2 + mueff);
  const cmu = Math.min(1 - c1, 2 * (mueff - 2 + 1 / mueff) / ((n + 2) ** 2 + mueff)), damps = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + cs;
  const chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
  let m = x0.map((v, i) => v / sc[i]), sigma = sigma0;
  let pc = new Array(n).fill(0), ps = new Array(n).fill(0);
  let B = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j))), Dg = new Array(n).fill(1);
  let C = B.map(r => r.slice()), invsqrtC = B.map(r => r.slice());
  let evals = 0, gen = 0, best = { f: Infinity, x: x0.slice() }, eigeneval = 0;
  const toX = y => y.map((v, i) => v * sc[i]);
  while (evals < maxEval) {
    const pop = [];
    for (let k = 0; k < lambda; k++) {
      const z = Array.from({ length: n }, gauss), y = new Array(n).fill(0);
      for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += B[i][j] * Dg[j] * z[j]; y[i] = s; }
      const xs = m.map((v, i) => v + sigma * y[i]);
      const fx = f(toX(xs)); evals++;
      pop.push({ xs, fx });
      if (fx < best.f) best = { f: fx, x: toX(xs) };
    }
    pop.sort((a, b) => a.fx - b.fx);
    const mold = m.slice();
    m = new Array(n).fill(0); for (let k = 0; k < mu; k++) for (let i = 0; i < n; i++) m[i] += w[k] * pop[k].xs[i];
    const dm = m.map((v, i) => (v - mold[i]) / sigma);
    const t = new Array(n).fill(0); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += invsqrtC[i][j] * dm[j]; t[i] = s; }
    const a1 = Math.sqrt(cs * (2 - cs) * mueff); ps = ps.map((v, i) => (1 - cs) * v + a1 * t[i]);
    const psn = Math.hypot(...ps); gen++;
    const hsig = psn / Math.sqrt(1 - (1 - cs) ** (2 * gen)) / chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
    const a2 = Math.sqrt(cc * (2 - cc) * mueff); pc = pc.map((v, i) => (1 - cc) * v + hsig * a2 * dm[i]);
    const art = pop.slice(0, mu).map(p => p.xs.map((v, i) => (v - mold[i]) / sigma));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = 0; for (let k = 0; k < mu; k++) s += w[k] * art[k][i] * art[k][j];
      const v = (1 - c1 - cmu) * C[i][j] + c1 * (pc[i] * pc[j] + (1 - hsig) * cc * (2 - cc) * C[i][j]) + cmu * s;
      C[i][j] = C[j][i] = v;
    }
    sigma *= Math.exp((cs / damps) * (psn / chiN - 1));
    if (evals - eigeneval > lambda / (c1 + cmu) / n / 10) {
      eigeneval = evals;
      const { V, d } = jacobiEig(C);
      Dg = d.map(x => Math.sqrt(Math.max(x, 1e-20))); B = V;
      invsqrtC = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => { let s = 0; for (let k = 0; k < n; k++) s += B[i][k] * B[j][k] / Dg[k]; return s; }));
    }
    if (log && gen % log === 0) console.log(`gen ${gen} evals ${evals} best ${best.f.toFixed(4)} cur ${pop[0].fx.toFixed(4)} sigma ${sigma.toExponential(2)}`);
    if (sigma * Math.max(...Dg) < stopSigma) break;
  }
  return best;
}
function jacobiEig(A0) {
  const n = A0.length, A = A0.map(r => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  return { V, d: A.map((r, i) => r[i]) };
}
