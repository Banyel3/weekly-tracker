import { localId } from "@/lib/localId";
import type { TaskDto } from "@/lib/tasks";

const TEMP_PREFIX = "tmp-";

export const tempTaskId = () => `${TEMP_PREFIX}${localId()}`;

/** A card whose create POST has not returned has no server id yet: move, reschedule, delete and open wait for it. */
export const isSaving = (task: Pick<TaskDto, "id">) => task.id.startsWith(TEMP_PREFIX);
