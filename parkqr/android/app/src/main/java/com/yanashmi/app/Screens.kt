package com.yanashmi.app

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color as AColor
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ---------- small building blocks ----------

@Composable
fun StarMark(size: Int = 44, color: Color = Mint) {
    Canvas(Modifier.size(size.dp)) {
        val s = this.size.minDimension; val c = s / 2; val r = s * 0.46f
        fun diamond(rad: Float) = Path().apply { moveTo(c, c - rad); lineTo(c + rad, c); lineTo(c, c + rad); lineTo(c - rad, c); close() }
        drawPath(diamond(r), color, style = Stroke(width = s * 0.07f))
        drawPath(diamond(r * 0.55f), color, style = Stroke(width = s * 0.07f))
        drawCircle(color, s * 0.06f, Offset(c, c))
    }
}

@Composable
fun YnField(value: String, onChange: (String) -> Unit, label: String, modifier: Modifier = Modifier, placeholder: String? = null, keyboard: KeyboardType = KeyboardType.Text) {
    OutlinedTextField(
        value, onChange, modifier, label = { Text(label) }, placeholder = placeholder?.let { { Text(it, color = Muted.copy(alpha = .6f)) } }, singleLine = true,
        shape = RoundedCornerShape(16.dp), keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Green, unfocusedBorderColor = Line, focusedContainerColor = Color.White, unfocusedContainerColor = Color.White, focusedLabelColor = Green),
    )
}

@Composable
fun PrimaryButton(text: String, enabled: Boolean = true, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Button(onClick, modifier.fillMaxWidth().height(56.dp), enabled = enabled, shape = RoundedCornerShape(18.dp), colors = ButtonDefaults.buttonColors(containerColor = Green)) {
        Text(text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
    }
}

fun kindIcon(kind: String): ImageVector = when (kind) {
    "block" -> Icons.Filled.DirectionsCar; "urgent" -> Icons.Filled.Schedule; "lights" -> Icons.Filled.Lightbulb
    "open" -> Icons.Filled.Window; "fault" -> Icons.Filled.Build; "hit" -> Icons.Filled.ReportProblem; else -> Icons.Filled.Favorite
}

@Composable
fun rememberPhoto(key: String, id: String, has: Boolean): State<Bitmap?> = produceState<Bitmap?>(null, id) { if (has) value = try { Api.photo(key, id) } catch (_: Exception) { null } }

private fun clock(t: Long) = SimpleDateFormat("hh:mm a", Locale("ar")).format(Date(t * 1000))

// ---------- sign in / register ----------

@Composable
fun AuthScreen(onDone: (String, String) -> Unit) {
    val scope = rememberCoroutineScope()
    var tab by remember { mutableIntStateOf(0) }
    var first by remember { mutableStateOf("") }; var last by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }; var car by remember { mutableStateOf("") }
    var consent by remember { mutableStateOf(false) }; var link by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }; var err by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().background(Night)) {
        Column(Modifier.fillMaxWidth().background(HeaderBrush).statusBarsPadding().padding(horizontal = 24.dp, vertical = 26.dp), horizontalAlignment = Alignment.Start) {
            StarMark(46)
            Spacer(Modifier.height(10.dp))
            Text("يا نشمي", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.ExtraBold)
            Text("حدا مسكّر عليك؟ ابعتله بثواني.", color = Mint, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text("رقمك مخفي. الرسائل جاهزة. بدون إزعاج.", color = Color(0xFFB9C4BE), fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp))
        }
        Column(
            Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)).background(Bg).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 22.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Bubble).padding(4.dp)) {
                for ((i, t) in listOf("سجّل سيارتك", "عندي حساب").withIndex()) {
                    Box(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (tab == i) Color.White else Color.Transparent).clickable { tab = i; err = "" }.padding(vertical = 11.dp), contentAlignment = Alignment.Center) {
                        Text(t, fontWeight = if (tab == i) FontWeight.Bold else FontWeight.Medium, color = if (tab == i) Green else Muted)
                    }
                }
            }
            if (tab == 0) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    YnField(first, { first = it }, "الاسم الأول", Modifier.weight(1f))
                    YnField(last, { last = it }, "العائلة", Modifier.weight(1f))
                }
                YnField(phone, { phone = digits(it) }, "رقم الموبايل", Modifier.fillMaxWidth(), "07X XXX XXXX", KeyboardType.Phone)
                YnField(car, { car = it }, "وصف السيارة (اختياري)", Modifier.fillMaxWidth(), "تويوتا بيضاء")
                Row(Modifier.fillMaxWidth().clickable { consent = !consent }, verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(consent, { consent = it }, colors = CheckboxDefaults.colors(checkedColor = Green))
                    Text("أوافق على حفظ اسمي ورقمي لإرسال التنبيهات فقط.", fontSize = 13.sp, color = Muted)
                }
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xFFE3F1EA)).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Lock, null, tint = Green, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp))
                    Text("رقمك ما بيظهر لأي حدا، لا لمين بيمسح الكود ولا لغيره.", fontSize = 12.sp, color = GreenDark)
                }
            } else {
                Text("الصق رابط صندوقك اللي حفظته عند التسجيل.", color = Muted)
                YnField(link, { link = it }, "الرابط", Modifier.fillMaxWidth(), "https://yanashmi.com/inbox.html#...")
            }
            if (err.isNotEmpty()) Text(err, color = Red, fontWeight = FontWeight.SemiBold)
            PrimaryButton(if (busy) "لحظة…" else if (tab == 0) "سجّل" else "افتح صندوقي", enabled = !busy) {
                err = ""; busy = true
                scope.launch {
                    try {
                        if (tab == 0) {
                            if (!consent) { err = "لازم توافق على حفظ اسمك ورقمك."; return@launch }
                            val r = Api.register("${first.trim()} ${last.trim()}", car.trim(), phone.trim()); onDone(r.token, r.key)
                        } else {
                            val m = Regex("([a-zA-Z0-9]{16,40})\\s*$").find(link.trim())
                            if (m == null) { err = "الرابط مش صحيح. انسخه كامل."; return@launch }
                            val k = m.groupValues[1].lowercase(); Api.inbox(k); onDone("", k)
                        }
                    } catch (e: Exception) { err = errText(e) } finally { busy = false }
                }
            }
            Text("بالتسجيل بتوافق على سياسة الخصوصية: yanashmi.com/privacy", color = Muted, fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
    }
}

// ---------- inbox ----------

@Composable
fun HomeScreen(store: Store, onLogout: () -> Unit) {
    val key = store.key
    val scope = rememberCoroutineScope()
    var inbox by remember { mutableStateOf<Inbox?>(null) }
    var err by remember { mutableStateOf("") }
    var settings by remember { mutableStateOf(false) }
    var open by remember { mutableStateOf<Msg?>(null) }
    suspend fun load() {
        try { val i = Api.inbox(key); inbox = i; err = "" }
        catch (e: ApiError) { if (e.status == 401) onLogout() else err = errText(e) } catch (e: Exception) { err = errText(e) }
    }
    LaunchedEffect(Unit) { while (true) { load(); delay(6000) } }
    val chat = open
    if (chat != null) { BackHandler { open = null }; ChatScreen(key, inbox?.messages?.firstOrNull { it.id == chat.id } ?: chat, onBack = { open = null }, onChanged = { scope.launch { load() } }); return }
    if (settings) { BackHandler { settings = false }; SettingsScreen(store, inbox, onBack = { settings = false }, onLogout = onLogout); return }
    Column(Modifier.fillMaxSize().background(Bg)) {
        Column(Modifier.fillMaxWidth().background(HeaderBrush).statusBarsPadding().padding(horizontal = 20.dp, vertical = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(46.dp).clip(CircleShape).background(Color(0x33FFFFFF)), contentAlignment = Alignment.Center) { Icon(Icons.Filled.DirectionsCar, null, tint = Color.White) }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(inbox?.nickname?.ifBlank { null } ?: inbox?.name ?: "يا نشمي", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                    Text(if (inbox?.paused == true) "الاستقبال متوقف" else "الاستقبال شغّال", color = if (inbox?.paused == true) Color(0xFFFFB4BF) else Mint, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
                IconButton(onClick = { settings = true }) { Icon(Icons.Filled.QrCode2, "حسابي", tint = Color.White) }
            }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0x22FFFFFF)).padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("استقبال الرسائل", color = Color.White, modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                Switch(checked = inbox?.paused != true, onCheckedChange = { on -> scope.launch { try { Api.pause(key, !on); load() } catch (_: Exception) { } } },
                    colors = SwitchDefaults.colors(checkedTrackColor = Mint, checkedThumbColor = Night))
            }
        }
        if (err.isNotEmpty()) Text(err, color = Red, modifier = Modifier.padding(16.dp))
        val msgs = inbox?.messages ?: emptyList()
        if (inbox != null && msgs.isEmpty()) {
            Column(Modifier.fillMaxSize().padding(36.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Box(Modifier.size(84.dp).clip(CircleShape).background(Color(0xFFE3F1EA)), contentAlignment = Alignment.Center) { Icon(Icons.Filled.QrCode2, null, tint = Green, modifier = Modifier.size(44.dp)) }
                Spacer(Modifier.height(16.dp))
                Text("ما في رسائل لسا", fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Text("لما حدا يمسح رمز سيارتك بتظهر رسالته هون وبيوصلك تنبيه.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
                TextButton(onClick = { settings = true }) { Text("شوف رمز الستيكر", color = Green, fontWeight = FontWeight.Bold) }
            }
        } else {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(msgs, key = { it.id }) { m -> MessageCard(key, m, onOpen = { open = m }, onChanged = { scope.launch { load() } }) }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MessageCard(key: String, m: Msg, onOpen: () -> Unit, onChanged: () -> Unit) {
    val scope = rememberCoroutineScope()
    var blocked by remember { mutableStateOf(false) }
    val photo by rememberPhoto(key, m.id, m.photo)
    val fresh = m.reply == null
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Color.White).border(if (fresh) 1.5.dp else 1.dp, if (fresh) Green else Line, RoundedCornerShape(22.dp)).clickable { onOpen() }.padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(if (m.kind == "hit" || m.kind == "urgent") Color(0xFFF8E3E6) else Color(0xFFE3F1EA)), contentAlignment = Alignment.Center) {
                Icon(kindIcon(m.kind), null, tint = if (m.kind == "hit" || m.kind == "urgent") Red else Green)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("شخص مسكّر عليك", color = Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    if (fresh) Text("جديدة", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(99.dp)).background(Green).padding(horizontal = 9.dp, vertical = 2.dp))
                }
                Text(KINDS[m.kind] ?: m.kind, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 2.dp))
            }
        }
        if (!m.note.isNullOrBlank()) Text(m.note, modifier = Modifier.padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Bubble).padding(10.dp), fontSize = 14.sp)
        photo?.let { Image(it.asImageBitmap(), "صورة المشكلة", Modifier.padding(top = 10.dp).fillMaxWidth().heightIn(max = 210.dp).clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Crop) }
        Text(timeAgo(m.createdAt), color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
        if (m.reply != null) {
            Text("ردّك: ${REPLIES[m.reply] ?: m.reply}", color = Green, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
        } else {
            FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for ((k, label) in REPLIES) Text(label, color = Green, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(99.dp)).border(1.2.dp, Green, RoundedCornerShape(99.dp))
                    .clickable { scope.launch { try { Api.reply(key, m.id, k); onChanged() } catch (_: Exception) { } } }.padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onOpen) { Icon(Icons.Filled.ChatBubble, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(if (m.chat > 0) "المحادثة (${m.chat})" else "ردّ بكتابة أو صورة", fontWeight = FontWeight.Bold) }
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { scope.launch { try { Api.block(key, m.id); blocked = true } catch (_: Exception) { } } }, enabled = !blocked) { Text(if (blocked) "تم الحظر" else "حظر", color = Muted, fontSize = 13.sp) }
        }
    }
}

// ---------- chat (WhatsApp style) ----------

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ChatScreen(key: String, m: Msg, onBack: () -> Unit, onChanged: () -> Unit) {
    val scope = rememberCoroutineScope()
    var thread by remember { mutableStateOf<Thread?>(null) }
    var text by remember { mutableStateOf("") }; var err by remember { mutableStateOf("") }
    var camera by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val first by rememberPhoto(key, m.id, m.photo)
    suspend fun pull() { try { thread = Api.thread(key, m.id) } catch (_: Exception) { } }
    LaunchedEffect(m.id) { while (true) { pull(); delay(3000) } }
    val items = thread?.messages ?: emptyList()
    LaunchedEffect(items.size) { if (items.isNotEmpty()) listState.animateScrollToItem(items.size) }
    fun send(photo: String?) {
        val t = text.trim(); if (t.isEmpty() && photo == null) return
        sending = true; err = ""
        scope.launch { try { Api.say(key, m.id, t, photo); text = ""; pull() } catch (e: Exception) { err = errText(e) } finally { sending = false } }
    }
    if (camera) { CameraScreen { photo -> camera = false; if (photo != null) send(photo) }; return }
    Column(Modifier.fillMaxSize().background(Color(0xFFEFE7D6)).imePadding()) {
        Row(Modifier.fillMaxWidth().background(HeaderBrush).statusBarsPadding().padding(horizontal = 6.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "رجوع", tint = Color.White) }
            Box(Modifier.size(40.dp).clip(CircleShape).background(Color(0x33FFFFFF)), contentAlignment = Alignment.Center) { Icon(Icons.Filled.Person, null, tint = Color.White) }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("شخص مسكّر عليك", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(if (thread?.open == false) "انتهت المحادثة" else "رقمه مخفي", color = Color(0xFFB9D8C9), fontSize = 12.sp)
            }
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = listState, contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            item {
                Bubble(false, KINDS[m.kind] ?: m.kind, clock(m.createdAt), first, note = m.note)
            }
            if (m.reply != null) item { Bubble(true, REPLIES[m.reply] ?: m.reply, clock(m.repliedAt ?: m.createdAt), null) }
            items(items, key = { it.id }) { c ->
                val pic by rememberPhoto(key, c.id, c.photo)
                Bubble(c.mine, c.text, clock(c.t), pic)
            }
        }
        if (m.reply == null && thread?.open != false) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((k, label) in REPLIES) Text(label, color = Green, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(99.dp)).background(Color.White).border(1.dp, Green, RoundedCornerShape(99.dp))
                .clickable { scope.launch { try { Api.reply(key, m.id, k); onChanged() } catch (_: Exception) { } } }.padding(horizontal = 14.dp, vertical = 8.dp))
        }
        if (err.isNotEmpty()) Text(err, color = Red, fontSize = 12.sp, modifier = Modifier.background(Color.White).fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp))
        if (thread?.open != false) Row(Modifier.fillMaxWidth().background(Color.White).navigationBarsPadding().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { camera = true }, Modifier.size(46.dp).clip(CircleShape).background(Bubble)) { Icon(Icons.Filled.CameraAlt, "صوّر", tint = Ink) }
            Spacer(Modifier.width(8.dp))
            OutlinedTextField(text, { if (it.length <= 140) text = it }, Modifier.weight(1f), placeholder = { Text("اكتب رسالة…", color = Muted) }, shape = RoundedCornerShape(26.dp), maxLines = 3,
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Green, unfocusedBorderColor = Line, focusedContainerColor = Bg, unfocusedContainerColor = Bg))
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = { send(null) }, enabled = !sending && text.isNotBlank(), modifier = Modifier.size(48.dp).clip(CircleShape).background(if (text.isNotBlank()) Green else Line)) { Icon(Icons.AutoMirrored.Filled.Send, "أرسل", tint = Color.White) }
        }
    }
}

@Composable
fun Bubble(mine: Boolean, text: String, time: String, pic: Bitmap?, note: String? = null) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.Start else Arrangement.End) {
        Column(
            Modifier.widthIn(max = 270.dp).clip(RoundedCornerShape(topStart = if (mine) 4.dp else 16.dp, topEnd = if (mine) 16.dp else 4.dp, bottomStart = 16.dp, bottomEnd = 16.dp))
                .background(if (mine) Green else Color.White).padding(horizontal = 10.dp, vertical = 7.dp),
        ) {
            pic?.let { Image(it.asImageBitmap(), null, Modifier.padding(bottom = 6.dp).widthIn(max = 230.dp).heightIn(max = 260.dp).clip(RoundedCornerShape(10.dp)), contentScale = ContentScale.Crop) }
            if (text.isNotEmpty()) Text(text, color = if (mine) Color.White else Ink, fontSize = 15.sp)
            if (!note.isNullOrBlank()) Text(note, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
            Text(time, color = if (mine) Color(0xCCFFFFFF) else Muted, fontSize = 10.sp, modifier = Modifier.align(Alignment.End).padding(top = 2.dp))
        }
    }
}

// ---------- my account ----------

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
    Column(Modifier.fillMaxSize().background(Bg)) {
        Row(Modifier.fillMaxWidth().background(HeaderBrush).statusBarsPadding().padding(horizontal = 6.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "رجوع", tint = Color.White) }
            Column { Text("حسابي", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold); Text(inbox?.name ?: "", color = Color(0xFFB9D8C9), fontSize = 13.sp) }
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (token.isNotEmpty()) {
                val url = "https://yanashmi.com/c?t=$token"
                val bmp = remember(url) { qr(url) }
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color.White).border(1.dp, Line, RoundedCornerShape(24.dp)).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("رمز ستيكرك", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Image(bmp.asImageBitmap(), "رمز الستيكر", Modifier.padding(vertical = 12.dp).size(220.dp))
                    Text("YN-${token.uppercase()}", color = Muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text("اطبعه وحطه على زجاج السيارة.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                }
                OutlinedButton(onClick = { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url), "شارك")) }, Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) { Icon(Icons.Filled.Share, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("شارك رابط الرمز", fontWeight = FontWeight.Bold) }
            }
            OutlinedButton(onClick = onLogout, Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) { Text("تسجيل الخروج من هالجهاز", fontWeight = FontWeight.Bold) }
            Text("قبل ما تطلع، احفظ رابط صندوقك. بدونه ما بتقدر ترجع لحسابك.", color = Muted, fontSize = 12.sp)
            if (!confirmDelete) TextButton(onClick = { confirmDelete = true }) { Text("حذف حسابي نهائياً", color = Red, fontWeight = FontWeight.Bold) }
            else Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFFF8E3E6)).padding(14.dp)) {
                Text("رح ينحذف حسابك وكل رسائلك وصورك. ما في رجعة.", color = Red, fontWeight = FontWeight.SemiBold)
                Row(Modifier.padding(top = 8.dp)) {
                    Button(onClick = { scope.launch { try { Api.deleteAccount(store.key); onLogout() } catch (_: Exception) { } } }, colors = ButtonDefaults.buttonColors(containerColor = Red)) { Text("احذف") }
                    Spacer(Modifier.width(8.dp)); OutlinedButton(onClick = { confirmDelete = false }) { Text("إلغاء") }
                }
            }
            Text("سياسة الخصوصية: yanashmi.com/privacy", color = Muted, fontSize = 12.sp)
        }
    }
}
