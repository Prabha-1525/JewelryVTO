package com.jewelryvto.facelandmarker

import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.atan2
import kotlin.math.sqrt

class FaceLandmarkerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val lock = Any()
  private val busy = AtomicBoolean(false)
  private var landmarker: FaceLandmarker? = null

  override fun getName(): String = "FaceLandmarker"

  @ReactMethod
  fun initialize(promise: Promise) {
    try {
      synchronized(lock) {
        landmarker?.close()
        val baseOptions =
          BaseOptions.builder()
            .setModelAssetPath(MODEL_ASSET)
            .setDelegate(Delegate.GPU)
            .build()
        val options =
          FaceLandmarker.FaceLandmarkerOptions.builder()
            .setBaseOptions(baseOptions)
            .setRunningMode(RunningMode.IMAGE)
            .setNumFaces(1)
            .setMinFaceDetectionConfidence(0.5f)
            .setMinFacePresenceConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .setOutputFaceBlendshapes(false)
            .setOutputFacialTransformationMatrixes(false)
            .build()
        landmarker = FaceLandmarker.createFromOptions(reactContext, options)
      }
      promise.resolve(true)
    } catch (gpuError: Exception) {
      try {
        synchronized(lock) {
          val baseOptions =
            BaseOptions.builder()
              .setModelAssetPath(MODEL_ASSET)
              .setDelegate(Delegate.CPU)
              .build()
          val options =
            FaceLandmarker.FaceLandmarkerOptions.builder()
              .setBaseOptions(baseOptions)
              .setRunningMode(RunningMode.IMAGE)
              .setNumFaces(1)
              .setMinFaceDetectionConfidence(0.5f)
              .setMinFacePresenceConfidence(0.5f)
              .setMinTrackingConfidence(0.5f)
              .build()
          landmarker = FaceLandmarker.createFromOptions(reactContext, options)
        }
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("INIT_FAILED", error)
      }
    }
  }

  @ReactMethod
  fun detect(
    width: Int,
    height: Int,
    rotationDegrees: Int,
    mirrored: Boolean,
    pixelsBase64: String,
    promise: Promise,
  ) {
    val detector = landmarker
    if (detector == null) {
      promise.resolve(emptyResult())
      return
    }
    if (!busy.compareAndSet(false, true)) {
      val skipped = Arguments.createMap()
      skipped.putBoolean("skipped", true)
      skipped.putBoolean("detected", false)
      promise.resolve(skipped)
      return
    }

    var bitmap: Bitmap? = null
    try {
      val bytes = Base64.decode(pixelsBase64, Base64.NO_WRAP)
      if (bytes.size < width * height * 4) {
        promise.resolve(emptyResult())
        return
      }

      swapBgraToArgb(bytes)
      val source = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      source.copyPixelsFromBuffer(ByteBuffer.wrap(bytes))
      val oriented = rotateBitmap(source, rotationDegrees)
      if (oriented !== source) {
        source.recycle()
      }
      bitmap = oriented

      val mpImage = BitmapImageBuilder(oriented).build()
      val result = detector.detect(mpImage)
      val face = result.faceLandmarks().firstOrNull()
      if (face == null || face.size <= RIGHT_EAR) {
        promise.resolve(emptyResult())
        return
      }

      var leftEar = blend(face[LEFT_EAR], face[LEFT_JAW], 0.72f)
      var rightEar = blend(face[RIGHT_EAR], face[RIGHT_JAW], 0.72f)
      var chin = Pair(face[CHIN].x(), face[CHIN].y())
      var nose = Pair(face[NOSE].x(), face[NOSE].y())
      var forehead = Pair(face[FOREHEAD].x(), face[FOREHEAD].y())

      if (mirrored) {
        leftEar = Pair(1f - leftEar.first, leftEar.second)
        rightEar = Pair(1f - rightEar.first, rightEar.second)
        chin = Pair(1f - chin.first, chin.second)
        nose = Pair(1f - nose.first, nose.second)
        forehead = Pair(1f - forehead.first, forehead.second)
        val swapped = leftEar
        leftEar = rightEar
        rightEar = swapped
      }

      val dx = rightEar.first - leftEar.first
      val dy = rightEar.second - leftEar.second
      val faceWidth = sqrt(dx * dx + dy * dy)
      val roll = atan2(dy, dx)

      val map = emptyResult()
      map.putBoolean("detected", true)
      map.putBoolean("skipped", false)
      putPoint(map, "leftEar", leftEar.first, leftEar.second)
      putPoint(map, "rightEar", rightEar.first, rightEar.second)
      putPoint(map, "chin", chin.first, chin.second)
      putPoint(map, "nose", nose.first, nose.second)
      putPoint(map, "forehead", forehead.first, forehead.second)
      putPoint(
        map,
        "neck",
        chin.first,
        (chin.second + (chin.second - forehead.second) * 0.22f).coerceAtMost(0.98f),
      )
      map.putDouble("roll", roll.toDouble())
      map.putDouble("faceWidth", faceWidth.toDouble())
      promise.resolve(map)
    } catch (error: Exception) {
      promise.reject("DETECT_FAILED", error)
    } finally {
      bitmap?.recycle()
      busy.set(false)
    }
  }

  @ReactMethod
  fun dispose(promise: Promise) {
    synchronized(lock) {
      landmarker?.close()
      landmarker = null
    }
    promise.resolve(true)
  }

  private fun emptyResult(): WritableMap {
    val map = Arguments.createMap()
    map.putBoolean("detected", false)
    map.putBoolean("skipped", false)
    putPoint(map, "leftEar", 0.0, 0.0)
    putPoint(map, "rightEar", 0.0, 0.0)
    putPoint(map, "chin", 0.0, 0.0)
    putPoint(map, "nose", 0.0, 0.0)
    putPoint(map, "forehead", 0.0, 0.0)
    putPoint(map, "neck", 0.0, 0.0)
    map.putDouble("roll", 0.0)
    map.putDouble("faceWidth", 0.0)
    return map
  }

  companion object {
    private const val MODEL_ASSET = "face_landmarker.task"
    private const val LEFT_EAR = 234
    private const val RIGHT_EAR = 454
    private const val LEFT_JAW = 132
    private const val RIGHT_JAW = 361
    private const val CHIN = 152
    private const val NOSE = 1
    private const val FOREHEAD = 10

    private fun putPoint(map: WritableMap, key: String, x: Number, y: Number) {
      val point = Arguments.createMap()
      point.putDouble("x", x.toDouble())
      point.putDouble("y", y.toDouble())
      map.putMap(key, point)
    }

    private fun blend(
      primary: com.google.mediapipe.tasks.components.containers.NormalizedLandmark,
      secondary: com.google.mediapipe.tasks.components.containers.NormalizedLandmark,
      amount: Float,
    ): Pair<Float, Float> {
      val inverse = 1f - amount
      return Pair(
        primary.x() * amount + secondary.x() * inverse,
        primary.y() * amount + secondary.y() * inverse,
      )
    }

    private fun swapBgraToArgb(bytes: ByteArray) {
      var index = 0
      while (index + 3 < bytes.size) {
        val blue = bytes[index]
        bytes[index] = bytes[index + 2]
        bytes[index + 2] = blue
        index += 4
      }
    }

    private fun rotateBitmap(source: Bitmap, rotationDegrees: Int): Bitmap {
      if (rotationDegrees == 0) {
        return source
      }
      val matrix = Matrix()
      matrix.postRotate(rotationDegrees.toFloat())
      return Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
    }
  }
}
