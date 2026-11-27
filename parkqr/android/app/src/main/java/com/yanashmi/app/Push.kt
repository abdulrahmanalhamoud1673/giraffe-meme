package com.yanashmi.app

import android.content.Context
import androidx.work.WorkManager
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Instant notifications. When the app is closed Android shows them by itself; this class handles the app being open
 * and Google handing out a new address for the phone.
 */
object Push {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private fun available(ctx: Context) = FirebaseApp.getApps(ctx).isNotEmpty()

    /** Tells the server where to reach this phone. The 15-minute check stays on only while this does not work. */
    fun register(ctx: Context) {
        scheduleChecks(ctx)
        if (!available(ctx)) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { send(ctx.applicationContext, it) }
    }

    fun send(ctx: Context, token: String) {
        val key = Store.get(ctx).key
        if (key.length < 16) return
        scope.launch {
            try { if (Api.pushDevice(key, token, false, Prefs.tone(ctx).id)) WorkManager.getInstance(ctx).cancelUniqueWork(CHECK_WORK) } catch (_: Exception) { }
        }
    }

    /** Signing out: this phone must stop receiving that account's messages. */
    fun forget(ctx: Context, key: String) {
        WorkManager.getInstance(ctx).cancelUniqueWork(CHECK_WORK)
        if (!available(ctx)) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            scope.launch {
                try { Api.pushDevice(key, token, true, "") } catch (_: Exception) { }
                FirebaseMessaging.getInstance().deleteToken()   // even if the server was unreachable, the old address dies
            }
        }
    }
}

class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) = Push.send(applicationContext, token)

    override fun onMessageReceived(message: RemoteMessage) {
        if (Store.get(applicationContext).key.length < 16) return
        val n = message.notification ?: return
        show(applicationContext, n.tag ?: "yn", n.title ?: "يا نشمي", n.body ?: "", n.channelId?.startsWith("urgent") == true)
    }
}
