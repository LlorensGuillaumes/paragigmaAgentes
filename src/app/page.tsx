"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createTask,
  deleteTask,
  getTasks,
  MAX_TASK_TITLE_LENGTH,
  TaskError,
  toggleTask,
  type Task,
} from "../lib/supabase";

const filters = [
  { id: "all", label: "Todas", empty: "Todavía no hay tareas." },
  { id: "pending", label: "Pendientes", empty: "No hay tareas pendientes." },
  { id: "completed", label: "Completadas", empty: "Aún no hay tareas completadas." },
] as const;

type Filter = (typeof filters)[number]["id"];

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
    />
  );
}

function taskErrorMessage(error: unknown, fallback: string): string {
  return error instanceof TaskError ? error.message : fallback;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState("");
  const mutationInProgress = useRef(false);

  useEffect(() => {
    let active = true;

    getTasks()
      .then((data) => {
        if (active) setTasks(data);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(taskErrorMessage(error, "No se pudieron cargar las tareas."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  async function runMutation(message: string, fallback: string, operation: () => Promise<void>) {
    if (mutationInProgress.current || loading || loadError) return;

    mutationInProgress.current = true;
    setMutationError("");
    setSaving(message);
    try {
      await operation();
    } catch (error) {
      setMutationError(taskErrorMessage(error, fallback));
    } finally {
      mutationInProgress.current = false;
      setSaving("");
    }
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void runMutation("Guardando tarea…", "No se pudo guardar la tarea.", async () => {
      const created = await createTask(title);
      setTasks((current) => [created, ...current]);
      setTitle("");
      setFilter((current) => current === "completed" ? "pending" : current);
    });
  }

  function changeCompletion(task: Task) {
    void runMutation("Actualizando tarea…", "No se pudo actualizar la tarea.", async () => {
      const updated = await toggleTask(task.id, !task.completed);
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    });
  }

  function removeTask(task: Task) {
    void runMutation("Borrando tarea…", "No se pudo borrar la tarea.", async () => {
      await deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    });
  }

  function retryLoading() {
    setLoadError("");
    setLoading(true);
    setAttempt((current) => current + 1);
  }

  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;
  const visibleTasks = filter === "all" ? tasks : tasks.filter((task) => task.completed === (filter === "completed"));
  const emptyMessage = filters.find((option) => option.id === filter)?.empty;

  const mutating = Boolean(saving);
  const unavailable = loading || Boolean(loadError) || mutating;

  return (
    <main className="min-h-screen bg-emerald-50/60 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-16">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-lg shadow-emerald-950/5">
        <header className="border-b border-emerald-900/10 bg-emerald-950 px-5 py-7 text-white sm:px-10 sm:py-9">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Mis tareas</h1>
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-emerald-100">
            <div className="flex items-baseline gap-2">
              <dt>Pendientes</dt>
              <dd className="text-lg font-semibold tabular-nums text-white">{loading || loadError ? "—" : pending}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt>Completadas</dt>
              <dd className="text-lg font-semibold tabular-nums text-white">{loading || loadError ? "—" : completed}</dd>
            </div>
          </dl>
        </header>

        <div className="px-5 py-6 sm:px-10 sm:py-8">
          <form onSubmit={addTask}>
            <label htmlFor="task-title" className="mb-2 block text-sm font-semibold">Nueva tarea</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Escribe un título"
                required
                maxLength={MAX_TASK_TITLE_LENGTH}
                disabled={loading || Boolean(loadError)}
                readOnly={mutating}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:bg-slate-50 motion-reduce:transition-none"
              />
              <button
                type="submit"
                disabled={unavailable || !title.trim()}
                className="min-h-12 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50 motion-reduce:transition-none"
              >
                Añadir tarea
              </button>
            </div>
          </form>

          <p role="status" className={loading || mutating ? "mt-4 flex items-center gap-2 text-sm text-emerald-800" : "sr-only"}>
            {(loading || mutating) && <Spinner />}
            {loading ? "Cargando tareas…" : saving}
          </p>

          {(loadError || mutationError) && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p role="alert">{loadError || mutationError}</p>
              {loadError && (
                <button type="button" onClick={retryLoading} className="mt-2 rounded-sm font-semibold underline">
                  Reintentar
                </button>
              )}
            </div>
          )}

          <div role="group" aria-label="Filtrar tareas" className="mb-4 mt-7 flex flex-wrap gap-2">
            {filters.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className="min-h-11 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 aria-pressed:bg-emerald-900 aria-pressed:text-white sm:px-4 motion-reduce:transition-none"
              >
                {label}
              </button>
            ))}
          </div>

          <div aria-busy={loading || mutating}>
            {loading && (
              <div aria-hidden="true" className="grid gap-2 motion-safe:animate-pulse">
                <div className="h-14 rounded-xl bg-slate-100" />
                <div className="h-14 rounded-xl bg-slate-100" />
                <div className="h-14 rounded-xl bg-slate-100" />
              </div>
            )}

            {!loading && !loadError && (
              visibleTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600">
                  {emptyMessage}
                </p>
              ) : (
                <ul aria-label="Tareas" className="grid gap-2">
                  {visibleTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-1 transition-colors hover:border-emerald-800/30 motion-reduce:transition-none sm:gap-3 sm:px-4"
                    >
                      <label className="flex min-w-0 flex-1 items-start gap-3 py-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          disabled={mutating}
                          onChange={() => changeCompletion(task)}
                          className="mt-0.5 size-5 shrink-0 accent-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                        />
                        <span className={task.completed ? "wrap-anywhere text-slate-600 line-through" : "wrap-anywhere"}>
                          {task.title}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeTask(task)}
                        disabled={mutating}
                        aria-label={`Borrar tarea: ${task.title}`}
                        className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800 disabled:opacity-50 motion-reduce:transition-none sm:px-3"
                      >
                        Borrar
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>
      </section>
    </main>
  );
}