/* Lớp kết nối giao diện <-> robot.
 * - Chạy trong app Android trên robot OrionStar (Nova / Minibot): gọi window.NovaNative (Kotlin @JavascriptInterface),
 *   robot trả kết quả về qua window.NovaEvents.dispatch(type, json).
 * - Chạy trên trình duyệt (bản demo): tự MÔ PHỎNG giọng nói / dẫn đường để xem luồng. */
(function () {
  const N = window.NovaNative || null;
  let seq = 1;
  const waiters = {};      // id -> callback
  const listeners = {};    // type -> [fn]

  window.NovaEvents = {
    dispatch(type, data) {
      let d = data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { d = { raw: data }; } }
      if (d && d.id && waiters[d.id]) {
        const w = waiters[d.id];
        if (type === "tts_end" || type === "places" || (type === "nav" && (d.kind === "arrive" || d.kind === "fail"))) delete waiters[d.id];
        try { w(type, d); } catch (e) { console.error(e); }
      }
      (listeners[type] || []).forEach(fn => { try { fn(d); } catch (e) { console.error(e); } });
    }
  };

  /* ---------- Mô phỏng trên trình duyệt ---------- */
  let viVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    const vs = speechSynthesis.getVoices();
    viVoice = vs.find(v => /^vi/i.test(v.lang)) || null;
    return viVoice;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  const simNav = { timer: null, id: 0 };
  let navId = null;

  window.Nova = {
    native: !!N,
    /* "agent" = robot có AgentOS (AI hiểu câu hỏi) · "legacy" = RobotOS cũ như Minibot (app tự so khớp Q&A) · "browser" */
    mode: N ? (N.mode ? N.mode() : "agent") : "browser",

    on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },

    /* Robot nói. onEnd gọi khi nói xong (hoặc bị ngắt). */
    speak(text, onEnd) {
      if (!text) { onEnd && onEnd(); return; }
      window.NovaEvents.dispatch("tts", { text, final: true, local: true });
      if (N) {
        const id = "t" + seq++;
        if (onEnd) waiters[id] = () => onEnd();
        N.speak(id, text);
        return;
      }
      if (viVoice && "speechSynthesis" in window) {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.voice = viVoice; u.lang = viVoice.lang; u.rate = 1.02;
        u.onend = u.onerror = () => onEnd && onEnd();
        speechSynthesis.speak(u);
      } else {
        // Máy không có giọng tiếng Việt: chỉ hiện phụ đề, ước lượng thời gian đọc
        setTimeout(() => onEnd && onEnd(), Math.min(9000, 900 + text.length * 55));
      }
    },
    stopSpeak() {
      if (N) N.stopSpeak();
      else if ("speechSynthesis" in window) speechSynthesis.cancel();
    },

    /* Đèn LED: "green" | "red" | "blue" */
    light(color) { if (N) N.light(color); },

    /* Danh sách điểm đã đặt trên bản đồ robot -> cb([tên...]) (null = không đọc được) */
    places(cb) {
      if (N) {
        const id = "p" + seq++;
        waiters[id] = (t, d) => cb(Array.isArray(d.list) ? d.list : null);
        N.getPlaces(id);
        setTimeout(() => { if (waiters[id]) { delete waiters[id]; cb(null); } }, 6000);
      } else {
        setTimeout(() => cb(window.NAV_POINTS.map(p => p.map).concat([window.NAV_HOME.map])), 150);
      }
    },

    /* Dẫn đường tới điểm "name". h = {status(msg), arrive(), fail(code,msg)} */
    navigate(name, h) {
      if (N) {
        const id = "n" + seq++;
        if (navId) delete waiters[navId];
        navId = id;
        waiters[id] = (t, d) => {
          if (d.kind === "arrive") h.arrive && h.arrive();
          else if (d.kind === "fail") h.fail && h.fail(d.code, d.msg);
          else h.status && h.status(d.msg, d.code);
        };
        N.navigate(id, name);
        return id;
      }
      // Mô phỏng: 6 giây, giữa chừng giả lập gặp vật cản
      clearTimeout(simNav.timer);
      const my = ++simNav.id;
      h.status && h.status("Đang di chuyển (mô phỏng trên trình duyệt)");
      simNav.timer = setTimeout(() => {
        if (my !== simNav.id) return;
        h.status && h.status("Phía trước có người, robot đang tránh…");
        simNav.timer = setTimeout(() => { if (my === simNav.id) h.arrive && h.arrive(); }, 3000);
      }, 3000);
      return "sim" + my;
    },
    stopNav() {
      if (navId) { delete waiters[navId]; navId = null; }   // bỏ qua kết quả của lượt đi đã huỷ
      if (N) N.stopNav();
      clearTimeout(simNav.timer); simNav.id++;
    },

    /* Báo cho AI của robot biết đang ở màn nào + nội dung màn hình */
    setScreen(name, info) { if (N) N.setScreen(name, info || ""); },

    /* Bật/tắt micro của robot (AI chỉ nghe khi đang ở màn Hỏi đáp AI) */
    setMic(on) { if (N && N.setMic) N.setMic(!!on); },

    /* Thoát về màn hình chính của robot */
    exitApp() { if (N) N.exitApp(); }
  };
})();
