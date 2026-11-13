package com.mda.visuales

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Cada ~15 minutos (mínimo que permite Android) pregunta a la plataforma si hay avisos nuevos
 * para el usuario con sesión iniciada y los muestra como notificaciones del celular.
 * No usa Firebase: por eso puede tardar unos minutos y depende del ahorro de batería del equipo.
 */
class NotificationWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val cookie = CookieManager.getInstance().getCookie(BuildConfig.SITE_URL)
        // Sin sesión iniciada no hay nada que consultar
        if (cookie.isNullOrBlank() || !cookie.contains("vm_session=")) return Result.success()

        val prefs = applicationContext.getSharedPreferences("avisos", Context.MODE_PRIVATE)
        val since = prefs.getString("cursor", null)

        return try {
            val query = if (since != null) "?since=" + URLEncoder.encode(since, "UTF-8") else ""
            val conn = URL(BuildConfig.SITE_URL + "/api/app/notifications" + query).openConnection() as HttpURLConnection
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.setRequestProperty("Cookie", cookie)
            conn.setRequestProperty("User-Agent", "VisualManagerApp/" + BuildConfig.VERSION_NAME)

            when (conn.responseCode) {
                200 -> {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)
                    // La primera vez solo se guarda el punto de partida, para no mostrar avisos viejos de golpe
                    if (since != null) show(json)
                    prefs.edit().putString("cursor", json.getString("next")).apply()
                    Result.success()
                }
                401 -> Result.success() // la sesión venció: el usuario deberá entrar de nuevo
                else -> Result.retry()
            }
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun show(json: JSONObject) {
        val items = json.getJSONArray("items")
        val total = items.length()
        if (total == 0) return

        val ctx = applicationContext
        if (Build.VERSION.SDK_INT >= 33 &&
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Avisos del ministerio", NotificationManager.IMPORTANCE_HIGH))

        val tap = Intent(ctx, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_PATH, "/panel/notificaciones")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

        val shown = minOf(total, MAX_SHOWN)
        for (i in total - shown until total) {
            val o = items.getJSONObject(i)
            val message = o.getString("message")
            val id = o.getString("id").hashCode()
            val pending = PendingIntent.getActivity(ctx, id, tap, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val n = NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle("Visuales MDA")
                .setContentText(message.lineSequence().firstOrNull() ?: message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build()
            nm.notify(id, n)
        }
        if (total > shown) {
            val pending = PendingIntent.getActivity(ctx, 0, tap, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val n = NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle("Visuales MDA")
                .setContentText("Tienes ${total - shown} avisos más")
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build()
            nm.notify(SUMMARY_ID, n)
        }
    }

    companion object {
        private const val CHANNEL = "avisos"
        private const val SUMMARY_ID = 1
        private const val MAX_SHOWN = 5

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<NotificationWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("avisos", ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}
