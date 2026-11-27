package com.yanashmi.app

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.res.ResourcesCompat

const val SCENE_MS = 3600
private val CAPTIONS = listOf(
    "حط الملصق على سيارتك" to "رمز خاص فيك، بدون رقمك",
    "أي حدا بيمسحه بالكاميرا" to "بدون ما ينزّل تطبيق",
    "بتوصلك رسالته وبتردّ" to "محادثة محمية، وصور من الكاميرا بس",
)

/**
 * A short looping "video" that shows how the app works, drawn live so it is sharp on every screen and adds nothing to
 * the download. Tap to jump to the next part. `still` (0 until 3) freezes one moment, for the screenshot tests.
 */
@Composable
fun Story(modifier: Modifier = Modifier, still: Float? = null) {
    var clock by remember { mutableFloatStateOf(still ?: 0f) }          // 0 until 3: the scene and how far into it
    if (still == null) LaunchedEffect(Unit) {
        var last = withFrameMillis { it }
        while (true) withFrameMillis { now -> clock = (clock + (now - last).coerceIn(0, 100) / SCENE_MS.toFloat()) % 3f; last = now }
    }
    val scene = clock.toInt().coerceIn(0, 2)
    val t = clock - scene
    val ctx = LocalContext.current
    val face = remember { ResourcesCompat.getFont(ctx, R.font.cairo) }

    Column(modifier.clickable(remember { MutableInteractionSource() }, null) { clock = ((scene + 1) % 3).toFloat() }, horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for (i in 0..2) Box(Modifier.weight(1f).height(3.dp).clip(RoundedCornerShape(99.dp)).background(Color(0x33FFFFFF))) {
                val fill = if (i < scene) 1f else if (i == scene) t else 0f
                Box(Modifier.fillMaxHeight().fillMaxWidth(fill.coerceIn(0f, 1f)).background(Mint))
            }
        }
        Canvas(Modifier.weight(1f).fillMaxWidth()) {
            // a 100 x 80 stage, centred
            val u = minOf(size.width / 100f, size.height / 80f)
            val stage = Stage(this, u, Offset((size.width - 100 * u) / 2, (size.height - 80 * u) / 2)) { text, x, y, h, color ->
                drawIntoCanvas {
                    val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color.toArgb(); textSize = h * u; textAlign = Paint.Align.CENTER; typeface = face; isFakeBoldText = true }
                    it.nativeCanvas.drawText(text, x, y, p)
                }
            }
            drawCircle(Brush.radialGradient(listOf(Mint.copy(alpha = .22f), Color.Transparent), stage.at(50f, 40f), 46 * u), 46 * u, stage.at(50f, 40f))
            when (scene) { 0 -> stage.sticker(t); 1 -> stage.scan(t); else -> stage.reply(t) }
        }
        Text(CAPTIONS[scene].first, color = Color.White, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
        Text(CAPTIONS[scene].second, color = OnNight, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
    }
}

/** 0 before `from`, 1 after `to`, smooth in between. */
private fun ramp(t: Float, from: Float, to: Float): Float { val x = ((t - from) / (to - from)).coerceIn(0f, 1f); return x * x * (3 - 2 * x) }

/** Like ramp, but overshoots a little and settles: things "land". */
private fun pop(t: Float, from: Float, to: Float): Float { val x = ((t - from) / (to - from)).coerceIn(0f, 1f) - 1f; return 1f + x * x * (2.7f * x + 1.7f) }

private class Stage(val d: DrawScope, val u: Float, val origin: Offset, val text: DrawScope.(String, Float, Float, Float, Color) -> Unit) {
    fun at(x: Float, y: Float) = Offset(origin.x + x * u, origin.y + y * u)
    fun box(x: Float, y: Float, w: Float, h: Float, r: Float, color: Color) = d.drawRoundRect(color, at(x, y), Size(w * u, h * u), CornerRadius(r * u))
    fun dot(x: Float, y: Float, r: Float, color: Color) = d.drawCircle(color, r * u, at(x, y))
    fun words(s: String, x: Float, y: Float, h: Float, color: Color) { val p = at(x, y); d.text(s, p.x, p.y, h, color) }

    /** A side view of a car whose bottom sits at y; `dx` shifts it. */
    fun car(dx: Float, y: Float) {
        val body = Color(0xFFF2F7F5)
        val cabin = Path().apply {
            moveTo(at(25f + dx, y - 20).x, at(25f, y - 20).y); lineTo(at(35f + dx, y - 37).x, at(35f, y - 37).y)
            quadraticBezierTo(at(37f + dx, y - 40).x, at(37f, y - 40).y, at(41f + dx, y - 40).x, at(41f, y - 40).y); lineTo(at(63f + dx, y - 40).x, at(63f, y - 40).y)
            quadraticBezierTo(at(67f + dx, y - 40).x, at(67f, y - 40).y, at(69f + dx, y - 37).x, at(69f, y - 37).y); lineTo(at(79f + dx, y - 20).x, at(79f, y - 20).y); close()
        }
        d.drawPath(cabin, body)
        box(12f + dx, y - 22, 76f, 16f, 7f, body)
        for ((a, b, c) in listOf(Triple(31f, 39f, 50f), Triple(53f, 65f, 73f))) {
            val g = Path().apply {
                if (a < 50) { moveTo(at(a + dx, y - 22).x, at(a, y - 22).y); lineTo(at(b + dx, y - 36).x, at(b, y - 36).y); lineTo(at(c + dx, y - 36).x, at(c, y - 36).y); lineTo(at(c + dx, y - 22).x, at(c, y - 22).y) }
                else { moveTo(at(a + dx, y - 22).x, at(a, y - 22).y); lineTo(at(a + dx, y - 36).x, at(a, y - 36).y); lineTo(at(b + dx, y - 36).x, at(b, y - 36).y); lineTo(at(c + dx, y - 22).x, at(c, y - 22).y) }
                close()
            }
            d.drawPath(g, Color(0xFF1B4D3A))
        }
        for (x in listOf(29f, 71f)) { dot(x + dx, y - 6, 8.5f, Night); dot(x + dx, y - 6, 3.5f, Color(0xFFB9CFC5)) }
        dot(15f + dx, y - 15, 1.8f, Gold)
        d.drawLine(Color(0x55FFFFFF), at(4f, y + 3), at(96f, y + 3), .6f * u)
    }

    fun code(x: Float, y: Float, s: Float) {
        box(x, y, s, s, s * .14f, Color.White)
        val n = 9; val c = s * .82f / n; val ox = x + s * .09f; val oy = y + s * .09f
        for (i in 0 until n) for (j in 0 until n) {
            val corner = (i < 4 && j < 4) || (i > 4 && j < 4) || (i < 4 && j > 4)
            if (!corner && (i * 3 + j * 5 + i * j) % 3 != 0) box(ox + i * c, oy + j * c, c * .9f, c * .9f, c * .2f, Night)
        }
        // the three big squares that make a code look like a code
        for ((i, j) in listOf(0f to 0f, 6f to 0f, 0f to 6f)) {
            box(ox + i * c, oy + j * c, c * 3, c * 3, c * .7f, Night)
            box(ox + (i + .55f) * c, oy + (j + .55f) * c, c * 1.9f, c * 1.9f, c * .45f, Color.White)
            box(ox + (i + 1.05f) * c, oy + (j + 1.05f) * c, c * .9f, c * .9f, c * .2f, Green)
        }
    }

    /** The sticker flies in and lands on the window, then shines. */
    fun sticker(t: Float) {
        car(0f, 66f)
        val fly = pop(t, .12f, .55f); val s = 26f - 14f * fly
        val x = 6f + 49f * fly; val y = 2f + 31f * fly
        d.rotate(-18f * (1 - fly), at(x + s / 2, y + s / 2)) { code(x, y, s) }
        val shine = ramp(t, .55f, .7f) * (1 - ramp(t, .82f, .95f))
        if (shine > 0) {
            d.drawCircle(Mint.copy(alpha = shine), (9 + 7 * ramp(t, .55f, .9f)) * u, at(61f, 39f), style = Stroke(1.1f * u))
            for ((sx, sy) in listOf(48f to 19f, 76f to 24f, 70f to 11f)) { dot(sx, sy, 1.4f * shine, Gold) }
        }
    }

    /** A phone slides in, frames the sticker, a line sweeps it, and a tick appears. */
    fun scan(t: Float) {
        car(-6f, 70f)
        code(49f, 37f, 12f)
        val slide = pop(t, .05f, .4f); val px = 100f - 44f * slide; val py = 8f
        box(px, py, 36f, 60f, 6f, Color(0xFF02080A)); box(px + 1.8f, py + 1.8f, 32.4f, 56.4f, 4.6f, Color(0xFF12372A))
        box(px + 13f, py + 3.4f, 10f, 2.2f, 1.1f, Color(0xFF02080A))
        code(px + 8f, py + 15f, 20f)
        for ((cx, cy, sx, sy) in listOf(listOf(5f, 12f, 1f, 1f), listOf(31f, 12f, -1f, 1f), listOf(5f, 38f, 1f, -1f), listOf(31f, 38f, -1f, -1f))) {
            d.drawLine(Mint, at(px + cx, py + cy), at(px + cx + 6 * sx, py + cy), 1.2f * u)
            d.drawLine(Mint, at(px + cx, py + cy), at(px + cx, py + cy + 6 * sy), 1.2f * u)
        }
        if (t > .38f && t < .72f) {
            val k = (t - .38f) / .34f; val y = py + 15f + 20f * (if (k < .5f) k * 2 else 2 - k * 2)
            box(px + 6f, y - .5f, 24f, 1f, .5f, Mint)
        }
        val done = pop(t, .72f, .88f)
        if (t > .72f) {
            dot(px + 18f, py + 48f, 6f * done, Mint)
            d.drawLine(Night, at(px + 15.2f, py + 48f), at(px + 17.2f, py + 50f), 1.3f * u)
            d.drawLine(Night, at(px + 17.2f, py + 50f), at(px + 21f, py + 46f), 1.3f * u)
        }
    }

    /** On the owner's phone the message drops in, the answer pops, then a protected tick. */
    fun reply(t: Float) {
        box(24f, 2f, 52f, 76f, 8f, Color(0xFF02080A)); box(26f, 4f, 48f, 72f, 6.4f, Color(0xFFF3F5F4))
        box(43f, 6f, 14f, 2.8f, 1.4f, Color(0xFF02080A))
        val drop = pop(t, .05f, .3f)
        if (t > .05f) {
            val y = 2f + 12f * drop
            box(29f, y, 42f, 17f, 4f, Color.White); dot(64.5f, y + 8.5f, 4.2f, MintSoft); dot(64.5f, y + 8.5f, 1.8f, Green)
            words("سيارتك مسكّرة عليّ", 46f, y + 7.5f, 3.7f, Ink); words("هلأ · رقمه مخفي", 46f, y + 13f, 2.9f, Muted)
        }
        val answer = pop(t, .4f, .6f)
        if (t > .4f) {
            val w = 34f * answer
            box(30f, 36f, w, 11f, 4f, Green)
            if (answer > .8f) words("جاي خلال دقيقتين", 30f + w / 2, 42.8f, 3.5f, Color.White)
        }
        val photo = pop(t, .62f, .8f)
        if (t > .62f) {
            box(71f - 30f * photo, 51f, 30f * photo, 16f * photo, 3.5f, Color.White)
            if (photo > .8f) {   // a camera picture of the car
                box(42.5f, 52.5f, 27f, 13f, 2.5f, MintSoft)
                box(50f, 54.5f, 12f, 6f, 2.4f, Green); box(46.5f, 57.5f, 19f, 5f, 2f, Green)
                dot(50.5f, 62.5f, 1.9f, Night); dot(61.5f, 62.5f, 1.9f, Night)
            }
        }
    }
}
