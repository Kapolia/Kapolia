// Gestionnaire d'état pour l'auto-save du formulaire de publication d'offre.
// Extrait ici pour être testé de façon déterministe sans rendu React.

export type AutoSaveDraftDb = {
  insert: (payload: Record<string, unknown>) => Promise<string | null>
  update: (id: string, payload: Record<string, unknown>) => Promise<void>
}

export function createAutosaveDraftController(db: AutoSaveDraftDb) {
  const autosaveDraftId = { current: null as string | null }
  const autosavePromise = { current: null as Promise<void> | null }
  const savedRef        = { current: false }

  // Appelé par le setInterval. Ne démarre rien si savedRef = true.
  // onDone est appelé une fois l'écriture terminée avec succès.
  function tick(payload: Record<string, unknown>, onDone?: () => void): void {
    if (savedRef.current) return
    const task = async () => {
      let wrote = true
      if (autosaveDraftId.current) {
        await db.update(autosaveDraftId.current, payload)
      } else {
        const id = await db.insert(payload)
        if (id) autosaveDraftId.current = id
        else wrote = false
      }
      if (wrote) onDone?.()
    }
    autosavePromise.current = task().finally(() => { autosavePromise.current = null })
  }

  // Appelé au début de save() : bloque les ticks immédiatement (synchrone),
  // puis attend la fin d'un éventuel tick en cours.
  async function beforeSave(): Promise<void> {
    savedRef.current = true
    if (autosavePromise.current) await autosavePromise.current
  }

  // Appelé en cas d'erreur dans save() : réactive les ticks futurs.
  function onSaveError(): void {
    savedRef.current = false
  }

  function reset(): void {
    autosaveDraftId.current = null
    autosavePromise.current = null
    savedRef.current = false
  }

  return { autosaveDraftId, autosavePromise, savedRef, tick, beforeSave, onSaveError, reset }
}

export type AutoSaveDraftController = ReturnType<typeof createAutosaveDraftController>
