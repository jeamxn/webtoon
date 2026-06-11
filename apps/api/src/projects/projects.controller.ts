import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Answer } from "@webtoon/shared";
import type { Observable } from "rxjs";
import { EventsService } from "../jobs/events.service";
import { ProjectsService } from "./projects.service";
import type { UploadedImageFile } from "./upload.types";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly events: EventsService,
  ) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projects.get(id);
  }

  @Get(":id/jobs")
  jobs(@Param("id") id: string, @Query("active") active?: string) {
    return this.projects.listJobs(id, active === "1");
  }

  @Sse(":id/events")
  sse(@Param("id") id: string): Observable<MessageEvent> {
    return this.events.stream(id);
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

  @Post(":id/characters")
  characters(@Param("id") id: string) {
    return this.projects.regenerateCharacters(id);
  }

  @Post(":id/characters/:characterId/image")
  characterImage(@Param("id") id: string, @Param("characterId") characterId: string) {
    return this.projects.generateCharacterImage(id, characterId);
  }

  @Post(":id/episodes/:index")
  episode(@Param("id") id: string, @Param("index") index: string) {
    return this.projects.detailEpisode(id, Number(index));
  }

  @Patch(":id/episodes/:index")
  editEpisode(
    @Param("id") id: string,
    @Param("index") index: string,
    @Body() body: { title?: string; synopsis?: string },
  ) {
    return this.projects.editEpisode(id, Number(index), body ?? {});
  }

  @Post(":id/episodes")
  addEpisode(@Param("id") id: string, @Body() body: { title?: string; synopsis?: string }) {
    return this.projects.addEpisode(id, body?.title ?? "", body?.synopsis ?? "");
  }

  @Post(":id/episodes-revise")
  reviseEpisodes(@Param("id") id: string, @Body("instruction") instruction: string) {
    return this.projects.reviseEpisodes(id, instruction);
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
