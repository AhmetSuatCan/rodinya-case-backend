import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: false })
  isVIP: boolean;

  @Prop()
  refreshToken: string;

  // TODO: Add these relationships in the future
  // @Prop({ type: [{ type: Types.ObjectId, ref: 'Session' }] })
  // sessions: Types.ObjectId[];

  // @Prop({ type: [{ type: Types.ObjectId, ref: 'Order' }] })
  // orders: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  
  const saltRounds = 10;
  this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
  next();
});

// Hash refresh token before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('refreshToken') || !this.refreshToken) return next();
  
  const saltRounds = 10;
  this.refreshToken = await bcrypt.hash(this.refreshToken, saltRounds);
  next();
});
