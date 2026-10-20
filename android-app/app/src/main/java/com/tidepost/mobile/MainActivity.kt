package com.tidepost.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
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
    var selected by remember { mutableIntStateOf(0) }
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
                    1 -> SimplePage("Content calendar", "Your scheduled posts will appear here once connected to your Tidepost server.")
                    2 -> SimplePage("Create a post", "The post composer will connect to the existing publishing API in the next integration step.")
                    3 -> SimplePage("Analytics", "Real analytics will load from your workspace after secure API integration.")
                    else -> SettingsPage()
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun Dashboard() {
    Text("Good to see you", color = Muted, fontSize = 14.sp)
    Text("Your workspace at a glance", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MetricCard("Scheduled", "—", "Waiting for server", Modifier.weight(1f))
        MetricCard("Published", "—", "Waiting for server", Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MetricCard("Accounts", "—", "Not connected", Modifier.weight(1f))
        MetricCard("Needs attention", "—", "No live data yet", Modifier.weight(1f))
    }
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Connect your Tidepost workspace", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text("This Android starter is ready for API integration. No sample numbers are presented as real account data.", color = Muted, fontSize = 14.sp)
            Text("Next: configure your HTTPS server URL, sign in securely, then load workspace data.", color = Mint, fontSize = 13.sp)
        }
    }
    Text("Quick access", fontSize = 18.sp, fontWeight = FontWeight.Bold)
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        QuickChip("Create post")
        QuickChip("Calendar")
        QuickChip("Reports")
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
private fun QuickChip(label: String) {
    Surface(color = Panel, shape = RoundedCornerShape(14.dp)) {
        Text(label, Modifier.padding(horizontal = 12.dp, vertical = 12.dp), fontSize = 12.sp)
    }
}

@Composable
private fun SimplePage(title: String, description: String) {
    Text(title, fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Text(description, Modifier.padding(18.dp), color = Muted, fontSize = 15.sp, lineHeight = 23.sp)
    }
}

@Composable
private fun SettingsPage() {
    var serverUrl by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("Server connection is not configured.") }
    Text("Settings", fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Tidepost server", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text("Enter your deployed HTTPS URL. This starter does not save credentials or send data yet.", color = Muted, fontSize = 13.sp)
            OutlinedTextField(
                value = serverUrl, onValueChange = { serverUrl = it },
                modifier = Modifier.fillMaxWidth(), label = { Text("https://your-tidepost-domain.com") },
                singleLine = true
            )
            Button(onClick = {
                message = if (serverUrl.startsWith("https://") && serverUrl.length > 8)
                    "URL format looks valid. API connectivity still needs implementation and testing."
                else "Use a valid HTTPS URL for secure connections."
            }, modifier = Modifier.fillMaxWidth()) { Text("Check URL format") }
            Text(message, color = Mint, fontSize = 13.sp)
        }
    }
}
