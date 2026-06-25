import { supabase } from "@/lib/supabase";
import type { TaskWithOrder } from "@/lib/types";

const TASK_COMPLETED_WEBHOOK = "http://localhost:5678/webhook/task-completed";

export async function completeTask(task: TaskWithOrder, notas: string) {
  const now = new Date().toISOString();

  const { error: taskError } = await supabase
    .from("tasks")
    .update({
      estado: "hecha",
      completado_en: now
    })
    .eq("id", task.id);

  if (taskError) throw taskError;

  const comment = notas.trim();
  if (comment) {
    const { error: commentError } = await supabase.from("comentarios").insert({
      order_id: task.order_id,
      task_id: task.id,
      comentario: comment,
      origen: "task_completado"
    });

    if (commentError) throw commentError;
  }

  try {
    const response = await fetch(TASK_COMPLETED_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        task_id: task.id,
        order_id: task.order_id,
        tipo: task.tipo,
        notas: comment
      })
    });

    if (!response.ok) {
      console.warn("Task completed webhook failed", response.status);
    }
  } catch (error) {
    console.warn("Task completed webhook unavailable", error);
  }
}

export async function omitTask(taskId: string) {
  const { error } = await supabase
    .from("tasks")
    .update({
      estado: "omitida"
    })
    .eq("id", taskId);

  if (error) throw error;
}
