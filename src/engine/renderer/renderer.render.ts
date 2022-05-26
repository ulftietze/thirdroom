import {
  ACESFilmicToneMapping,
  Camera,
  Matrix4,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Quaternion,
  Scene,
  sRGBEncoding,
  Vector3,
  WebGLRenderer,
} from "three";

import { createCursorBuffer, addViewMatrix4, addView } from "../allocator/CursorBuffer";
import { getReadBufferIndex, swapReadBuffer, TripleBuffer } from "../allocator/TripleBuffer";
import { clamp } from "../component/transform";
import { maxEntities, tickRate } from "../config.common";
import { GLTFResourceLoader } from "../gltf/GLTFResourceLoader";
import { BaseThreadContext, defineModule, getModule } from "../module/module.common";
import { CameraResourceLoader } from "../resources/CameraResourceLoader";
import { GeometryResourceLoader } from "../resources/GeometryResourceLoader";
import { LightResourceLoader } from "../resources/LightResourceLoader";
import { MaterialResourceLoader } from "../resources/MaterialResourceLoader";
import { MeshResourceLoader } from "../resources/MeshResourceLoader";
import {
  createResourceManager,
  registerResourceLoader,
  ResourceManager,
  ResourceState,
} from "../resources/ResourceManager";
import { SceneResourceLoader } from "../resources/SceneResourceLoader";
import { TextureResourceLoader } from "../resources/TextureResourceLoader";
import { StatsBuffer } from "../stats/stats.common";
import { StatsModule } from "../stats/stats.render";
import {
  AddRenderableMessage,
  PostMessageTarget,
  RemoveRenderableMessage,
  RenderableMessages,
  RenderWorkerResizeMessage,
  SetActiveCameraMessage,
  SetActiveSceneMessage,
  StartRenderWorkerMessage,
  WorkerMessageType,
} from "../WorkerMessage";

export interface TransformView {
  worldMatrix: Float32Array[];
  worldMatrixNeedsUpdate: Uint8Array;
}

export interface RenderableView {
  resourceId: Uint32Array;
  interpolate: Uint8Array;
  visible: Uint8Array;
}

export interface Renderable {
  object?: Object3D;
  helper?: Object3D;
  eid: number;
  resourceId: number;
}

export type RenderThreadSystem = (state: RenderThreadState) => void;

export interface IInitialRenderThreadState {
  statsBuffer: StatsBuffer;
  resourceManagerBuffer: SharedArrayBuffer;
  renderableTripleBuffer: TripleBuffer;
  gameWorkerMessageTarget: MessagePort;
  initialCanvasWidth: number;
  initialCanvasHeight: number;
  canvasTarget: HTMLElement;
}

export interface RenderThreadState extends BaseThreadContext {
  elapsed: number;
  dt: number;
  gameWorkerMessageTarget: PostMessageTarget;
  preSystems: RenderThreadSystem[];
  postSystems: RenderThreadSystem[];
}

interface RendererModuleState {
  needsResize: boolean;
  canvasWidth: number;
  canvasHeight: number;
  scene: Object3D;
  camera: Camera;
  renderer: WebGLRenderer;
  resourceManager: ResourceManager;
  renderableMessageQueue: RenderableMessages[];
  renderables: Renderable[];
  objectToEntityMap: Map<Object3D, number>;
  renderableIndices: Map<number, number>;
  renderableTripleBuffer: TripleBuffer;
  transformViews: TransformView[];
  renderableViews: RenderableView[];
}

export const RendererModule = defineModule<RenderThreadState, IInitialRenderThreadState, RendererModuleState>({
  create({
    resourceManagerBuffer,
    gameWorkerMessageTarget,
    initialCanvasWidth,
    initialCanvasHeight,
    canvasTarget,
    renderableTripleBuffer,
  }) {
    const scene = new Scene();

    // TODO: initialize playerRig from GameWorker
    const camera = new PerspectiveCamera(70, initialCanvasWidth / initialCanvasHeight, 0.1, 1000);
    camera.position.y = 1.6;

    const resourceManager = createResourceManager(resourceManagerBuffer, gameWorkerMessageTarget);
    registerResourceLoader(resourceManager, SceneResourceLoader);
    registerResourceLoader(resourceManager, GeometryResourceLoader);
    registerResourceLoader(resourceManager, TextureResourceLoader);
    registerResourceLoader(resourceManager, MaterialResourceLoader);
    registerResourceLoader(resourceManager, MeshResourceLoader);
    registerResourceLoader(resourceManager, CameraResourceLoader);
    registerResourceLoader(resourceManager, LightResourceLoader);
    registerResourceLoader(resourceManager, GLTFResourceLoader);

    const renderer = new WebGLRenderer({ antialias: true, canvas: canvasTarget });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputEncoding = sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setSize(initialCanvasWidth, initialCanvasHeight, false);

    const cursorBuffers = renderableTripleBuffer.buffers.map((b) => createCursorBuffer(b));

    const transformViews = cursorBuffers.map(
      (buffer) =>
        ({
          // note: needs synced with renderableBuffer properties in game worker
          // todo: abstract the need to sync structure with renderableBuffer properties
          worldMatrix: addViewMatrix4(buffer, maxEntities),
          worldMatrixNeedsUpdate: addView(buffer, Uint8Array, maxEntities),
        } as TransformView)
    );

    const renderableViews = cursorBuffers.map(
      (buffer) =>
        ({
          resourceId: addView(buffer, Uint32Array, maxEntities),
          interpolate: addView(buffer, Uint8Array, maxEntities),
          visible: addView(buffer, Uint8Array, maxEntities),
        } as RenderableView)
    );

    return {
      scene,
      camera,
      needsResize: true,
      renderer,
      resourceManager,
      canvasWidth: initialCanvasWidth,
      canvasHeight: initialCanvasHeight,
      renderableMessageQueue: [],
      objectToEntityMap: new Map(),
      renderables: [],
      renderableIndices: new Map<number, number>(),
      renderableTripleBuffer,
      transformViews,
      renderableViews,
    };
  },
  init(ctx) {},
});

export function onStart(state: RenderThreadState, message: StartRenderWorkerMessage) {
  const { renderer } = getModule(state, RendererModule);
  renderer.setAnimationLoop(() => onUpdate(state));
}

const tempMatrix4 = new Matrix4();
const tempPosition = new Vector3();
const tempQuaternion = new Quaternion();
const tempScale = new Vector3();

function onUpdate(state: RenderThreadState) {
  const renderModule = getModule(state, RendererModule);
  const {
    needsResize,
    renderer,
    canvasWidth,
    canvasHeight,
    renderableTripleBuffer,
    transformViews,
    renderableViews,
    renderables,
    scene,
    camera,
  } = renderModule;

  processRenderableMessages(state);

  const now = performance.now();
  const dt = (state.dt = now - state.elapsed);
  state.elapsed = now;
  const frameRate = 1 / dt;
  const lerpAlpha = clamp(tickRate / frameRate, 0, 1);

  const bufferSwapped = swapReadBuffer(renderableTripleBuffer);

  const bufferIndex = getReadBufferIndex(renderableTripleBuffer);
  const Transform = transformViews[bufferIndex];
  const Renderable = renderableViews[bufferIndex];

  for (let i = 0; i < renderables.length; i++) {
    const { object, helper, eid } = renderables[i];

    if (!object) {
      continue;
    }

    object.visible = !!Renderable.visible[eid];

    if (!Transform.worldMatrixNeedsUpdate[eid]) {
      continue;
    }

    if (Renderable.interpolate[eid]) {
      tempMatrix4.fromArray(Transform.worldMatrix[eid]).decompose(tempPosition, tempQuaternion, tempScale);
      object.position.lerp(tempPosition, lerpAlpha);
      object.quaternion.slerp(tempQuaternion, lerpAlpha);
      object.scale.lerp(tempScale, lerpAlpha);

      if (helper) {
        helper.position.copy(object.position);
        helper.quaternion.copy(object.quaternion);
        helper.scale.copy(object.scale);
      }
    } else {
      tempMatrix4.fromArray(Transform.worldMatrix[eid]).decompose(object.position, object.quaternion, object.scale);
      object.matrix.fromArray(Transform.worldMatrix[eid]);
      object.matrixWorld.fromArray(Transform.worldMatrix[eid]);
      object.matrixWorldNeedsUpdate = false;

      if (helper) {
        helper.position.copy(object.position);
        helper.quaternion.copy(object.quaternion);
        helper.scale.copy(object.scale);
      }
    }
  }

  if (needsResize && renderModule.camera.type === "PerspectiveCamera") {
    const perspectiveCamera = renderModule.camera as PerspectiveCamera;
    perspectiveCamera.aspect = canvasWidth / canvasHeight;
    perspectiveCamera.updateProjectionMatrix();
    renderer.setSize(canvasWidth, canvasHeight, false);
    renderModule.needsResize = false;
  }

  for (let i = 0; i < state.preSystems.length; i++) {
    state.preSystems[i](state);
  }

  renderer.render(scene, camera);

  for (let i = 0; i < state.systems.length; i++) {
    state.systems[i](state);
  }

  for (let i = 0; i < state.postSystems.length; i++) {
    state.postSystems[i](state);
  }

  const stats = getModule(state, StatsModule);

  if (bufferSwapped) {
    if (stats.staleTripleBufferCounter > 1) {
      stats.staleFrameCounter++;
    }

    stats.staleTripleBufferCounter = 0;
  } else {
    stats.staleTripleBufferCounter++;
  }
}

export function onResize(state: RenderThreadState, { canvasWidth, canvasHeight }: RenderWorkerResizeMessage) {
  const renderer = getModule(state, RendererModule);
  renderer.needsResize = true;
  renderer.canvasWidth = canvasWidth;
  renderer.canvasHeight = canvasHeight;
}

export function onRenderableMessage(state: RenderThreadState, message: RenderableMessages) {
  const { renderableMessageQueue } = getModule(state, RendererModule);
  renderableMessageQueue.push(message);
}

export function processRenderableMessages(state: RenderThreadState) {
  const { renderableMessageQueue } = getModule(state, RendererModule);
  while (renderableMessageQueue.length) {
    const message = renderableMessageQueue.shift() as RenderableMessages;

    switch (message.type) {
      case WorkerMessageType.AddRenderable:
        onAddRenderable(state, message);
        break;
      case WorkerMessageType.RemoveRenderable:
        onRemoveRenderable(state, message);
        break;
      case WorkerMessageType.SetActiveCamera:
        onSetActiveCamera(state, message);
        break;
      case WorkerMessageType.SetActiveScene:
        onSetActiveScene(state, message);
        break;
    }
  }
}

export function onAddRenderable(state: RenderThreadState, message: AddRenderableMessage) {
  const { resourceId, eid } = message;
  const { renderableMessageQueue, renderableIndices, renderables, objectToEntityMap, scene, resourceManager } =
    getModule(state, RendererModule);
  let renderableIndex = renderableIndices.get(eid);
  const resourceInfo = resourceManager.store.get(resourceId);

  if (!resourceInfo) {
    console.warn(`AddRenderable Error: Unknown resourceId ${resourceId} for eid ${eid}`);
    return;
  }

  if (resourceInfo.state === ResourceState.Loaded) {
    const object = resourceInfo.resource as Object3D;

    if (renderableIndex !== undefined) {
      // Replace an existing renderable on an entity if it changed
      const removed = renderables.splice(renderableIndex, 1, { object, eid, resourceId });

      if (removed.length > 0 && removed[0].object) {
        // Remove the renderable object3D only if it exists
        scene.remove(removed[0].object);
      }
    } else {
      renderableIndex = renderables.length;
      renderableIndices.set(eid, renderables.length);
      renderables.push({ object, eid, resourceId });
      objectToEntityMap.set(object, eid);
    }

    scene.add(object);

    return;
  }

  if (resourceInfo.state === ResourceState.Loading) {
    if (renderableIndex !== undefined) {
      // Update the renderable with the new resource id and remove the old object
      const removed = renderables.splice(renderableIndex, 1, { object: undefined, eid, resourceId });

      if (removed.length > 0 && removed[0].object) {
        // Remove the previous renderable object from the scene if it exists
        scene.remove(removed[0].object);
      }
    } else {
      renderableIndex = renderables.length;
      renderableIndices.set(eid, renderables.length);
      renderables.push({ object: undefined, eid, resourceId });
    }

    // Resources that are still loading should be re-queued when they finish loading.
    resourceInfo.promise.finally(() => {
      const index = renderableIndices.get(eid);

      if (index === undefined || renderables[index].resourceId !== message.resourceId) {
        // The resource was changed since it finished loading so avoid queueing it again
        return;
      }

      renderableMessageQueue.push(message);
    });

    return;
  }

  console.warn(
    `AddRenderable Error: resourceId ${resourceId} for eid ${eid} could not be loaded: ${resourceInfo.error}`
  );
}

export function onRemoveRenderable(state: RenderThreadState, { eid }: RemoveRenderableMessage) {
  const { renderableIndices, renderables, objectToEntityMap, scene } = getModule(state, RendererModule);

  const index = renderableIndices.get(eid);

  if (index !== undefined) {
    const removed = renderables.splice(index, 1);
    renderableIndices.delete(eid);

    if (removed.length > 0) {
      const { object, helper } = removed[0];

      if (object) {
        scene.remove(object);
        objectToEntityMap.delete(object);
      }

      if (helper) {
        scene.remove(helper);
        objectToEntityMap.delete(helper);
      }
    }
  }
}

export function onSetActiveScene(state: RenderThreadState, { eid, resourceId }: SetActiveSceneMessage) {
  const rendererState = getModule(state, RendererModule);
  const resourceInfo = rendererState.resourceManager.store.get(resourceId);

  if (!resourceInfo) {
    console.error(`SetActiveScene Error: Couldn't find resource ${resourceId} for scene ${eid}`);
    return;
  }

  const setScene = (newScene: Scene) => {
    for (const child of rendererState.scene.children) {
      newScene.add(child);
    }

    rendererState.scene = newScene;
  };

  if (resourceInfo.resource) {
    const newScene = resourceInfo.resource as Scene;
    setScene(newScene);
  } else {
    resourceInfo.promise.then(({ resource }) => {
      setScene(resource as Scene);
    });
  }
}

export function onSetActiveCamera(state: RenderThreadState, { eid }: SetActiveCameraMessage) {
  const renderModule = getModule(state, RendererModule);
  const { renderableIndices, renderables } = renderModule;
  const index = renderableIndices.get(eid);

  if (index !== undefined && renderables[index]) {
    const camera = renderables[index].object as Camera;

    const perspectiveCamera = camera as PerspectiveCamera;

    if (perspectiveCamera.isPerspectiveCamera) {
      perspectiveCamera.aspect = renderModule.canvasWidth / renderModule.canvasHeight;
      perspectiveCamera.updateProjectionMatrix();
    }

    renderModule.camera = camera;
  }
}
