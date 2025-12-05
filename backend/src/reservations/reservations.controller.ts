import {
     Controller,
     Get,
     Post,
     Body,
     Param,
     HttpCode,
     HttpStatus,
} from "@nestjs/common";
import {ReservationsService} from "./reservations.service";
import {CreateReservationDto} from "./dto/create-reservation.dto";

@Controller("reservations")
export class ReservationsController {
     constructor(private readonly reservationsService: ReservationsService) {}

     @Post()
     @HttpCode(HttpStatus.CREATED)
     create(@Body() createReservationDto: CreateReservationDto) {
          return this.reservationsService.create(createReservationDto);
     }

     @Get(":id")
     findOne(@Param("id") id: string) {
          return this.reservationsService.findOne(id);
     }

     @Post(":id/complete")
     @HttpCode(HttpStatus.OK)
     complete(@Param("id") id: string) {
          return this.reservationsService.complete(id);
     }
}
