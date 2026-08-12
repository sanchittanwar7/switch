import { useEffect, useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { useKanbanStore } from "../stores/kanbanStore";
import { useSettingsStore } from "../stores/settingsStore";
import BoardHeader from "../components/kanban/BoardHeader";
import Column from "../components/kanban/Column";
import ApplicationModal from "../components/kanban/ApplicationModal";

export default function KanbanView() {
  const { columns, applications, loading, fetchBoard, moveApplication } = useKanbanStore();
  const { loadDefaultResume } = useSettingsStore();
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  useEffect(() => {
    fetchBoard();
    loadDefaultResume();
  }, [fetchBoard, loadDefaultResume]);

  const selectedApplication = selectedApplicationId ? applications[selectedApplicationId] : null;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const newColumns = columns.map((col) => ({
      id: col.id,
      applicationIds: [...col.applicationIds],
    }));

    const sourceCol = newColumns.find(
      (c) => c.id === source.droppableId,
    );
    const destCol = newColumns.find(
      (c) => c.id === destination.droppableId,
    );
    if (!sourceCol || !destCol) return;

    sourceCol.applicationIds.splice(source.index, 1);
    destCol.applicationIds.splice(destination.index, 0, draggableId);

    moveApplication(newColumns);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-brand-mute">Loading board...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <BoardHeader />
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {columns
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((col) => (
              <Column
                key={col.id}
                column={col}
                applications={col.applicationIds
                  .map((id) => applications[id])
                  .filter(Boolean)}
                onApplicationClick={setSelectedApplicationId}
              />
            ))}
        </div>
      </DragDropContext>

      {selectedApplication && (
        <ApplicationModal
          application={selectedApplication}
          onClose={() => setSelectedApplicationId(null)}
        />
      )}
    </div>
  );
}
