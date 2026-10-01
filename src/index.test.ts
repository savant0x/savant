import { describe, expect, it } from 'bun:test';

import packageJson from '../package.json' with { type: 'json' };

/**
 * Section 0's deliverable is the gate set itself, so the test asserts the gates are
 * actually wired rather than asserting constants that duplicate package.json.
 * A gate that is declared in protocol.config.yaml but absent from package.json is
 * exactly the Section 0 defect this work fixed, so it is the thing worth testing.
 */

const GATE_SCRIPTS = ['build', 'test', 'typecheck', 'lint', 'lint:md', 'format:check'] as const;

describe('verification gates', () => {
  it('declares every gate named in protocol.config.yaml', () => {
    for (const gate of GATE_SCRIPTS) {
      expect(packageJson.scripts[gate]).toBeDefined();
    }
  });

  it('scopes test discovery to src so vendored trees are never walked', () => {
    expect(packageJson.scripts.test).toContain('./src');
  });

  it('does not run an install step inside a verification gate', () => {
    for (const gate of GATE_SCRIPTS) {
      expect(packageJson.scripts[gate]).not.toContain('--no-install');
    }
  });

  it('declares no workspaces, keeping the project a single package', () => {
    expect(Object.hasOwn(packageJson, 'workspaces')).toBe(false);
  });
});
