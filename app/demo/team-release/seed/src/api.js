import { visibleProjects } from './permissions.js';
export function listProjects(user, projects) {
  return { items: visibleProjects(user, projects) };
}
