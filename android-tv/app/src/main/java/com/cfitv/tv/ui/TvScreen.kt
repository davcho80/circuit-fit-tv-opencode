package com.cfitv.tv.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cfitv.tv.ws.ExerciseData
import com.cfitv.tv.ws.ScheduleDay
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlin.math.ceil

// ============================================================
// Écran d'affichage TV — grille d'exercices + timer
// Portrait ou Paysage, 1–8 exercices par station
// ============================================================

private data class PhaseCfg(
    val bg: Color,
    val dim: Color,
    val accent: Color,
    val label: String,
)

private val PHASE_MAP = mapOf(
    "WORK"       to PhaseCfg(Color(0xFF059669), Color(0xFF065F46), Color(0xFF34D399), "TRAVAIL"),
    "REST"       to PhaseCfg(Color(0xFF0369A1), Color(0xFF075985), Color(0xFF7DD3FC), "REPOS"),
    "TRANSITION" to PhaseCfg(Color(0xFFD97706), Color(0xFF92400E), Color(0xFFFCD34D), "TRANSITION"),
    "HYDRATION"  to PhaseCfg(Color(0xFF0891B2), Color(0xFF164E63), Color(0xFF67E8F9), "PAUSE EAU"),
    "WAIT"       to PhaseCfg(Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF475569), "ATTENTE"),
)

// Nombre de colonnes selon exercices + orientation
private fun numCols(n: Int, landscape: Boolean): Int = when {
    !landscape -> if (n <= 2) 1 else 2
    n == 1     -> 1
    n <= 2     -> 2
    n == 3     -> 3
    n <= 4     -> 2
    n <= 6     -> 3
    else       -> 4
}

// Taille de police nom exercice
private fun nameFontSizeSp(n: Int): Float = when {
    n == 1  -> 52f
    n <= 2  -> 40f
    n <= 4  -> 30f
    n <= 6  -> 24f
    else    -> 20f
}

// Format secondes → m:ss ou juste ss
private fun fmtSec(s: Int): String =
    if (s >= 60) "${s / 60}:${(s % 60).toString().padStart(2, '0')}" else s.toString()

// ============================================================

@Composable
fun TvScreen(uiState: TvViewModel.UiState, onDisconnect: () -> Unit) {

    if (uiState.screenType == TvViewModel.ScreenType.DASHBOARD) {
        DashboardScreen(uiState = uiState, onDisconnect = onDisconnect)
        return
    }
    if (uiState.screenType == TvViewModel.ScreenType.SCHEDULE) {
        ScheduleScreen(uiState = uiState, onDisconnect = onDisconnect)
        return
    }

    val session      = uiState.session
    val exercises    = uiState.myExercises
    val isMyWork     = uiState.isMyWork
    val isLandscape  = uiState.isLandscape
    val stationNum   = uiState.stationNumber

    // Détermination de la phase visuelle
    val phaseKey = session?.phase?.type ?: "WAIT"
    val cfg = PHASE_MAP[phaseKey] ?: PHASE_MAP["WAIT"]!!

    val animBg  by animateColorAsState(cfg.bg,  tween(600), label = "bg")
    val animDim by animateColorAsState(cfg.dim, tween(600), label = "dim")
    val animAcc by animateColorAsState(cfg.accent, tween(600), label = "acc")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(animBg),
    ) {

        // ── Header ─────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp, vertical = 20.dp)
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Bouton label → déconnecter
            androidx.compose.material3.TextButton(onClick = onDisconnect) {
                Text(
                    text = uiState.label,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White.copy(alpha = 0.65f),
                )
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (session != null) {
                    Text(
                        text = cfg.label,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 3.sp,
                        color = animAcc.copy(alpha = 0.85f),
                    )
                    Text("·", fontSize = 14.sp, color = Color.White.copy(alpha = 0.2f))
                    Text(
                        text = "R ${session.round}/${session.totalRounds}",
                        fontSize = 14.sp,
                        color = Color.White.copy(alpha = 0.55f),
                    )
                    Text("·", fontSize = 14.sp, color = Color.White.copy(alpha = 0.2f))
                }
                ConnectionDot(connected = uiState.connected, accent = animAcc)
            }
        }

        // ── Contenu principal ────────────────────────────────────
        val contentPadding = PaddingValues(
            start = 24.dp, end = 24.dp, top = 72.dp, bottom = 20.dp
        )

        if (session == null) {
            // Pas de session
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(contentPadding),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.alpha(0.25f),
                ) {
                    Text(
                        text = "STATION $stationNum",
                        fontSize = 48.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 4.sp,
                        color = Color.White,
                    )
                    Text(
                        text = "En attente d'une session…",
                        fontSize = 22.sp,
                        color = Color.White,
                    )
                }
            }

        } else {
            // Session active — afficher les exercices + timer
            if (isLandscape) {
                LandscapeLayout(
                    uiState   = uiState,
                    exercises = exercises,
                    cfg       = cfg,
                    animBg    = animBg,
                    animAcc   = animAcc,
                    padding   = contentPadding,
                )
            } else {
                PortraitLayout(
                    uiState   = uiState,
                    exercises = exercises,
                    cfg       = cfg,
                    animBg    = animBg,
                    animAcc   = animAcc,
                    padding   = contentPadding,
                )
            }
        }

        // ── Barre de progression (bas) ───────────────────────────
        if (session != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp)
                    .align(Alignment.BottomCenter),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(5.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(animDim)
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth(uiState.progressFrac)
                        .height(5.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(animAcc.copy(alpha = 0.8f))
                )
            }
        }

        // ── Pause eau overlay (phase HYDRATION ou pause manuelle) ─
        val hydrationSec = when {
            uiState.session?.phase?.type == "HYDRATION" -> uiState.remainingSec
            uiState.hydrationRemainingSec > 0           -> uiState.hydrationRemainingSec
            else                                        -> 0
        }
        if (hydrationSec > 0) {
            HydrationBreakOverlay(remainingSec = hydrationSec)
        }

        // ── Overlay fin de session ───────────────────────────────
        uiState.sessionEndedReason?.let { reason ->
            SessionEndedOverlay(reason = reason)
        }
    }
}

// ── Layout Paysage : timer à gauche | exercices à droite ────

@Composable
private fun LandscapeLayout(
    uiState: TvViewModel.UiState,
    exercises: List<ExerciseData>,
    cfg: PhaseCfg,
    animBg: Color,
    animAcc: Color,
    padding: PaddingValues,
) {
    Row(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Timer colonne gauche
        Column(
            modifier = Modifier
                .width(200.dp)
                .fillMaxHeight(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            val phase = uiState.session?.phase
            val isRepsWork = phase?.isRepsMode == true && phase.type == "WORK"

            Text(
                text = cfg.label,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 3.sp,
                color = animAcc.copy(alpha = 0.6f),
            )
            Spacer(Modifier.height(8.dp))

            if (isRepsWork && phase != null) {
                // Mode REPS — afficher Set X/Y
                Text(
                    text = "Set ${phase.setNumber}/${phase.totalSets}",
                    fontSize = 52.sp,
                    fontWeight = FontWeight.Black,
                    color = animAcc,
                    lineHeight = 1.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "${phase.reps} reps",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.75f),
                    textAlign = TextAlign.Center,
                )
            } else {
                // Mode TIME ou REST — minuterie normale
                Text(
                    text = fmtSec(uiState.remainingSec),
                    fontSize = if (uiState.remainingSec >= 60) 70.sp else 100.sp,
                    fontWeight = FontWeight.Black,
                    color = animAcc,
                    lineHeight = 1.sp,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = if (uiState.remainingSec >= 60) "" else "sec",
                    fontSize = 16.sp,
                    letterSpacing = 4.sp,
                    color = Color.White.copy(alpha = 0.35f),
                )
            }
            if (uiState.session?.status == "PAUSED") {
                Spacer(Modifier.height(12.dp))
                Text(
                    text = "⏸ PAUSE",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.6f),
                )
            }
        }

        // Séparateur vertical
        Box(
            modifier = Modifier
                .width(1.dp)
                .fillMaxHeight()
                .background(Color.White.copy(alpha = 0.1f))
        )

        // Grille exercices
        ExerciseGrid(
            exercises   = exercises,
            isLandscape = true,
            animAcc     = animAcc,
            modifier    = Modifier.weight(1f).fillMaxHeight(),
        )
    }
}

// ── Layout Portrait : timer en haut | exercices en dessous ──

@Composable
private fun PortraitLayout(
    uiState: TvViewModel.UiState,
    exercises: List<ExerciseData>,
    cfg: PhaseCfg,
    animBg: Color,
    animAcc: Color,
    padding: PaddingValues,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Timer compact en haut
        val phaseP = uiState.session?.phase
        val isRepsWorkP = phaseP?.isRepsMode == true && phaseP.type == "WORK"
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = cfg.label,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 4.sp,
                color = animAcc.copy(alpha = 0.7f),
            )
            Spacer(Modifier.width(24.dp))
            if (isRepsWorkP && phaseP != null) {
                Text(
                    text = "Set ${phaseP.setNumber}/${phaseP.totalSets}",
                    fontSize = 44.sp,
                    fontWeight = FontWeight.Black,
                    color = animAcc,
                    lineHeight = 1.sp,
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "${phaseP.reps} reps",
                    fontSize = 22.sp,
                    color = Color.White.copy(alpha = 0.7f),
                )
            } else {
                Text(
                    text = fmtSec(uiState.remainingSec),
                    fontSize = 56.sp,
                    fontWeight = FontWeight.Black,
                    color = animAcc,
                    lineHeight = 1.sp,
                )
            }
            if (uiState.session?.status == "PAUSED") {
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "⏸",
                    fontSize = 28.sp,
                    color = Color.White.copy(alpha = 0.6f),
                )
            }
        }

        // Séparateur
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Color.White.copy(alpha = 0.1f))
        )

        // Grille exercices
        ExerciseGrid(
            exercises   = exercises,
            isLandscape = false,
            animAcc     = animAcc,
            modifier    = Modifier.weight(1f).fillMaxWidth(),
        )
    }
}

// ── Grille d'exercices ───────────────────────────────────────

@Composable
private fun ExerciseGrid(
    exercises: List<ExerciseData>,
    isLandscape: Boolean,
    animAcc: Color,
    modifier: Modifier = Modifier,
) {
    if (exercises.isEmpty()) {
        Box(modifier = modifier, contentAlignment = Alignment.Center) {
            Text(
                text = "Chargement…",
                fontSize = 22.sp,
                color = Color.White.copy(alpha = 0.3f),
            )
        }
        return
    }

    val cols = numCols(exercises.size, isLandscape)
    val rows = ceil(exercises.size.toDouble() / cols).toInt()
    val fontSize = nameFontSizeSp(exercises.size)

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        repeat(rows) { row ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val start = row * cols
                val end   = minOf(start + cols, exercises.size)

                for (idx in start until end) {
                    ExerciseCard(
                        exercise  = exercises[idx],
                        accent    = animAcc,
                        fontSizeSp = fontSize,
                        showMuscles = exercises.size <= 4,
                        modifier  = Modifier.weight(1f).fillMaxHeight(),
                    )
                }

                // Cases vides pour aligner la dernière rangée
                repeat(cols - (end - start)) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

// ── Carte d'exercice ─────────────────────────────────────────

@Composable
private fun ExerciseCard(
    exercise: ExerciseData,
    accent: Color,
    fontSizeSp: Float,
    showMuscles: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.Black.copy(alpha = 0.25f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(16.dp),
        ) {
            Text(
                text = exercise.name,
                fontSize = fontSizeSp.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                textAlign = TextAlign.Center,
                lineHeight = (fontSizeSp * 1.15f).sp,
                overflow = TextOverflow.Ellipsis,
                maxLines = 3,
            )

            if (showMuscles && !exercise.description.isNullOrBlank()) {
                Text(
                    text = exercise.description,
                    fontSize = 13.sp,
                    color = Color.White.copy(alpha = 0.55f),
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            } else if (showMuscles && exercise.muscleGroups.isNotEmpty()) {
                Text(
                    text = exercise.muscleGroups.joinToString(" · "),
                    fontSize = 13.sp,
                    color = accent.copy(alpha = 0.75f),
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

// ── Dashboard (vue d'ensemble) ───────────────────────────────

@Composable
private fun DashboardScreen(uiState: TvViewModel.UiState, onDisconnect: () -> Unit) {
    val session   = uiState.session
    val circuit   = uiState.circuit
    val phaseKey  = session?.phase?.type ?: "WAIT"
    val cfg       = PHASE_MAP[phaseKey] ?: PHASE_MAP["WAIT"]!!

    val animBg  by animateColorAsState(cfg.bg,     tween(600), label = "dbBg")
    val animAcc by animateColorAsState(cfg.accent, tween(600), label = "dbAcc")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(animBg),
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp, vertical = 20.dp)
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            androidx.compose.material3.TextButton(onClick = onDisconnect) {
                Text(
                    text = uiState.label,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White.copy(alpha = 0.65f),
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (session != null) {
                    Text(
                        text = "R ${session.round}/${session.totalRounds}",
                        fontSize = 14.sp,
                        color = Color.White.copy(alpha = 0.55f),
                    )
                    Text("·", fontSize = 14.sp, color = Color.White.copy(alpha = 0.2f))
                }
                ConnectionDot(connected = uiState.connected, accent = animAcc)
            }
        }

        // Contenu : timer à gauche + grille stations à droite
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 32.dp, end = 32.dp, top = 72.dp, bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            // Panneau gauche — phase + timer
            Column(
                modifier = Modifier
                    .width(220.dp)
                    .fillMaxHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                if (session != null) {
                    Text(
                        text = cfg.label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 3.sp,
                        color = animAcc.copy(alpha = 0.6f),
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = fmtSec(uiState.remainingSec),
                        fontSize = if (uiState.remainingSec >= 60) 72.sp else 96.sp,
                        fontWeight = FontWeight.Black,
                        color = animAcc,
                        lineHeight = 1.sp,
                    )
                    Spacer(Modifier.height(4.dp))
                    if (uiState.remainingSec < 60) {
                        Text(
                            text = "sec",
                            fontSize = 16.sp,
                            letterSpacing = 4.sp,
                            color = Color.White.copy(alpha = 0.35f),
                        )
                    }
                    if (session.status == "PAUSED") {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = "⏸ PAUSE",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White.copy(alpha = 0.6f),
                        )
                    }
                    Spacer(Modifier.height(24.dp))
                    // Rounds
                    Text(
                        text = "ROUND ${session.round} / ${session.totalRounds}",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp,
                        color = Color.White.copy(alpha = 0.45f),
                    )
                } else {
                    Text(
                        text = "En attente…",
                        fontSize = 22.sp,
                        color = Color.White.copy(alpha = 0.25f),
                    )
                }
            }

            // Séparateur
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .fillMaxHeight()
                    .background(Color.White.copy(alpha = 0.1f))
            )

            // Panneau droit — grille des stations
            val totalStations  = circuit?.stations?.size ?: session?.totalPhases?.let { it / 2 } ?: 0
            val allActive      = session?.phase?.type == "WORK"
            val isTransition   = session?.phase?.type == "TRANSITION"

            if (totalStations > 0) {
                val cols = when {
                    totalStations <= 4  -> 2
                    totalStations <= 6  -> 3
                    totalStations <= 9  -> 3
                    else                -> 4
                }
                val rows = ceil(totalStations.toDouble() / cols).toInt()

                Column(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    repeat(rows) { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth().weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            val start = row * cols
                            val end   = minOf(start + cols, totalStations)
                            for (idx in start until end) {
                                // Toutes les stations sont actives pendant WORK
                                // Pendant TRANSITION, toutes légèrement surlignées (ambre/dim)
                                val cardActive = allActive || isTransition
                                val cardAlpha  = when {
                                    allActive    -> 0.25f
                                    isTransition -> 0.15f
                                    else         -> 0.0f
                                }
                                val textAlpha  = when {
                                    allActive    -> 1.0f
                                    isTransition -> 0.65f
                                    else         -> 0.4f
                                }
                                val stationExercises = circuit?.stations
                                    ?.sortedBy { it.position }
                                    ?.getOrNull(idx)
                                    ?.exercises
                                    ?.map { it.exercise }
                                    ?: emptyList()

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxHeight()
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(
                                            if (cardActive) animAcc.copy(alpha = cardAlpha)
                                            else Color.Black.copy(alpha = 0.2f)
                                        ),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(4.dp),
                                        modifier = Modifier.padding(10.dp),
                                    ) {
                                        Text(
                                            text = "${idx + 1}",
                                            fontSize = if (totalStations <= 4) 36.sp else 24.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (cardActive) animAcc else Color.White.copy(alpha = 0.4f),
                                        )
                                        if (stationExercises.isNotEmpty()) {
                                            Text(
                                                text = stationExercises.first().name,
                                                fontSize = 11.sp,
                                                color = Color.White.copy(alpha = textAlpha),
                                                textAlign = TextAlign.Center,
                                                maxLines = 2,
                                                overflow = TextOverflow.Ellipsis,
                                            )
                                        }
                                    }
                                }
                            }
                            // Cases vides
                            repeat(cols - (end - start)) {
                                Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            } else {
                Box(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "En attente d'une session…",
                        fontSize = 22.sp,
                        color = Color.White.copy(alpha = 0.25f),
                    )
                }
            }
        }

        // Barre de progression
        if (session != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 12.dp)
                    .align(Alignment.BottomCenter),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color.Black.copy(alpha = 0.3f))
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth(uiState.progressFrac)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(animAcc.copy(alpha = 0.7f))
                )
            }
        }

        // ── Pause eau overlay (phase HYDRATION ou pause manuelle) ─
        val hydrationSec = when {
            uiState.session?.phase?.type == "HYDRATION" -> uiState.remainingSec
            uiState.hydrationRemainingSec > 0           -> uiState.hydrationRemainingSec
            else                                        -> 0
        }
        if (hydrationSec > 0) {
            HydrationBreakOverlay(remainingSec = hydrationSec)
        }

        // ── Overlay fin de session ───────────────────────────────
        uiState.sessionEndedReason?.let { reason ->
            SessionEndedOverlay(reason = reason)
        }
    }
}

// ── Calendrier TV ────────────────────────────────────────────

@Composable
private fun ScheduleScreen(uiState: TvViewModel.UiState, onDisconnect: () -> Unit) {
    val days     = uiState.scheduleDays
    val primary  = remember(uiState.primaryColor) {
        try { Color(android.graphics.Color.parseColor(uiState.primaryColor)) }
        catch (_: Exception) { Color(0xFF0EA5E9) }
    }

    // Horloge locale
    var now by remember { mutableStateOf(LocalTime.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(1_000)
            now = LocalTime.now()
        }
    }
    val todayStr = LocalDate.now().toString() // YYYY-MM-DD

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617)),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {

            // ── Header ──────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF0F172A))
                    .padding(horizontal = 32.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    androidx.compose.material3.TextButton(onClick = onDisconnect) {
                        Text(
                            text = uiState.label,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White.copy(alpha = 0.55f),
                        )
                    }
                    Text(
                        text = "CALENDRIER DE LA SEMAINE",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 3.sp,
                        color = primary.copy(alpha = 0.7f),
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = now.format(DateTimeFormatter.ofPattern("HH:mm")),
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Black,
                        color = primary,
                    )
                    ConnectionDot(connected = uiState.connected, accent = primary)
                }
            }

            // ── Grille 7 jours ──────────────────────────────────
            if (days.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Chargement du calendrier…",
                        fontSize = 20.sp,
                        color = Color.White.copy(alpha = 0.25f),
                    )
                }
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    days.forEach { day ->
                        val isToday = day.date == todayStr
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(16.dp))
                                .background(
                                    if (isToday) primary.copy(alpha = 0.10f)
                                    else Color(0xFF0F172A)
                                )
                                .then(
                                    if (isToday) Modifier.border(primary)
                                    else Modifier
                                ),
                        ) {
                            // En-tête du jour
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        if (isToday) primary.copy(alpha = 0.15f)
                                        else Color(0xFF1E293B).copy(alpha = 0.5f)
                                    )
                                    .padding(horizontal = 10.dp, vertical = 8.dp),
                            ) {
                                Text(
                                    text = dayName(day.dayOfWeek).uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 2.sp,
                                    color = if (isToday) primary else Color(0xFF94A3B8),
                                )
                                Text(
                                    text = dayNumber(day.date),
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isToday) Color.White else Color(0xFF64748B),
                                    lineHeight = 24.sp,
                                )
                                if (isToday) {
                                    Text(
                                        text = "AUJOURD'HUI",
                                        fontSize = 7.sp,
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = 1.sp,
                                        color = primary,
                                    )
                                }
                            }

                            // Liste des cours
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f)
                                    .padding(6.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                if (day.classes.isEmpty()) {
                                    Box(
                                        modifier = Modifier.fillMaxSize(),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text("—", fontSize = 14.sp, color = Color(0xFF334155))
                                    }
                                } else {
                                    day.classes.forEach { cls ->
                                        val upcoming = isUpcoming(cls, day.date, todayStr, now)
                                        val past     = isPastClass(cls, day.date, todayStr, now)
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(10.dp))
                                                .background(
                                                    when {
                                                        upcoming -> primary.copy(alpha = 0.20f)
                                                        past     -> Color(0xFF1E293B).copy(alpha = 0.3f)
                                                        isToday  -> Color(0xFF1E293B).copy(alpha = 0.7f)
                                                        else     -> Color(0xFF1E293B).copy(alpha = 0.4f)
                                                    }
                                                )
                                                .padding(horizontal = 8.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        ) {
                                            Text(
                                                text = cls.icon ?: "🏋️",
                                                fontSize = 14.sp,
                                            )
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = cls.name,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (past) Color(0xFF475569) else Color.White,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis,
                                                )
                                                Text(
                                                    text = cls.timeMinute,
                                                    fontSize = 9.sp,
                                                    color = if (upcoming) primary else Color(0xFF64748B),
                                                    fontWeight = FontWeight.Medium,
                                                )
                                            }
                                            if (upcoming) {
                                                Text(
                                                    text = "▶",
                                                    fontSize = 8.sp,
                                                    color = primary,
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun Modifier.border(color: Color): Modifier =
    this.then(Modifier.padding(1.dp).clip(RoundedCornerShape(16.dp)))

private fun dayName(isoDay: Int): String = when (isoDay) {
    1 -> "Lun"; 2 -> "Mar"; 3 -> "Mer"; 4 -> "Jeu"
    5 -> "Ven"; 6 -> "Sam"; 7 -> "Dim"; else -> ""
}

private fun dayNumber(dateStr: String): String =
    try { LocalDate.parse(dateStr).dayOfMonth.toString() } catch (_: Exception) { "" }

private fun isUpcoming(
    cls: com.cfitv.tv.ws.ScheduleClass,
    dateStr: String, todayStr: String, now: LocalTime,
): Boolean {
    if (dateStr != todayStr) return false
    val parts = cls.timeMinute.split(":")
    val h = parts.getOrNull(0)?.toIntOrNull() ?: return false
    val m = parts.getOrNull(1)?.toIntOrNull() ?: return false
    val classMin = h * 60 + m
    val nowMin   = now.hour * 60 + now.minute
    return classMin in nowMin..(nowMin + 90)
}

private fun isPastClass(
    cls: com.cfitv.tv.ws.ScheduleClass,
    dateStr: String, todayStr: String, now: LocalTime,
): Boolean {
    if (dateStr != todayStr) return false
    val parts = cls.timeMinute.split(":")
    val h = parts.getOrNull(0)?.toIntOrNull() ?: return false
    val m = parts.getOrNull(1)?.toIntOrNull() ?: return false
    val classMin = h * 60 + m
    val nowMin   = now.hour * 60 + now.minute
    return classMin < nowMin - 5
}

// ── Pause eau overlay ────────────────────────────────────────

@Composable
fun HydrationBreakOverlay(remainingSec: Int) {
    val infiniteTransition = rememberInfiniteTransition(label = "float")
    val offsetY by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue  = -20f,
        animationSpec = infiniteRepeatable(
            animation  = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "bottleY",
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xEB0F172A)), // quasi-opaque
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            WaterBottleIcon(
                modifier = Modifier
                    .size(160.dp)
                    .offset(y = offsetY.dp),
                tint = Color(0xFF67E8F9),
            )
            Text(
                text = "PAUSE EAU",
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 8.sp,
                color = Color(0xFF67E8F9),
            )
            Text(
                text = remainingSec.toString(),
                fontSize = 120.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF67E8F9),
                lineHeight = 1.sp,
            )
            Text(
                text = "secondes",
                fontSize = 16.sp,
                letterSpacing = 5.sp,
                color = Color(0xFF22D3EE).copy(alpha = 0.5f),
            )
        }
    }
}

@Composable
private fun WaterBottleIcon(modifier: Modifier, tint: Color) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val stroke = Stroke(width = 5.dp.toPx(), cap = StrokeCap.Round)

        val capW   = w * 0.30f
        val capH   = h * 0.07f
        val neckW  = w * 0.38f
        val neckH  = h * 0.10f
        val bodyW  = w * 0.68f
        val bodyH  = h * 0.72f
        val r      = 14.dp.toPx()

        val bodyTop  = h - bodyH
        val neckTop  = bodyTop - neckH
        val capTop   = neckTop - capH - 2.dp.toPx()

        // Cap
        drawRoundRect(
            color = tint,
            topLeft = Offset((w - capW) / 2, capTop),
            size = Size(capW, capH),
            cornerRadius = CornerRadius(4.dp.toPx()),
        )

        // Neck trapezoid
        val neckPath = Path().apply {
            moveTo((w - neckW) / 2, neckTop)
            lineTo((w + neckW) / 2, neckTop)
            lineTo((w + bodyW) / 2, bodyTop)
            lineTo((w - bodyW) / 2, bodyTop)
            close()
        }
        drawPath(neckPath, color = tint.copy(alpha = 0.75f))

        // Body outline
        val bodyRect = RoundRect(
            left   = (w - bodyW) / 2,
            top    = bodyTop,
            right  = (w + bodyW) / 2,
            bottom = h,
            cornerRadius = CornerRadius(r),
        )
        val bodyPath = Path().apply { addRoundRect(bodyRect) }
        drawPath(bodyPath, color = tint, style = stroke)

        // Water fill
        val fillTop = bodyTop + bodyH * 0.45f
        val fillPath = Path().apply {
            addRect(Rect(
                left   = (w - bodyW) / 2,
                top    = fillTop,
                right  = (w + bodyW) / 2,
                bottom = h,
            ))
        }
        clipPath(bodyPath) {
            drawPath(fillPath, color = tint.copy(alpha = 0.30f))
        }

        // Shine
        drawRoundRect(
            color = Color.White.copy(alpha = 0.18f),
            topLeft = Offset((w - bodyW) / 2 + 8.dp.toPx(), bodyTop + 10.dp.toPx()),
            size = Size(8.dp.toPx(), 24.dp.toPx()),
            cornerRadius = CornerRadius(4.dp.toPx()),
        )
    }
}

// ── Overlay fin de session ───────────────────────────────────

@Composable
fun SessionEndedOverlay(reason: String) {
    val isCompleted = reason == "completed"
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xF00F172A)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier.padding(48.dp),
        ) {
            Text(
                text = if (isCompleted) "🎉" else "⏹",
                fontSize = 80.sp,
            )
            Text(
                text = if (isCompleted) "SESSION TERMINÉE !" else "SESSION ARRÊTÉE",
                fontSize = 36.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 4.sp,
                color = if (isCompleted) Color(0xFF34D399) else Color(0xFF94A3B8),
                textAlign = TextAlign.Center,
            )
            if (isCompleted) {
                Text(
                    text = "Bravo ! Tous les rounds ont été complétés.",
                    fontSize = 18.sp,
                    color = Color.White.copy(alpha = 0.5f),
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

// ── Indicateur de connexion ──────────────────────────────────

@Composable
private fun ConnectionDot(connected: Boolean, accent: Color) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.35f,
        targetValue  = 1f,
        animationSpec = infiniteRepeatable(
            animation  = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "dotAlpha",
    )
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(9.dp)
                .background(
                    color = if (connected) accent.copy(alpha = alpha) else Color(0xFFEF4444),
                    shape = CircleShape,
                )
        )
        Text(
            text = if (connected) "LIVE" else "Reconnexion…",
            fontSize = 14.sp,
            color = Color.White.copy(alpha = 0.55f),
        )
    }
}
