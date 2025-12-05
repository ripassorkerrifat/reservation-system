import {Module} from "@nestjs/common";
import {ConfigModule} from "@nestjs/config";
import {BullModule} from "@nestjs/bullmq";
import {ProductsModule} from "./products/products.module";
import {ReservationsModule} from "./reservations/reservations.module";
import {PrismaModule} from "./prisma/prisma.module";
import {ExpirationWorkerModule} from "./workers/expiration-worker.module";

@Module({
     imports: [
          ConfigModule.forRoot({
               isGlobal: true,
               envFilePath: ".env",
          }),
          BullModule.forRoot({
               connection: {
                    host: process.env.REDIS_HOST || "localhost",
                    port: parseInt(process.env.REDIS_PORT || "6379"),
               },
          }),
          PrismaModule,
          ProductsModule,
          ReservationsModule,
          ExpirationWorkerModule,
     ],
})
export class AppModule {}
