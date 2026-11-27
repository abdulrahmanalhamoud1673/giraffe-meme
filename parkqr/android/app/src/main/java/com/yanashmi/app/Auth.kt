package com.yanashmi.app

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import kotlinx.coroutines.launch

fun Modifier.verticalScrollable(): Modifier = composed { verticalScroll(rememberScrollState()) }

enum class AuthStep { Welcome, Car, Link }

@Composable
fun AuthScreen(onDone: (String, String) -> Unit) {
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    var step by remember { mutableStateOf(AuthStep.Welcome) }
    val form = remember { CarForm() }
    var link by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }; var err by remember { mutableStateOf("") }

    fun go(s: AuthStep) { step = s; err = "" }
    fun run(block: suspend () -> Unit) {
        err = ""; busy = true
        scope.launch {
            try { block() }
            catch (_: GetCredentialCancellationException) { }
            catch (_: NoCredentialException) { err = "ما لقينا حساب جوجل على الموبايل. ضيف حساب من الإعدادات وجرّب." }
            catch (_: GetCredentialException) { err = "ما زبط الدخول بجوجل. جرّب كمان مرة." }
            catch (e: Exception) { err = errText(e) }
            finally { busy = false }
        }
    }
    fun google() = run {
        val token = googleIdToken(ctx)
        val r = Api.google(token)
        val a = r.account
        if (a != null) onDone(a.token, a.key) else { form.idToken = token; form.name = r.name; step = AuthStep.Car }
    }
    fun finish() = run {
        val problem = form.problem()
        if (problem != null) { err = problem; return@run }
        try {
            val a = Api.google(form.idToken, form.nickname, form.phone.trim()).account ?: throw ApiError(401, "bad_token")
            onDone(a.token, a.key)
        } catch (e: ApiError) {
            if (e.code != "bad_token") throw e
            step = AuthStep.Welcome; err = errText(e)       // the Google pass expires after an hour
        }
    }
    fun openInbox() = run {
        val m = Regex("([a-zA-Z0-9]{16,40})\\s*$").find(link.trim())
        if (m == null) { err = "الرابط مش صحيح. انسخه كامل."; return@run }
        val k = m.groupValues[1].lowercase(); Api.inbox(k); onDone("", k)
    }

    if (step != AuthStep.Welcome) BackHandler { go(AuthStep.Welcome) }
    when (step) {
        AuthStep.Welcome -> WelcomeScreen(busy, err, onGoogle = ::google, onLink = { go(AuthStep.Link) })
        AuthStep.Car -> CarScreen(form, busy, err, onBack = { go(AuthStep.Welcome) }, onSubmit = ::finish)
        AuthStep.Link -> LinkScreen(link, { link = it }, busy, err, onBack = { go(AuthStep.Welcome) }, onOpen = ::openInbox)
    }
}

// ---------- welcome ----------

@Composable
fun WelcomeScreen(busy: Boolean, err: String, onGoogle: () -> Unit, onLink: () -> Unit, still: Float? = null) {
    val ctx = LocalContext.current
    Column(Modifier.fillMaxSize().background(NightBrush).statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(vertical = 14.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            StarMark(28); Spacer(Modifier.width(8.dp)); Text("يا نشمي", color = Color.White, style = MaterialTheme.typography.titleLarge)
        }
        Story(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 18.dp), still)
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp)).background(Color.White).navigationBarsPadding().padding(horizontal = 22.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (err.isNotEmpty()) Banner(err)
            YnButton("ابدأ بحساب جوجل", busy = busy, leading = {
                Box(Modifier.size(28.dp).clip(CircleShape).background(Color.White), contentAlignment = Alignment.Center) { Image(painterResource(R.drawable.ic_google), null, Modifier.size(18.dp)) }
            }, onClick = onGoogle)
            TextButton(onClick = onLink, enabled = !busy) { Text("عندي رابط حساب", style = MaterialTheme.typography.labelLarge) }
            Text("بالمتابعة بتوافق على سياسة الخصوصية", color = Muted, style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.clickable { try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yanashmi.com/privacy"))) } catch (_: Exception) { } }.padding(4.dp))
        }
    }
}

// ---------- phone and car: the only two things asked ----------

val CAR_MAKES = listOf("تويوتا", "هيونداي", "كيا", "نيسان", "هوندا", "مرسيدس", "بي إم دبليو", "تسلا", "بي واي دي", "غيرها")
val CAR_COLORS = listOf(
    "بيضاء" to Color(0xFFFFFFFF), "سوداء" to Color(0xFF14171A), "فضية" to Color(0xFFC7CDD1), "رمادية" to Color(0xFF6F777D),
    "حمراء" to Color(0xFFC62835), "زرقاء" to Color(0xFF1E5FBF), "خضراء" to Color(0xFF23704A), "ذهبية" to Color(0xFFC9A55C),
)

class CarForm {
    var phone by mutableStateOf("")
    var make by mutableStateOf(""); var color by mutableStateOf("")
    var other by mutableStateOf("")     // typed when the make is not in the list
    var idToken by mutableStateOf("")
    var name by mutableStateOf("")      // from the Google account, only used to greet

    /** What people who scan the sticker see, e.g. "تويوتا بيضاء". */
    val nickname: String get() = listOf(if (make == "غيرها") other.trim() else make, color).filter { it.isNotBlank() }.joinToString(" ")

    fun problem(): String? = when {
        phone.isBlank() -> "اكتب رقم موبايلك."
        make.isBlank() || (make == "غيرها" && other.isBlank()) -> "اختار نوع سيارتك."
        color.isBlank() -> "اختار لون سيارتك."
        else -> null
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CarScreen(f: CarForm, busy: Boolean, err: String, onBack: () -> Unit, onSubmit: () -> Unit) {
    val first = f.name.trim().substringBefore(' ')
    SheetScreen(
        if (first.isEmpty()) "أهلاً" else "أهلاً $first",
        "ضل رقمك وسيارتك",
        onBack,
        bottom = {
            if (err.isNotEmpty()) Banner(err)
            YnButton("جهّز ملصقي", busy = busy, onClick = onSubmit)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Lock, null, tint = Muted, modifier = Modifier.size(13.dp)); Spacer(Modifier.width(5.dp))
                Text("بالمتابعة بتوافق على حفظ رقمك. ما حدا بيشوفه.", color = Muted, style = MaterialTheme.typography.labelSmall)
            }
        },
    ) {
        YnField(f.phone, { f.phone = digits(it) }, "رقم الموبايل", placeholder = "07X XXX XXXX", keyboard = KeyboardType.Phone, icon = Icons.Filled.PhoneAndroid, ltr = true)
        Text("نوع السيارة", style = MaterialTheme.typography.labelMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (m in CAR_MAKES) {
                val on = f.make == m
                Text(m, color = if (on) Color.White else Ink, style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.clip(RoundedCornerShape(14.dp)).background(if (on) Green else Color.White).border(1.dp, if (on) Green else Line, RoundedCornerShape(14.dp))
                        .clickable { f.make = m }.padding(horizontal = 16.dp, vertical = 11.dp))
            }
        }
        if (f.make == "غيرها") YnField(f.other, { if (it.length <= 24) f.other = it }, "اكتب نوعها بالعربي", placeholder = "مثلاً: فورد")
        Text(if (f.color.isEmpty()) "اللون" else "اللون: ${f.color}", style = MaterialTheme.typography.labelMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for ((name, c) in CAR_COLORS) {
                val on = f.color == name
                Box(Modifier.size(46.dp).clip(CircleShape).border(2.dp, if (on) Green else Color.Transparent, CircleShape).padding(5.dp).clip(CircleShape).background(c).border(1.dp, Line, CircleShape)
                    .clickable(onClickLabel = name) { f.color = name }, contentAlignment = Alignment.Center) {
                    if (on) Icon(Icons.Filled.Check, name, tint = if (c.red + c.green + c.blue > 2f) Ink else Color.White, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

// ---------- existing account ----------

@Composable
fun LinkScreen(link: String, onLink: (String) -> Unit, busy: Boolean, err: String, onBack: () -> Unit, onOpen: () -> Unit) {
    val clipboard = LocalClipboardManager.current
    SheetScreen("أهلاً من جديد", "الصق رابط حسابك", onBack, bottom = {
        if (err.isNotEmpty()) Banner(err)
        YnButton("افتح حسابي", busy = busy, enabled = link.isNotBlank(), onClick = onOpen)
    }) {
        YnField(link, onLink, "الرابط", placeholder = "yanashmi.com/inbox.html#…", icon = Icons.Filled.Link, ltr = true)
        YnButton("الصق الرابط", style = BtnStyle.Outline, icon = Icons.Filled.ContentPaste, height = 50.dp) { clipboard.getText()?.let { onLink(it.text) } }
    }
}
