package eu.alan.vto.core

import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.sqrt

/**
 * Earring attachment geometry, independent of filtering and rendering.
 *
 * Face-mesh points do not measure the piercing itself: depth/outward/drop are
 * anatomical estimates expressed as fractions of face dimensions, not pixels.
 * Use actual ear landmarks or user calibration when piercing accuracy is needed.
 * Missing/degenerate geometry returns null; never reuse its last result indefinitely.
 */
class AREarringMathHelper(val config: Config = Config()) {
    data class Config(
        val backwardDepth: Float = 0.085f,
        val outwardWidth: Float = 0.055f,
        val lobeDropHeight: Float = 0.055f,
        val yawOutwardWidth: Float = 0.025f,
        val farEarCutoff: Float = 0.42f,
    ) {
        init {
            require(listOf(backwardDepth, outwardWidth, lobeDropHeight, yawOutwardWidth).all { it.isFinite() && it in 0f..0.3f })
            require(farEarCutoff.isFinite() && farEarCutoff in 0.1f..0.9f)
        }
    }
    data class Vec3(val x: Float, val y: Float, val z: Float) {
        operator fun plus(b: Vec3) = Vec3(x + b.x, y + b.y, z + b.z)
        operator fun minus(b: Vec3) = Vec3(x - b.x, y - b.y, z - b.z)
        operator fun times(s: Float) = Vec3(x * s, y * s, z * s)
        fun dot(b: Vec3) = x * b.x + y * b.y + z * b.z
        fun length() = sqrt(dot(this))
        fun unit(): Vec3? = length().let { if (it.isFinite() && it > 1e-6f) this * (1f / it) else null }
        fun array() = floatArrayOf(x, y, z)
        fun finite() = x.isFinite() && y.isFinite() && z.isFinite()
    }
    data class Attachment(val position: Vec3, val visible: Boolean, val perspectiveScale: Float)
    /** Side names identify mesh indices; they do not change when a preview is mirrored. */
    data class Result(val at234: Attachment, val at454: Attachment, val faceWidth: Float, val yawRadians: Float)

    /**
     * Returns MediaPipe coordinates: x/image width, y/image height, z/image width.
     * Input must be the unmirrored inference image; apply the preview's crop,
     * rotation and mirror ONCE downstream. These coordinates are NOT meters.
     *
     * y is first converted to image-width units so portrait aspect ratio cannot
     * corrupt the nose-to-head direction, distances, or vertical drop.
     * For a screen-space overlay, multiply returned x/y by image dimensions.
     * For a perspective 3D renderer, use toCameraSpace with calibrated depth.
     */
    fun fromNormalizedLandmarks(landmarks: List<NormalizedLandmark>, imageWidth: Int, imageHeight: Int): Result? {
        if (landmarks.size < 468 || imageWidth <= 0 || imageHeight <= 0) return null
        val aspect = imageHeight.toFloat() / imageWidth
        val points = landmarks.take(468).map { Vec3(it.x(), it.y() * aspect, it.z()) }
        // Camera lies toward negative z in MediaPipe's image convention.
        val result = solve(points, Vec3(0f, 0f, -1f), Vec3(0f, 1f, 0f)) ?: return null
        fun convert(a: Attachment) = a.copy(position = a.position.copy(y = a.position.y / aspect))
        return result.copy(at234 = convert(result.at234), at454 = convert(result.at454))
    }

    /**
     * ARCore adapter: points, camera direction and gravity are all face-local,
     * in meters, with +Y up and the head pointing toward +Z. ARCore handles
     * perspective automatically; do NOT multiply model size by perspectiveScale.
     */
    fun fromFaceLocal(points: List<Vec3>, cameraDirection: Vec3, gravityDown: Vec3): Result? =
        solve(points, cameraDirection, gravityDown)

    /**
     * Convert normalized image coordinates to OpenGL camera space (+Y up, -Z
     * forward). zAtReferenceMeters must come from a depth estimate/calibration;
     * relative landmark z alone cannot recover absolute camera distance.
     * Intrinsics and dimensions must describe the same unrotated inference image.
     * Apply the camera-to-world pose after this function when rendering in world space.
     */
    fun toCameraSpace(position: Vec3, referenceZ: Float, zAtReferenceMeters: Float,
        imageWidth: Int, imageHeight: Int, fx: Float, fy: Float, cx: Float, cy: Float): Vec3? {
        if (!position.finite() || !referenceZ.isFinite() || imageWidth <= 0 || imageHeight <= 0 ||
            !listOf(fx, fy, cx, cy, zAtReferenceMeters).all { it.isFinite() } ||
            fx <= 0f || fy <= 0f || zAtReferenceMeters <= 0f) return null
        val metersPerWidth = imageWidth * zAtReferenceMeters / fx
        val depth = zAtReferenceMeters + (position.z - referenceZ) * metersPerWidth
        if (depth <= 0f || !depth.isFinite()) return null
        return Vec3((position.x * imageWidth - cx) * depth / fx,
            -(position.y * imageHeight - cy) * depth / fy, -depth)
    }

    private fun solve(p: List<Vec3>, camera: Vec3, gravity: Vec3): Result? {
        if (p.size < 468 || p.take(468).any { !it.finite() }) return null
        val width = (p[454] - p[234]).length()
        if (width < 1e-5f) return null
        val side = (p[454] - p[234]).unit() ?: return null
        val center = (p[234] + p[454]) * 0.5f
        // Remove lateral noise without discarding pitch. Nose bridge is in front
        // of the cheek midpoint; subtracting this vector moves behind the face.
        val nose = p[6] - center
        val forward = (nose - side * nose.dot(side)).unit() ?: return null
        val view = camera.unit() ?: return null
        val down = gravity.unit() ?: return null
        val frontal = forward.dot(view)
        val turn = side.dot(view).coerceIn(-1f, 1f)
        val eyeCenter = (p[33] + p[263]) * 0.5f
        fun projectedDistance(a: Vec3): Float {
            val d = a - eyeCenter
            return (d - view * d.dot(view)).length()
        }
        val d234 = projectedDistance(p[234])
        val d454 = projectedDistance(p[454])
        val total = d234 + d454
        if (total < width * 0.1f) return null
        // Face bounding-box extent along gravity: scales with image size in the
        // normalized path, stays metric in ARCore. Bound pitch-induced changes.
        val extent = p.take(468).map { it.dot(down) }
        val height = (extent.maxOrNull()!! - extent.minOrNull()!!).coerceIn(width * 0.8f, width * 1.8f)
        fun anchor(cheek: Int, jaw: Int, sign: Float, eyeDistance: Float): Attachment {
            val near = sign * turn
            val ratio = (2f * eyeDistance / total).coerceIn(0.8f, 1.2f)
            val outward = width * (config.outwardWidth + config.yawOutwardWidth * near) * ratio
            // Favor cheek height over the lower jaw. A small gravity drop places
            // the hook on the lobe; the hanging model's top pivot does the rest.
            val base = p[cheek] * 0.8f + p[jaw] * 0.2f
            val position = base + side * (sign * outward) - forward * (width * config.backwardDepth) + down * (height * config.lobeDropHeight)
            return Attachment(position, frontal > 0.25f && near > -config.farEarCutoff, ratio)
        }
        return Result(anchor(234, 132, -1f, d234), anchor(454, 361, 1f, d454), width, atan2(turn, frontal))
    }
}
