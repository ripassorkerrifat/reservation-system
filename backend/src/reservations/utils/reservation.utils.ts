import {PrismaClient} from "@prisma/client";
import {Queue} from "bullmq";
import {Logger} from "@nestjs/common";
import {
     ReservationStatus,
     JOB_RETRY_ATTEMPTS,
     JOB_RETRY_DELAY_MS,
} from "../../common/constants";

/**
 * Expire multiple reservations and restore stock
 */
export async function expireReservationsAndRestoreStock(
     prisma: PrismaClient,
     reservations: Array<{id: string; productId: string; quantity: number}>,
     productId: string
): Promise<void> {
     if (reservations.length === 0) return;

     const totalQuantity = reservations.reduce(
          (sum, res) => sum + res.quantity,
          0
     );

     // Update all reservations to EXPIRED in batch
     await prisma.reservation.updateMany({
          where: {
               id: {in: reservations.map((r) => r.id)},
          },
          data: {status: ReservationStatus.EXPIRED},
     });

     // Restore stock in one operation
     await prisma.product.update({
          where: {id: productId},
          data: {
               availableStock: {increment: totalQuantity},
          },
     });
}

/**
 * Schedule expiration job for a reservation
 */
export async function scheduleExpirationJob(
     queue: Queue,
     reservationId: string,
     expiresAt: Date,
     logger: Logger
): Promise<void> {
     try {
          const existingJob = await queue.getJob(`expire-${reservationId}`);
          if (existingJob) {
               logger.log(
                    `Expiration job already exists for reservation ${reservationId}`
               );
               return;
          }

          const now = new Date();
          const delay = Math.max(0, expiresAt.getTime() - now.getTime());

          if (delay > 0) {
               await queue.add(
                    "expire-reservation",
                    {reservationId},
                    {
                         delay,
                         jobId: `expire-${reservationId}`,
                         attempts: JOB_RETRY_ATTEMPTS,
                         backoff: {
                              type: "exponential",
                              delay: JOB_RETRY_DELAY_MS,
                         },
                    }
               );
               logger.log(
                    `Scheduled expiration job for reservation ${reservationId} (expires in ${Math.round(
                         delay / 1000
                    )}s)`
               );
          }
     } catch (error) {
          logger.error(
               `Error scheduling expiration job for reservation ${reservationId}:`,
               error
          );
     }
}
