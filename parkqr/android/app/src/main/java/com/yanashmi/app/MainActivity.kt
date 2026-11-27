package com.yanashmi.app

import android.Manifest
import android.app.NotificationManager
import android.graphics.Color as AColor
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(AColor.TRANSPARENT), navigationBarStyle = SystemBarStyle.light(AColor.TRANSPARENT, AColor.TRANSPARENT))
        setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                YnTheme { Surface(Modifier.fillMaxSize(), color = Bg) { Root() } }
            }
        }
    }
}

internal fun digits(s: String) = s.map { if (it in '٠'..'٩') ('0' + (it - '٠')) else if (it in '۰'..'۹') ('0' + (it - '۰')) else it }.joinToString("")

internal fun errText(e: Throwable): String = when ((e as? ApiError)?.code) {
    "name_two_words" -> "اكتب اسمك الأول والعائلة."
    "name_required", "name_short" -> "اكتب اسمك الأول واسم العائلة، حرفين على الأقل لكل واحد."
    "name_chars" -> "الاسم حروف بس، بدون أرقام أو رموز."
    "name_long" -> "الاسم طويل كثير."
    "name_fake" -> "اكتب اسمك الحقيقي."
    "consent_required" -> "لازم توافق على حفظ اسمك ورقمك."
    "bad_phone" -> "الرقم مش صحيح. اكتب رقم أردني مثل 0791234567."
    "fake_phone" -> "الرقم مش صحيح."
    "rate_limited", "phone_limit", "busy" -> "وصلت الحد المسموح. جرّب لاحقاً."
    "unauthorized" -> "الرابط مش صحيح."
    "bad_token" -> "ما قدرنا نتأكد من حساب جوجل. اضغط زر جوجل مرة تانية."
    "not_configured" -> "الدخول بجوجل مش متاح هلأ."
    "text_rejected" -> "الرسالة ما انقبلت. اكتب شي بسيط بدون أرقام أو روابط."
    "photo_unrelated" -> "الصورة ما بتبيّن السيارة. صوّر المشكلة بوضوح."
    "bad_photo" -> "الصورة مش صالحة. صوّر من جديد."
    "photo_check_down" -> "فحص الصور مش متاح هلأ. ابعت كتابة أو جرّب بعد شوي."
    "slow" -> "استنى ثواني."
    "closed" -> "انتهت المحادثة."
    "limit" -> "وصلت الحد الأقصى للمحادثة."
    else -> if (e is ApiError) "صار خطأ (${e.status}). جرّب كمان مرة." else "تأكد من الإنترنت وجرّب كمان مرة."
}

internal fun timeAgo(t: Long): String {
    val s = System.currentTimeMillis() / 1000 - t
    return when { s < 60 -> "هلأ"; s < 3600 -> "قبل ${s / 60} دقيقة"; s < 86400 -> "قبل ${s / 3600} ساعة"; else -> "قبل ${s / 86400} يوم" }
}

@Composable
fun Root() {
    val ctx = LocalContext.current
    val store = remember { Store.get(ctx) }
    var key by remember { mutableStateOf(store.key) }
    val askNotif = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(key) {
        if (key.length >= 16) {
            scheduleChecks(ctx)
            if (Build.VERSION.SDK_INT >= 33) askNotif.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    if (key.length < 16) AuthScreen(onDone = { token, k -> store.token = token; store.key = k; key = k })
    else HomeScreen(store, onNewKey = { store.key = it; key = it }, onLogout = {
        // leave nothing of this account behind on the phone
        store.clear(); Photos.clear(); ctx.getSystemService(NotificationManager::class.java).cancelAll(); key = ""
    })
}
