(() => {
  "use strict";
  // Demo only: never publish a privileged API key in frontend code.
  const API_URL = "https://ndsql.top/api/vdb/users";
  const API_KEY = "nd_f94ad03853212365940dff43734c8a6f12388bd2";
  const $ = id => document.getElementById(id);
  const page = document.body.dataset.page;
  const NAV = [["index.html", "home", "হোম"], ["people.html", "people", "তথ্য তালিকা"], ["add.html", "add", "নতুন ব্যক্তি"]];
  let allPeople = [], names = new Map(), visibleLimit = 10, toastTimer;

  function chrome() {
    document.body.insertAdjacentHTML("afterbegin",
      `<header class="top"><div class="bar"><a class="brand" href="index.html"><span class="mark">VDB</span><span><b>ভবানীপুর ডাটাবেজ</b><small>গ্রামের তথ্যভান্ডার</small></span></a>
      <a class="btn primary" href="add.html">+ নতুন ব্যক্তি</a></div>
      <nav class="tabs">${NAV.map(n => `<a href="${n[0]}" class="${n[1] === page ? "on" : ""}">${n[2]}</a>`).join("")}
      <span class="conn" id="conn"><i></i><span>সংযোগ হচ্ছে…</span></span></nav></header>`);
    document.body.insertAdjacentHTML("beforeend", '<footer>ভবানীপুর সমাজ কল্যাণ সংঘ <br/> Release - <a href="https://www.ndsql.top">www.ndsql.top</a></footer><div class="toast" id="toast" role="status"></div>');
  }
  function toast(m) {
    const el = $("toast"); el.textContent = m; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const val = v => (v === null || v === undefined || v === "" || v === 0) ? "" : String(v);
  function setConn(state, text) { $("conn").className = "conn " + state; $("conn").lastChild.textContent = text; }
  async function api(method = "GET", body = null) {
    const res = await fetch(API_URL, {
      method,
      headers: { "X-API-Key": API_KEY, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const raw = await res.text();
    let data; try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
    if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
    return data;
  }
  const getName = id => (id === null || id === undefined || id === "") ? "—" : (names.get(String(id)) || `আইডি ${id}`);
  const isGrandfather = p => Number(p.father_id) === 1 || Number(p.id) === 1;

  function card(p) {
    const mobile = val(p.mobile);
    return `<article class="card"><div class="av">${esc((p.name || "ত").trim().charAt(0) || "ত")}</div><div>
      <h3>${esc(p.name || "নাম দেওয়া হয়নি")}</h3>${p.title ? `<p class="sub">${esc(p.title)}</p>` : ""}
      <div class="line"><span>${esc(getName(p.grandfather_id))}</span><i>›</i><span>${esc(getName(p.father_id))}</span><i>›</i><b>${esc(p.name || "—")}</b></div>
      <div class="meta"><span>আইডি ${esc(p.id)}</span>${mobile ? `<span>মোবাইল ${esc(mobile)}</span>` : ""}${p.full_address ? `<span>${esc(p.full_address)}</span>` : ""}</div>
    </div></article>`;
  }

  function renderHome() {
    $("sTotal").textContent = allPeople.length;
    $("sRoots").textContent = allPeople.filter(isGrandfather).length;
    $("sMobile").textContent = allPeople.filter(p => val(p.mobile)).length;
    const recent = [...allPeople].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);
    $("recent").innerHTML = recent.length ? recent.map(card).join("") : '<div class="empty">এখনও কোনো তথ্য নেই।</div>';
  }
  function renderPeople() {
    const q = $("searchInput").value.trim().toLocaleLowerCase();
    const list = allPeople.filter(p => [p.name, p.mobile, p.title, p.full_address, p.id, getName(p.father_id), getName(p.grandfather_id)]
      .some(x => String(x ?? "").toLocaleLowerCase().includes(q)));
    $("resultCount").textContent = `${list.length} জনের তথ্য পাওয়া গেছে`;
    $("peopleList").innerHTML = list.length ? list.slice(0, visibleLimit).map(card).join("") : '<div class="empty">কোনো তথ্য পাওয়া যায়নি। বানান ঠিক করে আবার চেষ্টা করুন।</div>';
    $("moreBtn").hidden = list.length <= visibleLimit;
  }
  function renderGrandfathers() {
    const sel = $("grandfatherSelect"), cur = sel.value, roots = allPeople.filter(isGrandfather);
    sel.innerHTML = '<option value="">দাদার নাম নির্বাচন করুন</option>' +
      roots.map(p => `<option value="${esc(p.id)}">${esc(p.name || "নাম নেই")} (আইডি: ${esc(p.id)})</option>`).join("");
    if (roots.some(p => String(p.id) === cur)) sel.value = cur;
    updateFathers();
  }
  function updateFathers() {
    const gid = $("grandfatherSelect").value, fs = $("fatherSelect");
    fs.innerHTML = '<option value="">বাবার নাম নির্বাচন করুন</option>';
    fs.disabled = true;
    if (!gid) return;
    const fathers = allPeople.filter(p => String(p.father_id) === String(gid) && String(p.id) !== String(gid));
    fathers.forEach(p => fs.add(new Option(p.name || "নাম দেওয়া হয়নি", p.id)));
    fs.disabled = fathers.length === 0;
    if (!fathers.length) fs.innerHTML = '<option value="">এই দাদার কোনো ছেলের তথ্য নেই</option>';
  }
  function render() {
    if (page === "home") renderHome();
    if (page === "people") renderPeople();
    if (page === "add") renderGrandfathers();
  }
  async function loadPeople(showToast = false) {
    setConn("", "সংযোগ হচ্ছে…");
    try {
      const r = await api("GET");
      allPeople = Array.isArray(r) ? r : (Array.isArray(r.data) ? r.data : []);
      names = new Map(allPeople.map(p => [String(p.id), p.name]));
      setConn("ok", "সংযুক্ত");
      render();
      if (showToast) toast("তথ্য হালনাগাদ হয়েছে");
    } catch (e) {
      setConn("bad", "সংযোগ হয়নি");
      const box = $("recent") || $("peopleList");
      if (box) box.innerHTML = `<div class="empty">তথ্য আনা যায়নি। ${esc(e.message)}<br>ইন্টারনেট ও API key পরীক্ষা করুন।</div>`;
      if ($("resultCount")) $("resultCount").textContent = "তথ্য লোড করা যায়নি";
    }
  }
  function initPeople() {
    $("searchInput").value = new URLSearchParams(location.search).get("q") || "";
    $("searchInput").addEventListener("input", () => { visibleLimit = 10; renderPeople(); });
    $("refreshBtn").addEventListener("click", () => loadPeople(true));
    $("moreBtn").addEventListener("click", () => { visibleLimit += 10; renderPeople(); });
  }
  function initAdd() {
    $("grandfatherSelect").addEventListener("change", updateFathers);
    $("personForm").addEventListener("submit", async ev => {
      ev.preventDefault();
      const g = $("grandfatherSelect").value, f = $("fatherSelect").value;
      if (!g || !f) { toast("আগে দাদা এবং তারপর বাবা নির্বাচন করুন।"); return; }
      const payload = { name: $("personName").value.trim(), father_id: Number(f), grandfather_id: Number(g) };
      [["mobile", "mobile"], ["title", "title"], ["address", "full_address"]].forEach(([id, key]) => { const v = $(id).value.trim(); if (v) payload[key] = v; });
      const btn = $("submitBtn"), msg = $("formResponse");
      btn.disabled = true; btn.textContent = "জমা হচ্ছে…";
      msg.hidden = true;
      try {
        await api("POST", payload);
        msg.className = "msg ok"; msg.hidden = false;
        msg.innerHTML = 'তথ্য সফলভাবে জমা হয়েছে। <a href="people.html">তালিকায় দেখুন</a>';
        toast("তথ্য জমা হয়েছে");
        ["personName", "mobile", "title", "address"].forEach(id => $(id).value = "");
        await loadPeople();
      } catch (e) {
        msg.className = "msg err"; msg.hidden = false;
        msg.textContent = "তথ্য জমা হয়নি: " + e.message;
      } finally { btn.disabled = false; btn.textContent = "তথ্য জমা দিন"; }
    });
  }
  chrome();
  if (page === "people") initPeople();
  if (page === "add") initAdd();
  loadPeople();
})();
