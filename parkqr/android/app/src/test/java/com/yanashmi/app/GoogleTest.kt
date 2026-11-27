package com.yanashmi.app

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** The two answers of /api/auth/google. */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class GoogleTest {
    @Test fun existingAccountSignsIn() {
        val r = Api.parseGoogle(JSONObject("""{"ok":true,"token":"abc","owner_key":"k123","existing":true}"""))
        assertEquals(Registered("abc", "k123"), r.account)
    }

    @Test fun newAccountStillNeedsThePhone() {
        val r = Api.parseGoogle(JSONObject("""{"ok":false,"needs_signup":true,"name":"أحمد الخطيب","email":"a@example.com"}"""))
        assertNull(r.account); assertEquals("أحمد الخطيب", r.name)
    }

    @Test fun onlyFreshMessagesRing() {
        val ctx = androidx.test.core.app.ApplicationProvider.getApplicationContext<android.content.Context>()
        val m = Msg("1", "block", null, 10_000, false, null, 0)
        assertEquals(true, ringsNow(ctx, m, 10_030)); assertEquals(false, ringsNow(ctx, m, 11_000))
    }
    @Test fun everySoundHasItsOwnChannels() {
        val ids = Tone.entries.flatMap { listOf(Channels.id(it, false), Channels.id(it, true)) }
        assertEquals(ids.size, ids.toSet().size); assertEquals(Tone.Nashmi, Tone.of("nonsense"))
        val ctx = androidx.test.core.app.ApplicationProvider.getApplicationContext<android.content.Context>()
        Channels.ensure(ctx, Tone.Bell); Channels.ensure(ctx, Tone.Tap)
        val made = ctx.getSystemService(android.app.NotificationManager::class.java).notificationChannels.map { it.id }.toSet()
        assertEquals(setOf("messages_tap", "urgent_tap"), made)
    }
}
