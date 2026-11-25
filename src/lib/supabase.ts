import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Task = {
  id: string | number;
  title: string;
  completed: boolean;
  created_at: string;
};

type Database = {
  public: {
    Tables: {
      tasks: {
        Row: Task;
        Insert: { title: string; completed: boolean };
        Update: { completed: boolean };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
};

export class TaskError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TaskError";
  }
}

export const MAX_TASK_TITLE_LENGTH = 200;

const taskColumns = "id, title, completed, created_at";
let client: SupabaseClient<Database> | undefined;

function getClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url?.trim() || !anonKey?.trim()) {
    throw new TaskError("Falta la configuración pública de Supabase.");
  }

  try {
    client = createClient<Database>(url, anonKey);
    return client;
  } catch (cause) {
    throw new TaskError("La configuración pública de Supabase no es válida.", { cause });
  }
}

export async function getTasks(): Promise<Task[]> {
  const { data, error } = await getClient().from("tasks")
    .select(taskColumns)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new TaskError("Supabase no pudo cargar las tareas. Revisa la conexión e inténtalo de nuevo.", { cause: error });
  }

  return data;
}

export async function createTask(title: string): Promise<Task> {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) throw new TaskError("Escribe un título para la tarea.");
  if (normalizedTitle.length > MAX_TASK_TITLE_LENGTH) {
    throw new TaskError(`El título puede tener hasta ${MAX_TASK_TITLE_LENGTH} caracteres.`);
  }

  const { data, error } = await getClient().from("tasks")
    .insert({ title: normalizedTitle, completed: false })
    .select(taskColumns)
    .single();

  if (error) {
    throw new TaskError("Supabase no pudo guardar la tarea. Inténtalo de nuevo.", { cause: error });
  }

  return data;
}

export async function toggleTask(id: Task["id"], completed: boolean): Promise<Task> {
  const { data, error } = await getClient().from("tasks")
    .update({ completed })
    .eq("id", id)
    .select(taskColumns)
    .single();

  if (error) {
    throw new TaskError("Supabase no pudo actualizar la tarea. Inténtalo de nuevo.", { cause: error });
  }

  return data;
}

export async function deleteTask(id: Task["id"]): Promise<void> {
  const { error } = await getClient().from("tasks")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    throw new TaskError("Supabase no pudo borrar la tarea. Inténtalo de nuevo.", { cause: error });
  }
}