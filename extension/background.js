// Agent loop. State lives in chrome.storage.session so the service worker may sleep while the user decides.
const BASE = "http://localhost:3000";
const MAX_STEPS = 15;
const running = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (id) => `st:${id}`;
const getState = async (id) => (await chrome.storage.session.get(key(id)))[key(id)];
const setState = (id, s) => chrome.storage.session.set({ [key(id)]: s });
const clearState = (id) => chrome.storage.session.remove(key(id));

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
      const res = await api("/api/agent/step", { jobId: st.jobId, ...snap, done: st.done, answers: st.answers || undefined });
      st.answers = null;
      st.steps++;

      if (res.status === "continue") {
        const docs = [...new Set(res.actions.filter((a) => a.type === "upload").map((a) => a.doc))];
        const files = {};
        for (const d of docs) { const f = await fetchFile(st.jobId, d); if (f) files[d] = f; }
        const labels = res.actions.map((a) => a.label).filter(Boolean);
        await overlay(tabId, { mode: "progress", text: labels.length ? `Trage ein: ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? "…" : ""}` : "Gehe weiter…" });
        await send(tabId, { cmd: "act", actions: res.actions, files });
        st.done.push(...res.actions.map((a) => a.id), ...docs.map((d) => `doc:${d}`));
        await setState(tabId, st);
        await sleep(1200); // a click may start a navigation or open a new tab
        continue;
      }

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
