package com.saapt.parent

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val upiIntentChannel = "com.saapt.parent/upi_intent"
    private val logTag = "ParentUpiIntent"
    private val supportedSchemes = setOf(
        "upi",
        "intent",
        "gpay",
        "tez",
        "phonepe",
        "paytm",
        "paytmmp",
        "credpay",
        "mobikwik",
        "bhim",
        "amazonpay",
        "navi",
        "payzapp",
        "icici",
        "in.fampay.app",
        "whatsapp",
        "market",
    )

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, upiIntentChannel)
            .setMethodCallHandler { call, result ->
                if (call.method != "launch") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }

                val url = call.argument<String>("url")
                if (url.isNullOrBlank() || !isSupportedPaymentUrl(url)) {
                    result.success(false)
                    return@setMethodCallHandler
                }
                result.success(launchPaymentIntent(url))
            }
    }

    private fun isSupportedPaymentUrl(url: String): Boolean =
        try {
            supportedSchemes.contains(Uri.parse(url).scheme?.lowercase())
        } catch (_: Exception) {
            false
        }

    private fun launchPaymentIntent(url: String): Boolean {
        Log.d(logTag, "Received UPI launch request: ${safeLogUrl(url)}")
        for (candidateUrl in paymentUrlCandidates(url)) {
            try {
                Log.d(logTag, "Trying UPI intent candidate: ${safeLogUrl(candidateUrl)}")
                val intent = if (candidateUrl.startsWith("intent:", ignoreCase = true)) {
                    Intent.parseUri(candidateUrl, Intent.URI_INTENT_SCHEME)
                } else {
                    Intent(Intent.ACTION_VIEW, Uri.parse(candidateUrl))
                }
                intent.addCategory(Intent.CATEGORY_BROWSABLE)
                startActivity(intent)
                Log.d(logTag, "Launched UPI intent candidate: ${safeLogUrl(candidateUrl)}")
                return true
            } catch (error: ActivityNotFoundException) {
                Log.w(logTag, "No activity found for UPI candidate: ${safeLogUrl(candidateUrl)}")
                if (candidateUrl.startsWith("intent:", ignoreCase = true)) {
                    val fallbackIntent = Intent.parseUri(candidateUrl, Intent.URI_INTENT_SCHEME)
                    if (openFallbackUrl(fallbackIntent)) return true
                }
            } catch (error: Exception) {
                Log.w(logTag, "Unable to launch UPI candidate: ${safeLogUrl(candidateUrl)}", error)
            }
        }
        Log.w(logTag, "No UPI intent candidate could be launched")
        return false
    }

    private fun paymentUrlCandidates(url: String): List<String> {
        val candidates = linkedSetOf(url)
        try {
            val uri = Uri.parse(url)
            val query = uri.encodedQuery
            if (!query.isNullOrBlank()) {
                if (url.startsWith("gpay://upi/pay", ignoreCase = true)) {
                    candidates.add("tez://upi/pay?$query")
                }
                if (!url.startsWith("upi://pay", ignoreCase = true)) {
                    candidates.add("upi://pay?$query")
                }
            }
        } catch (_: Exception) {
            // Keep the original URL as the only candidate.
        }
        return candidates.toList()
    }

    private fun openFallbackUrl(intent: Intent): Boolean {
        val fallbackUrl = intent.getStringExtra("browser_fallback_url")
        if (fallbackUrl.isNullOrBlank()) return false
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)))
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun safeLogUrl(url: String): String =
        try {
            val uri = Uri.parse(url)
            "${uri.scheme ?: "unknown"}:${uri.path ?: ""}"
        } catch (_: Exception) {
            "invalid-url"
        }
}
