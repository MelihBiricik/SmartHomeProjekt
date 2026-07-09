// ============================================================
//  minichart.js – Leichtgewichtiges SVG-Liniendiagramm
//  Ohne externe Bibliothek → funktioniert auch offline.
//  Nutzung: MiniChart.zeichne(container, datasets, optionen)
//    datasets = [{ label, color, points:[{x:ms, y:Zahl}] }]
// ============================================================
const MiniChart = (() => {
  const SVGNS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const deZahl = (n, s = 1) =>
    Number(n).toLocaleString("de-DE", { minimumFractionDigits: s, maximumFractionDigits: s });
  // Labels (Raumnamen) kommen aus der DB → HTML entschaerfen
  const escHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const deZeit = (ms) =>
    new Date(ms).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");

  // „Schöne" Achsenschritte (1,2,5 × 10^n)
  function niceStep(spanne, ziel = 5) {
    const roh = spanne / ziel;
    const pot = Math.pow(10, Math.floor(Math.log10(roh)));
    const rest = roh / pot;
    const faktor = rest >= 5 ? 5 : rest >= 2 ? 2 : 1;
    return faktor * pot;
  }

  function zeichne(container, datasets, opt = {}) {
    const einheit = opt.einheit || "";
    const yStellen = opt.yStellen ?? 1;
    container.innerHTML = "";
    container.style.position = "relative";

    const alle = datasets.flatMap((d) => d.points);
    if (alle.length === 0) {
      container.innerHTML =
        '<p style="color:var(--text-gedimmt);text-align:center;padding-top:120px;font-size:14px;">Keine Daten im gewählten Zeitraum.</p>';
      return;
    }

    const B = container.clientWidth || 600;
    const H = container.clientHeight || 300;
    const pad = { l: 46, r: 14, t: 12, b: 42 };
    const iW = B - pad.l - pad.r;
    const iH = H - pad.t - pad.b;

    let xMin = Math.min(...alle.map((p) => p.x));
    let xMax = Math.max(...alle.map((p) => p.x));
    let yMin = Math.min(...alle.map((p) => p.y));
    let yMax = Math.max(...alle.map((p) => p.y));
    if (xMin === xMax) xMax = xMin + 1;
    // Y-Bereich mit etwas Luft + schöne Grenzen
    const yPuffer = (yMax - yMin) * 0.12 || 1;
    yMin -= yPuffer; yMax += yPuffer;
    const yStep = niceStep(yMax - yMin, 5);
    yMin = Math.floor(yMin / yStep) * yStep;
    yMax = Math.ceil(yMax / yStep) * yStep;

    const sx = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * iW;
    const sy = (y) => pad.t + iH - ((y - yMin) / (yMax - yMin)) * iH;

    const svg = el("svg", {
      viewBox: `0 0 ${B} ${H}`, width: "100%", height: "100%",
      preserveAspectRatio: "none", role: "img",
      "aria-label": (opt.titel || "Diagramm") + " Liniendiagramm",
    });

    // --- Y-Gitter + Beschriftung ---
    for (let y = yMin; y <= yMax + 1e-9; y += yStep) {
      const py = sy(y);
      svg.appendChild(el("line", { x1: pad.l, y1: py, x2: B - pad.r, y2: py, stroke: "#eef3f4", "stroke-width": 1 }));
      const t = el("text", { x: pad.l - 8, y: py + 4, "text-anchor": "end", fill: "#5d7378", "font-size": 11, "font-family": "var(--font-mono)" });
      t.textContent = deZahl(y, y % 1 === 0 ? 0 : yStellen);
      svg.appendChild(t);
    }

    // --- X-Beschriftung (Anzahl abhängig von der Breite → kein Überlappen) ---
    const xTicks = Math.max(2, Math.min(7, Math.floor(iW / 120)));
    for (let i = 0; i <= xTicks; i++) {
      const xv = xMin + ((xMax - xMin) / xTicks) * i;
      const px = sx(xv);
      const anchor = i === 0 ? "start" : i === xTicks ? "end" : "middle";
      svg.appendChild(el("line", { x1: px, y1: pad.t, x2: px, y2: pad.t + iH, stroke: "#f5f8f8", "stroke-width": 1 }));
      const t = el("text", { x: px, y: H - pad.b + 16, "text-anchor": anchor, fill: "#5d7378", "font-size": 10, "font-family": "var(--font-mono)" });
      t.textContent = deZeit(xv);
      svg.appendChild(t);
    }

    // --- Linien pro Raum ---
    datasets.forEach((ds) => {
      if (ds.points.length === 0) return;
      const punkte = ds.points.slice().sort((a, b) => a.x - b.x);
      const d = punkte.map((p, i) => (i === 0 ? "M" : "L") + sx(p.x).toFixed(1) + " " + sy(p.y).toFixed(1)).join(" ");
      svg.appendChild(el("path", { d, fill: "none", stroke: ds.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      // Optional: einen Punkt je Messwert zeichnen (Live-Ansicht) – nur wenn
      // nicht zu viele, damit das Diagramm sauber bleibt.
      if (opt.punkte && punkte.length <= 400) {
        punkte.forEach((p) =>
          svg.appendChild(el("circle", {
            cx: sx(p.x).toFixed(1), cy: sy(p.y).toFixed(1), r: 2.6,
            fill: ds.color, stroke: "#fff", "stroke-width": 1,
          }))
        );
      }
    });

    container.appendChild(svg);

    // --- Interaktive Crosshair-Tooltip ---
    const tip = document.createElement("div");
    Object.assign(tip.style, {
      position: "absolute", pointerEvents: "none", background: "#024959", color: "#fff",
      padding: "8px 11px", borderRadius: "9px", fontSize: "12px", lineHeight: "1.5",
      fontFamily: "var(--font-mono)", boxShadow: "0 6px 18px rgba(2,73,89,.3)",
      opacity: 0, transition: "opacity .1s", zIndex: 5, whiteSpace: "nowrap",
    });
    container.appendChild(tip);
    const crosshair = el("line", { y1: pad.t, y2: pad.t + iH, stroke: "#02677355", "stroke-width": 1.5, opacity: 0 });
    svg.appendChild(crosshair);
    const marker = datasets.map((ds) => {
      const c = el("circle", { r: 4, fill: ds.color, stroke: "#fff", "stroke-width": 1.5, opacity: 0 });
      svg.appendChild(c);
      return c;
    });

    const rect = el("rect", { x: pad.l, y: pad.t, width: iW, height: iH, fill: "transparent" });
    svg.appendChild(rect);

    svg.addEventListener("mousemove", (e) => {
      const box = svg.getBoundingClientRect();
      const relX = ((e.clientX - box.left) / box.width) * B;
      if (relX < pad.l || relX > B - pad.r) return;
      const zielX = xMin + ((relX - pad.l) / iW) * (xMax - xMin);
      crosshair.setAttribute("x1", relX);
      crosshair.setAttribute("x2", relX);
      crosshair.setAttribute("opacity", 1);
      let zeitLabel = "";
      const zeilen = datasets.map((ds, i) => {
        if (ds.points.length === 0) { marker[i].setAttribute("opacity", 0); return ""; }
        // nächsten Punkt suchen
        let best = ds.points[0], bd = Infinity;
        for (const p of ds.points) { const dd = Math.abs(p.x - zielX); if (dd < bd) { bd = dd; best = p; } }
        marker[i].setAttribute("cx", sx(best.x));
        marker[i].setAttribute("cy", sy(best.y));
        marker[i].setAttribute("opacity", 1);
        zeitLabel = deZeit(best.x);
        return `<span style="color:${ds.color}">●</span> ${escHtml(ds.label)}: <b>${deZahl(best.y, yStellen)} ${einheit}</b>`;
      });
      tip.innerHTML = `<div style="opacity:.75;margin-bottom:3px">${zeitLabel} Uhr</div>` + zeilen.filter(Boolean).join("<br>");
      tip.style.opacity = 1;
      let tx = relX + 14;
      if (tx + tip.offsetWidth > B) tx = relX - tip.offsetWidth - 14;
      tip.style.left = tx + "px";
      tip.style.top = pad.t + 6 + "px";
    });
    svg.addEventListener("mouseleave", () => {
      tip.style.opacity = 0;
      crosshair.setAttribute("opacity", 0);
      marker.forEach((m) => m.setAttribute("opacity", 0));
    });
  }

  // Legende als HTML erzeugen
  function legende(container, datasets) {
    container.innerHTML = datasets.map((d) =>
      `<span style="display:inline-flex;align-items:center;gap:6px;margin:0 12px 6px 0;font-size:12.5px;color:var(--text)">
        <span style="width:13px;height:3px;border-radius:2px;background:${d.color};display:inline-block"></span>${escHtml(d.label)}
      </span>`).join("");
  }

  return { zeichne, legende };
})();
