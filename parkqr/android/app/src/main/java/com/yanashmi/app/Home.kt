package com.yanashmi.app

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color as AColor
import android.net.Uri
import android.os.PersistableBundle
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

fun kindIcon(kind: String): ImageVector = when (kind) {
    "block" -> Icons.Filled.DirectionsCar; "urgent" -> Icons.Filled.Schedule; "lights" -> Icons.Filled.Lightbulb
    "open" -> Icons.Filled.Window; "fault" -> Icons.Filled.Build; "hit" -> Icons.Filled.ReportProblem; else -> Icons.Filled.Favorite
}

@Composable
fun rememberPhoto(key: String, id: String, has: Boolean): State<Bitmap?> = produceState<Bitmap?>(null, id) { if (has) value = try { Api.photo(key, id) } catch (_: Exception) { null } }

enum class Tab(val label: String, val icon: ImageVector) { Inbox("الرسائل", Icons.Filled.Notifications), Sticker("رمزي", Icons.Filled.QrCode2), Account("حسابي", Icons.Filled.Person) }

@Composable
fun HomeScreen(store: Store, onLogout: () -> Unit) {
    val key = store.key
    val scope = rememberCoroutineScope()
    var inbox by remember { mutableStateOf<Inbox?>(null) }
    var err by remember { mutableStateOf("") }
    var tab by remember { mutableStateOf(Tab.Inbox) }
    var open by remember { mutableStateOf<Msg?>(null) }
    suspend fun load() {
        try { val i = Api.inbox(key); inbox = i; err = "" }
        catch (e: ApiError) { if (e.status == 401) onLogout() else err = errText(e) } catch (e: Exception) { err = errText(e) }
    }
    LaunchedEffect(Unit) { while (true) { load(); delay(6000) } }
    val chat = open
    if (chat != null) { BackHandler { open = null }; ChatScreen(key, inbox?.messages?.firstOrNull { it.id == chat.id } ?: chat, onBack = { open = null }, onChanged = { scope.launch { load() } }); return }
    if (tab != Tab.Inbox) BackHandler { tab = Tab.Inbox }
    HomeFrame(tab, onTab = { tab = it }, fresh = inbox?.messages?.count { it.reply == null } ?: 0) {
        when (tab) {
            Tab.Inbox -> InboxTab(key, inbox, err, onPause = { paused -> scope.launch { try { Api.pause(key, paused); load() } catch (e: Exception) { err = errText(e) } } },
                onOpen = { open = it }, onChanged = { scope.launch { load() } }, onSticker = { tab = Tab.Sticker })
            Tab.Sticker -> StickerTab(store.token)
            Tab.Account -> AccountTab(store.key, inbox, onLogout)
        }
    }
}

@Composable
fun HomeFrame(tab: Tab, onTab: (Tab) -> Unit, fresh: Int, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(Bg)) {
        Column(Modifier.weight(1f).fillMaxWidth(), content = content)
        Surface(color = Color.White, shadowElevation = 16.dp) {
            NavigationBar(containerColor = Color.White, tonalElevation = 0.dp) {
                for (t in Tab.entries) NavigationBarItem(
                    selected = t == tab, onClick = { onTab(t) },
                    icon = { BadgedBox(badge = { if (t == Tab.Inbox && fresh > 0) Badge(containerColor = Red, contentColor = Color.White) { Text("$fresh") } }) { Icon(t.icon, t.label) } },
                    label = { Text(t.label, style = MaterialTheme.typography.labelSmall) },
                    colors = NavigationBarItemDefaults.colors(selectedIconColor = GreenDark, selectedTextColor = GreenDark, indicatorColor = MintSoft, unselectedIconColor = Muted, unselectedTextColor = Muted),
                )
            }
        }
    }
}

/** The dark top of every tab: lattice, rounded bottom corners. */
@Composable
fun TabHeader(content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp)).background(HeroBrush)) {
        Lattice(Modifier.matchParentSize())
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 22.dp, vertical = 18.dp), content = content)
    }
}

// ---------- messages ----------

@Composable
fun InboxTab(key: String, inbox: Inbox?, err: String, onPause: (Boolean) -> Unit, onOpen: (Msg) -> Unit, onChanged: () -> Unit, onSticker: () -> Unit) {
    val msgs = inbox?.messages ?: emptyList()
    val paused = inbox?.paused == true
    TabHeader {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("أهلاً " + (inbox?.name?.substringBefore(' ') ?: "يا نشمي"), color = OnNight, style = MaterialTheme.typography.bodyMedium)
                Text(inbox?.nickname?.ifBlank { null } ?: "سيارتي", color = Color.White, style = MaterialTheme.typography.headlineMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            StarMark(40)
        }
        Row(
            Modifier.padding(top = 14.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color(0x1AFFFFFF)).border(1.dp, Color(0x24FFFFFF), RoundedCornerShape(20.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(if (paused) Color(0xFFFF8DA1) else Mint))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(if (paused) "الاستقبال متوقف" else "سيارتك متاحة", color = Color.White, style = MaterialTheme.typography.titleMedium)
                Text(if (paused) "ما حدا بيقدر يبعتلك هلأ" else "جاهز تستقبل التنبيهات", color = OnNight, style = MaterialTheme.typography.bodySmall)
            }
            Switch(checked = !paused, enabled = inbox != null, onCheckedChange = { on -> onPause(!on) },
                colors = SwitchDefaults.colors(checkedTrackColor = Color(0xFF1DB877), checkedThumbColor = Color.White, uncheckedTrackColor = Color(0x33FFFFFF), uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent))
        }
    }
    if (err.isNotEmpty()) Banner(err, Modifier.padding(start = 18.dp, end = 18.dp, top = 14.dp))
    when {
        inbox == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { if (err.isEmpty()) CircularProgressIndicator(color = Green) }
        msgs.isEmpty() -> Column(Modifier.fillMaxSize().verticalScrollable().padding(horizontal = 36.dp, vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            IconBadge(Icons.Filled.NotificationsNone, size = 92.dp)
            Text("كل شي هادي", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(top = 18.dp))
            Text("لما حدا يمسح رمز سيارتك بتظهر رسالته هون وبيوصلك تنبيه.", color = Muted, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 6.dp, bottom = 22.dp))
            YnButton("شوف رمز الستيكر", icon = Icons.Filled.QrCode2, onClick = onSticker)
        }
        else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            items(msgs, key = { it.id }) { m -> MessageCard(key, m, onOpen = { onOpen(m) }, onChanged = onChanged) }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MessageCard(key: String, m: Msg, onOpen: () -> Unit, onChanged: () -> Unit) {
    val scope = rememberCoroutineScope()
    var blocked by remember { mutableStateOf(false) }
    var askBlock by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    val photo by rememberPhoto(key, m.id, m.photo)
    val fresh = m.reply == null
    val urgent = m.kind == "hit" || m.kind == "urgent"
    YnCard(onClick = onOpen, border = if (fresh) (if (urgent) Red.copy(alpha = .45f) else Green.copy(alpha = .45f)) else Line) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBadge(kindIcon(m.kind), if (urgent) Red else Green, if (urgent) RedSoft else MintSoft)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(KINDS[m.kind] ?: m.kind, style = MaterialTheme.typography.titleMedium)
                Text(timeAgo(m.createdAt) + " · رقمه مخفي", color = Muted, style = MaterialTheme.typography.bodySmall)
            }
            if (fresh) {
                Spacer(Modifier.width(8.dp))
                Text(if (urgent) "عاجل" else "جديدة", color = Color.White, style = MaterialTheme.typography.labelSmall, modifier = Modifier.clip(RoundedCornerShape(99.dp)).background(if (urgent) Red else Green).padding(horizontal = 10.dp, vertical = 3.dp))
            }
        }
        if (!m.note.isNullOrBlank()) Text(m.note, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 12.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Bubble).padding(12.dp))
        photo?.let { Image(it.asImageBitmap(), "صورة المشكلة", Modifier.padding(top = 12.dp).fillMaxWidth().heightIn(max = 210.dp).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop) }
        if (m.reply != null) {
            Row(Modifier.padding(top = 12.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(MintSoft).padding(horizontal = 12.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.CheckCircle, null, tint = Green, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp))
                Text("ردّك: ${REPLIES[m.reply] ?: m.reply}", color = GreenDark, style = MaterialTheme.typography.labelMedium)
            }
        } else {
            Text("ردّ بضغطة", color = Muted, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 14.dp, bottom = 8.dp))
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = 2) {
                for ((k, label) in REPLIES) {
                    val main = k == "2"
                    Text(label.replace("ما بقدر الآن، رجاءً استنى", "ما بقدر هلأ، استنى"), color = if (main) Color.White else GreenDark, textAlign = TextAlign.Center, style = MaterialTheme.typography.labelMedium, maxLines = 1,
                        modifier = Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(if (main) Green else MintSoft)
                            .clickable { err = ""; scope.launch { try { Api.reply(key, m.id, k); onChanged() } catch (e: Exception) { err = errText(e) } } }.padding(horizontal = 8.dp, vertical = 11.dp))
                }
            }
        }
        if (err.isNotEmpty()) Banner(err, Modifier.padding(top = 8.dp))
        HorizontalDivider(Modifier.padding(top = 12.dp), color = Line)
        Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onOpen) { Icon(Icons.Filled.ChatBubbleOutline, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(if (m.chat > 0) "المحادثة (${m.chat})" else "اكتب أو صوّر", style = MaterialTheme.typography.labelMedium) }
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { askBlock = true }, enabled = !blocked) {
                Icon(Icons.Filled.Block, null, Modifier.size(16.dp), tint = Muted); Spacer(Modifier.width(6.dp))
                Text(if (blocked) "تم الحظر" else "حظر", color = Muted, style = MaterialTheme.typography.labelMedium)
            }
        }
    }
    if (askBlock) AlertDialog(
        onDismissRequest = { askBlock = false }, containerColor = Color.White,
        title = { Text("تحظر هالشخص؟") }, text = { Text("ما رح توصلك رسائل منه بعد هلأ، وهو ما رح يعرف.") },
        confirmButton = { TextButton(onClick = { askBlock = false; scope.launch { try { Api.block(key, m.id); blocked = true } catch (e: Exception) { err = errText(e) } } }) { Text("احظر", color = Red) } },
        dismissButton = { TextButton(onClick = { askBlock = false }) { Text("إلغاء") } },
    )
}

// ---------- my sticker ----------

private fun qr(text: String): Bitmap {
    val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 640, 640, mapOf(EncodeHintType.MARGIN to 1))
    val bmp = Bitmap.createBitmap(m.width, m.height, Bitmap.Config.ARGB_8888)
    for (x in 0 until m.width) for (y in 0 until m.height) bmp.setPixel(x, y, if (m[x, y]) AColor.BLACK else AColor.WHITE)
    return bmp
}

@Composable
fun StickerTab(token: String) {
    val ctx = LocalContext.current
    TabHeader {
        Text("رمز سيارتك", color = Color.White, style = MaterialTheme.typography.headlineMedium)
        Text("اطبعه وحطه على الزجاج من جوّا.", color = OnNight, style = MaterialTheme.typography.bodyMedium)
    }
    Column(Modifier.fillMaxSize().verticalScrollable().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (token.isEmpty()) {
            Banner("دخلت بالرابط، فالرمز مش محفوظ على هالجهاز. افتحه من صندوقك على الموقع.", icon = Icons.Filled.Info, tint = Green, back = MintSoft)
        } else {
            val url = "https://yanashmi.com/c?t=$token"
            val bmp = remember(url) { qr(url) }
            val shape = RoundedCornerShape(28.dp)
            Column(Modifier.widthIn(max = 300.dp).fillMaxWidth().shadow(18.dp, shape).clip(shape).background(Color.White), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(Modifier.fillMaxWidth().background(HeroBrush).padding(vertical = 12.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    StarMark(24); Spacer(Modifier.width(8.dp)); Text("يا نشمي", color = Color.White, style = MaterialTheme.typography.titleLarge)
                }
                Image(bmp.asImageBitmap(), "رمز الستيكر", Modifier.padding(top = 14.dp, start = 22.dp, end = 22.dp).fillMaxWidth().aspectRatio(1f))
                Text("مسكّر عليّ؟ امسح الرمز", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
                Text("YN-${token.uppercase()}", color = Muted, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(bottom = 16.dp))
            }
            YnButton("شارك رابط الرمز", icon = Icons.Filled.Share) { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url), "شارك")) }
        }
    }
}

// ---------- my account ----------

/** The inbox link is the key to the account, so it is marked sensitive: Android then hides it in the clipboard preview. */
private fun copySecret(ctx: Context, text: String) {
    val clip = ClipData.newPlainText("yanashmi", text)
    clip.description.extras = PersistableBundle().apply { putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true) }
    ctx.getSystemService(ClipboardManager::class.java).setPrimaryClip(clip)
}

@Composable
private fun SettingRow(icon: ImageVector, title: String, subtitle: String? = null, tint: Color = Green, back: Color = MintSoft, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
        IconBadge(icon, tint, back, 40.dp); Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = if (tint == Red) Red else Ink)
            if (subtitle != null) Text(subtitle, color = Muted, style = MaterialTheme.typography.bodySmall)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Muted)
    }
}

@Composable
fun AccountTab(key: String, inbox: Inbox?, onLogout: () -> Unit) {
    val ctx = LocalContext.current; val scope = rememberCoroutineScope()
    var confirmDelete by remember { mutableStateOf(false) }
    var confirmLogout by remember { mutableStateOf(false) }
    var copied by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    TabHeader {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(58.dp).clip(CircleShape).background(MintBrush), contentAlignment = Alignment.Center) { Text(inbox?.name?.take(1) ?: "ي", color = Night, style = MaterialTheme.typography.headlineMedium) }
            Spacer(Modifier.width(14.dp))
            Column {
                Text(inbox?.name ?: "حسابي", color = Color.White, style = MaterialTheme.typography.headlineSmall)
                Text(inbox?.nickname?.ifBlank { null } ?: "سيارتي", color = OnNight, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
    Column(Modifier.fillMaxSize().verticalScrollable().padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (err.isNotEmpty()) Banner(err)
        YnCard(padding = 0.dp) {
            SettingRow(Icons.Filled.Link, if (copied) "انتسخ الرابط" else "انسخ رابط صندوقي", "مفتاح حسابك. احفظه وما تبعته لحدا.") { copySecret(ctx, "https://yanashmi.com/inbox.html#$key"); copied = true }
            HorizontalDivider(color = Line)
            SettingRow(Icons.Filled.Shield, "سياسة الخصوصية", "yanashmi.com/privacy") { try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yanashmi.com/privacy"))) } catch (_: Exception) { } }
        }
        YnCard(padding = 0.dp) {
            SettingRow(Icons.AutoMirrored.Filled.Logout, "تسجيل الخروج", "من هالجهاز بس") { confirmLogout = true }
            HorizontalDivider(color = Line)
            SettingRow(Icons.Filled.DeleteForever, "حذف حسابي نهائياً", tint = Red, back = RedSoft) { confirmDelete = true }
        }
    }
    if (confirmLogout) AlertDialog(
        onDismissRequest = { confirmLogout = false }, containerColor = Color.White,
        title = { Text("تطلع من الحساب؟") }, text = { Text("احفظ رابط صندوقك أول. إذا ما سجّلت بجوجل، ما بترجع لحسابك بدونه.") },
        confirmButton = { TextButton(onClick = { confirmLogout = false; onLogout() }) { Text("اطلع") } },
        dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("إلغاء") } },
    )
    if (confirmDelete) AlertDialog(
        onDismissRequest = { confirmDelete = false }, containerColor = Color.White,
        title = { Text("حذف الحساب نهائياً؟") }, text = { Text("رح ينحذف حسابك وكل رسائلك وصورك. ما في رجعة.") },
        confirmButton = { TextButton(onClick = { confirmDelete = false; scope.launch { try { Api.deleteAccount(key); onLogout() } catch (e: Exception) { err = errText(e) } } }) { Text("احذف", color = Red) } },
        dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("إلغاء") } },
    )
}
