package com.roboworld.vdi

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.ainirobot.coreservice.client.ApiListener
import com.ainirobot.coreservice.client.RobotApi
import com.ainirobot.coreservice.client.listener.TextListener
import com.ainirobot.coreservice.client.module.ModuleCallbackApi
import com.ainirobot.coreservice.client.speech.SkillApi
import com.ainirobot.coreservice.client.speech.SkillCallback
import com.ainirobot.coreservice.client.speech.entity.TTSEntity

/**
 * Giọng nói cho robot CHƯA CÓ AgentOS (VD Minibot OS-R-SD03: không có com.ainirobot.agentservice,
 * SDK AgentOS lùi về speechasrservice nhưng không nói/nghe được).
 * Dùng API RobotOS đời cũ: SkillApi.playText để nói, SkillCallback/ModuleCallbackApi để nhận câu khách nói.
 * Không có AI hiểu câu hỏi -> trang web tự so khớp câu nghe được với bộ Q&A (js/kb.js).
 * Cách gọi học theo app vn.roboworld.chibach đang chạy thật trên Minibot.
 */
object LegacyVoice {
    private const val TAG = "VDI-Legacy"
    private val main = Handler(Looper.getMainLooper())
    private val skill = SkillApi()
    @Volatile var ready = false; private set
    @Volatile private var micWanted = false
    @Volatile private var lastText = ""
    @Volatile private var lastAt = 0L

    /** (text, final) — MainActivity gán để chuyển về trang web */
    @Volatile var onAsr: ((String, Boolean) -> Unit)? = null

    fun isAgentOsInstalled(ctx: Context): Boolean = try {
        ctx.packageManager.getPackageInfo("com.ainirobot.agentservice", 0); true
    } catch (e: Exception) { false }

    fun connect(ctx: Context, appId: String) {
        try {
            skill.connectApi(ctx, object : ApiListener {
                override fun handleApiConnected() {
                    try {
                        skill.registerCallBack(callback)
                        // Mở "cảnh giọng nói" cho app, nếu không hệ thống không chuyển câu khách nói về app này
                        skill.onCreate(appId)
                        skill.setVersion(appId, "1.0.0")
                        skill.setPath(appId, "main")
                        skill.onForeground(appId)
                    } catch (e: Exception) { Log.w(TAG, "Mở cảnh giọng nói lỗi: $e") }
                    ready = true
                    Log.d(TAG, "SkillApi đã kết nối")
                    applyMic()
                }
                override fun handleApiDisconnected() { ready = false }
                override fun handleApiDisabled() { ready = false }
            })
        } catch (e: Exception) { Log.w(TAG, "connectApi lỗi: $e") }
    }

    /** Gắn sau khi RobotApi.connectServer xong: một số bản RobotOS trả câu nói về qua onSendRequest */
    fun hookRobotApi() {
        try {
            RobotApi.getInstance().setCallback(object : ModuleCallbackApi() {
                override fun onSendRequest(reqId: Int, reqType: String?, reqText: String?, reqParam: String?): Boolean {
                    Log.d(TAG, "onSendRequest type=$reqType text=$reqText")
                    if (!reqText.isNullOrBlank()) heard(reqText, true)
                    return false
                }
                override fun onHWReport(p0: Int, p1: String?, p2: String?) {}
                override fun onSuspend() { Log.w(TAG, "Hệ thống thu hồi quyền điều khiển") }
                override fun onRecovery() {}
            })
        } catch (e: Exception) { Log.w(TAG, "setCallback lỗi: $e") }
    }

    private fun heard(raw: String, final: Boolean) {
        val text = raw.trim()
        if (text.isEmpty() || !micWanted) return
        if (final) {
            // Cùng 1 câu có thể về qua cả SkillCallback lẫn onSendRequest -> chỉ nhận 1 lần
            val now = System.currentTimeMillis()
            if (text == lastText && now - lastAt < 3000) return
            lastText = text; lastAt = now
        }
        onAsr?.invoke(text, final)
    }

    private val callback = object : SkillCallback() {
        override fun onSpeechParResult(s: String?) { if (!s.isNullOrBlank()) heard(s, false) }
        override fun onQueryAsrResult(s: String?) { Log.d(TAG, "Nghe được: $s"); if (!s.isNullOrBlank()) heard(s, true) }
        override fun onStart() {}
        override fun onStop() {}
        override fun onVolumeChange(v: Int) {}
        override fun onQueryEnded(status: Int) {}
    }

    fun setMic(on: Boolean) { micWanted = on; applyMic() }

    private fun applyMic() {
        if (!ready) return
        try {
            skill.setRecognizable(micWanted)
            if (micWanted && !skill.isRecognizeContinue) skill.setRecognizeMode(true)
        } catch (e: Exception) { Log.w(TAG, "Bật/tắt mic lỗi: $e") }
    }

    /** Đọc text; onDone gọi đúng 1 lần khi đọc xong / bị ngắt / lỗi */
    fun speak(text: String, onDone: () -> Unit) {
        if (!ready) { Log.w(TAG, "SkillApi chưa sẵn sàng, bỏ qua lệnh đọc"); main.post(onDone); return }
        var done = false
        val finish = { if (!done) { done = true; onDone() } }
        try {
            skill.playText(TTSEntity(text), object : TextListener() {
                override fun onComplete() = finish()
                override fun onStop() = finish()
                override fun onError() = finish()
            })
        } catch (e: Exception) { Log.w(TAG, "playText lỗi: $e"); finish() }
    }

    fun stop() { try { skill.stopTTS() } catch (e: Exception) { } }
}
