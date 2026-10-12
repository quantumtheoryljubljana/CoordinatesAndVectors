/*
 * Coordinate systems — no libraries, build step, or network requests.
 * Open index.html beside coordinates.css and this file.
 * Physics convention: theta from +z, phi from +x towards +y; angles in radians internally.
 * Vectors are position vectors from the origin. Red arrows are orthonormal
 * unit bases at their endpoints, with true length 1 in the same coordinate units.
 * Orange velocity arrows start at the particle. Their display scale is 1 s:
 * an arrow tip is p + velocity * 1 s. Animation uses the actual tangent velocity.
 */
(() => {
  'use strict';
  const TAU = 2 * Math.PI, EPS = 1e-9, WIDTH = 640, HEIGHT = 470;
  const COLORS = ['#169447', '#2563eb', '#9333b8', '#c46a08', '#b8326c', '#07858f'];
  const BASIS_COLOR = '#d62e26', GUIDE_COLOR = '#3c61d5', VELOCITY_COLOR = '#b96400', VELOCITY_SCALE = 1;
  const SYSTEMS = ['cartesian', 'spherical', 'cylindrical'];
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const clean = x => Math.abs(x) < 1e-12 ? 0 : x;
  const wrap = x => ((x % TAU) + TAU) % TAU;
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const scale = (a, s) => a.map(x => x * s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const number = (x, digits = 2) => (Math.abs(x) < .5 * 10 ** -digits ? 0 : x).toFixed(digits);
  const subscript = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
  const vectorName = v => 'r' + subscript(v.id);
  const velocityName = v => 'v' + subscript(v.id);

  function coordinates(p, hints = {}) {
    const [x, y, z] = p, rho = Math.hypot(x, y), r = Math.hypot(rho, z);
    return {x, y, z, rho, r,
      phi: rho > EPS ? wrap(Math.atan2(y, x)) : wrap(hints.phi || 0),
      theta: r > EPS ? Math.atan2(rho, z) : clamp(hints.theta ?? Math.PI / 2, 0, Math.PI),
      axis: rho <= EPS, origin: r <= EPS};
  }
  function fromSpherical(r, theta, phi) {
    return [r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta)].map(clean);
  }
  function fromCylindrical(rho, phi, z) {
    return [rho * Math.cos(phi), rho * Math.sin(phi), z].map(clean);
  }
  function bases(system, c) {
    const st = Math.sin(c.theta), ct = Math.cos(c.theta), sp = Math.sin(c.phi), cp = Math.cos(c.phi);
    if (system === 'spherical') return [
      {label: 'r', v: [st * cp, st * sp, ct], ambiguous: c.origin},
      {label: 'θ', v: [ct * cp, ct * sp, -st], ambiguous: c.axis},
      {label: 'φ', v: [-sp, cp, 0], ambiguous: c.axis}
    ];
    if (system === 'cylindrical') return [
      {label: 'ρ', v: [cp, sp, 0], ambiguous: c.axis},
      {label: 'φ', v: [-sp, cp, 0], ambiguous: c.axis},
      {label: 'z', v: [0, 0, 1], ambiguous: false}
    ];
    return [{label: 'x', v: [1, 0, 0]}, {label: 'y', v: [0, 1, 0]}, {label: 'z', v: [0, 0, 1]}];
  }
  function makeVector(id, p, color = COLORS[(id - 1) % COLORS.length]) {
    const c = coordinates(p);
    return {id, p: [...p], phi: c.phi, theta: c.theta, color, visible: true, basis: true, mode: 'cartesian',
      velocity: true, vel: c.origin ? [0, 0, 0] : add(motionVelocity(p, c, 'azimuth', 20), scale(bases('spherical', c)[1].v, .6)).map(clean)};
  }
  function vectorComponents(a, system, c) {
    return bases(system, c).map(b => clean(dot(a, b.v)));
  }
  function motionVelocity(p, hints, motion, speed, polarDirection = 1) {
    const omega = speed * Math.PI / 180;
    if (motion === 'azimuth') return scale([-p[1], p[0], 0], omega).map(clean);
    const c = coordinates(p, hints);
    return scale(bases('spherical', c)[1].v, c.r * omega * polarDirection).map(clean);
  }
  const initialCamera = () => ({yaw: 22 * Math.PI / 180, elevation: 25 * Math.PI / 180, zoom: 1, view: '3d'});

  // One shared orthographic camera and scale for all three diagrams.
  function makeProjection(vectors, camera, options) {
    const visible = vectors.filter(v => v.visible);
    const a = camera.yaw, e = camera.elevation;
    const right = [-Math.sin(a), Math.cos(a), 0];
    const up = [-Math.sin(e) * Math.cos(a), -Math.sin(e) * Math.sin(a), Math.cos(e)];
    const forward = [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
    const raw = p => [dot(p, right), -dot(p, up), dot(p, forward)];
    const length = Math.max(4, Math.ceil(Math.max(0, ...visible.flatMap(v => v.p.map(Math.abs))) + 1.5));
    const negatives = [0, 1, 2].map(i => Math.max(.65, ...visible.map(v => -v.p[i] + .8)));
    const points = [[0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      const pos = [0, 0, 0], neg = [0, 0, 0];
      pos[i] = length; neg[i] = -negatives[i]; points.push(pos, neg);
    }
    for (const v of visible) {
      points.push(v.p, [v.p[0], v.p[1], 0]);
      if (options.velocity && v.velocity) points.push(add(v.p, scale(v.vel, VELOCITY_SCALE)));
      if (options.basis && v.basis) for (const s of SYSTEMS) for (const b of bases(s, coordinates(v.p, v))) points.push(add(v.p, b.v));
    }
    if (options.grid) for (const x of [-negatives[0], length]) for (const y of [-negatives[1], length]) points.push([x, y, 0]);
    const projected = points.map(raw);
    const xs = projected.map(p => p[0]), ys = projected.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const unit = Math.min((WIDTH - 110) / Math.max(1, x1 - x0), (HEIGHT - 105) / Math.max(1, y1 - y0)) * camera.zoom;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return {length, negatives, unit, project(p) { const q = raw(p); return [WIDTH / 2 + (q[0] - cx) * unit, HEIGHT / 2 + (q[1] - cy) * unit, q[2]]; }};
  }

  function sceneSVG(system, vectors, selectedId, camera, options, description = '') {
    const {project, length, negatives} = makeProjection(vectors, camera, options);
    const parts = [], labels = [];
    const f = x => Number(x.toFixed(3));
    const point = p => `${f(p[0])},${f(p[1])}`;
    const label = (p, text, color = '#222', size = 21, dx = 0, dy = 0, priority = 2, math = false) => {
      const q = project(p); labels.push({x: q[0] + dx, y: q[1] + dy, text, color, size, priority, math});
    };
    function line(a, b, color, width = 1.5, dashed = false, opacity = 1) {
      const p = project(a), q = project(b);
      parts.push(`<line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}" stroke="${color}" stroke-width="${width}"${dashed ? ' stroke-dasharray="6 5"' : ''} opacity="${opacity}"/>`);
    }
    function arrow(a, b, color, width = 2.5, dashed = false, opacity = 1, head = 9) {
      const p = project(a), q = project(b), dx = q[0] - p[0], dy = q[1] - p[1], n = Math.hypot(dx, dy);
      if (n < 2) {
        // A vector along the viewing direction projects to a point: dot / cross.
        if (Math.hypot(...b.map((x, i) => x - a[i])) < EPS) return;
        parts.push(`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="5" fill="white" stroke="${color}" stroke-width="1.5" opacity="${opacity}"/>`);
        if (q[2] > p[2]) parts.push(`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="1.7" fill="${color}" opacity="${opacity}"/>`);
        else parts.push(`<path d="M${f(q[0] - 3)} ${f(q[1] - 3)}l6 6m0 -6l-6 6" stroke="${color}" stroke-width="1.2" opacity="${opacity}"/>`);
        return;
      }
      const ux = dx / n, uy = dy / n, h = Math.min(head, n * .42), hw = h * .44;
      const base = [q[0] - h * ux, q[1] - h * uy];
      parts.push(`<line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0] - h * .65 * ux)}" y2="${f(q[1] - h * .65 * uy)}" stroke="${color}" stroke-width="${width}"${dashed ? ' stroke-dasharray="5 4"' : ''} opacity="${opacity}"/>`);
      parts.push(`<polygon points="${point(q)} ${point([base[0] - hw * uy, base[1] + hw * ux])} ${point([base[0] + hw * uy, base[1] - hw * ux])}" fill="${color}" opacity="${opacity}"/>`);
    }
    function curve(points, color, dashed = false, arrowEnd = false, opacity = 1) {
      const path = points.map(project).map(point).join(' ');
      parts.push(`<polyline points="${path}" fill="none" stroke="${color}" stroke-width="1.6"${dashed ? ' stroke-dasharray="4 4"' : ''} opacity="${opacity}"/>`);
      if (arrowEnd && points.length > 3) arrow(points[points.length - 4], points.at(-1), color, 1.6, false, opacity, 7);
    }
    function arc(fn, max, color, opacity = 1, arrowEnd = false) {
      const steps = Math.max(24, Math.ceil(max / .06));
      curve(Array.from({length: steps + 1}, (_, i) => fn(max * i / steps)), color, false, arrowEnd, opacity);
    }
    const origin = [0, 0, 0];
    parts.push(`<title>${esc(description)}</title><rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>`);
    const tick = length <= 8 ? 1 : 10 ** Math.floor(Math.log10(length / 4)) * (length / (10 ** Math.floor(Math.log10(length / 4))) > 10 ? 5 : 2);
    if (options.grid) {
      for (let x = Math.ceil(-negatives[0] / tick) * tick; x <= length; x += tick) line([x, -negatives[1], 0], [x, length, 0], '#e6e8ec', 1);
      for (let y = Math.ceil(-negatives[1] / tick) * tick; y <= length; y += tick) line([-negatives[0], y, 0], [length, y, 0], '#e6e8ec', 1);
    }
    for (let i = 0; i < 3; i++) {
      const end = [0, 0, 0], neg = [0, 0, 0]; end[i] = length; neg[i] = -negatives[i];
      line(origin, neg, '#a8a8a8', 1.2, true);
      arrow(origin, end, '#52555b', 1.7, false, 1, 10);
      const o = project(origin), q = project(end), n = Math.hypot(q[0] - o[0], q[1] - o[1]);
      const ux = n > 1 ? (q[0] - o[0]) / n : 1, uy = n > 1 ? (q[1] - o[1]) / n : 0;
      label(end, 'xyz'[i], '#202124', 25, 16 * ux, 16 * uy, 0, true);
      if (n > 50) for (let k = Math.ceil(-negatives[i] / tick) * tick; k < length - .1; k += tick) {
        if (Math.abs(k) < EPS) continue;
        const p = [0, 0, 0]; p[i] = k; const s = project(p);
        parts.push(`<line x1="${f(s[0] + uy * 3)}" y1="${f(s[1] - ux * 3)}" x2="${f(s[0] - uy * 3)}" y2="${f(s[1] + ux * 3)}" stroke="#989ba0" stroke-width="1"/>`);
        label(p, String(clean(k)), '#83868a', 14, -uy * 13, ux * 13, 5);
      }
    }
    const selected = vectors.find(v => v.id === selectedId && v.visible);
    if (selected) {
      const c = coordinates(selected.p, selected), p = selected.p, foot = [c.x, c.y, 0];
      if (options.guides && system === 'cartesian') {
        const px = [c.x, 0, 0], py = [0, c.y, 0], pz = [0, 0, c.z];
        for (const [a, b] of [[px, foot], [py, foot], [foot, p], [pz, p], [px, [c.x, 0, c.z]], [[c.x, 0, c.z], p]]) line(a, b, '#8ba2df', 1.4, true, .8);
        for (const [end, name] of [[px, 'x'], [py, 'y'], [pz, 'z']]) if (Math.hypot(...end) > EPS) {
          line(origin, end, GUIDE_COLOR, 2);
          label(scale(end, .55), name, GUIDE_COLOR, 22, 0, -15, 3, true);
        }
      }
      if (system !== 'cartesian') {
        if (options.guides) {
          line(origin, foot, GUIDE_COLOR, 1.7, true);
          line(foot, p, GUIDE_COLOR, 1.7, true);
          if (system === 'cylindrical') {
            const top = [0, 0, c.z]; line(top, p, '#91a6db', 1.3, true);
            if (c.rho > EPS) {
              arc(t => [c.rho * Math.cos(t), c.rho * Math.sin(t), 0], c.phi, '#91a6db', .55);
              label(scale(foot, .58), 'ρ', GUIDE_COLOR, 22, 0, 17, 3, true);
            }
            if (Math.abs(c.z) > EPS) label([c.x, c.y, c.z * .5], 'z', GUIDE_COLOR, 22, 18, 0, 3, true);
          } else if (!c.origin) {
            arc(t => fromSpherical(c.r, t, c.phi), c.theta, '#a6b5dc', .8);
          }
        }
        if (options.angles) {
          if (!c.axis && c.phi > .025) {
            const ar = Math.min(1.05, c.rho * .65);
            arc(t => [ar * Math.cos(t), ar * Math.sin(t), 0], c.phi, GUIDE_COLOR, 1, true);
            label([ar * Math.cos(c.phi / 2), ar * Math.sin(c.phi / 2), 0], 'φ', GUIDE_COLOR, 22, 0, 18, 3, true);
          }
          if (system === 'spherical' && !c.origin && c.theta > .025) {
            const ar = Math.min(1.35, c.r * .5);
            arc(t => fromSpherical(ar, t, c.phi), c.theta, GUIDE_COLOR, 1, true);
            label(fromSpherical(ar, c.theta / 2, c.phi), 'θ', GUIDE_COLOR, 22, -18, 0, 3, true);
          }
        }
      }
    }
    const visible = vectors.filter(v => v.visible).sort((a, b) => project(a.p)[2] - project(b.p)[2]);
    for (const v of visible) {
      const active = v.id === selectedId, opacity = active ? 1 : .8, c = coordinates(v.p, v);
      const p = project(v.p), o = project(origin), dx = p[0] - o[0], dy = p[1] - o[1];
      parts.push(`<g data-vector="${v.id}">`);
      arrow(origin, v.p, v.color, active ? 3.6 : 2.6, false, opacity, 12);
      if (active) parts.push(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="5.5" fill="white" stroke="${v.color}" stroke-width="2"/>`);
      label(scale(v.p, c.origin ? 1 : .62), vectorName(v), v.color, 24, dy > 0 ? 16 : -16, dx > 0 ? -12 : 12, 1, true);
      if (options.velocity && v.velocity && Math.hypot(...v.vel) > EPS) {
        const end = add(v.p, scale(v.vel, VELOCITY_SCALE)), q = project(end), n = Math.hypot(q[0] - p[0], q[1] - p[1]);
        parts.push(`<g data-velocity="${v.id}">`);
        arrow(v.p, end, VELOCITY_COLOR, active ? 3.6 : 2.6, false, opacity, 12);
        parts.push('</g>');
        label(end, velocityName(v), VELOCITY_COLOR, 24, n > 1 ? 20 * (q[0] - p[0]) / n : 16, n > 1 ? 20 * (q[1] - p[1]) / n : -16, 1, true);
      }
      if (options.basis && v.basis) for (const b of bases(system, c)) {
        const end = add(v.p, b.v), q = project(end), n = Math.hypot(q[0] - p[0], q[1] - p[1]);
        arrow(v.p, end, BASIS_COLOR, active ? 2.2 : 1.8, b.ambiguous, active ? 1 : .7, 9);
        const name = `ê${b.label}${visible.length > 1 ? ',' + v.id : ''}`;
        label(end, name, BASIS_COLOR, 21, n > 1 ? 17 * (q[0] - p[0]) / n : 13, n > 1 ? 17 * (q[1] - p[1]) / n : -13, 2, true);
      }
      parts.push('</g>');
    }
    label(origin, 'O', '#666', 18, -14, 16, 4, true);
    // Keep labels inside the view and avoid collisions with other labels.
    const boxes = [];
    for (const l of labels.sort((a, b) => a.priority - b.priority)) {
      const w = l.size * l.text.length * .57 + 7, h = l.size + 4;
      const offsets = [[0, 0], [0, -16], [0, 16], [18, 0], [-18, 0], [22, -18], [-22, -18], [22, 18], [-22, 18]];
      let best, bestScore = Infinity;
      for (let i = 0; i < offsets.length; i++) {
        const x = clamp(l.x + offsets[i][0], w / 2 + 6, WIDTH - w / 2 - 6), y = clamp(l.y + offsets[i][1], h / 2 + 6, HEIGHT - h / 2 - 6);
        const box = {x: x - w / 2, y: y - h / 2, w, h};
        let overlap = 0;
        for (const b of boxes) overlap += Math.max(0, Math.min(box.x + w, b.x + b.w) - Math.max(box.x, b.x)) * Math.max(0, Math.min(box.y + h, b.y + b.h) - Math.max(box.y, b.y));
        const score = overlap * 20 + i * 3;
        if (score < bestScore) { best = {x, y, box}; bestScore = score; }
      }
      boxes.push(best.box);
      const content = l.text.startsWith('ê') ? `ê<tspan baseline-shift="sub" font-size="75%">${esc(l.text.slice(2))}</tspan>` : esc(l.text);
      parts.push(`<text x="${f(best.x)}" y="${f(best.y + l.size * .34)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${l.size}"${l.math ? ' font-style="italic"' : ''} fill="${l.color}" stroke="white" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke fill">${content}</text>`);
    }
    return parts.join('');
  }

  // Expose just the deterministic geometry for independent numerical checks.
  if (typeof module !== 'undefined' && module.exports) module.exports = {coordinates, fromSpherical, fromCylindrical, bases, makeVector, makeProjection, sceneSVG, initialCamera, vectorComponents, motionVelocity};
  if (typeof document === 'undefined') return;

  const translations = {
    sl: {
      title: 'Koordinatni sistemi in enotski vektorji', intro: 'Krajevni vektor in hitrost v treh koordinatnih sistemih.',
      cartesian: 'Kartezične koordinate', spherical: 'Sferične koordinate', cylindrical: 'Cilindrične koordinate',
      fixedBasis: 'Smeri enotskih vektorjev so povsod enake.', sphericalBasisNote: 'Smeri enotskih vektorjev so odvisne od θ in φ.', cylindricalBasisNote: 'Smeri êρ in êφ so odvisne od φ; êz je nespremenljiv.',
      display: 'Prikaz:', unitVectors: 'Enotski vektorji', guides: 'Pomožne črte', angles: 'Koti', grid: 'Mreža xy', basisValues: 'Komponente baze',
      velocity: 'Hitrost', velocityUnits: 'koordinatne enote/s', perSecond: 'en./s',
      velocityHelp: 'Oranžne puščice prikazujejo hitrost v točki telesa; merilo puščic je 1 s. Komponente hitrosti lahko spreminjate, ko je animacija ustavljena. Med animacijo hitrost sledi gibanju.',
      view: 'Pogled:', zoom: 'Povečava', angleUnit: 'Koti:',
      viewHelp: 'Povlecite sliko za vrtenje vseh treh pogledov; kolešček spremeni povečavo. Tipkovnica: puščice, +/−, Home. Pomožne črte in koti pripadajo izbranemu vektorju.',
      vectors: 'Vektorji', addVector: '+ Dodaj vektor', examples: 'Primeri:', general: 'Splošni vektor', xyPlane: 'Ravnina xy', zAxis: 'Os z', compare: 'Tri različne smeri',
      motion: 'Gibanje:', play: 'Zaženi', pause: 'Ustavi', animateLabel: 'Izbrani vektor', azimuthMotion: 'Vrtenje okoli osi z (φ)', polarMotion: 'Vrtenje čez pola (θ)', speed: 'Kotna hitrost', reset: 'Ponastavi',
      visible: 'Prikaži', basis: 'Baza', remove: 'Odstrani', selectVector: 'Izberi vektor', color: 'Barva', inputSystem: 'Vnos koordinat',
      basisCaption: 'Baza izbranega vektorja; komponente (x, y, z)', axisWarning: 'Na osi z φ ni določen. Črtkana baza uporablja izbrani φ = {phi}.',
      originWarning: 'V izhodišču θ in φ nista določena. Črtkana baza uporablja izbrana θ = {theta} in φ = {phi}.',
      selected: 'Izbran: {name}.', unitLength: 'Rdeče puščice: enotski vektorji, dolžina 1.', hidden: 'Izbrani vektor je skrit.', playing: 'Giblje se {name}.', invalid: 'Vnesite končno število v prikazanem območju.',
      limit: 'Za dolžine in kartezične komponente je dovoljeno območje do 1000 po absolutni vrednosti.',
      noneVisible: 'Vsi vektorji so skriti.', sceneDescription: 'Koordinatni diagram. Povlecite ali uporabite puščice za vrtenje; +/− za povečavo; Home za začetni pogled.'
    },
    en: {
      title: 'Coordinate systems and unit vectors', intro: 'Position and velocity in three coordinate systems.',
      cartesian: 'Cartesian coordinates', spherical: 'Spherical coordinates', cylindrical: 'Cylindrical coordinates',
      fixedBasis: 'The unit-vector directions are the same everywhere.', sphericalBasisNote: 'The unit-vector directions depend on θ and φ.', cylindricalBasisNote: 'The directions of êρ and êφ depend on φ; êz stays fixed.',
      display: 'Display:', unitVectors: 'Unit vectors', guides: 'Projections', angles: 'Angles', grid: 'xy grid', basisValues: 'Basis components',
      velocity: 'Velocity', velocityUnits: 'coordinate units/s', perSecond: 'u/s',
      velocityHelp: 'Orange arrows show velocity at the particle; the arrow scale is 1 s. Edit the velocity components while paused. During animation, velocity follows the motion.',
      view: 'View:', zoom: 'Zoom', angleUnit: 'Angles:',
      viewHelp: 'Drag a diagram to rotate all three views; scroll to zoom. Keyboard: arrows, +/−, Home. Projections and angles belong to the selected vector.',
      vectors: 'Vectors', addVector: '+ Add vector', examples: 'Examples:', general: 'General vector', xyPlane: 'xy plane', zAxis: 'z axis', compare: 'Three different directions',
      motion: 'Motion:', play: 'Start', pause: 'Pause', animateLabel: 'Selected vector', azimuthMotion: 'Rotation about the z axis (φ)', polarMotion: 'Rotation through the poles (θ)', speed: 'Angular speed', reset: 'Reset',
      visible: 'Show', basis: 'Basis', remove: 'Remove', selectVector: 'Select vector', color: 'Colour', inputSystem: 'Coordinate input',
      basisCaption: 'Selected vector’s basis; components (x, y, z)', axisWarning: 'On the z axis φ is undefined. The dashed basis uses the chosen φ = {phi}.',
      originWarning: 'At the origin θ and φ are undefined. The dashed basis uses the chosen θ = {theta} and φ = {phi}.',
      selected: 'Selected: {name}.', unitLength: 'Red arrows: unit vectors, length 1.', hidden: 'The selected vector is hidden.', playing: '{name} is moving.', invalid: 'Enter a finite number within the indicated range.',
      limit: 'Lengths and Cartesian components are limited to 1000 in absolute value.',
      noneVisible: 'All vectors are hidden.', sceneDescription: 'Coordinate diagram. Drag or use arrow keys to rotate; +/− to zoom; Home to restore the initial view.'
    }
  };
  const state = {
    language: 'sl', angleUnit: 'deg', vectors: [makeVector(1, [2, 2.5, 3])], selected: 1, nextId: 2,
    camera: initialCamera(), options: {basis: true, guides: true, angles: true, grid: false, values: true, velocity: true},
    playing: false, motion: 'azimuth', speed: 20, polarDirection: 1, lastTime: null
  };
  const $ = id => document.getElementById(id);
  const t = (key, vars = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll('{' + k + '}', v), translations[state.language][key] || key);
  const current = () => state.vectors.find(v => v.id === state.selected);
  const angle = rad => number(state.angleUnit === 'deg' ? rad * 180 / Math.PI : rad, state.angleUnit === 'deg' ? 1 : 3) + (state.angleUnit === 'deg' ? '°' : ' rad');
  const params = v => {
    const c = coordinates(v.p, v), k = state.angleUnit === 'deg' ? 180 / Math.PI : 1;
    return v.mode === 'spherical' ? [c.r, c.theta * k, c.phi * k] : v.mode === 'cylindrical' ? [c.rho, c.phi * k, c.z] : [...v.p];
  };
  const symbols = mode => mode === 'spherical' ? ['r', 'θ', 'φ'] : mode === 'cylindrical' ? ['ρ', 'φ', 'z'] : ['x', 'y', 'z'];
  const angular = (mode, i) => mode === 'spherical' ? i > 0 : mode === 'cylindrical' && i === 1;
  function limits(v, i) {
    const isAngle = angular(v.mode, i), polar = v.mode === 'spherical' && i === 1;
    const nonnegative = isAngle || (v.mode !== 'cartesian' && i === 0);
    // Converted radii can exceed individual Cartesian input bounds; keep the
    // current value inside both editors after changing the input system.
    const max = isAngle ? (state.angleUnit === 'deg' ? (polar ? 180 : 360) : +(polar ? Math.PI : TAU).toFixed(6)) : Math.max(1000, Math.ceil(Math.abs(params(v)[i]) / 500) * 500);
    const extent = isAngle ? max : Math.min(max, Math.max(5, Math.ceil(Math.abs(params(v)[i]) / 5) * 5));
    return {min: nonnegative ? 0 : -max, max, sliderMin: nonnegative ? 0 : -extent, sliderMax: extent, step: isAngle ? (state.angleUnit === 'deg' ? .5 : .005) : .01};
  }
  function velocityLimits(v, i) {
    const extent = Math.max(5, Math.ceil(Math.abs(v.vel[i]) / 5) * 5), max = Math.max(1000, Math.ceil(Math.abs(v.vel[i]) / 500) * 500);
    return {min: -max, max, sliderMin: -extent, sliderMax: extent, step: .01};
  }
  function rowHTML(v) {
    const cs = symbols(v.mode);
    return `<article class="vector-row${state.selected === v.id ? ' selected' : ''}${v.visible ? '' : ' is-hidden'}" data-id="${v.id}" style="--vector-color:${v.color}">
      <div class="vector-main"><div class="vector-identity">
        <label class="vector-select"><input type="radio" name="selected-vector" data-action="select" aria-label="${esc(t('selectVector'))} ${vectorName(v)}" ${state.selected === v.id ? 'checked' : ''}><span>${vectorName(v)}</span></label>
        <input type="color" data-action="color" value="${v.color}" aria-label="${esc(t('color'))} ${vectorName(v)}">
        <select data-action="mode" aria-label="${esc(t('inputSystem'))} ${vectorName(v)}">${SYSTEMS.map(s => `<option value="${s}" ${s === v.mode ? 'selected' : ''}>${esc(t(s))}</option>`).join('')}</select>
      </div><div class="coordinate-controls">${cs.map((s, i) => {
        const l = limits(v, i), value = +params(v)[i].toFixed(6), title = `${vectorName(v)}: ${s}`, unit = angular(v.mode, i) ? (state.angleUnit === 'deg' ? '°' : 'rad') : '';
        return `<div class="coordinate-control"><label class="symbol" for="v${v.id}-n${i}">${s}</label><input type="range" data-action="coordinate" data-index="${i}" min="${l.sliderMin}" max="${l.sliderMax}" step="${l.step}" value="${value}" aria-label="${title}"><input id="v${v.id}-n${i}" type="number" data-action="coordinate" data-index="${i}" min="${l.min}" max="${l.max}" step="any" value="${value}" aria-label="${title}${unit ? ' (' + unit + ')' : ''}"><span class="unit">${unit}</span></div>`;
      }).join('')}</div><div class="row-actions"><label class="check-label"><input type="checkbox" data-action="visible" ${v.visible ? 'checked' : ''}>${esc(t('visible'))}</label><label class="check-label"><input type="checkbox" data-action="basis" ${v.basis ? 'checked' : ''}>${esc(t('basis'))}</label><button type="button" class="preset-btn" data-action="remove" ${state.vectors.length === 1 ? 'disabled' : ''} aria-label="${esc(t('remove'))} ${vectorName(v)}">${esc(t('remove'))}</button></div></div>
      <div class="velocity-editor"><label class="check-label velocity-label"><input type="checkbox" data-action="velocity" ${v.velocity ? 'checked' : ''} aria-label="${esc(t('visible'))} ${velocityName(v)}"><strong>${velocityName(v)}</strong><span>${esc(t('velocity'))}</span></label>
      <div class="coordinate-controls">${['x', 'y', 'z'].map((s, i) => {
        const l = velocityLimits(v, i), value = +v.vel[i].toFixed(6), title = `${velocityName(v)}: v${s} (${t('velocityUnits')})`;
        return `<div class="coordinate-control"><label class="symbol math" for="v${v.id}-vn${i}">v<sub>${s}</sub></label><input type="range" data-action="velocityComponent" data-index="${i}" min="${l.sliderMin}" max="${l.sliderMax}" step="${l.step}" value="${value}" aria-label="${esc(title)}"><input id="v${v.id}-vn${i}" type="number" data-action="velocityComponent" data-index="${i}" min="${l.min}" max="${l.max}" step="any" value="${value}" aria-label="${esc(title)}"><span class="unit">${esc(t('perSecond'))}</span></div>`;
      }).join('')}</div></div>
      <div class="vector-summary"></div><p class="vector-warning"></p></article>`;
  }
  function buildRows() { $('vectorRows').innerHTML = state.vectors.map(rowHTML).join(''); syncRows(); }
  function tuples(v, system) {
    const c = coordinates(v.p, v);
    if (system === 'cartesian') return [c.x, c.y, c.z].map(x => number(x)).join(', ');
    if (system === 'spherical') return `${number(c.r)}, ${c.origin ? '—' : angle(c.theta)}, ${c.axis ? '—' : angle(c.phi)}`;
    return `${number(c.rho)}, ${c.axis ? '—' : angle(c.phi)}, ${number(c.z)}`;
  }
  function singularWarning(v) {
    const c = coordinates(v.p, v);
    return c.origin ? t('originWarning', {theta: angle(c.theta), phi: angle(c.phi)}) : c.axis ? t('axisWarning', {phi: angle(c.phi)}) : '';
  }
  function syncRows() {
    for (const v of state.vectors) {
      const row = $('vectorRows').querySelector(`[data-id="${v.id}"]`);
      if (!row) continue;
      row.classList.toggle('selected', state.selected === v.id); row.classList.toggle('is-hidden', !v.visible);
      row.style.setProperty('--vector-color', v.color);
      row.querySelector('[data-action="select"]').checked = state.selected === v.id;
      row.querySelector('.velocity-editor').hidden = !state.options.velocity;
      const values = params(v);
      for (const el of row.querySelectorAll('[data-action="coordinate"]')) {
        const i = +el.dataset.index, l = limits(v, i);
        if (el.type === 'range' && el !== document.activeElement) { el.min = l.sliderMin; el.max = l.sliderMax; }
        if (el !== document.activeElement || el.type === 'range' || state.playing) el.value = +values[i].toFixed(6);
      }
      for (const el of row.querySelectorAll('[data-action="velocityComponent"]')) {
        const i = +el.dataset.index, l = velocityLimits(v, i);
        if (el.type === 'range' && el !== document.activeElement) { el.min = l.sliderMin; el.max = l.sliderMax; }
        if (el !== document.activeElement || el.type === 'range' || state.playing) el.value = +v.vel[i].toFixed(6);
      }
      row.querySelector('.vector-summary').innerHTML = `<span>(x, y, z) = (${tuples(v, 'cartesian')})</span><span>(r, θ, φ) = (${tuples(v, 'spherical')})</span><span>(ρ, φ, z) = (${tuples(v, 'cylindrical')})</span>`;
      row.querySelector('.vector-warning').textContent = singularWarning(v);
    }
  }
  function renderPanels() {
    const v = current(), c = coordinates(v.p, v);
    for (const system of SYSTEMS) {
      const svg = $(system + 'Scene');
      const velocityDescription = state.options.velocity && v.velocity ? ` ${t('velocity')} ${velocityName(v)}: (${vectorComponents(v.vel, system, c).map(x => number(x, 3)).join(', ')}), ${t('velocityUnits')}.` : '';
      const description = `${t(system)}. ${vectorName(v)}: (${tuples(v, system)}).${velocityDescription} ${t('sceneDescription')}`;
      svg.innerHTML = sceneSVG(system, state.vectors, state.selected, state.camera, state.options, description);
      svg.setAttribute('aria-label', description);
      $(system + 'Readout').innerHTML = `<strong style="color:${v.color}">${vectorName(v)}</strong> (${tuples(v, system)})`;
      const velocityHolder = $(system + 'Velocity'); velocityHolder.hidden = !state.options.velocity || !v.velocity;
      if (!velocityHolder.hidden) {
        const bs = bases(system, c), components = vectorComponents(v.vel, system, c).map(x => number(x, 3)).join(', ');
        const componentNames = bs.map(b => `v<sub>${b.label}</sub>${b.ambiguous ? '*' : ''}`).join(', ');
        velocityHolder.innerHTML = `<strong>${velocityName(v)}</strong> (${components})<small class="math">(${componentNames}) · ${esc(t('velocityUnits'))}</small>`;
      }
      const holder = $(system + 'Basis'); holder.hidden = !state.options.values;
      if (state.options.values) holder.innerHTML = `<table><caption>${esc(t('basisCaption'))}</caption><thead><tr><th></th><th scope="col">x</th><th scope="col">y</th><th scope="col">z</th></tr></thead><tbody>${bases(system, c).map(b => `<tr><th scope="row" class="math">ê<sub>${b.label}</sub>${b.ambiguous ? '*' : ''}</th>${b.v.map(x => `<td>${number(x, 3)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
  }
  let pending = false;
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; renderPanels(); }); } }
  function setStatus() {
    const v = current();
    $('status').textContent = (!state.vectors.some(x => x.visible) ? t('noneVisible') + ' ' : '') + (state.playing ? t('playing', {name: vectorName(v)}) : t('selected', {name: vectorName(v)})) + ' ' + (!v.visible ? t('hidden') + ' ' : '') + t('unitLength');
  }
  function update() { syncRows(); schedule(); setStatus(); }
  let animationFrame = 0;
  function stop() { state.playing = false; state.lastTime = null; cancelAnimationFrame(animationFrame); animationFrame = 0; $('play').textContent = t('play'); $('play').classList.remove('active'); $('play').setAttribute('aria-pressed', 'false'); }
  function setLanguage(lang) {
    state.language = lang; document.documentElement.lang = lang; document.title = t('title');
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-language]')) { const on = el.dataset.language === lang; el.classList.toggle('active', on); el.setAttribute('aria-pressed', String(on)); }
    $('play').textContent = t(state.playing ? 'pause' : 'play');
    buildRows(); update();
  }
  function setView(name) {
    state.camera = {...initialCamera(), zoom: state.camera.zoom, view: name};
    if (name === 'xy') { state.camera.yaw = -Math.PI / 2; state.camera.elevation = Math.PI / 2; }
    if (name === 'xz') { state.camera.yaw = -Math.PI / 2; state.camera.elevation = 0; }
    if (name === 'yz') { state.camera.yaw = 0; state.camera.elevation = 0; }
    updateViewButtons(); schedule();
  }
  function updateViewButtons() { for (const el of document.querySelectorAll('[data-view]')) { const on = el.dataset.view === state.camera.view; el.classList.toggle('active', on); el.setAttribute('aria-pressed', String(on)); } }
  function zoom(value) { state.camera.zoom = clamp(value, .6, 1.8); $('zoom').value = state.camera.zoom; $('zoomValue').textContent = Math.round(state.camera.zoom * 100) + '%'; schedule(); }
  function rememberAngles(v) { const c = coordinates(v.p, v); v.phi = c.phi; v.theta = c.theta; }
  function editCoordinate(v, i, value) {
    const list = params(v); list[i] = value;
    const k = state.angleUnit === 'deg' ? Math.PI / 180 : 1;
    if (v.mode === 'spherical') { v.theta = clamp(list[1] * k, 0, Math.PI); v.phi = wrap(list[2] * k); v.p = fromSpherical(list[0], v.theta, v.phi); }
    else if (v.mode === 'cylindrical') { v.phi = wrap(list[1] * k); v.p = fromCylindrical(list[0], v.phi, list[2]); }
    else v.p = list.map(clean);
    rememberAngles(v);
  }
  $('vectorRows').addEventListener('input', event => {
    const el = event.target, row = el.closest('.vector-row'); if (!row) return;
    const v = state.vectors.find(x => x.id === +row.dataset.id);
    if (el.dataset.action === 'color') { v.color = el.value; update(); return; }
    const isVelocity = el.dataset.action === 'velocityComponent';
    if (el.dataset.action !== 'coordinate' && !isVelocity) return;
    const i = +el.dataset.index, value = Number(el.value), l = isVelocity ? velocityLimits(v, i) : limits(v, i);
    if (el.value.trim() === '' || !Number.isFinite(value) || value < l.min || value > l.max) {
      el.setAttribute('aria-invalid', 'true'); el.setCustomValidity(t('invalid')); $('status').textContent = t('invalid'); return;
    }
    el.removeAttribute('aria-invalid'); el.setCustomValidity('');
    stop(); state.selected = v.id;
    if (isVelocity) v.vel[i] = clean(value); else editCoordinate(v, i, value);
    update();
  });
  $('vectorRows').addEventListener('change', event => {
    const el = event.target, row = el.closest('.vector-row'); if (!row) return;
    const v = state.vectors.find(x => x.id === +row.dataset.id), action = el.dataset.action;
    if (action === 'coordinate' || action === 'velocityComponent') {
      const i = +el.dataset.index;
      el.value = +(action === 'velocityComponent' ? v.vel[i] : params(v)[i]).toFixed(6); el.removeAttribute('aria-invalid'); el.setCustomValidity(''); update(); return;
    }
    if (action === 'select') { stop(); state.selected = v.id; }
    if (action === 'visible') { v.visible = el.checked; if (!v.visible && v.id === state.selected) stop(); }
    if (action === 'basis') v.basis = el.checked;
    if (action === 'velocity') v.velocity = el.checked;
    if (action === 'mode') { v.mode = el.value; buildRows(); }
    update();
  });
  $('vectorRows').addEventListener('click', event => {
    const el = event.target.closest('[data-action="remove"]'); if (!el || state.vectors.length === 1) return;
    const id = +el.closest('.vector-row').dataset.id; stop();
    state.vectors = state.vectors.filter(v => v.id !== id);
    if (state.selected === id) state.selected = state.vectors[0].id;
    buildRows(); update(); $('addVector').focus();
  });
  $('addVector').addEventListener('click', () => {
    stop(); const previous = current(), c = coordinates(previous.p, previous);
    const v = makeVector(state.nextId++, fromSpherical(3.5, Math.PI / 3 + (state.vectors.length % 3) * .2, c.phi + 1.1));
    state.vectors.push(v); state.selected = v.id; buildRows(); update();
    $('vectorRows').querySelector(`[data-id="${v.id}"] [data-action="select"]`).focus();
  });
  for (const el of document.querySelectorAll('[data-language]')) el.addEventListener('click', () => setLanguage(el.dataset.language));
  for (const el of document.querySelectorAll('[data-view]')) el.addEventListener('click', () => setView(el.dataset.view));
  for (const el of document.querySelectorAll('[data-angle-unit]')) el.addEventListener('click', () => {
    state.angleUnit = el.dataset.angleUnit;
    for (const button of document.querySelectorAll('[data-angle-unit]')) { const on = button === el; button.classList.toggle('active', on); button.setAttribute('aria-pressed', String(on)); }
    buildRows(); update();
  });
  for (const [id, key] of [['showBasis', 'basis'], ['showGuides', 'guides'], ['showAngles', 'angles'], ['showGrid', 'grid'], ['showValues', 'values'], ['showVelocity', 'velocity']]) $(id).addEventListener('change', () => { state.options[key] = $(id).checked; update(); });
  $('zoom').addEventListener('input', () => zoom(+$('zoom').value));
  for (const el of document.querySelectorAll('[data-preset]')) el.addEventListener('click', () => {
    stop(); const preset = el.dataset.preset;
    const points = preset === 'plane' ? [[2.5, 2.5, 0]] : preset === 'axis' ? [[0, 0, 3]] : preset === 'compare' ? [fromSpherical(3.6, 1, .4), fromSpherical(3.6, 1.25, 1.7), fromSpherical(3.6, 2.1, 3.8)] : [[2, 2.5, 3]];
    state.vectors = points.map((p, i) => makeVector(i + 1, p)); state.selected = 1; state.nextId = points.length + 1;
    buildRows(); update();
  });
  function updateMotionVelocity() {
    const v = current(); v.vel = motionVelocity(v.p, v, state.motion, state.speed, state.polarDirection); update();
  }
  $('motion').addEventListener('change', () => { state.motion = $('motion').value; state.polarDirection = 1; updateMotionVelocity(); });
  $('speed').addEventListener('input', () => { state.speed = +$('speed').value; $('speedValue').textContent = state.speed + ' °/s'; updateMotionVelocity(); });
  $('play').addEventListener('click', () => {
    if (state.playing) { stop(); setStatus(); return; }
    const v = current(); if (!v.visible) { v.visible = true; buildRows(); }
    state.playing = true; state.lastTime = null; $('play').textContent = t('pause'); $('play').classList.add('active'); $('play').setAttribute('aria-pressed', 'true');
    updateMotionVelocity(); animationFrame = requestAnimationFrame(animate);
  });
  function animate(time) {
    if (!state.playing) return;
    const dt = state.lastTime == null ? 0 : Math.min((time - state.lastTime) / 1000, .05); state.lastTime = time;
    const v = current(), c = coordinates(v.p, v), step = dt * state.speed * Math.PI / 180;
    if (state.motion === 'azimuth') { v.phi = wrap(c.phi + step); v.theta = c.theta; }
    else {
      let th = c.theta + step * state.polarDirection;
      let phi = c.phi;
      // Keep the spherical coordinates canonical while continuing along the
      // same great circle: crossing a pole changes the azimuth by pi.
      if (th > Math.PI) { th = 2 * Math.PI - th; state.polarDirection = -1; phi = wrap(phi + Math.PI); }
      if (th < 0) { th = -th; state.polarDirection = 1; phi = wrap(phi + Math.PI); }
      v.theta = th; v.phi = phi;
    }
    v.p = fromSpherical(c.r, v.theta, v.phi);
    v.vel = motionVelocity(v.p, v, state.motion, state.speed, state.polarDirection);
    syncRows(); renderPanels(); animationFrame = requestAnimationFrame(animate);
  }
  // Resuming a background tab never causes a large jump.
  document.addEventListener('visibilitychange', () => { state.lastTime = null; });
  $('reset').addEventListener('click', () => {
    stop(); state.vectors = [makeVector(1, [2, 2.5, 3])]; state.selected = 1; state.nextId = 2;
    state.camera = initialCamera(); state.speed = 20; state.motion = 'azimuth'; state.polarDirection = 1;
    $('speed').value = 20; $('speedValue').textContent = '20 °/s'; $('motion').value = 'azimuth';
    state.options = {basis: true, guides: true, angles: true, grid: false, values: true, velocity: true};
    for (const [id, key] of [['showBasis','basis'], ['showGuides','guides'], ['showAngles','angles'], ['showGrid','grid'], ['showValues','values'], ['showVelocity','velocity']]) $(id).checked = state.options[key];
    zoom(1); updateViewButtons(); buildRows(); update();
  });
  for (const system of SYSTEMS) {
    const svg = $(system + 'Scene'); let drag = null;
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY}; svg.setPointerCapture(event.pointerId); svg.focus();
    });
    svg.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y; drag.x = event.clientX; drag.y = event.clientY;
      state.camera.yaw -= dx * .009; state.camera.elevation = clamp(state.camera.elevation + dy * .009, -Math.PI / 2, Math.PI / 2); state.camera.view = 'custom';
      updateViewButtons(); schedule();
    });
    const endDrag = () => { drag = null; };
    svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag); svg.addEventListener('lostpointercapture', endDrag);
    svg.addEventListener('wheel', event => { event.preventDefault(); zoom(state.camera.zoom * Math.exp(-event.deltaY * .001)); }, {passive: false});
    svg.addEventListener('dblclick', () => { zoom(1); setView('3d'); });
    svg.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') { zoom(1); setView('3d'); return; }
      if (['+','=','-'].includes(event.key)) { zoom(state.camera.zoom + (event.key === '-' ? -.1 : .1)); return; }
      if (event.key === 'ArrowLeft') state.camera.yaw -= .08;
      if (event.key === 'ArrowRight') state.camera.yaw += .08;
      if (event.key === 'ArrowUp') state.camera.elevation += .08;
      if (event.key === 'ArrowDown') state.camera.elevation -= .08;
      state.camera.elevation = clamp(state.camera.elevation, -Math.PI / 2, Math.PI / 2); state.camera.view = 'custom'; updateViewButtons(); schedule();
    });
  }
  setLanguage('sl');
})();
