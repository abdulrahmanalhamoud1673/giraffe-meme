package com.yanashmi.app

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Brand: deep emerald night on top, calm light sheet below, mint for action on dark, red only for urgency.
val Night = Color(0xFF06130E)
val Forest = Color(0xFF0E3325)
val Green = Color(0xFF0C7A4D)
val GreenDark = Color(0xFF075235)
val Mint = Color(0xFF4BE3A4)
val MintSoft = Color(0xFFE3F6ED)
val Red = Color(0xFFC2183A)
val RedSoft = Color(0xFFFCE9ED)
val Gold = Color(0xFFFFCB66)
val Bg = Color(0xFFF3F5F4)
val Surface0 = Color(0xFFFFFFFF)
val Ink = Color(0xFF0F1613)
val Muted = Color(0xFF68746E)
val Line = Color(0xFFE4E9E6)
val Bubble = Color(0xFFEDF1EF)
val OnNight = Color(0xFFA8C4B7)

val NightBrush = Brush.verticalGradient(listOf(Night, Forest))
val HeroBrush = Brush.linearGradient(listOf(Color(0xFF071A12), Color(0xFF0E3B29), Color(0xFF0C6B45)))

@OptIn(ExperimentalTextApi::class)
val Cairo = FontFamily(
    listOf(400, 500, 600, 700, 800, 900).map { w ->
        Font(R.font.cairo, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    }
)

private fun t(size: Int, weight: Int, line: Int = size + 8) = TextStyle(fontFamily = Cairo, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = line.sp)

val YnTypography = Typography(
    displayLarge = t(34, 900, 46), headlineLarge = t(26, 800, 38), headlineMedium = t(23, 800, 34), headlineSmall = t(20, 800, 30),
    titleLarge = t(19, 800, 28), titleMedium = t(16, 700, 24), titleSmall = t(14, 700, 22),
    bodyLarge = t(15, 500, 24), bodyMedium = t(14, 500, 22), bodySmall = t(12, 500, 19),
    labelLarge = t(15, 700), labelMedium = t(13, 700), labelSmall = t(11, 600),
)

@Composable
fun YnTheme(content: @Composable () -> Unit) = MaterialTheme(
    colorScheme = lightColorScheme(primary = Green, onPrimary = Color.White, secondary = Red, background = Bg, surface = Surface0, onSurface = Ink,
        onBackground = Ink, surfaceVariant = Bubble, outline = Line, outlineVariant = Line, primaryContainer = MintSoft, secondaryContainer = MintSoft, surfaceContainer = Surface0),
    typography = YnTypography,
    shapes = Shapes(small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(28.dp)),
    content = content,
)
