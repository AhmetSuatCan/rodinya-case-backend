import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderProcessor } from './order.processor';
import { OrderDLQProcessor } from './order-dlq.processor';
import { ORDER_QUEUE_NAME } from './order.constants';
import { Order, OrderSchema } from './entities/order.entity';
import { StockModule } from '../stock/stock.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    BullModule.registerQueue({
      name: ORDER_QUEUE_NAME,
    }),
    BullModule.registerFlowProducer({
      name: ORDER_QUEUE_NAME,
    }),
    BullBoardModule.forFeature({
      name: ORDER_QUEUE_NAME,
      adapter: BullMQAdapter,
    }),
    StockModule,
    AuthModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderProcessor, OrderDLQProcessor],
})
export class OrderModule {}
