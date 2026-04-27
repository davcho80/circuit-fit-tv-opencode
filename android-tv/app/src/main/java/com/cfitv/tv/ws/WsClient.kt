package com.cfitv.tv.ws

import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.time.Duration

// ============================================================
// Client WebSocket — OkHttp + kotlinx.serialization
// ============================================================

class WsClient(
    private val serverUrl: String,
    private val label: String,
    private val onConnected: () -> Unit,
    private val onMessage: (ServerMessage) -> Unit,
    private val onDisconnected: () -> Unit,
) {
    private val http = OkHttpClient.Builder()
        .readTimeout(Duration.ZERO) // Pas de timeout sur WS
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        classDiscriminator = "type"
    }

    private var ws: WebSocket? = null

    fun connect() {
        val req = Request.Builder().url(serverUrl).build()
        ws = http.newWebSocket(req, object : WebSocketListener() {

            override fun onOpen(webSocket: WebSocket, response: Response) {
                // REGISTER immédiat après connexion
                webSocket.send(
                    json.encodeToString<ClientMessage>(
                        ClientMessage.Register(role = "tv", label = label)
                    )
                )
                onConnected()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    onMessage(json.decodeFromString<ServerMessage>(text))
                } catch (_: Exception) { /* message inconnu, on ignore */ }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                onDisconnected()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                onDisconnected()
            }
        })
    }

    fun sendPing(clientT0: Long) {
        send(ClientMessage.ClockPing(clientT0 = clientT0))
    }

    fun sendHeartbeat(t: Long) {
        send(ClientMessage.Heartbeat(t = t))
    }

    fun sendPairRegister(pin: String) {
        send(ClientMessage.PairRegister(pin = pin))
    }

    private fun send(msg: ClientMessage) {
        try {
            ws?.send(json.encodeToString(msg))
        } catch (_: Exception) {}
    }

    fun close() {
        ws?.close(1000, "Normal closure")
        ws = null
    }
}
