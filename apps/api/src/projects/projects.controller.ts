import { Body, Controller, Get, Param, Post, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Answer } from "@webtoon/shared";
import type { ProjectsService } from "./projects.service";
import type { UploadedImageFile } from "./upload.types";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projects.get(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor("images", 8))
  create(@Body("topic") topic: string, @UploadedFiles() files: UploadedImageFile[]) {
    return this.projects.create(topic, files ?? []);
  }

  @Post(":id/answers")
  answer(@Param("id") id: string, @Body("answers") answers: Answer[]) {
    return this.projects.answer(id, answers ?? []);
  }

  @Post(":id/storyboard")
  storyboard(@Param("id") id: string) {
    return this.projects.buildStoryboard(id);
  }

  @Post(":id/episodes/:index")
  episode(@Param("id") id: string, @Param("index") index: string) {
    return this.projects.detailEpisode(id, Number(index));
  }

  @Post(":id/episodes/:index/panels/:panel/image")
  panelImage(
    @Param("id") id: string,
    @Param("index") index: string,
    @Param("panel") panel: string,
  ) {
    return this.projects.generatePanelImage(id, Number(index), Number(panel));
  }
}
