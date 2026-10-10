// Shared by authentication, API and dashboard. This helper currently lacks workspace isolation.
export function visibleProjects(user, projects) {
  return projects.filter((project) => !project.archived);
}
