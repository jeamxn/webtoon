import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { InfraModule } from "./infra/infra.module";
import { ProjectsModule } from "./projects/projects.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    InfraModule,
    ProjectsModule,
  ],
})
export class AppModule {}
