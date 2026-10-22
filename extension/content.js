// Injected into the application page by background.js. Reads the form, fills it and shows the overlay.
// It never submits on its own: clicks on submit-looking buttons are refused unless the user confirmed in the overlay.
(() => {
  if (window.__raLoaded) return;
  window.__raLoaded = true;

  // Keep in sync with SUBMIT_RE in lib/fieldmap.ts
  const SUBMIT_RE = /absenden|abschicken|\bsenden\b|submit|einreichen|send application|apply and submit|bewerbung (jetzt )?(ab)?senden/i;
  const registry = new Map();
  let counter = 0;
  // Per-injection prefix: after a full page load ids restart, so they must not collide with ids the agent already handled.
  const P = Math.random().toString(36).slice(2, 6);

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";

  function* roots(doc = document) {
    yield doc;
    const walker = (doc.ownerDocument || doc).createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.shadowRoot) yield* roots(n.shadowRoot);
      if (n.tagName === "IFRAME") {
        try { if (n.contentDocument) yield* roots(n.contentDocument); } catch {}
      }
    }
  }

  const deepQueryAll = (sel) => { const out = []; for (const r of roots()) out.push(...r.querySelectorAll(sel)); return out; };
  const deepText = () => { let t = ""; for (const r of roots()) t += " " + (r.body?.innerText ?? r.innerText ?? r.textContent ?? ""); return clean(t); };
  // trusted input (chrome.debugger in background.js); resolves {ok:false} when unavailable so callers can fall back
  const bg = (msg) => new Promise((res) => { try { chrome.runtime.sendMessage(msg, (r) => res(r || { ok: false })); } catch { res({ ok: false }); } });

  const LABEL_SEL = "label, legend, h1, h2, h3, h4, [class*=label i]";
  // Closest preceding label/heading in the surrounding containers (up to 4 levels), ignoring those that belong to other fields.
  function nearbyLabel(el) {
    let box = el.parentElement;
    for (let i = 0; i < 4 && box; i++, box = box.parentElement) {
      const hits = [...box.querySelectorAll(LABEL_SEL)].filter((c) =>
        !c.contains(el) && !c.querySelector("input, select, textarea") && (el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING) && clean(c.innerText) && clean(c.innerText).length < 80);
      if (hits.length) return clean(hits[hits.length - 1].innerText);
    }
    return "";
  }

  // Nearest short heading/label before el in document order, however far up the tree it sits (e.g. "Lebenslauf *" above a hidden file input).
  const HEAD_SEL = "h1, h2, h3, h4, h5, h6, [role=heading], legend, label, [class*=title i], [class*=label i], [class*=header i]";
  // The last n of them, because the closest one is often only a hint text ("10MB Größenbeschränkung").
  function headingsBefore(el, n = 1) {
    const doc = el.ownerDocument;
    const walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_ELEMENT);
    const found = [];
    for (let x = walker.nextNode(), i = 0; x && x !== el && i < 20000; x = walker.nextNode(), i++) {
      if (!x.matches(HEAD_SEL) || x.contains(el) || x.querySelector("input, select, textarea")) continue;
      const t = clean(x.innerText);
      if (t && t.length < 80 && found[found.length - 1] !== t) found.push(t);
    }
    return found.slice(-n).join(" ");
  }
  const headingBefore = (el) => headingsBefore(el, 1);

  // Visible error text belonging to a control: climbs while the container still holds only this one control.
  function errorOf(el) {
    let box = el.parentElement;
    for (let up = 0; box?.parentElement && up < 5 && box.parentElement.querySelectorAll("input, select, textarea").length <= 1; up++) box = box.parentElement;
    const t = box && [...box.querySelectorAll("[role=alert], [class*=error i]")].filter(visible).map((n) => clean(n.innerText)).find(Boolean);
    return t || (el.getAttribute("aria-invalid") === "true" ? "ungültig" : "");
  }

  function labelOf(el) {
    const doc = el.ownerDocument;
    const parts = [];
    if (el.id) { const l = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) parts.push(l.innerText); }
    const wrap = el.closest("label"); if (wrap) parts.push(wrap.innerText);
    const by = el.getAttribute("aria-labelledby");
    if (by) parts.push(by.split(/\s+/).map((i) => doc.getElementById(i)?.innerText || "").join(" "));
    parts.push(el.getAttribute("aria-label") || "");
    if (!clean(parts.join(""))) {
      const group = el.closest("fieldset"); if (group?.querySelector("legend")) parts.push(group.querySelector("legend").innerText);
      const prev = el.previousElementSibling; if (prev && prev.innerText && prev.innerText.length < 120) parts.push(prev.innerText);
      if (!clean(parts.join(""))) parts.push(nearbyLabel(el));
    }
    return clean(parts.find((p) => clean(p)) || el.placeholder || el.name || "");
  }

  const idOf = (el) => {
    if (!el.dataset.raId) el.dataset.raId = "ra" + P + counter++;
    registry.set(el.dataset.raId, el);
    return el.dataset.raId;
  };

  const isCombo = (el) =>
    el.getAttribute("role") === "combobox" || el.hasAttribute("aria-autocomplete") || el.hasAttribute("list") || el.hasAttribute("aria-expanded") ||
    el.getAttribute("aria-haspopup") === "listbox" || !!el.closest("[role=combobox]") ||
    !!el.parentElement?.querySelector(":scope > [class*=search i], :scope > button svg, :scope > svg");

  const withError = (o, el) => { const error = errorOf(el); return error ? { ...o, invalid: true, error } : o; };

  function snapshot() {
    registry.clear();
    const elements = [];
    const radios = new Map();
    for (const root of roots()) {
      for (const el of root.querySelectorAll("input, textarea, select, button, [role=button], a[href]")) {
        const tag = el.tagName;
        if (tag === "INPUT") {
          const type = (el.type || "text").toLowerCase();
          if (["hidden", "submit", "button", "image", "reset"].includes(type)) {
            if (type === "submit" || type === "button") {
              if (visible(el)) elements.push({ id: idOf(el), kind: "button", label: clean(el.value), submit: type === "submit" });
            }
            continue;
          }
          if (type !== "file" && !visible(el)) continue;
          if (el.disabled) continue;
          let required = el.required || el.getAttribute("aria-required") === "true";
          if (type === "file") {
            const label = clean(`${headingsBefore(el, 3)} ${nearbyLabel(el)} ${labelOf(el)}`);
            console.debug("[ra] file input", { label, hidden: !visible(el), disabled: el.disabled, inShadow: el.getRootNode() !== document });
            elements.push(withError({ id: idOf(el), kind: "file", type: "file", label, name: el.name, required: required || /\*/.test(label), value: el.files?.length ? el.files[0].name : undefined }, el));
            continue;
          }
          if (/\*\s*$/.test(labelOf(el))) required = true;
          if (type === "radio") {
            const key = (el.name || "") + "|" + (el.form ? [...document.forms].indexOf(el.form) : "");
            const opt = clean(labelOf(el)) || el.value;
            if (!radios.has(key)) {
              const group = el.closest("fieldset");
              const g = { id: idOf(el), kind: "field", type: "radio", label: clean(group?.querySelector("legend")?.innerText) || el.name, name: el.name, required, options: [], value: "" };
              radios.set(key, g); elements.push(g);
            }
            const g = radios.get(key); g.options.push(opt); if (el.checked) g.value = opt;
            continue;
          }
          if (type === "checkbox") { elements.push({ id: idOf(el), kind: "field", type: "checkbox", label: labelOf(el), name: el.name, required, checked: el.checked }); continue; }
          elements.push(withError({ id: idOf(el), kind: "field", type, label: labelOf(el), name: el.name, autocomplete: el.autocomplete, placeholder: el.placeholder, required, value: el.value, combobox: isCombo(el) }, el));
        } else if (tag === "TEXTAREA" || tag === "SELECT") {
          if (!visible(el) || el.disabled) continue;
          const required = el.required || el.getAttribute("aria-required") === "true";
          if (tag === "SELECT") {
            const opts = [...el.options].filter((o) => o.value !== "" && clean(o.text));
            const sel = el.selectedOptions[0];
            elements.push(withError({ id: idOf(el), kind: "field", type: "select", label: labelOf(el), name: el.name, autocomplete: el.autocomplete, required, options: opts.map((o) => clean(o.text)), value: sel && sel.value !== "" ? clean(sel.text) : "" }, el));
          } else elements.push(withError({ id: idOf(el), kind: "field", type: "textarea", label: labelOf(el), name: el.name, placeholder: el.placeholder, required, value: el.value }, el));
        } else if (visible(el)) {
          const label = clean(el.innerText || el.getAttribute("aria-label") || el.title);
          if (!label || label.length > 80) continue;
          const isBtn = tag === "BUTTON" || el.getAttribute("role") === "button";
          const section = isBtn && /^\+?\s*(hinzuf(ü|ue)gen|add)\b/i.test(label) ? headingBefore(el) : undefined;
          elements.push({ id: idOf(el), kind: isBtn ? "button" : "link", label, section, submit: tag === "BUTTON" && (el.type === "submit" || (!el.getAttribute("type") && !!el.form)) });
        }
      }
    }
    return { url: location.href, title: document.title, text: clean(document.body?.innerText || "").slice(0, 6000), elements };
  }

  function setNative(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  const mark = (el, generated) => {
    el.style.outline = `2px solid ${generated ? "#d4a017" : "#2da44e"}`;
    el.style.outlineOffset = "1px";
    if (generated) el.dataset.raGen = "1";
  };

  function b64ToFile(b64, name, type) {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const setValue = (el, v) => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);

  // Suggestion lists often load on real key events only: type via the debugger (trusted), else character by character with synthetic events.
  async function typeInto(el, value) {
    el.focus();
    setValue(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    if ((await bg({ cmd: "cdpType", text: value })).ok) return;
    for (const ch of value) {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
      setValue(el, el.value + ch);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true }));
      await sleep(40);
    }
  }

  const invalid = (el) => (el.willValidate && !el.checkValidity()) || !!errorOf(el);

  const OPT_SEL = "[role=option], [role=listbox] li, [class*=suggest i] li, [class*=autocomplete i] li, [class*=dropdown i] li, li[class*=item i]";

  // Autocomplete inputs only accept a suggestion that was clicked (or chosen with the keyboard), typing alone leaves the field invalid.
  async function pickSuggestion(el, value) {
    el.focus();
    const w = value.toLowerCase();
    for (let i = 0; i < 12; i++) {
      await sleep(250);
      const box = el.getBoundingClientRect();
      // only suggestions that sit just below the input; the page may contain unrelated dropdowns (also in shadow roots)
      const opts = deepQueryAll(OPT_SEL).filter((o) => {
        if (!visible(o) || !clean(o.innerText)) return false;
        const r = o.getBoundingClientRect();
        return r.top >= box.bottom - 6 && r.top - box.bottom < 450 && r.left < box.right && r.right > box.left;
      });
      if (!opts.length) continue;
      const opt = opts.find((o) => clean(o.innerText).toLowerCase().startsWith(w)) ?? opts.find((o) => clean(o.innerText).toLowerCase().includes(w)) ?? opts[0];
      opt.scrollIntoView({ block: "nearest" });
      const r = opt.getBoundingClientRect();
      if (!(await bg({ cmd: "cdpClick", x: r.left + r.width / 2, y: r.top + r.height / 2 })).ok) {
        for (const t of ["mousedown", "mouseup", "click"]) opt.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }));
      }
      await sleep(300);
      return true;
    }
    // no list found: choose the first suggestion with the keyboard
    el.focus();
    if (!(await bg({ cmd: "cdpKey", key: "ArrowDown" })).ok) return false;
    await sleep(200);
    await bg({ cmd: "cdpKey", key: "Enter" });
    await sleep(300);
    return !!clean(el.value);
  }

  async function perform(a, files, allowSubmit) {
    const el = registry.get(a.id);
    if (!el) return { id: a.id, ok: false, note: "Element nicht mehr da" };
    el.scrollIntoView({ block: "center" });
    try {
      if (a.type === "fill") {
        if (el.tagName === "INPUT" && isCombo(el)) {
          const orig = el.value;
          let ok = false;
          for (const v of [a.value, ...(a.fallback || [])]) {
            await typeInto(el, v);
            if ((await pickSuggestion(el, v)) && clean(el.value) && !invalid(el)) { ok = true; break; }
          }
          if (!ok) { setValue(el, orig); el.dispatchEvent(new Event("input", { bubbles: true })); return { id: a.id, ok: false, note: "Kein Vorschlag gefunden" }; }
          mark(el, a.generated);
          el.dispatchEvent(new Event("blur", { bubbles: true }));
        } else { setNative(el, a.value); mark(el, a.generated); }
        await sleep(300);
        if (invalid(el)) return { id: a.id, ok: false, note: "Feld ungültig, bitte Vorschlag auswählen" };
      }
      else if (a.type === "select") {
        if (el.tagName === "SELECT") {
          const o = [...el.options].find((x) => clean(x.text) === a.option);
          if (!o) return { id: a.id, ok: false, note: "Option fehlt" };
          setNative(el, o.value); mark(el);
        } else {
          const radio = [...el.ownerDocument.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)].find((r) => clean(labelOf(r)) === a.option || r.value === a.option);
          if (!radio) return { id: a.id, ok: false, note: "Option fehlt" };
          radio.click(); mark(radio);
        }
      } else if (a.type === "check") { if (el.checked !== a.checked) el.click(); mark(el); }
      else if (a.type === "upload") {
        const f = files[a.doc];
        if (!f) return { id: a.id, ok: false, note: "Datei fehlt" };
        const dt = new DataTransfer(); dt.items.add(b64ToFile(f.b64, f.name, "application/pdf"));
        el.files = dt.files;
        el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dataset.raFile = f.name;
        mark(el.closest("label") || el);
        const shown = async () => { await sleep(1200); return deepText().includes(f.name); };
        if (!(await shown())) {
          // dropzones that ignore the input's change event: replay the file as a drop on the zone
          let zone = el.closest("[class*=drop i], [class*=upload i]");
          for (let p = el.parentElement, i = 0; !zone && p && i < 3; p = p.parentElement, i++) zone = p;
          for (const t of ["dragenter", "dragover", "drop"]) zone.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
          if (!(await shown())) return { id: a.id, ok: false, note: "Upload nicht bestätigt" };
        }
      } else if (a.type === "click") {
        const text = clean(el.innerText || el.value || el.getAttribute("aria-label"));
        if (!allowSubmit && SUBMIT_RE.test(text)) return { id: a.id, ok: false, blocked: true, note: "Absenden ohne Bestätigung blockiert" };
        el.click();
      }
      return { id: a.id, ok: true };
    } catch (e) {
      return { id: a.id, ok: false, note: String(e) };
    }
  }

  // ---------- overlay (shadow DOM so page CSS cannot break it) ----------
  let host, shadow;
  function ui() {
    if (host?.isConnected) return shadow;
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      .box{font:14px/1.45 system-ui,sans-serif;background:#fff;color:#1b1f24;border:1px solid #c9d1d9;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);width:360px;max-height:70vh;overflow:auto;padding:14px}
      h3{margin:0 0 8px;font-size:14px} p{margin:0 0 8px} .muted{color:#57606a;font-size:12px}
      .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px} button{font:inherit;border-radius:8px;border:1px solid #c9d1d9;background:#f6f8fa;padding:6px 12px;cursor:pointer}
      button.primary{background:#1a7f64;color:#fff;border-color:#1a7f64} button.danger{color:#cf222e}
      ul{list-style:none;margin:0;padding:0} li{padding:5px 0;border-top:1px solid #eaeef2} li b{display:block;font-size:12px;color:#57606a;font-weight:500}
      li.gen{background:#fff8c5;margin:0 -6px;padding:5px 6px;border-radius:6px} textarea,input[type=text]{width:100%;box-sizing:border-box;font:inherit;border:1px solid #c9d1d9;border-radius:6px;padding:5px}
      .dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid #1a7f64;border-top-color:transparent;animation:s .8s linear infinite;vertical-align:-1px;margin-right:6px}@keyframes s{to{transform:rotate(360deg)}}
    </style><div class="box" id="box"></div>`;
    document.documentElement.appendChild(host);
    return shadow;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const decide = (d) => chrome.runtime.sendMessage({ cmd: "decision", ...d });

  function summary() {
    const items = [];
    for (const [id, el] of registry) {
      if (el.tagName === "INPUT" && el.type === "file") { if (el.files?.length) items.push({ id, label: labelOf(el) || "Datei", value: el.files[0].name }); continue; }
      if (el.type === "checkbox") { if (el.checked) items.push({ id, label: labelOf(el), value: "angekreuzt" }); continue; }
      if (el.type === "radio") { if (el.checked) items.push({ id, label: el.name, value: clean(labelOf(el)) || el.value }); continue; }
      if (el.type === "password" || !("value" in el) || el.tagName === "BUTTON" || ["submit", "button"].includes(el.type)) continue;
      const v = el.tagName === "SELECT" ? clean(el.selectedOptions[0]?.text) : el.value;
      if (clean(v)) items.push({ id, label: labelOf(el), value: v, generated: !!el.dataset.raGen, long: el.tagName === "TEXTAREA" });
    }
    return items;
  }

  function show(msg) {
    const root = ui(); const box = root.getElementById("box");
    if (msg.mode === "hide") { host.remove(); return; }
    if (msg.mode === "progress") {
      box.innerHTML = `<p><span class="dot"></span>${esc(msg.text)}</p><div class="row"><button class="danger" id="stop">Stopp</button></div>`;
      root.getElementById("stop").onclick = () => { decide({ decision: "cancel" }); host.remove(); };
    } else if (msg.mode === "message") {
      box.innerHTML = `<h3>${esc(msg.title || "Agent")}</h3><p>${esc(msg.text)}</p><div class="row"><button id="ok">Schließen</button></div>`;
      root.getElementById("ok").onclick = () => host.remove();
    } else if (msg.mode === "need_user") {
      box.innerHTML = `<h3>Dein Einsatz</h3><p style="white-space:pre-line">${esc(msg.text)}</p><div class="row"><button class="primary" id="go">Erledigt, weiter</button><button class="danger" id="no">Abbrechen</button></div>`;
      root.getElementById("go").onclick = () => { decide({ decision: "resume" }); show({ mode: "progress", text: "Mache weiter…" }); };
      root.getElementById("no").onclick = () => { decide({ decision: "cancel" }); host.remove(); };
    } else if (msg.mode === "ask") {
      const q = msg.question;
      const field = q.options?.length
        ? `<select id="ans">${q.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`
        : `<input type="text" id="ans" />`;
      box.innerHTML = `<h3>Frage vom Agent</h3><p>${esc(q.label)}</p>${field}<label class="muted"><input type="checkbox" id="rem" checked /> Antwort merken</label><div class="row"><button class="primary" id="send">Weiter</button><button class="danger" id="no">Abbrechen</button></div>`;
      root.getElementById("send").onclick = () => {
        decide({ decision: "answer", answer: { id: q.id, label: q.label, value: root.getElementById("ans").value, remember: root.getElementById("rem").checked } });
        show({ mode: "progress", text: "Trage Antwort ein…" });
      };
      root.getElementById("no").onclick = () => { decide({ decision: "cancel" }); host.remove(); };
    } else if (msg.mode === "confirm") {
      const items = summary();
      box.innerHTML = `<h3>Bereit zum Absenden</h3><p class="muted">Prüfe die Angaben. Gelb = vom Agent formuliert, direkt editierbar. Es wird erst nach „Absenden“ etwas abgeschickt.</p>
        <ul>${items.map((it, i) => `<li class="${it.generated ? "gen" : ""}"><b>${esc(it.label)}</b>${it.generated ? `<textarea data-i="${i}" rows="3">${esc(it.value)}</textarea>` : esc(it.value)}</li>`).join("")}</ul>
        <div class="row"><button class="primary" id="send">Absenden</button><button id="manual">Ich mache selbst weiter</button><button class="danger" id="no">Abbrechen</button></div>`;
      root.getElementById("send").onclick = () => {
        box.querySelectorAll("textarea[data-i]").forEach((t) => { const it = items[Number(t.dataset.i)]; const el = registry.get(it.id); if (el && t.value !== it.value) setNative(el, t.value); });
        decide({ decision: "submit" });
        show({ mode: "progress", text: "Sende ab…" });
      };
      root.getElementById("manual").onclick = () => { decide({ decision: "manual" }); host.remove(); };
      root.getElementById("no").onclick = () => { decide({ decision: "cancel" }); host.remove(); };
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.cmd === "ping") reply({ ok: true });
    else if (msg.cmd === "snapshot") { const snap = snapshot(); console.debug("[ra] elements", snap.elements.map((e) => `${e.kind}/${e.type || ""} ${e.label}`)); reply(snap); }
    else if (msg.cmd === "rect") {
      // where to click so the page opens its own file dialog: the "choose file" link inside the dropzone, else the zone itself
      const el = registry.get(msg.id);
      let zone = el && (el.closest("label, [class*=drop i], [class*=upload i]") || el.parentElement);
      for (let i = 0; zone && !visible(zone) && i < 4; i++) zone = zone.parentElement;
      const pick = zone && ([...zone.querySelectorAll("a, button, span, label, div")].filter((n) => visible(n) && /ausw(ä|ae)hlen|durchsuchen|browse|choose|hochladen|upload/i.test(clean(n.innerText)) && clean(n.innerText).length < 60).pop() || zone);
      if (!pick) { reply({ ok: false }); return; }
      pick.scrollIntoView({ block: "center" });
      const r = pick.getBoundingClientRect();
      reply({ ok: true, x: r.left + Math.min(r.width / 2, 120), y: r.top + r.height / 2 });
    }
    else if (msg.cmd === "hasText") reply({ ok: deepText().includes(msg.text) });
    else if (msg.cmd === "act") {
      (async () => {
        const results = [];
        for (const a of msg.actions) results.push(await perform(a, msg.files || {}, !!msg.allowSubmit));
        reply({ results });
      })();
      return true;
    }
    else if (msg.cmd === "overlay") { show(msg); reply({ ok: true }); }
  });
})();
