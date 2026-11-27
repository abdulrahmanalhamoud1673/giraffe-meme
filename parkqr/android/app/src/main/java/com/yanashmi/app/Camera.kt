package com.yanashmi.app

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File

/** Shrinks a camera file to <= ~200 KB JPEG (max 960 px wide) and returns it as a data URL, the format the server expects. */
fun encodePhoto(file: File): String? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    var sample = 1
    while (bounds.outWidth / sample > 1920) sample *= 2
    var bmp = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    val rot = when (ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1)) { 6 -> 90f; 3 -> 180f; 8 -> 270f; else -> 0f }
    if (rot != 0f) bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(rot) }, true)
    val w = minOf(960, bmp.width); val h = (bmp.height * w.toFloat() / bmp.width).toInt().coerceAtLeast(1)
    val small = Bitmap.createScaledBitmap(bmp, w, h, true)
    var q = 82; var bytes: ByteArray
    do { val o = ByteArrayOutputStream(); small.compress(Bitmap.CompressFormat.JPEG, q, o); bytes = o.toByteArray(); q -= 10 } while (bytes.size > 200_000 && q > 30)
    return "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
}

/**
 * Live camera only: the picture is taken from the camera preview here, there is no gallery picker anywhere in the app,
 * so a picture cannot be an old file or an AI-generated one. Returns a data URL, or null if cancelled.
 */
@Composable
fun CameraScreen(onDone: (String?) -> Unit) {
    val ctx = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        granted = it
        if (!it) { Toast.makeText(ctx, "فعّل الكاميرا من إعدادات الموبايل", Toast.LENGTH_LONG).show(); onDone(null) }
    }
    LaunchedEffect(Unit) { if (!granted) ask.launch(Manifest.permission.CAMERA) }
    var data by remember { mutableStateOf<String?>(null) }
    var preview by remember { mutableStateOf<Bitmap?>(null) }
    var busy by remember { mutableStateOf(false) }
    val capture = remember { ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build() }
    BackHandler { onDone(null) }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (granted && preview == null) {
            AndroidView(
                factory = { c ->
                    PreviewView(c).also { pv ->
                        pv.scaleType = PreviewView.ScaleType.FILL_CENTER
                        val future = ProcessCameraProvider.getInstance(c)
                        future.addListener({
                            val p = future.get()
                            val prev = Preview.Builder().build().also { it.setSurfaceProvider(pv.surfaceProvider) }
                            p.unbindAll()
                            try { p.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, prev, capture) } catch (_: Exception) { onDone(null) }
                        }, ContextCompat.getMainExecutor(c))
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )
        }
        preview?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }

        IconButton(onClick = { onDone(null) }, Modifier.statusBarsPadding().padding(12.dp).size(44.dp).clip(CircleShape).background(Color(0x99000000))) {
            Icon(Icons.Filled.Close, "إغلاق", tint = Color.White)
        }
        Row(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().padding(24.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
        ) {
            if (preview == null) {
                Box(
                    Modifier.size(78.dp).clip(CircleShape).border(4.dp, Color.White, CircleShape).padding(6.dp).clip(CircleShape)
                        .background(if (busy) Color.Gray else Color.White).clickable(enabled = granted && !busy) {
                            busy = true
                            val file = File(ctx.cacheDir, "shot_${System.currentTimeMillis()}.jpg")
                            capture.takePicture(ImageCapture.OutputFileOptions.Builder(file).build(), ContextCompat.getMainExecutor(ctx), object : ImageCapture.OnImageSavedCallback {
                                override fun onImageSaved(r: ImageCapture.OutputFileResults) {
                                    scope.launch {
                                        val d = withContext(Dispatchers.Default) { val x = encodePhoto(file); file.delete(); x }
                                        if (d == null) { busy = false; return@launch }
                                        val raw = Base64.decode(d.substringAfter(","), Base64.DEFAULT)
                                        preview = BitmapFactory.decodeByteArray(raw, 0, raw.size); data = d; busy = false
                                    }
                                }
                                override fun onError(e: ImageCaptureException) { busy = false }
                            })
                        },
                )
            } else {
                OutlinedButton(onClick = { preview = null; data = null }, Modifier.weight(1f).height(52.dp), shape = CircleShape, colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)) { Text("إعادة") }
                Button(onClick = { onDone(data) }, Modifier.weight(1f).height(52.dp), shape = CircleShape) { Text("إرسال") }
            }
        }
    }
}
