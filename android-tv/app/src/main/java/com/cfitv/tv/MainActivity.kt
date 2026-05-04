package com.cfitv.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : Activity() {
    private companion object {
        const val SERVICE_TYPE = "_cfitv._tcp."
        const val TV_PATH = "/tv"
        const val DISCOVERY_TIMEOUT_MS = 12_000L
    }

    private lateinit var webView: WebView
    private lateinit var statusPanel: LinearLayout
    private lateinit var statusTitle: TextView
    private lateinit var statusDetail: TextView
    private lateinit var retryButton: Button
    private val timeoutHandler = Handler(Looper.getMainLooper())
    private val nsdManager by lazy { getSystemService(NSD_SERVICE) as NsdManager }
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var resolveInProgress = false
    private var multicastLock: WifiManager.MulticastLock? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemBars()

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(2, 6, 23))
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(2, 6, 23))
            webViewClient = createWebViewClient()
            webChromeClient = WebChromeClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        statusPanel = createStatusPanel()
        root.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))
        root.addView(statusPanel, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))

        setContentView(root)
        start()
    }

    override fun onDestroy() {
        timeoutHandler.removeCallbacksAndMessages(null)
        stopDiscovery()
        releaseMulticastLock()
        super.onDestroy()
    }

    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun createWebViewClient() = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            return false
        }

        override fun onPageCommitVisible(view: WebView, url: String) {
            hideStatus()
        }

        @Suppress("DEPRECATION")
        override fun onReceivedError(
            view: WebView,
            errorCode: Int,
            description: String,
            failingUrl: String,
        ) {
            if (failingUrl == BuildConfig.CFITV_TV_URL) {
                showStatus(
                    "Impossible de charger Circuit Fit TV",
                    "$description\n\nURL: ${BuildConfig.CFITV_TV_URL}",
                    showRetry = true,
                )
            }
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            if (request.isForMainFrame) {
                showStatus(
                    "Impossible de charger Circuit Fit TV",
                    "${error.description ?: "Erreur reseau"}\n\nURL: ${request.url}",
                    showRetry = true,
                )
            }
        }
    }

    private fun createStatusPanel(): LinearLayout {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
            setBackgroundColor(Color.rgb(2, 6, 23))
        }

        statusTitle = TextView(this).apply {
            gravity = Gravity.CENTER
            textSize = 28f
            setTextColor(Color.rgb(56, 189, 248))
        }
        statusDetail = TextView(this).apply {
            gravity = Gravity.CENTER
            textSize = 16f
            setTextColor(Color.rgb(148, 163, 184))
            setPadding(0, 20, 0, 0)
        }
        retryButton = Button(this).apply {
            text = "Reessayer"
            setOnClickListener { start() }
        }

        panel.addView(statusTitle)
        panel.addView(statusDetail)
        panel.addView(retryButton)
        return panel
    }

    private fun start() {
        val configuredUrl = BuildConfig.CFITV_TV_URL.trim()
        if (configuredUrl.isNotEmpty()) {
            loadTvUrl(configuredUrl)
        } else {
            discoverServer()
        }
    }

    @Suppress("DEPRECATION")
    private fun discoverServer() {
        webView.stopLoading()
        stopDiscovery()
        acquireMulticastLock()
        showStatus(
            "Recherche du serveur Circuit Fit TV",
            "Assurez-vous que la TV et le serveur sont sur le meme reseau Wi-Fi.\n\nService recherche: $SERVICE_TYPE",
            showRetry = false,
        )

        resolveInProgress = false
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) = Unit

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                if (serviceInfo.serviceType != SERVICE_TYPE || resolveInProgress) return
                resolveInProgress = true
                nsdManager.resolveService(serviceInfo, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                        resolveInProgress = false
                    }

                    override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                        val host = serviceInfo.host?.hostAddress
                        val port = serviceInfo.port
                        if (host.isNullOrBlank() || port <= 0) {
                            resolveInProgress = false
                            return
                        }
                        runOnUiThread { loadTvUrl("http://$host:$port$TV_PATH") }
                    }
                })
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) = Unit

            override fun onDiscoveryStopped(serviceType: String) = Unit

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                runOnUiThread { showDiscoveryError("La recherche reseau n'a pas pu demarrer. Code: $errorCode") }
                stopDiscovery()
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                stopDiscovery()
            }
        }

        discoveryListener = listener
        nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        timeoutHandler.removeCallbacksAndMessages(null)
        timeoutHandler.postDelayed({
            if (statusPanel.visibility == View.VISIBLE) {
                showDiscoveryError("Aucun serveur detecte automatiquement.")
            }
        }, DISCOVERY_TIMEOUT_MS)
    }

    private fun loadTvUrl(url: String) {
        stopDiscovery()
        showStatus(
            "Chargement de Circuit Fit TV",
            "URL: $url",
            showRetry = false,
        )
        webView.loadUrl(url)
        timeoutHandler.removeCallbacksAndMessages(null)
        timeoutHandler.postDelayed({
            if (statusPanel.visibility == View.VISIBLE) {
                showStatus(
                    "Circuit Fit TV ne repond pas encore",
                    "Verifiez que la TV et le serveur sont sur le meme reseau, puis reessayez.\n\nURL: $url",
                    showRetry = true,
                )
            }
        }, 8_000)
    }

    private fun showDiscoveryError(message: String) {
        showStatus(
            "Serveur Circuit Fit TV introuvable",
            "$message\n\nDemarrez le serveur Circuit Fit TV et verifiez que le reseau autorise la decouverte locale (mDNS).",
            showRetry = true,
        )
    }

    private fun stopDiscovery() {
        val listener = discoveryListener ?: return
        discoveryListener = null
        resolveInProgress = false
        runCatching { nsdManager.stopServiceDiscovery(listener) }
    }

    private fun acquireMulticastLock() {
        if (multicastLock?.isHeld == true) return
        val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
        multicastLock = wifiManager.createMulticastLock("cfitv-mdns").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseMulticastLock() {
        multicastLock?.let { lock ->
            if (lock.isHeld) lock.release()
        }
        multicastLock = null
    }

    private fun showStatus(title: String, detail: String, showRetry: Boolean) {
        statusTitle.text = title
        statusDetail.text = detail
        retryButton.visibility = if (showRetry) View.VISIBLE else View.GONE
        statusPanel.visibility = View.VISIBLE
    }

    private fun hideStatus() {
        timeoutHandler.removeCallbacksAndMessages(null)
        statusPanel.visibility = View.GONE
    }
}
