(function () {
  const opener = window.opener;
  const app = opener && opener.decisionPrintApp;
  const analysis = app && app.analysis;
  if (!app || !analysis || analysis.lon == null) {
    document.body.innerHTML =
      '<p style="padding:40px;font:16px Marianne,Arial,sans-serif">' +
      "Cette page s’ouvre depuis le bouton “Imprimer la carte” du diagnostic, une fois un point analysé." +
      "</p>";
    return;
  }

  const { lon, lat, address, commune, codeInsee, isochrones, parcel } = analysis;
  const printSummary = app.printSummary || null;

  // html2canvas ne capture pas fiablement les éléments positionnés par
  // transform CSS (translate3d) : Leaflet doit utiliser un positionnement
  // top/left classique pour que les tuiles et couches apparaissent au clichés.
  L.Browser.any3d = false;

  document.getElementById("printTitle").textContent =
    address && address !== "Point sélectionné"
      ? `${address}`
      : `Diagnostic territorial · ${commune}`;
  document.getElementById("printSubtitle").textContent =
    `${commune} · ${codeInsee} · Cadastre · urbanisme · risques · environnement · accessibilité`;

  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("printSources").innerHTML = `
    <span class="src-line">Sources : IGN · DGFiP · Géorisques · Institut Paris Region · INSEE · OpenStreetMap · Valhalla</span>
    <span class="src-line">Auteur : DDT 95 - Pôle géomatique</span>
    <span class="src-line">Date : ${today}</span>
  `;

  const legendItems = [
    ["#e1000f", "Point analysé", "dot"],
    ...(parcel ? [["#000091", "Parcelle cadastrale", "box"]] : []),
  ];
  document.getElementById("printLegend").innerHTML =
    '<div class="legend-block"><strong>Légende</strong>' +
    legendItems
      .map(([color, label, shape]) => `<span><i class="${shape === "dot" ? "dot" : ""}" style="background:${color}"></i>${label}</span>`)
      .join("") +
    "</div>";

  const sideCard = (accent, bg, title, rows) =>
    `<div class="side-card" style="--card-accent:${accent};--card-bg:${bg}">
      <h2>${title}</h2>
      ${
        rows.length
          ? rows
              .map(
                ([label, value]) =>
                  `<div class="side-row"><span>${label}</span><strong>${value}</strong></div>`,
              )
              .join("")
          : '<p class="side-empty">Données non disponibles</p>'
      }
    </div>`;
  const sideHtml = printSummary
    ? sideCard("#000091", "#eef1ff", "Parcelle et urbanisme", [
        ["Parcelle", printSummary.parcelle || "Non renseignée"],
        ["Surface cadastrale", printSummary.surface],
        ["Zone PLU", printSummary.zonePlu],
        ...(printSummary.zoneDescription
          ? [["Description", printSummary.zoneDescription]]
          : []),
        ["Servitudes intersectées", String(printSummary.servitudes)],
        ...(printSummary.mos ? [["Occupation du sol", printSummary.mos]] : []),
      ]) +
      (printSummary.batiments
        ? sideCard("#8a5d00", "#fdf3e0", "Bâti présent", [
            ["Groupes de bâtiments", String(printSummary.batiments.count)],
            ["Emprise bâtie estimée", printSummary.batiments.emprise],
            ["Taux d’emprise", printSummary.batiments.tauxEmprise],
            ["Usage principal", printSummary.batiments.usage],
            ["Construction la plus ancienne", printSummary.batiments.annee],
            ["Hauteur maximale estimée", printSummary.batiments.hauteur],
            ["DPE disponible", printSummary.batiments.dpe],
          ])
        : sideCard("#8a5d00", "#fdf3e0", "Bâti présent", []))
    : sideCard("#000091", "#eef1ff", "Parcelle et urbanisme", []);
  document.getElementById("printSide").innerHTML = sideHtml;

  const map = L.map("printMapCanvas", {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    trackResize: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
    tap: false,
  });

  // Fond de carte neutre (même effet que .decision-neutral-tiles) : html2canvas
  // ne capture pas les filtres CSS, l'atténuation est donc appliquée pixel par
  // pixel sur chaque tuile pour être bien présente dans le PDF.
  const NeutralTileLayer = L.TileLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement("canvas");
      const size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;
      const ctx = tile.getContext("2d");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size.x, size.y);
        const data = ctx.getImageData(0, 0, size.x, size.y);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const r2 = Math.min(255, (r + (gray - r) * 0.85) * 1.06);
          const g2 = Math.min(255, (g + (gray - g) * 0.85) * 1.06);
          const b2 = Math.min(255, (b + (gray - b) * 0.85) * 1.06);
          d[i] = r2; d[i + 1] = g2; d[i + 2] = b2;
        }
        ctx.putImageData(data, 0, 0);
        done(null, tile);
      };
      img.onerror = (e) => done(e, tile);
      img.src = this.getTileUrl(coords);
      return tile;
    },
  });
  new NeutralTileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

  // Emprise : le rayon 15 min à pied, avec une marge pour voir un peu au-delà
  // et donner une vue d'ensemble de la zone et de son environnement. À
  // défaut d'isochrone disponible, un rayon fixe raisonnable est utilisé.
  let bounds;
  if (isochrones && isochrones["15"]) {
    bounds = L.geoJSON(isochrones["15"]).getBounds().pad(0.15);
  } else {
    bounds = L.latLng(lat, lon).toBounds(1800);
  }
  // Vue initiale synchrone AVANT d'ajouter la moindre couche vectorielle :
  // sans vue déjà établie, le renderer canvas plante en essayant de clipper
  // des points sans limites de pixels valides (whenReady() ne se
  // déclencherait de toute façon jamais sans cet appel préalable).
  map.invalidateSize();
  map.fitBounds(bounds, { padding: [4, 4] });

  if (parcel && parcel.geometry) {
    L.geoJSON(parcel, {
      interactive: false,
      style: { color: "#000091", weight: 2, fillColor: "#000091", fillOpacity: 0.06 },
    }).addTo(map);
  }

  L.circleMarker([lat, lon], {
    radius: 8,
    color: "#fff",
    weight: 3,
    fillColor: "#e1000f",
    fillOpacity: 1,
    interactive: false,
  }).addTo(map);

  function niceScaleNumber(n) {
    const pow10 = Math.pow(10, String(Math.floor(n)).length - 1);
    const d = n / pow10;
    return pow10 * (d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1);
  }

  function renderScaleBar() {
    const targetPx = 160;
    const size = map.getSize();
    const y = size.y / 2;
    const maxMeters = map.distance(map.containerPointToLatLng([0, y]), map.containerPointToLatLng([targetPx, y]));
    const meters = niceScaleNumber(maxMeters);
    const fullPx = targetPx * (meters / maxMeters);
    const segments = 4;
    const segPx = fullPx / segments;
    const unit = meters >= 1000 ? meters / 1000 : meters;
    const unitLabel = meters >= 1000 ? "km" : "m";
    const bars = Array.from({ length: segments })
      .map((_, i) => `<div class="scale-seg ${i % 2 === 0 ? "on" : "off"}" style="width:${segPx}px"></div>`)
      .join("");
    const ticks = Array.from({ length: segments + 1 })
      .map((_, i) => `<span style="left:${i * segPx}px">${((unit / segments) * i).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</span>`)
      .join("");
    document.getElementById("printScale").innerHTML = `
      <div class="scale-frame" style="width:${fullPx}px">
        <div class="scale-bar-row">${bars}</div>
        <div class="scale-ticks" style="width:${fullPx}px">${ticks}<span class="scale-unit" style="left:${fullPx}px">${unitLabel}</span></div>
      </div>
    `;
  }

  const statusEl = document.getElementById("pdfStatus");

  async function buildPdf() {
    const node = document.getElementById("printPage");
    const canvas = await html2canvas(node, { scale: 2.5, useCORS: true, backgroundColor: "#ffffff" });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 420, 297, undefined, "FAST");
    const blobUrl = URL.createObjectURL(doc.output("blob"));
    window.location.replace(blobUrl);
  }

  function finalizeMap() {
    map.invalidateSize();
    renderScaleBar();
    setTimeout(() => {
      buildPdf().catch((err) => {
        console.error(err);
        statusEl.textContent = "La génération du PDF a échoué. Réessayez depuis la carte.";
      });
    }, 1400);
  }

  map.whenReady(() => setTimeout(finalizeMap, 900));
})();
