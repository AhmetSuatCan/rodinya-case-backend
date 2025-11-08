import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { StockService } from '../stock/stock.service';
import { ORDER_QUEUE_NAME } from './order.constants';

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getQueueToken(ORDER_QUEUE_NAME),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: getModelToken(Order.name),
          useValue: {
            new: jest.fn(),
            constructor: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            deleteOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: StockService,
          useValue: {
            findOneStockWithoutPopulate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
