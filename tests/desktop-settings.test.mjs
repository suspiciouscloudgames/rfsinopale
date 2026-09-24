import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  installationDefaults,
  validateInstallation,
  readSettings,
  saveSettings,
} from "../desktop/main/settings.mjs";
test("installation settings survive atomic save and reject malformed topology", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sea-config-")),
    file = path.join(root, "installation.json");
  try {
    const first = await readSettings(file);
    assert.deepEqual(first, installationDefaults);
    const changed = {
      ...first,
      room: "show-two",
      mapping: { A: "-1", B: "5" },
      layout: { width: 1920, height: 1080, gap: 24 },
      show: { ...first.show, holdSeconds: 4 },
    };
    await saveSettings(file, changed);
    assert.equal((await readSettings(file)).show.holdSeconds, 4);
    assert.equal((await readSettings(file)).layout.gap, 24);
    assert.throws(() =>
      validateInstallation({
        ...changed,
        layout: { ...changed.layout, gap: -1 },
      }),
    );
    assert.throws(() =>
      validateInstallation({ ...changed, room: "room<script>" }),
    );
    assert.throws(() =>
      validateInstallation({ ...changed, fit: { A: "stretch", B: "contain" } }),
    );
    assert.throws(() =>
      validateInstallation({ ...changed, show: { maxJellies: 0 } }),
    );
    assert.throws(() =>
      validateInstallation({ ...changed, schemaVersion: 99 }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('legacy saved and imported modes always run composition, retaining legacy counts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sea-legacy-mode-'));
  const file = path.join(root, 'installation.json');
  const legacy = {...installationDefaults, show: {...installationDefaults.show,
    jellyMode: 'trigger-count', minJellies: 2, maxJellies: 12, jelliesPerTrigger: 3}};
  try {
    await writeFile(file, JSON.stringify(legacy));
    const loaded = await readSettings(file);
    assert.equal(loaded.show.jellyMode, 'composition');
    assert.equal(loaded.show.jelliesPerTrigger, 3);
    assert.equal(validateInstallation(legacy).show.jellyMode, 'composition');
    await saveSettings(file, legacy);
    assert.equal((await readSettings(file)).show.jellyMode, 'composition');
  } finally {await rm(root, {recursive: true, force: true});}
});
