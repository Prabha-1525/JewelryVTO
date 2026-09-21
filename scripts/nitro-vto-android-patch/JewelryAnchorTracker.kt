package eu.alan.vto.core

import android.opengl.Matrix
import android.os.SystemClock
import android.util.Log
import com.google.android.filament.Box
import com.google.android.filament.Engine
import com.google.android.filament.gltfio.FilamentAsset
import com.google.ar.core.AugmentedFace
import com.google.ar.core.Frame
import com.google.ar.core.Pose
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.sqrt

/** Independent attachment transforms for the named nodes produced by generate_ornament_glb.py. */
internal class JewelryAnchorTracker(private val engine: Engine, private val asset: FilamentAsset) {
    private class Anchor(
        val entity: Int,
        val name: String,
        val rest: FloatArray,
        val halfWidth: Float,
        val halfHeight: Float,
    ) {
        var pose: Pose? = null
        var scale = 1f
        var timestamp = 0L
        var visible = false
    }

    private val anchors = mutableListOf<Anchor>()
    private val earringMath = AREarringMathHelper()
    private val matrix = FloatArray(16)
    val isJewelry: Boolean get() = anchors.isNotEmpty()

    init {
        val tm = engine.transformManager
        for (name in arrayOf("JewelryEarNegativeX", "JewelryEarPositiveX",
            "JewelryEarNegativeXStud", "JewelryEarPositiveXStud", "JewelryNecklace")) {
            val entity = asset.getFirstEntityByName(name)
            if (entity == 0) continue
            val instance = tm.getInstance(entity)
            val renderable = engine.renderableManager.getInstance(entity)
            if (instance == 0 || renderable == 0 || entity == asset.root) continue
            // Filament inserts an instance root between the asset root and glTF nodes.
            // Accumulate the authored transform, then attach named leaves directly to
            // the asset root so world-space tracking and preview restoration agree.
            val rest = FloatArray(16)
            Matrix.setIdentityM(rest, 0)
            val local = FloatArray(16)
            val combined = FloatArray(16)
            var current = entity
            while (current != 0 && current != asset.root) {
                val currentInstance = tm.getInstance(current)
                tm.getTransform(currentInstance, local)
                Matrix.multiplyMM(combined, 0, local, 0, rest, 0)
                combined.copyInto(rest)
                current = tm.getParent(currentInstance)
            }
            if (current != asset.root) continue
            tm.setParent(instance, tm.getInstance(asset.root))
            tm.setTransform(instance, rest)
            val bounds = Box(0f, 0f, 0f, 0f, 0f, 0f)
            engine.renderableManager.getAxisAlignedBoundingBox(renderable, bounds)
            anchors.add(Anchor(entity, name, rest, bounds.halfExtent[0], bounds.halfExtent[1]))
            Log.d("JewelryTracking", "Registered attachment: $name")
        }
    }

    fun reset() {
        for (anchor in anchors) {
            anchor.pose = null
            anchor.timestamp = 0L
        }
    }

    fun restorePreview() {
        reset()
        for (anchor in anchors) {
            engine.transformManager.setTransform(engine.transformManager.getInstance(anchor.entity), anchor.rest)
            anchor.visible = false
        }
    }

    fun update(face: AugmentedFace, frame: Frame, body: JewelryPoseTracker.Sample?, forwardOffset: Float): Boolean {
        if (!isJewelry) return false
        Matrix.setIdentityM(matrix, 0)
        engine.transformManager.setTransform(engine.transformManager.getInstance(asset.root), matrix)
        val mesh = face.meshVertices
        if (mesh.limit() < 468 * 3) { hide(); return false }
        val a = MatrixUtils.getPositionForVertice(234, face)
        val b = MatrixUtils.getPositionForVertice(454, face)
        val faceWidth = JewelryPoseTracker.distance(a, b)
        val cameraLocal = face.centerPose.inverse().transformPoint(frame.camera.pose.translation)
        val viewDirection = normalized(cameraLocal)
        val depth = -frame.camera.pose.inverse().transformPoint(face.centerPose.translation)[2]
        if (!faceWidth.isFinite() || faceWidth !in 0.075f..0.23f || depth !in 0.15f..2.0f ||
            viewDirection == null || viewDirection[2] < 0.25f) {
            hide(); return false
        }
        val fit = (faceWidth / 0.14f).coerceIn(0.7f, 1.5f)
        val earPoints = if (anchors.any { it.name != "JewelryNecklace" }) (0 until 468).map {
            val v = MatrixUtils.getPositionForVertice(it, face)
            AREarringMathHelper.Vec3(v[0], v[1], v[2])
        } else emptyList()
        val down = face.centerPose.inverse().rotateVector(floatArrayOf(0f, -1f, 0f))
        val ears = if (earPoints.isNotEmpty()) earringMath.fromFaceLocal(earPoints,
            AREarringMathHelper.Vec3(viewDirection[0], viewDirection[1], viewDirection[2]),
            AREarringMathHelper.Vec3(down[0], down[1], down[2])) else null
        var displayed = false
        for (anchor in anchors) {
            if (anchor.name == "JewelryNecklace") {
                displayed = updateNecklace(anchor, face, frame, body, forwardOffset) || displayed
                continue
            }
            val sign = if (anchor.name.contains("Negative")) -1f else 1f
            val use234 = a[0] * sign > b[0] * sign
            val attachment = if (use234) ears?.at234 else ears?.at454
            if (attachment == null || !attachment.visible) { hide(anchor); continue }
            val local = attachment.position.array()
            // The glasses UI offset must not pull ear attachments toward the cheeks.
            val world = face.centerPose.transformPoint(local)
            val target = Pose(world, face.centerPose.rotationQuaternion)
            val pivot = if (anchor.name.endsWith("Stud")) 0f else anchor.halfHeight
            // The source assets share a 46 mm plane. A stud should be about
            // 12 mm, not the size of a dangling earring. Perspective is already
            // applied by ARCore: never scale by image face height a second time.
            val modelFit = fit * if (anchor.name.endsWith("Stud")) (0.012f / 0.046f) else 1f
            apply(anchor, target, modelFit, pivot, frame.timestamp)
            displayed = true
        }
        return displayed
    }

    private fun updateNecklace(anchor: Anchor, face: AugmentedFace, frame: Frame, body: JewelryPoseTracker.Sample?, offset: Float): Boolean {
        val left = body?.leftShoulder
        val right = body?.rightShoulder
        if (body == null || left == null || right == null ||
            SystemClock.elapsedRealtime() - body.receivedAt > JewelryPoseTracker.MAX_RESULT_AGE_MS ||
            SystemClock.elapsedRealtime() - body.capturedAt > JewelryPoseTracker.MAX_CAPTURE_AGE_MS ||
            JewelryPoseTracker.distance(body.facePose.translation, face.centerPose.translation) > 0.18f) {
            hide(anchor); return false
        }
        val delta = minus(left, right)
        val span = length(delta)
        if (!span.isFinite() || span !in 0.18f..0.65f || anchor.halfWidth <= 0f) {
            hide(anchor); return false
        }
        val x = normalized(delta) ?: run { hide(anchor); return false }
        val z = normalized(cross(x, body.up)) ?: run { hide(anchor); return false }
        val y = normalized(cross(z, x)) ?: run { hide(anchor); return false }
        // Shoulder landmarks sit on the outer deltoids, below the neck attachment.
        // Raise the top edge by 20% of shoulder span (about 7–9 cm for adults).
        // This is body-relative, so it scales with fit instead of being a screen offset.
        // Rebase the delayed body position by current face-center translation only.
        // This follows distance/lateral motion without applying head yaw to the torso.
        val motion = minus(face.centerPose.translation, body.facePose.translation)
        val center = FloatArray(3) { (left[it] + right[it]) * 0.5f + motion[it] + y[it] * span * NECK_BASE_LIFT + z[it] * (0.015f + offset) }
        val pose = Pose(center, quaternion(x, y, z))
        val scale = (span * 0.46f / (anchor.halfWidth * 2f)).coerceIn(0.6f, 2.3f)
        apply(anchor, pose, scale, anchor.halfHeight, frame.timestamp)
        return true
    }

    private fun apply(anchor: Anchor, target: Pose, scale: Float, pivotY: Float, timestamp: Long) {
        val previous = anchor.pose
        if (previous == null || timestamp - anchor.timestamp > 250_000_000L || timestamp < anchor.timestamp) {
            anchor.pose = target
            anchor.scale = scale
        } else if (timestamp > anchor.timestamp) {
            val dt = ((timestamp - anchor.timestamp) / 1_000_000_000f).coerceIn(0.001f, 0.1f)
            val speed = JewelryPoseTracker.distance(previous.translation, target.translation) / dt
            val q1 = previous.rotationQuaternion
            val q2 = target.rotationQuaternion
            val dot = abs(q1.indices.sumOf { (q1[it] * q2[it]).toDouble() }).toFloat().coerceIn(0f, 1f)
            val turn = (1f - dot) / dt
            // Time-based low pass: suppress stationary jitter, respond quickly during movement.
            val cutoff = (5f + speed * 22f + turn * 15f).coerceIn(5f, 30f)
            val amount = 1f - exp((-2f * Math.PI.toFloat() * cutoff * dt).toDouble()).toFloat()
            anchor.pose = Pose.makeInterpolated(previous, target, amount)
            anchor.scale += (scale - anchor.scale) * amount
        }
        anchor.timestamp = timestamp
        anchor.pose!!.toMatrix(matrix, 0)
        Matrix.scaleM(matrix, 0, anchor.scale, anchor.scale, anchor.scale)
        Matrix.translateM(matrix, 0, 0f, -pivotY, 0f)
        engine.transformManager.setTransform(engine.transformManager.getInstance(anchor.entity), matrix)
        if (!anchor.visible) Log.d("JewelryTracking", "${anchor.name}: tracking")
        anchor.visible = true
    }

    fun hide() { anchors.forEach { hide(it) } }

    private fun hide(anchor: Anchor) {
        engine.transformManager.setTransform(engine.transformManager.getInstance(anchor.entity), MatrixUtils.createHideMatrix())
        anchor.pose = null
        anchor.timestamp = 0L
        if (anchor.visible) Log.d("JewelryTracking", "${anchor.name}: hidden (unreliable landmarks)")
        anchor.visible = false
    }

    companion object {
        private const val NECK_BASE_LIFT = 0.20f
        private fun minus(a: FloatArray, b: FloatArray) = FloatArray(3) { a[it] - b[it] }
        private fun length(v: FloatArray) = sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
        private fun normalized(v: FloatArray): FloatArray? {
            val length = length(v)
            return if (!length.isFinite() || length < 0.0001f) null else FloatArray(3) { v[it] / length }
        }
        private fun cross(a: FloatArray, b: FloatArray) = floatArrayOf(
            a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
        )
        private fun quaternion(x: FloatArray, y: FloatArray, z: FloatArray): FloatArray {
            val trace = x[0] + y[1] + z[2]
            return if (trace > 0f) {
                val s = sqrt(trace + 1f) * 2f
                floatArrayOf((y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, s / 4f)
            } else if (x[0] > y[1] && x[0] > z[2]) {
                val s = sqrt(1f + x[0] - y[1] - z[2]) * 2f
                floatArrayOf(s / 4f, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s)
            } else if (y[1] > z[2]) {
                val s = sqrt(1f + y[1] - x[0] - z[2]) * 2f
                floatArrayOf((y[0] + x[1]) / s, s / 4f, (z[1] + y[2]) / s, (z[0] - x[2]) / s)
            } else {
                val s = sqrt(1f + z[2] - x[0] - y[1]) * 2f
                floatArrayOf((z[0] + x[2]) / s, (z[1] + y[2]) / s, s / 4f, (x[1] - y[0]) / s)
            }
        }
    }
}
