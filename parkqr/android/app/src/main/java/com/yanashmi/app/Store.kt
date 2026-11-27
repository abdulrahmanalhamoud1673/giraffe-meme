package com.yanashmi.app

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** The owner key and a few settings, encrypted on the device (Android Keystore). */
class Store(ctx: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        ctx, "yn_secure",
        MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
    var key: String
        get() = prefs.getString("key", "") ?: ""
        set(v) = prefs.edit().putString("key", v).apply()
    var token: String
        get() = prefs.getString("token", "") ?: ""
        set(v) = prefs.edit().putString("token", v).apply()
    /** ids of messages we already told the owner about (so the background check does not repeat notifications) */
    var seen: Set<String>
        get() = prefs.getStringSet("seen", emptySet()) ?: emptySet()
        set(v) = prefs.edit().putStringSet("seen", v.toList().takeLast(200).toSet()).apply()
    fun clear() = prefs.edit().clear().apply()

    companion object {
        @Volatile private var inst: Store? = null
        fun get(ctx: Context): Store = inst ?: synchronized(this) { inst ?: Store(ctx.applicationContext).also { inst = it } }
    }
}
