package com.cfitv.tv.ui

import android.app.Application
import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cfitv.tv.ws.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.ceil
import kotlin.math.max

// ============================================================
// TvViewModel — connexion WS + fetch circuit REST + état UI
// Utilise AndroidViewModel pour accéder aux SharedPreferences
// ============================================================

class TvViewModel(app: Application) : AndroidViewModel(app) {

    // ---- Enums ----

    enum class ScreenType { STATION, DASHBOARD }

    // ---- État UI ----

    data class UiState(
        val screen: Screen            = Screen.SETUP,
        val isDiscovering: Boolean    = false,        // true = scan mDNS en cours
        val isPairing: Boolean        = false,        // true = mode appairage (QR affiché)
        val pairingPin: String        = "",
        val screenType: ScreenType    = ScreenType.STATION,
        val serverUrl: String         = "ws://192.168.1.1:3000/ws",
        val label: String             = "Station 1",
        val stationNumber: Int        = 1,
        val isLandscape: Boolean      = true,
        val connected: Boolean        = false,
        val primaryColor: String      = "#0ea5e9",
        val logoUrl: String?          = null,
        val session: SessionPayload?  = null,
        val circuit: CircuitResponse? = null,
        val isMyWork: Boolean         = false,
        val myExercises: List<ExerciseData> = emptyList(),
        val remainingSec: Int         = 0,
        val progressFrac: Float       = 0f,
        val hydrationRemainingSec: Int = 0,
        val sessionEndedReason: String? = null,  // "completed" | "stopped" | null
    ) {
        enum class Screen { SETUP, DISPLAY }

        /** URL encodée dans le QR code → ouvre la page de config dans la console admin */
        val pairingUrl: String get() {
            val httpBase = serverUrl
                .replace(Regex("^ws://"),  "http://")
                .replace(Regex("^wss://"), "https://")
                .removeSuffix("/ws")
            return "$httpBase/admin?tab=screens&pin=$pairingPin"
        }
    }

    // ---- SharedPreferences ----

    private val prefs = app.getSharedPreferences("cfitv_config", Context.MODE_PRIVATE)

    private fun loadSavedConfig(): UiState {
        val url    = prefs.getString("serverUrl", null)
        val label  = prefs.getString("label", null)
        val station = prefs.getInt("stationNumber", 0)
        val land   = prefs.getBoolean("isLandscape", true)
        val type   = prefs.getString("screenType", null)

        // URL sauvegardée pour pré-remplir le champ même sans config complète
        val savedUrl = url ?: "ws://192.168.1.1:3000/ws"

        if (url != null && label != null && station > 0 && type != null) {
            val screenType   = try { ScreenType.valueOf(type) } catch (_: Exception) { ScreenType.STATION }
            val primaryColor = prefs.getString("primaryColor", "#0ea5e9") ?: "#0ea5e9"
            val logoUrl      = prefs.getString("logoUrl", null)
            return UiState(
                screen        = UiState.Screen.DISPLAY,
                screenType    = screenType,
                serverUrl     = url,
                label         = label,
                stationNumber = station,
                isLandscape   = land,
                primaryColor  = primaryColor,
                logoUrl       = logoUrl,
            )
        }
        return UiState(serverUrl = savedUrl)
    }

    private fun saveConfig(s: UiState) {
        prefs.edit()
            .putString("serverUrl", s.serverUrl)
            .putString("label", s.label)
            .putInt("stationNumber", s.stationNumber)
            .putBoolean("isLandscape", s.isLandscape)
            .putString("screenType", s.screenType.name)
            .putString("primaryColor", s.primaryColor)
            .putString("logoUrl", s.logoUrl)
            .apply()
    }

    private fun clearConfig() {
        prefs.edit()
            .remove("label").remove("stationNumber")
            .remove("isLandscape").remove("screenType")
            .apply()
        // On garde serverUrl pour pré-remplir la prochaine fois
    }

    // ---- État ----

    private val _ui = MutableStateFlow(loadSavedConfig())
    val uiState: StateFlow<UiState> = _ui.asStateFlow()

    // ---- Clients HTTP ----

    private val httpClient = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }

    // ---- mDNS ----

    private val nsdManager: NsdManager by lazy {
        getApplication<Application>().getSystemService(Context.NSD_SERVICE) as NsdManager
    }
    private var nsdDiscoveryListener: NsdManager.DiscoveryListener? = null
    private val discoveryActive = AtomicBoolean(false)
    private val resolveInProgress = AtomicBoolean(false)

    // ---- Internes ----

    private var wsClient: WsClient? = null
    private var clockOffset: Long   = 0L
    private var lastFetchedCircuitId = ""

    private var reconnectJob: Job?  = null
    private var heartbeatJob: Job?  = null
    private var clockJob: Job?      = null
    private var timerJob: Job?      = null

    // ---- Auto-connexion si config complète ----

    init {
        val s = _ui.value
        if (s.screen == UiState.Screen.DISPLAY) {
            // Config complète sauvegardée → connexion directe, sans interaction
            createAndConnect(s.serverUrl, s.label)
            startTimerTick()
        } else {
            // Pas de config → tentative de découverte mDNS automatique
            startMdnsDiscovery()
        }
    }

    // ---- Actions Setup ----

    fun updateServerUrl(v: String)      = _ui.update { it.copy(serverUrl = v) }.also {
        prefs.edit().putString("serverUrl", _ui.value.serverUrl).apply()
    }
    fun updateLabel(v: String)          = _ui.update { it.copy(label = v) }
    fun updateStationNumber(v: Int)     = _ui.update { it.copy(stationNumber = v.coerceIn(1, 20)) }
    fun updateIsLandscape(v: Boolean)   = _ui.update { it.copy(isLandscape = v) }
    fun updateScreenType(v: ScreenType) = _ui.update { it.copy(screenType = v) }

    /** Mode manuel : connexion avec la config du formulaire */
    fun connect() {
        val s = _ui.value
        saveConfig(s)
        _ui.update { it.copy(screen = UiState.Screen.DISPLAY, isPairing = false) }
        createAndConnect(s.serverUrl, s.label)
        startTimerTick()
    }

    /** Mode appairage : connexion et affichage du PIN */
    fun startPairing() {
        val pin = (1000..9999).random().toString()
        val s   = _ui.value
        // Sauvegarder au moins l'URL
        prefs.edit().putString("serverUrl", s.serverUrl).apply()
        // Rester sur SETUP pour que SetupScreen affiche le PairingScreen (QR + PIN)
        _ui.update { it.copy(isPairing = true, pairingPin = pin) }
        createAndConnectPairing(s.serverUrl, pin)
    }

    /** Annuler le mode appairage → retour à l'écran de setup */
    fun cancelPairing() {
        wsClient?.close()
        wsClient = null
        reconnectJob?.cancel()
        _ui.update { it.copy(
            screen = UiState.Screen.SETUP,
            isPairing = false,
            pairingPin = "",
            connected = false,
        )}
    }

    // ---- Découverte mDNS ----

    fun startMdnsDiscovery() {
        stopMdnsDiscovery()
        _ui.update { it.copy(isDiscovering = true) }
        resolveInProgress.set(false)

        val resolveListener = object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                resolveInProgress.set(false)
                viewModelScope.launch { _ui.update { it.copy(isDiscovering = false) } }
            }
            override fun onServiceResolved(info: NsdServiceInfo) {
                resolveInProgress.set(false)
                val host = info.host?.hostAddress ?: return
                val port = info.port
                val url  = "ws://$host:$port/ws"
                stopMdnsDiscovery()
                viewModelScope.launch {
                    prefs.edit().putString("serverUrl", url).apply()
                    _ui.update { it.copy(serverUrl = url, isDiscovering = false) }
                    startPairing() // QR code affiché automatiquement
                }
            }
        }

        nsdDiscoveryListener = object : NsdManager.DiscoveryListener {
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                discoveryActive.set(false)
                viewModelScope.launch { _ui.update { it.copy(isDiscovering = false) } }
            }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                discoveryActive.set(false)
            }
            override fun onDiscoveryStarted(serviceType: String) {
                discoveryActive.set(true)
            }
            override fun onDiscoveryStopped(serviceType: String) {
                discoveryActive.set(false)
            }
            override fun onServiceFound(info: NsdServiceInfo) {
                // Évite les résolutions multiples en parallèle
                if (resolveInProgress.compareAndSet(false, true)) {
                    try { nsdManager.resolveService(info, resolveListener) }
                    catch (_: Exception) { resolveInProgress.set(false) }
                }
            }
            override fun onServiceLost(info: NsdServiceInfo) {}
        }

        try {
            nsdManager.discoverServices("_cfitv._tcp.", NsdManager.PROTOCOL_DNS_SD, nsdDiscoveryListener!!)
        } catch (_: Exception) {
            _ui.update { it.copy(isDiscovering = false) }
            return
        }

        // Timeout 5 secondes → afficher le formulaire manuel
        viewModelScope.launch {
            delay(5_000)
            if (_ui.value.isDiscovering) {
                stopMdnsDiscovery()
                _ui.update { it.copy(isDiscovering = false) }
            }
        }
    }

    private fun stopMdnsDiscovery() {
        if (discoveryActive.get()) {
            try { nsdDiscoveryListener?.let { nsdManager.stopServiceDiscovery(it) } }
            catch (_: Exception) {}
        }
        discoveryActive.set(false)
        nsdDiscoveryListener = null
    }

    fun disconnect() {
        wsClient?.close()
        wsClient = null
        reconnectJob?.cancel()
        heartbeatJob?.cancel()
        clockJob?.cancel()
        timerJob?.cancel()
        lastFetchedCircuitId = ""
        clearConfig()
        _ui.update { it.copy(
            screen = UiState.Screen.SETUP,
            isPairing = false,
            pairingPin = "",
            connected = false,
            session = null,
            circuit = null,
            myExercises = emptyList(),
        )}
    }

    // ---- Connexion WS ----

    private fun createAndConnect(serverUrl: String, label: String) {
        wsClient?.close()
        wsClient = WsClient(
            serverUrl      = serverUrl,
            label          = label,
            onConnected    = { handleConnected() },
            onMessage      = { msg -> handleMessage(msg) },
            onDisconnected = { handleDisconnected(serverUrl, label) },
        )
        wsClient!!.connect()
    }

    private fun createAndConnectPairing(serverUrl: String, pin: String) {
        val deviceModel = Build.MODEL
        val deviceOs    = "Android ${Build.VERSION.RELEASE}"
        val appVersion  = try {
            getApplication<Application>().packageManager
                .getPackageInfo(getApplication<Application>().packageName, 0).versionName ?: ""
        } catch (_: Exception) { "" }

        wsClient?.close()
        wsClient = WsClient(
            serverUrl      = serverUrl,
            label          = "Appairage",
            onConnected    = {
                viewModelScope.launch { _ui.update { it.copy(connected = true) } }
                wsClient?.sendPairRegister(
                    pin         = pin,
                    deviceModel = deviceModel,
                    deviceOs    = deviceOs,
                    appVersion  = appVersion,
                )
            },
            onMessage      = { msg -> handleMessage(msg) },
            onDisconnected = {
                // Garder le QR visible et reconnecter automatiquement
                viewModelScope.launch { _ui.update { it.copy(connected = false) } }
                reconnectJob?.cancel()
                reconnectJob = viewModelScope.launch {
                    delay(3_000)
                    if (_ui.value.isPairing) createAndConnectPairing(serverUrl, pin)
                }
            },
        )
        wsClient!!.connect()
    }

    private fun handleConnected() {
        viewModelScope.launch { _ui.update { it.copy(connected = true) } }

        clockJob?.cancel()
        clockJob = viewModelScope.launch {
            while (true) {
                wsClient?.sendPing(System.currentTimeMillis())
                delay(30_000)
            }
        }

        heartbeatJob?.cancel()
        heartbeatJob = viewModelScope.launch {
            while (true) {
                delay(10_000)
                wsClient?.sendHeartbeat(System.currentTimeMillis())
            }
        }
    }

    private fun handleMessage(msg: ServerMessage) {
        viewModelScope.launch {
            when (msg) {
                is ServerMessage.ClockPong -> {
                    val t3 = System.currentTimeMillis()
                    clockOffset = ((msg.serverT1 - msg.clientT0) + (msg.serverT2 - t3)) / 2
                }
                is ServerMessage.SessionUpdate -> {
                    val session = msg.payload
                    _ui.update { it.copy(session = session, sessionEndedReason = null) }
                    if (session != null) {
                        updateMyWorkState(session)
                        fetchCircuitIfNeeded(session.circuitId)
                    }
                }
                is ServerMessage.SessionEnded -> {
                    lastFetchedCircuitId = ""
                    _ui.update { it.copy(
                        session             = null,
                        circuit             = null,
                        isMyWork            = false,
                        myExercises         = emptyList(),
                        sessionEndedReason  = msg.reason,
                    )}
                    // Effacer l'overlay après 6 secondes
                    viewModelScope.launch {
                        delay(6_000)
                        _ui.update { it.copy(sessionEndedReason = null) }
                    }
                }
                is PairConfig -> {
                    // Config reçue de la console → sauvegarder et démarrer l'affichage
                    val screenType = if (msg.screenType == "DASHBOARD") ScreenType.DASHBOARD else ScreenType.STATION
                    val newState = _ui.value.copy(
                        screen        = UiState.Screen.DISPLAY,
                        isPairing     = false,
                        pairingPin    = "",
                        label         = msg.label,
                        stationNumber = msg.stationNumber,
                        isLandscape   = msg.isLandscape,
                        screenType    = screenType,
                        primaryColor  = msg.primaryColor ?: _ui.value.primaryColor,
                        logoUrl       = msg.logoUrl,
                    )
                    saveConfig(newState)
                    _ui.update { newState }
                    startTimerTick()
                    // Reconnexion avec le bon label
                    val url = newState.serverUrl
                    val lbl = newState.label
                    viewModelScope.launch {
                        delay(500) // laisser le temps à la WS de se stabiliser
                        createAndConnect(url, lbl)
                    }
                }
                else -> { /* ignoré */ }
            }
        }
    }

    private fun updateMyWorkState(session: SessionPayload) {
        // En circuit training, toutes les stations travaillent simultanément pendant WORK.
        // stationIdx indique l'ordre de rotation, pas la seule station active.
        val isMyWork = session.phase.type == "WORK"
        val exercises = extractMyExercises(_ui.value.circuit)
        _ui.update { it.copy(isMyWork = isMyWork, myExercises = exercises) }
    }

    // ---- Fetch circuit via REST ----

    private fun fetchCircuitIfNeeded(circuitId: String) {
        if (circuitId == lastFetchedCircuitId) return
        lastFetchedCircuitId = circuitId

        val httpBase = wsUrlToHttpBase(_ui.value.serverUrl)
        viewModelScope.launch {
            try {
                val circuit = withContext(Dispatchers.IO) {
                    val req = Request.Builder().url("$httpBase/circuits/$circuitId").build()
                    httpClient.newCall(req).execute().use { resp ->
                        val body = resp.body?.string() ?: return@withContext null
                        json.decodeFromString<CircuitResponse>(body)
                    }
                }
                if (circuit != null) {
                    val exercises = extractMyExercises(circuit)
                    _ui.update { it.copy(circuit = circuit, myExercises = exercises) }
                }
            } catch (_: Exception) { /* réseau indisponible */ }
        }
    }

    private fun extractMyExercises(circuit: CircuitResponse?): List<ExerciseData> {
        if (circuit == null) return emptyList()
        val myIdx = _ui.value.stationNumber - 1
        val sorted = circuit.stations.sortedBy { it.position }
        return sorted.getOrNull(myIdx)?.exercises?.map { it.exercise } ?: emptyList()
    }

    private fun wsUrlToHttpBase(wsUrl: String): String =
        wsUrl.replace(Regex("^ws://"), "http://")
             .replace(Regex("^wss://"), "https://")
             .removeSuffix("/ws")

    // ---- Reconnexion ----

    private fun handleDisconnected(serverUrl: String, label: String) {
        clockJob?.cancel()
        heartbeatJob?.cancel()
        viewModelScope.launch { _ui.update { it.copy(connected = false) } }

        reconnectJob?.cancel()
        reconnectJob = viewModelScope.launch {
            delay(3_000)
            createAndConnect(serverUrl, label)
        }
    }

    // ---- Timer (tick 100 ms) ----

    private fun startTimerTick() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (true) {
                val session = _ui.value.session
                if (session != null) {
                    val serverNow = System.currentTimeMillis() + clockOffset
                    val remainingMs = if (session.status == "PAUSED") {
                        session.remainingOnPauseMs ?: 0L
                    } else {
                        max(0L, session.phaseEndsAt - serverNow)
                    }
                    val sec = ceil(remainingMs.toDouble() / 1_000.0).toInt()
                    val frac = if (session.phase.durationMs > 0) {
                        val elapsed = session.phase.durationMs - remainingMs
                        (elapsed.toFloat() / session.phase.durationMs.toFloat()).coerceIn(0f, 1f)
                    } else 0f
                    val hydrationMs = session.hydrationBreakEndsAt?.let {
                        max(0L, it - serverNow)
                    } ?: 0L
                    val hydrationSec = ceil(hydrationMs.toDouble() / 1_000.0).toInt()
                    _ui.update { it.copy(remainingSec = sec, progressFrac = frac, hydrationRemainingSec = hydrationSec) }
                }
                delay(100)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopMdnsDiscovery()
        wsClient?.close()
        reconnectJob?.cancel()
        heartbeatJob?.cancel()
        clockJob?.cancel()
        timerJob?.cancel()
        httpClient.dispatcher.executorService.shutdown()
    }
}
