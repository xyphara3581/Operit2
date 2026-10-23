package app.operit

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Display
import android.view.Surface
import android.view.View
import android.view.ViewGroup
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.android.FlutterSurfaceView
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    companion object {
        private const val TAG = "OperitMainActivity"
        const val NOTIFICATION_ACTIVATION_EXTRA = "app.operit.notificationActivation"
        @Volatile private var activeActivity: MainActivity? = null

        fun currentActivity(): MainActivity? = activeActivity
    }

    private lateinit var runtimeHost: AndroidRuntimeHost
    private lateinit var ownerSystem: OwnerSystemCapabilityChannel
    private lateinit var runtimeRouter: RuntimeMethodChannelRouter
    private lateinit var nativeCrashChannel: NativeCrashChannel
    private var pendingNotificationActivation: Map<String, String>? = null
    private var notificationActivationReceiverReady = false

    /** Initializes the runtime host while Flutter owns the system bar layout. */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        activeActivity = this
        recordNotificationActivation(intent)
        requestHighestRefreshRate()
    }

    /** Refreshes host activity state without overriding Flutter system bars. */
    override fun onResume() {
        super.onResume()
        activeActivity = this
        requestHighestRefreshRate()
    }

    override fun onDestroy() {
        if (activeActivity === this) {
            activeActivity = null
        }
        super.onDestroy()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val runtimeHost = ensureRuntimeHost()
        val ownerSystem = ensureOwnerSystem(runtimeHost)
        runtimeRouter = RuntimeMethodChannelRouter(this, runtimeHost, ownerSystem)
        runtimeRouter.configure(flutterEngine.dartExecutor.binaryMessenger)
        nativeCrashChannel = NativeCrashChannel(this)
        nativeCrashChannel.configure(flutterEngine.dartExecutor.binaryMessenger)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        try {
            if (::ownerSystem.isInitialized) {
                ownerSystem.release()
            }
            if (::runtimeRouter.isInitialized) {
                runtimeRouter.clear()
            }
        } catch (_: Exception) {
        }
        super.cleanUpFlutterEngine(flutterEngine)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        if (::runtimeRouter.isInitialized &&
            runtimeRouter.onRequestPermissionsResult(requestCode, permissions, grantResults)
        ) {
            return
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    /** Delivers document-picker results to platform channels that own the selected content stream. */
    @Deprecated("Deprecated in Android API 35")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (::runtimeRouter.isInitialized && runtimeRouter.onActivityResult(requestCode, resultCode, data)) {
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        recordNotificationActivation(intent)
    }

    fun ensureHostEventRuntimeHandle(): Long = ensureRuntimeHost().ensureRuntimeHandle()

    fun handleRuntimeHostRequest(methodName: String, payloadJson: String): String {
        return ensureOwnerSystem(ensureRuntimeHost()).handleRuntimeHostRequest(methodName, payloadJson)
    }

    /** Returns and clears the notification activation recorded during application startup. */
    fun takeNotificationActivation(): Map<String, String>? {
        val activation = pendingNotificationActivation
        pendingNotificationActivation = null
        return activation
    }

    /** Marks the Dart notification receiver ready and dispatches the queued activation. */
    fun markNotificationActivationReceiverReady() {
        notificationActivationReceiverReady = true
        val activation = takeNotificationActivation() ?: return
        runtimeRouter.emitNotificationActivation(activation)
    }

    /** Returns the process-level Runtime host shared with the Core service. */
    private fun ensureRuntimeHost(): AndroidRuntimeHost {
        if (!::runtimeHost.isInitialized) {
            runtimeHost = AndroidCoreRuntime.get(applicationContext)
        }
        return runtimeHost
    }

    private fun ensureOwnerSystem(runtimeHost: AndroidRuntimeHost): OwnerSystemCapabilityChannel {
        if (!::ownerSystem.isInitialized) {
            ownerSystem = OwnerSystemCapabilityChannel(this, runtimeHost)
        }
        return ownerSystem
    }

    /** Parses and records the notification activation embedded in one launch intent. */
    private fun recordNotificationActivation(intent: Intent?) {
        val encodedActivation = intent?.getStringExtra(NOTIFICATION_ACTIVATION_EXTRA) ?: return
        when (
            val decoded = NotificationActivationCodec.decode(encodedActivation) { message, error ->
                Log.w(TAG, message, error)
            }
        ) {
            is NotificationActivationDecode.Accepted -> {
                if (notificationActivationReceiverReady && ::runtimeRouter.isInitialized) {
                    runtimeRouter.emitNotificationActivation(decoded.activation)
                    return
                }
                pendingNotificationActivation = decoded.activation
            }
            is NotificationActivationDecode.Rejected ->
                // The activation is discarded (WARN already logged by the codec);
                // the launch itself still proceeds.
                Unit
        }
    }

    private fun requestHighestRefreshRate() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return
        }
        val display = currentDisplay() ?: return
        val currentMode = display.mode ?: return
        val preferredMode =
            display.supportedModes
                .filter {
                    it.physicalWidth == currentMode.physicalWidth &&
                        it.physicalHeight == currentMode.physicalHeight
                }
                .maxByOrNull { it.refreshRate }
                ?: return
        val preferredRefreshRate = preferredMode.refreshRate

        // Prefer a refresh-rate vote over pinning a display mode/resolution. Android 11+
        // can then arbitrate this request with system settings, battery saver and thermals.
        val attributes = window.attributes
        if (attributes.preferredRefreshRate != preferredRefreshRate ||
            attributes.preferredDisplayModeId != 0
        ) {
            attributes.preferredDisplayModeId = 0
            attributes.preferredRefreshRate = preferredRefreshRate
            window.attributes = attributes
        }

        // Flutter's primary Android renderer is a SurfaceView. A window preference alone
        // may not communicate the intended cadence to the Flutter surface on every device.
        window.decorView.post {
            requestFlutterSurfaceFrameRate(preferredRefreshRate)
        }
        Log.i(
            TAG,
            "Requested Flutter refresh rate ${preferredRefreshRate}Hz; current display rate=${display.refreshRate}Hz",
        )
    }

    private fun requestFlutterSurfaceFrameRate(refreshRate: Float) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return
        }

        fun applyTo(view: View) {
            if (view is FlutterSurfaceView) {
                val surface = view.holder.surface
                if (surface.isValid) {
                    surface.setFrameRate(
                        refreshRate,
                        Surface.FRAME_RATE_COMPATIBILITY_DEFAULT,
                    )
                }
            }
            if (view is ViewGroup) {
                for (index in 0 until view.childCount) {
                    applyTo(view.getChildAt(index))
                }
            }
        }

        applyTo(window.decorView)
    }

    @Suppress("DEPRECATION")
    private fun currentDisplay(): Display? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            display
        } else {
            windowManager.defaultDisplay
        }
    }

}
