const BASE = "http://localhost:3000";
const $ = (id) => document.getElementById(id);

async function init() {
  let jobs;
  try {
    jobs = await (await fetch(`${BASE}/api/jobs`)).json();
    $("status").textContent = "Verbunden mit localhost:3000";
  } catch {
    $("status").textContent = "App nicht erreichbar. Läuft npm run dev?";
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const title = (tab?.title || "").toLowerCase();
  // Jobs worth applying to first, then the one whose company appears in the page title
  const rank = (j) => (title && j.company && title.includes(j.company.toLowerCase()) ? 0 : j.tailored || j.cover ? 1 : j.bookmarked ? 2 : 3);
  const open = jobs.filter((j) => j.status !== "ignoriert" && j.status !== "beworben").sort((a, b) => rank(a) - rank(b));
  $("job").innerHTML = open.map((j) => `<option value="${j.id}">${j.company ? j.company + " · " : ""}${j.title.replace(/</g, "&lt;")}</option>`).join("");
  $("start").disabled = $("applied").disabled = !open.length;

  $("start").onclick = async () => {
    $("msg").textContent = "Starte…";
    const r = await chrome.runtime.sendMessage({ cmd: "start", jobId: $("job").value, tabId: tab.id });
    $("msg").textContent = r?.ok ? "Agent läuft, schau auf die Seite." : r?.error || "Fehler";
    if (r?.ok) window.close();
  };
  $("applied").onclick = async () => {
    const r = await fetch(`${BASE}/api/agent/done`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: $("job").value }) });
    $("msg").textContent = r.ok ? "Im Bewerbungsstand eingetragen." : "Fehler";
  };
}
init();
