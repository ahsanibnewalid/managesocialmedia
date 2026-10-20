package com.tidepost.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF101827)
private val Panel = Color(0xFF1B2638)
private val Mint = Color(0xFF72E0C1)
private val Muted = Color(0xFF9BAAC0)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { TidepostApp() }
    }
}

@Composable
private fun TidepostApp() {
    var selected by rememberSaveable { mutableIntStateOf(0) }
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
                    0 -> Dashboard()
                    1 -> CalendarPage()
                    2 -> ComposerPage()
                    3 -> AnalyticsPage()
                    else -> SettingsPage()
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun Dashboard() {
    Text("Welcome to Tidepost 👋", color = Muted, fontSize = 14.sp)
    Text("Your workspace at a glance", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MetricCard("Scheduled", "—", "Connect server first", Modifier.weight(1f))
        MetricCard("Published", "—", "Real data only", Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MetricCard("Accounts", "—", "Not connected yet", Modifier.weight(1f))
        MetricCard("Needs attention", "—", "Status unavailable", Modifier.weight(1f))
    }
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Start here", fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Follow these steps to get set up. Your progress is saved while this screen stays open; server sync will be added with account integration.", color = Muted, fontSize = 13.sp)
            SetupStep("1", "Connect your server", "Enter your secure HTTPS website in Settings.")
            SetupStep("2", "Sign in", "Use your Tidepost account; never share your password.")
            SetupStep("3", "Connect a social account", "Follow the provider sign-in and permission screens.")
            SetupStep("4", "Create your first post", "Preview the text and target accounts before publishing.")
        }
    }
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Beginner tip", color = Mint, fontWeight = FontWeight.Bold)
            Text("If a social account says “Reconnect”, sign in again from Connected Accounts on the web console. Never paste an access token into chat or a support message.", color = Muted, fontSize = 14.sp)
        }
    }
}

@Composable
private fun SetupStep(number: String, title: String, detail: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(color = Ink, shape = RoundedCornerShape(12.dp)) {
            Text(number, Modifier.padding(horizontal = 13.dp, vertical = 9.dp), color = Mint, fontWeight = FontWeight.Bold)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(detail, color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
        }
    }
}

@Composable
private fun MetricCard(title: String, value: String, note: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, color = Muted, fontSize = 13.sp)
            Text(value, color = Mint, fontSize = 29.sp, fontWeight = FontWeight.Bold)
            Text(note, color = Muted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun CalendarPage() {
    Text("Content calendar", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Your schedule, in one place", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text("After you connect your server, this screen will show planned posts and their publishing status.", color = Muted, fontSize = 14.sp)
            InfoLine("Scheduled", "Posts waiting for their planned time")
            InfoLine("Published", "Posts confirmed as published by the server")
            InfoLine("Needs attention", "Failed or uncertain posts to review")
            Text("Time-zone tip: always check the displayed date and time before scheduling. Time-zone-aware scheduling will be connected to the server API.", color = Mint, fontSize = 13.sp)
        }
    }
}

@Composable
private fun ComposerPage() {
    var caption by rememberSaveable { mutableStateOf("") }
    var showPreview by rememberSaveable { mutableStateOf(false) }
    Text("Create a post", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Text("Draft your message before connecting accounts.", color = Muted, fontSize = 14.sp)
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Caption", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            OutlinedTextField(
                value = caption,
                onValueChange = { caption = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("What would you like to share?") },
                placeholder = { Text("Write a helpful update…") },
                minLines = 5,
                supportingText = { Text("${caption.length} characters · draft stays on this screen for now") }
            )
            Text("Before publishing", color = Mint, fontWeight = FontWeight.Bold)
            Text("• Choose the correct social accounts\n• Check media and platform requirements\n• Review the final preview\n• Confirm the schedule and time zone", color = Muted, fontSize = 13.sp, lineHeight = 21.sp)
            Button(onClick = { showPreview = true }, enabled = caption.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                Text("Preview draft")
            }
            if (showPreview) {
                Surface(color = Ink, shape = RoundedCornerShape(14.dp)) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Draft preview", color = Mint, fontWeight = FontWeight.Bold)
                        Text(caption, color = Color.White)
                        Text("Not published. Account selection and server publishing are not connected yet.", color = Muted, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun AnalyticsPage() {
    Text("Analytics", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Understand what works", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text("Once connected, this page will show only metrics actually returned by your connected platforms.", color = Muted, fontSize = 14.sp)
            InfoLine("Reach", "How many people saw your content, where supported")
            InfoLine("Engagement", "Interactions such as likes or comments, where available")
            InfoLine("Post performance", "Compare posts over a selected period")
            Text("Some platforms do not provide every metric. Missing data will be labelled clearly instead of shown as zero.", color = Mint, fontSize = 13.sp)
        }
    }
}

@Composable
private fun InfoLine(title: String, detail: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, fontWeight = FontWeight.SemiBold)
        Text(detail, color = Muted, fontSize = 12.sp)
    }
}

@Composable
private fun SettingsPage() {
    var serverUrl by rememberSaveable { mutableStateOf("") }
    var message by rememberSaveable { mutableStateOf("Not checked yet.") }
    Text("Settings", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Connect your Tidepost server", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text("Use the HTTPS address where your Tidepost website is deployed. Do not enter your social media password here.", color = Muted, fontSize = 13.sp)
            OutlinedTextField(
                value = serverUrl, onValueChange = { serverUrl = it.trim() },
                modifier = Modifier.fillMaxWidth(), label = { Text("https://your-tidepost-domain.com") },
                singleLine = true
            )
            Button(onClick = {
                val valid = serverUrl.startsWith("https://") &&
                    serverUrl.removePrefix("https://").let { it.isNotBlank() && !it.contains(" ") && !it.startsWith("/") }
                message = if (valid) "URL format looks okay. This does not yet contact the server." else "Please enter a full HTTPS address, for example https://social.example.com"
            }, modifier = Modifier.fillMaxWidth()) { Text("Check address") }
            Text(message, color = Mint, fontSize = 13.sp)
            Text("Why HTTPS? It helps protect information while it travels between your phone and server.", color = Muted, fontSize = 12.sp)
            Text("Connection test, sign-in, and securely saving this address are not implemented yet.", color = Muted, fontSize = 12.sp)
        }
    }
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Need help?", fontWeight = FontWeight.Bold)
            Text("If something fails, note the screen and the exact error. Never send passwords, one-time codes, or access tokens to anyone helping you.", color = Muted, fontSize = 13.sp)
        }
    }
}
