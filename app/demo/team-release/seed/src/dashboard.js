import { visibleProjects } from './permissions.js';
export function dashboard(user, projects) {
  return { title: 'Your projects', projects: visibleProjects(user, projects) };
}
