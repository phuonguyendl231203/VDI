# VDI 15 năm — App robot lễ tân (Nova / Minibot OrionStar)

Phát triển bởi **Roboworld** cho sự kiện Sinh nhật 15 năm VDI.

## Cấu trúc repo

```
android/   Project Android (Kotlin) — WebView + cầu nối robot (NovaNative), AgentOS / SkillApi
web/       Toàn bộ giao diện + logic (HTML/CSS/JS). Mở web/index.html bằng Chrome để xem bản demo
scripts/   make_faq_vdi.py — sinh web/js/faq.js từ file Excel Q&A
```

Build: `cd android` rồi `gradle assembleDebug` (Gradle ≥ 9.5, JDK = JBR của Android Studio).
**Trước khi build** phải chép SDK OrionStar vào `android/app/libs/` (xem `android/app/libs/README.md`) — SDK là gói hãng gửi riêng nên không có trong repo.
Gradle tự chép `web/` vào `android/app/src/main/assets/web` mỗi lần build.

---


Khách hàng: **VDI (Công ty Cổ phần Đầu tư Kỹ thuật số Việt)**, sự kiện "15 năm đồng hành · Chạm mốc vươn xa".
Chạy trên **Nova** (bản chính) và **Minibot OS-R-SD03** (bản test), cùng 1 file APK.

## 1. App có gì

| Mục | Chức năng |
|---|---|
| Trang chủ | Ảnh key visual 15 năm của khách + 3 nút lớn |
| Trò chuyện | Khách hỏi bằng giọng nói. Robot đọc **nguyên văn** câu trả lời trong file Q&A của khách. Câu ngoài nội dung: đọc câu số 40 ("Thông tin này em chưa có ạ…"). Nghe không rõ: câu số 41. Có 8 câu gợi ý để chạm. |
| Hỏi đáp về VDI | 38 câu chia 6 nhóm (Về VDI, Lịch sử, Ban lãnh đạo, Vietlott SMS, Con số & đối tác, Sinh nhật 15 năm). Chạm là robot đọc. |
| Dẫn đường | 6 khu vực: Check-in · Con đường lịch sử · Mini game · Trao gửi yêu thương · Backdrop chụp hình · Triển lãm ảnh. Có nút DỪNG. Nói "dẫn tôi đến mini game" cũng được, nhưng robot luôn hỏi lại và **phải chạm Đồng ý** mới đi. |

Mic chỉ bật ở màn Trò chuyện. Không ai chạm 90 giây thì tự về trang chủ.

## 2. App tự nhận biết loại robot

| Robot | Có AgentOS (`com.ainirobot.agentservice`)? | App làm gì |
|---|---|---|
| Nova bản mới | Có | AI AgentOS hiểu câu hỏi, gọi lệnh `ANSWER_FAQ` với số TT → app đọc nguyên văn câu trả lời |
| Minibot OS-R-SD03 (RobotOS V9.2, 2023) | **Không** | Chế độ dự phòng: nói bằng `SkillApi.playText`, nghe bằng `SkillCallback.onQueryAsrResult`/`onSendRequest`, app **tự so khớp** câu nghe được với bộ Q&A (`js/kb.js`) |

Xem dòng log `VDI : Robot có/CHƯA có AgentOS` (adb logcat) để biết đang chạy chế độ nào.

## 3. Sửa nội dung

- **Câu hỏi/câu trả lời:** sửa file Excel của khách, rồi chạy
  `python scripts/make_faq_vdi.py "đường-dẫn-file.xlsx"` → sinh lại `js/faq.js`.
  Trong script có `KEYS` (từ khoá phụ để nhận câu hỏi, VD tên người nằm trong câu trả lời) và `SPEAK_FIX` (chỉ đổi cách robot ĐỌC: ngày tháng, email, iPhone).
- **Khu vực dẫn đường, câu gợi ý, câu robot nói khi tới nơi:** `web/js/data.js`.
- Giao diện: `web/` (mở `index.html` bằng Chrome để xem trước). Gradle tự chép sang `assets/web` mỗi lần build, đừng sửa trong `assets/web`.

## 4. Build & cài

```
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
%USERPROFILE%\.gradle\gradle-9.7.1\bin\gradle assembleDebug --offline
adb install -r app\build\outputs\apk\debug\app-debug.apk
```
Gradle 9.7.1 đặt ở `~/.gradle/gradle-9.7.1` (bản cũ để trong Temp đã bị Windows dọn mất 01/10/2026).
APK ra ở `android/app/build/outputs/apk/debug/app-debug.apk`.

## 4b. Cài lên Nova (bản v1.1, 02/10/2026)

File: `NovaVDI-v1.1-Nova.apk` (build từ repo, không đính kèm trong repo) (versionCode 2, khoá màn ngang như NovaPCCC đã chạy thật trên Nova `OS_R_SG04`).

```
adb install -r NovaVDI-v1.1-Nova.apk
adb shell am start -n com.roboworld.vdi/.MainActivity
adb logcat -d | findstr "VDI"        <- phải thấy "voice_mode=auto -> dùng AI AgentOS"
```
Hoặc chép file APK vào USB/thẻ nhớ rồi cài bằng trình quản lý file trên robot.

**Công tắc chế độ giọng nói** (nếu AI AgentOS trên Nova không trả lời, VD do appId mượn của PCCC bị từ chối):
```
adb shell am start -n com.roboworld.vdi/.MainActivity --es voice_mode legacy   <- dùng so khớp Q&A trong app như Minibot
adb shell am start -n com.roboworld.vdi/.MainActivity --es voice_mode auto     <- trả về tự nhận biết
```
App tự khởi động lại để áp dụng; thiết lập được lưu lại qua các lần bật máy.

## 5. ⚠️ Bắt buộc: đặt app làm APP MẶC ĐỊNH của robot

RobotOS **chỉ cho app mặc định nói/nghe/di chuyển**. App khác vẫn hiện giao diện nhưng mọi lệnh đọc bị từ chối
(log `SkillServer: fail to play text … skillType is SUSPEND`, `PermissionManager: Top activity no control`).
Đổi bằng ADB (app đã có sẵn lệnh ẩn, ghi khoá `boot_app_package_name`):

```
adb shell am start -n com.roboworld.vdi/.MainActivity --es boot_app com.roboworld.vdi
adb reboot        <- BẮT BUỘC: RobotOS chỉ dựng lại danh sách app được quyền khi khởi động
```
Trả lại như cũ: `--es boot_app com.ainirobot.moduleapp` (giá trị gốc của Minibot) rồi `adb reboot`.

## 6. Bản đồ

App so khớp tên điểm **không phân biệt hoa/thường, có dấu/không dấu**, và nhận cả tên dự phòng:

| Khu vực | Tên điểm trên bản đồ (đặt 1 trong các tên) |
|---|---|
| Khu vực Check-in | `Check in` / `Khu vực check in` / `Điểm 1` |
| Con đường lịch sử | `Con đường lịch sử` / `Lịch sử` / `Điểm 2` |
| Mini game | `Mini game` / `Trò chơi` / `Điểm 3` |
| Trao gửi yêu thương | `Trao gửi yêu thương` / `Lời chúc` / `Điểm 4` |
| Backdrop chụp hình | `Backdrop chụp hình` / `Backdrop` / `Chụp hình` / `Điểm 5` |
| Triển lãm ảnh | `Triển lãm ảnh` / `Triển lãm` / `Điểm 6` |
| (robot tự về sau 15 giây) | `Vị trí chờ` (không bắt buộc) |

Minibot test hiện có `Diem 1`…`Diem 5` nên 5 khu vực đầu đã bấm được; robot cần **định vị** trước khi đi.

## 7. Kết quả test trên Minibot (01/10/2026)

- ✅ Giao diện 3 màn, hiển thị đúng ở WebView Chromium 66 (Android 9).
- ✅ Robot đọc câu chào, đọc câu trả lời Q&A (thử "vê đê i thành lập ngày nào" → đọc "VDI được thành lập vào ngày 14 tháng 10 năm 2011").
- ✅ Lệnh "dẫn tôi đến khu mini game" → robot hỏi xác nhận; đọc được 8 điểm trên bản đồ.
- ⏳ Chưa test: mic thật nghe khách nói (cần người đứng nói), robot đi thật (robot chưa định vị), chế độ AgentOS trên Nova.

## 8. Bài học kỹ thuật

- **WebView Minibot = Chromium 66** (2018): KHÔNG có `inset`, `gap` cho flexbox, `min()`, `?.`, `??`. Dùng `top/right/bottom/left`, margin thay gap.
- **SDK AgentOS trên máy không có `com.ainirobot.agentservice`** tự lùi về `speechasrservice` nhưng KHÔNG nói/nghe được (ttsSync im lặng). Đừng dựng `AppAgent` trên máy này.
- Cách gọi SkillApi đúng (học từ app `vn.roboworld.chibach`): `connectApi` → `registerCallBack` → `onCreate(appId)` → `setVersion(appId,"1.0.0")` → `setPath(appId,"main")` → `onForeground(appId)`; bật mic `setRecognizable(true)` + `setRecognizeMode(true)`.
- Máy nghe hay ra "vê đê i" thay vì "VDI" và "Nhung" (tên) trùng "những" khi bỏ dấu → đã xử lý trong `kb.js`.
