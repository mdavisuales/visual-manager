package com.mda.visuales

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.ByteArrayInputStream

/**
 * Cascarón nativo de la plataforma Visuales MDA: abre la web (ya con sesión iniciada) dentro de la app,
 * mantiene la sesión, maneja el botón "atrás" y la actualización por deslizamiento, y programa la revisión de avisos.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var progress: ProgressBar
    private lateinit var offline: View

    private val siteHost: String = Uri.parse(BuildConfig.SITE_URL).host ?: ""
    private var loadFailed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        swipe = findViewById(R.id.swipe)
        progress = findViewById(R.id.progress)
        offline = findViewById(R.id.offline)

        findViewById<Button>(R.id.retry).setOnClickListener {
            offline.visibility = View.GONE
            webView.reload()
        }

        swipe.setColorSchemeColors(0xFF1800AD.toInt())
        swipe.setOnRefreshListener { webView.reload() }
        // Solo se actualiza al deslizar cuando la página está arriba del todo
        swipe.setOnChildScrollUpCallback { _, _ -> webView.scrollY > 0 }

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportZoom(false)
            builtInZoomControls = false
            // La plataforma web reconoce a la app por este texto: oculta el formulario público y muestra la barra inferior
            userAgentString = userAgentString + " VisualManagerApp/" + BuildConfig.VERSION_NAME
        }
        CookieManager.getInstance().setAcceptCookie(true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == siteHost) return false
                // Enlaces externos (WhatsApp, Drive, YouTube, teléfono…) se abren con la app correspondiente
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                } catch (e: Exception) {
                    // si no hay una app para abrir el enlace, no pasa nada
                }
                return true
            }

            // El distintivo "Powered by Netlify" lo agrega Netlify con un script propio: en la app no se carga
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (request.url.path?.startsWith("/.netlify/scripts/hud") == true) {
                    return WebResourceResponse("text/javascript", "utf-8", ByteArrayInputStream(ByteArray(0)))
                }
                return null
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                loadFailed = false
                progress.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String?) {
                progress.visibility = View.GONE
                swipe.isRefreshing = false
                if (!loadFailed) offline.visibility = View.GONE
                CookieManager.getInstance().flush() // guarda la sesión en el disco
                view.evaluateJavascript(HIDE_BADGE_JS, null)
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    loadFailed = true
                    offline.visibility = View.VISIBLE
                    swipe.isRefreshing = false
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                recreate()
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
            }
        }

        askNotificationPermission()
        NotificationWorker.schedule(this)

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(urlFor(intent))
        }
    }

    // Si se toca un aviso, se abre directamente la pantalla de notificaciones
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        webView.loadUrl(urlFor(intent))
    }

    private fun urlFor(intent: Intent?): String {
        val path = intent?.getStringExtra(EXTRA_PATH)
        val safe = if (path != null && path.startsWith("/") && !path.contains("://")) path else "/app"
        return BuildConfig.SITE_URL + safe
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    companion object {
        const val EXTRA_PATH = "path"

        // Respaldo: si el distintivo llega a aparecer, se oculta y se elimina
        private const val HIDE_BADGE_JS =
            "(function(){try{" +
                "if(!document.getElementById('vm-hide-badge')){var s=document.createElement('style');s.id='vm-hide-badge';" +
                "s.textContent='#nl-badge-frame,[id^=\\'nl-badge\\']{display:none!important}';document.head.appendChild(s);}" +
                "var k=function(){var e=document.getElementById('nl-badge-frame');if(e){e.remove();}};k();" +
                "if(document.body&&!window.__vmBadge){window.__vmBadge=true;new MutationObserver(k).observe(document.body,{childList:true});}" +
                "}catch(e){}})();"
    }
}
