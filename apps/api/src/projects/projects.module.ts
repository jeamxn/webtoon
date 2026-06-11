import { Module } from "@nestjs/common";
import { LlmService } from "../llm/llm.service";
import { ProjectStore } from "../storage/project.store";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectStore, LlmService],
})
export class ProjectsModule {}
