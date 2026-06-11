import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { ImageStore } from "../storage/image.store";

@Controller("images")
export class ImagesController {
  constructor(private readonly images: ImageStore) {}

  @Get(":id")
  async get(@Param("id") id: string, @Res() res: Response) {
    const img = await this.images.get(id);
    res.setHeader("Content-Type", img.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(img.content);
  }
}
