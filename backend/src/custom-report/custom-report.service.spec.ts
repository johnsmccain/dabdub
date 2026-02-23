import { Test, TestingModule } from '@nestjs/testing';
import { CustomReportService } from './custom-report.service';

describe('CustomReportService', () => {
  let service: CustomReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomReportService],
    }).compile();

    service = module.get<CustomReportService>(CustomReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
