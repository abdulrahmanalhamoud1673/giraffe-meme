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
}
