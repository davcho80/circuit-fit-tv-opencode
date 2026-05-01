package com.cfitv.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
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
    private lateinit var webView: WebView
    private lateinit var statusPanel: LinearLayout
    private lateinit var statusTitle: TextView
    private lateinit var statusDetail: TextView
    private lateinit var retryButton: Button
    private val timeoutHandler = Handler(Looper.getMainLooper())

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
        loadTvUrl()
    }

    override fun onDestroy() {
        timeoutHandler.removeCallbacksAndMessages(null)
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
            setOnClickListener { loadTvUrl() }
        }

        panel.addView(statusTitle)
        panel.addView(statusDetail)
        panel.addView(retryButton)
        return panel
    }

    private fun loadTvUrl() {
        showStatus(
            "Chargement de Circuit Fit TV",
            "URL: ${BuildConfig.CFITV_TV_URL}",
            showRetry = false,
        )
        webView.loadUrl(BuildConfig.CFITV_TV_URL)
        timeoutHandler.removeCallbacksAndMessages(null)
        timeoutHandler.postDelayed({
            if (statusPanel.visibility == View.VISIBLE) {
                showStatus(
                    "Circuit Fit TV ne repond pas encore",
                    "Verifiez que la tablette est sur le meme reseau que le serveur et que cfitvTvUrl pointe vers l'adresse IP du Mac.\n\nURL: ${BuildConfig.CFITV_TV_URL}",
                    showRetry = true,
                )
            }
        }, 8_000)
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
