'use client';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

function SortableTr({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: {
    attributes: ReturnType<typeof useSortable>['attributes'];
    listeners: ReturnType<typeof useSortable>['listeners'];
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </tr>
  );
}

export function AdminSortableTable({
  ids,
  onReorder,
  onDragEnd: onDragEndProp,
  head,
  renderRow,
}: {
  ids: string[];
  onReorder: (orderedIds: string[]) => void | Promise<void>;
  /** Если задан — вместо дефолтного arrayMove(ids) + onReorder. */
  onDragEnd?: (event: DragEndEvent) => void | Promise<void>;
  head: ReactNode;
  renderRow: (
    id: string,
    dragHandleProps: {
      attributes: ReturnType<typeof useSortable>['attributes'];
      listeners: ReturnType<typeof useSortable>['listeners'];
    },
  ) => ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(event: DragEndEvent) {
    if (onDragEndProp) {
      void onDragEndProp(event);
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    void onReorder(next);
  }

  return (
    <div className={styles.tableWrap}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className={styles.table}>
          <thead>{head}</thead>
          <tbody>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {ids.map((id) => (
                <SortableTr key={id} id={id}>
                  {(drag) => renderRow(id, drag)}
                </SortableTr>
              ))}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}

export function DragHandleCell({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
}) {
  return (
    <td className={styles.dragHandle} {...attributes} {...listeners} title="Перетащить">
      ⋮⋮
    </td>
  );
}
