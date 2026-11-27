package com.yanashmi.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri

/** The notification sounds a person can choose from. Made for this app (see tools in the project notes). */
enum class Tone(val id: String, val label: String, val res: Int) {
    Nashmi("nashmi", "نشمي", R.raw.tone_nashmi),
    Bell("bell", "جرس", R.raw.tone_bell),
    Tap("tap", "نقرتين", R.raw.tone_tap),
    Alarm("alarm", "منبّه", R.raw.tone_alarm);

    companion object { fun of(id: String) = entries.firstOrNull { it.id == id } ?: Nashmi }
}

/**
 * Android fixes a channel's sound when the channel is created, so each sound has its own pair of channels. The server is
 * told which one to use (see Push), and only the chosen pair exists, so the phone's settings stay tidy.
 */
object Channels {
    fun id(tone: Tone, urgent: Boolean) = (if (urgent) "urgent_" else "messages_") + tone.id

    fun ensure(ctx: Context, tone: Tone) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
        // by name, not by number: numbers change between app versions and the channel would go silent
        val sound = Uri.parse("android.resource://${ctx.packageName}/raw/tone_${tone.id}")
        fun make(urgent: Boolean) = NotificationChannel(id(tone, urgent), if (urgent) "رسائل عاجلة" else "الرسائل", NotificationManager.IMPORTANCE_HIGH).apply {
            setSound(sound, attrs); enableVibration(true)
            vibrationPattern = if (urgent) longArrayOf(0, 400, 150, 400, 150, 400) else longArrayOf(0, 250, 120, 250)
        }
        nm.createNotificationChannel(make(false)); nm.createNotificationChannel(make(true))
        val keep = setOf(id(tone, false), id(tone, true))
        for (c in nm.notificationChannels) if (c.id !in keep && (c.id.startsWith("messages") || c.id.startsWith("urgent"))) nm.deleteNotificationChannel(c.id)
    }

    /** Plays a sound once, when someone is choosing. */
    fun preview(ctx: Context, tone: Tone) {
        try { MediaPlayer.create(ctx, tone.res)?.apply { setOnCompletionListener { it.release() }; start() } } catch (_: Exception) { }
    }
}

/** The chosen sound is not a secret: it lives in ordinary settings, readable the moment the app starts. */
object Prefs {
    private fun prefs(ctx: android.content.Context) = ctx.getSharedPreferences("yn_prefs", android.content.Context.MODE_PRIVATE)
    fun tone(ctx: android.content.Context): Tone = Tone.of(prefs(ctx).getString("tone", "") ?: "")
    fun setTone(ctx: android.content.Context, t: Tone) = prefs(ctx).edit().putString("tone", t.id).apply()
}
