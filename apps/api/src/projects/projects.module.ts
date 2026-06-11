import { Module } from "@nestjs/common";
import { EventsService } from "../jobs/events.service";
import { JobStore } from "../jobs/job.store";
import { JobRunnerService } from "../jobs/job-runner.service";
import { LlmService } from "../llm/llm.service";
import { ImageStore } from "../storage/image.store";
import { ProjectStore } from "../storage/project.store";
import { ImagesController } from "./images.controller";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  controllers: [ProjectsController, ImagesController],
  providers: [
    ProjectsService,
    ProjectStore,
    ImageStore,
    JobStore,
    JobRunnerService,
    EventsService,
    LlmService,
  ],
})
export class ProjectsModule {}
