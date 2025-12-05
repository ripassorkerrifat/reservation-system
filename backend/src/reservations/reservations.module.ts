import {Module} from "@nestjs/common";
import {BullModule} from "@nestjs/bullmq";
import {ReservationsService} from "./reservations.service";
import {ReservationsController} from "./reservations.controller";
import {ProductsModule} from "../products/products.module";

@Module({
     imports: [
          ProductsModule,
          BullModule.registerQueue({
               name: "reservation-expiration",
          }),
     ],
     controllers: [ReservationsController],
     providers: [ReservationsService],
     exports: [ReservationsService],
})
export class ReservationsModule {}
