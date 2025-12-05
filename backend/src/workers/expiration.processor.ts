import {Processor, WorkerHost, OnWorkerEvent} from "@nestjs/bullmq";
import {Job} from "bullmq";
import {ReservationsService} from "../reservations/reservations.service";
import {Logger} from "@nestjs/common";

@Processor("reservation-expiration")
export class ExpirationProcessor extends WorkerHost {
     private readonly logger = new Logger(ExpirationProcessor.name);

     constructor(private reservationsService: ReservationsService) {
          super();
     }

     async process(job: Job<{reservationId: string}>): Promise<void> {
          const {reservationId} = job.data;
          this.logger.log(
               `Processing expiration for reservation ${reservationId}`
          );

          try {
               await this.reservationsService.expire(reservationId);
               this.logger.log(
                    `Successfully expired reservation ${reservationId}`
               );
          } catch (error) {
               this.logger.error(
                    `Failed to expire reservation ${reservationId}:`,
                    error
               );
               throw error; // Re-throw to trigger retry mechanism
          }
     }

     @OnWorkerEvent("completed")
     onCompleted(job: Job) {
          this.logger.debug(`Job ${job.id} completed`);
     }

     @OnWorkerEvent("failed")
     onFailed(job: Job, error: Error) {
          this.logger.error(`Job ${job.id} failed:`, error);
     }
}
