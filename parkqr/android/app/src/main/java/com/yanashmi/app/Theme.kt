package com.yanashmi.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Green = Color(0xFF0B6B43)
val Red = Color(0xFFB3122A)
val Bg = Color(0xFFF7F4EE)
val Ink = Color(0xFF15120F)
val Muted = Color(0xFF625B51)
val Line = Color(0xFFE4DCCD)
val Bubble = Color(0xFFEFE7D6)

@Composable
fun YnTheme(content: @Composable () -> Unit) = MaterialTheme(
    colorScheme = lightColorScheme(primary = Green, onPrimary = Color.White, secondary = Red, background = Bg, surface = Color.White, onSurface = Ink, onBackground = Ink, surfaceVariant = Bubble),
    content = content,
)
