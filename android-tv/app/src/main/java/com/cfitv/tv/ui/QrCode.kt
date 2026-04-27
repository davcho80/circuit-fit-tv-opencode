package com.cfitv.tv.ui

import android.graphics.Bitmap
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

// ============================================================
// Génération d'un QR code via ZXing → ImageBitmap pour Compose
// ============================================================

fun generateQrImageBitmap(content: String, sizePx: Int = 512): ImageBitmap {
    val hints = mapOf(
        EncodeHintType.MARGIN        to 1,          // quiet zone minimal
        EncodeHintType.CHARACTER_SET to "UTF-8",
    )
    val writer    = QRCodeWriter()
    val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
    val bmp       = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)

    for (x in 0 until sizePx) {
        for (y in 0 until sizePx) {
            bmp.setPixel(x, y, if (bitMatrix[x, y]) 0xFF0F172A.toInt() else 0xFFF1F5F9.toInt())
        }
    }
    return bmp.asImageBitmap()
}
