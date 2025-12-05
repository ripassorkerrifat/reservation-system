import {
     Injectable,
     NotFoundException,
     BadRequestException,
     Logger,
     OnModuleInit,
     OnModuleDestroy,
} from "@nestjs/common";
import {PrismaService} from "../prisma/prisma.service";
import {ProductsService} from "../products/products.service";
import {InjectQueue} from "@nestjs/bullmq";
import {Queue} from "bullmq";
import {CreateReservationDto} from "./dto/create-reservation.dto";
import {
     ReservationStatus,
     RESERVATION_DURATION_MS,
     PERIODIC_CHECK_INTERVAL_MS,
     RECOVERY_DELAY_MS,
     JOB_RETRY_ATTEMPTS,
     JOB_RETRY_DELAY_MS,
} from "../common/constants";
import {
     expireReservationsAndRestoreStock,
     scheduleExpirationJob,
} from "./utils/reservation.utils";

@Injectable()
export class ReservationsService implements OnModuleInit, OnModuleDestroy {
     private readonly logger = new Logger(ReservationsService.name);
     private periodicCheckInterval: NodeJS.Timeout | null = null;

     constructor(
          private prisma: PrismaService,
          private productsService: ProductsService,
          @InjectQueue("reservation-expiration") private expirationQueue: Queue
     ) {}

     /**
      * Create a reservation with transaction-safe stock deduction
      * Each user/browser gets their own reservation
      * Multiple users can reserve the same product simultaneously
      */
     async create(createReservationDto: CreateReservationDto) {
          const {productId, quantity} = createReservationDto;

          const reservation = await this.prisma.$transaction(async (tx) => {
               // First, expire any expired reservations for this product to free up stock
               const now = new Date();
               const expiredReservations = await tx.reservation.findMany({
                    where: {
                         productId,
                         status: ReservationStatus.ACTIVE,
                         expiresAt: {lte: now},
                    },
               });

               // Expire them and restore stock
               if (expiredReservations.length > 0) {
                    this.logger.log(
                         `Expiring ${expiredReservations.length} expired reservation(s) for product ${productId}`
                    );
                    await expireReservationsAndRestoreStock(
                         tx as any,
                         expiredReservations,
                         productId
                    );
               }

               // Get current product with stock
               const product = await tx.product.findUnique({
                    where: {id: productId},
               });

               if (!product) {
                    throw new NotFoundException(
                         `Product with ID ${productId} not found`
                    );
               }

               // Check stock availability (transaction ensures atomicity)
               if (product.availableStock < quantity) {
                    throw new BadRequestException(
                         `Insufficient stock. Available: ${product.availableStock}, Requested: ${quantity}`
                    );
               }

               // Create new reservation
               const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MS);

               const newReservation = await tx.reservation.create({
                    data: {
                         productId,
                         quantity,
                         status: ReservationStatus.ACTIVE,
                         expiresAt,
                    },
               });

               // Decrement stock atomically
               await tx.product.update({
                    where: {id: productId},
                    data: {
                         availableStock: {decrement: quantity},
                    },
               });

               this.logger.log(
                    `Created new reservation ${
                         newReservation.id
                    } for product ${productId} (stock now: ${
                         product.availableStock - quantity
                    })`
               );

               return newReservation;
          });

          // Schedule expiration job
          await scheduleExpirationJob(
               this.expirationQueue,
               reservation.id,
               reservation.expiresAt,
               this.logger
          );

          return reservation;
     }

     async findOne(id: string) {
          const reservation = await this.prisma.reservation.findUnique({
               where: {id},
               include: {product: true},
          });

          if (!reservation) {
               throw new NotFoundException(
                    `Reservation with ID ${id} not found`
               );
          }

          return reservation;
     }

     /**
      * Complete a reservation (purchase)
      */
     async complete(id: string) {
          return this.prisma.$transaction(async (tx) => {
               const reservation = await tx.reservation.findUnique({
                    where: {id},
                    include: {product: true},
               });

               if (!reservation) {
                    throw new NotFoundException(
                         `Reservation with ID ${id} not found`
                    );
               }

               if (reservation.status !== ReservationStatus.ACTIVE) {
                    throw new BadRequestException(
                         `Cannot complete reservation. Current status: ${reservation.status}`
                    );
               }

               // Check if expired
               if (new Date() > reservation.expiresAt) {
                    await tx.reservation.update({
                         where: {id},
                         data: {status: ReservationStatus.EXPIRED},
                    });

                    await this.productsService.incrementStock(
                         reservation.productId,
                         reservation.quantity
                    );

                    throw new BadRequestException("Reservation has expired");
               }

               const updated = await tx.reservation.update({
                    where: {id},
                    data: {status: ReservationStatus.COMPLETED},
               });

               // Remove expiration job if it hasn't run yet
               try {
                    const job = await this.expirationQueue.getJob(
                         `expire-${id}`
                    );
                    if (job) await job.remove();
               } catch (error) {
                    this.logger.warn(
                         `Could not remove expiration job for reservation ${id}:`,
                         error
                    );
               }

               return updated;
          });
     }

     /**
      * Expire a reservation and restore stock (called by the background worker)
      */
     async expire(id: string): Promise<void> {
          await this.prisma.$transaction(async (tx) => {
               const reservation = await tx.reservation.findUnique({
                    where: {id},
               });

               if (!reservation) {
                    this.logger.warn(
                         `Reservation ${id} not found for expiration. It might have been completed or already expired.`
                    );
                    return;
               }

               if (reservation.status === ReservationStatus.ACTIVE) {
                    await tx.reservation.update({
                         where: {id},
                         data: {status: ReservationStatus.EXPIRED},
                    });

                    await this.productsService.incrementStock(
                         reservation.productId,
                         reservation.quantity
                    );

                    this.logger.log(
                         `Expired reservation ${id} and restored ${reservation.quantity} stock for product ${reservation.productId}`
                    );
               } else {
                    this.logger.log(
                         `Reservation ${id} is not active (status: ${reservation.status}), skipping expiration.`
                    );
               }
          });
     }

     /**
      * Module lifecycle hooks for recovery
      */
     async onModuleInit() {
          // Wait for all modules to be fully initialized
          setTimeout(async () => {
               this.logger.log(
                    "Starting reservation recovery on server startup..."
               );
               await this.recoverReservations();
          }, RECOVERY_DELAY_MS);

          // Set up periodic check to catch any missed expirations
          this.periodicCheckInterval = setInterval(() => {
               this.checkExpiredReservations().catch((error) => {
                    this.logger.error(
                         "Error in periodic expiration check:",
                         error
                    );
               });
          }, PERIODIC_CHECK_INTERVAL_MS);

          this.logger.log(
               `Periodic expiration check started (every ${
                    PERIODIC_CHECK_INTERVAL_MS / 1000
               } seconds)`
          );
     }

     async onModuleDestroy() {
          if (this.periodicCheckInterval) {
               clearInterval(this.periodicCheckInterval);
               this.logger.log("Periodic expiration check stopped");
          }
     }

     /**
      * Recover reservations after server restart
      * - Expires reservations that have already expired (based on DB timestamp)
      * - Reschedules jobs for active reservations that haven't expired yet
      */
     async recoverReservations(): Promise<void> {
          try {
               const activeReservations =
                    await this.prisma.reservation.findMany({
                         where: {status: ReservationStatus.ACTIVE},
                    });

               console.log(
                    `Found ${activeReservations.length} active reservations to recover`
               );

               const now = new Date();
               let expiredCount = 0;
               let rescheduledCount = 0;

               for (const reservation of activeReservations) {
                    if (now > reservation.expiresAt) {
                         // Expire immediately
                         console.log(
                              `Expiring reservation ${reservation.id} (expired at ${reservation.expiresAt})`
                         );
                         await this.expire(reservation.id);
                         expiredCount++;
                    } else {
                         // Reschedule expiration job
                         const remainingTime =
                              reservation.expiresAt.getTime() - now.getTime();

                         if (remainingTime > 0) {
                              // Remove any existing job first
                              try {
                                   const existingJob =
                                        await this.expirationQueue.getJob(
                                             `expire-${reservation.id}`
                                        );
                                   if (existingJob) await existingJob.remove();
                              } catch (error) {
                                   console.warn(
                                        `Could not remove expiration job for reservation ${reservation.id}:`,
                                        error
                                   );
                              }

                              // Schedule new expiration job
                              await this.expirationQueue.add(
                                   "expire-reservation",
                                   {reservationId: reservation.id},
                                   {
                                        delay: remainingTime,
                                        jobId: `expire-${reservation.id}`,
                                        attempts: JOB_RETRY_ATTEMPTS,
                                        backoff: {
                                             type: "exponential",
                                             delay: JOB_RETRY_DELAY_MS,
                                        },
                                   }
                              );
                              rescheduledCount++;
                              console.log(
                                   `Rescheduled expiration for reservation ${
                                        reservation.id
                                   } (expires in ${Math.round(
                                        remainingTime / 1000
                                   )}s)`
                              );
                         }
                    }
               }
          } catch (error) {
               this.logger.error("Error during reservation recovery:", error);
          }
     }

     /**
      * Periodic check for expired reservations (backup safety mechanism)
      * Uses DB timestamp to check expiration, not memory-based
      */
     async checkExpiredReservations(): Promise<void> {
          try {
               const now = new Date();

               const expiredReservations =
                    await this.prisma.reservation.findMany({
                         where: {
                              status: ReservationStatus.ACTIVE,
                              expiresAt: {lte: now},
                         },
                    });

               if (expiredReservations.length > 0) {
                    console.log(
                         `Found ${expiredReservations.length} expired reservation(s) during periodic check`
                    );

                    for (const reservation of expiredReservations) {
                         console.log(
                              `Expiring reservation ${reservation.id} (expired at ${reservation.expiresAt})`
                         );
                         await this.expire(reservation.id);
                    }
               }
          } catch (error) {
               console.error("Error during periodic expiration check:", error);
          }
     }
}
