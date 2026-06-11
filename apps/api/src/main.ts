import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { DATA_DIR } from "./storage/paths";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.setGlobalPrefix("api");
  app.useStaticAssets(DATA_DIR, { prefix: "/files" });
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`[api] listening on :${port}`);
}

void bootstrap();
