import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("projects/:id", "routes/project.tsx"),
] satisfies RouteConfig;
