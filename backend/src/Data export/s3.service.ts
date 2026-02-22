import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PassThrough, Readable } from 'stream';

export interface S3UploadStream {
  stream: PassThrough;
  done: () => Promise<void>;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
    this.bucket = config.get<string>('S3_BUCKET', 'exports-bucket');
  }

  /**
   * Creates a PassThrough stream that pipes data to S3 via multipart upload.
   * Caller writes to stream.stream and awaits stream.done() to finalize.
   */
  createUploadStream(s3Key: string): S3UploadStream {
    const passThrough = new PassThrough();
    const PART_SIZE = 5 * 1024 * 1024; // 5MB minimum for multipart

    const done = this.uploadMultipart(s3Key, passThrough, PART_SIZE);

    return { stream: passThrough, done: () => done };
  }

  private async uploadMultipart(
    s3Key: string,
    readable: Readable,
    partSize: number,
  ): Promise<void> {
    const { UploadId } = await this.s3.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ContentType: 'application/octet-stream',
      }),
    );

    const parts: { ETag: string; PartNumber: number }[] = [];
    let partNumber = 1;
    let buffer = Buffer.alloc(0);

    const uploadPart = async (data: Buffer) => {
      const { ETag } = await this.s3.send(
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: s3Key,
          UploadId,
          PartNumber: partNumber,
          Body: data,
        }),
      );
      parts.push({ ETag: ETag!, PartNumber: partNumber });
      partNumber++;
    };

    try {
      for await (const chunk of readable) {
        buffer = Buffer.concat([buffer, chunk as Buffer]);
        while (buffer.length >= partSize) {
          await uploadPart(buffer.subarray(0, partSize));
          buffer = buffer.subarray(partSize);
        }
      }

      // Upload remaining buffer (last part — can be < 5MB)
      if (buffer.length > 0) {
        await uploadPart(buffer);
      }

      await this.s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: s3Key,
          UploadId,
          MultipartUpload: { Parts: parts },
        }),
      );

      this.logger.log(`Multipart upload completed: ${s3Key}`);
    } catch (err) {
      this.logger.error(`Multipart upload failed: ${s3Key}`, err);
      await this.s3.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: s3Key,
          UploadId,
        }),
      );
      throw err;
    }
  }

  async getObjectSize(s3Key: string): Promise<number> {
    const { ContentLength } = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: s3Key }),
    );
    return ContentLength ?? 0;
  }

  /**
   * Generates a pre-signed GET URL valid for the given duration.
   */
  async getPresignedUrl(s3Key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
