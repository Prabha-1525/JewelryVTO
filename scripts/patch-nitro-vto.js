#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgRoot = path.join(root, 'node_modules', '@alaneu', 'react-native-nitro-vto');
const patchRoot = path.join(__dirname, 'nitro-vto-android-patch');

if (!fs.existsSync(pkgRoot)) {
  process.exit(0);
}

const copies = [
  [
    'HybridNitroVtoViewSpec.kt',
    path.join(
      pkgRoot,
      'nitrogen/generated/android/kotlin/com/margelo/nitro/nitrovto/HybridNitroVtoViewSpec.kt',
    ),
  ],
  [
    'JHybridNitroVtoViewSpec.hpp',
    path.join(pkgRoot, 'nitrogen/generated/android/c++/JHybridNitroVtoViewSpec.hpp'),
  ],
  [
    'JHybridNitroVtoViewSpec.cpp',
    path.join(pkgRoot, 'nitrogen/generated/android/c++/JHybridNitroVtoViewSpec.cpp'),
  ],
  [
    'NitroVtoOnLoad.cpp',
    path.join(pkgRoot, 'nitrogen/generated/android/NitroVtoOnLoad.cpp'),
  ],
  [
    'JHybridNitroVtoViewStateUpdater.hpp',
    path.join(
      pkgRoot,
      'nitrogen/generated/android/c++/views/JHybridNitroVtoViewStateUpdater.hpp',
    ),
  ],
  [
    'JHybridNitroVtoViewStateUpdater.cpp',
    path.join(
      pkgRoot,
      'nitrogen/generated/android/c++/views/JHybridNitroVtoViewStateUpdater.cpp',
    ),
  ],
];

for (const [fileName, dest] of copies) {
  const src = path.join(patchRoot, fileName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Jewelry tracking patches target the installed 0.15.3 renderer. Fail loudly on
// incompatible upstream changes instead of silently shipping nose-anchored jewelry.
const coreRoot = path.join(pkgRoot, 'android/src/main/java/eu/alan/vto/core');
for (const file of ['JewelryPoseTracker.kt', 'JewelryAnchorTracker.kt', 'AREarringMathHelper.kt']) {
  fs.copyFileSync(path.join(patchRoot, file), path.join(coreRoot, file));
}

function patchFile(file, before, after) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`Nitro VTO jewelry patch no longer matches ${file}: ${before.slice(0, 90)}`);
  }
  fs.writeFileSync(file, source.replace(before, after));
}

patchFile(path.join(pkgRoot, 'android/build.gradle'),
  '  // ARCore\n',
  '  implementation("com.google.mediapipe:tasks-vision:0.10.26")\n\n  // ARCore\n');

const glassesFile = path.join(coreRoot, 'GlassesRenderer.kt');
patchFile(glassesFile,
  '    private var glassesAsset: FilamentAsset? = null',
  `    private var glassesAsset: FilamentAsset? = null
    private var jewelryTracker: JewelryAnchorTracker? = null
    val isJewelry: Boolean get() = jewelryTracker?.isJewelry == true`);
patchFile(glassesFile,
  '        cacheLensVerticalOffset(asset)\n        hide()',
  '        cacheLensVerticalOffset(asset)\n        jewelryTracker = JewelryAnchorTracker(engine, asset)\n        hide()');
patchFile(glassesFile,
  '        articulationEnabled = false\n        scene.removeEntities(asset.entities)',
  '        articulationEnabled = false\n        jewelryTracker = null\n        scene.removeEntities(asset.entities)');
patchFile(glassesFile,
  '    fun updateTransform(face: AugmentedFace, frame: Frame) {\n        glassesAsset?.let { asset ->',
  `    internal fun updateTransform(face: AugmentedFace, frame: Frame, body: JewelryPoseTracker.Sample? = null) {
        val jewelry = jewelryTracker
        if (jewelry?.isJewelry == true) {
            if (jewelry.update(face, frame, body, forwardOffset) && !hasDisplayedCurrentModel) {
                hasDisplayedCurrentModel = true
                onGlassesDisplayed?.invoke(currentModelUrl)
            }
            return
        }
        glassesAsset?.let { asset ->`);
patchFile(glassesFile,
  '    fun hide() {\n        glassesAsset?.let { asset ->',
  '    fun hide() {\n        jewelryTracker?.hide()\n        glassesAsset?.let { asset ->');
patchFile(glassesFile,
  '    fun setPreviewTransform() {\n        val asset = glassesAsset ?: return',
  '    fun setPreviewTransform() {\n        val asset = glassesAsset ?: return\n        jewelryTracker?.restorePreview()');

const rendererFile = path.join(coreRoot, 'VTORenderer.kt');
patchFile(rendererFile,
  '    private var hasFiredFaceTracked = false',
  `    private var hasFiredFaceTracked = false
    private val jewelryPoseTracker = JewelryPoseTracker(context)
    private var lastCameraTimestamp = 0L
    private var lastCameraUpdateMs = 0L
    private var trackedJewelryFace: AugmentedFace? = null`);
patchFile(rendererFile,
  '        // Filament\'s screen-space refraction',
  `        // Jewelry has no transmitting lenses: use the full calibrated projection,
        // preserving principal point, aspect crop and mirror exactly once.
        if (glassesRenderer.isJewelry) {
            filamentCamera.setCustomProjection(DoubleArray(16) { projMatrix[it].toDouble() }, near, far)
            filamentCamera.setModelMatrix(cameraModelMatrix)
            return
        }

        // Filament's screen-space refraction`);
patchFile(rendererFile,
  '    fun pause() {\n        choreographer.removeFrameCallback(frameCallback)\n    }',
  `    fun pause() {
        choreographer.removeFrameCallback(frameCallback)
        jewelryPoseTracker.reset()
        trackedJewelryFace = null
        if (initialized) {
            glassesRenderer.hide()
            faceOcclusionRenderer.hide()
        }
    }`);
patchFile(rendererFile,
  '        previewMode = enabled\n',
  '        previewMode = enabled\n        jewelryPoseTracker.reset()\n        trackedJewelryFace = null\n        if (initialized) glassesRenderer.hide()\n');
patchFile(rendererFile,
  '        this.modelUrl = modelUrl\n        glassesRenderer.switchModel(modelUrl)',
  '        this.modelUrl = modelUrl\n        jewelryPoseTracker.reset()\n        glassesRenderer.hide()\n        hasFiredFaceTracked = false\n        glassesRenderer.switchModel(modelUrl)');
patchFile(rendererFile,
  '            val frame = session.update()\n',
  `            val frame = session.update()
            val clockMs = android.os.SystemClock.elapsedRealtime()
            if (frame.timestamp != lastCameraTimestamp) {
                lastCameraTimestamp = frame.timestamp
                lastCameraUpdateMs = clockMs
            }
`);
patchFile(rendererFile,
  '                .filter { it.trackingState == TrackingState.TRACKING }',
  '                .filter { it.trackingState == TrackingState.TRACKING && clockMs - lastCameraUpdateMs <= 200 }');
patchFile(rendererFile,
  '                val face = faces.first()\n                if (!isHidden) {\n                    faceOcclusionRenderer.update(face)\n                    glassesRenderer.updateTransform(face, frame)',
  `                val face = faces.firstOrNull { it == trackedJewelryFace } ?: faces.first()
                if (face != trackedJewelryFace) {
                    jewelryPoseTracker.reset()
                    glassesRenderer.hide()
                    trackedJewelryFace = face
                }
                if (!isHidden) {
                    if (glassesRenderer.isJewelry) {
                        jewelryPoseTracker.submit(frame, face, session, surfaceViewRef?.display?.rotation ?: 0)
                    }
                    faceOcclusionRenderer.update(face, !glassesRenderer.isJewelry)
                    glassesRenderer.updateTransform(face, frame, jewelryPoseTracker.sample())`);
patchFile(rendererFile,
  '            } else {\n                faceOcclusionRenderer.hide()\n                glassesRenderer.hide()\n                debugRenderer.hide()\n            }',
  `            } else {
                jewelryPoseTracker.reset()
                trackedJewelryFace = null
                hasFiredFaceTracked = false
                faceOcclusionRenderer.hide()
                glassesRenderer.hide()
                debugRenderer.hide()
            }`);
patchFile(rendererFile,
  '            Log.e(TAG, "Render error: ${e.message}")',
  '            jewelryPoseTracker.reset()\n            glassesRenderer.hide()\n            faceOcclusionRenderer.hide()\n            Log.e(TAG, "Render error: ${e.message}")');
patchFile(rendererFile,
  '        debugRenderer.destroy()\n        glassesRenderer.destroy()',
  '        jewelryPoseTracker.close()\n        debugRenderer.destroy()\n        glassesRenderer.destroy()');

const occlusionFile = path.join(coreRoot, 'FaceOcclusionRenderer.kt');
patchFile(occlusionFile,
  '    fun update(face: AugmentedFace) {',
  '    fun update(face: AugmentedFace, mirrorForProjection: Boolean = true) {');
patchFile(occlusionFile,
  `        tempMatrix16[0] = -tempMatrix16[0]
        tempMatrix16[4] = -tempMatrix16[4]
        tempMatrix16[8] = -tempMatrix16[8]
        tempMatrix16[12] = -tempMatrix16[12]`,
  `        if (mirrorForProjection) {
            tempMatrix16[0] = -tempMatrix16[0]
            tempMatrix16[4] = -tempMatrix16[4]
            tempMatrix16[8] = -tempMatrix16[8]
            tempMatrix16[12] = -tempMatrix16[12]
        }`);
patchFile(occlusionFile,
  '        // Position the back plane behind the face. minZ is the most-negative',
  `        // The glasses back-plane spans the ears and clips jewelry. For jewelry,
        // use actual face depth plus per-ear visibility gating instead.
        if (!mirrorForProjection) {
            if (backPlaneInScene) {
                scene.removeEntity(backPlaneEntity)
                backPlaneInScene = false
            }
            return
        }

        // Position the back plane behind the face. minZ is the most-negative`);


// A mirrored projection reverses triangle winding. Without this, double-sided
// jewelry gets its back-face normal and dark back-face shading in live AR.
// The camera quad is already in screen space, so it must remain visible under
// either winding convention (unlike the projected jewelry and face mesh).
patchFile(path.join(coreRoot, 'CameraTextureRenderer.kt'),
  '        cameraMaterialInstance = cameraMaterial.createInstance()\n',
  `        cameraMaterialInstance = cameraMaterial.createInstance()
        cameraMaterialInstance.setCullingMode(Material.CullingMode.NONE)
`);
patchFile(rendererFile,
  '        Matrix.invertM(cameraModelMatrix, 0, viewMatrix, 0)\n',
  `        Matrix.invertM(cameraModelMatrix, 0, viewMatrix, 0)
        view.setFrontFaceWindingInverted(glassesRenderer.isJewelry && projMatrix[0] * projMatrix[5] < 0f)
`);
patchFile(rendererFile,
  '            previewCamera.applyTo(filamentCamera, aspect)\n',
  `            previewCamera.applyTo(filamentCamera, aspect)
            view.setFrontFaceWindingInverted(false)
`);
