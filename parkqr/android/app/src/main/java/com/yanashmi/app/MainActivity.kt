package com.yanashmi.app

import android.Manifest
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color as AColor
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                YnTheme { Surface(Modifier.fillMaxSize(), color = Bg) { Root() } }
            }
        }
    }
}

internal fun digits(s: String) = s.map { if (it in '٠'..'٩') ('0' + (it - '٠')) else if (it in '۰'..'۹') ('0' + (it - '۰')) else it }.joinToString("")

private fun errText(e: Throwable): String = when ((e as? ApiError)?.code) {
    "name_two_words" -> "اكتب اسمك الأول والعائلة."
    "bad_phone" -> "الرقم مش صحيح. اكتب رقم أردني مثل 0791234567."
    "fake_phone" -> "الرقم مش صحيح."
    "rate_limited", "phone_limit", "busy" -> "وصلت الحد المسموح. جرّب لاحقاً."
    "unauthorized" -> "الرابط مش صحيح."
    "text_rejected" -> "الرسالة ما انقبلت. اكتب شي بسيط بدون أرقام أو روابط."
    "slow" -> "استنى ثواني."
    "closed" -> "انتهت المحادثة."
    else -> if (e is ApiError) "صار خطأ (${e.status}). جرّب كمان مرة." else "تأكد من الإنترنت وجرّب كمان مرة."
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
    else HomeScreen(store, onLogout = { store.clear(); key = "" })
}

@Composable
fun BrandHeader() {
    Column(Modifier.fillMaxWidth().padding(top = 28.dp, bottom = 14.dp)) {
        Text("يا نشمي", fontSize = 34.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
        Text("حدا مسكّر عليك؟ ابعتله بثواني.", color = Muted, fontSize = 15.sp)
    }
}

@Composable
fun AuthScreen(onDone: (String, String) -> Unit) {
    val scope = rememberCoroutineScope()
    var tab by remember { mutableIntStateOf(0) }
    var first by remember { mutableStateOf("") }; var last by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }; var car by remember { mutableStateOf("") }
    var consent by remember { mutableStateOf(false) }; var link by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }; var err by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).imePadding()) {
        BrandHeader()
        TabRow(selectedTabIndex = tab, containerColor = Bg) {
            Tab(selected = tab == 0, onClick = { tab = 0; err = "" }, text = { Text("سجّل سيارتك") })
            Tab(selected = tab == 1, onClick = { tab = 1; err = "" }, text = { Text("عندي حساب") })
        }
        Spacer(Modifier.height(16.dp))
        if (tab == 0) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(first, { first = it }, Modifier.weight(1f), label = { Text("الاسم الأول") }, singleLine = true)
                OutlinedTextField(last, { last = it }, Modifier.weight(1f), label = { Text("العائلة") }, singleLine = true)
            }
            OutlinedTextField(phone, { phone = digits(it) }, Modifier.fillMaxWidth().padding(top = 10.dp), label = { Text("رقم الموبايل") }, placeholder = { Text("07X XXX XXXX") },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
            OutlinedTextField(car, { car = it }, Modifier.fillMaxWidth().padding(top = 10.dp), label = { Text("وصف السيارة (اختياري)") }, placeholder = { Text("تويوتا بيضاء") }, singleLine = true)
            Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(consent, { consent = it })
                Text("أوافق على حفظ اسمي ورقمي لإرسال التنبيهات فقط.", fontSize = 13.sp, color = Muted)
            }
            Text("رقمك ما بيظهر لأي حدا، لا لمين بيمسح الكود ولا لغيره.", fontSize = 12.sp, color = Muted)
        } else {
            Text("الصق رابط صندوقك اللي حفظته عند التسجيل.", color = Muted)
            OutlinedTextField(link, { link = it }, Modifier.fillMaxWidth().padding(top = 10.dp), label = { Text("الرابط") }, placeholder = { Text("https://yanashmi.com/inbox.html#...") }, singleLine = true)
        }
        if (err.isNotEmpty()) Text(err, color = Red, modifier = Modifier.padding(top = 10.dp))
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                err = ""; busy = true
                scope.launch {
                    try {
                        if (tab == 0) {
                            if (!consent) { err = "لازم توافق على حفظ اسمك ورقمك."; return@launch }
                            val r = Api.register("${first.trim()} ${last.trim()}", car.trim(), phone.trim())
                            onDone(r.token, r.key)
                        } else {
                            val m = Regex("([a-zA-Z0-9]{16,40})\\s*$").find(link.trim())
                            if (m == null) { err = "الرابط مش صحيح. انسخه كامل."; return@launch }
                            val k = m.groupValues[1].lowercase(); val inbox = Api.inbox(k)
                            onDone("", k); @Suppress("UNUSED_VARIABLE") val unused = inbox
                        }
                    } catch (e: Exception) { err = errText(e) } finally { busy = false }
                }
            },
            enabled = !busy, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(14.dp),
        ) { Text(if (busy) "لحظة…" else if (tab == 0) "سجّل" else "افتح صندوقي", fontSize = 17.sp) }
        Spacer(Modifier.height(24.dp))
    }
}

fun timeAgo(t: Long): String {
    val s = System.currentTimeMillis() / 1000 - t
    return when { s < 60 -> "هلأ"; s < 3600 -> "قبل ${s / 60} دقيقة"; s < 86400 -> "قبل ${s / 3600} ساعة"; else -> "قبل ${s / 86400} يوم" }
}

@Composable
fun HomeScreen(store: Store, onLogout: () -> Unit) {
    val key = store.key
    val scope = rememberCoroutineScope()
    var inbox by remember { mutableStateOf<Inbox?>(null) }
    var err by remember { mutableStateOf("") }
    var settings by remember { mutableStateOf(false) }
    suspend fun load() {
        try { val i = Api.inbox(key); inbox = i; err = ""; if (store.token.isEmpty() && i.messages.isNotEmpty()) { } }
        catch (e: ApiError) { if (e.status == 401) onLogout() else err = errText(e) } catch (e: Exception) { err = errText(e) }
    }
    LaunchedEffect(Unit) { while (true) { load(); delay(8000) } }
    if (settings) { SettingsScreen(store, inbox, onBack = { settings = false }, onLogout = onLogout); return }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(inbox?.nickname?.ifBlank { null } ?: inbox?.name ?: "يا نشمي", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                Text(if (inbox?.paused == true) "الاستقبال متوقف" else "الاستقبال شغّال", color = if (inbox?.paused == true) Red else Green, fontSize = 13.sp)
            }
            Switch(checked = inbox?.paused != true, onCheckedChange = { on -> scope.launch { try { Api.pause(key, !on); load() } catch (_: Exception) { } } })
            TextButton(onClick = { settings = true }) { Text("حسابي") }
        }
        if (err.isNotEmpty()) Text(err, color = Red, modifier = Modifier.padding(horizontal = 20.dp))
        val msgs = inbox?.messages ?: emptyList()
        if (inbox != null && msgs.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                Text("ما في رسائل لسا.\nلما حدا يمسح رمزك بتظهر هون وبيوصلك تنبيه.", color = Muted, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        } else {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(msgs, key = { it.id }) { m -> MessageCard(key, m, onChanged = { scope.launch { load() } }) }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MessageCard(key: String, m: Msg, onChanged: () -> Unit) {
    val scope = rememberCoroutineScope()
    var chatOpen by remember { mutableStateOf(false) }
    var blocked by remember { mutableStateOf(false) }
    val photo by produceState<Bitmap?>(null, m.id) { if (m.photo) value = try { Api.photo(key, m.id) } catch (_: Exception) { null } }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White).border(1.dp, if (m.reply == null) Green else Line, RoundedCornerShape(16.dp)).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("شخص مسكّر عليك", color = Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
            if (m.reply == null) Text("جديدة", color = Color.White, fontSize = 11.sp, modifier = Modifier.clip(RoundedCornerShape(99.dp)).background(Green).padding(horizontal = 8.dp, vertical = 2.dp))
        }
        Text(KINDS[m.kind] ?: m.kind, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 4.dp))
        if (!m.note.isNullOrBlank()) Text(m.note, modifier = Modifier.padding(top = 8.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Bubble).padding(10.dp))
        photo?.let { Image(it.asImageBitmap(), "صورة المشكلة", Modifier.padding(top = 8.dp).fillMaxWidth().heightIn(max = 220.dp).clip(RoundedCornerShape(10.dp)), contentScale = ContentScale.Crop) }
        Text(timeAgo(m.createdAt), color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
        if (m.reply != null) {
            Text("ردّك: ${REPLIES[m.reply] ?: m.reply}", color = Green, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
        } else {
            FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for ((k, label) in REPLIES) OutlinedButton(onClick = { scope.launch { try { Api.reply(key, m.id, k); onChanged() } catch (_: Exception) { } } }, shape = RoundedCornerShape(99.dp)) { Text(label, fontSize = 13.sp) }
            }
        }
        Row(Modifier.padding(top = 4.dp)) {
            TextButton(onClick = { chatOpen = !chatOpen }) { Text(if (m.chat > 0) "المحادثة (${m.chat})" else "ردّ بكتابة") }
            TextButton(onClick = { scope.launch { try { Api.block(key, m.id); blocked = true } catch (_: Exception) { } } }, enabled = !blocked) { Text(if (blocked) "تم الحظر" else "حظر", color = Muted) }
        }
        if (chatOpen) ChatPanel(key, m.id)
    }
}

@Composable
fun ChatPanel(key: String, id: String) {
    val scope = rememberCoroutineScope()
    var thread by remember { mutableStateOf<Thread?>(null) }
    var text by remember { mutableStateOf("") }; var err by remember { mutableStateOf("") }
    suspend fun pull() { try { thread = Api.thread(key, id) } catch (_: Exception) { } }
    LaunchedEffect(id) { while (true) { pull(); delay(4000) } }
    Column(Modifier.fillMaxWidth().padding(top = 6.dp)) {
        for (c in thread?.messages ?: emptyList()) {
            Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = if (c.mine) Arrangement.Start else Arrangement.End) {
                Text(c.text, color = if (c.mine) Color.White else Ink, modifier = Modifier.widthIn(max = 260.dp).clip(RoundedCornerShape(14.dp)).background(if (c.mine) Green else Bubble).padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
        if (thread?.open != false) Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(text, { if (it.length <= 140) text = it }, Modifier.weight(1f), placeholder = { Text("اكتب رسالة قصيرة…") }, singleLine = true)
            Spacer(Modifier.width(8.dp))
            Button(onClick = { val t = text.trim(); if (t.isNotEmpty()) scope.launch { try { Api.say(key, id, t); text = ""; err = ""; pull() } catch (e: Exception) { err = errText(e) } } }) { Text("أرسل") }
        }
        if (err.isNotEmpty()) Text(err, color = Red, fontSize = 12.sp)
    }
}

private fun qr(text: String): Bitmap {
    val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 640, 640, mapOf(com.google.zxing.EncodeHintType.MARGIN to 1))
    val bmp = Bitmap.createBitmap(m.width, m.height, Bitmap.Config.ARGB_8888)
    for (x in 0 until m.width) for (y in 0 until m.height) bmp.setPixel(x, y, if (m[x, y]) AColor.BLACK else AColor.WHITE)
    return bmp
}

@Composable
fun SettingsScreen(store: Store, inbox: Inbox?, onBack: () -> Unit, onLogout: () -> Unit) {
    val ctx = LocalContext.current; val scope = rememberCoroutineScope()
    var confirmDelete by remember { mutableStateOf(false) }
    val token = store.token
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
        TextButton(onClick = onBack) { Text("‹ رجوع") }
        Text("حسابي", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
        Text(inbox?.name ?: "", color = Muted)
        if (token.isNotEmpty()) {
            val url = "https://yanashmi.com/c?t=$token"
            val bmp = remember(url) { qr(url) }
            Spacer(Modifier.height(16.dp))
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White).border(1.dp, Line, RoundedCornerShape(16.dp)).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Image(bmp.asImageBitmap(), "رمز الستيكر", Modifier.size(220.dp))
                Text("YN-${token.uppercase()}", color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
            }
            Text("هاد رمز ستيكرك. اطبعه وحطه على زجاج السيارة.", color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
            OutlinedButton(onClick = { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url), "شارك")) }, Modifier.fillMaxWidth().padding(top = 8.dp)) { Text("شارك رابط الرمز") }
        }
        Spacer(Modifier.height(24.dp))
        OutlinedButton(onClick = onLogout, Modifier.fillMaxWidth()) { Text("تسجيل الخروج من هالجهاز") }
        Text("قبل ما تطلع، احفظ رابط صندوقك. بدونه ما بتقدر ترجع لحسابك.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
        Spacer(Modifier.height(16.dp))
        if (!confirmDelete) TextButton(onClick = { confirmDelete = true }) { Text("حذف حسابي نهائياً", color = Red) }
        else Column {
            Text("رح ينحذف حسابك وكل رسائلك وصورك. ما في رجعة.", color = Red)
            Row { Button(onClick = { scope.launch { try { Api.deleteAccount(store.key); onLogout() } catch (_: Exception) { } } }, colors = ButtonDefaults.buttonColors(containerColor = Red)) { Text("احذف") }
                Spacer(Modifier.width(8.dp)); OutlinedButton(onClick = { confirmDelete = false }) { Text("إلغاء") } }
        }
        Text("سياسة الخصوصية: yanashmi.com/privacy", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 20.dp))
    }
}
