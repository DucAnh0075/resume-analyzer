// Agent loop. State lives in chrome.storage.session so the service worker may sleep while the user decides.
const BASE = "http://localhost:3000";
const MAX_STEPS = 25;
const running = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (id) => `st:${id}`;
const getState = async (id) => (await chrome.storage.session.get(key(id)))[key(id)];
const setState = (id, s) => chrome.storage.session.set({ [key(id)]: s });
const clearState = async (id) => { await detach(id); await chrome.storage.session.remove(key(id)); };

// Trusted input via the DevTools protocol: synthetic DOM events are ignored by many autocomplete and upload widgets.
const attached = new Set();
async function cdp(tabId, method, params) {
  if (!attached.has(tabId)) { await chrome.debugger.attach({ tabId }, "1.3"); attached.add(tabId); }
  return chrome.debugger.sendCommand({ tabId }, method, params);
}
async function detach(tabId) {
  if (attached.delete(tabId)) await chrome.debugger.detach({ tabId }).catch(() => {});
}
chrome.debugger.onDetach.addListener((src) => attached.delete(src.tabId));

const VK = { ArrowDown: 40, Enter: 13 };
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!sender.tab || !String(msg.cmd).startsWith("cdp")) return;
  const tabId = sender.tab.id;
  (async () => {
    if (msg.cmd === "cdpType") {
      for (const ch of msg.text) {
        await cdp(tabId, "Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch });
        await cdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: ch });
        await sleep(50);
      }
    } else if (msg.cmd === "cdpKey") {
      const p = { key: msg.key, code: msg.key, windowsVirtualKeyCode: VK[msg.key], nativeVirtualKeyCode: VK[msg.key] };
      await cdp(tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...p });
      await cdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...p });
    } else if (msg.cmd === "cdpClick") {
      const p = { x: msg.x, y: msg.y, button: "left", clickCount: 1 };
      await cdp(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: msg.x, y: msg.y });
      await cdp(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", ...p });
      await cdp(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", ...p });
    }
    reply({ ok: true });
  })().catch((e) => reply({ ok: false, error: String(e.message || e) }));
  return true;
});

async function api(path, body) {
  const r = await fetch(BASE + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

async function ensureContent(tabId) {
  try { await chrome.tabs.sendMessage(tabId, { cmd: "ping" }); }
  catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await sleep(100);
  }
}

async function send(tabId, msg) {
  await ensureContent(tabId);
  return chrome.tabs.sendMessage(tabId, msg);
}
const overlay = (tabId, msg) => send(tabId, { cmd: "overlay", ...msg }).catch(() => {});

async function waitComplete(tabId, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") break;
    await sleep(300);
  }
  await sleep(700); // let SPA frameworks render
}

async function fetchFile(jobId, doc) {
  for (const which of doc === "cv" ? ["tailored", "original"] : ["tailored"]) {
    const r = await fetch(`${BASE}/api/jobs/${jobId}/pdf?which=${which}&doc=${doc}&format=pdf`);
    if (!r.ok) continue;
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { b64: btoa(bin), name: doc === "cv" ? "Lebenslauf.pdf" : "Anschreiben.pdf" };
  }
}

// Chrome needs a file path for DOM.setFileInputFiles; the downloads API gives one that is valid for the browser's OS (also when it runs outside WSL).
async function downloadDoc(jobId, doc) {
  const name = doc === "cv" ? "Lebenslauf.pdf" : "Anschreiben.pdf";
  let url;
  for (const which of doc === "cv" ? ["tailored", "original"] : ["tailored"]) {
    const u = `${BASE}/api/jobs/${jobId}/pdf?which=${which}&doc=${doc}&format=pdf`;
    if ((await fetch(u)).ok) { url = u; break; }
  }
  if (!url) throw new Error("PDF nicht verfügbar (Lebenslauf zuerst erstellen oder unter „Mein CV“ speichern)");
  const dl = await chrome.downloads.download({ url, filename: `resume-analyzer/${name}`, conflictAction: "overwrite" });
  for (let i = 0; i < 40; i++) {
    const item = (await chrome.downloads.search({ id: dl }))[0];
    if (item?.state === "complete") return { name, path: item.filename };
    if (item?.state === "interrupted") throw new Error("Download der PDF abgebrochen");
    await sleep(250);
  }
  throw new Error("Download der PDF dauert zu lange");
}

const findEl = (id) => `(function f(r){const e=r.querySelector('[data-ra-id="${id}"]');if(e)return e;for(const n of r.querySelectorAll('*'))if(n.shadowRoot){const x=f(n.shadowRoot);if(x)return x}return null})(document)`;
const shown = async (tabId, name) => !!(await send(tabId, { cmd: "hasText", text: name }).catch(() => ({}))).ok;

// Strategy 1: put the file into the input. Strategy 2: let the page open its own file dialog (trusted click), intercept it and answer it.
// Returns { ok, reason }; the reason is shown to the user when nothing worked.
async function uploadTrusted(tabId, jobId, a) {
  try {
    const { name, path } = await downloadDoc(jobId, a.doc);
    const { result } = await cdp(tabId, "Runtime.evaluate", { expression: findEl(a.id) });
    let n = 0;
    if (result?.objectId) {
      await cdp(tabId, "DOM.setFileInputFiles", { objectId: result.objectId, files: [path] });
      n = (await cdp(tabId, "Runtime.callFunctionOn", { objectId: result.objectId, functionDeclaration: "function(){return this.files.length}", returnByValue: true })).result?.value ?? 0;
      await sleep(1500);
      if (await shown(tabId, name)) return { ok: true };
    }
    const spot = await send(tabId, { cmd: "rect", id: a.id }).catch(() => null);
    if (spot?.ok) {
      await cdp(tabId, "Page.enable");
      await cdp(tabId, "Page.setInterceptFileChooserDialog", { enabled: true });
      const opened = new Promise((res) => {
        const h = (src, method, params) => {
          if (src.tabId === tabId && method === "Page.fileChooserOpened") { chrome.debugger.onEvent.removeListener(h); res(params); }
        };
        chrome.debugger.onEvent.addListener(h);
        setTimeout(() => { chrome.debugger.onEvent.removeListener(h); res(null); }, 4000);
      });
      const p = { x: spot.x, y: spot.y, button: "left", clickCount: 1 };
      await cdp(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x, y: spot.y });
      await cdp(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", ...p });
      await cdp(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", ...p });
      const ev = await opened;
      await cdp(tabId, "Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {});
      if (ev?.backendNodeId) {
        await cdp(tabId, "DOM.setFileInputFiles", { backendNodeId: ev.backendNodeId, files: [path] });
        await sleep(1500);
        if (await shown(tabId, name)) return { ok: true };
      }
    }
    return { ok: false, reason: result?.objectId ? `Datei gesetzt (${n}), aber die Seite zeigt sie nicht` : "Upload-Feld nicht erreichbar" };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  }
}

async function start({ jobId, tabId }) {
  const job = (await api("/api/jobs")).find((j) => j.id === jobId);
  if (!job) throw new Error("Stelle nicht gefunden");
  if (!tabId) {
    if (!job.url) throw new Error("Die Stelle hat keine URL. Öffne die Bewerbungsseite selbst und starte den Agent im Popup.");
    tabId = (await chrome.tabs.create({ url: job.url })).id;
  }
  await setState(tabId, { jobId, steps: 0, done: [], answers: null });
  run(tabId);
}

async function run(tabId) {
  if (running.has(tabId)) return;
  running.add(tabId);
  try {
    for (;;) {
      const st = await getState(tabId);
      if (!st) return;
      if (st.steps >= MAX_STEPS) {
        await overlay(tabId, { mode: "message", title: "Abbruch", text: `Nach ${MAX_STEPS} Schritten nicht fertig. Mach selbst weiter.` });
        await clearState(tabId);
        return;
      }
      await waitComplete(tabId);
      await overlay(tabId, { mode: "progress", text: `Schritt ${st.steps + 1}: lese Seite…` });
      const snap = await send(tabId, { cmd: "snapshot" });
      const res = await api("/api/agent/step", { jobId: st.jobId, ...snap, done: st.done, attempts: st.attempts, answers: st.answers || undefined });
      const notes = st.notes || [];
      st.answers = null;
      st.steps++;

      if (res.status === "continue") {
        // uploads first through the debugger; only those that did not show up fall back to the content script
        const uploaded = new Set();
        const failed = [];
        for (const a of res.actions.filter((x) => x.type === "upload")) {
          const r = await uploadTrusted(tabId, st.jobId, a);
          if (r.ok) { uploaded.add(a.id); uploaded.add(`doc:${a.doc}`); } else failed.push(`${a.label || "Datei"}: ${r.reason}`);
        }
        res.actions = res.actions.filter((a) => !uploaded.has(a.id));
        const docs = [...new Set(res.actions.filter((a) => a.type === "upload").map((a) => a.doc))];
        const files = {};
        for (const d of docs) { const f = await fetchFile(st.jobId, d); if (f) files[d] = f; }
        const labels = res.actions.map((a) => a.label).filter(Boolean);
        await overlay(tabId, { mode: "progress", text: labels.length ? `Trage ein: ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? "…" : ""}` : "Gehe weiter…" });
        const acted = await send(tabId, { cmd: "act", actions: res.actions, files });
        st.done.push(...res.actions.map((a) => a.id), ...uploaded, ...res.actions.map((a) => a.mark).filter(Boolean), ...docs.map((d) => `doc:${d}`));
        // failures do not stop the run: invalid fields are retried (different strategy each time) until the server runs out of attempts and asks
        st.attempts = st.attempts || {};
        for (const a of [...res.actions, ...[...uploaded].filter((x) => !x.startsWith("doc:")).map((id) => ({ id, type: "upload" }))]) {
          if (a.type !== "click") st.attempts[a.id] = (st.attempts[a.id] || 0) + 1;
        }
        for (const r of acted?.results || []) {
          if (r.ok || r.blocked) continue;
          const a = res.actions.find((x) => x.id === r.id);
          failed.push(`${a?.label || r.id}: ${r.note || "fehlgeschlagen"}`);
        }
        st.notes = failed.slice(-5);
        await setState(tabId, st);
        await sleep(1200); // a click may start a navigation or open a new tab
        continue;
      }

      if (notes.length && ["ask", "need_user", "blocked"].includes(res.status)) res.message = `${res.message ? res.message + "\n" : ""}Zuletzt gescheitert:\n${notes.join("\n")}`;
      await setState(tabId, st);
      if (res.status === "ready_to_submit") {
        st.submitId = res.submitId;
        await setState(tabId, st);
        await overlay(tabId, { mode: "confirm" });
      } else if (res.status === "ask") await overlay(tabId, { mode: "ask", question: res.question });
      else if (res.status === "need_user") await overlay(tabId, { mode: "need_user", text: res.message });
      else if (res.status === "done") {
        await api("/api/agent/done", { jobId: st.jobId });
        await overlay(tabId, { mode: "message", title: "Fertig", text: "Bewerbung abgeschickt und im Bewerbungsstand eingetragen." });
        await clearState(tabId);
      } else {
        await overlay(tabId, { mode: "message", title: "Agent gestoppt", text: res.message || "Nicht möglich." });
        await clearState(tabId);
      }
      return;
    }
  } catch (e) {
    await overlay(tabId, { mode: "message", title: "Fehler", text: String(e.message || e) });
    await clearState(tabId);
  } finally {
    running.delete(tabId);
  }
}

// Decisions from the overlay
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.cmd !== "decision" || !sender.tab) return;
  const tabId = sender.tab.id;
  (async () => {
    const st = await getState(tabId);
    if (!st) return;
    if (msg.decision === "cancel" || msg.decision === "manual") return clearState(tabId);
    if (msg.decision === "answer") st.answers = [msg.answer];
    if (msg.decision === "submit") {
      await send(tabId, { cmd: "act", actions: [{ type: "click", id: st.submitId }], allowSubmit: true });
      st.submitted = true;
      await sleep(1500);
    }
    await setState(tabId, st);
    run(tabId);
  })();
});

// A new tab opened by the application page (e.g. "Bewerben" on the company site) takes over the run.
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.openerTabId) return;
  const st = await getState(tab.openerTabId);
  if (!st) return;
  await clearState(tab.openerTabId);
  await setState(tab.id, st);
  run(tab.id);
});

// The app starts the agent through externally_connectable
chrome.runtime.onMessageExternal.addListener((msg, _sender, reply) => {
  if (msg.cmd === "ping") reply({ ok: true });
  else if (msg.cmd === "start") start({ jobId: msg.jobId }).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: String(e.message || e) }));
  return true;
});

// The popup starts the agent on the active tab
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.cmd !== "start") return;
  start({ jobId: msg.jobId, tabId: msg.tabId }).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: String(e.message || e) }));
  return true;
});
