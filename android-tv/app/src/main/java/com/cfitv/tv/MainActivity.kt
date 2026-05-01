package com.cfitv.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE

        val webView = WebView(this)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return false
            }

            @Suppress("DEPRECATION")
            override fun onReceivedError(
                view: WebView,
                errorCode: Int,
                description: String,
                failingUrl: String,
            ) {
                if (failingUrl == BuildConfig.CFITV_TV_URL) {
                    showLoadError(view, description)
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                if (request.isForMainFrame) {
                    showLoadError(view, error.description?.toString() ?: "Erreur reseau")
                }
            }
        }
        webView.webChromeClient = WebChromeClient()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

        setContentView(webView)
        webView.loadUrl(BuildConfig.CFITV_TV_URL)
    }

    private fun showLoadError(webView: WebView, reason: String) {
        val safeReason = reason
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        val html = """
            <!doctype html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <style>
                  body {
                    margin: 0;
                    min-height: 100vh;
                    display: grid;
                    place-items: center;
                    background: #020617;
                    color: #e2e8f0;
                    font-family: system-ui, sans-serif;
                  }
                  main {
                    max-width: 760px;
                    padding: 32px;
                    text-align: center;
                  }
                  h1 {
                    color: #38bdf8;
                    font-size: 32px;
                    margin: 0 0 12px;
                  }
                  p {
                    color: #94a3b8;
                    line-height: 1.5;
                  }
                  code {
                    display: inline-block;
                    margin: 12px 0;
                    padding: 10px 12px;
                    border: 1px solid #334155;
                    border-radius: 8px;
                    color: #f8fafc;
                    background: #0f172a;
                  }
                  button {
                    margin-top: 16px;
                    border: 0;
                    border-radius: 8px;
                    padding: 12px 18px;
                    background: #0284c7;
                    color: white;
                    font-weight: 700;
                  }
                </style>
              </head>
              <body>
                <main>
                  <h1>Circuit Fit TV</h1>
                  <p>Impossible de charger l'interface TV.</p>
                  <code>${BuildConfig.CFITV_TV_URL}</code>
                  <p>${safeReason}</p>
                  <p>Verifiez que la tablette est sur le meme reseau et que cfitvTvUrl pointe vers l'adresse IP du serveur.</p>
                  <button onclick="location.reload()">Reessayer</button>
                </main>
              </body>
            </html>
        """.trimIndent()
        webView.loadDataWithBaseURL(BuildConfig.CFITV_TV_URL, html, "text/html", "UTF-8", null)
    }
}
