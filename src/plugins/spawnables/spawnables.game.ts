import RAPIER from "@dimforge/rapier3d-compat";
import { addComponent, addEntity } from "bitecs";
import { mat4, vec3, quat } from "gl-matrix";
import { Vector3 } from "three";

import { playAudio } from "../../engine/audio/audio.game";
import { getCamera } from "../../engine/camera/camera.game";
import { addChild } from "../../engine/component/transform";
import { MAX_OBJECT_CAP } from "../../engine/config.common";
import { GameState } from "../../engine/GameTypes";
import { createNodeFromGLTFURI } from "../../engine/gltf/gltf.game";
import {
  ActionDefinition,
  ActionType,
  BindingType,
  ButtonActionState,
  enableActionMap,
} from "../../engine/input/ActionMappingSystem";
import { InputModule } from "../../engine/input/input.game";
import { getInputController, InputController, inputControllerQuery } from "../../engine/input/InputController";
import { createSphereMesh } from "../../engine/mesh/mesh.game";
import { defineModule, getModule, registerMessageHandler, Thread } from "../../engine/module/module.common";
import { isHost } from "../../engine/network/network.common";
import { Networked, NetworkModule, Owned, ownedNetworkedQuery } from "../../engine/network/network.game";
import { addRemoteNodeComponent } from "../../engine/node/node.game";
import { RemoteNodeComponent } from "../../engine/node/RemoteNodeComponent";
import { dynamicObjectCollisionGroups } from "../../engine/physics/CollisionGroups";
import { addRigidBody, PhysicsModule, RigidBody } from "../../engine/physics/physics.game";
import { createPrefabEntity, PrefabType, registerPrefab } from "../../engine/prefab/prefab.game";
import {
  addResourceRef,
  RemoteAudioData,
  RemoteAudioEmitter,
  RemoteAudioSource,
  RemoteMaterial,
  RemoteNode,
} from "../../engine/resource/resource.game";
import { AudioEmitterType, InteractableType, MaterialType } from "../../engine/resource/schema";
import { createDisposables } from "../../engine/utils/createDisposables";
import randomRange from "../../engine/utils/randomRange";
import { addInteractableComponent } from "../interaction/interaction.game";
import { ObjectCapReachedMessageType, SetObjectCapMessage, SetObjectCapMessageType } from "./spawnables.common";

const { abs, floor, random } = Math;

type SpawnablesModuleState = {
  hitAudioEmitters: Map<number, RemoteAudioEmitter>;
  actions: ActionDefinition[];
  maxObjCap: number;
};

export const SpawnablesModule = defineModule<GameState, SpawnablesModuleState>({
  name: "spawnables",
  create() {
    const actions = Array(6)
      .fill(null)
      .map((_, i) => ({
        id: `${i + 1}`,
        path: `${i + 1}`,
        type: ActionType.Button,
        bindings: [
          {
            type: BindingType.Button,
            path: `Keyboard/Digit${i + 1}`,
          },
        ],
      }));

    return {
      hitAudioEmitters: new Map(),
      actions,
      maxObjCap: MAX_OBJECT_CAP,
    };
  },
  init(ctx) {
    const module = getModule(ctx, SpawnablesModule);
    const physics = getModule(ctx, PhysicsModule);

    const crateAudioData = new RemoteAudioData(ctx.resourceManager, {
      name: "Crate Audio Data",
      uri: "/audio/hit.wav",
    });
    addResourceRef(ctx, crateAudioData.resourceId);

    registerPrefab(ctx, {
      name: "small-crate",
      type: PrefabType.Object,
      create: (ctx, remote) => {
        const size = 1;
        const halfSize = size / 2;

        const node = createNodeFromGLTFURI(ctx, "/gltf/sci_fi_crate.glb");

        node.scale.set([size, size, size]);

        const hitAudioSource = new RemoteAudioSource(ctx.resourceManager, {
          audio: crateAudioData,
          loop: false,
          autoPlay: false,
        });

        const audioEmitter = new RemoteAudioEmitter(ctx.resourceManager, {
          type: AudioEmitterType.Positional,
          sources: [hitAudioSource],
        });

        node.audioEmitter = audioEmitter;

        module.hitAudioEmitters.set(node.eid, audioEmitter);

        const rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic();
        const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize, halfSize, halfSize)
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_EVENTS)
          .setCollisionGroups(dynamicObjectCollisionGroups);

        physicsWorld.createCollider(colliderDesc, rigidBody.handle);

        addRigidBody(ctx, node, rigidBody);

        addInteractableComponent(ctx, physics, node, InteractableType.Grabbable);

        return node;
      },
    });

    registerPrefab(ctx, {
      name: "medium-crate",
      type: PrefabType.Object,
      create: (ctx, remote) => {
        const size = 1.75;
        const halfSize = size / 2;

        const node = createNodeFromGLTFURI(ctx, "/gltf/sci_fi_crate.glb");

        node.scale.set([size, size, size]);

        const hitAudioSource = new RemoteAudioSource(ctx.resourceManager, {
          audio: crateAudioData,
          loop: false,
          autoPlay: false,
        });

        const audioEmitter = new RemoteAudioEmitter(ctx.resourceManager, {
          type: AudioEmitterType.Positional,
          sources: [hitAudioSource],
        });

        node.audioEmitter = audioEmitter;

        module.hitAudioEmitters.set(node.eid, audioEmitter);

        // const rigidBodyDesc = remote
        //   ? RAPIER.RigidBodyDesc.newKinematicPositionBased()
        //   : RAPIER.RigidBodyDesc.newDynamic();
        const rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic();

        const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize, halfSize, halfSize)
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_EVENTS)
          .setCollisionGroups(dynamicObjectCollisionGroups);

        physicsWorld.createCollider(colliderDesc, rigidBody.handle);

        addRigidBody(ctx, node, rigidBody);

        addInteractableComponent(ctx, physics, node, InteractableType.Grabbable);

        return node;
      },
    });

    registerPrefab(ctx, {
      name: "large-crate",
      type: PrefabType.Object,
      create: (ctx, remote) => {
        const size = 2.5;
        const halfSize = size / 2;

        const node = createNodeFromGLTFURI(ctx, "/gltf/sci_fi_crate.glb");

        node.scale.set([size, size, size]);

        const hitAudioSource = new RemoteAudioSource(ctx.resourceManager, {
          audio: crateAudioData,
          loop: false,
          autoPlay: false,
        });

        const audioEmitter = new RemoteAudioEmitter(ctx.resourceManager, {
          type: AudioEmitterType.Positional,
          sources: [hitAudioSource],
        });

        node.audioEmitter = audioEmitter;

        module.hitAudioEmitters.set(node.eid, audioEmitter);

        // const rigidBodyDesc = remote
        //   ? RAPIER.RigidBodyDesc.newKinematicPositionBased()
        //   : RAPIER.RigidBodyDesc.newDynamic();
        const rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic();

        const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize, halfSize, halfSize)
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_EVENTS)
          .setCollisionGroups(dynamicObjectCollisionGroups);

        physicsWorld.createCollider(colliderDesc, rigidBody.handle);

        addRigidBody(ctx, node, rigidBody);
        addInteractableComponent(ctx, physics, node, InteractableType.Grabbable);

        return node;
      },
    });

    const ballAudioData = new RemoteAudioData(ctx.resourceManager, {
      name: "Ball Audio Data",
      uri: "/audio/bounce.wav",
    });
    addResourceRef(ctx, ballAudioData.resourceId);

    const ballAudioData2 = new RemoteAudioData(ctx.resourceManager, {
      name: "Ball Audio Data 2",
      uri: "/audio/clink.wav",
    });
    addResourceRef(ctx, ballAudioData2.resourceId);

    const ballAudioData3 = new RemoteAudioData(ctx.resourceManager, {
      name: "Ball Audio Data 3",
      uri: "/audio/clink2.wav",
    });
    addResourceRef(ctx, ballAudioData3.resourceId);

    const emissiveMaterial = new RemoteMaterial(ctx.resourceManager, {
      name: "Emissive Material",
      type: MaterialType.Standard,
      baseColorFactor: [0, 0.3, 1, 1],
      emissiveFactor: [0.7, 0.7, 0.7],
      metallicFactor: 0,
      roughnessFactor: 1,
    });

    addResourceRef(ctx, emissiveMaterial.resourceId);

    const mirrorMaterial = new RemoteMaterial(ctx.resourceManager, {
      name: "Mirror Material",
      type: MaterialType.Standard,
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 1,
      roughnessFactor: 0,
    });
    addResourceRef(ctx, mirrorMaterial.resourceId);

    const blackMirrorMaterial = new RemoteMaterial(ctx.resourceManager, {
      name: "Black Mirror Material",
      type: MaterialType.Standard,
      baseColorFactor: [0, 0, 0, 1],
      metallicFactor: 1,
      roughnessFactor: 0,
    });
    addResourceRef(ctx, blackMirrorMaterial.resourceId);

    registerPrefab(ctx, {
      name: "mirror-ball",
      type: PrefabType.Object,
      create: (ctx) => {
        const node = createBall(ctx, 1, mirrorMaterial);

        const rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic();

        const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.ball(1 / 2)
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_EVENTS)
          .setCollisionGroups(dynamicObjectCollisionGroups)
          .setRestitution(1)
          .setDensity(1);

        physicsWorld.createCollider(colliderDesc, rigidBody.handle);

        addRigidBody(ctx, node, rigidBody);
        addInteractableComponent(ctx, physics, node, InteractableType.Grabbable);

        const audioEmitter = new RemoteAudioEmitter(ctx.resourceManager, {
          type: AudioEmitterType.Positional,
          sources: [
            new RemoteAudioSource(ctx.resourceManager, {
              audio: ballAudioData,
              loop: false,
              autoPlay: false,
            }),
          ],
        });

        node.audioEmitter = audioEmitter;

        module.hitAudioEmitters.set(node.eid, audioEmitter);

        return node;
      },
    });

    registerPrefab(ctx, {
      name: "black-mirror-ball",
      type: PrefabType.Object,
      create: (ctx) => {
        const node = createBall(ctx, 1, blackMirrorMaterial);

        const rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic();

        const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.ball(1 / 2)
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_EVENTS)
          .setCollisionGroups(dynamicObjectCollisionGroups)
          .setRestitution(1)
          .setDensity(1);

        physicsWorld.createCollider(colliderDesc, rigidBody.handle);

        addRigidBody(ctx, node, rigidBody);
        addInteractableComponent(ctx, physics, node, InteractableType.Grabbable);

        const audioEmitter = new RemoteAudioEmitter(ctx.resourceManager, {
          type: AudioEmitterType.Positional,
          sources: [
            new RemoteAudioSource(ctx.resourceManager, {
              audio: ballAudioData,
              loop: false,
              autoPlay: false,
            }),
          ],
        });

        node.audioEmitter = audioEmitter;

        module.hitAudioEmitters.set(node.eid, audioEmitter);

        return node;
      },
    });

    registerPrefab(ctx, {
      name: "emissive-ball",
      type: PrefabType.Object,
      create: (ctx) => {
        const node = createBall(ctx, 2, emissiveMaterial);

        const rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic();

        const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        rigidBody.setGravityScale(0.9, true);

        const colliderDesc = RAPIER.ColliderDesc.ball(1)
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_EVENTS)
          .setCollisionGroups(dynamicObjectCollisionGroups)
          .setRestitution(1)
          .setDensity(0.1);

        physicsWorld.createCollider(colliderDesc, rigidBody.handle);

        addRigidBody(ctx, node, rigidBody);
        addInteractableComponent(ctx, physics, node, InteractableType.Grabbable);

        const hitAudioSource = new RemoteAudioSource(ctx.resourceManager, {
          audio: ballAudioData,
          loop: false,
          autoPlay: false,
        });

        const audioEmitter = new RemoteAudioEmitter(ctx.resourceManager, {
          type: AudioEmitterType.Positional,
          sources: [hitAudioSource],
        });

        node.audioEmitter = audioEmitter;

        module.hitAudioEmitters.set(node.eid, audioEmitter);

        return node;
      },
    });

    // collision handlers
    const { collisionHandlers, physicsWorld } = getModule(ctx, PhysicsModule);

    collisionHandlers.push((eid1?: number, eid2?: number, handle1?: number, handle2?: number) => {
      const body1 = physicsWorld.getRigidBody(handle1!);
      const body2 = physicsWorld.getRigidBody(handle2!);

      let gain = 1;

      if (body1 && body2) {
        const linvel1 = body1.linvel();
        const linvel2 = body2.linvel();

        const manhattanLength =
          abs(linvel1.x) + abs(linvel1.y) + abs(linvel1.z) + abs(linvel2.x) + abs(linvel2.y) + abs(linvel2.z);

        gain = manhattanLength / 20;
      }

      const playbackRate = randomRange(0.3, 0.75);

      const emitter1 = module.hitAudioEmitters.get(eid1!);
      if (emitter1) {
        const source = emitter1.sources[floor(random() * emitter1.sources.length)] as RemoteAudioSource;
        playAudio(source, { playbackRate, gain });
      }

      const emitter2 = module.hitAudioEmitters.get(eid2!);
      if (emitter2) {
        const source = emitter2.sources[floor(random() * emitter2.sources.length)] as RemoteAudioSource;
        playAudio(source, { playbackRate, gain });
      }
    });

    // action mapping
    const { actions } = module;

    // id determines which prefab is spawned in the system
    actions[0].id = "small-crate";
    actions[1].id = "medium-crate";
    actions[2].id = "large-crate";
    actions[3].id = "mirror-ball";
    actions[4].id = "black-mirror-ball";
    actions[5].id = "emissive-ball";

    const input = getModule(ctx, InputModule);
    const controller = input.defaultController;
    enableActionMap(controller, {
      id: "spawnables",
      actions,
    });

    return createDisposables([registerMessageHandler(ctx, SetObjectCapMessageType, onSetObjectCap)]);
  },
});

function onSetObjectCap(ctx: GameState, message: SetObjectCapMessage) {
  const module = getModule(ctx, SpawnablesModule);
  module.maxObjCap = message.value;
}

const THROW_FORCE = 10;

const _direction = vec3.create();
const _impulse = new Vector3();
const _cameraWorldQuat = quat.create();

export const SpawnableSystem = (ctx: GameState) => {
  const network = getModule(ctx, NetworkModule);
  if (network.authoritative && !isHost(network)) {
    return;
  }

  const input = getModule(ctx, InputModule);
  const spawnablesModule = getModule(ctx, SpawnablesModule);

  const rigs = inputControllerQuery(ctx.world);

  for (let i = 0; i < rigs.length; i++) {
    const eid = rigs[i];
    const node = RemoteNodeComponent.get(eid)!;
    const camera = getCamera(ctx, node);
    const controller = getInputController(input, eid);
    updateSpawnables(ctx, spawnablesModule, controller, camera);
  }
};

export const updateSpawnables = (
  ctx: GameState,
  { actions, maxObjCap }: SpawnablesModuleState,
  controller: InputController,
  camera: RemoteNode
) => {
  const pressedActions = actions.filter((a) => (controller.actions.get(a.path) as ButtonActionState)?.pressed);

  if (pressedActions.length) {
    // bounce out of the system if we hit the max object cap
    const ownedEnts = ownedNetworkedQuery(ctx.world);
    if (ownedEnts.length > maxObjCap) {
      ctx.sendMessage(Thread.Main, {
        type: ObjectCapReachedMessageType,
      });
      // TODO: send this message to the other clients
      // TODO: add two configs: max objects per client and max objects per room
      return;
    }
  }

  for (const action of pressedActions) {
    const prefab = createPrefabEntity(ctx, action.id);
    const eid = prefab.eid;

    // caveat: must add owned before networked (should maybe change Owned to Remote)
    addComponent(ctx.world, Owned, eid);
    // Networked component isn't reset when removed so reset on add
    addComponent(ctx.world, Networked, eid, true);

    mat4.getTranslation(prefab.position, camera.worldMatrix);

    mat4.getRotation(_cameraWorldQuat, camera.worldMatrix);
    const direction = vec3.set(_direction, 0, 0, -1);
    vec3.transformQuat(direction, direction, _cameraWorldQuat);

    // place object at direction
    vec3.add(prefab.position, prefab.position, direction);

    vec3.scale(direction, direction, THROW_FORCE);

    _impulse.fromArray(direction);

    const body = RigidBody.store.get(eid);

    if (!body) {
      console.warn("could not find RigidBody for spawned entity " + eid);
      continue;
    }

    prefab.quaternion.set(_cameraWorldQuat);

    body.applyImpulse(_impulse, true);

    addChild(ctx, ctx.worldResource.transientScene!, prefab);
  }
};

export const createBall = (state: GameState, size: number, material?: RemoteMaterial): RemoteNode => {
  const { world } = state;
  const eid = addEntity(world);
  return addRemoteNodeComponent(state, eid, { mesh: createSphereMesh(state, size, material) });
};
