/* Kho Q&A:
 *  - KB.byNo(n): lấy câu theo số TT trong file Excel
 *  - KB.search(text): tìm câu gần nghĩa nhất (dùng khi gõ chữ / mic trình duyệt; trên robot AI tự chọn)
 *  - KB.aiContext(): toàn bộ Q&A kèm số TT, gửi cho AI của robot (AgentOS) */
(function () {
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  /* Đồng nghĩa (áp cho cả câu hỏi trong bộ Q&A lẫn câu khách nói). Máy nghe hay ra "vê đê i" thay vì "VDI". */
  const SYN = [
    [/\b(ve de i|vi di ai|vi di i|v d i|vi de i|vdy|vd i)\b/g, "vdi"],
    [/\bcong ty\b/g, "vdi"],
    [/\bnhan vien\b/g, "nhan su"]
  ];
  const canon = s => SYN.reduce((t, [re, to]) => t.replace(re, to), norm(s));
  const STOP = new Set("la gi cua the nao nhu khi co va cac duoc phai cho o de trong anh chi ban hay toi thi ma mot sau day nay nao bao nhieu voi ve tai tu den ra vao lam can khong ai cai viec minh em oi robot nova sao hoi xin vui long cho biet nhe a vay".split(" "));
  const WEAK = new Set("la gi cua co va cac nao ai khong thi ma o".split(" "));
  const toks = s => canon(s).split(" ").filter(w => w.length > 1 && !STOP.has(w) || /^\d+$/.test(w));

  const all = FAQ.concat(Object.values(FAQ_SPECIAL || {}));
  const byNo = n => all.find(x => x.no === +n) || null;

  const docs = FAQ.map(f => {
    const qtext = f.q.join(" ") + " " + (f.keys || "");
    return { f, qset: new Set(toks(qtext)), tset: new Set(toks(qtext + " " + f.a)), qn: canon(qtext), alts: f.q.map(canon) };
  });
  const df = {};
  docs.forEach(d => d.tset.forEach(t => (df[t] = (df[t] || 0) + 1)));
  const idf = t => Math.log(1 + docs.length / (df[t] || 0.5));

  function search(text) {
    const qt = [...new Set(toks(text))];
    if (!qt.length) return null;
    const nq = canon(text), words = nq.split(" ");
    // Chỉ còn 1 từ có nghĩa mà từ đó xuất hiện ở nhiều câu (VD "em tên là gì" -> "ten") thì không đoán bừa,
    // trừ khi khách nói trùng nguyên văn 1 cách hỏi trong file (VD "VDI là gì").
    const pairs = [];
    for (let i = 0; i + 1 < words.length; i++) if (!WEAK.has(words[i]) && !WEAK.has(words[i + 1]) && (!STOP.has(words[i]) || !STOP.has(words[i + 1]))) pairs.push(words[i] + " " + words[i + 1]);
    if (qt.length === 1 && (df[qt[0]] || 0) >= 3 && !docs.some(d => d.alts.includes(nq) || pairs.some(p => (" " + d.qn + " ").includes(" " + p + " ")))) return null;
    let best = null, bestS = 0;
    docs.forEach(d => {
      let s = 0, hit = 0;
      qt.forEach(t => { if (d.qset.has(t)) { s += idf(t) * 1.6; hit++; } else if (d.tset.has(t)) { s += idf(t) * 0.6; hit++; } });
      // Phải khớp ít nhất một nửa số từ có nghĩa của câu khách hỏi (chặn kiểu "thời tiết hôm nay" khớp nhầm "hôm nay")
      if (hit / qt.length < 0.5) return;
      for (let i = 0; i + 1 < words.length; i++) if (d.qn.includes(words[i] + " " + words[i + 1])) s += 1.5;
      if (d.alts.includes(nq)) s += 20;
      if (s > bestS) { bestS = s; best = d.f; }
    });
    return bestS >= 3.5 ? best : null;
  }

  function aiContext() {
    const out = [
      "BỘ HỎI ĐÁP SỰ KIỆN SINH NHẬT 15 NĂM VDI. Chỉ trả lời dựa trên nội dung này, KHÔNG tự bịa thêm.",
      "Khi câu khách hỏi khớp nghĩa với một câu dưới đây (kể cả hỏi khác chữ, hoặc chỉ nhắc tên một người), hãy gọi lệnh \"Trả lời câu hỏi về VDI\" với đúng số TT.",
      "Câu hỏi ngoài nội dung thì nói: \"" + FAQ_SPECIAL.unknown.a + "\"",
      "Không nghe rõ câu hỏi thì nói: \"" + FAQ_SPECIAL.unclear.a + "\"",
      "Khách chào thì đáp: \"" + FAQ_SPECIAL.greet.a + "\""
    ];
    FAQ.forEach(f => out.push("TT " + f.no + ". Hỏi: " + f.q.join(" / ") + " — Đáp: " + f.a.replace(/\n/g, "; ")));
    return out.join("\n");
  }

  window.KB = { byNo, search, aiContext, norm };
})();
