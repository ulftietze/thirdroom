import * as RAPIER from "@dimforge/rapier3d-compat";
import { addEntity } from "bitecs";
import { BoxBufferGeometry, BufferGeometry, SphereBufferGeometry } from "three";

import { GameState } from "../GameTypes";
import { addChild, addTransformComponent, setQuaternionFromEuler, Transform } from "../component/transform";
import { addRigidBody, PhysicsModule } from "../physics/physics.game";
import { getModule, Thread } from "../module/module.common";
import { createRemoteStandardMaterial, RemoteMaterial } from "../material/material.game";
import { createRemoteMesh, RemoteMesh } from "../mesh/mesh.game";
import { createRemoteAccessor } from "../accessor/accessor.game";
import { AccessorComponentType, AccessorType } from "../accessor/accessor.common";
import { createRemoteBufferView } from "../bufferView/bufferView.game";
import { MeshPrimitiveAttribute } from "../mesh/mesh.common";
import { createRemotePerspectiveCamera } from "../camera/camera.game";
import { addRemoteNodeComponent } from "../node/node.game";
import { createDirectionalLightResource } from "../light/light.game";
import { inflateGLTFScene } from "../gltf/gltf.game";
import { addView, createCursorBuffer } from "../allocator/CursorBuffer";

export const createMesh = (ctx: GameState, geometry: BufferGeometry, material?: RemoteMaterial): RemoteMesh => {
  const indicesArr = geometry.index!.array as Uint16Array;
  const posArr = geometry.attributes.position.array as Float32Array;
  const normArr = geometry.attributes.normal.array as Float32Array;
  const uvArr = geometry.attributes.uv.array as Float32Array;

  const buffer = createCursorBuffer(
    new ArrayBuffer(indicesArr.byteLength + posArr.byteLength + normArr.byteLength + uvArr.byteLength)
  );

  const indices = addView(buffer, Uint16Array, indicesArr.length, indicesArr);
  const position = addView(buffer, Float32Array, posArr.length, posArr);
  const normal = addView(buffer, Float32Array, normArr.length, normArr);
  const uv = addView(buffer, Float32Array, uvArr.length, uvArr);

  const bufferView = createRemoteBufferView(ctx, Thread.Render, buffer);

  const remoteMesh = createRemoteMesh(ctx, {
    indices: createRemoteAccessor(ctx, {
      type: AccessorType.SCALAR,
      componentType: AccessorComponentType.Uint16,
      bufferView,
      count: indices.length,
    }),
    attributes: {
      [MeshPrimitiveAttribute.POSITION]: createRemoteAccessor(ctx, {
        type: AccessorType.VEC3,
        componentType: AccessorComponentType.Float32,
        bufferView,
        byteOffset: position.byteOffset,
        count: position.length / 3,
      }),
      [MeshPrimitiveAttribute.NORMAL]: createRemoteAccessor(ctx, {
        type: AccessorType.VEC3,
        componentType: AccessorComponentType.Float32,
        bufferView,
        byteOffset: normal.byteOffset,
        count: normal.length / 3,
        normalized: true,
      }),
      [MeshPrimitiveAttribute.TEXCOORD_0]: createRemoteAccessor(ctx, {
        type: AccessorType.VEC2,
        componentType: AccessorComponentType.Float32,
        bufferView,
        byteOffset: uv.byteOffset,
        count: uv.length / 2,
      }),
    },
    material:
      material ||
      createRemoteStandardMaterial(ctx, {
        baseColorFactor: [Math.random(), Math.random(), Math.random(), 1.0],
        roughnessFactor: 0.8,
        metallicFactor: 0.8,
      }),
  });

  return remoteMesh;
};

export const createCubeMesh = (ctx: GameState, size: number, material?: RemoteMaterial) => {
  const geometry = new BoxBufferGeometry(size, size, size);
  return createMesh(ctx, geometry, material);
};

export const createSphereMesh = (ctx: GameState, radius: number, material?: RemoteMaterial) => {
  const geometry = new SphereBufferGeometry(radius / 2);
  return createMesh(ctx, geometry, material);
};

const COLLISION_GROUPS = 0xffff_ffff;

export const createCube = (ctx: GameState, size: number, material?: RemoteMaterial) => {
  const { world } = ctx;
  const { physicsWorld } = getModule(ctx, PhysicsModule);
  const eid = addEntity(world);
  addTransformComponent(world, eid);

  createRemoteStandardMaterial(ctx, {
    baseColorFactor: [Math.random(), Math.random(), Math.random(), 1.0],
    roughnessFactor: 0.8,
    metallicFactor: 0.8,
  });

  addRemoteNodeComponent(ctx, eid, {
    mesh: createCubeMesh(ctx, size, material),
  });

  const rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic();
  const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2)
    .setActiveEvents(RAPIER.ActiveEvents.CONTACT_EVENTS)
    .setCollisionGroups(COLLISION_GROUPS)
    .setSolverGroups(COLLISION_GROUPS);

  physicsWorld.createCollider(colliderDesc, rigidBody.handle);

  addRigidBody(world, eid, rigidBody);

  return eid;
};

export function createCamera(state: GameState, setActive = true): number {
  const eid = addEntity(state.world);
  addTransformComponent(state.world, eid);

  const remoteCamera = createRemotePerspectiveCamera(state, {
    yfov: 75,
    znear: 0.1,
  });

  addRemoteNodeComponent(state, eid, {
    camera: remoteCamera,
  });

  if (setActive) {
    state.activeCamera = eid;
  }

  return eid;
}

export function createDirectionalLight(state: GameState, parentEid?: number) {
  const eid = addEntity(state.world);
  addTransformComponent(state.world, eid);

  addRemoteNodeComponent(state, eid, {
    light: createDirectionalLightResource(state),
  });

  if (parentEid !== undefined) {
    addChild(parentEid, eid);
  }

  return eid;
}

export function createGLTFEntity(ctx: GameState, uri: string) {
  const eid = addEntity(ctx.world);
  inflateGLTFScene(ctx, eid, uri);
  return eid;
}

/* Prefab Functions */

export interface PrefabTemplate {
  name: string;
  create: Function;
  delete?: Function;
  serialize?: Function;
  deserialize?: Function;
}

export function registerPrefab(state: GameState, template: PrefabTemplate) {
  if (state.prefabTemplateMap.has(template.name)) {
    console.warn("warning: overwriting existing prefab", template.name);
  }
  state.prefabTemplateMap.set(template.name, template);
  const create = template.create;

  template.create = () => {
    const eid = create();
    state.entityPrefabMap.set(eid, template.name);
    return eid;
  };
}

export function getPrefabTemplate(state: GameState, name: string) {
  return state.prefabTemplateMap.get(name);
}

const AVATAR_COLLISION_GROUPS = 0xffff_f00f;

export function createContainerizedAvatar(ctx: GameState, uri: string) {
  const { physicsWorld } = getModule(ctx, PhysicsModule);

  const container = addEntity(ctx.world);
  addTransformComponent(ctx.world, container);
  addRemoteNodeComponent(ctx, container);

  const eid = addEntity(ctx.world);
  inflateGLTFScene(ctx, eid, uri, undefined, false);

  Transform.position[eid].set([0, -1, 0]);
  Transform.rotation[eid].set([0, Math.PI, 0]);
  Transform.scale[eid].set([1.3, 1.3, 1.3]);
  setQuaternionFromEuler(Transform.quaternion[eid], Transform.rotation[eid]);

  addChild(container, eid);

  const rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic();
  const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.5).setActiveEvents(RAPIER.ActiveEvents.CONTACT_EVENTS);

  colliderDesc.setCollisionGroups(AVATAR_COLLISION_GROUPS);
  colliderDesc.setSolverGroups(AVATAR_COLLISION_GROUPS);

  physicsWorld.createCollider(colliderDesc, rigidBody.handle);
  addRigidBody(ctx.world, container, rigidBody);

  return container;
}

// TODO: make a loading entity prefab to display if prefab template hasn't been loaded before deserializing
// add component+system for loading and swapping the prefab
export const createLoadingEntity = createCube;

export const createPrefabEntity = (state: GameState, prefab: string) => {
  const create = state.prefabTemplateMap.get(prefab)?.create;
  if (create) {
    return create(state);
  } else {
    return createLoadingEntity(state, 1);
  }
};
