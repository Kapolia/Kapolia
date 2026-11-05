import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAutosaveDraftController } from '@/lib/autosave-draft'
import type { AutoSaveDraftDb } from '@/lib/autosave-draft'

// ─── Mock base de données ──────────────────────────────────────────────────────

type DbWrite = { op: 'insert' | 'update'; payload: Record<string, unknown>; id?: string }

function makeMockDb(): { writes: DbWrite[] } & AutoSaveDraftDb {
  const writes: DbWrite[] = []
  let seq = 0
  const insert = vi.fn(async (payload: Record<string, unknown>): Promise<string | null> => {
    const id = `draft-${++seq}`
    writes.push({ op: 'insert', payload, id })
    return id
  })
  const update = vi.fn(async (id: string, payload: Record<string, unknown>): Promise<void> => {
    writes.push({ op: 'update', payload, id })
  })
  return { writes, insert, update }
}

// ─── Helpers de scénario ──────────────────────────────────────────────────────
//
// createAutosaveDraftController est le même module utilisé par la page.
// tick/save ici reproduisent la structure de save() dans publier/page.tsx.

function makeScenarioHelper(db: ReturnType<typeof makeMockDb>) {
  const ctrl = createAutosaveDraftController(db)
  const form = { titre: '' }

  function tick() {
    if (!form.titre.trim()) return
    ctrl.tick({ titre: form.titre, statut: 'brouillon', active: false })
  }

  async function save(statut: 'publiée' | 'brouillon') {
    await ctrl.beforeSave()
    const fields: Record<string, unknown> = { titre: form.titre, statut, active: statut === 'publiée' }
    try {
      if (ctrl.autosaveDraftId.current) {
        await db.update(ctrl.autosaveDraftId.current, fields)
      } else {
        await db.insert({ ...fields, recruteur_id: 'user1' })
      }
      if (statut !== 'publiée') ctrl.onSaveError()
    } catch (e) {
      ctrl.onSaveError()
      throw e
    }
  }

  return { ctrl, form, tick, save }
}

// Vide la file des microtâches (plusieurs tours pour les await enchaînés)
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('auto-save publier page', () => {

  // ── Scénario 1 : 2 auto-saves puis publication puis 2 minutes ─────────────

  describe('scenario 1 : 2 auto-saves puis publication puis 2 minutes', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('un seul INSERT, tous les UPDATE sur le meme id, derniere ecriture publiee', async () => {
      const db = makeMockDb()
      const { form, tick, save } = makeScenarioHelper(db)
      form.titre = 'Mon poste'

      const timerId = setInterval(tick, 60_000)

      // t = 60 s : premier tick → INSERT
      vi.advanceTimersByTime(60_000)
      await flush()

      // t = 120 s : deuxieme tick → UPDATE
      vi.advanceTimersByTime(60_000)
      await flush()

      // Publication
      await save('publiée')

      // t = 180 s, t = 240 s : savedRef = true, les ticks sont bloques
      vi.advanceTimersByTime(120_000)
      await flush()

      clearInterval(timerId)

      const inserts = db.writes.filter(w => w.op === 'insert')
      const updates = db.writes.filter(w => w.op === 'update')

      expect(inserts).toHaveLength(1)

      const draftId = inserts[0].id!
      for (const u of updates) expect(u.id).toBe(draftId)

      const last = db.writes.at(-1)!
      expect(last.payload.statut).toBe('publiée')
      expect(last.payload.active).toBe(true)

      const pubIdx = db.writes.findIndex(w => w.payload.statut === 'publiée')
      expect(db.writes.length).toBe(pubIdx + 1)
    })
  })

  // ── Scénario 2 : publication pendant le premier INSERT encore en vol ───────

  describe('scenario 2 : publication pendant le premier INSERT encore en vol', () => {

    it('save() attend la fin du INSERT puis fait un UPDATE, pas de doublon', async () => {
      const db = makeMockDb()

      let resolveFirstInsert!: (id: string) => void
      db.insert.mockImplementationOnce(async (payload: Record<string, unknown>): Promise<string> => {
        const id = await new Promise<string>(res => { resolveFirstInsert = res })
        db.writes.push({ op: 'insert', payload, id })
        return id
      })

      const { ctrl, form, tick, save } = makeScenarioHelper(db)
      form.titre = 'Mon poste'

      tick()
      expect(ctrl.autosavePromise.current).not.toBeNull()
      expect(ctrl.autosaveDraftId.current).toBeNull()

      const savePromise = save('publiée')

      resolveFirstInsert('draft-1')
      await savePromise

      expect(ctrl.autosaveDraftId.current).toBe('draft-1')

      const inserts = db.writes.filter(w => w.op === 'insert')
      expect(inserts).toHaveLength(1)
      expect(inserts[0].id).toBe('draft-1')

      const pubWrite = db.writes.find(w => w.payload.statut === 'publiée')
      expect(pubWrite).toBeDefined()
      expect(pubWrite!.op).toBe('update')
      expect(pubWrite!.id).toBe('draft-1')
    })

    it('save() sans auto-save precedent fait un INSERT direct', async () => {
      const db = makeMockDb()
      const { form, save } = makeScenarioHelper(db)
      form.titre = 'Mon poste'

      await save('publiée')

      expect(db.writes).toHaveLength(1)
      expect(db.writes[0].op).toBe('insert')
      expect(db.writes[0].payload.statut).toBe('publiée')
      expect(db.writes[0].payload.active).toBe(true)
    })
  })

  // ── Scénario 3 : tick pendant save() ne doit déclencher aucune écriture ───

  describe('scenario 3 : tick pendant save() bloque par savedRef', () => {

    it('aucune ecriture supplementaire si un tick arrive pendant save()', async () => {
      const db = makeMockDb()
      const { form, tick, save } = makeScenarioHelper(db)
      form.titre = 'Mon poste'

      // Premier tick : INSERT
      tick()
      await flush()

      // save() pose savedRef = true immediatement (synchrone dans beforeSave)
      const savePromise = save('publiée')

      // tick arrive pendant que save() est suspendu : bloque
      tick()

      await savePromise

      // 1 insert (tick initial) + 1 update (publication) = 2 au total
      expect(db.writes).toHaveLength(2)
      expect(db.writes[0].op).toBe('insert')
      expect(db.writes[1].op).toBe('update')
      expect(db.writes[1].payload.statut).toBe('publiée')
    })
  })

  // ── Scénario 4 : save() echoue, l'auto-save reprend au tick suivant ────────

  describe('scenario 4 : echec de save(), auto-save reprend', () => {

    it('savedRef repasse a false apres une erreur et le tick suivant ecrit', async () => {
      const db = makeMockDb()
      db.update.mockImplementationOnce(() => Promise.reject(new Error('Erreur reseau')))

      const { ctrl, form, tick, save } = makeScenarioHelper(db)
      form.titre = 'Mon poste'

      // Premier tick : INSERT → autosaveDraftId = 'draft-1'
      tick()
      await flush()

      // save() echoue → onSaveError() remet savedRef a false
      await expect(save('publiée')).rejects.toThrow('Erreur reseau')
      expect(ctrl.savedRef.current).toBe(false)

      // Tick suivant reprend : UPDATE sur l'id existant
      tick()
      await flush()

      const inserts = db.writes.filter(w => w.op === 'insert')
      expect(inserts).toHaveLength(1)

      const last = db.writes.at(-1)!
      expect(last.op).toBe('update')
      expect(last.id).toBe('draft-1')
    })
  })

})
