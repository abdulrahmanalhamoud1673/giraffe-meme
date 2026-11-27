package com.yanashmi.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Renders the screens on the JVM (no phone needed) so the design can be looked at. Output: the build/shots folder. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w360dp-h760dp-xxhdpi")
class ScreenshotTest {
    @get:Rule val rule = createComposeRule()

    private fun shot(name: String, content: @androidx.compose.runtime.Composable () -> Unit) {
        rule.setContent { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) { YnTheme { content() } } }
        rule.onRoot().captureRoboImage("build/shots/$name.png")
    }

    @Test fun auth() = shot("auth") { AuthScreen { _, _ -> } }

    @Test fun card() = shot("card") {
        androidx.compose.foundation.layout.Column(androidx.compose.ui.Modifier.background(Bg).padding(16.dp), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp)) {
            MessageCard("x", Msg("1", "block", null, System.currentTimeMillis() / 1000 - 90, false, "عند مدخل العمارة", 2), {}, {})
            MessageCard("x", Msg("2", "hit", "2", System.currentTimeMillis() / 1000 - 4000, false, null, 0), {}, {})
        }
    }

    @Test fun chat() = shot("chat") {
        androidx.compose.foundation.layout.Column(androidx.compose.ui.Modifier.background(androidx.compose.ui.graphics.Color(0xFFEFE7D6)).padding(12.dp), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp)) {
            Bubble(false, "سيارتك مسكّرة عليّ، ممكن تحرّكها؟", "08:12 م", null, note = "عند مدخل العمارة")
            Bubble(true, "جاي خلال دقيقتين", "08:13 م", null)
            Bubble(false, "تمام، انا واقف قدام المحل", "08:13 م", null)
            Bubble(true, "نزلت هلأ", "08:14 م", null)
        }
    }
}
