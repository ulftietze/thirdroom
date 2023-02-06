import "./EditorView.css";
import { useEditor } from "../../../hooks/useEditor";
import { HierarchyPanel } from "./HierarchyPanel";
import { useMainThreadContext } from "../../../hooks/useMainThread";
import { getLocalResource } from "../../../../engine/resource/resource.main";
import { PropertiesPanel } from "./PropertiesPanel";

export function EditorView() {
  const { loading, scene, activeEntity, selectedEntities } = useEditor();

  const mainThread = useMainThreadContext();
  const resource = getLocalResource(mainThread, activeEntity);

  return (
    <>
      {loading || !scene ? null : (
        <>
          <div className="EditorView__leftPanel">
            <HierarchyPanel activeEntity={activeEntity} selectedEntities={selectedEntities} scene={scene} />
          </div>
          {resource && (
            <div className="EditorView__rightPanel">
              <PropertiesPanel resource={resource} />
            </div>
          )}
        </>
      )}
    </>
  );
}
