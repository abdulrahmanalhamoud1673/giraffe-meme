package com.yanashmi.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

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

enum class BtnStyle { Primary, Outline }

@Composable
fun YnButton(text: String, modifier: Modifier = Modifier, style: BtnStyle = BtnStyle.Primary, enabled: Boolean = true, busy: Boolean = false, icon: ImageVector? = null,
             leading: (@Composable () -> Unit)? = null, height: Dp = 56.dp, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    val fg = if (style == BtnStyle.Primary) Color.White else Ink
    val on = enabled && !busy
    Row(
        modifier.fillMaxWidth().height(height).then(if (style == BtnStyle.Primary && on) Modifier.shadow(10.dp, shape, ambientColor = Green, spotColor = Green) else Modifier)
            .clip(shape).background(if (style == BtnStyle.Primary) Green.copy(alpha = if (enabled) 1f else .4f) else Color.White)
            .then(if (style == BtnStyle.Outline) Modifier.border(1.dp, Line, shape) else Modifier)
            .clickable(enabled = on, onClick = onClick).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        if (busy) CircularProgressIndicator(Modifier.size(22.dp), color = fg, strokeWidth = 2.5.dp)
        else {
            if (leading != null) { leading(); Spacer(Modifier.width(10.dp)) }
            if (icon != null) { Icon(icon, null, tint = fg, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)) }
            Text(text, color = fg, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
fun YnField(value: String, onChange: (String) -> Unit, label: String, modifier: Modifier = Modifier, placeholder: String? = null,
            keyboard: KeyboardType = KeyboardType.Text, icon: ImageVector? = null, ltr: Boolean = false, trailing: (@Composable () -> Unit)? = null) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = Ink, modifier = Modifier.padding(bottom = 6.dp, start = 4.dp))
        OutlinedTextField(
            value, onChange, Modifier.fillMaxWidth(), singleLine = true,
            placeholder = placeholder?.let { { Text(it, color = Muted.copy(alpha = .65f), maxLines = 1, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Start, style = MaterialTheme.typography.bodyLarge.copy(textDirection = if (ltr) TextDirection.Ltr else TextDirection.Content)) } },
            leadingIcon = icon?.let { { Icon(it, null, tint = Muted, modifier = Modifier.size(20.dp)) } }, trailingIcon = trailing,
            textStyle = MaterialTheme.typography.bodyLarge.copy(textDirection = if (ltr) TextDirection.Ltr else TextDirection.Content),
            shape = RoundedCornerShape(16.dp), keyboardOptions = KeyboardOptions(keyboardType = keyboard),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Green, unfocusedBorderColor = Line, focusedContainerColor = Color.White, unfocusedContainerColor = Color.White, cursorColor = Green),
        )
    }
}

/** White card with a soft shadow, the one container used everywhere. */
@Composable
fun YnCard(modifier: Modifier = Modifier, color: Color = Surface0, border: Color = Color.Transparent, onClick: (() -> Unit)? = null, padding: Dp = 16.dp, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    Column(
        modifier.fillMaxWidth().shadow(5.dp, shape, ambientColor = Color(0x1F000000), spotColor = Color(0x1F000000)).clip(shape).background(color).border(1.dp, border, shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(padding),
        content = content,
    )
}

@Composable
fun IconBadge(icon: ImageVector, tint: Color = Green, back: Color = MintSoft, size: Dp = 46.dp) {
    Box(Modifier.size(size).clip(RoundedCornerShape(size / 3)).background(back), contentAlignment = Alignment.Center) { Icon(icon, null, tint = tint, modifier = Modifier.size(size * .5f)) }
}

@Composable
fun Banner(text: String, modifier: Modifier = Modifier, icon: ImageVector = Icons.Filled.ErrorOutline, tint: Color = Red, back: Color = RedSoft) {
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(back).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp))
        Text(text, color = if (tint == Red) Red else GreenDark, style = MaterialTheme.typography.bodyMedium)
    }
}

/** The dark top of every tab, with rounded bottom corners. */
@Composable
fun TabHeader(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp)).background(HeroBrush).statusBarsPadding().padding(horizontal = 22.dp, vertical = 20.dp), content = content)
}

/** An inner screen: dark title area, light sheet, and the main button pinned at the bottom. */
@Composable
fun SheetScreen(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null, bottom: (@Composable ColumnScope.() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(NightBrush)) {
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 22.dp, end = 22.dp, top = 10.dp, bottom = 22.dp)) {
            if (onBack != null) {
                Box(Modifier.size(44.dp).clip(CircleShape).background(Color(0x1FFFFFFF)).clickable(onClick = onBack), contentAlignment = Alignment.Center) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "رجوع", tint = Color.White) }
                Spacer(Modifier.height(12.dp))
            }
            Text(title, color = Color.White, style = MaterialTheme.typography.headlineLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, color = OnNight, style = MaterialTheme.typography.bodyLarge)
        }
        Column(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp)).background(Bg).imePadding()) {
            Column(Modifier.weight(1f).fillMaxWidth().verticalScrollable().padding(horizontal = 20.dp, vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
            if (bottom != null) Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = bottom)
        }
    }
}
