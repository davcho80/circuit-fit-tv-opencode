package com.cfitv.tv.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// ============================================================
// Écran de configuration — deux modes :
//   1. Appairage (recommandé) : URL → PIN → console admin
//   2. Manuel : formulaire complet (avancé)
// ============================================================

private val BG    = Color(0xFF020617) // slate-950
private val CARD  = Color(0xFF0F172A) // slate-900
private val INPUT = Color(0xFF1E293B) // slate-800
private val SKY   = Color(0xFF0EA5E9) // sky-500
private val TEXT  = Color(0xFFF1F5F9) // slate-100
private val MUTED = Color(0xFF94A3B8) // slate-400

@Composable
fun SetupScreen(
    serverUrl: String,
    label: String,
    stationNumber: Int,
    isLandscape: Boolean,
    screenType: TvViewModel.ScreenType,
    isDiscovering: Boolean,
    isPairing: Boolean,
    pairingPin: String,
    pairingUrl: String,
    connected: Boolean,
    onServerUrlChange: (String) -> Unit,
    onLabelChange: (String) -> Unit,
    onStationNumberChange: (Int) -> Unit,
    onOrientationChange: (Boolean) -> Unit,
    onScreenTypeChange: (TvViewModel.ScreenType) -> Unit,
    onStartPairing: () -> Unit,
    onCancelPairing: () -> Unit,
    onRetryDiscovery: () -> Unit,
    onConnect: () -> Unit,
) {
    // Bascule entre mode appairage (défaut) et formulaire manuel
    var isManualMode by remember { mutableStateOf(false) }

    Surface(modifier = Modifier.fillMaxSize(), color = BG) {

        // ── Découverte mDNS en cours ──────────────────────────────
        if (isDiscovering) {
            DiscoveringScreen()
            return@Surface
        }

        // ── Mode Appairage QR ─────────────────────────────────────
        if (isPairing) {
            PairingScreen(
                pin        = pairingPin,
                pairingUrl = pairingUrl,
                connected  = connected,
                onCancel   = onCancelPairing,
            )
            return@Surface
        }

        // ── Formulaire (manuel ou initial) ──────────────────────
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 48.dp, vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Titre
            Text(
                text = "Circuit Fit TV",
                fontSize = 42.sp,
                fontWeight = FontWeight.Black,
                color = SKY,
                letterSpacing = (-1).sp,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "Configuration de l'écran",
                fontSize = 18.sp,
                color = MUTED,
            )

            Spacer(Modifier.height(32.dp))

            Surface(
                modifier = Modifier.widthIn(max = 620.dp).fillMaxWidth(),
                color = CARD,
                shape = RoundedCornerShape(20.dp),
            ) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {

                    if (!isManualMode) {
                        // ── Mode Appairage (défaut) ───────────────────

                        // Explication : serveur non trouvé automatiquement
                        Surface(
                            color = Color(0xFF1E293B),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("ℹ️", fontSize = 18.sp)
                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(
                                        "Serveur non trouvé automatiquement",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TEXT,
                                    )
                                    Text(
                                        "Entrez l'URL manuellement ou relancez la recherche.",
                                        fontSize = 11.sp,
                                        color = MUTED,
                                    )
                                }
                            }
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                "URL du serveur",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = MUTED,
                            )
                            OutlinedTextField(
                                value = serverUrl,
                                onValueChange = onServerUrlChange,
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = {
                                    Text("ws://192.168.1.1:3000/ws", color = Color(0xFF475569))
                                },
                                singleLine = true,
                                colors = textFieldColors(),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                                shape = RoundedCornerShape(12.dp),
                            )
                        }

                        // Bouton principal : obtenir un code QR
                        Button(
                            onClick = onStartPairing,
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SKY),
                        ) {
                            Text(
                                "Obtenir un code QR",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                        }

                        // Bouton secondaire : relancer la recherche mDNS
                        OutlinedButton(
                            onClick = onRetryDiscovery,
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color(0xFF334155)),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MUTED),
                        ) {
                            Text("🔍  Rechercher le serveur sur le réseau", fontSize = 14.sp)
                        }

                        // Lien vers config manuelle
                        TextButton(
                            onClick = { isManualMode = true },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                "⚙️  Configurer manuellement",
                                fontSize = 14.sp,
                                color = MUTED,
                            )
                        }

                    } else {
                        // ── Mode Manuel (formulaire complet) ─────────

                        // Bouton retour
                        TextButton(
                            onClick = { isManualMode = false },
                            modifier = Modifier.align(Alignment.Start),
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            Text("← Retour", fontSize = 13.sp, color = MUTED)
                        }

                        // Type d'écran
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "Type d'écran",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = MUTED,
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                TypeButton(
                                    icon     = "🏋",
                                    label    = "Station",
                                    desc     = "Exercices & timer",
                                    selected = screenType == TvViewModel.ScreenType.STATION,
                                    modifier = Modifier.weight(1f),
                                    onClick  = { onScreenTypeChange(TvViewModel.ScreenType.STATION) },
                                )
                                TypeButton(
                                    icon     = "📊",
                                    label    = "Dashboard",
                                    desc     = "Vue d'ensemble",
                                    selected = screenType == TvViewModel.ScreenType.DASHBOARD,
                                    modifier = Modifier.weight(1f),
                                    onClick  = { onScreenTypeChange(TvViewModel.ScreenType.DASHBOARD) },
                                )
                            }
                        }

                        // URL serveur
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                "URL du serveur",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = MUTED,
                            )
                            OutlinedTextField(
                                value = serverUrl,
                                onValueChange = onServerUrlChange,
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = {
                                    Text("ws://192.168.1.1:3000/ws", color = Color(0xFF475569))
                                },
                                singleLine = true,
                                colors = textFieldColors(),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                                shape = RoundedCornerShape(12.dp),
                            )
                        }

                        // Nom de l'écran
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                "Nom de cet écran",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = MUTED,
                            )
                            OutlinedTextField(
                                value = label,
                                onValueChange = onLabelChange,
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = {
                                    Text(
                                        if (screenType == TvViewModel.ScreenType.STATION) "Ex : Station 1"
                                        else "Ex : Dashboard",
                                        color = Color(0xFF475569),
                                    )
                                },
                                singleLine = true,
                                colors = textFieldColors(),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                                shape = RoundedCornerShape(12.dp),
                            )
                        }

                        // N° station + orientation (seulement pour Station)
                        if (screenType == TvViewModel.ScreenType.STATION) {
                            // Numéro de station
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    "N° de station dans le circuit",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MUTED,
                                )
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    OutlinedButton(
                                        onClick = { onStationNumberChange(stationNumber - 1) },
                                        modifier = Modifier.size(48.dp),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(0.dp),
                                        border = BorderStroke(1.dp, Color(0xFF334155)),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TEXT),
                                    ) { Text("−", fontSize = 22.sp, fontWeight = FontWeight.Bold) }

                                    Surface(
                                        modifier = Modifier.size(width = 72.dp, height = 48.dp),
                                        color = INPUT,
                                        shape = RoundedCornerShape(10.dp),
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = stationNumber.toString(),
                                                fontSize = 24.sp,
                                                fontWeight = FontWeight.Black,
                                                color = SKY,
                                            )
                                        }
                                    }

                                    OutlinedButton(
                                        onClick = { onStationNumberChange(stationNumber + 1) },
                                        modifier = Modifier.size(48.dp),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(0.dp),
                                        border = BorderStroke(1.dp, Color(0xFF334155)),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TEXT),
                                    ) { Text("+", fontSize = 22.sp, fontWeight = FontWeight.Bold) }
                                }
                            }

                            // Orientation
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    "Orientation de l'écran",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MUTED,
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    OrientationButton(
                                        icon = "▬", label = "Paysage", desc = "TV horizontale",
                                        selected = isLandscape, modifier = Modifier.weight(1f),
                                        onClick = { onOrientationChange(true) },
                                    )
                                    OrientationButton(
                                        icon = "▮", label = "Portrait", desc = "TV verticale",
                                        selected = !isLandscape, modifier = Modifier.weight(1f),
                                        onClick = { onOrientationChange(false) },
                                    )
                                }
                            }
                        }

                        // Bouton démarrer (manuel)
                        Button(
                            onClick = onConnect,
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SKY),
                        ) {
                            Text(
                                "Démarrer l'affichage",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}

// ── Écran de découverte mDNS ──────────────────────────────────

@Composable
private fun DiscoveringScreen() {
    val infiniteTransition = rememberInfiniteTransition(label = "dots")
    val dotOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue  = 3f,
        animationSpec = infiniteRepeatable(
            animation  = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "dotOffset",
    )

    Box(
        modifier = Modifier.fillMaxSize().background(BG),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // Indicateur animé
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(3) { idx ->
                    val active = dotOffset.toInt() == idx
                    Box(
                        modifier = androidx.compose.ui.Modifier
                            .size(if (active) 16.dp else 12.dp)
                            .background(
                                color = if (active) SKY else Color(0xFF1E293B),
                                shape = androidx.compose.foundation.shape.CircleShape,
                            )
                    )
                }
            }

            Text(
                text = "Recherche du serveur sur le réseau…",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = MUTED,
            )
            Text(
                text = "Assurez-vous que la TV et le serveur\nsont sur le même réseau WiFi.",
                fontSize = 14.sp,
                color = MUTED.copy(alpha = 0.6f),
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
            )
        }
    }
}

// ── Écran QR code d'appairage ─────────────────────────────────

@Composable
private fun PairingScreen(
    pin: String,
    pairingUrl: String,
    connected: Boolean,
    onCancel: () -> Unit,
) {
    // Générer le QR code sur un thread de fond (512×512 setPixel bloque le main thread)
    val qrBitmap: ImageBitmap? by produceState<ImageBitmap?>(null, pairingUrl) {
        value = withContext(Dispatchers.Default) {
            if (pairingUrl.isNotEmpty()) generateQrImageBitmap(pairingUrl, 512) else null
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(BG),
        contentAlignment = Alignment.Center,
    ) {
        // Layout horizontal : QR code à gauche, infos à droite
        Row(
            modifier = Modifier
                .widthIn(max = 860.dp)
                .padding(40.dp),
            horizontalArrangement = Arrangement.spacedBy(48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // ── QR code ──────────────────────────────────────────
            Surface(
                color = Color(0xFFF1F5F9),   // fond clair pour le QR
                shape = RoundedCornerShape(20.dp),
            ) {
                Box(modifier = Modifier.padding(20.dp)) {
                    if (qrBitmap != null) {
                        Image(
                            bitmap = qrBitmap,
                            contentDescription = "QR code d'appairage",
                            modifier = Modifier
                                .size(240.dp)
                                .clip(RoundedCornerShape(8.dp)),
                        )
                    } else {
                        Box(
                            modifier = Modifier.size(240.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("Génération…", color = MUTED, fontSize = 14.sp)
                        }
                    }
                }
            }

            // ── Infos ─────────────────────────────────────────────
            Column(
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "Scanner pour configurer",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                        color = TEXT,
                    )
                    Text(
                        text = "Scannez ce code QR avec votre tablette\npour configurer cet écran.",
                        fontSize = 16.sp,
                        color = MUTED,
                        lineHeight = 24.sp,
                    )
                }

                // Code PIN en fallback
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "CODE MANUEL",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp,
                        color = MUTED.copy(alpha = 0.6f),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pin.forEach { digit ->
                            Surface(
                                color = INPUT,
                                shape = RoundedCornerShape(10.dp),
                            ) {
                                Text(
                                    text = digit.toString(),
                                    fontSize = 36.sp,
                                    fontWeight = FontWeight.Black,
                                    color = SKY,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                )
                            }
                        }
                    }
                    Text(
                        text = "Saisissez ce code dans Circuit Fit TV → Écrans",
                        fontSize = 12.sp,
                        color = MUTED.copy(alpha = 0.6f),
                    )
                }

                // Statut connexion
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(
                                color = if (connected) Color(0xFF34D399) else Color(0xFFEF4444),
                                shape = androidx.compose.foundation.shape.CircleShape,
                            )
                    )
                    Text(
                        text = if (connected) "Connecté au serveur" else "Connexion en cours…",
                        fontSize = 13.sp,
                        color = if (connected) Color(0xFF34D399) else MUTED,
                    )
                }

                OutlinedButton(
                    onClick = onCancel,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, Color(0xFF334155)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MUTED),
                ) {
                    Text("Annuler", fontSize = 14.sp)
                }
            }
        }
    }
}

// ── Boutons ───────────────────────────────────────────────────

@Composable
private fun TypeButton(
    icon: String, label: String, desc: String,
    selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(88.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(2.dp, if (selected) SKY else Color(0xFF334155)),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (selected) SKY.copy(alpha = 0.1f) else Color.Transparent,
            contentColor   = if (selected) SKY else MUTED,
        ),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(icon, fontSize = 24.sp)
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(desc,  fontSize = 11.sp,
                color = if (selected) SKY.copy(alpha = 0.7f) else Color(0xFF475569))
        }
    }
}

@Composable
private fun OrientationButton(
    icon: String, label: String, desc: String,
    selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(80.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(2.dp, if (selected) SKY else Color(0xFF334155)),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (selected) SKY.copy(alpha = 0.1f) else Color.Transparent,
            contentColor   = if (selected) SKY else MUTED,
        ),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(icon, fontSize = 22.sp)
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(desc,  fontSize = 11.sp,
                color = if (selected) SKY.copy(alpha = 0.7f) else Color(0xFF475569))
        }
    }
}

@Composable
private fun textFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor      = SKY,
    unfocusedBorderColor    = Color(0xFF334155),
    focusedTextColor        = TEXT,
    unfocusedTextColor      = TEXT,
    cursorColor             = SKY,
    focusedContainerColor   = INPUT,
    unfocusedContainerColor = INPUT,
)
