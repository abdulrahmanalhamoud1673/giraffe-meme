package com.yanashmi.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

const val CH_URGENT = "urgent"
const val CH_NORMAL = "messages"

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build()
        nm.createNotificationChannel(NotificationChannel(CH_URGENT, "رسائل عاجلة", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "ضربة أو سيارتك بخطر أو شخص مستعجل"; enableVibration(true); vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 300); setSound(sound, attrs)
        })
        nm.createNotificationChannel(NotificationChannel(CH_NORMAL, "الرسائل", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "كل رسالة بتوصلك على سيارتك"; setSound(sound, attrs)
        })
    }
}

fun scheduleChecks(ctx: Context) {
    val req = PeriodicWorkRequestBuilder<CheckWorker>(15, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
    WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("yn_check", ExistingPeriodicWorkPolicy.UPDATE, req)
}

/** Background check (every ~15 min, Android's minimum). Instant push (FCM) comes with the Firebase setup. */
class CheckWorker(private val ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val store = Store.get(ctx); if (store.key.length < 16) return Result.success()
        return try {
            val inbox = Api.inbox(store.key)
            val seen = store.seen.toMutableSet()
            for (m in inbox.messages) if (m.reply == null && seen.add(m.id)) notifyMessage(ctx, m)
            store.seen = seen; Result.success()
        } catch (e: ApiError) { if (e.status == 401) Result.failure() else Result.retry() } catch (_: Exception) { Result.retry() }
    }
}

fun notifyMessage(ctx: Context, m: Msg) {
    val urgent = m.kind == "hit" || m.kind == "urgent"
    val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val n = NotificationCompat.Builder(ctx, if (urgent) CH_URGENT else CH_NORMAL)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle(if (urgent) "عاجل: يا نشمي" else "يا نشمي")
        .setContentText((KINDS[m.kind] ?: "") + if (m.photo) " (مع صورة)" else "")
        .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(open).build()
    try { ctx.getSystemService(NotificationManager::class.java).notify(m.id.hashCode(), n) } catch (_: SecurityException) { }
}
