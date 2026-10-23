(() => {
  "use strict";
  // Demo only: never publish a privileged API key in frontend code.
  const API_URL = "https://ndsql.top/api/vdb/users";
  const API_KEY = "nd_f94ad03853212365940dff43734c8a6f12388bd2";
  const PAGE_SIZE = 100; // NdSQL docs: limit সর্বোচ্চ 100 (ডিফল্ট 50)
  const $ = id => document.getElementById(id);
  const page = document.body.dataset.page;
  const NAV = [["index.html", "home", "হোম"], ["people.html", "people", "তথ্য তালিকা"], ["add.html", "add", "নতুন ব্যক্তি"]];
  let allPeople = [], names = new Map(), visibleLimit = 10, toastTimer, gfCombo = null;

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

  async function api(method = "GET", body = null, query = "") {
    const res = await fetch(API_URL + query, {
      method,
      headers: { "X-API-Key": API_KEY, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const raw = await res.text();
    let data; try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
    if (!res.ok) {
      const e = data.error;
      throw new Error((e && e.message) || data.message || (typeof e === "string" ? e : "") || `HTTP ${res.status}`);
    }
    return data;
  }

  const rowsOf = r => Array.isArray(r) ? r : (Array.isArray(r.data) ? r.data : []);

  // সব পেজ এনে একসাথে করে (প্রতি পেজে ১০০ জন)
  async function fetchAllPeople() {
    const first = await api("GET", null, `?limit=${PAGE_SIZE}&p=1&order=id`);
    let all = rowsOf(first);
    const pages = Number(first.meta && first.meta.pages) || 1;
    if (pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) => api("GET", null, `?limit=${PAGE_SIZE}&p=${i + 2}&order=id`))
      );
      rest.forEach(r => { all = all.concat(rowsOf(r)); });
    }
    // ডুপ্লিকেট এড়াতে id দিয়ে ইউনিক করা
    const map = new Map();
    all.forEach(p => map.set(String(p.id), p));
    return [...map.values()];
  }

  const getName = id => (id === null || id === undefined || id === "") ? "—" : (names.get(String(id)) || `আইডি ${id}`);
  const isGrandfather = p => Number(p.father_id) === 1 || Number(p.id) === 1;

  /* ---------- Searchable input + dropdown (select-এর বদলে) ---------- */
  function injectComboStyle() {
    if (document.getElementById("cbxStyle")) return;
    const st = document.createElement("style");
    st.id = "cbxStyle";
    st.textContent = `
      .cbx{position:relative;width:100%}
      .cbx input{width:100%;box-sizing:border-box}
      .cbx-list{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:50;max-height:240px;overflow-y:auto;
        background:#fff;color:#111;border:1px solid #d0d5dd;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:4px}
      .cbx-list[hidden]{display:none}
      .cbx-item{padding:9px 12px;border-radius:8px;cursor:pointer;font-size:15px}
      .cbx-item small{opacity:.6;margin-left:6px}
      .cbx-item:hover,.cbx-item.act{background:#eef2ff}
      .cbx-empty{padding:10px 12px;opacity:.6;font-size:14px}`;
    document.head.appendChild(st);
  }

  function makeCombo(sel, placeholder) {
    injectComboStyle();
    sel.style.display = "none";
    sel.required = false; // লুকানো select-এ required থাকলে ফর্ম আটকে যায়; জমা দেওয়ার সময় আমরা নিজেই চেক করি

    const wrap = document.createElement("div");
    wrap.className = "cbx";
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = placeholder;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    const list = document.createElement("div");
    list.className = "cbx-list";
    list.hidden = true;
    wrap.append(input, list);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);

    let items = [], shown = [], active = -1;

    const open = () => { list.hidden = false; input.setAttribute("aria-expanded", "true"); };
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };

    function highlight() {
      [...list.querySelectorAll(".cbx-item")].forEach((el, i) => el.classList.toggle("act", i === active));
      const el = list.querySelectorAll(".cbx-item")[active];
      if (el) el.scrollIntoView({ block: "nearest" });
    }

    function renderList(filter) {
      const q = (filter || "").trim().toLocaleLowerCase();
      shown = items.filter(it => !q || it.label.toLocaleLowerCase().includes(q) || String(it.value).includes(q));
      active = shown.length ? 0 : -1;
      list.innerHTML = shown.length
        ? shown.map((it, i) => `<div class="cbx-item" data-i="${i}">${esc(it.label)}<small>আইডি: ${esc(it.value)}</small></div>`).join("")
        : '<div class="cbx-empty">কোনো নাম পাওয়া যায়নি</div>';
      highlight();
      open();
    }

    function pick(it) {
      sel.value = String(it.value);
      input.value = it.label;
      close();
      sel.dispatchEvent(new Event("change"));
    }

    input.addEventListener("focus", () => renderList(sel.value ? "" : input.value));
    input.addEventListener("click", () => { if (list.hidden) renderList(sel.value ? "" : input.value); });
    input.addEventListener("input", () => {
      if (sel.value) { sel.value = ""; sel.dispatchEvent(new Event("change")); } // টাইপ বদলালে আগের সিলেকশন বাতিল
      renderList(input.value);
    });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) renderList(input.value); else { active = Math.min(active + 1, shown.length - 1); highlight(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); highlight(); }
      else if (e.key === "Enter") { if (!list.hidden && shown[active]) { e.preventDefault(); pick(shown[active]); } }
      else if (e.key === "Escape") { close(); }
    });
    // mousedown ব্যবহার করা হয়েছে যাতে input-এর blur আগে না ঘটে
    list.addEventListener("mousedown", e => {
      const el = e.target.closest(".cbx-item");
      if (!el) return;
      e.preventDefault();
      pick(shown[Number(el.dataset.i)]);
    });
    document.addEventListener("mousedown", e => { if (!wrap.contains(e.target)) close(); });
    input.addEventListener("blur", () => {
      // ঠিক নামটা লিখে ফেললে স্বয়ংক্রিয়ভাবে সিলেক্ট হবে
      if (!sel.value) {
        const t = input.value.trim().toLocaleLowerCase();
        const exact = t && items.filter(it => it.name.toLocaleLowerCase() === t);
        if (exact && exact.length === 1) pick(exact[0]);
      }
      setTimeout(close, 0);
    });

    return {
      setItems(newItems) {
        items = newItems;
        sel.innerHTML = '<option value=""></option>' + items.map(it => `<option value="${esc(it.value)}">${esc(it.label)}</option>`).join("");
        const cur = items.find(it => String(it.value) === sel.dataset.keep);
        if (cur) { sel.value = String(cur.value); input.value = cur.name; }
        else { sel.value = ""; }
      },
      remember() { sel.dataset.keep = sel.value; },
      clear() { sel.value = ""; input.value = ""; sel.dataset.keep = ""; }
    };
  }

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
    gfCombo.remember(); // রিফ্রেশের সময়ও বর্তমান সিলেকশন ধরে রাখা
    gfCombo.setItems(allPeople.map(p => ({
      value: p.id,
      name: p.name || "নাম নেই",
      label: p.name || "নাম নেই"
    })));
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
      allPeople = await fetchAllPeople();
      names = new Map(allPeople.map(p => [String(p.id), p.name]));
      setConn("ok", `সংযুক্ত · ${allPeople.length} জন`);
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
    gfCombo = makeCombo($("grandfatherSelect"), "দাদার নাম লিখুন বা তালিকা থেকে বাছুন");
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