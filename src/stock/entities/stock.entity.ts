import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Product } from './product.entity';

export type StockDocument = Stock & Document;

@Schema({ timestamps: true })
export class Stock {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, unique: true })
  productId: Types.ObjectId | Product;

  @Prop({ required: true, default: 0, min: 0 })
  quantity: number;
}

export const StockSchema = SchemaFactory.createForClass(Stock);
