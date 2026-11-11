// Helper Selector
const $ = id => document.getElementById(id);

// State Management & Local Storage
let cur = "auto", busy = false, stopFlag = false;
let hist = {}, brief = {}, wf = { goal: "", log: [], pending: null };
let geminiKey = "";

try {
  hist = JSON.parse(localStorage.getItem("tka-hist") || "{}");
  brief = JSON.parse(localStorage.getItem("tka-brief") || "{}");
  wf = JSON.parse(localStorage.getItem("tka-wf") || "null") || wf;
  geminiKey = localStorage.getItem("tka-key") || "";
} catch (e) {}

AGENTS.forEach(a => { if (!Array.isArray(hist[a.id])) hist[a.id] = []; });

const save = () => {
  try {
    localStorage.setItem("tka-hist", JSON.stringify(hist));
    localStorage.setItem("tka-brief", JSON.stringify(brief));
    localStorage.setItem("tka-wf", JSON.stringify(wf));
    localStorage.setItem("tka-key", geminiKey);
  } catch (e) {}
};

const agent = () => AGENTS.find(a => a.id === cur);

// Gemini API Call Helper
async function callAI(sysInstruction, contents, useSearch = false) {
  const apiKey = geminiKey.trim();
  if (!apiKey) {
    throw new Error("KEY_MISSING");
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
  const payload = {
    contents: contents,
    systemInstruction: { parts: [{ text: sysInstruction }] }
  };

  if (useSearch) {
    payload.tools = [{ "google_search": {} }];
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Format respon API tidak valid");
  return text;
}

// Handler Modal API Key & Summary
$("cfgBtn").onclick = () => { $("apiKeyInput").value = geminiKey; $("apiModal").style.display = "flex"; };
$("closeModalBtn").onclick = () => { $("apiModal").style.display = "none"; };
$("saveKeyBtn").onclick = () => {
  geminiKey = $("apiKeyInput").value.trim();
  save();
  $("apiModal").style.display = "none";
};

$("summaryBtn").onclick = () => { generateTalentSummary(); $("summaryModal").style.display = "flex"; };
$("closeSummaryBtn").onclick = () => { $("summaryModal").style.display = "none"; };

// Bind Input Brief
["user", "niche", "aud", "style", "goal"].forEach(k => {
  const el = $("b-" + k);
  if (el) {
    el.value = brief[k] || "";
    el.addEventListener("input", () => { brief[k] = el.value; save(); });
  }
});

// Fitur Riset Username TikTok
$("analyzeUserBtn").onclick = async () => {
  const username = $("b-user").value.trim();
  if (!username) {
    alert("Masukkan username TikTok terlebih dahulu (contoh: @kreatortiktok).");
    return;
  }
  
  if (busy) return;
  busy = true; $("send").disabled = true;
  
  cur = "data";
  renderTabs();
  renderChat();
  
  const userMsg = `Tolong riset dan analisis akun TikTok ${username}. Cari tahu topik utama, gaya kontennya, dan berikan 5 ide konten baru yang cocok.`;
  hist["data"].push({ role: "user", content: userMsg });
  bubble("user", userMsg);
  
  const out = bubble("bot", `🔍 Sedang meriset profil TikTok ${username} via web search...`);
  
  try {
    const contents = [{ role: "user", parts: [{ text: briefText() + "\n\n" + userMsg }] }];
    const replyText = await callAI(agent().sys, contents, true);
    out.textContent = replyText;
    hist["data"].push({ role: "assistant", content: replyText });
  } catch (err) {
    hist["data"].pop();
    if (err.message === "KEY_MISSING") {
      out.textContent = "⚠️ API Key Gemini belum dimasukkan. Klik tombol '⚙️ API Key' di atas untuk memasukkan API Key Anda secara gratis.";
      $("apiModal").style.display = "flex";
    } else {
      out.textContent = "Terjadi kesalahan saat menganalisis profil: " + err.message;
    }
  }
  
  save(); busy = false; $("send").disabled = false;
};

// Render Interface Components
function mkRow(id, d) {
  const v = VIS[id] || { e: '⚙️', c: 'a-sys' };
  const r = document.createElement('div');
  r.className = 'row ' + v.c;
  const av = document.createElement('div');
  av.className = 'av';
  av.textContent = v.e;
  r.appendChild(av);
  r.appendChild(d);
  $('chat').appendChild(r);
  $('chat').scrollTop = $('chat').scrollHeight;
}

function renderTabs() {
  renderTabs0();
  const b = document.createElement("button");
  b.className = "tab" + (cur === "auto" ? " on" : "");
  b.innerHTML = "<b>⚙️ Alur Otomatis</b><span>Tim bekerja sendiri</span>";
  b.onclick = () => { if (busy) return; cur = "auto"; renderTabs(); renderChat(); };
  $("tabs").insertBefore(b, $("tabs").firstChild);
  $("tools").style.display = cur === "auto" ? "none" : "";
  $("clear").textContent = cur === "auto" ? "Mulai alur baru" : "Hapus chat agen ini";
  $("summaryBtn").style.display = (cur === "auto" && wf.log.length > 0) ? "block" : "none";
}

function renderTabs0() {
  $("tabs").innerHTML = "";
  AGENTS.forEach(a => {
    const b = document.createElement("button");
    b.className = "tab" + (a.id === cur ? " on" : "");
    b.innerHTML = "<b></b><span></span>";
    b.firstChild.textContent = VIS[a.id].e + " " + a.name;
    b.style.borderLeft = "4px solid " + VIS[a.id].av;
    b.lastChild.textContent = a.sub;
    b.onclick = () => { if (busy) return; cur = a.id; renderTabs(); renderChat(); };
    $("tabs").appendChild(b);
  });
  $("fwd").innerHTML = "";
  AGENTS.filter(a => a.id !== cur).forEach(a => {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = a.name;
    $("fwd").appendChild(o);
  });
}

function bubble(role, text) {
  const d = document.createElement("div");
  d.className = "msg " + (role === "user" ? "user" : "bot");
  d.textContent = text;
  if (role === "user") {
    $("chat").appendChild(d);
    $("chat").scrollTop = $("chat").scrollHeight;
  } else {
    mkRow(cur, d);
  }
  return d;
}

function renderChat() {
  if (cur === "auto") return renderWf();
  const c = $("chat");
  c.innerHTML = "";
  const h = hist[cur];
  if (!h.length) {
    const e = document.createElement("div");
    e.className = "empty";
    e.innerHTML = "<div style='font-size:16px;font-weight:600;color:var(--ink)'></div><div style='margin-top:4px'></div><div class='chips'></div>";
    e.children[0].textContent = agent().name;
    e.children[1].textContent = agent().sub + ". Isi brief kreator di atas supaya jawabannya lebih tepat.";
    agent().chips.forEach(t => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = t;
      b.onclick = () => { $("inp").value = t; $("inp").focus(); };
      e.lastChild.appendChild(b);
    });
    c.appendChild(e);
  } else {
    h.forEach(m => bubble(m.role, m.content));
  }
}

function briefText() {
  const p = [
    ["Username TikTok", brief.user],
    ["Niche", brief.niche],
    ["Audiens", brief.aud],
    ["Gaya", brief.style],
    ["Target", brief.goal]
  ].filter(x => x[1]);
  return p.length ? "Brief kreator: " + p.map(x => x[0] + ": " + x[1]).join("; ") + ". " : "";
}

// Fitur Kirim Pesan Single Agent
async function send() {
  if (cur === "auto") return wfSend();
  const text = $("inp").value.trim();
  if (!text || busy) return;
  const id = cur, a = agent(), h = hist[id];
  busy = true; $("send").disabled = true; $("inp").value = "";
  
  if (!h.length) $("chat").innerHTML = "";
  h.push({ role: "user", content: text });
  bubble("user", text);
  
  const out = bubble("bot", "Sedang berpikir...");
  
  try {
    let msgs = h.slice(-12).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));
    
    if (msgs.length > 0 && msgs[0].role === "user") {
      msgs[0].parts[0].text = briefText() + "\n\nPesan kreator:\n" + msgs[0].parts[0].text;
    }
    
    const replyText = await callAI(a.sys, msgs, true);
    out.textContent = replyText;
    h.push({ role: "assistant", content: replyText });
  } catch (e) {
    h.pop();
    if (e.message === "KEY_MISSING") {
      out.textContent = "⚠️ API Key Gemini belum dimasukkan. Klik tombol '⚙️ API Key' di atas.";
      $("apiModal").style.display = "flex";
    } else {
      out.textContent = "Terjadi kesalahan: " + e.message;
    }
  }
  save(); busy = false; $("send").disabled = false;
}

$("send").onclick = send;
$("inp").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });

$("clear").onclick = () => {
  if (busy) return;
  if (cur === "auto") {
    wf = { goal: "", log: [], pending: null };
    save();
    renderWf();
    return;
  }
  hist[cur] = [];
  save();
  renderChat();
};

$("fwdBtn").onclick = () => {
  if (busy) return;
  const last = [...hist[cur]].reverse().find(m => m.role === "assistant");
  if (!last) return;
  const to = $("fwd").value, from = agent().name;
  cur = to;
  renderTabs();
  renderChat();
  $("inp").value = "Dari " + from + ":\n" + last.content + "\n\nTolong lanjutkan sesuai peranmu.";
  $("inp").focus();
};

// Workflow Execution Functions
function nameOf(id) { const a = AGENTS.find(x => x.id === id); return a ? a.name : (id === 'user' ? 'Kamu' : 'Sistem'); }

function wfBubble(e) {
  const d = document.createElement('div');
  d.className = 'msg ' + (e.agent === 'user' ? 'user' : 'bot');
  const l = document.createElement('div');
  l.className = 'lbl';
  l.textContent = nameOf(e.agent) + (e.status === 'ask' ? ' bertanya' : '');
  const t = document.createElement('div');
  t.textContent = e.text;
  d.appendChild(l);
  d.appendChild(t);
  if (e.agent === 'user') {
    $('chat').appendChild(d);
    $('chat').scrollTop = $('chat').scrollHeight;
  } else {
    mkRow(e.agent, d);
  }
}

function renderWf() {
  const c = $('chat');
  c.innerHTML = '';
  if (!wf.log.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.innerHTML = '<div class=ttl>Alur Otomatis</div><div></div><div class=chips></div>';
    e.children[1].textContent = 'Tulis satu tujuan. Keempat agen bergantian bekerja sendiri dan hanya bertanya kepadamu saat butuh data atau ragu.';
    ['Buat paket konten 1 minggu tentang topik saya', 'Cari tahu kenapa views video saya turun', 'Siapkan konten untuk momen promo bulan depan'].forEach(t => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = t;
      b.onclick = () => { $('inp').value = t; $('inp').focus(); };
      e.children[2].appendChild(b);
    });
    c.appendChild(e);
  } else {
    wf.log.forEach(wfBubble);
  }
  $('inp').placeholder = wf.pending ? 'Jawab pertanyaan agen...' : (wf.log.length ? 'Beri arahan tambahan atau ketik lanjut...' : 'Tulis tujuan kamu...');
}

function logPush(e) {
  wf.log.push(e);
  save();
  renderWf();
  $("summaryBtn").style.display = (cur === "auto" && wf.log.length > 0) ? "block" : "none";
}

function wfPayload(a, note) {
  const tr = wf.log.slice(-14).map(e => '[' + nameOf(e.agent) + '] ' + String(e.text).slice(0, 1500)).join('\n\n');
  const userPrompt = 'Tujuan kreator: ' + wf.goal + '\n\nRiwayat kerja tim:\n' + tr + '\n\nGiliranmu sebagai ' + a.name + '. Instruksi: ' + note;
  return [{ role: "user", parts: [{ text: userPrompt }] }];
}

async function wfAsk(sys, payload) {
  const fullSys = sys + "\n\n" + briefText() + "\n\n" + WF_RULES;
  const rawText = await callAI(fullSys, payload, true);
  const m = rawText.match(/\{[\s\S]*\}/);
  if (!m) return { status: 'done', message: rawText, next: 'finish' };
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    return { status: 'done', message: rawText, next: 'finish' };
  }
}

function working(n, id) {
  const d = document.createElement('div');
  d.className = 'msg bot';
  d.textContent = n + ' sedang bekerja... ';
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = 'Hentikan';
  b.onclick = () => { stopFlag = true; b.disabled = true; };
  d.appendChild(b);
  mkRow(id, d);
}

async function wfRun(agentId, note) {
  busy = true; stopFlag = false; $('send').disabled = true;
  let steps = 0, fin = false;
  while (steps < 8 && !stopFlag) {
    steps++;
    const a = AGENTS.find(x => x.id === agentId);
    working(a.name, a.id);
    let r;
    try {
      r = await wfAsk(a.sys, wfPayload(a, note));
    } catch (e) {
      logPush({ agent: 'sys', text: e.message || 'Terjadi kesalahan, alur dihentikan.' });
      fin = true; break;
    }
    const ask = r.status === 'ask';
    logPush({ agent: agentId, text: String(r.message || '').trim() || '(kosong)', status: ask ? 'ask' : 'done' });
    if (ask) { wf.pending = agentId; fin = true; break; }
    if (!AGENTS.some(x => x.id === r.next)) {
      logPush({ agent: 'sys', text: '🎉 Seluruh alur selesai! Mengekstrak rangkuman eksekusi talent...' });
      fin = true;
      setTimeout(() => { generateTalentSummary(); $("summaryModal").style.display = "flex"; }, 600);
      break;
    }
    agentId = r.next; note = r.note || 'Lanjutkan sesuai peranmu.';
  }
  if (!fin) {
    logPush({ agent: 'sys', text: stopFlag ? 'Alur dihentikan. Beri arahan untuk melanjutkan.' : 'Alur berhenti setelah 8 langkah. Ketik lanjut jika ingin diteruskan.' });
  }
  busy = false; $('send').disabled = false; save(); renderWf();
}

async function wfSend() {
  const text = $('inp').value.trim();
  if (!text || busy) return;
  $('inp').value = '';
  let ag = 'manager', note;
  if (wf.pending) {
    ag = wf.pending; wf.pending = null;
    note = 'Kreator menjawab pertanyaanmu. Lanjutkan pekerjaanmu.';
  } else if (wf.log.length) {
    note = 'Kreator memberi arahan tambahan. Tinjau riwayat, lalu lanjutkan atau susun ulang rencana dan serahkan ke agen yang tepat.';
  } else {
    wf.goal = text;
    note = 'Mulai dari tujuan kreator: susun rencana kerja singkat, kerjakan bagianmu, lalu serahkan ke agen yang tepat.';
  }
  logPush({ agent: 'user', text });
  await wfRun(ag, note);
}

// Generator Rangkuman Per Konten untuk Talent
async function generateTalentSummary() {
  const container = $("summaryContent");
  container.innerHTML = "<div style='text-align:center;padding:20px;color:var(--mute)'>⏳ Menyusun rangkuman per konten untuk talent...</div>";

  const allLogs = wf.log.filter(l => l.agent !== 'user' && l.agent !== 'sys').map(l => `[${nameOf(l.agent)}]:\n${l.text}`).join("\n\n---\n\n");

  if (!allLogs) {
    container.innerHTML = "<div style='text-align:center;padding:20px;color:var(--mute)'>Belum ada riwayat alur kerja untuk dirangkum.</div>";
    return;
  }

  const sysPrompt = "Kamu adalah Assistant Production Coordinator. Tugasmu merangkum seluruh percakapan tim AI menjadi lembar panduan eksekusi yang sangat rapi, jelas, dan terstruktur khusus untuk BACAAN TALENT / KREATOR. Format output HARUS berupa array JSON murni dari objek konten tanpa teks luar markdown.";

  const promptText = `Berikut adalah riwayat diskusi tim konten untuk tujuan: "${wf.goal}"\n\nRiwayat:\n${allLogs}\n\nEkstrak dan rangkum diskusi di atas menjadi format JSON berikut:\n[\n  {\n    "title": "Judul / Topik Video",\n    "pillar": "Pilar / Niche Konten",\n    "hook": "Pilihan Hook Utama (3 Detik Pertama)",\n    "script": "Ringkasan Naskah / Poin Bicara Talent",\n    "visual_notes": "Arahan Eksekusi Visual / Gesture Talent",\n    "caption_hashtags": "Caption & Hashtag Posting"\n  }\n]\n\nPastikan bahasa Indonesia santai, praktis, dan mudah dibaca talent di lokasi syuting. Balas HANYA JSON.`;

  try {
    const rawRes = await callAI(sysPrompt, [{ role: "user", parts: [{ text: promptText }] }]);
    const jsonMatch = rawRes.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Format respon tidak sesuai");
    
    const items = JSON.parse(jsonMatch[0]);
    container.innerHTML = "";

    items.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "summary-card";
      card.innerHTML = `
        <h4>
          <span>🎬 Konten ${idx + 1}: ${item.title || "Tanpa Judul"}</span>
          <span class="badge">${item.pillar || "TikTok"}</span>
        </h4>
        <div style="margin-top:8px;font-size:13px">
          <p style="margin:4px 0"><strong>🪝 Hook (3 Detik Pertama):</strong> <span style="color:var(--accent);font-weight:600">${item.hook || "-"}</span></p>
          <p style="margin:8px 0 4px"><strong>🗣️ Poin / Naskah Talent:</strong></p>
          <div style="background:var(--card);padding:8px 10px;border-radius:8px;border:1px solid var(--line);white-space:pre-wrap">${item.script || "-"}</div>
          <p style="margin:8px 0 4px"><strong>🎥 Arahan Visual & Shooting:</strong> ${item.visual_notes || "-"}</p>
          <p style="margin:8px 0 4px"><strong>📱 Caption & Hashtag:</strong> <span style="color:var(--mute)">${item.caption_hashtags || "-"}</span></p>
        </div>
        <button class="btn" style="margin-top:8px;font-size:12px;width:100%" onclick="copyCardText(this)">📋 Salin Teks Naskah</button>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    container.innerHTML = `
      <div style="background:var(--bg);padding:12px;border-radius:8px;border:1px solid var(--line);white-space:pre-wrap;font-size:13px">
        <strong>Hasil Diskusi Tim Agen:</strong>\n\n${allLogs}
      </div>`;
  }
}

function copyCardText(btn) {
  const card = btn.parentElement;
  const text = card.innerText.replace("📋 Salin Teks Naskah", "").trim();
  const el = document.createElement("textarea");
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
  const orig = btn.textContent;
  btn.textContent = "✅ Tersalin!";
  setTimeout(() => { btn.textContent = orig; }, 1500);
}

// Inisialisasi awal
renderTabs();
renderChat();