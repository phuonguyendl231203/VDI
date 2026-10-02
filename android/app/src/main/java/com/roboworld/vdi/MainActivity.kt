package com.roboworld.vdi

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.ainirobot.agent.AgentCore
import com.ainirobot.agent.OnTranscribeListener
import com.ainirobot.agent.PageAgent
import com.ainirobot.agent.action.Action
import com.ainirobot.agent.action.ActionExecutor
import com.ainirobot.agent.base.Parameter
import com.ainirobot.agent.base.ParameterType
import com.ainirobot.agent.base.Transcription
import com.ainirobot.agent.coroutine.AOCoroutineScope
import com.ainirobot.coreservice.client.Definition
import com.ainirobot.coreservice.client.RobotApi
import com.ainirobot.coreservice.client.listener.ActionListener
import com.ainirobot.coreservice.client.listener.CommandListener
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Toàn bộ giao diện là trang web trong assets/web (chép từ Roboworld-Design-Kit/website-nova-vdi-15nam).
 * Activity này chỉ làm 2 việc:
 *  1. Mở trang web trong WebView và cho trang gọi phần cứng robot qua cầu nối `NovaNative`.
 *  2. Đăng ký các lệnh giọng nói (PageAgent Action) rồi báo ngược về trang qua `NovaEvents.dispatch`.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private val reqId = AtomicInteger(1000)
    @Volatile private var navReqId = -1
    /** Mic chỉ bật khi trang web đang ở màn Hỏi đáp AI (JS gọi NovaNative.setMic) */
    @Volatile private var micOn = false

    private val agentOs get() = MainApplication.agentOs

    private fun applyMic() {
        if (!agentOs) { LegacyVoice.setMic(micOn); return }
        try { AgentCore.isMicrophoneMuted = !micOn } catch (e: Exception) { }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        WebView.setWebContentsDebuggingEnabled(true) // debug từ máy tính qua chrome://inspect
        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false // cho phép âm thanh đúng/sai phát cả khi trả lời bằng giọng nói
            allowFileAccess = true
            textZoom = 100
            useWideViewPort = true      // tôn trọng <meta viewport width=1280> (màn Nova density 560)
            loadWithOverviewMode = true
        }
        web.webViewClient = WebViewClient()
        web.webChromeClient = WebChromeClient()
        web.addJavascriptInterface(Bridge(), "NovaNative")
        web.loadUrl("file:///android_asset/web/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                emit("voice_open", JSONObject().put("screen", "home"))
            }
        })

        handleAdminIntent(intent)
        if (agentOs) setupVoice()
        else LegacyVoice.onAsr = { text, final -> emit("asr", JSONObject().put("text", text).put("final", final)) }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        handleAdminIntent(intent)
    }

    /**
     * Lệnh kỹ thuật qua ADB (khách không bấm được): đổi "app mặc định" của robot.
     * RobotOS đời cũ (Minibot) CHỈ trao quyền nói/nghe/di chuyển cho app mặc định (khoá boot_app_package_name).
     *   adb shell am start -n com.roboworld.vdi/.MainActivity --es boot_app com.roboworld.vdi
     *   adb shell am start -n com.roboworld.vdi/.MainActivity --es boot_app vn.roboworld.chibach   (trả lại như cũ)
     */
    private fun handleAdminIntent(intent: android.content.Intent?) {
        intent?.getStringExtra("voice_mode")?.let { m ->
            if (m in listOf("auto", "agent", "legacy")) {
                getSharedPreferences("vdi", MODE_PRIVATE).edit().putString("voice_mode", m).commit()
                android.util.Log.w("VDI", "Đã đặt voice_mode=$m — app tự khởi động lại để áp dụng")
                web.postDelayed({
                    startActivity(packageManager.getLaunchIntentForPackage(packageName)!!.addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK or android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
                    android.os.Process.killProcess(android.os.Process.myPid())
                }, 800)
            }
        }
        val pkg = intent?.getStringExtra("boot_app") ?: return
        web.postDelayed({
            try {
                val api = com.ainirobot.coreservice.client.robotsetting.RobotSettingApi.getInstance()
                val old = api.getRobotString("boot_app_package_name")
                api.setRobotString("boot_app_package_name", pkg)
                android.util.Log.w("VDI", "Đổi app mặc định: $old -> ${api.getRobotString("boot_app_package_name")}")
            } catch (e: Exception) { android.util.Log.w("VDI", "Đổi app mặc định lỗi: $e") }
        }, 3000)
    }

    /** Gửi sự kiện từ robot về trang web: NovaEvents.dispatch(type, json) */
    private fun emit(type: String, data: JSONObject) {
        val js = "window.NovaEvents && NovaEvents.dispatch(${JSONObject.quote(type)}, ${JSONObject.quote(data.toString())})"
        runOnUiThread { web.evaluateJavascript(js, null) }
    }

    // ======================= Cầu nối trang web -> robot =======================
    inner class Bridge {

        /** "agent" = robot có AgentOS (AI hiểu câu hỏi); "legacy" = RobotOS cũ, trang web tự so khớp Q&A */
        @JavascriptInterface
        fun mode(): String = if (agentOs) "agent" else "legacy"

        @JavascriptInterface
        fun speak(id: String, text: String) {
            if (!agentOs) { LegacyVoice.speak(text) { emit("tts_end", JSONObject().put("id", id)) }; return }
            AOCoroutineScope.launch {
                try { AgentCore.ttsSync(text) } catch (e: Exception) { }
                emit("tts_end", JSONObject().put("id", id))
            }
        }

        @JavascriptInterface
        fun stopSpeak() {
            if (!agentOs) { LegacyVoice.stop(); return }
            try { AgentCore.stopTTS() } catch (e: Exception) { }
        }

        /** "green" | "red" | "blue" — nháy đèn LED thân robot */
        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun light(color: String) {
            try {
                val hex = when (color) { "green" -> "00E676"; "red" -> "FF3B30"; else -> "2F80ED" }
                val p = JSONObject()
                    .put(Definition.JSON_LAMB_TYPE, 0)
                    .put(Definition.JSON_LAMB_TARGET, 0)
                    .put(Definition.JSON_LAMB_RGB_START, hex)
                    .put(Definition.JSON_LAMB_RGB_END, hex)
                    .put(Definition.JSON_LAMB_START_TIME, 100)
                    .put(Definition.JSON_LAMB_END_TIME, 100)
                    .put(Definition.JSON_LAMB_REPEAT, 3)
                    .put(Definition.JSON_LAMB_ON_TIME, 300)
                    .put(Definition.JSON_LAMB_RGB_FREEZE, hex)
                RobotApi.getInstance().setLight(reqId.incrementAndGet(), p.toString(), null)
            } catch (e: Exception) { }
        }

        /** Đọc danh sách tên điểm đã đặt trên bản đồ hiện tại */
        @JavascriptInterface
        fun getPlaces(id: String) {
            val names = mutableListOf<String>()
            try {
                RobotApi.getInstance().placeList?.forEach { p -> p?.name?.let { if (it.isNotBlank()) names.add(it) } }
            } catch (e: Exception) { }
            if (names.isNotEmpty()) {
                emit("places", JSONObject().put("id", id).put("list", JSONArray(names)))
                return
            }
            try {
                val once = AtomicBoolean(false)
                val done = { message: String? ->
                    if (once.compareAndSet(false, true))
                        emit("places", JSONObject().put("id", id).put("list", JSONArray(parsePlaceNames(message))))
                }
                // Tuỳ bản RobotOS mà callback 2 hoặc 3 tham số được gọi -> nghe cả hai, chỉ lấy lần đầu
                RobotApi.getInstance().getPlaceList(reqId.incrementAndGet(), object : CommandListener() {
                    @Suppress("OVERRIDE_DEPRECATION")
                    override fun onResult(result: Int, message: String?) = done(message)
                    override fun onResult(result: Int, message: String?, extraData: String?) = done(message)
                })
            } catch (e: Exception) {
                emit("places", JSONObject().put("id", id).put("list", JSONObject.NULL))
            }
        }

        /** Dẫn đường tới điểm có tên `name` trên bản đồ */
        @JavascriptInterface
        fun navigate(id: String, name: String) {
            try {
                if (navReqId > 0) RobotApi.getInstance().stopNavigation(navReqId)
                val rid = reqId.incrementAndGet()
                navReqId = rid
                RobotApi.getInstance().startNavigation(rid, name, 0.2, 30_000L, NavListener(id, rid))
            } catch (e: Exception) {
                emit("nav", JSONObject().put("id", id).put("kind", "fail").put("code", -1).put("msg", "Không kết nối được hệ thống điều hướng của robot"))
            }
        }

        @JavascriptInterface
        fun stopNav() {
            try {
                if (navReqId > 0) RobotApi.getInstance().stopNavigation(navReqId)
            } catch (e: Exception) { }
            navReqId = -1
        }

        /** Bật mic khi vào màn Hỏi đáp AI (xoá hội thoại cũ để mỗi lượt khách bắt đầu mới), tắt khi ra */
        @JavascriptInterface
        fun setMic(on: Boolean) {
            if (agentOs && on && !micOn) try { AgentCore.clearContext() } catch (e: Exception) { }
            micOn = on
            applyMic()
        }

        /** Gửi mô tả màn hình hiện tại cho AI để trả lời đúng ngữ cảnh */
        @JavascriptInterface
        fun setScreen(name: String, info: String) {
            if (agentOs) try { AgentCore.uploadInterfaceInfo(info) } catch (e: Exception) { }
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread { finishAffinity() }
        }
    }

    /**
     * Nhận kết quả dẫn đường. Tuỳ bản RobotOS mà robot gọi callback 2 hoặc 3 tham số,
     * nên nghe cả hai và chỉ xử lý kết quả cuối (tới nơi / lỗi) đúng 1 lần.
     */
    @Suppress("OVERRIDE_DEPRECATION")
    private inner class NavListener(private val id: String, private val rid: Int) : ActionListener() {
        private val finished = AtomicBoolean(false)
        @Volatile private var lastStatus = 0

        private fun finish(data: JSONObject) {
            if (!finished.compareAndSet(false, true)) return
            if (navReqId == rid) navReqId = -1
            emit("nav", data.put("id", id))
        }

        private fun result(status: Int, response: String?) {
            if (status == Definition.RESULT_OK && (response == null || response == "true")) {
                finish(JSONObject().put("kind", "arrive"))
            } else {
                finish(JSONObject().put("kind", "fail").put("code", status).put("msg", response ?: ""))
            }
        }

        private fun error(code: Int, msg: String?) =
            finish(JSONObject().put("kind", "fail").put("code", code).put("msg", msg ?: ""))

        private fun status(code: Int) {
            if (finished.get() || code == lastStatus) return
            val msg = when (code) {
                Definition.STATUS_START_NAVIGATION -> "Đang di chuyển"
                Definition.STATUS_NAVI_AVOID -> "Phía trước có vật cản, robot đang tránh…"
                Definition.STATUS_NAVI_AVOID_END -> "Đang tiếp tục di chuyển"
                Definition.STATUS_NAVI_GLOBAL_PATH_FAILED -> "Đang tìm đường khác…"
                else -> return
            }
            lastStatus = code
            emit("nav", JSONObject().put("id", id).put("kind", "status").put("code", code).put("msg", msg))
        }

        override fun onResult(status: Int, response: String?) = result(status, response)
        override fun onResult(status: Int, response: String?, extraData: String?) = result(status, response)
        override fun onError(errorCode: Int, errorString: String?) = error(errorCode, errorString)
        override fun onError(errorCode: Int, errorString: String?, extraData: String?) = error(errorCode, errorString)
        override fun onStatusUpdate(status: Int, data: String?) = status(status)
        override fun onStatusUpdate(status: Int, data: String?, extraData: String?) = status(status)
    }

    /** getPlaceList trả JSON; đọc linh hoạt cả dạng mảng object {name:...} lẫn mảng chuỗi. */
    private fun parsePlaceNames(message: String?): List<String> {
        val out = mutableListOf<String>()
        if (message.isNullOrBlank()) return out
        try {
            val arr = when {
                message.trim().startsWith("[") -> JSONArray(message)
                else -> JSONObject(message).let { o ->
                    o.keys().asSequence().map { o.opt(it) }.filterIsInstance<JSONArray>().firstOrNull() ?: JSONArray()
                }
            }
            for (i in 0 until arr.length()) {
                when (val v = arr.opt(i)) {
                    is JSONObject -> v.optString("name").takeIf { it.isNotBlank() }?.let { out.add(it) }
                    is String -> if (v.isNotBlank()) out.add(v)
                }
            }
        } catch (e: Exception) { }
        return out
    }

    // ======================= Lệnh giọng nói (AgentOS) =======================
    private fun simpleAction(name: String, display: String, desc: String, params: List<Parameter> = emptyList(), onRun: (Bundle?) -> Unit) =
        Action(
            name = name, displayName = display, desc = desc, parameters = params,
            executor = object : ActionExecutor {
                override fun onExecute(action: Action, params: Bundle?): Boolean {
                    onRun(params)
                    action.notify()
                    return true
                }
            }
        )

    private fun setupVoice() {
        PageAgent(this)
            .setObjective("Robot lễ tân sự kiện Sinh nhật 15 năm VDI: trả lời câu hỏi của khách mời về VDI theo bộ hỏi đáp trên màn hình, dẫn đường tới các khu vực sự kiện.")
            .setOnTranscribeListener(object : OnTranscribeListener {
                override fun onASRResult(transcription: Transcription): Boolean {
                    emit("asr", JSONObject().put("text", transcription.text).put("final", transcription.final))
                    return false
                }
                override fun onTTSResult(transcription: Transcription): Boolean {
                    emit("tts", JSONObject().put("text", transcription.text).put("final", transcription.final))
                    return false
                }
            })
            // AI hiểu câu hỏi -> chọn số TT trong bộ Q&A -> app đọc NGUYÊN VĂN câu trả lời của Ban Tổ chức
            .registerAction(simpleAction(
                "com.roboworld.vdi.ANSWER_FAQ", "Trả lời câu hỏi về VDI",
                "Khách hỏi một câu có trong bộ hỏi đáp về VDI đang hiển thị trên màn hình (lịch sử, tên gọi, ban lãnh đạo, " +
                    "người cụ thể, Vietlott SMS, doanh thu, đối tác, khách hàng, giá trị cốt lõi, sự kiện sinh nhật 15 năm, quà, lời chúc). " +
                    "Chọn đúng số TT của câu khớp nghĩa nhất.",
                listOf(Parameter("no", ParameterType.STRING, "Số TT của câu hỏi khớp nghĩa trong bộ hỏi đáp, ví dụ: 6", true, emptyList()))
            ) { p -> emit("voice_faq", JSONObject().put("no", p?.getString("no") ?: "")) })
            .registerAction(simpleAction(
                "com.roboworld.vdi.OPEN_SCREEN", "Mở mục",
                "Khách muốn mở một mục của phần mềm: trò chuyện, hỏi đáp về VDI, dẫn đường, hoặc về trang chủ",
                listOf(Parameter("screen", ParameterType.ENUM,
                    "ai = trò chuyện; faq = danh sách hỏi đáp về VDI; nav = dẫn đường; home = trang chủ",
                    true, listOf("ai", "faq", "nav", "home")))
            ) { p -> emit("voice_open", JSONObject().put("screen", p?.getString("screen") ?: "home")) })
            .registerAction(simpleAction(
                "com.roboworld.vdi.GUIDE_TO", "Dẫn đường tới khu vực",
                "Khách muốn robot dẫn đường tới một khu vực sự kiện: Check-in, Con đường lịch sử, Mini game, " +
                    "Trao gửi yêu thương (gửi lời chúc), Backdrop chụp hình, Triển lãm ảnh",
                listOf(Parameter("point", ParameterType.STRING, "Tên khu vực khách muốn tới, ví dụ: Mini game", true, emptyList()))
            ) { p -> emit("voice_nav", JSONObject().put("point", p?.getString("point") ?: "")) })
            .registerAction(simpleAction(
                "com.roboworld.vdi.STOP_MOVING", "Dừng lại",
                "Khách muốn robot dừng di chuyển, dừng dẫn đường"
            ) { emit("voice_stop", JSONObject()) })
    }

    override fun onResume() {
        super.onResume()
        // Tắt thanh phụ đề mặc định của hệ thống: nó che 1/4 dưới màn hình. App tự hiện phụ đề
        // (chạm vào phụ đề để ngắt lời robot).
        if (agentOs) try { AgentCore.isEnableVoiceBar = false } catch (e: Exception) { }
        // AgentOS tự BẬT lại mic mỗi khi app ra foreground -> áp lại trạng thái mic theo màn hiện tại
        applyMic()
        web.postDelayed({ applyMic() }, 800)
        // ROM Nova (Android 9) vẫn hiện icon trạng thái đè góc phải -> ẩn thêm bằng cờ immersive kiểu cũ
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
            or android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
    }

    override fun onDestroy() {
        try { if (navReqId > 0) RobotApi.getInstance().stopNavigation(navReqId) } catch (e: Exception) { }
        web.destroy()
        super.onDestroy()
    }
}
