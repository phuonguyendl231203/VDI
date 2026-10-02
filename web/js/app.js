(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const RN = APP_INFO.robotName;

  /* Icon nét mảnh (SVG) */
  const S = 'fill="none" stroke="#59D8FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  const ICO = {
    chat: `<svg viewBox="0 0 32 32" ${S}><path d="M5 8a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H13l-6 5v-5H8a3 3 0 0 1-3-3z"/><path d="M11 13h.01M16 13h.01M21 13h.01" stroke-width="3.4"/></svg>`,
    faq: `<svg viewBox="0 0 32 32" ${S}><circle cx="16" cy="16" r="12"/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3v.5"/><path d="M16 22.5h.01" stroke-width="3.4"/></svg>`,
    pin: `<svg viewBox="0 0 32 32" ${S}><path d="M16 29s-9-8.2-9-15a9 9 0 0 1 18 0c0 6.8-9 15-9 15z"/><circle cx="16" cy="14" r="3.4"/></svg>`,
    checkin: `<svg viewBox="0 0 32 32" ${S}><rect x="5" y="8" width="22" height="16" rx="3"/><path d="M5 14h22M10 19h6"/><path d="M20 3v6M12 3v6"/></svg>`,
    history: `<svg viewBox="0 0 32 32" ${S}><path d="M4 26c6-1 7-7 12-9s8-6 12-11"/><circle cx="6" cy="25" r="2"/><circle cx="16" cy="17" r="2"/><circle cx="26" cy="7" r="2"/></svg>`,
    game: `<svg viewBox="0 0 32 32" ${S}><path d="M9 10h14a6 6 0 0 1 5.8 7.5l-1.4 5.2a3 3 0 0 1-5.2 1.1L19.5 21h-7l-2.7 2.8a3 3 0 0 1-5.2-1.1l-1.4-5.2A6 6 0 0 1 9 10z"/><path d="M10 15v4M8 17h4M21 16h.01M24 18h.01" /></svg>`,
    heart: `<svg viewBox="0 0 32 32" ${S}><path d="M16 27S4 19.5 4 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 12 3.5C28 19.5 16 27 16 27z"/></svg>`,
    camera: `<svg viewBox="0 0 32 32" ${S}><path d="M4 11a3 3 0 0 1 3-3h3l2-3h8l2 3h3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><circle cx="16" cy="17" r="5"/></svg>`,
    gallery: `<svg viewBox="0 0 32 32" ${S}><rect x="4" y="6" width="24" height="20" rx="3"/><circle cx="11" cy="12" r="2.2"/><path d="M4 22l7-6 5 4 4-3 8 6"/></svg>`
  };

  /* ================= Chung ================= */
  $$("[data-ico]").forEach(el => (el.innerHTML = ICO[el.dataset.ico]));
  $$(".rname").forEach(el => (el.textContent = RN));
  document.body.classList.add("at-home");
  if (Nova.native) document.body.classList.add("native");
  else { const b = document.createElement("div"); b.className = "demo-badge"; b.textContent = "Bản demo trên trình duyệt"; document.body.appendChild(b); }

  const TITLES = { ai: ["Trò chuyện cùng " + RN, "Hỏi em bằng giọng nói"], faq: ["Hỏi đáp về VDI", FAQ.length + " câu hỏi · chạm để nghe trả lời"], nav: ["Dẫn đường", "Các khu vực sự kiện"] };
  const SCREEN_INFO = {
    home: "Màn hình chính của robot lễ tân sự kiện " + APP_INFO.event + ": Trò chuyện, Hỏi đáp về VDI, Dẫn đường.",
    ai: KB.aiContext(),
    faq: "Màn hỏi đáp: khách chạm chọn câu hỏi về VDI để robot đọc câu trả lời.",
    nav: "Màn dẫn đường tới các khu vực: " + NAV_POINTS.map(p => p.label).join(", ") + "."
  };

  let screen = "home";
  function go(name) {
    if (!$("#s-" + name) || name === screen) return;
    Nova.stopSpeak();
    $("#caption").classList.remove("on");
    $$(".screen").forEach(s => s.classList.toggle("on", s.id === "s-" + name));
    document.body.classList.toggle("at-home", name === "home");
    if (TITLES[name]) { $("#hdrTitle").textContent = TITLES[name][0]; $("#hdrSub").textContent = TITLES[name][1]; }
    screen = name;
    // Mic (AI giọng nói) CHỈ bật ở màn Trò chuyện; các màn khác khách thao tác bằng tay
    Nova.setMic(name === "ai");
    Nova.setScreen(name, SCREEN_INFO[name] || "");
    if (name === "ai") openAI();
    if (name === "faq") openFaq();
    if (name === "nav") openNav();
  }
  $$("[data-go]").forEach(b => b.addEventListener("click", () => { SFX.tap(); go(b.dataset.go); }));
  $("#btnHome").addEventListener("click", () => { SFX.tap(); go("home"); });

  function renderMute() { $("#btnMute").textContent = SFX.muted ? "🔇" : "🔊"; }
  $("#btnMute").addEventListener("click", () => { SFX.setMuted(!SFX.muted); renderMute(); SFX.tap(); });
  renderMute();
  document.addEventListener("pointerdown", () => SFX.unlock(), { once: true });

  let toastT;
  function toast(msg, ms = 3500) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms); }

  /* Phụ đề: câu robot đang nói / khách vừa nói (ở các màn không có khung chat) */
  let capT;
  function caption(who, text) {
    const c = $("#caption"); c.innerHTML = "<b>" + esc(who) + ":</b> " + esc(text) + (who === RN ? '<span class="x">Chạm để ngắt lời</span>' : ""); c.classList.add("on");
    clearTimeout(capT); capT = setTimeout(() => c.classList.remove("on"), Math.min(9000, 2500 + text.length * 45));
  }
  $("#caption").addEventListener("click", () => { Nova.stopSpeak(); $("#caption").classList.remove("on"); });

  /* Robot nói. Ghi lại câu đã tự nói để không hiện trùng khi AgentOS báo lại lời TTS. */
  const spokenLocal = [];
  function say(text, onEnd) {
    spokenLocal.push({ n: KB.norm(text), t: Date.now() });
    $(".listen") && $(".listen").classList.add("speaking");
    Nova.speak(text, () => { $(".listen").classList.remove("speaking"); onEnd && onEnd(); });
  }
  const isLocalEcho = text => { const n = KB.norm(text), now = Date.now(); return n && spokenLocal.some(s => now - s.t < 60000 && (s.n === n || s.n.includes(n) || n.includes(s.n))); };
  const sayFaq = f => say(f.speak || f.a);

  /* ================= TRÒ CHUYỆN AI ================= */
  const msgs = $("#msgs");
  function addMsg(who, html) {
    const d = document.createElement("div"); d.className = "msg " + who; d.innerHTML = html; msgs.appendChild(d);
    while (msgs.children.length > 40) msgs.removeChild(msgs.firstChild);
    msgs.scrollTop = msgs.scrollHeight; return d;
  }
  const botMsg = (text, src) => addMsg("bot", `<span class="who">${esc(RN)}</span>${esc(text)}${src ? `<span class="src">${esc(src)}</span>` : ""}`);

  function openAI() {
    msgs.innerHTML = "";              // mỗi lượt vào là một cuộc trò chuyện mới (AI cũng được xoá ngữ cảnh)
    const g = FAQ_SPECIAL.greet;
    botMsg(g.a + " Anh chị có thể hỏi em về lịch sử, ban lãnh đạo, văn hoá và các giải pháp công nghệ của VDI.");
    say(g.speak || g.a);
  }
  $("#chips").innerHTML = SUGGEST_NOS.map(n => KB.byNo(n)).filter(Boolean).map(f => `<button class="chip" data-no="${f.no}">${esc(f.q[0])}</button>`).join("");
  $$("#chips .chip").forEach(c => c.addEventListener("click", () => { SFX.tap(); const f = KB.byNo(c.dataset.no); addMsg("me", esc(f.q[0])); answerFaq(f); }));

  function answerFaq(f) {
    botMsg(f.a, "Theo nội dung Ban Tổ chức cung cấp");
    sayFaq(f);
  }

  /* Trả lời bằng so khớp Q&A ngay trong app: dùng cho gõ chữ, mic trình duyệt, và robot KHÔNG có AgentOS
     (Minibot). Robot có AgentOS thì AI của robot tự hiểu câu hỏi rồi gọi lệnh voice_faq. */
  const GREET_RE = /^(xin )?ch[aà]o|^hello|^hi\b|^alo/i;
  function ask(text, heard) {
    if (!heard) addMsg("me", esc(text));
    if (voiceCommand(text)) return;
    let f = KB.search(text);
    if (!f) {
      const words = KB.norm(text).split(" ").filter(Boolean);
      f = GREET_RE.test(text.trim()) && words.length <= 6 ? FAQ_SPECIAL.greet
        : (heard && words.length <= 2 ? FAQ_SPECIAL.unclear : FAQ_SPECIAL.unknown);
    }
    if (f === FAQ_SPECIAL.greet || f === FAQ_SPECIAL.unknown || f === FAQ_SPECIAL.unclear) { botMsg(f.a); sayFaq(f); } else answerFaq(f);
  }

  /* Lệnh nói tự nhận (khi không có AgentOS): "dẫn tôi đến mini game", "chỗ chụp hình ở đâu", "dừng lại" */
  const NAV_RE = / (dan|dua|chi duong|duong (den|toi|ra|vao)|di (den|toi|ra)|muon (den|toi|ra|di)|o dau|nam dau|cho nao) /;
  function voiceCommand(text) {
    const n = " " + KB.norm(text) + " ";
    if (nav.busy && / (dung|stop) /.test(n)) { stopAll(true); return true; }
    if (!NAV_RE.test(n)) return false;
    const names = p => [p.map, p.label].concat(p.alias || []).map(KB.norm).filter(x => !/^diem \d$/.test(x));
    const p = NAV_POINTS.find(x => names(x).some(k => n.includes(" " + k + " ")));
    if (!p) return false;
    NovaEvents.dispatch("voice_nav", { point: p.map });
    return true;
  }
  $("#composer").addEventListener("submit", e => { e.preventDefault(); const v = $("#askInput").value.trim(); if (v) { ask(v); $("#askInput").value = ""; $("#askInput").blur(); } });

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Nova.native) {
    if (!SR) $("#btnMic").addEventListener("click", () => toast("Trình duyệt này không hỗ trợ nhận giọng nói. Hãy gõ câu hỏi, hoặc dùng Chrome."));
    else {
      let rec = null;
      $("#btnMic").addEventListener("click", () => {
        if (rec) { rec.stop(); return; }
        rec = new SR(); rec.lang = "vi-VN"; rec.interimResults = false; rec.maxAlternatives = 1;
        $("#btnMic").classList.add("live");
        rec.onresult = e => { const t = e.results[0][0].transcript; if (t) ask(t); };
        rec.onerror = e => toast("Không nghe rõ (" + e.error + "). Anh chị thử lại nhé.");
        rec.onend = () => { $("#btnMic").classList.remove("live"); rec = null; };
        Nova.stopSpeak(); rec.start();
      });
    }
    $("#voiceHint").textContent = "Bản demo: bấm 🎤 (Chrome) hoặc gõ câu hỏi ở khung bên trái.";
  }

  // Lời thoại thật từ robot (AgentOS): khách nói (asr) và AI tự trả lời (tts)
  Nova.on("asr", d => {
    if (!d || !d.text) return;
    bump();
    if (!d.final) { if (screen === "ai") $("#listenTitle").textContent = "“" + d.text + "”"; return; }
    $("#listenTitle").textContent = "Em đang lắng nghe";
    if (Nova.mode === "legacy" && isLocalEcho(d.text)) return;      // mic nghe lại chính giọng robot
    if (screen === "ai") addMsg("me", "🎤 " + esc(d.text)); else caption("Anh chị", d.text);
    if (Nova.mode === "legacy" && screen === "ai") { Nova.stopSpeak(); ask(d.text, true); }
  });
  Nova.on("tts", d => {
    if (!d || d.local || !d.text || !d.final || isLocalEcho(d.text)) return;
    if (screen === "ai") botMsg(d.text);
    else caption(RN, d.text);
  });
  // AI của robot nhận ra câu hỏi khớp bộ Q&A -> app đọc NGUYÊN VĂN câu trả lời của Ban Tổ chức
  Nova.on("voice_faq", d => {
    bump();
    const f = KB.byNo(parseInt(String(d && d.no || "").replace(/\D+/g, ""), 10));
    if (!f) return;
    if (screen !== "ai" && screen !== "faq") go("ai");
    Nova.stopSpeak();
    if (screen === "faq") showAnswer(f); else answerFaq(f);
  });

  /* ================= HỎI ĐÁP VDI (chạm) ================= */
  let gi = 0, curNo = null;
  $("#gTabs").innerHTML = FAQ_GROUPS.map((g, i) => `<button class="gtab" data-g="${i}">${esc(g)}</button>`).join("");
  $$(".gtab").forEach(t => t.addEventListener("click", () => { SFX.tap(); gi = +t.dataset.g; renderQs(); }));
  function renderQs() {
    $$(".gtab").forEach((t, i) => t.classList.toggle("on", i === gi));
    const items = FAQ.filter(f => f.group === FAQ_GROUPS[gi]);
    $("#qList").innerHTML = items.map(f => `<button class="q${f.no === curNo ? " on" : ""}" data-no="${f.no}"><span class="n">${f.no}</span><span>${esc(f.q[0])}</span></button>`).join("");
    $$("#qList .q").forEach(b => b.addEventListener("click", () => { SFX.tap(); showAnswer(KB.byNo(b.dataset.no)); }));
    $("#qList").scrollTop = 0;
  }
  function showAnswer(f) {
    curNo = f.no;
    if (f.group && FAQ_GROUPS[gi] !== f.group) { gi = FAQ_GROUPS.indexOf(f.group); renderQs(); }
    $$("#qList .q").forEach(b => b.classList.toggle("on", +b.dataset.no === f.no));
    $("#answer").innerHTML = `<p class="aq">${esc(f.q[0])}</p><div class="aa">${esc(f.a)}</div><button class="tbtn again" id="btnAgain"><span>🔊</span><span>Nghe lại</span></button>`;
    $("#btnAgain").addEventListener("click", () => { SFX.tap(); sayFaq(f); });
    Nova.stopSpeak(); sayFaq(f);
  }
  function openFaq() {
    curNo = null; gi = 0; renderQs();
    $("#answer").innerHTML = `<div class="aempty"><img src="img/badge15.webp" alt=""><p>Chạm vào một câu hỏi bên cạnh,<br>robot sẽ trả lời anh chị.</p></div>`;
  }

  /* ================= DẪN ĐƯỜNG ================= */
  let mapPlaces = null;           // tên điểm có trên bản đồ robot (null = chưa đọc được)
  const nav = { busy: false, t: null };

  /* Tìm tên điểm THẬT trên bản đồ khớp với 1 khu vực (không phân biệt hoa thường / dấu, chấp nhận alias) */
  function resolve(p) {
    const names = [p.map].concat(p.alias || []).map(KB.norm);
    if (!mapPlaces) return Nova.native ? null : p.map;
    return mapPlaces.find(m => names.includes(KB.norm(m))) || null;
  }
  const available = p => !Nova.native || !mapPlaces ? true : !!resolve(p);

  function renderPoints() {
    $("#navPoints").innerHTML = NAV_POINTS.map((p, i) => `<button class="pt${available(p) ? "" : " missing"}" data-i="${i}">
      <span class="num">${i + 1}</span>
      <span class="top"><span class="ico">${ICO[p.icon] || ICO.pin}</span><span><b>${esc(p.label)}</b><small>${esc(p.desc || "")}</small></span></span>
      <span class="go">${available(p) ? "Dẫn tôi đi →" : "Chưa có trên bản đồ"}</span></button>`).join("");
    $$("#navPoints .pt").forEach(b => b.addEventListener("click", () => {
      SFX.tap(); const p = NAV_POINTS[+b.dataset.i];
      if (!available(p)) return toast("Bản đồ robot chưa có điểm “" + p.map + "”. Khi quét bản đồ, kỹ thuật cần đặt tên điểm như vậy.", 5000);
      navTo(p);
    }));
    const home = resolve(NAV_HOME);
    $("#navNote").textContent = Nova.native
      ? (mapPlaces ? "Bản đồ robot có " + mapPlaces.length + " điểm: " + mapPlaces.join(", ") + "." + (home ? " Dẫn xong robot tự về “" + home + "”." : "") : "Chưa đọc được bản đồ robot. Kiểm tra robot đã có bản đồ và đã định vị chưa.")
      : "Bản demo trên trình duyệt: robot di chuyển được mô phỏng.";
  }
  function openNav() { renderPoints(); Nova.places(list => { mapPlaces = list && list.length ? list : null; renderPoints(); }); }

  const ERR = { "-116": "Robot chưa được định vị trên bản đồ. Kỹ thuật cần định vị lại robot.", "-108": "Không tìm thấy điểm này trên bản đồ.", "-109": "Không tìm được đường đi tới điểm này, có thể lối đi đang bị chặn.", "-113": "Robot đang ở ngay điểm này rồi." };
  const ov = { on() { $("#navOverlay").classList.add("on"); }, off() { $("#navOverlay").classList.remove("on"); $("#ovRow").innerHTML = ""; $("#btnStop").style.display = ""; $("#ovWalk").style.display = ""; } };
  function ovSet(big, small, st) { $("#ovBig").textContent = big; $("#ovSmall").textContent = small || ""; $("#ovStatus").textContent = st || ""; }
  function ovButtons(btns) {
    $("#btnStop").style.display = "none"; $("#ovWalk").style.display = "none";
    $("#ovRow").innerHTML = btns.map((b, i) => `<button class="bigbtn${i === 0 ? " pri" : ""}" data-i="${i}">${esc(b[0])}</button>`).join("");
    $$("#ovRow button").forEach(el => el.addEventListener("click", () => { SFX.tap(); btns[+el.dataset.i][1](); }));
  }

  function navTo(p) {
    stopAll(false);
    const target = resolve(p) || p.map;
    nav.busy = true; ov.on(); $("#ovRow").innerHTML = "";
    ovSet("Mời anh chị đi theo em", "Đang dẫn đường tới " + p.label, "");
    say("Mời anh chị đi theo em đến " + p.label + ".");
    Nova.light("blue");
    Nova.navigate(target, {
      status: m => $("#ovStatus").textContent = m || "",
      arrive: () => arrived(p),
      fail: (code, msg) => {
        if (String(code) === "-113") return arrived(p);
        nav.busy = false;
        ovSet("Chưa thể dẫn đường", ERR[String(code)] || ("Lỗi dẫn đường (mã " + code + ")" + (msg ? ": " + msg : "")), "");
        say("Xin lỗi anh chị, em chưa thể dẫn đường tới " + p.label + ".");
        ovButtons([["Thử lại", () => navTo(p)], ["Đóng", () => ov.off()]]);
      }
    });
  }
  function arrived(p) {
    nav.busy = false; SFX.arrive(); Nova.light("green");
    ovSet("Đã đến " + p.label, p.say || "", "");
    say(p.say || ("Chúng ta đã đến " + p.label + "."));
    const home = Nova.native ? resolve(NAV_HOME) : NAV_HOME.map;
    if (home) {
      ovButtons([["Robot về vị trí chờ", goHome], ["Ở lại đây", () => { clearTimeout(nav.t); ov.off(); }]]);
      $("#ovStatus").textContent = "Robot sẽ tự quay về sau 15 giây";
      nav.t = setTimeout(goHome, 15000);
    } else ovButtons([["Đóng", () => ov.off()]]);
  }
  function goHome() {
    clearTimeout(nav.t);
    const home = Nova.native ? resolve(NAV_HOME) : NAV_HOME.map;
    if (!home) return ov.off();
    nav.busy = true;
    $("#ovRow").innerHTML = ""; $("#btnStop").style.display = ""; $("#ovWalk").style.display = "";
    ovSet("Robot đang quay về", home, "");
    Nova.navigate(home, { status: m => $("#ovStatus").textContent = m || "", arrive: () => { nav.busy = false; ov.off(); }, fail: () => { nav.busy = false; ov.off(); } });
  }
  function stopAll(speak) {
    clearTimeout(nav.t);
    const was = nav.busy;
    nav.busy = false;
    Nova.stopNav();
    if (speak && was) { Nova.stopSpeak(); say("Em đã dừng lại."); }
    ov.off();
  }
  $("#btnStop").addEventListener("click", () => { SFX.tap(); stopAll(true); });

  Nova.on("voice_open", d => { bump(); if (d && d.screen && !nav.busy) { ov.off(); go(d.screen); } });
  Nova.on("voice_nav", d => {
    bump(); const want = KB.norm(d && d.point);
    const names = p => [p.map, p.label].concat(p.alias || []).map(KB.norm);
    const p = NAV_POINTS.find(x => names(x).includes(want)) || NAV_POINTS.find(x => want && names(x).some(n => n.includes(want) || want.includes(n)));
    if (!p) return say("Em chưa tìm thấy khu vực này. Các khu vực gồm: " + NAV_POINTS.map(x => x.label).join(", ") + ".");
    if (screen !== "nav") go("nav");
    if (!available(p)) return say(p.label + " chưa có trên bản đồ của robot, em chưa thể dẫn đường tới đó.");
    confirmMove("Dẫn anh chị đến " + p.label + "?", () => navTo(p));
  });

  /* Lệnh DI CHUYỂN bằng giọng nói phải bấm xác nhận trên màn hình: nơi đông người, AI có thể
     nghe nhầm tiếng ồn thành lệnh -> tránh robot tự đi. Không bấm trong 10 giây thì tự huỷ. */
  function confirmMove(question, onYes) {
    if (nav.busy) return;
    ov.on(); ovSet(question, "Anh chị chạm “Đồng ý” để robot bắt đầu di chuyển", "Tự huỷ sau 10 giây");
    say(question + " Anh chị chạm Đồng ý trên màn hình nhé.");
    const t = setTimeout(() => ov.off(), 10000);
    ovButtons([["Đồng ý", () => { clearTimeout(t); onYes(); }], ["Huỷ", () => { clearTimeout(t); ov.off(); }]]);
  }
  Nova.on("voice_stop", () => { bump(); stopAll(true); });

  /* ================= Tự về trang chủ khi không ai dùng (90 giây) ================= */
  let last = Date.now();
  function bump() { last = Date.now(); }
  ["pointerdown", "keydown"].forEach(e => document.addEventListener(e, bump, true));
  setInterval(() => {
    if (screen !== "home" && !nav.busy && !$("#navOverlay").classList.contains("on") && Date.now() - last > 90000) go("home");
  }, 5000);

  Nova.setMic(false);   // mở app ở trang chủ: tắt mic
  Nova.setScreen("home", SCREEN_INFO.home);
  /* Mở thẳng 1 màn qua địa chỉ, VD index.html#faq (tiện kiểm thử) */
  if (location.hash.length > 1) go(location.hash.slice(1));
})();
