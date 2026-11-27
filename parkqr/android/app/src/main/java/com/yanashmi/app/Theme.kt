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

val Green = Color(0xFF0B6B43)
val GreenDark = Color(0xFF084F32)
val Mint = Color(0xFF3FD193)
val Red = Color(0xFFB3122A)
val Bg = Color(0xFFF7F4EE)
val Ink = Color(0xFF15120F)
val Muted = Color(0xFF6B6459)
val Line = Color(0xFFE6DECF)
val Bubble = Color(0xFFEFE7D6)
val Night = Color(0xFF0B0D0C)
val Gold = Color(0xFFD4AB5C)

val HeaderBrush = Brush.verticalGradient(listOf(Color(0xFF0B0D0C), Color(0xFF0F2A20), Color(0xFF0B6B43)))

@OptIn(ExperimentalTextApi::class)
val Cairo = FontFamily(
    listOf(400, 500, 600, 700, 800).map { w ->
        Font(R.font.cairo, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    }
)

private fun t(size: Int, weight: Int, line: Int = size + 8) = TextStyle(fontFamily = Cairo, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = line.sp)

val YnTypography = Typography(
    displayLarge = t(34, 800), headlineLarge = t(28, 800), headlineMedium = t(24, 800), headlineSmall = t(21, 700),
    titleLarge = t(20, 700), titleMedium = t(17, 700), titleSmall = t(15, 600),
    bodyLarge = t(16, 500, 24), bodyMedium = t(14, 500, 22), bodySmall = t(12, 500, 18),
    labelLarge = t(15, 700), labelMedium = t(13, 600), labelSmall = t(11, 600),
)

@Composable
fun YnTheme(content: @Composable () -> Unit) = MaterialTheme(
    colorScheme = lightColorScheme(primary = Green, onPrimary = Color.White, secondary = Red, background = Bg, surface = Color.White, onSurface = Ink,
        onBackground = Ink, surfaceVariant = Bubble, outline = Line, outlineVariant = Line),
    typography = YnTypography,
    shapes = Shapes(small = RoundedCornerShape(10.dp), medium = RoundedCornerShape(16.dp), large = RoundedCornerShape(24.dp)),
    content = content,
)
