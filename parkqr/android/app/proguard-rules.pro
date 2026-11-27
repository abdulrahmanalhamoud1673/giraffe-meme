-keep class com.yanashmi.app.** { *; }
# encrypted storage (Tink) and Google sign-in find classes by name
-keep class com.google.crypto.tink.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn javax.annotation.concurrent.**
# parts of Tink this app never calls (online key download)
-dontwarn com.google.api.client.http.**
-dontwarn org.joda.time.Instant
