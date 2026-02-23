import { Injectable } from '@nestjs/common';
import { CreateCustomReportDto } from './dto/create-custom-report.dto';
import { UpdateCustomReportDto } from './dto/update-custom-report.dto';

@Injectable()
export class CustomReportService {
  create(createCustomReportDto: CreateCustomReportDto) {
    return 'This action adds a new customReport';
  }

  findAll() {
    return `This action returns all customReport`;
  }

  findOne(id: number) {
    return `This action returns a #${id} customReport`;
  }

  update(id: number, updateCustomReportDto: UpdateCustomReportDto) {
    return `This action updates a #${id} customReport`;
  }

  remove(id: number) {
    return `This action removes a #${id} customReport`;
  }
}
