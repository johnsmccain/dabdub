import { Test, TestingModule } from '@nestjs/testing';
import { CustomReportController } from './custom-report.controller';
import { CustomReportService } from './custom-report.service';

describe('CustomReportController', () => {
  let controller: CustomReportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomReportController],
      providers: [CustomReportService],
    }).compile();

    controller = module.get<CustomReportController>(CustomReportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
