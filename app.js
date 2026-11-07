/* Generador de QR - versión web.
 * Replica la lógica de generate_qr.py:
 *  - Corrección de errores H (30%) para que el logo no rompa la lectura.
 *  - box_size = 20 px por módulo y borde (quiet zone) de 4 módulos.
 *  - Logo centrado sobre un cuadrado de fondo con 10% de margen,
 *    ocupando ~25% del ancho y alineado a la grilla de módulos
 *    (igual que StyledPilImage de la librería qrcode de Python).
 *  - Extra: cada QR se decodifica con jsQR para verificar que se lea; si el
 *    logo tapa demasiado, se sube la versión (más módulos) automáticamente.
 * Todo se ejecuta en el navegador; no hay servidor.
 */
(() => {
  "use strict";

  const BOX = 20;          // px por módulo (box_size)
  const BORDER = 4;        // módulos de quiet zone (border)
  const LOGO_PADDING = 1.1; // el cuadrado de fondo es 10% más grande que el logo

  // Soporte para acentos, ñ, emojis, etc.
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("qr-form"),
    tabs: [...document.querySelectorAll(".type-tab")],
    panels: [...document.querySelectorAll(".type-panel")],
    url: $("url"),
    wifiSsid: $("wifi-ssid"),
    wifiPass: $("wifi-pass"),
    wifiPassField: $("wifi-pass-field"),
    wifiTogglePass: $("wifi-toggle-pass"),
    wifiAuth: $("wifi-auth"),
    wifiHidden: $("wifi-hidden"),
    waPhone: $("wa-phone"),
    waMsg: $("wa-msg"),
    vcFirst: $("vc-first"),
    vcLast: $("vc-last"),
    vcTel: $("vc-tel"),
    vcEmail: $("vc-email"),
    vcOrg: $("vc-org"),
    vcTitle: $("vc-title"),
    vcUrl: $("vc-url"),
    evTitle: $("ev-title"),
    evStart: $("ev-start"),
    evEnd: $("ev-end"),
    evLoc: $("ev-loc"),
    evDesc: $("ev-desc"),
    emTo: $("em-to"),
    emSub: $("em-sub"),
    emBody: $("em-body"),
    geoQuery: $("geo-query"),
    geoLat: $("geo-lat"),
    geoLng: $("geo-lng"),
    rawText: $("raw-text"),
    urlHint: $("url-hint"),
    logo: $("logo"),
    dropzone: $("dropzone"),
    dropzoneText: $("dropzone-text"),
    logoPreview: $("logo-preview"),
    removeLogo: $("remove-logo"),
    logoSizeField: $("logo-size-field"),
    logoSize: $("logo-size"),
    logoSizeOut: $("logo-size-out"),
    fg: $("fg"),
    bg: $("bg"),
    fgHex: $("fg-hex"),
    bgHex: $("bg-hex"),
    dropzoneIcon: $("dropzone-icon"),
    nav: $("nav"),
    warning: $("warning"),
    canvas: $("qr-canvas"),
    placeholder: $("placeholder"),
    status: $("status"),
    downloadPng: $("download-png"),
    downloadSvg: $("download-svg"),
  };

  const state = {
    type: "url",       // url | wifi | whatsapp | vcard | event | email | geo | text
    logoImg: null,     // HTMLImageElement
    logoDataUrl: null, // para incrustar en el SVG
    current: null,     // { qr, layout, text, fg, bg }
  };

  /* ---------- Formateadores de contenido por tipo ---------- */

  const escapeWifi = (s) => s.replace(/([\\;,:""])/g, "\\$1");

  function formatIcsDate(dtLocal) {
    if (!dtLocal) return "";
    // Convierte "YYYY-MM-DDTHH:mm" a "YYYYMMDDTHHMM00"
    return dtLocal.replace(/[-:]/g, "") + (dtLocal.length === 16 ? "00" : "");
  }

  function buildPayload() {
    switch (state.type) {
      case "url": {
        const text = els.url.value.trim();
        let hint = "El QR se actualiza mientras escribís.";
        if (text && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(text) && !/^[a-z]+:\/\//i.test(text)) {
          hint = "Tip: agregá https:// al principio para que los celulares lo abran como link.";
        }
        return { text, hint };
      }

      case "wifi": {
        const ssid = els.wifiSsid.value.trim();
        const auth = els.wifiAuth.value;
        const pass = auth === "nopass" ? "" : els.wifiPass.value;
        const hidden = els.wifiHidden.checked;
        if (!ssid) {
          return { text: "", hint: "Ingresá el nombre de la red Wi-Fi (SSID) para generar el QR." };
        }
        const parts = [`WIFI:T:${auth}`, `S:${escapeWifi(ssid)}`];
        if (auth !== "nopass" && pass) parts.push(`P:${escapeWifi(pass)}`);
        if (hidden) parts.push("H:true");
        return {
          text: parts.join(";") + ";;",
          hint: "Al escanearlo, el celular se conectará directamente a la red Wi-Fi.",
        };
      }

      case "whatsapp": {
        const digits = els.waPhone.value.replace(/\D/g, "");
        const msg = els.waMsg.value.trim();
        if (!digits) {
          return { text: "", hint: "Ingresá el número con código de país (ej: 5491122334455)." };
        }
        const qs = msg ? `?text=${encodeURIComponent(msg)}` : "";
        return {
          text: `https://wa.me/${digits}${qs}`,
          hint: "Abre una conversación directa en WhatsApp con el mensaje listo para enviar.",
        };
      }

      case "vcard": {
        const first = els.vcFirst.value.trim();
        const last = els.vcLast.value.trim();
        const tel = els.vcTel.value.trim();
        const email = els.vcEmail.value.trim();
        const org = els.vcOrg.value.trim();
        const title = els.vcTitle.value.trim();
        const url = els.vcUrl.value.trim();
        if (!first && !last && !org) {
          return { text: "", hint: "Completá al menos el nombre u organización para armar la tarjeta." };
        }
        const fullName = [first, last].filter(Boolean).join(" ") || org;
        const lines = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `N:${last};${first};;;`,
          `FN:${fullName}`,
        ];
        if (org) lines.push(`ORG:${org}`);
        if (title) lines.push(`TITLE:${title}`);
        if (tel) lines.push(`TEL;TYPE=CELL:${tel}`);
        if (email) lines.push(`EMAIL:${email}`);
        if (url) lines.push(`URL:${url}`);
        lines.push("END:VCARD");
        return {
          text: lines.join("\n"),
          hint: "Al escanearlo, permite agendar el contacto en un toque.",
        };
      }

      case "event": {
        const title = els.evTitle.value.trim();
        const start = formatIcsDate(els.evStart.value);
        const end = formatIcsDate(els.evEnd.value) || start;
        const loc = els.evLoc.value.trim();
        const desc = els.evDesc.value.trim();
        if (!title || !start) {
          return { text: "", hint: "Ingresá el título y la fecha/hora de inicio del evento." };
        }
        const lines = [
          "BEGIN:VEVENT",
          `SUMMARY:${title}`,
          `DTSTART:${start}`,
          `DTEND:${end}`,
        ];
        if (loc) lines.push(`LOCATION:${loc}`);
        if (desc) lines.push(`DESCRIPTION:${desc.replace(/\n/g, "\\n")}`);
        lines.push("END:VEVENT");
        return {
          text: lines.join("\n"),
          hint: "Permite agregar el evento directamente al calendario del celular.",
        };
      }

      case "email": {
        const to = els.emTo.value.trim();
        const sub = els.emSub.value.trim();
        const body = els.emBody.value.trim();
        if (!to) {
          return { text: "", hint: "Ingresá la dirección de correo de destino." };
        }
        const params = [];
        if (sub) params.push(`subject=${encodeURIComponent(sub)}`);
        if (body) params.push(`body=${encodeURIComponent(body)}`);
        const qs = params.length ? `?${params.join("&")}` : "";
        return {
          text: `mailto:${to}${qs}`,
          hint: "Abre la app de correo con destinatario, asunto y mensaje listos.",
        };
      }

      case "geo": {
        const query = els.geoQuery.value.trim();
        const lat = els.geoLat.value.trim().replace(",", ".");
        const lng = els.geoLng.value.trim().replace(",", ".");
        if (lat && lng) {
          const q = query ? `?q=${lat},${lng}(${encodeURIComponent(query)})` : `?q=${lat},${lng}`;
          return {
            text: `geo:${lat},${lng}${q}`,
            hint: "Abre la ubicación por coordenadas en la app de mapas del celular.",
          };
        }
        if (query) {
          return {
            text: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
            hint: "Abre la búsqueda del lugar directamente en Google Maps.",
          };
        }
        return {
          text: "",
          hint: "Escribí una dirección/lugar o ingresá latitud y longitud.",
        };
      }

      case "text":
      default: {
        const text = els.rawText.value.trim();
        return {
          text,
          hint: "Ideal para mostrar texto, códigos, credenciales o notas sin conexión.",
        };
      }
    }
  }

  /* ---------- Generación ---------- */

  function buildQr(text, typeNumber = 0) {
    const qr = qrcode(typeNumber, "H"); // 0 = versión automática (version=None)
    qr.addData(text);
    qr.make();
    return qr;
  }

  /** Intenta leer el canvas con jsQR (a escala reducida, para que sea rápido). */
  function verify(text, count) {
    const px = 6 * (count + BORDER * 2);
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = px;
    const ctx = tmp.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(els.canvas, 0, 0, px, px);
    const { data } = ctx.getImageData(0, 0, px, px);
    const res = jsQR(data, px, px, { inversionAttempts: "attemptBoth" });
    return !!res && res.data === text;
  }

  /** Calcula posiciones en píxeles (igual que StyledPilImage.draw_embedded_image). */
  function computeLayout(qr) {
    const count = qr.getModuleCount();
    const total = (count + BORDER * 2) * BOX;
    const layout = { count, total, logo: null };

    if (state.logoImg) {
      const ratio = Number(els.logoSize.value) / 100;
      const logoWidthIsh = Math.floor(total * ratio);
      const offset =
        Math.floor((Math.floor(total / 2) - Math.floor(logoWidthIsh / 2)) / BOX) * BOX;
      const boxSize = total - offset * 2;

      // Logo ajustado dentro del cuadrado manteniendo proporción
      const inner = boxSize / LOGO_PADDING;
      const { naturalWidth: w, naturalHeight: h } = state.logoImg;
      const scale = inner / Math.max(w, h);
      const lw = w * scale;
      const lh = h * scale;

      layout.logo = {
        boxX: offset,
        boxY: offset,
        boxSize,
        x: offset + (boxSize - lw) / 2,
        y: offset + (boxSize - lh) / 2,
        w: lw,
        h: lh,
      };
    }
    return layout;
  }

  function drawCanvas(qr, layout, fg, bg) {
    const { canvas } = els;
    const ctx = canvas.getContext("2d");
    canvas.width = layout.total;
    canvas.height = layout.total;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, layout.total, layout.total);

    ctx.fillStyle = fg;
    for (let r = 0; r < layout.count; r++) {
      for (let c = 0; c < layout.count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect((c + BORDER) * BOX, (r + BORDER) * BOX, BOX, BOX);
        }
      }
    }

    if (layout.logo) {
      const l = layout.logo;
      ctx.fillStyle = bg;
      ctx.fillRect(l.boxX, l.boxY, l.boxSize, l.boxSize);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(state.logoImg, l.x, l.y, l.w, l.h);
    }
  }

  function buildSvg({ qr, layout, fg, bg }) {
    const { count, total } = layout;
    let path = "";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          path += `M${(c + BORDER) * BOX} ${(r + BORDER) * BOX}h${BOX}v${BOX}h-${BOX}z`;
        }
      }
    }

    let logo = "";
    if (layout.logo && state.logoDataUrl) {
      const l = layout.logo;
      logo =
        `<rect x="${l.boxX}" y="${l.boxY}" width="${l.boxSize}" height="${l.boxSize}" fill="${bg}"/>` +
        `<image x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" ` +
        `preserveAspectRatio="xMidYMid meet" href="${state.logoDataUrl}"/>`;
    }

    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
      `width="${total}" height="${total}" shape-rendering="crispEdges">` +
      `<rect width="100%" height="100%" fill="${bg}"/>` +
      `<path d="${path}" fill="${fg}"/>` +
      logo +
      `</svg>`
    );
  }

  function render() {
    const { text, hint } = buildPayload();
    const fg = els.fg.value;
    const bg = els.bg.value;

    els.urlHint.classList.remove("error");
    els.urlHint.textContent = hint;
    updateContrastWarning(fg, bg);

    if (!text) {
      setPreview(false);
      return;
    }

    try {
      // Si el logo tapa demasiado (pasa en QRs con pocos módulos), se prueba
      // con versiones más grandes hasta que el código se pueda leer.
      let qr = buildQr(text);
      const autoVersion = (qr.getModuleCount() - 17) / 4;
      const maxVersion = Math.min(40, autoVersion + (state.logoImg ? 8 : 0));
      let layout;
      let ok = false;
      for (let v = autoVersion; v <= maxVersion; v++) {
        if (v !== autoVersion) qr = buildQr(text, v);
        layout = computeLayout(qr);
        drawCanvas(qr, layout, fg, bg);
        if ((ok = verify(text, layout.count))) break;
      }
      if (!ok) {
        // Ninguna versión se pudo leer: mostramos la automática con un aviso.
        qr = buildQr(text);
        layout = computeLayout(qr);
        drawCanvas(qr, layout, fg, bg);
      }
      state.current = { qr, layout, text, fg, bg };
      setPreview(true);
      setStatus(ok);
    } catch (err) {
      console.error(err);
      setPreview(false);
      els.urlHint.textContent = "El contenido es demasiado largo para un código QR.";
      els.urlHint.classList.add("error");
    }
  }

  function setPreview(visible) {
    els.canvas.hidden = !visible;
    els.placeholder.hidden = visible;
    els.downloadPng.disabled = !visible;
    els.downloadSvg.disabled = !visible;
    if (!visible) {
      state.current = null;
      els.status.hidden = true;
    }
  }

  function setStatus(ok) {
    els.status.hidden = false;
    els.status.className = `alert ${ok ? "alert--ok" : "alert--bad"}`;
    els.status.textContent = ok
      ? "✓ Verificado: el QR se lee correctamente."
      : "✗ No pudimos leer este QR. Achicá el logo o aumentá el contraste de colores.";
  }

  /* ---------- Validaciones / avisos ---------- */

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function updateContrastWarning(fg, bg) {
    const lf = luminance(fg);
    const lb = luminance(bg);
    const contrast = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
    let msg = "";
    if (lf > lb) {
      msg = "⚠️ El QR es más claro que el fondo. Muchos lectores no lo van a reconocer.";
    } else if (contrast < 4) {
      msg = "⚠️ Hay poco contraste entre el QR y el fondo; puede costar escanearlo.";
    }
    els.warning.textContent = msg;
    els.warning.hidden = !msg;
  }

  /* ---------- Logo ---------- */

  function loadLogo(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        state.logoImg = img;
        state.logoDataUrl = reader.result;
        els.logoPreview.src = reader.result;
        els.logoPreview.hidden = false;
        if (els.dropzoneIcon) els.dropzoneIcon.hidden = true;
        els.dropzoneText.innerHTML = "Click o arrastrá otra imagen para cambiarla";
        els.removeLogo.hidden = false;
        els.logoSizeField.hidden = false;
        render();
      };
      img.onerror = () => alert("No se pudo leer la imagen.");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    state.logoImg = null;
    state.logoDataUrl = null;
    els.logo.value = "";
    els.logoPreview.hidden = true;
    els.logoPreview.removeAttribute("src");
    if (els.dropzoneIcon) els.dropzoneIcon.hidden = false;
    els.dropzoneText.innerHTML = "Arrastrá una imagen o <u>hacé click para elegir</u>";
    els.removeLogo.hidden = true;
    els.logoSizeField.hidden = true;
    render();
  }

  /* ---------- Descargas ---------- */

  const slug = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32);

  function fileBaseName() {
    const text = state.current?.text || "";
    switch (state.type) {
      case "url":
        try {
          const host = new URL(text).hostname.replace(/^www\./, "");
          if (host) return `qr_${slug(host)}`;
        } catch (_) { /* no es URL completa */ }
        return `qr_${slug(text) || "link"}`;
      case "wifi":
        return `qr_wifi_${slug(els.wifiSsid.value) || "red"}`;
      case "whatsapp":
        return `qr_whatsapp_${els.waPhone.value.replace(/\D/g, "") || "chat"}`;
      case "vcard":
        return `qr_contacto_${slug(els.vcFirst.value || els.vcOrg.value) || "vcard"}`;
      case "event":
        return `qr_evento_${slug(els.evTitle.value) || "calendario"}`;
      case "email":
        return `qr_email_${slug(els.emTo.value.split("@")[0]) || "correo"}`;
      case "geo":
        return `qr_ubicacion_${slug(els.geoQuery.value) || "mapa"}`;
      default:
        return "qr_texto";
    }
  }

  function triggerDownload(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- Eventos ---------- */

  let debounce;
  const scheduleRender = () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 120);
  };

  function setType(type) {
    state.type = type;
    els.tabs.forEach((btn) => {
      const active = btn.dataset.type === type;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    els.panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== type;
    });
    render();
  }

  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => setType(btn.dataset.type));
  });

  if (els.wifiTogglePass) {
    els.wifiTogglePass.addEventListener("click", () => {
      const isPass = els.wifiPass.type === "password";
      els.wifiPass.type = isPass ? "text" : "password";
    });
  }

  if (els.wifiAuth) {
    els.wifiAuth.addEventListener("change", () => {
      const isOpen = els.wifiAuth.value === "nopass";
      els.wifiPass.disabled = isOpen;
      if (isOpen) els.wifiPass.value = "";
      scheduleRender();
    });
  }

  // Cualquier cambio en los campos de los paneles actualiza el QR en vivo
  els.panels.forEach((panel) => {
    panel.addEventListener("input", scheduleRender);
    panel.addEventListener("change", scheduleRender);
  });

  [["fg", "fgHex"], ["bg", "bgHex"]].forEach(([input, hex]) =>
    els[input].addEventListener("input", () => {
      if (els[hex]) els[hex].textContent = els[input].value.toUpperCase();
      scheduleRender();
    })
  );
  els.logoSize.addEventListener("input", () => {
    els.logoSizeOut.textContent = `${els.logoSize.value}%`;
    scheduleRender();
  });

  els.logo.addEventListener("change", () => loadLogo(els.logo.files[0]));
  els.removeLogo.addEventListener("click", removeLogo);

  ["dragenter", "dragover"].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("is-over");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("is-over");
    })
  );
  els.dropzone.addEventListener("drop", (e) => loadLogo(e.dataTransfer.files[0]));

  // Pegar una imagen con Ctrl+V fuera de los campos de texto
  document.addEventListener("paste", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) loadLogo(item.getAsFile());
  });

  els.form.addEventListener("submit", (e) => e.preventDefault());

  els.downloadPng.addEventListener("click", () => {
    if (!state.current) return;
    els.canvas.toBlob((blob) => triggerDownload(blob, `${fileBaseName()}.png`), "image/png");
  });

  els.downloadSvg.addEventListener("click", () => {
    if (!state.current) return;
    const svg = buildSvg(state.current);
    triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${fileBaseName()}.svg`);
  });

  // Navbar con fondo "glass" al hacer scroll (igual que rzcore.dev)
  if (els.nav) {
    const onScroll = () => els.nav.classList.toggle("is-scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  render();
})();
