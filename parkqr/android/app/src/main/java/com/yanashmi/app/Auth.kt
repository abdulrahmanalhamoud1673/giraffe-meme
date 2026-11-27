package com.yanashmi.app

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
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

@Composable
fun WelcomeScreen(busy: Boolean, err: String, onGoogle: () -> Unit, onPhone: () -> Unit, onLink: () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Color.White).statusBarsPadding().navigationBarsPadding()) {
        val full = maxHeight
        Column(Modifier.fillMaxWidth().verticalScrollable().heightIn(min = full).padding(horizontal = 24.dp, vertical = 14.dp), verticalArrangement = Arrangement.SpaceBetween, horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                StarMark(28, Green); Spacer(Modifier.width(8.dp)); Text("يا نشمي", style = MaterialTheme.typography.titleLarge)
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                if (full > 520.dp) Hero(Modifier.fillMaxWidth().height(if (full > 700.dp) 250.dp else 180.dp))
                Text("حدا بده سيارتك؟", style = MaterialTheme.typography.headlineLarge, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 18.dp))
                Text("بيمسح الملصق، وبتوصلك رسالته. ورقمك مخفي.", color = Muted, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
            }
            Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (err.isNotEmpty()) Banner(err)
                YnButton("التسجيل برقم الموبايل", enabled = !busy, onClick = onPhone)
                YnButton("المتابعة بحساب جوجل", style = BtnStyle.Outline, busy = busy, leading = { Image(painterResource(R.drawable.ic_google), null, Modifier.size(20.dp)) }, onClick = onGoogle)
                TextButton(onClick = onLink, enabled = !busy) { Text("عندي حساب", style = MaterialTheme.typography.labelLarge) }
                val ctx = LocalContext.current
                Text("بالمتابعة بتوافق على سياسة الخصوصية", color = Muted, style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.clickable { try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yanashmi.com/privacy"))) } catch (_: Exception) { } }.padding(6.dp))
            }
        }
    }
}

/** The product in one picture: a car with the sticker on its window, and the message it brings. Drawn, so it stays sharp and light. */
@Composable
private fun Hero(modifier: Modifier) {
    Box(modifier, contentAlignment = Alignment.BottomCenter) {
        Canvas(Modifier.matchParentSize()) {
            val w = minOf(size.width, size.height * 1.5f); val u = w / 100f
            val left = (size.width - w) / 2; val base = size.height - 8 * u
            fun p(x: Float, y: Float) = Offset(left + x * u, base - y * u)
            drawCircle(MintSoft, 31 * u, p(50f, 25f))
            // body and cabin
            val cabin = Path().apply { moveTo(p(24f, 24f).x, p(24f, 24f).y); lineTo(p(34f, 41f).x, p(34f, 41f).y); quadraticBezierTo(p(36f, 43f).x, p(36f, 43f).y, p(39f, 43f).x, p(39f, 43f).y); lineTo(p(63f, 43f).x, p(63f, 43f).y); quadraticBezierTo(p(66f, 43f).x, p(66f, 43f).y, p(68f, 40f).x, p(68f, 40f).y); lineTo(p(77f, 24f).x, p(77f, 24f).y); close() }
            drawPath(cabin, Green)
            drawRoundRect(Green, p(12f, 26f), Size(76 * u, 18 * u), CornerRadius(8 * u))
            // windows
            val glass = Path().apply { moveTo(p(30f, 26f).x, p(30f, 26f).y); lineTo(p(37.5f, 39f).x, p(37.5f, 39f).y); lineTo(p(49f, 39f).x, p(49f, 39f).y); lineTo(p(49f, 26f).x, p(49f, 26f).y); close() }
            drawPath(glass, Color.White)
            val glass2 = Path().apply { moveTo(p(52f, 26f).x, p(52f, 26f).y); lineTo(p(52f, 39f).x, p(52f, 39f).y); lineTo(p(63.5f, 39f).x, p(63.5f, 39f).y); lineTo(p(71f, 26f).x, p(71f, 26f).y); close() }
            drawPath(glass2, Color.White)
            // the QR sticker on the window
            val q = p(54f, 37f); val c = 1.15f * u
            drawRoundRect(Night, Offset(q.x - c, q.y - c), Size(c * 9, c * 9), CornerRadius(c))
            for (x in 0 until 7) for (y in 0 until 7) {
                val finder = (x < 3 && y < 3) || (x > 3 && y < 3) || (x < 3 && y > 3)
                if (finder && !((x == 1 || x == 5) && (y == 1 || y == 5)) || !finder && (x * 3 + y * 5) % 4 < 2) drawRect(Color.White, Offset(q.x + x * c, q.y + y * c), Size(c * .9f, c * .9f))
            }
            // wheels and lamp
            for (x in listOf(28f, 72f)) { drawCircle(Night, 9 * u, p(x, 9f)); drawCircle(Color.White, 3.5f * u, p(x, 9f)) }
            drawCircle(Mint, 2.2f * u, p(17f, 18f))
        }
        Row(
            Modifier.align(Alignment.TopCenter).offset(x = (-46).dp, y = 4.dp).shadow(14.dp, RoundedCornerShape(16.dp)).clip(RoundedCornerShape(16.dp)).background(Color.White).padding(horizontal = 12.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Notifications, null, tint = Green, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp))
            Text("سيارتك مسكّرة عليّ", style = MaterialTheme.typography.titleSmall)
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
        if (f.idToken.isEmpty()) "سجّل سيارتك" else "كمّل رقمك",
        onBack,
        bottom = {
            if (err.isNotEmpty()) Banner(err)
            YnButton("سجّل سيارتي", busy = busy, onClick = onSubmit)
        },
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            YnField(f.first, { f.first = it }, "الاسم الأول", Modifier.weight(1f))
            YnField(f.last, { f.last = it }, "العائلة", Modifier.weight(1f))
        }
        YnField(f.phone, { f.phone = digits(it) }, "رقم الموبايل", placeholder = "07X XXX XXXX", keyboard = KeyboardType.Phone, ltr = true)
        YnField(f.car, { f.car = it }, "السيارة (اختياري)", placeholder = "تويوتا بيضاء")
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable { f.consent = !f.consent }, verticalAlignment = Alignment.CenterVertically) {
            Checkbox(f.consent, { f.consent = it }, colors = CheckboxDefaults.colors(checkedColor = Green))
            Text("أوافق على حفظ اسمي ورقمي. ما بيظهروا لحدا.", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

// ---------- existing account ----------

@Composable
fun LinkScreen(link: String, onLink: (String) -> Unit, busy: Boolean, err: String, onBack: () -> Unit, onOpen: () -> Unit) {
    val clipboard = LocalClipboardManager.current
    SheetScreen("عندي حساب", onBack, bottom = {
        if (err.isNotEmpty()) Banner(err)
        YnButton("افتح صندوقي", busy = busy, enabled = link.isNotBlank(), onClick = onOpen)
    }) {
        YnField(link, onLink, "رابط صندوقك", placeholder = "yanashmi.com/inbox.html#…", ltr = true)
        YnButton("الصق الرابط", style = BtnStyle.Outline, icon = Icons.Filled.ContentPaste, height = 50.dp) { clipboard.getText()?.let { onLink(it.text) } }
    }
}
