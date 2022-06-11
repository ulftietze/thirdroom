import { RemoteAccessor } from "../accessor/accessor.game";
import { createObjectBufferView, createObjectTripleBuffer, ObjectBufferView } from "../allocator/ObjectBufferView";
import { GameState } from "../GameTypes";
import { RemoteMaterial } from "../material/material.game";
import { getModule, Thread } from "../module/module.common";
import { RendererModule } from "../renderer/renderer.game";
import { createResource } from "../resource/resource.game";
import {
  SharedMeshResource,
  MeshResourceType,
  MeshResourceProps,
  PrimitiveResourceProps,
  meshPrimitiveSchema,
  MeshPrimitiveMode,
  SharedMeshPrimitiveResource,
  MeshPrimitiveResourceType,
  MeshPrimitiveTripleBuffer,
} from "./mesh.common";

export type MeshPrimitiveBufferView = ObjectBufferView<typeof meshPrimitiveSchema, ArrayBuffer>;

export interface RemoteMeshPrimitive {
  resourceId: number;
  meshPrimitiveBufferView: MeshPrimitiveBufferView;
  meshPrimitiveTripleBuffer: MeshPrimitiveTripleBuffer;
  get material(): RemoteMaterial | undefined;
  set material(value: RemoteMaterial | undefined);
}

export interface RemoteMesh {
  resourceId: number;
  primitives: RemoteMeshPrimitive[];
}

interface MeshPrimitiveProps {
  attributes: { [key: string]: RemoteAccessor<any, any> };
  indices?: RemoteAccessor<any, any>;
  material?: RemoteMaterial;
  mode?: number;
  targets?: number[] | Float32Array;
}

export function createRemoteMesh(
  ctx: GameState,
  primitives: MeshPrimitiveProps | MeshPrimitiveProps[],
  weights?: number[] | Float32Array
): RemoteMesh {
  const arr = Array.isArray(primitives) ? primitives : [primitives];

  const remoteMeshPrimitives = arr.map((primitive) => createRemoteMeshPrimitive(ctx, primitive));

  const initialProps: MeshResourceProps = {
    primitives: remoteMeshPrimitives.map((primitive) => primitive.resourceId),
    weights,
  };

  const resourceId = createResource<SharedMeshResource>(ctx, Thread.Render, MeshResourceType, { initialProps });

  return {
    resourceId,
    primitives: remoteMeshPrimitives,
  };
}

function createRemoteMeshPrimitive(ctx: GameState, props: MeshPrimitiveProps): RemoteMeshPrimitive {
  const rendererModule = getModule(ctx, RendererModule);

  const meshPrimitiveBufferView = createObjectBufferView(meshPrimitiveSchema, ArrayBuffer);

  const initialProps: PrimitiveResourceProps = {
    attributes: Object.fromEntries(
      Object.entries(props).map(([name, accessor]: [string, RemoteAccessor<any, any>]) => [name, accessor.resourceId])
    ),
    indices: props.indices ? props.indices.resourceId : undefined,
    material: props.material ? props.material.resourceId : undefined,
    mode: props.mode === undefined ? MeshPrimitiveMode.TRIANGLES : props.mode,
    targets: props.targets,
  };

  meshPrimitiveBufferView.material[0] = initialProps.material || 0;

  const meshPrimitiveTripleBuffer = createObjectTripleBuffer(meshPrimitiveSchema, ctx.gameToMainTripleBufferFlags);

  const resourceId = createResource<SharedMeshPrimitiveResource>(ctx, Thread.Render, MeshPrimitiveResourceType, {
    initialProps,
    meshPrimitiveTripleBuffer,
  });

  let _material: RemoteMaterial | undefined = props.material;

  const remoteMeshPrimitive: RemoteMeshPrimitive = {
    resourceId,
    meshPrimitiveBufferView,
    meshPrimitiveTripleBuffer,
    get material(): RemoteMaterial | undefined {
      return _material;
    },
    set material(value: RemoteMaterial | undefined) {
      _material = value;
      meshPrimitiveBufferView.material[0] = value?.resourceId || 0;
    },
  };

  rendererModule.meshPrimitives.push(remoteMeshPrimitive);

  return remoteMeshPrimitive;
}
