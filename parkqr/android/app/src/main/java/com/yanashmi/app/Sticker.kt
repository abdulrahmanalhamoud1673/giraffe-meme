package com.yanashmi.app

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color as AColor
import android.graphics.Paint
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import java.io.File

fun scanUrl(token: String) = "https://yanashmi.com/c?t=$token"

fun qr(text: String, size: Int = 640): Bitmap {
    val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, mapOf(EncodeHintType.MARGIN to 1))
    val pixels = IntArray(m.width * m.height) { i -> if (m[i % m.width, i / m.width]) AColor.BLACK else AColor.WHITE }
    return Bitmap.createBitmap(pixels, m.width, m.height, Bitmap.Config.ARGB_8888)
}

/** The picture to print: the shemagh band, the code, two words and the short code. */
fun stickerBitmap(ctx: Context, token: String): Bitmap {
    val w = 1000; val h = 1300
    val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(out); c.drawColor(AColor.WHITE)
    val red = Paint().apply { color = 0xFFC8102E.toInt() }
    for (i in 0 until w / 25) for (j in 0..1) if ((i + j) % 2 == 0) c.drawRect(i * 25f, j * 25f, (i + 1) * 25f, (j + 1) * 25f, red)
    val face = ResourcesCompat.getFont(ctx, R.font.cairo)
    fun line(text: String, y: Float, size: Float, color: Int) = c.drawText(text, w / 2f, y, Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = size; this.color = color; textAlign = Paint.Align.CENTER; typeface = face; isFakeBoldText = true })
    line("يا نشمي", 180f, 96f, 0xFF161213.toInt())
    c.drawBitmap(qr(scanUrl(token), 800), 100f, 240f, null)
    line("مسكّر عليّ؟ امسحني", 1150f, 64f, 0xFF161213.toInt())
    line("YN-${token.uppercase()}", 1240f, 40f, 0xFF756C6E.toInt())
    return out
}

/** Hands the sticker picture to any app the person picks (print, WhatsApp, files). */
fun shareSticker(ctx: Context, token: String) {
    val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
    val file = File(dir, "yanashmi-sticker.png")
    file.outputStream().use { stickerBitmap(ctx, token).compress(Bitmap.CompressFormat.PNG, 100, it) }
    val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.share", file)
    val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    send.clipData = ClipData.newRawUri(null, uri)
    ctx.startActivity(Intent.createChooser(send, "الملصق"))
}
