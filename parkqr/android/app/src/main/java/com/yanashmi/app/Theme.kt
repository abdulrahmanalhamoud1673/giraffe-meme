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

// Identity: the red of the shemagh on near-black and white. One accent, nothing else competes with it.
val Night = Color(0xFF120D0E)
val NightEnd = Color(0xFF2A0A11)
val Brand = Color(0xFFC8102E)
val BrandDark = Color(0xFF8F0B21)
val Accent = Color(0xFFFF4D63)
val BrandSoft = Color(0xFFFCEBEE)
val Red = Brand
val RedSoft = BrandSoft
val Gold = Color(0xFFFFCB66)
val Bg = Color(0xFFF6F5F4)
val Surface0 = Color(0xFFFFFFFF)
val Ink = Color(0xFF161213)
val Muted = Color(0xFF756C6E)
val Line = Color(0xFFEAE6E6)
val Bubble = Color(0xFFF0EDED)
val OnNight = Color(0xFFD3C3C6)

val NightBrush = Brush.verticalGradient(listOf(Night, NightEnd))
val HeroBrush = Brush.linearGradient(listOf(Color(0xFF140D0F), Color(0xFF45101A), Color(0xFFA50E28)))

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
    colorScheme = lightColorScheme(primary = Brand, onPrimary = Color.White, secondary = Red, background = Bg, surface = Surface0, onSurface = Ink,
        onBackground = Ink, surfaceVariant = Bubble, outline = Line, outlineVariant = Line, primaryContainer = BrandSoft, secondaryContainer = BrandSoft, surfaceContainer = Surface0),
    typography = YnTypography,
    shapes = Shapes(small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(28.dp)),
    content = content,
)
