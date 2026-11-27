package com.yanashmi.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Every screen on a small old phone with the system font turned up: where layouts break. Output: build/shots/stress-*. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w320dp-h640dp-xhdpi")
class StressScreenTest {
    @get:Rule val rule = createComposeRule()

    private fun shot(name: String, content: @Composable () -> Unit) {
        rule.setContent {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl, LocalDensity provides Density(d.density, 1.5f)) { YnTheme { content() } }
        }
        rule.onRoot().captureRoboImage("build/shots/stress-$name.png")
    }

    private val sample get() = Inbox("عبدالرحمن عبدالمجيد الطويل", "مرسيدس رمادية قديمة جداً", false, listOf(
        Msg("1", "fault", null, System.currentTimeMillis() / 1000 - 90, false, "عند مدخل العمارة الثانية بجانب المخبز", 0),
        Msg("2", "hit", "cant", System.currentTimeMillis() / 1000 - 400000, false, null, 12)))

    @Test fun welcome() = shot("1-welcome") { WelcomeScreen(false, "ما لقينا حساب جوجل على الموبايل. ضيف حساب من الإعدادات وجرّب.", {}, {}, still = 2.9f) }
    @Test fun car() = shot("2-car") { CarScreen(CarForm().apply { name = "عبدالرحمن"; make = "غيرها"; color = "رمادية" }, false, "اكتب رقم موبايلك.", {}, {}) }
    @Test fun inbox() = shot("3-inbox") { HomeFrame(Tab.Inbox, {}, 12) { InboxTab("x", sample, "", {}, {}, {}, {}) } }
    @Test fun sticker() = shot("4-sticker") { HomeFrame(Tab.Sticker, {}, 0) { StickerTab("k3m9q2x7ab") } }
    @Test fun account() = shot("5-account") { HomeFrame(Tab.Account, {}, 0) { AccountTab("x", sample, {}, {}) } }
    @Test fun link() = shot("6-link") { LinkScreen("", {}, false, "الرابط مش صحيح. انسخه كامل.", {}, {}) }
}
