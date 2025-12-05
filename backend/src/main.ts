import {NestFactory} from "@nestjs/core";
import {ValidationPipe, Logger} from "@nestjs/common";
import {AppModule} from "./app.module";

const DEFAULT_PORT = 4000;
const DEFAULT_FRONTEND_URL = "http://localhost:3000";

async function bootstrap() {
     const logger = new Logger("Bootstrap");
     const app = await NestFactory.create(AppModule);

     // Enable CORS for frontend
     app.enableCors({
          origin: [
               process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL,
               "http://localhost:3001", // Fallback for development
               "http://192.168.0.111:3000",
          ],
          credentials: true,
     });

     // Global validation pipe
     app.useGlobalPipes(
          new ValidationPipe({
               whitelist: true,
               transform: true,
          })
     );

     const port = process.env.PORT || DEFAULT_PORT;
     await app.listen(port);
     logger.log(`🚀 Backend server running on http://localhost:${port}`);
}

bootstrap();
