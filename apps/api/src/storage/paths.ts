import * as path from "node:path";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
export const PROJECTS_DIR = path.join(DATA_DIR, "projects");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const GENERATED_DIR = path.join(DATA_DIR, "generated");
