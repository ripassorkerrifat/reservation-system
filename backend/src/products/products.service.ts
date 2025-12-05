import {Injectable, NotFoundException, Logger} from "@nestjs/common";
import {PrismaService} from "../prisma/prisma.service";

@Injectable()
export class ProductsService {
     private readonly logger = new Logger(ProductsService.name);

     constructor(private prisma: PrismaService) {}

     async findAll() {
          return this.prisma.product.findMany();
     }

     /**
      * Decrement stock for a product (transaction-safe)
      */
     async decrementStock(productId: string, quantity: number) {
          return this.prisma.$transaction(async (tx) => {
               const product = await tx.product.findUnique({
                    where: {id: productId},
               });

               if (!product) {
                    throw new NotFoundException(
                         `Product with ID ${productId} not found`
                    );
               }

               if (product.availableStock < quantity) {
                    throw new Error(
                         `Insufficient stock. Available: ${product.availableStock}, Requested: ${quantity}`
                    );
               }

               return tx.product.update({
                    where: {id: productId},
                    data: {
                         availableStock: {decrement: quantity},
                    },
               });
          });
     }

     /**
      * Increment stock for a product
      */
     async incrementStock(productId: string, quantity: number) {
          return this.prisma.product.update({
               where: {id: productId},
               data: {
                    availableStock: {increment: quantity},
               },
          });
     }
}
