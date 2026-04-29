package com.cfitv.tv.ws

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ============================================================
// Messages WebSocket — miroir du schéma TypeScript partagé
// ============================================================

// ---- Serveur → Client ----

@Serializable
sealed class ServerMessage {

    @Serializable @SerialName("WELCOME")
    data class Welcome(
        val clientId: String,
        val serverTime: Long,
    ) : ServerMessage()

    @Serializable @SerialName("CLOCK_PONG")
    data class ClockPong(
        val clientT0: Long,
        val serverT1: Long,
        val serverT2: Long,
    ) : ServerMessage()

    @Serializable @SerialName("HEARTBEAT_ACK")
    data class HeartbeatAck(val serverTime: Long) : ServerMessage()

    @Serializable @SerialName("SESSION_UPDATE")
    data class SessionUpdate(val payload: SessionPayload?) : ServerMessage()

    @Serializable @SerialName("SESSION_ENDED")
    data class SessionEnded(val reason: String) : ServerMessage()

    @Serializable @SerialName("ERROR")
    data class Error(val code: String, val message: String) : ServerMessage()

    // Autres types ignorés (CLIENT_LIST, DISPLAY_STATE, etc.)
    @Serializable @SerialName("CLIENT_LIST")
    object ClientList : ServerMessage()

    @Serializable @SerialName("DISPLAY_STATE")
    object DisplayState : ServerMessage()

    @Serializable @SerialName("CIRCUIT_STATE")
    object CircuitState : ServerMessage()

    @Serializable @SerialName("DRIFT_DATA")
    object DriftData : ServerMessage()
}

@Serializable
data class SessionPayload(
    val id: String,
    val status: String,           // "RUNNING" | "PAUSED"
    val circuitId: String,
    val currentPhaseIdx: Int,
    val totalPhases: Int,
    val round: Int,
    val totalRounds: Int,
    val stationIdx: Int,
    val phase: PhaseInfo,
    val phaseStartsAt: Long,
    val phaseEndsAt: Long,
    val pausedAt: Long?,
    val remainingOnPauseMs: Long?,
    val hydrationBreakEndsAt: Long? = null,
)

// ---- Types REST circuit ----

@Serializable
data class LayoutLink(
    val from: String,
    val to: String,
)

@Serializable
data class CircuitResponse(
    val id: String,
    val name: String,
    val workSec: Int,
    val restSec: Int,
    val transitionSec: Int,
    val stations: List<StationResponse>,
    val layoutLinks: List<LayoutLink>? = null,
)

@Serializable
data class StationResponse(
    val id: String,
    val position: Int,
    val exercises: List<StationExerciseEntry>,
    val stationMode: String = "TIME",
    val sets: Int? = null,
    val reps: Int? = null,
    val layoutX: Float? = null,
    val layoutY: Float? = null,
)

@Serializable
data class StationExerciseEntry(
    val exercise: ExerciseData,
)

@Serializable
data class ExerciseData(
    val id: String,
    val name: String,
    val description: String? = null,
    val muscleGroups: List<String> = emptyList(),
    val equipment: List<String> = emptyList(),
)

@Serializable
data class PhaseInfo(
    val type: String,             // "WORK" | "REST" | "TRANSITION"
    val label: String,
    val durationMs: Long,
    val setNumber:  Int?     = null,
    val totalSets:  Int?     = null,
    val reps:       Int?     = null,
    val isRepsMode: Boolean? = null,
)

// ---- Serveur → Client (suite) ----

@Serializable @SerialName("PAIR_CONFIG")
data class PairConfig(
    val label: String,
    val stationNumber: Int,
    val screenType: String,       // "STATION" | "DASHBOARD"
    val isLandscape: Boolean,
    val primaryColor: String? = null,
    val logoUrl: String? = null,
) : ServerMessage()

// ---- Calendrier TV ----

@Serializable
data class ScheduleDay(
    val date:      String,
    val label:     String,
    val dayOfWeek: Int,
    val classes:   List<ScheduleClass>,
)

@Serializable
data class ScheduleClass(
    val scheduleId: String,
    val circuitId:  String,
    val name:       String,
    val icon:       String? = null,
    val timeHour:   Int,
    val timeMinute: String,  // "09:30"
)

// ---- Client → Serveur ----

@Serializable
sealed class ClientMessage {

    @Serializable @SerialName("REGISTER")
    data class Register(
        val role: String,
        val label: String,
        val displayId: String? = null,
    ) : ClientMessage()

    @Serializable @SerialName("CLOCK_PING")
    data class ClockPing(val clientT0: Long) : ClientMessage()

    @Serializable @SerialName("HEARTBEAT")
    data class Heartbeat(val t: Long) : ClientMessage()

    @Serializable @SerialName("PAIR_REGISTER")
    data class PairRegister(
        val pin: String,
        val deviceModel: String? = null,
        val deviceOs: String? = null,
        val appVersion: String? = null,
    ) : ClientMessage()
}
