package com.yanashmi.app

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.PersistableBundle
import android.provider.Settings
import android.util.LruCache
import androidx.core.app.NotificationManagerCompat
import android.widget.Toast
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

fun kindIcon(kind: String): ImageVector = when (kind) {
    "block" -> Icons.Filled.DirectionsCar; "urgent" -> Icons.Filled.Schedule; "lights" -> Icons.Filled.Lightbulb
    "open" -> Icons.Filled.Window; "fault" -> Icons.Filled.Build; "hit" -> Icons.Filled.ReportProblem; else -> Icons.Filled.Favorite
}

/** Pictures already fetched, so scrolling and polling never download one twice. Emptied on sign out. */
object Photos {
    private val cache = object : LruCache<String, Bitmap>(24 * 1024 * 1024) { override fun sizeOf(key: String, value: Bitmap) = value.byteCount }
    fun get(id: String): Bitmap? = cache.get(id)
    suspend fun load(key: String, id: String): Bitmap? = cache.get(id) ?: Api.photo(key, id)?.also { cache.put(id, it) }
    fun clear() = cache.evictAll()
}

@Composable
fun rememberPhoto(key: String, id: String, has: Boolean): State<Bitmap?> = produceState(Photos.get(id), id) { if (has && value == null) value = try { Photos.load(key, id) } catch (_: Exception) { null } }

/** Runs `block` every `everyMs`, but only while the app is on screen: nothing polls in the background (the worker does that). */
@Composable
fun PollWhileVisible(id: Any, everyMs: Long, block: suspend () -> Unit) {
    val owner = LocalLifecycleOwner.current
    LaunchedEffect(id) { owner.repeatOnLifecycle(Lifecycle.State.STARTED) { while (true) { block(); delay(everyMs) } } }
}

enum class Tab(val label: String, val icon: ImageVector) { Inbox("الرسائل", Icons.Filled.Notifications), Sticker("رمزي", Icons.Filled.QrCode2), Account("حسابي", Icons.Filled.Person) }

@Composable
fun HomeScreen(store: Store, onNewKey: (String) -> Unit, onLogout: () -> Unit) {
    val key = store.key
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    var inbox by remember { mutableStateOf<Inbox?>(null) }
    var err by remember { mutableStateOf("") }
    var tab by rememberSaveable { mutableStateOf(Tab.Inbox) }
    var open by remember { mutableStateOf<Msg?>(null) }
    suspend fun load() {
        try {
            val i = Api.inbox(key); inbox = i; err = ""
            val seen = store.seen.toMutableSet()
            val fresh = i.messages.filter { it.reply == null && seen.add(it.id) }
            if (fresh.isNotEmpty()) { store.seen = seen; fresh.filter { ringsNow(ctx, it) }.forEach { notifyMessage(ctx, it) } }
        }
        catch (e: ApiError) { if (e.status == 401) onLogout() else err = errText(e) } catch (e: Exception) { err = errText(e) }
    }
    PollWhileVisible(key, 10000) { load() }
    val chat = open
    if (chat != null) { BackHandler { open = null }; ChatScreen(key, inbox?.messages?.firstOrNull { it.id == chat.id } ?: chat, onBack = { open = null }, onChanged = { scope.launch { load() } }); return }
    if (tab != Tab.Inbox) BackHandler { tab = Tab.Inbox }
    HomeFrame(tab, onTab = { tab = it }, fresh = inbox?.messages?.count { it.reply == null } ?: 0) {
        when (tab) {
            Tab.Inbox -> InboxTab(key, inbox, err, onPause = { paused -> scope.launch { try { Api.pause(key, paused); load() } catch (e: Exception) { err = errText(e) } } },
                onOpen = { open = it }, onChanged = { scope.launch { load() } }, onSticker = { tab = Tab.Sticker })
            Tab.Sticker -> StickerTab(store.token)
            Tab.Account -> AccountTab(key, inbox, onNewKey, onLogout, Prefs.tone(ctx)) { t -> Prefs.setTone(ctx, t); Channels.ensure(ctx, t); Push.register(ctx) }
        }
    }
}

@Composable
fun HomeFrame(tab: Tab, onTab: (Tab) -> Unit, fresh: Int, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(Bg)) {
        Column(Modifier.weight(1f).fillMaxWidth(), content = content)
        HorizontalDivider(color = Line)
        Surface(color = Color.White) {
            NavigationBar(containerColor = Color.White, tonalElevation = 0.dp) {
                for (t in Tab.entries) NavigationBarItem(
                    selected = t == tab, onClick = { onTab(t) },
                    icon = { BadgedBox(badge = { if (t == Tab.Inbox && fresh > 0) Badge(containerColor = Red, contentColor = Color.White) { Text("$fresh") } }) { Icon(t.icon, t.label) } },
                    label = { Text(t.label, style = MaterialTheme.typography.labelSmall) },
                    colors = NavigationBarItemDefaults.colors(selectedIconColor = BrandDark, selectedTextColor = BrandDark, indicatorColor = BrandSoft, unselectedIconColor = Muted, unselectedTextColor = Muted),
                )
            }
        }
    }
}

// ---------- messages ----------

@Composable
fun InboxTab(key: String, inbox: Inbox?, err: String, onPause: (Boolean) -> Unit, onOpen: (Msg) -> Unit, onChanged: () -> Unit, onSticker: () -> Unit) {
    val msgs = inbox?.messages ?: emptyList()
    val paused = inbox?.paused == true
    TabHeader {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(18.dp)).background(Color(0x1FFFFFFF)), contentAlignment = Alignment.Center) { Icon(Icons.Filled.DirectionsCar, null, tint = Accent, modifier = Modifier.size(28.dp)) }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(inbox?.nickname?.ifBlank { null } ?: "سيارتي", color = Color.White, style = MaterialTheme.typography.headlineSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (paused) Text("متوقف", color = OnNight, style = MaterialTheme.typography.bodySmall)
            }
            Switch(checked = !paused, enabled = inbox != null, onCheckedChange = { on -> onPause(!on) },
                colors = SwitchDefaults.colors(checkedTrackColor = Accent, checkedThumbColor = Color.White, uncheckedTrackColor = Color(0x33FFFFFF), uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent))
        }
    }
    NotificationsOff()
    if (err.isNotEmpty()) Banner(err, Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp))
    when {
        inbox == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { if (err.isEmpty()) CircularProgressIndicator(color = Brand) }
        msgs.isEmpty() -> Column(Modifier.fillMaxSize().verticalScrollable().padding(horizontal = 48.dp, vertical = 90.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            IconBadge(Icons.Filled.NotificationsNone, size = 84.dp)
            Text("ما في رسائل", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(top = 16.dp, bottom = 20.dp))
            YnButton("رمز سيارتي", icon = Icons.Filled.QrCode2, onClick = onSticker)
        }
        else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            items(msgs, key = { it.id }) { m -> MessageCard(key, m, onOpen = { onOpen(m) }, onChanged = onChanged) }
        }
    }
}

private val SHORT_REPLY = mapOf("2" to "دقيقتين", "5" to "5 دقايق", "10" to "10 دقايق", "cant" to "ما بقدر")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MessageCard(key: String, m: Msg, onOpen: () -> Unit, onChanged: () -> Unit) {
    val scope = rememberCoroutineScope()
    var blocked by remember { mutableStateOf(false) }
    var ask by remember { mutableStateOf<Moderate?>(null) }
    var sending by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    val photo by rememberPhoto(key, m.id, m.photo)
    val fresh = m.reply == null
    val urgent = m.kind == "hit" || m.kind == "urgent"
    YnCard(onClick = onOpen, border = if (fresh) (if (urgent) Red else Accent) else Color.Transparent) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBadge(kindIcon(m.kind), if (urgent) Red else Brand, if (urgent) RedSoft else BrandSoft, 42.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(KINDS[m.kind] ?: m.kind, style = MaterialTheme.typography.titleSmall)
                Text(timeAgo(m.createdAt), color = Muted, style = MaterialTheme.typography.bodySmall)
            }
            ModerationMenu(blocked, Muted) { ask = it }
        }
        if (!m.note.isNullOrBlank()) Text(m.note, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Bubble).padding(10.dp))
        photo?.let { Image(it.asImageBitmap(), "صورة المشكلة", Modifier.padding(top = 10.dp).fillMaxWidth().heightIn(max = 210.dp).clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Crop) }
        if (fresh) {
            FlowRow(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for ((k, label) in SHORT_REPLY) {
                    val main = k == "2"
                    Text(label, color = if (main) Color.White else BrandDark, textAlign = TextAlign.Center, style = MaterialTheme.typography.labelMedium, maxLines = 1,
                        modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (main) Brand else BrandSoft)
                            .clickable(enabled = !sending) { err = ""; sending = true; scope.launch { try { Api.reply(key, m.id, k); onChanged() } catch (e: Exception) { err = errText(e) } finally { sending = false } } }.padding(horizontal = 10.dp, vertical = 11.dp))
                }
            }
        }
        if (err.isNotEmpty()) Banner(err, Modifier.padding(top = 8.dp))
        if (!fresh) Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.CheckCircle, null, tint = Brand, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(6.dp))
            Text(REPLIES[m.reply] ?: m.reply ?: "", color = BrandDark, style = MaterialTheme.typography.labelMedium)
        }
        YnButton(if (m.chat > 0) "المحادثة (${m.chat})" else "افتح المحادثة", Modifier.padding(top = 10.dp), style = BtnStyle.Outline, icon = Icons.Filled.ChatBubble, height = 48.dp, onClick = onOpen)
    }
    ask?.let { what -> ModerationDialog(what, key, m.id, onDone = { blocked = true }, onError = { err = it }) { ask = null } }
}

/** Shown only while the phone blocks this app's notifications; checked again whenever the app comes back. */
@Composable
fun NotificationsOff() {
    val ctx = LocalContext.current
    var off by remember { mutableStateOf(false) }
    PollWhileVisible("notifications", 2000) { off = !NotificationManagerCompat.from(ctx).areNotificationsEnabled() }
    if (off) YnButton("فعّل الإشعارات", Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp), icon = Icons.Filled.NotificationsOff, height = 50.dp) {
        try { ctx.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)) } catch (_: Exception) { }
    }
}

// ---------- my sticker ----------

@Composable
fun StickerTab(token: String) {
    val ctx = LocalContext.current
    TabHeader { Text("رمزي", color = Color.White, style = MaterialTheme.typography.headlineSmall) }
    Column(Modifier.fillMaxSize().verticalScrollable().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (token.isEmpty()) {
            Banner("افتح رمزك من الموقع.", icon = Icons.Filled.Info, tint = Brand, back = BrandSoft)
        } else {
            val bmp = remember(token) { qr(scanUrl(token)) }
            val shape = RoundedCornerShape(28.dp)
            Column(Modifier.widthIn(max = 300.dp).fillMaxWidth().shadow(14.dp, shape).clip(shape).background(Color.White), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(Modifier.fillMaxWidth().background(HeroBrush).padding(vertical = 14.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    StarMark(24); Spacer(Modifier.width(8.dp)); Text("يا نشمي", color = Color.White, style = MaterialTheme.typography.titleLarge)
                }
                Image(bmp.asImageBitmap(), "رمز الستيكر", Modifier.padding(top = 14.dp, start = 24.dp, end = 24.dp).fillMaxWidth().aspectRatio(1f))
                Text("امسحني", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
                Text("YN-${token.uppercase()}", color = Muted, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(bottom = 16.dp))
            }
            YnButton("شارك للطباعة", icon = Icons.Filled.Share) { try { shareSticker(ctx, token) } catch (_: Exception) { Toast.makeText(ctx, "ما زبط، جرّب كمان مرة", Toast.LENGTH_SHORT).show() } }
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
private fun SettingRow(icon: ImageVector, title: String, tint: Color = Ink, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp)); Spacer(Modifier.width(14.dp))
        Text(title, style = MaterialTheme.typography.titleSmall, color = tint, modifier = Modifier.weight(1f))
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Muted)
    }
}

private enum class Ask { Rotate, Logout, Delete }

@Composable
fun AccountTab(key: String, inbox: Inbox?, onNewKey: (String) -> Unit, onLogout: () -> Unit, tone: Tone = Tone.Nashmi, onTone: (Tone) -> Unit = {}) {
    val ctx = LocalContext.current; val scope = rememberCoroutineScope()
    var ask by remember { mutableStateOf<Ask?>(null) }
    var note by remember { mutableStateOf("") }
    var err by remember { mutableStateOf("") }
    var chosen by remember(tone) { mutableStateOf(tone) }
    var picking by remember { mutableStateOf(false) }
    fun link(k: String) = "https://yanashmi.com/inbox.html#$k"
    TabHeader {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(52.dp).clip(CircleShape).background(Accent), contentAlignment = Alignment.Center) { Text(inbox?.name?.take(1) ?: "ي", color = Night, style = MaterialTheme.typography.headlineSmall) }
            Spacer(Modifier.width(14.dp))
            Text(inbox?.name ?: "حسابي", color = Color.White, style = MaterialTheme.typography.headlineSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
    Column(Modifier.fillMaxSize().verticalScrollable().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (err.isNotEmpty()) Banner(err)
        if (note.isNotEmpty()) Banner(note, icon = Icons.Filled.CheckCircle, tint = Brand, back = BrandSoft)
        YnCard(padding = 0.dp) {
            SettingRow(Icons.Filled.MusicNote, "الصوت: ${chosen.label}") { picking = true }
        }
        YnCard(padding = 0.dp) {
            SettingRow(Icons.Filled.Link, "انسخ رابطي") { copySecret(ctx, link(key)); err = ""; note = "انتسخ" }
            HorizontalDivider(color = Line)
            SettingRow(Icons.Filled.Autorenew, "غيّر الرابط") { ask = Ask.Rotate }
            HorizontalDivider(color = Line)
            SettingRow(Icons.Filled.Shield, "الخصوصية") { try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yanashmi.com/privacy"))) } catch (_: Exception) { } }
            HorizontalDivider(color = Line)
            SettingRow(Icons.Filled.Description, "الشروط") { try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yanashmi.com/terms"))) } catch (_: Exception) { } }
        }
        YnCard(padding = 0.dp) {
            SettingRow(Icons.AutoMirrored.Filled.Logout, "تسجيل الخروج") { ask = Ask.Logout }
            HorizontalDivider(color = Line)
            SettingRow(Icons.Filled.DeleteForever, "حذف الحساب", Red) { ask = Ask.Delete }
        }
    }
    if (picking) AlertDialog(
        onDismissRequest = { picking = false }, containerColor = Color.White, title = { Text("صوت الإشعار") },
        text = {
            Column {
                for (t in Tone.entries) Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { chosen = t; Channels.preview(ctx, t) }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(chosen == t, { chosen = t; Channels.preview(ctx, t) }, colors = RadioButtonDefaults.colors(selectedColor = Brand))
                    Text(t.label, style = MaterialTheme.typography.titleMedium)
                }
            }
        },
        confirmButton = { TextButton(onClick = { picking = false; onTone(chosen) }) { Text("تمام", color = Brand) } },
        dismissButton = { TextButton(onClick = { picking = false; chosen = tone }) { Text("إلغاء") } },
    )
    val a = ask ?: return
    val (title, body, go) = when (a) {
        Ask.Rotate -> Triple("تغيّر الرابط؟", "بتطلع كل الأجهزة التانية.", "غيّره")
        Ask.Logout -> Triple("خروج؟", "بدون جوجل، انسخ رابطك أول.", "اطلع")
        Ask.Delete -> Triple("حذف الحساب؟", "ما في رجعة.", "احذف")
    }
    AlertDialog(
        onDismissRequest = { ask = null }, containerColor = Color.White, title = { Text(title) }, text = { Text(body) },
        confirmButton = {
            TextButton(onClick = {
                ask = null; err = ""; note = ""
                if (a == Ask.Logout) onLogout() else scope.launch {
                    try {
                        if (a == Ask.Delete) { Api.deleteAccount(key); onLogout() }
                        else { val fresh = Api.rotate(key); onNewKey(fresh); copySecret(ctx, link(fresh)) }
                    } catch (e: Exception) { err = errText(e) }
                }
            }) { Text(go, color = if (a == Ask.Delete) Red else Brand) }
        },
        dismissButton = { TextButton(onClick = { ask = null }) { Text("إلغاء") } },
    )
}

/** Ring for a message that just arrived, unless the phone already shows it (it came as an instant notification). */
fun ringsNow(ctx: Context, m: Msg, now: Long = System.currentTimeMillis() / 1000): Boolean =
    now - m.createdAt < 600 && ctx.getSystemService(android.app.NotificationManager::class.java).activeNotifications.none { it.tag == "yn-${m.id}" }
