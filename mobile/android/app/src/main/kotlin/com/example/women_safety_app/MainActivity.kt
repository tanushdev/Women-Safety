package com.example.women_safety_app

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.SmsManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.women_safety.app/native_security"
    private var mediaRecorder: MediaRecorder? = null
    private var currentRecordingPath: String? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                // 1. Direct Offline SMS Dispatch via Cellular SIM
                "sendDirectSMS" -> {
                    val phone = call.argument<String>("phone")
                    val message = call.argument<String>("message")

                    if (!phone.isNullOrBlank() && !message.isNullOrBlank()) {
                        try {
                            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                applicationContext.getSystemService(SmsManager::class.java)
                            } else {
                                SmsManager.getDefault()
                            }
                            val parts = smsManager.divideMessage(message)
                            smsManager.sendMultipartTextMessage(phone, null, parts, null, null)
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("SMS_FAILED", e.localizedMessage, null)
                        }
                    } else {
                        result.error("INVALID_ARGS", "Phone or message empty", null)
                    }
                }

                // 2. Blackbox Ambient Audio Recording (High-Fidelity Tamper-Proof Evidence)
                "startBlackboxRecording" -> {
                    try {
                        val outputDir = applicationContext.cacheDir
                        val outputFile = File(outputDir, "blackbox_${System.currentTimeMillis()}.m4a")
                        currentRecordingPath = outputFile.absolutePath

                        mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            MediaRecorder(applicationContext)
                        } else {
                            @Suppress("DEPRECATION")
                            MediaRecorder()
                        }.apply {
                            setAudioSource(MediaRecorder.AudioSource.MIC)
                            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                            setAudioEncodingBitRate(128000)
                            setAudioSamplingRate(44100)
                            setOutputFile(currentRecordingPath)
                            prepare()
                            start()
                        }
                        result.success(currentRecordingPath)
                    } catch (e: Exception) {
                        result.error("REC_FAILED", e.localizedMessage, null)
                    }
                }

                "stopBlackboxRecording" -> {
                    try {
                        mediaRecorder?.apply {
                            stop()
                            release()
                        }
                        mediaRecorder = null
                        result.success(currentRecordingPath)
                    } catch (e: Exception) {
                        mediaRecorder = null
                        result.error("REC_STOP_FAILED", e.localizedMessage, null)
                    }
                }

                // 3. Bluetooth Stalker Radar (BLE Nearby Proximity Device Sniffer)
                "isBluetoothEnabled" -> {
                    try {
                        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
                        val adapter = bluetoothManager?.adapter
                        result.success(adapter != null && adapter.isEnabled)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }

                "scanNearbyBluetooth" -> {
                    try {
                        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
                        val adapter = bluetoothManager?.adapter

                        if (adapter == null || !adapter.isEnabled) {
                            result.error("BT_DISABLED", "Bluetooth adapter is turned off on this device", null)
                            return@setMethodCallHandler
                        }

                        val scanner = adapter.bluetoothLeScanner
                        if (scanner == null) {
                            result.success(emptyList<Map<String, Any>>())
                            return@setMethodCallHandler
                        }

                        val discoveredDevices = mutableListOf<Map<String, Any>>()
                        val seenIds = mutableSetOf<String>()

                        val callback = object : ScanCallback() {
                            override fun onScanResult(callbackType: Int, scanResult: ScanResult?) {
                                scanResult?.let {
                                    val address = it.device?.address ?: "UNKNOWN"
                                    if (!seenIds.contains(address)) {
                                        seenIds.add(address)
                                        val deviceMap = mapOf(
                                            "id" to address,
                                            "name" to (it.device?.name ?: "BLE Device"),
                                            "rssi" to it.rssi,
                                            "timestamp" to System.currentTimeMillis()
                                        )
                                        discoveredDevices.add(deviceMap)
                                    }
                                }
                            }

                            override fun onScanFailed(errorCode: Int) {
                                // Silent fallback
                            }
                        }

                        scanner.startScan(callback)

                        // Scan for 3.5 seconds then return aggregated results
                        Handler(Looper.getMainLooper()).postDelayed({
                            try {
                                scanner.stopScan(callback)
                            } catch (_: Exception) {}
                            result.success(discoveredDevices)
                        }, 3500)

                    } catch (e: Exception) {
                        result.error("BLE_SCAN_ERROR", e.localizedMessage, null)
                    }
                }

                else -> result.notImplemented()
            }
        }
    }
}
