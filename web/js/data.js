/* Cấu hình app robot lễ tân — Sinh nhật 15 năm VDI.
 * Câu hỏi/câu trả lời KHÔNG sửa ở đây: nằm trong js/faq.js (tự sinh từ file Excel của khách
 * bằng scripts/make_faq_vdi.py). File này chỉ chứa: thông tin sự kiện, câu gợi ý, điểm dẫn đường. */

window.APP_INFO = {
  robotName: "Nova",
  event: "Sinh nhật 15 năm VDI",
  slogan: "15 năm đồng hành · Chạm mốc vươn xa",
  sloganEn: "Together · Further than ever",
  company: "Công ty Cổ phần Đầu tư Kỹ thuật số Việt"
};

/* Câu gợi ý ở màn Trò chuyện (chạm vào là robot đọc đúng câu trả lời trong file Q&A).
 * Ghi số TT của câu trong file Excel. */
window.SUGGEST_NOS = [3, 6, 9, 15, 29, 33, 34, 39];

/* Dẫn đường.
 * map   : tên điểm đặt trên bản đồ robot. App so khớp KHÔNG phân biệt hoa/thường, có dấu/không dấu,
 *         và chấp nhận cả các tên trong alias — nên khi quét bản đồ chỉ cần đặt 1 trong các tên này.
 * label : chữ hiện trên nút
 * say   : câu robot nói khi tới nơi */
window.NAV_POINTS = [
  { map: "Check in", alias: ["Khu vực check in", "Checkin", "Điểm 1"], icon: "checkin",
    label: "Khu vực Check-in", desc: "Đón tiếp & check-in khách mời",
    say: "Đây là khu vực check-in. Anh chị vui lòng check-in để nhận thông tin chương trình nhé!" },
  { map: "Con đường lịch sử", alias: ["Lịch sử", "Điểm 2"], icon: "history",
    label: "Con đường lịch sử", desc: "Hành trình 15 năm của VDI",
    say: "Chúng ta đã đến Con đường lịch sử. Mời anh chị cùng nhìn lại hành trình mười lăm năm đồng hành, chạm mốc vươn xa của VDI." },
  { map: "Mini game", alias: ["Minigame", "Trò chơi", "Điểm 3"], icon: "game",
    label: "Mini game", desc: "Trò chơi & quà tặng",
    say: "Đây là khu vực Mini game. Chúc anh chị chơi thật vui và rinh thật nhiều quà nhé!" },
  { map: "Trao gửi yêu thương", alias: ["Lời chúc", "Điểm 4"], icon: "heart",
    label: "Trao gửi yêu thương", desc: "Gửi lời chúc đến VDI",
    say: "Đây là khu vực Trao gửi yêu thương. Anh chị hãy để lại lời chúc gửi đến VDI nhân dịp sinh nhật mười lăm năm nhé!" },
  { map: "Backdrop chụp hình", alias: ["Backdrop", "Chụp hình", "Chụp ảnh", "Điểm 5"], icon: "camera",
    label: "Backdrop chụp hình", desc: "Lưu khoảnh khắc cùng VDI",
    say: "Đây là backdrop chụp hình. Mời anh chị lưu lại những khoảnh khắc thật đẹp cùng VDI!" },
  { map: "Triển lãm ảnh", alias: ["Triển lãm", "Điểm 6"], icon: "gallery",
    label: "Triển lãm ảnh", desc: "Khoảnh khắc 15 năm",
    say: "Chúng ta đã đến khu Triển lãm ảnh. Mời anh chị cùng xem lại những khoảnh khắc đáng nhớ của VDI trong mười lăm năm qua." }
];

/* Điểm robot tự quay về sau khi dẫn đường xong (không bắt buộc). Bản đồ không có điểm này
 * thì robot đứng lại tại điểm vừa dẫn tới. */
window.NAV_HOME = { map: "Vị trí chờ", alias: ["Vị trí chờ", "Điểm chờ", "Home", "Điểm 0"] };
