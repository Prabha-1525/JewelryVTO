package eu.alan.vto.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.Image
import android.os.SystemClock
import android.util.Log
import com.google.ar.core.AugmentedFace
import com.google.ar.core.Frame
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.exceptions.NotYetAvailableException
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.roundToInt

/** Uses ARCore's own CPU image: never opens a competing camera or sends pixels to JS. */
internal class JewelryPoseTracker(private val context: Context) {
    data class Sample(
        val capturedAt: Long,
        val receivedAt: Long,
        val facePose: Pose,
        val nose: FloatArray,
        val leftShoulder: FloatArray?,
        val rightShoulder: FloatArray?,
        val leftEar: FloatArray?,
        val rightEar: FloatArray?,
        val up: FloatArray,
    )

    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private val generation = AtomicLong(0)
    private var detector: PoseLandmarker? = null // worker-owned, including close
    private var reportState: String? = null
    private var lastTimingReport = 0L
    private var useGpu = preferGpu
    private var slowGpuFrames = 0
    private var lastSubmitted = 0L
    private var lastTimestamp = -1L
    private var sensorRotation: Int? = null
    @Volatile private var closed = false
    @Volatile private var latest: Sample? = null

    fun sample(): Sample? = latest?.takeIf {
        SystemClock.elapsedRealtime() - it.receivedAt <= MAX_RESULT_AGE_MS &&
            SystemClock.elapsedRealtime() - it.capturedAt <= MAX_CAPTURE_AGE_MS
    }

    fun reset() {
        generation.incrementAndGet()
        latest = null
    }

    fun submit(frame: Frame, face: AugmentedFace, session: Session, displayRotation: Int) {
        val now = SystemClock.elapsedRealtime()
        if (closed || now - lastSubmitted < 50 || !busy.compareAndSet(false, true)) return
        lastSubmitted = now
        val token = generation.get()
        var acquired: Image? = null
        try {
            val image = frame.acquireCameraImage()
            acquired = image
            val intrinsics = frame.camera.imageIntrinsics
            val focal = intrinsics.focalLength
            val principal = intrinsics.principalPoint
            val dimensions = intrinsics.imageDimensions
            val cameraPose = frame.camera.pose
            val facePose = face.centerPose
            val nose = facePose.transformPoint(MatrixUtils.getPositionForVertice(1, face))
            val noseDepth = -cameraPose.inverse().transformPoint(nose)[2]
            val up = frame.camera.displayOrientedPose.rotateVector(floatArrayOf(0f, 1f, 0f))
            val sensor = sensorRotation ?: run {
                val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                (manager.getCameraCharacteristics(session.cameraConfig.cameraId)
                    .get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 0).also { sensorRotation = it }
            }
            // ARCore uses the front camera. Undo this rotation on output before unprojection.
            val rotation = (sensor + displayRotation * 90) % 360
            val timestamp = max(lastTimestamp + 1, frame.timestamp / 1_000_000)
            lastTimestamp = timestamp
            worker.execute {
                var raw: Bitmap? = null
                var upright: Bitmap? = null
                try {
                    // Release the scarce ARCore image before running inference.
                    raw = try { toBitmap(image) } finally { image.close() }
                    val convertedAt = SystemClock.elapsedRealtime()
                    if (closed || token != generation.get()) return@execute
                    val source = raw!!
                    upright = if (rotation == 0) source else Bitmap.createBitmap(
                        source, 0, 0, source.width, source.height,
                        Matrix().apply { postRotate(rotation.toFloat()) }, false,
                    )
                    // Create, invoke and close the GPU task on this same dedicated thread.
                    val task = detector ?: run {
                        fun create(delegate: Delegate) = PoseLandmarker.createFromOptions(
                            context,
                            PoseLandmarker.PoseLandmarkerOptions.builder()
                                .setBaseOptions(BaseOptions.builder()
                                    .setModelAssetPath("pose_landmarker_lite.task")
                                    .setDelegate(delegate).build())
                                .setRunningMode(RunningMode.VIDEO)
                                .setNumPoses(1)
                                .setMinPoseDetectionConfidence(0.65f)
                                .setMinPosePresenceConfidence(0.65f)
                                .setMinTrackingConfidence(0.65f)
                                .build(),
                        )
                        if (useGpu) {
                            try {
                                create(Delegate.GPU).also { Log.d("JewelryTracking", "Pose delegate: GPU") }
                            } catch (gpuError: Exception) {
                                useGpu = false
                                preferGpu = false
                                Log.w("JewelryTracking", "GPU unavailable; using CPU", gpuError)
                                create(Delegate.CPU)
                            }
                        } else create(Delegate.CPU).also { Log.d("JewelryTracking", "Pose delegate: CPU") }
                    }.also { detector = it }
                    val mpImage = BitmapImageBuilder(upright!!).build()
                    val inferenceStarted = SystemClock.elapsedRealtime()
                    val result = try { task.detectForVideo(mpImage, timestamp) } finally { mpImage.close() }
                    val finishedAt = SystemClock.elapsedRealtime()
                    if (finishedAt - lastTimingReport > 5000) {
                        Log.d("JewelryTracking", "Pose latency=${finishedAt - now}ms conversion=${convertedAt - now}ms inference=${finishedAt - inferenceStarted}ms")
                        lastTimingReport = finishedAt
                    }
                    val points = result.landmarks().firstOrNull()
                    val world = result.worldLandmarks().firstOrNull()
                    var next: Sample? = null
                    if (points != null && world != null && points.size >= 25 && world.size >= 25 &&
                        noseDepth in 0.15f..2.5f) {
                        fun project(index: Int, depth: Float): FloatArray? {
                            val point = points[index]
                            if (point.visibility().orElse(0f) < 0.65f ||
                                point.presence().orElse(0f) < 0.65f ||
                                point.x() !in 0.01f..0.99f || point.y() !in 0.01f..0.99f ||
                                !depth.isFinite() || depth !in 0.15f..2.5f) return null
                            val x: Float
                            val y: Float
                            when (rotation) {
                                90 -> { x = point.y(); y = 1f - point.x() }
                                180 -> { x = 1f - point.x(); y = 1f - point.y() }
                                270 -> { x = 1f - point.y(); y = point.x() }
                                else -> { x = point.x(); y = point.y() }
                            }
                            return cameraPose.transformPoint(floatArrayOf(
                                (x * dimensions[0] - principal[0]) / focal[0] * depth,
                                -(y * dimensions[1] - principal[1]) / focal[1] * depth,
                                -depth,
                            )).takeIf { p -> p.all { it.isFinite() } }
                        }
                        val poseNose = project(0, noseDepth)
                        // Do not combine ARCore's face with another person's body.
                        if (poseNose != null && distance(poseNose, nose) < 0.045f) {
                            fun bodyPoint(index: Int): FloatArray? {
                                val delta = world[index].z() - world[0].z()
                                if (!delta.isFinite() || delta !in -0.2f..0.4f) return null
                                return project(index, noseDepth + delta)
                            }
                            val left = bodyPoint(11)
                            val right = bodyPoint(12)
                            val leftHip = bodyPoint(23)
                            val rightHip = bodyPoint(24)
                            val torsoUp = if (left != null && right != null && leftHip != null && rightHip != null) {
                                val axis = FloatArray(3) { (left[it] + right[it] - leftHip[it] - rightHip[it]) * 0.5f }
                                val length = distance(axis, floatArrayOf(0f, 0f, 0f))
                                if (length in 0.15f..0.8f) FloatArray(3) { axis[it] / length } else up
                            } else up
                            next = Sample(now, finishedAt, facePose, nose,
                                left, right, bodyPoint(7), bodyPoint(8), torsoUp)
                        }
                    }
                    if (!closed && token == generation.get()) {
                        val previous = sample()
                        latest = when {
                            // A different/missing face must never borrow a cached body.
                            next == null -> null
                            next.leftShoulder == null || next.rightShoulder == null -> previous
                            else -> smoothBody(previous, next)
                        }
                        val state = "Pose detected=${points != null}, matched=${next != null}, shoulders=${next?.leftShoulder != null && next.rightShoulder != null}"
                        if (state != reportState) {
                            Log.d("JewelryTracking", state)
                            reportState = state
                        }
                    }
                    // Some mobile GPU drivers are slower than CPU for this small model.
                    // Switch once after measured inference (excluding initialization) is slow.
                    if (useGpu) {
                        slowGpuFrames = if (finishedAt - inferenceStarted > 100) slowGpuFrames + 1 else 0
                        if (slowGpuFrames >= 3) {
                            task.close()
                            detector = null
                            useGpu = false
                            preferGpu = false
                            Log.d("JewelryTracking", "Switching slow GPU delegate to CPU")
                        }
                    }
                } catch (error: Exception) {
                    if (token == generation.get()) latest = null
                    if (useGpu) {
                        detector?.close()
                        detector = null
                        useGpu = false
                        preferGpu = false
                    }
                    Log.w("JewelryTracking", "Pose inference unavailable", error)
                } finally {
                    if (upright !== raw) upright?.recycle()
                    raw?.recycle()
                    busy.set(false)
                }
            }
            acquired = null // worker owns the image
        } catch (_: NotYetAvailableException) {
            busy.set(false)
        } catch (error: Exception) {
            latest = null
            busy.set(false)
            Log.w("JewelryTracking", "Cannot acquire pose frame", error)
        } finally {
            acquired?.close()
        }
    }

    /** Filter once per inference, in coordinates relative to the captured face.
     * Rebase the previous body before interpolation so real translation stays
     * responsive; only noisy shoulder geometry, scale and torso axes are damped.
     * A held sample keeps its original timestamps and expires normally.
     */
    private fun smoothBody(previous: Sample?, next: Sample): Sample {
        if (previous?.leftShoulder == null || previous.rightShoulder == null ||
            distance(previous.facePose.translation, next.facePose.translation) > 0.18f) return next
        val dt = ((next.capturedAt - previous.capturedAt) / 1000f).coerceIn(0.001f, 0.35f)
        val amount = 1f - exp(-2f * Math.PI.toFloat() * 1.8f * dt)
        val motion = FloatArray(3) { next.facePose.translation[it] - previous.facePose.translation[it] }
        fun blend(old: FloatArray, current: FloatArray) = FloatArray(3) {
            val rebased = old[it] + motion[it]
            rebased + (current[it] - rebased) * amount
        }
        val up = FloatArray(3) { previous.up[it] + (next.up[it] - previous.up[it]) * amount }
        val upLength = distance(up, floatArrayOf(0f, 0f, 0f))
        return next.copy(
            leftShoulder = blend(previous.leftShoulder, next.leftShoulder!!),
            rightShoulder = blend(previous.rightShoulder, next.rightShoulder!!),
            up = if (upLength > 0.001f) FloatArray(3) { up[it] / upLength } else next.up,
        )
    }

    fun close() {
        closed = true
        reset()
        worker.execute { detector?.close(); detector = null }
        worker.shutdown()
    }

    companion object {
        @Volatile private var preferGpu = false
        // Allow one inference interval between results, with a separate hard limit
        // on capture age. Rendering compensates translation using the current face.
        const val MAX_RESULT_AGE_MS = 350L
        const val MAX_CAPTURE_AGE_MS = 650L

        fun distance(a: FloatArray, b: FloatArray): Float = kotlin.math.sqrt(
            (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) +
                (a[2] - b[2]) * (a[2] - b[2]),
        )

        /** YUV_420_888, including padded rows and interleaved chroma on Samsung devices. */
        private fun toBitmap(image: Image): Bitmap {
            val scale = minOf(1f, 256f / max(image.width, image.height))
            val width = max(1, (image.width * scale).roundToInt())
            val height = max(1, (image.height * scale).roundToInt())
            val pixels = IntArray(width * height)
            val planes = image.planes
            // Bulk-copy each plane once. Per-pixel DirectByteBuffer.get crosses into
            // native memory ~150,000 times per frame and was costly on the device.
            fun planeBytes(index: Int): ByteArray {
                val buffer = planes[index].buffer.duplicate()
                return ByteArray(buffer.remaining()).also { buffer.get(it) }
            }
            val yBytes = planeBytes(0)
            val uBytes = planeBytes(1)
            val vBytes = planeBytes(2)
            // Cache Image/Plane JNI properties outside the per-pixel loop.
            val sourceWidth = image.width
            val sourceHeight = image.height
            val rows = IntArray(3) { planes[it].rowStride }
            val strides = IntArray(3) { planes[it].pixelStride }
            for (y in 0 until height) for (x in 0 until width) {
                val sx = x * sourceWidth / width
                val sy = y * sourceHeight / height
                val luma = (yBytes[sy * rows[0] + sx * strides[0]].toInt() and 255) - 16
                val u = (uBytes[sy / 2 * rows[1] + sx / 2 * strides[1]].toInt() and 255) - 128
                val v = (vBytes[sy / 2 * rows[2] + sx / 2 * strides[2]].toInt() and 255) - 128
                val c = max(0, luma) * 298
                val r = ((c + 409 * v + 128) shr 8).coerceIn(0, 255)
                val g = ((c - 100 * u - 208 * v + 128) shr 8).coerceIn(0, 255)
                val b = ((c + 516 * u + 128) shr 8).coerceIn(0, 255)
                pixels[y * width + x] = (255 shl 24) or (r shl 16) or (g shl 8) or b
            }
            return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
        }
    }
}
