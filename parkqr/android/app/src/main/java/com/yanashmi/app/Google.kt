package com.yanashmi.app

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/** The public "Web application" OAuth client id (not a secret). The server checks the token was issued for it. */
const val GOOGLE_WEB_CLIENT_ID = "970792846835-nhrrmivpefah46hn8sktn8albpbet90b.apps.googleusercontent.com"

/** Shows Google's account sheet and returns the ID token. Needs an Activity context. */
suspend fun googleIdToken(ctx: Context): String {
    val request = GetCredentialRequest.Builder().addCredentialOption(GetSignInWithGoogleOption.Builder(GOOGLE_WEB_CLIENT_ID).build()).build()
    val c = CredentialManager.create(ctx).getCredential(ctx, request).credential
    check(c is CustomCredential && c.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) { "unexpected credential" }
    return GoogleIdTokenCredential.createFrom(c.data).idToken
}
