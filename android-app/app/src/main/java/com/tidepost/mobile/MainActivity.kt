package com.tidepost.mobile

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF101827)
private val Panel = Color(0xFF1B2638)
private val Mint = Color(0xFF72E0C1)
private val Muted = Color(0xFF9BAAC0)
private const val PREFS_NAME = "tidepost_local"
private const val KEY_SERVER_URL = "server_url"
private const val KEY_DRAFT = "draft_caption"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { TidepostApp() }
    }
}

@Composable
private fun TidepostApp() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }
    var selected by remember { mutableIntStateOf(0) }
    var serverUrl by remember { mutableStateOf(prefs.getString(KEY_SERVER_URL, "") ?: "") }
    var draft by remember { mutableStateOf(prefs.getString(KEY_DRAFT, "") ?: "") }
    var notice by remember { mutableStateOf("Your draft stays on this phone until you choose to share it.") }

    MaterialTheme(colorScheme = darkColorScheme(
        primary = Mint, background = Ink, surface = Panel,
        onPrimary = Ink, onBackground = Color.White, onSurface = Color.White
    )) {
        Scaffold(
            containerColor = Ink,
            bottomBar = {
                NavigationBar(containerColor = Panel) {
                    val items = listOf(
                        "Home" to Icons.Default.Home,
                        "Calendar" to Icons.Default.CalendarMonth,
                        "Compose" to Icons.Default.EditNote,
                        "Analytics" to Icons.Default.Analytics,
                        "Settings" to Icons.Default.Settings
                    )
                    items.forEachIndexed { index, item ->
                        NavigationBarItem(
                            selected = selected == index,
                            onClick = { selected = index },
                            icon = { Icon(item.second, contentDescription = item.first) },
                            label = { Text(item.first) }
                        )
                    }
                }
            }
        ) { padding ->
            Column(
                Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("TIDEPOST", color = Mint, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                        Text("Your social desk", fontSize = 27.sp, fontWeight = FontWeight.Bold)
                    }
                    Surface(shape = RoundedCornerShape(14.dp), color = Panel) {
                        Text("TP", Modifier.padding(14.dp), color = Mint, fontWeight = FontWeight.Bold)
                    }
                }
                when (selected) {
                    0 -> Dashboard(
                        serverUrl = serverUrl,
                        draft = draft,
                        onOpenWeb = { openWebConsole(context, serverUrl, onResult = { notice = it }) },
                        onCompose = { selected = 2 }
                    )
                    1 -> CalendarPage()
                    2 -> ComposerPage(
                        draft = draft,
                        notice = notice,
                        onDraftChange = { draft = it },
                        onSave = {
                            prefs.edit().putString(KEY_DRAFT, draft).apply()
                            notice = "Draft saved on this phone. It is not published or synced to the web yet."
                        },
                        onCopy = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("Tidepost draft", draft))
                            notice = "Caption copied. Paste it into the web composer when you're back at your computer."
                        },
                        onShare = {
                            shareDraft(context, draft)
                            notice = "Choose an app to share the caption. Sharing does not publish it to a social account."
                        }
                    )
                    3 -> AnalyticsPage()
                    else -> SettingsPage(
                        initialUrl = serverUrl,
                        onSave = { value ->
                            serverUrl = value
                            prefs.edit().putString(KEY_SERVER_URL, value).apply()
                            notice = if (value.isBlank()) "Please enter a valid HTTPS URL." else "Server URL saved on this phone. API connectivity is not verified."
                        },
                        onOpenWeb = { openWebConsole(context, serverUrl, onResult = { notice = it }) },
                        notice = notice
                    )
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun Dashboard(serverUrl: String, draft: String, onOpenWeb: () -> Unit, onCompose: () -> Unit) {
    Text("Your work, wherever you are", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Bold)
    Text("Start a caption on your phone, save it, then copy it into the web console at home or work.", color = Muted, fontSize = 14.sp)
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MetricCard("Saved draft", if (draft.isBlank()) "0" else "1", "Stored on this phone", Modifier.weight(1f))
        MetricCard("Workspace", if (serverUrl.isBlank()) "Setup" else "Saved", "Server URL only", Modifier.weight(1f))
    }
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Pick up where you left off", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text(
                if (draft.isBlank()) "No local draft yet. Start one now; it will remain on this phone after you close the app."
                else "You have a saved caption (" + draft.length + " characters). Open Compose to edit, copy, or share it.",
                color = Muted, fontSize = 14.sp
            )
            Button(onClick = onCompose, modifier = Modifier.fillMaxWidth()) { Text(if (draft.isBlank()) "Start a draft" else "Continue draft") }
        }
    }
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Continue on the web", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text(
                if (serverUrl.isBlank()) "Add your HTTPS Tidepost web URL in Settings first."
                else "Open your saved Tidepost web URL in your browser. Sign in there as usual.",
                color = Muted, fontSize = 14.sp
            )
            Button(onClick = onOpenWeb, enabled = serverUrl.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Open web console") }
        }
    }
    Text("What works today", fontSize = 18.sp, fontWeight = FontWeight.Bold)
    Text("✓ Save a draft locally\n✓ Copy or share a caption\n✓ Remember your server URL\n✓ Open the web console", color = Muted, lineHeight = 24.sp)
    Text("Live workspace data, cross-device draft sync, scheduling, and publishing still need backend integration.", color = Mint, fontSize = 13.sp)
}

@Composable
private fun MetricCard(title: String, value: String, note: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, color = Muted, fontSize = 13.sp)
            Text(value, color = Mint, fontSize = 25.sp, fontWeight = FontWeight.Bold)
            Text(note, color = Muted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun CalendarPage() {
    Text("Content calendar", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    InfoCard("Plan from anywhere", "When connected to the Tidepost API, this screen can show scheduled, published, and failed posts. No calendar data is fabricated in this scaffold.")
    InfoCard("Helpful workflow", "Use the phone to capture ideas, then open the web console to review platform requirements and schedule a post.")
}

@Composable
private fun ComposerPage(
    draft: String,
    notice: String,
    onDraftChange: (String) -> Unit,
    onSave: () -> Unit,
    onCopy: () -> Unit,
    onShare: () -> Unit
) {
    Text("Create a post", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Text("Write it on your phone. Save it here, then copy or share it when you're ready to work on the web.", color = Muted, fontSize = 14.sp)
    OutlinedTextField(
        value = draft,
        onValueChange = onDraftChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Caption / idea") },
        placeholder = { Text("Write your post here…") },
        minLines = 5
    )
    Text(draft.length.toString() + " characters", color = Muted, fontSize = 12.sp)
    Button(onClick = onSave, enabled = draft.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Save draft on this phone") }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        TextButton(onClick = onCopy, enabled = draft.isNotBlank(), modifier = Modifier.weight(1f)) { Text("Copy caption") }
        TextButton(onClick = onShare, enabled = draft.isNotBlank(), modifier = Modifier.weight(1f)) { Text("Share caption") }
    }
    InfoCard("Before publishing", "These actions only save, copy, or share text. They do not publish or schedule a post. Review the caption and platform-specific rules in the web console.")
    InfoCard("Status", notice)
}

@Composable
private fun AnalyticsPage() {
    Text("Analytics", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    InfoCard("Understand your results", "Reach means people who saw content; engagement includes interactions such as likes, comments, and shares.")
    InfoCard("Honest data only", "This screen will show actual workspace metrics after API integration. Unsupported or missing metrics will not be shown as zero.")
}

@Composable
private fun SettingsPage(
    initialUrl: String,
    onSave: (String) -> Unit,
    onOpenWeb: () -> Unit,
    notice: String
) {
    var serverUrl by remember(initialUrl) { mutableStateOf(initialUrl) }
    var validationMessage by remember { mutableStateOf("") }
    Text("Settings", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Tidepost server", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text("Save the HTTPS address of your web console. It is stored locally on this device.", color = Muted, fontSize = 13.sp)
            OutlinedTextField(
                value = serverUrl, onValueChange = { serverUrl = it.trim() },
                modifier = Modifier.fillMaxWidth(), label = { Text("https://your-tidepost-domain.com") },
                singleLine = true
            )
            Button(onClick = {
                val uri = runCatching { Uri.parse(serverUrl) }.getOrNull()
                if (uri?.scheme == "https" && !uri.host.isNullOrBlank()) {
                    onSave(serverUrl.trim())
                    validationMessage = "HTTPS URL format looks valid."
                } else {
                    validationMessage = "Enter a valid URL beginning with https://."
                }
            }, modifier = Modifier.fillMaxWidth()) { Text("Save HTTPS URL") }
            Button(onClick = onOpenWeb, enabled = initialUrl.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Open web console") }
            Text(validationMessage.ifBlank { notice }, color = Mint, fontSize = 13.sp)
            Text("This only checks the URL format. It does not test server availability, sign you in, or sync data.", color = Muted, fontSize = 12.sp)
            Text("Never enter your social account password or provider access token here.", color = Muted, fontSize = 12.sp)
        }
    }
    InfoCard("Privacy", "Drafts and the server URL are stored locally in this app's private preferences. They are not encrypted cloud backups and do not sync to your other devices.")
}

@Composable
private fun InfoCard(title: String, body: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(body, color = Muted, fontSize = 14.sp, lineHeight = 21.sp)
        }
    }
}

private fun openWebConsole(context: Context, serverUrl: String, onResult: (String) -> Unit) {
    val uri = runCatching { Uri.parse(serverUrl) }.getOrNull()
    if (uri?.scheme != "https" || uri.host.isNullOrBlank()) {
        onResult("Save a valid HTTPS server URL in Settings first.")
        return
    }
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
        onResult("Opened the web console in your browser. Sign in there securely.")
    }.onFailure {
        onResult("Could not open a browser for this URL.")
    }
}

private fun shareDraft(context: Context, draft: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, draft)
    }
    context.startActivity(Intent.createChooser(intent, "Share Tidepost caption"))
}
