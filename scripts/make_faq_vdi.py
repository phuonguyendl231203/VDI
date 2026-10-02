# -*- coding: utf-8 -*-
"""Sinh js/faq.js cho app robot VDI 15 năm từ file Excel Q&A của khách.

Chạy lại mỗi khi khách sửa file Excel:
    python make_faq_vdi.py ["C:/Users/Admin/Downloads/code robot AI.xlsx"]

Cấu trúc Excel (sheet đầu tiên): cột B = TT, C = Câu hỏi/các câu hỏi tương đương (ngăn bằng "/"),
D = Câu trả lời, E = Yêu cầu. Câu 1 (chào), 40 (ngoài nội dung), 41 (chưa nghe rõ) là câu đặc biệt.
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Admin\Downloads\code robot AI.xlsx")
_ROOT = Path(__file__).resolve().parent.parent
# Workspace Roboworld: website-nova-vdi-15nam/ · Repo GitHub: web/
OUT = next((d for d in (_ROOT / "website-nova-vdi-15nam", _ROOT / "web") if d.exists()), _ROOT / "web") / "js" / "faq.js"

# Nhóm câu hỏi hiện ở màn "Hỏi đáp về VDI". Câu mới thêm vào Excel mà chưa xếp nhóm -> vào nhóm cuối.
GROUPS = [
    ("Về VDI", [2, 3, 4, 9, 28, 29, 35]),
    ("Lịch sử hình thành", [5, 6, 7, 8, 27]),
    ("Ban lãnh đạo", list(range(11, 25))),
    ("Vietlott SMS", [25, 26, 33]),
    ("Con số & đối tác", [10, 30, 31, 36, 37]),
    ("Sinh nhật 15 năm", [32, 34, 38, 39]),
]
SPECIAL = {1: "greet", 40: "unknown", 41: "unclear"}

# Từ khoá phụ CHỈ dùng để so khớp câu khách nói (không hiện ra màn hình): tên người nằm trong câu trả lời,
# cách hỏi khác thường gặp.
KEYS = {
    6: "năm thành lập",
    10: "nhân viên",
    13: "anh Lộc Hoàng Anh Lộc",
    15: "anh Dũng Nguyễn Anh Dũng",
    23: "Hà Ngọc Đức Đinh Tuấn Phong",
    24: "chị Nhung Tạ Thị Hồng Nhung",
    33: "thành tích kết quả",
}

# Chỉ đổi cách ROBOT ĐỌC (TTS), chữ hiện trên màn hình giữ nguyên văn file khách.
SPEAK_FIX = [
    (r"(?:ngày\s+)?\b(\d{1,2})/(\d{1,2})/(\d{4})\b", r"ngày \1 tháng \2 năm \3"),
    (r"(?i)iphone\s*18\s*pro\s*max|iphone18 promax", "iPhone 18 Pro Max"),
    (r"info@vdigital\.vn", "info a còng v digital chấm v n"),
    (r"([.!?])\s*\n\s*", r"\1 "),
    (r"\s*\n\s*", ", "),
]


def clean(s):
    return re.sub(r"[ \t]+", " ", str(s or "")).strip()


def main():
    ws = openpyxl.load_workbook(SRC, data_only=True).worksheets[0]
    rows = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        no, q, a = r[1], r[2], r[3]
        if not isinstance(no, (int, float)) or not q or not a:
            continue
        no = int(no)
        alts = [clean(x) for x in re.split(r"/|\n\s*(?:Hoặc\s+)?", str(q)) if clean(x)]
        ans = "\n".join(clean(x) for x in str(a).split("\n") if clean(x))
        sp = ans
        for pat, rep in SPEAK_FIX:
            sp = re.sub(pat, rep, sp)
        item = {"no": no, "q": alts, "a": ans}
        if sp != ans:
            item["speak"] = sp
        if r[4]:
            item["note"] = clean(r[4])
        if no in KEYS:
            item["keys"] = KEYS[no]
        rows[no] = item

    grouped = {n for _, ns in GROUPS for n in ns}
    groups = [{"name": g, "items": [n for n in ns if n in rows]} for g, ns in GROUPS]
    rest = [n for n in sorted(rows) if n not in grouped and n not in SPECIAL]
    if rest:
        groups[-1]["items"] += rest
    for g in groups:
        for n in g["items"]:
            rows[n]["group"] = g["name"]

    faq = [rows[n] for g in groups for n in g["items"]]
    special = {key: rows[n] for n, key in SPECIAL.items() if n in rows}

    js = (
        "/* TỰ SINH bằng scripts/make_faq_vdi.py từ file Excel của khách. ĐỪNG sửa tay —\n"
        " * sửa file Excel rồi chạy lại script. Nguồn: " + SRC.name + " */\n"
        "window.FAQ = " + json.dumps(faq, ensure_ascii=False, indent=1) + ";\n"
        "window.FAQ_GROUPS = " + json.dumps([g["name"] for g in groups], ensure_ascii=False) + ";\n"
        "window.FAQ_SPECIAL = " + json.dumps(special, ensure_ascii=False, indent=1) + ";\n"
    )
    OUT.write_text(js, encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"{OUT} — {len(faq)} câu hỏi, {len(groups)} nhóm, câu đặc biệt: {sorted(special)}")
    if rest:
        print("Câu chưa xếp nhóm (đã đưa vào nhóm cuối):", rest)


if __name__ == "__main__":
    main()
