# Your run: courses (courses, playlists, collections and skill pages end to end)

Your name is `courses`. sweeps.md ground 13: nobody has run courses end to end. Drive core and the CLI, and the list actions headlessly (`apps/desktop/src/list-actions.ts`, as `apps/desktop/test/list-actions.test.tsx` does).

1. **Making a course** (`packages/core/src/courses.ts`, `ingest/course.ts`, YouTube playlists in `ingest/youtube.ts` with network stubbed): lesson order, a playlist with removed or private videos, the same video in two courses, a course from a folder of files, a re-import of a playlist that gained or lost videos.
2. **Lessons over time**: next lesson and progress after a lesson is read, finished (`Finish.tsx`), archived, deleted, reimported, moved to another course or skill, and after Undo of each; progress on the Mac vs the phone for the same library (`phone/PhoneApp.tsx` and the Mac's `App.tsx` / `Home.tsx` read it: do they agree?).
3. **Collections and Collected** (`collection-name.ts`, `Collected.tsx`, D353): names that collide, rename, empty collections, a source in two.
4. **Skill pages** (`SkillPage.tsx`, `skills.ts`, `stats.ts`, `importance.tsx`, `no-skill.ts`): the numbers a skill page shows against the files (exercise counts, due, level, sources), after moves and archives; a skill with only archived sources; No skill.
Read F573, F576 and other course rows first.
