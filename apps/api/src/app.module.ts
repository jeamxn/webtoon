import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ProjectsModule } from "./projects/projects.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    ProjectsModule,
  ],
})
export class AppModule {}
