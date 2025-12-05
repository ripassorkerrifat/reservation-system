import {Module} from "@nestjs/common";
import {BullModule} from "@nestjs/bullmq";
import {ExpirationProcessor} from "./expiration.processor";
import {ReservationsModule} from "../reservations/reservations.module";

@Module({
     imports: [
          ReservationsModule,
          BullModule.registerQueue({
               name: "reservation-expiration",
          }),
     ],
     providers: [ExpirationProcessor],
})
export class ExpirationWorkerModule {}
