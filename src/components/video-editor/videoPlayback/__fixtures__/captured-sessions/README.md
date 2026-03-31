These files are parity-harness artifacts for cursor and camera evaluation.

Each session is split into:
- `*.cursor.json`: saved cursor telemetry in the same `{ version, samples }` shape used by the app.
- `*.scenario.json`: timeline metadata for the parity test, including duration, sampling times, geometry, and zoom regions.

Current mix:
- `real-*`: genuine ScreenMint recordings copied from the local app recordings directory.
- `moving-window-follow.*`: representative schema-rich artifact kept to cover source-bounds reprojection until a real post-schema moving-window capture exists.

When newer real QA recordings are available, replace the representative moving-window artifact and update `recordedSessionFixtures.ts` if filenames change.
