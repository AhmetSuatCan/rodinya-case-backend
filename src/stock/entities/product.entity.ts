import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  description?: string;

  @Prop({ type: [String] })
  images?: string[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
