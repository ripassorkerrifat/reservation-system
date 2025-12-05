import {IsString, IsInt, IsNotEmpty, Min} from "class-validator";

export class CreateReservationDto {
     @IsNotEmpty({message: "Product ID is required"})
     @IsString({message: "Product ID must be a string"})
     productId: string;

     @IsNotEmpty({message: "Quantity is required"})
     @IsInt({message: "Quantity must be an integer"})
     @Min(1, {message: "Quantity must be at least 1"})
     quantity: number;
}
