import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleProjects } from '../src/permissions.js';
import { currentUser, projects } from '../src/projects.js';
test('active own project is present', () => assert.ok(visibleProjects(currentUser, projects).some(p => p.id === 'alpha')));
test('archived projects are hidden by default', () => assert.ok(visibleProjects(currentUser, projects).every(p => !p.archived)));
