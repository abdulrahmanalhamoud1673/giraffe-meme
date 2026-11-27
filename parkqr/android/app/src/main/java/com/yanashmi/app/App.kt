package com.yanashmi.app

import android.app.Application
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

const val CHECK_WORK = "yn_check"

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Channels.ensure(this, Prefs.tone(this))
    }
}

fun scheduleChecks(ctx: Context) {
    val req = PeriodicWorkRequestBuilder<CheckWorker>(15, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
    WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(CHECK_WORK, ExistingPeriodicWorkPolicy.UPDATE, req)
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
    show(ctx, "yn-${m.id}", if (urgent) "عاجل: يا نشمي" else "يا نشمي", (KINDS[m.kind] ?: "") + if (m.photo) " (مع صورة)" else "", urgent)
}

/** One notification per conversation: the same tag the server uses, so a second delivery replaces the first. */
fun show(ctx: Context, tag: String, title: String, body: String, urgent: Boolean) {
    val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val n = NotificationCompat.Builder(ctx, Channels.id(Prefs.tone(ctx), urgent))
        .setSmallIcon(R.drawable.ic_notify).setColor(0xFFC8102E.toInt())
        .setContentTitle(title).setContentText(body)
        .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(open).build()
    try { ctx.getSystemService(NotificationManager::class.java).notify(tag, 0, n) } catch (_: SecurityException) { }
}
