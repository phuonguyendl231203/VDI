package com.roboworld.vdi

import android.app.Application
import android.os.Bundle
import android.util.Log
import com.ainirobot.agent.AppAgent
import com.ainirobot.agent.action.Action
import com.ainirobot.agent.action.Actions
import com.ainirobot.coreservice.client.ApiListener
import com.ainirobot.coreservice.client.RobotApi

class MainApplication : Application() {

    companion object {
        /** Trùng appId trong assets/actionRegistry.json */
        const val APP_ID = "app_e3c75c7a4e96475bac42be646de6bed4"
        /** true = robot có AgentOS (Nova bản mới): AI hiểu câu hỏi. false = RobotOS cũ (Minibot): app tự so khớp Q&A */
        var agentOs = true; private set
    }

    override fun onCreate() {
        super.onCreate()
        // Chế độ giọng nói: "auto" (mặc định, tự nhận biết) | "agent" | "legacy". Đổi tại chỗ bằng ADB nếu AI AgentOS
        // trên Nova trục trặc: adb shell am start -n com.roboworld.vdi/.MainActivity --es voice_mode legacy
        val mode = getSharedPreferences("vdi", MODE_PRIVATE).getString("voice_mode", "auto") ?: "auto"
        agentOs = when (mode) {
            "agent" -> true
            "legacy" -> false
            else -> LegacyVoice.isAgentOsInstalled(this)
        }
        Log.d("VDI", "voice_mode=$mode -> " + if (agentOs) "dùng AI AgentOS" else "chế độ dự phòng (SkillApi + so khớp Q&A)")

        // --- Lớp phần cứng (RobotAPI): dẫn đường, đọc bản đồ, đèn LED ---
        // Bọc try/catch: chạy thử trên điện thoại/emulator (không có RobotOS) sẽ không kết nối được,
        // không để app crash vì thiếu phần cứng.
        try {
            RobotApi.getInstance().connectServer(this, object : ApiListener {
                override fun handleApiConnected() {
                    // Tắt màn hình sạc mặc định để app giữ quyền điều khiển khi robot đang sạc
                    RobotApi.getInstance().disableBattery()
                    if (!agentOs) LegacyVoice.hookRobotApi()
                }
                override fun handleApiDisconnected() {}
                override fun handleApiDisabled() {}
            })
        } catch (e: Exception) {
        }

        if (!agentOs) {
            // Không dựng AppAgent: SDK AgentOS trên máy cũ chỉ bám vào speechasrservice và không nói/nghe được
            LegacyVoice.connect(this, APP_ID)
            return
        }

        // --- Lớp AI/giọng nói (AgentOS SDK): nhân cách robot lễ tân sự kiện Sinh nhật 15 năm VDI ---
        object : AppAgent(this) {
            override fun onCreate() {
                setPersona(
                    "Em là robot lễ tân của sự kiện Sinh nhật 15 năm VDI (Công ty Cổ phần Đầu tư Kỹ thuật số Việt), " +
                        "chủ đề \"15 năm đồng hành, chạm mốc vươn xa\". Em chào đón khách mời, trả lời câu hỏi về VDI " +
                        "và dẫn đường tới các khu vực sự kiện. Phần mềm do Roboworld phát triển."
                )
                setStyle("vui vẻ, lễ phép, ấm áp; câu ngắn, dễ nghe; xưng em, gọi khách là anh chị")
                setObjective(
                    "Trả lời câu hỏi của khách mời về VDI CHỈ dựa trên bộ hỏi đáp mà màn hình cung cấp. " +
                        "Khi câu hỏi khớp nghĩa một câu trong bộ hỏi đáp (kể cả khi khách hỏi khác chữ hoặc chỉ nhắc tên một người), " +
                        "dùng lệnh trả lời câu hỏi về VDI với đúng số TT của câu đó. " +
                        "Không tự bịa số liệu, tên người, chức vụ. Câu hỏi ngoài nội dung thì nói: " +
                        "\"Thông tin này em chưa có ạ. Anh chị vui lòng hỏi Ban Tổ chức để được hỗ trợ ạ.\" " +
                        "Khách muốn đi tới khu vực nào thì dùng lệnh dẫn đường. " +
                        "Các khu vực: Check-in, Con đường lịch sử, Mini game, Trao gửi yêu thương, Backdrop chụp hình, Triển lãm ảnh."
                )
                // Robot tự trả lời bằng AI khi câu nói không khớp Action nào
                registerAction(Actions.SAY)
            }

            override fun onExecuteAction(action: Action, params: Bundle?): Boolean = false
        }
    }
}
