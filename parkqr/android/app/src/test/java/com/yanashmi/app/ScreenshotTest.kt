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

    @Test fun welcome() = shot("1-welcome") { WelcomeScreen(false, "", {}, {}, {}) }

    @Test fun register() = shot("2-register") { RegisterScreen(RegisterState().apply { first = "أحمد"; last = "الخطيب"; phone = "0790000000"; consent = true }, false, "", {}, {}) }

    @Test fun link() = shot("3-link") { LinkScreen("", {}, false, "", {}, {}) }

    private val sample get() = Inbox("أحمد الخطيب", "تويوتا بيضاء", false, listOf(
        Msg("1", "block", null, System.currentTimeMillis() / 1000 - 90, false, "عند مدخل العمارة", 0),
        Msg("2", "hit", "2", System.currentTimeMillis() / 1000 - 4000, false, null, 2)))

    @Test fun inbox() = shot("4-inbox") { HomeFrame(Tab.Inbox, {}, 1) { InboxTab("x", sample, "", {}, {}, {}, {}) } }

    @Test fun empty() = shot("5-empty") { HomeFrame(Tab.Inbox, {}, 0) { InboxTab("x", sample.copy(messages = emptyList()), "", {}, {}, {}, {}) } }

    @Test fun sticker() = shot("6-sticker") { HomeFrame(Tab.Sticker, {}, 1) { StickerTab("k3m9q2x7ab") } }

    @Test fun account() = shot("7-account") { HomeFrame(Tab.Account, {}, 0) { AccountTab("x", sample, {}, {}) } }

    @Test fun chat() = shot("8-chat") {
        androidx.compose.foundation.layout.Column(androidx.compose.ui.Modifier.background(Bg).padding(12.dp), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp)) {
            Bubble(false, "سيارتك مسكّرة عليّ، ممكن تحرّكها؟", "08:12 م", null, note = "عند مدخل العمارة")
            Bubble(true, "جاي خلال دقيقتين", "08:13 م", null)
            Bubble(false, "تمام، انا واقف قدام المحل", "08:13 م", null)
            Bubble(true, "نزلت هلأ", "08:14 م", null)
        }
    }

    @Test @Config(qualifiers = "w320dp-h568dp-xhdpi") fun smallWelcome() = shot("9-welcome-small") { WelcomeScreen(false, "", {}, {}, {}) }
}
