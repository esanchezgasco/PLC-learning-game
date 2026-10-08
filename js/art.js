/* =========================================================================
 * PLC Academy — Ilustraciones SVG para las explicaciones
 * ========================================================================= */
(function (root) {
  'use strict';
  const PLC = (root.PLC = root.PLC || {});

  function svg(w, h, body, cls) {
    return '<svg class="art ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="max-width:' + w + 'px">' + body + '</svg>';
  }

  const icons = {
    button: '<circle cx="0" cy="0" r="16" class="a-dev"/><circle cx="0" cy="0" r="10" class="a-green"/>',
    plc: '<rect x="-26" y="-20" width="52" height="40" rx="5" class="a-plc"/><text x="0" y="5" class="a-t b" text-anchor="middle">PLC</text>',
    motor: '<circle cx="0" cy="0" r="17" class="a-dev"/><path d="M0 -11 L4 0 L0 11 L-4 0Z M-11 0 L0 4 L11 0 L0 -4Z" class="a-fan"/>',
    lamp: '<circle cx="0" cy="-3" r="13" class="a-lamp"/><rect x="-6" y="10" width="12" height="7" class="a-dev"/>',
    sensor: '<rect x="-16" y="-9" width="22" height="18" rx="3" class="a-dev"/><path d="M8 -8 Q16 0 8 8 M13 -12 Q24 0 13 12" class="a-wave"/>',
    cylinder: '<rect x="-20" y="-9" width="26" height="18" rx="2" class="a-dev"/><rect x="6" y="-3" width="16" height="6" class="a-dev"/>',
    alarm: '<path d="M-12 8 L-12 -2 Q0 -18 12 -2 L12 8 Z" class="a-red"/><rect x="-15" y="8" width="30" height="5" class="a-dev"/>',
    switch: '<rect x="-14" y="-14" width="28" height="28" rx="6" class="a-dev"/><rect x="-3" y="-11" width="6" height="22" rx="2" class="a-green" transform="rotate(35)"/>'
  };

  /* Diagrama de flujo: [icono+texto] → [icono+texto] → … */
  function flow(items, opt) {
    opt = opt || {};
    const gap = 150, w = items.length * gap, h = 120;
    let b = '';
    items.forEach(function (it, i) {
      const x = gap / 2 + i * gap;
      b += '<g transform="translate(' + x + ',48)">' + (icons[it.icon] || '') + '</g>';
      b += '<text x="' + x + '" y="92" class="a-t b" text-anchor="middle">' + it.label + '</text>';
      if (it.sub) b += '<text x="' + x + '" y="109" class="a-t s" text-anchor="middle">' + it.sub + '</text>';
      if (i < items.length - 1) {
        b += '<path d="M' + (x + 34) + ' 48 L' + (x + gap - 34) + ' 48" class="a-arrow" marker-end="url(#ah)"/>';
        if (opt.arrows && opt.arrows[i]) b += '<text x="' + (x + gap / 2) + '" y="38" class="a-t s" text-anchor="middle">' + opt.arrows[i] + '</text>';
      }
    });
    return svg(w, h, defs() + b, 'flow');
  }
  function defs() {
    return '<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" class="a-arrowhead"/></marker></defs>';
  }

  /* Ciclo de scan */
  function scanCycle() {
    let b = defs();
    b += '<circle cx="160" cy="110" r="78" class="a-cycle"/>';
    const pts = [{ a: -90, t: '① Leer entradas', s: 'foto de I0.0, I0.1…' }, { a: 30, t: '② Ejecutar programa', s: 'segmento 1, 2, 3…' }, { a: 150, t: '③ Escribir salidas', s: 'Q0.0, Q0.1…' }];
    pts.forEach(function (p, i) {
      const r = p.a * Math.PI / 180, x = 160 + Math.cos(r) * 78, y = 110 + Math.sin(r) * 78;
      b += '<circle cx="' + x + '" cy="' + y + '" r="9" class="a-node n' + i + '"/>';
      const tx = x + (i === 0 ? 0 : i === 1 ? 14 : -14), ty = y + (i === 0 ? -18 : 22);
      b += '<text x="' + tx + '" y="' + ty + '" class="a-t b" text-anchor="' + (i === 0 ? 'middle' : i === 1 ? 'start' : 'end') + '">' + p.t + '</text>';
      b += '<text x="' + tx + '" y="' + (ty + 15) + '" class="a-t s" text-anchor="' + (i === 0 ? 'middle' : i === 1 ? 'start' : 'end') + '">' + p.s + '</text>';
    });
    b += '<text x="160" y="106" class="a-t b" text-anchor="middle">CICLO</text><text x="160" y="122" class="a-t s" text-anchor="middle">se repite sin parar</text>';
    b += '<circle cx="160" cy="110" r="78" class="a-spin"/>';
    return svg(330, 240, b, 'cycle');
  }

  /* Cronograma (diagrama de tiempos) — señales como lista de [t0,t1] activos */
  function timing(signals, total, marks) {
    const W = 420, rowH = 46, X0 = 90, sc = (W - X0 - 10) / total;
    let b = '';
    signals.forEach(function (s, i) {
      const y = 14 + i * rowH, hi = y + 6, lo = y + 30;
      b += '<text x="6" y="' + (y + 24) + '" class="a-t b">' + s.name + '</text>';
      b += '<line x1="' + X0 + '" y1="' + lo + '" x2="' + (W - 6) + '" y2="' + lo + '" class="a-base"/>';
      let d = 'M' + X0 + ' ' + lo;
      s.on.forEach(function (iv) {
        const a = X0 + iv[0] * sc, e = X0 + iv[1] * sc;
        d += ' L' + a + ' ' + lo + ' L' + a + ' ' + hi + ' L' + e + ' ' + hi + ' L' + e + ' ' + lo;
      });
      d += ' L' + (W - 6) + ' ' + lo;
      b += '<path d="' + d + '" class="a-sig ' + (s.cls || '') + '"/>';
    });
    (marks || []).forEach(function (m) {
      const x1 = X0 + m.from * sc, x2 = X0 + m.to * sc, y = 14 + signals.length * rowH - 4;
      b += '<line x1="' + x1 + '" y1="' + (y - 8) + '" x2="' + x1 + '" y2="' + (y + 4) + '" class="a-mark"/><line x1="' + x2 + '" y1="' + (y - 8) + '" x2="' + x2 + '" y2="' + (y + 4) + '" class="a-mark"/>';
      b += '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" class="a-mark"/>';
      b += '<text x="' + ((x1 + x2) / 2) + '" y="' + (y + 16) + '" class="a-t s" text-anchor="middle">' + m.label + '</text>';
    });
    return svg(W, 14 + signals.length * rowH + (marks && marks.length ? 26 : 4), b, 'timing');
  }

  /* Diagrama de estados en círculo/línea */
  function states(list, opt) {
    opt = opt || {};
    const n = list.length;
    const W = 460, H = opt.h || 230, cx = W / 2, cy = H / 2, rx = 170, ry = H / 2 - 36;
    let b = defs();
    const pos = list.map(function (s, i) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    });
    list.forEach(function (s, i) {
      const p = pos[i], q = pos[(i + 1) % n];
      const dx = q.x - p.x, dy = q.y - p.y, L = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / L, uy = dy / L;
      b += '<path d="M' + (p.x + ux * 52) + ' ' + (p.y + uy * 22) + ' L' + (q.x - ux * 52) + ' ' + (q.y - uy * 22) + '" class="a-arrow" marker-end="url(#ah)"/>';
      if (s.cond) b += '<text x="' + ((p.x + q.x) / 2 + uy * 14) + '" y="' + ((p.y + q.y) / 2 - ux * 10 + 4) + '" class="a-t s cond" text-anchor="middle">' + s.cond + '</text>';
    });
    list.forEach(function (s, i) {
      const p = pos[i];
      b += '<rect x="' + (p.x - 54) + '" y="' + (p.y - 18) + '" width="108" height="36" rx="18" class="a-state ' + (i === 0 ? 'init' : '') + '"/>';
      b += '<text x="' + p.x + '" y="' + (p.y + 5) + '" class="a-t b" text-anchor="middle">' + s.name + '</text>';
    });
    return svg(W, H, b, 'states');
  }

  /* Tabla de verdad HTML */
  function truth(head, rows) {
    let h = '<table class="truth"><tr>' + head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr>';
    rows.forEach(function (r) { h += '<tr>' + r.map(function (v, i) { return '<td class="' + (i === r.length - 1 ? (v ? 'yes' : 'no') : '') + '">' + v + '</td>'; }).join('') + '</tr>'; });
    return h + '</table>';
  }

  /* Dispositivos sueltos con etiqueta */
  function devices(list) {
    const gap = 120;
    let b = '';
    list.forEach(function (d, i) {
      const x = gap / 2 + i * gap;
      b += '<g transform="translate(' + x + ',40)">' + (icons[d.icon] || '') + '</g>';
      b += '<text x="' + x + '" y="84" class="a-t b" text-anchor="middle">' + d.label + '</text>';
      if (d.sub) b += '<text x="' + x + '" y="100" class="a-t s" text-anchor="middle">' + d.sub + '</text>';
    });
    return svg(list.length * gap, 108, b, 'devices');
  }

  /* PLC con bornes */
  function plcBox() {
    let b = defs();
    b += '<rect x="120" y="20" width="180" height="150" rx="10" class="a-plc"/>';
    b += '<text x="210" y="50" class="a-t b" text-anchor="middle">PLC</text><text x="210" y="68" class="a-t s" text-anchor="middle">el "cerebro" de la máquina</text>';
    b += '<rect x="150" y="84" width="120" height="44" rx="4" class="a-prog"/><text x="210" y="104" class="a-t s" text-anchor="middle">PROGRAMA</text><text x="210" y="120" class="a-t s" text-anchor="middle">─┤ ├──( )─</text>';
    ['I0.0', 'I0.1', 'I0.2'].forEach(function (a, i) {
      const y = 92 + i * 26;
      b += '<line x1="70" y1="' + y + '" x2="120" y2="' + y + '" class="a-arrow" marker-end="url(#ah)"/><text x="64" y="' + (y + 4) + '" class="a-t s" text-anchor="end">' + a + '</text>';
    });
    ['Q0.0', 'Q0.1', 'Q0.2'].forEach(function (a, i) {
      const y = 92 + i * 26;
      b += '<line x1="300" y1="' + y + '" x2="350" y2="' + y + '" class="a-arrow" marker-end="url(#ah)"/><text x="356" y="' + (y + 4) + '" class="a-t s">' + a + '</text>';
    });
    b += '<text x="40" y="40" class="a-t b" text-anchor="middle">ENTRADAS</text><text x="380" y="40" class="a-t b" text-anchor="middle">SALIDAS</text>';
    return svg(420, 180, b, 'plcbox');
  }

  PLC.art = { svg: svg, flow: flow, scanCycle: scanCycle, timing: timing, states: states, truth: truth, devices: devices, plcBox: plcBox, icons: icons };
})(typeof window !== 'undefined' ? window : globalThis);
