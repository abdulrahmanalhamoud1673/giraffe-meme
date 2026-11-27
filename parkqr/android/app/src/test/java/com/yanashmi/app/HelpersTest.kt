package com.yanashmi.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HelpersTest {
    @Test fun arabicDigitsBecomeLatin() { assertEquals("0795551234", digits("٠٧٩٥٥٥١٢٣٤")); assertEquals("0788", digits("۰۷۸۸")); assertEquals("079 555", digits("079 555")) }
    @Test fun timeAgoBuckets() {
        val now = System.currentTimeMillis() / 1000
        assertEquals("هلأ", timeAgo(now - 10)); assertEquals("قبل 5 دقيقة", timeAgo(now - 300)); assertEquals("قبل 2 ساعة", timeAgo(now - 7300)); assertEquals("قبل 3 يوم", timeAgo(now - 3 * 86400 - 5))
    }
    @Test fun everyMessageKindHasText() { for (k in listOf("block", "urgent", "lights", "open", "fault", "hit", "thanks")) assertTrue(KINDS.containsKey(k)) }
    @Test fun repliesMatchTheServer() { assertEquals(listOf("2", "5", "10", "cant"), REPLIES.keys.toList()) }
}
