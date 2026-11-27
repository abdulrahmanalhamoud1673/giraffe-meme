package com.yanashmi.app

import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.launch

enum class Moderate(val title: String, val body: String, val action: String) {
    Report("إبلاغ عن المرسل؟", "بنراجع رسائله، وبينحظر عندك.", "أبلّغ"),
    Block("حظر المرسل؟", "ما رح يعرف.", "احظر"),
}

@Composable
fun ModerationMenu(blocked: Boolean, tint: Color, onPick: (Moderate) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }) { Icon(Icons.Filled.MoreVert, "خيارات", tint = tint) }
        DropdownMenu(open, { open = false }, containerColor = Color.White) {
            DropdownMenuItem(text = { Text("إبلاغ", color = Red) }, leadingIcon = { Icon(Icons.Filled.Flag, null, tint = Red) }, onClick = { open = false; onPick(Moderate.Report) })
            DropdownMenuItem(text = { Text(if (blocked) "محظور" else "حظر") }, enabled = !blocked, leadingIcon = { Icon(Icons.Filled.Block, null) }, onClick = { open = false; onPick(Moderate.Block) })
        }
    }
}

@Composable
fun ModerationDialog(what: Moderate, key: String, id: String, onDone: () -> Unit, onError: (String) -> Unit, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onClose, containerColor = Color.White, title = { Text(what.title) }, text = { Text(what.body) },
        confirmButton = {
            TextButton(enabled = !busy, onClick = {
                busy = true
                scope.launch {
                    try { if (what == Moderate.Report) Api.report(key, id) else Api.block(key, id); onDone() }
                    catch (e: Exception) { onError(errText(e)) }
                    onClose()      // closed only after the request, so it is not cancelled with the dialog
                }
            }) { Text(what.action, color = Red) }
        },
        dismissButton = { TextButton(onClick = onClose) { Text("إلغاء") } },
    )
}
