import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Product } from './product.entity';

export type StockDocument = Stock & Document;

@Schema({ 
  timestamps: true,
  versionKey: '__v' // Explicitly enable versioning for optimistic locking
})
export class Stock {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, unique: true })
  productId: Types.ObjectId | Product;

  @Prop({ required: true, default: 0, min: 0 })
  quantity: number;

  // Explicit version field for optimistic locking
  __v?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StockSchema = SchemaFactory.createForClass(Stock);
