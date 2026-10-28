import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INHALE_MS, EXHALE_MS, TOTAL_MS, breathAt } from '../src/breath.js';

test('60 seconds of whole in/out cycles, no hold phase', () => {
  assert.equal(TOTAL_MS, 60000);
  assert.equal(TOTAL_MS % (INHALE_MS + EXHALE_MS), 0);
});

test('phases alternate inhale then exhale', () => {
  assert.equal(breathAt(0).phase, 'inhale');
  assert.equal(breathAt(INHALE_MS - 1).phase, 'inhale');
  assert.equal(breathAt(INHALE_MS).phase, 'exhale');
  assert.equal(breathAt(INHALE_MS + EXHALE_MS).phase, 'inhale');
  const phases = new Set();
  for (let t = 0; t < TOTAL_MS; t += 250) phases.add(breathAt(t).phase);
  assert.deepEqual([...phases].sort(), ['exhale', 'inhale']);
});

test('countdowns and done', () => {
  assert.equal(breathAt(0).phaseSecondsLeft, INHALE_MS / 1000);
  assert.equal(breathAt(0).totalSecondsLeft, 60);
  assert.equal(breathAt(59500).totalSecondsLeft, 1);
  assert.equal(breathAt(TOTAL_MS).phase, 'done');
  assert.equal(breathAt(TOTAL_MS + 5000).totalSecondsLeft, 0);
  assert.equal(breathAt(-50).phase, 'inhale');
});
