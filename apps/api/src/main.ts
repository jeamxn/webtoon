import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix("api");
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`[api] listening on :${port}`);
}

void bootstrap();
