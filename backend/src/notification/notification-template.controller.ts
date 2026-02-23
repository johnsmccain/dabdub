import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationTemplateService } from './notification-template.service';
import { UpdateNotificationTemplateDto, PreviewTemplateDto, TestSendDto, ListDeliveriesQueryDto } from './dto/notification-template.dto';

@ApiTags('Notification Templates')
@Controller('api/v1/notifications')
export class NotificationTemplateController {
  constructor(private readonly templateService: NotificationTemplateService) {}

  @Get('templates')
  @ApiOperation({ summary: 'List all templates grouped by channel' })
  async listTemplates() {
    return this.templateService.findAll();
  }

  @Get('templates/:templateKey')
  @ApiOperation({ summary: 'Get template detail' })
  async getTemplate(@Param('templateKey') templateKey: string) {
    return this.templateService.findOne(templateKey);
  }

  @Patch('templates/:templateKey')
  @ApiOperation({ summary: 'Update template' })
  async updateTemplate(
    @Param('templateKey') templateKey: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    const adminId = 'admin-id'; // TODO: Extract from auth context
    return this.templateService.update(templateKey, dto, adminId);
  }

  @Post('templates/:templateKey/preview')
  @ApiOperation({ summary: 'Preview rendered template' })
  async previewTemplate(
    @Param('templateKey') templateKey: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    return this.templateService.preview(templateKey, dto.variables);
  }

  @Post('templates/:templateKey/test-send')
  @ApiOperation({ summary: 'Send test notification' })
  async testSend(
    @Param('templateKey') templateKey: string,
    @Body() dto: TestSendDto,
  ) {
    const adminId = 'admin-id'; // TODO: Extract from auth context
    return this.templateService.testSend(templateKey, dto.recipientEmail, dto.variables, adminId);
  }

  @Get('templates/:templateKey/versions')
  @ApiOperation({ summary: 'Get version history' })
  async getVersions(@Param('templateKey') templateKey: string) {
    return this.templateService.getVersions(templateKey);
  }

  @Post('templates/:templateKey/rollback/:versionId')
  @ApiOperation({ summary: 'Rollback to previous version' })
  async rollback(
    @Param('templateKey') templateKey: string,
    @Param('versionId') versionId: string,
  ) {
    const adminId = 'admin-id'; // TODO: Extract from auth context
    return this.templateService.rollback(templateKey, versionId, adminId);
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'List delivery records' })
  async listDeliveries(@Query() query: ListDeliveriesQueryDto) {
    return this.templateService.findDeliveries(query);
  }

  @Get('deliveries/:id')
  @ApiOperation({ summary: 'Get delivery detail' })
  async getDelivery(@Param('id') id: string) {
    return this.templateService.findDeliveryById(id);
  }

  @Post('deliveries/:id/retry')
  @ApiOperation({ summary: 'Retry failed delivery' })
  async retryDelivery(@Param('id') id: string) {
    return this.templateService.retryDelivery(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get delivery statistics' })
  async getStats() {
    return this.templateService.getStats();
  }
}
