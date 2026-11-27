package com.yanashmi.app

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import kotlinx.coroutines.launch

fun Modifier.verticalScrollable(): Modifier = composed { verticalScroll(rememberScrollState()) }

private val NAME_LETTERS = Regex("^[ء-يً-ٰٟـٮ-ۓA-Za-z'’.\\-]{2,}$")

/** A Google display name can hold digits, symbols or emoji that the server refuses: keep only the parts it will accept. */
internal fun nameParts(google: String): Pair<String, String> {
    val words = google.trim().split(Regex("\\s+")).filter { NAME_LETTERS.matches(it) }
    return (words.firstOrNull() ?: "") to words.drop(1).joinToString(" ")
}

enum class AuthStep { Welcome, Register, Link }

@Composable
fun AuthScreen(onDone: (String, String) -> Unit) {
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    var step by remember { mutableStateOf(AuthStep.Welcome) }
    val form = remember { RegisterState() }
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
        if (a != null) onDone(a.token, a.key) else {
            form.idToken = token
            val (f, l) = nameParts(r.name)
            if (form.first.isBlank()) form.first = f
            if (form.last.isBlank()) form.last = l
            step = AuthStep.Register
        }
    }
    fun register() = run {
        val problem = form.problem()
        if (problem != null) { err = problem; return@run }
        val name = "${form.first.trim()} ${form.last.trim()}"
        val r = if (form.idToken.isEmpty()) Api.register(name, form.car.trim(), form.phone.trim())
        else Api.google(form.idToken, name, form.car.trim(), form.phone.trim(), true).account ?: throw ApiError(401, "bad_token")
        onDone(r.token, r.key)
    }
    fun openInbox() = run {
        val m = Regex("([a-zA-Z0-9]{16,40})\\s*$").find(link.trim())
        if (m == null) { err = "الرابط مش صحيح. انسخه كامل."; return@run }
        val k = m.groupValues[1].lowercase(); Api.inbox(k); onDone("", k)
    }

    if (step != AuthStep.Welcome) BackHandler { go(AuthStep.Welcome) }
    when (step) {
        AuthStep.Welcome -> WelcomeScreen(busy, err, onGoogle = ::google, onPhone = { form.idToken = ""; go(AuthStep.Register) }, onLink = { go(AuthStep.Link) })
        AuthStep.Register -> RegisterScreen(form, busy, err, onBack = { go(AuthStep.Welcome) }, onSubmit = ::register)
        AuthStep.Link -> LinkScreen(link, { link = it }, busy, err, onBack = { go(AuthStep.Welcome) }, onOpen = ::openInbox)
    }
}

// ---------- welcome ----------

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WelcomeScreen(busy: Boolean, err: String, onGoogle: () -> Unit, onPhone: () -> Unit, onLink: () -> Unit) {
    Box(Modifier.fillMaxSize().background(NightBrush)) {
        Lattice(Modifier.matchParentSize(), .04f)
        BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            val full = maxHeight
            Column(Modifier.fillMaxWidth().verticalScrollable().heightIn(min = full).padding(horizontal = 24.dp, vertical = 16.dp), verticalArrangement = Arrangement.SpaceBetween) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StarMark(30); Spacer(Modifier.width(10.dp))
                    Text("يا نشمي", color = Color.White, style = MaterialTheme.typography.titleLarge)
                }
                if (full > 680.dp) Hero(Modifier.fillMaxWidth().height(if (full > 800.dp) 230.dp else 180.dp))
                Column {
                    Text("سيارتك بتحكي معك،", color = Color.White, style = MaterialTheme.typography.headlineLarge)
                    Text("ورقمك مخفي.", color = Mint, style = MaterialTheme.typography.headlineLarge)
                    Text("ملصق QR على الزجاج. اللي بده إياك بيمسحه ويبعتلك، وبتوصلك رسالته على تطبيقك.", color = OnNight, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 8.dp))
                    FlowRow(Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Chip(Icons.Filled.Lock, "رقم مخفي"); Chip(Icons.Filled.Shield, "بدون إزعاج"); Chip(Icons.Filled.CameraAlt, "صور حية")
                    }
                }
                Column(Modifier.padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (err.isNotEmpty()) Banner(err)
                    YnButton("المتابعة بحساب جوجل", style = BtnStyle.Light, busy = busy, leading = { Image(painterResource(R.drawable.ic_google), null, Modifier.size(22.dp)) }, onClick = onGoogle)
                    YnButton("التسجيل برقم الموبايل", style = BtnStyle.OnDark, enabled = !busy, icon = Icons.Filled.PhoneAndroid, onClick = onPhone)
                    Text("عندي حساب، افتحه بالرابط", color = Color.White, style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(enabled = !busy, onClick = onLink).padding(12.dp))
                    Text("بالمتابعة بتوافق على سياسة الخصوصية: yanashmi.com/privacy", color = OnNight.copy(alpha = .7f), style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
private fun Chip(icon: ImageVector, text: String) {
    Row(Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0x14FFFFFF)).border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(99.dp)).padding(horizontal = 11.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Mint, modifier = Modifier.size(14.dp)); Spacer(Modifier.width(6.dp))
        Text(text, color = Color.White, style = MaterialTheme.typography.labelSmall)
    }
}

/** The product in one picture: the sticker, and the message it brings to the phone. Drawn, so it stays sharp and light. */
@Composable
private fun Hero(modifier: Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.matchParentSize()) {
            val c = Offset(size.width / 2, size.height / 2)
            drawCircle(Brush.radialGradient(listOf(Mint.copy(alpha = .22f), Color.Transparent), c, size.height * .75f), size.height * .75f, c)
        }
        Column(
            Modifier.align(Alignment.TopCenter).rotate(-6f).offset(x = 44.dp).shadow(24.dp, RoundedCornerShape(24.dp)).clip(RoundedCornerShape(24.dp)).background(Color.White).padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Canvas(Modifier.size(84.dp)) {
                val n = 11; val cell = size.width / n
                fun finder(x: Int, y: Int) {
                    drawRoundRect(Night, Offset(x * cell, y * cell), Size(cell * 4, cell * 4), CornerRadius(cell))
                    drawRoundRect(Color.White, Offset((x + .7f) * cell, (y + .7f) * cell), Size(cell * 2.6f, cell * 2.6f), CornerRadius(cell * .7f))
                    drawRoundRect(Green, Offset((x + 1.35f) * cell, (y + 1.35f) * cell), Size(cell * 1.3f, cell * 1.3f), CornerRadius(cell * .35f))
                }
                finder(0, 0); finder(7, 0); finder(0, 7)
                for (x in 0 until n) for (y in 0 until n) {
                    val inFinder = (x < 5 && y < 5) || (x > 5 && y < 5) || (x < 5 && y > 5)
                    if (!inFinder && (x * 7 + y * 5 + x * y) % 3 != 0) drawRoundRect(Night, Offset(x * cell + cell * .1f, y * cell + cell * .1f), Size(cell * .8f, cell * .8f), CornerRadius(cell * .25f))
                }
            }
        }
        Row(
            Modifier.align(Alignment.BottomCenter).offset(x = (-44).dp, y = (4).dp).rotate(4f).shadow(20.dp, RoundedCornerShape(18.dp)).clip(RoundedCornerShape(18.dp)).background(Color.White).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconBadge(Icons.Filled.DirectionsCar, size = 40.dp); Spacer(Modifier.width(10.dp))
            Column {
                Text("سيارتك مسكّرة عليّ", color = Ink, style = MaterialTheme.typography.titleSmall)
                Text("هلأ · رقمه مخفي", color = Muted, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

// ---------- register ----------

class RegisterState {
    var first by mutableStateOf(""); var last by mutableStateOf("")
    var phone by mutableStateOf(""); var car by mutableStateOf("")
    var consent by mutableStateOf(false)
    var idToken by mutableStateOf("")   // set when the person came through Google

    /** What is still missing, said in words, before bothering the server. */
    fun problem(): String? = when {
        first.isBlank() || last.isBlank() -> "اكتب اسمك الأول واسم العائلة."
        !(first.trim().split(" ") + last.trim().split(" ")).all { NAME_LETTERS.matches(it) } -> "الاسم حروف بس، بدون أرقام أو رموز."
        phone.isBlank() -> "اكتب رقم موبايلك."
        !consent -> "لازم توافق على حفظ اسمك ورقمك."
        else -> null
    }
}

@Composable
fun RegisterScreen(f: RegisterState, busy: Boolean, err: String, onBack: () -> Unit, onSubmit: () -> Unit) {
    SheetScreen(
        if (f.idToken.isEmpty()) "سجّل سيارتك" else "ضل خطوة وحدة",
        if (f.idToken.isEmpty()) "أقل من دقيقة، وبتاخد رمزك." else "حساب جوجل انربط. كمّل رقمك.",
        onBack,
        bottom = {
            if (err.isNotEmpty()) Banner(err)
            YnButton("سجّل سيارتي", busy = busy, onClick = onSubmit)
        },
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            YnField(f.first, { f.first = it }, "الاسم الأول", Modifier.weight(1f), "أحمد")
            YnField(f.last, { f.last = it }, "العائلة", Modifier.weight(1f), "الخطيب")
        }
        YnField(f.phone, { f.phone = digits(it) }, "رقم الموبايل", placeholder = "07X XXX XXXX", keyboard = KeyboardType.Phone, icon = Icons.Filled.PhoneAndroid, ltr = true)
        YnField(f.car, { f.car = it }, "وصف السيارة (اختياري)", placeholder = "تويوتا بيضاء", icon = Icons.Filled.DirectionsCar)
        YnCard(onClick = { f.consent = !f.consent }, padding = 12.dp, border = if (f.consent) Green else Line) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(f.consent, { f.consent = it }, colors = CheckboxDefaults.colors(checkedColor = Green))
                Text("أوافق على حفظ اسمي ورقمي لإرسال التنبيهات فقط.", style = MaterialTheme.typography.bodyMedium)
            }
        }
        Banner("رقمك ما بيظهر لأي حدا، حتى اللي بيمسح الرمز.", icon = Icons.Filled.Lock, tint = Green, back = MintSoft)
    }
}

// ---------- existing account ----------

@Composable
fun LinkScreen(link: String, onLink: (String) -> Unit, busy: Boolean, err: String, onBack: () -> Unit, onOpen: () -> Unit) {
    val clipboard = LocalClipboardManager.current
    SheetScreen("أهلاً من جديد", "افتح صندوقك بالرابط اللي حفظته.", onBack, bottom = {
        if (err.isNotEmpty()) Banner(err)
        YnButton("افتح صندوقي", busy = busy, enabled = link.isNotBlank(), onClick = onOpen)
    }) {
        YnField(link, onLink, "رابط صندوقك", placeholder = "yanashmi.com/inbox.html#…", icon = Icons.Filled.Link, ltr = true)
        YnButton("الصق الرابط", style = BtnStyle.Outline, icon = Icons.Filled.ContentPaste, height = 50.dp) { clipboard.getText()?.let { onLink(it.text) } }
    }
}
