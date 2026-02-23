import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CustomReportService } from './custom-report.service';
import { CreateCustomReportDto } from './dto/create-custom-report.dto';
import { UpdateCustomReportDto } from './dto/update-custom-report.dto';

@Controller('custom-report')
export class CustomReportController {
  constructor(private readonly customReportService: CustomReportService) {}

  @Post()
  create(@Body() createCustomReportDto: CreateCustomReportDto) {
    return this.customReportService.create(createCustomReportDto);
  }

  @Get()
  findAll() {
    return this.customReportService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customReportService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCustomReportDto: UpdateCustomReportDto) {
    return this.customReportService.update(+id, updateCustomReportDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customReportService.remove(+id);
  }
}
