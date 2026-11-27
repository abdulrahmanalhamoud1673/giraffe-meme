package com.yanashmi.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiError(val status: Int, val code: String) : Exception("$status $code")

data class Msg(val id: String, val kind: String, val reply: String?, val createdAt: Long, val photo: Boolean, val note: String?, val chat: Int, val repliedAt: Long? = null)
data class Inbox(val name: String, val nickname: String, val paused: Boolean, val messages: List<Msg>)
data class ChatMsg(val id: String, val mine: Boolean, val text: String, val photo: Boolean, val t: Long)
data class Thread(val open: Boolean, val messages: List<ChatMsg>)
data class Registered(val token: String, val key: String)

val KINDS = mapOf(
    "block" to "سيارتك مسكّرة عليّ، ممكن تحرّكها؟",
    "urgent" to "أنا مستعجل، رجاءً بأسرع وقت",
    "lights" to "الأضواء شغالة",
    "open" to "الشباك أو الصندوق مفتوح",
    "fault" to "في إشي غلط بسيارتك (دولاب منفّس / تسريب)",
    "hit" to "سيارتك تتحرك أو تعرضت لضربة",
    "thanks" to "شكراً، حرّكتها",
)
val REPLIES = linkedMapOf("2" to "جاي خلال دقيقتين", "5" to "جاي خلال 5 دقائق", "10" to "جاي خلال 10 دقائق", "cant" to "ما بقدر الآن، رجاءً استنى")

object Api {
    const val BASE = "https://yanashmi.com"

    private fun open(method: String, path: String, key: String?, body: JSONObject?): HttpURLConnection {
        val c = URL(BASE + path).openConnection() as HttpURLConnection
        c.requestMethod = method; c.connectTimeout = 15000; c.readTimeout = 20000
        if (key != null) c.setRequestProperty("authorization", "Bearer $key")
        if (body != null) {
            c.doOutput = true; c.setRequestProperty("content-type", "application/json")
            c.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        return c
    }

    private suspend fun call(method: String, path: String, key: String? = null, body: JSONObject? = null): JSONObject = withContext(Dispatchers.IO) {
        val c = open(method, path, key, body)
        try {
            val status = c.responseCode
            val text = (if (status in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            val json = try { JSONObject(text) } catch (_: Exception) { JSONObject() }
            if (status !in 200..299) throw ApiError(status, json.optString("error"))
            json
        } finally { c.disconnect() }
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    suspend fun register(name: String, nickname: String, phone: String): Registered {
        val r = call("POST", "/api/register", body = JSONObject().put("name", name).put("nickname", nickname).put("phone", phone).put("consent", true).put("src", "app"))
        return Registered(r.getString("token"), r.getString("owner_key"))
    }

    suspend fun inbox(key: String): Inbox {
        val r = call("GET", "/api/inbox", key)
        val car = r.getJSONObject("car"); val arr = r.getJSONArray("messages")
        val list = (0 until arr.length()).map { arr.getJSONObject(it) }.filter { !it.optString("kind").startsWith("nudge:") }.map {
            Msg(it.getString("id"), it.optString("kind"), if (it.isNull("reply")) null else it.optString("reply"), it.optLong("created_at"), it.optInt("photo") == 1,
                if (it.isNull("note")) null else it.optString("note"), it.optInt("chat"), if (it.isNull("replied_at")) null else it.optLong("replied_at"))
        }
        return Inbox(car.optString("name"), car.optString("nickname"), car.optBoolean("paused"), list)
    }

    suspend fun reply(key: String, id: String, reply: String) { call("POST", "/api/inbox/reply", key, JSONObject().put("id", id).put("reply", reply)) }
    suspend fun pause(key: String, paused: Boolean) { call("POST", "/api/inbox/pause", key, JSONObject().put("paused", paused)) }
    suspend fun block(key: String, id: String) { call("POST", "/api/inbox/block", key, JSONObject().put("id", id)) }
    suspend fun deleteAccount(key: String) { call("POST", "/api/inbox/delete", key, JSONObject()) }

    suspend fun thread(key: String, id: String): Thread {
        val r = call("GET", "/api/inbox/chat?id=${enc(id)}", key)
        val a = r.getJSONArray("messages")
        return Thread(r.optBoolean("open"), (0 until a.length()).map { a.getJSONObject(it) }.map { ChatMsg(it.optString("id"), it.optString("side") == "o", it.optString("text"), it.optInt("photo") == 1, it.optLong("t")) })
    }
    suspend fun say(key: String, id: String, text: String, photo: String? = null) {
        val b = JSONObject().put("text", text); if (photo != null) b.put("photo", photo)
        call("POST", "/api/inbox/chat?id=${enc(id)}", key, b)
    }

    suspend fun photo(key: String, id: String): Bitmap? = withContext(Dispatchers.IO) {
        val c = open("GET", "/api/photo?id=${enc(id)}", key, null)
        try { if (c.responseCode == 200) c.inputStream.use { BitmapFactory.decodeStream(it) } else null } finally { c.disconnect() }
    }
}
