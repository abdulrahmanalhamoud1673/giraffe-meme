package com.yanashmi.app

import android.graphics.Bitmap
import androidx.compose.animation.animateContentSize
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun clock(t: Long) = SimpleDateFormat("hh:mm a", Locale("ar")).format(Date(t * 1000))

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
    PollWhileVisible(m.id, 4000) { pull() }
    val items = thread?.messages ?: emptyList()
    LaunchedEffect(items.size) { if (items.isNotEmpty()) listState.animateScrollToItem(items.size) }
    fun send(photo: String?) {
        val t = text.trim(); if (t.isEmpty() && photo == null) return
        sending = true; err = ""
        scope.launch { try { Api.say(key, m.id, t, photo); text = ""; pull() } catch (e: Exception) { err = errText(e) } finally { sending = false } }
    }
    if (camera) { CameraScreen { photo -> camera = false; if (photo != null) send(photo) }; return }
    Column(Modifier.fillMaxSize().background(Bg).imePadding()) {
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp)).background(HeroBrush).statusBarsPadding().padding(horizontal = 6.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "رجوع", tint = Color.White) }
            Box(Modifier.size(42.dp).clip(CircleShape).background(Color(0x1FFFFFFF)), contentAlignment = Alignment.Center) { Icon(Icons.Filled.Person, null, tint = Mint) }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("شخص عند سيارتك", color = Color.White, style = MaterialTheme.typography.titleMedium)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Shield, null, tint = Mint, modifier = Modifier.size(13.dp)); Spacer(Modifier.width(4.dp))
                    Text(if (thread?.open == false) "انتهت المحادثة" else "محادثة محمية · رقمكم مخفي", color = OnNight, style = MaterialTheme.typography.bodySmall)
                }
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
            for ((k, label) in REPLIES) Text(label, color = Green, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(99.dp)).background(Color.White).border(1.dp, Line, RoundedCornerShape(99.dp))
                .clickable { scope.launch { try { Api.reply(key, m.id, k); onChanged() } catch (_: Exception) { } } }.padding(horizontal = 14.dp, vertical = 8.dp))
        }
        if (err.isNotEmpty()) Text(err, color = Red, fontSize = 12.sp, modifier = Modifier.background(Color.White).fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp))
        if (thread?.open != false) Row(Modifier.fillMaxWidth().background(Color.White).navigationBarsPadding().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { camera = true }, Modifier.size(46.dp).clip(CircleShape).background(MintSoft)) { Icon(Icons.Filled.CameraAlt, "صوّر", tint = GreenDark) }
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
                .background(if (mine) Green else Color.White).animateContentSize().padding(horizontal = 10.dp, vertical = 7.dp),
        ) {
            pic?.let { Image(it.asImageBitmap(), null, Modifier.padding(bottom = 6.dp).widthIn(max = 230.dp).heightIn(max = 260.dp).clip(RoundedCornerShape(10.dp)), contentScale = ContentScale.Crop) }
            if (text.isNotEmpty()) Text(text, color = if (mine) Color.White else Ink, fontSize = 15.sp)
            if (!note.isNullOrBlank()) Text(note, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
            Text(time, color = if (mine) Color(0xCCFFFFFF) else Muted, fontSize = 10.sp, modifier = Modifier.align(Alignment.End).padding(top = 2.dp))
        }
    }
}
