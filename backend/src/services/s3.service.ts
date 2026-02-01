import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const getBucketName = () => env.AWS_S3_BUCKET;

export const uploadBuffer = async (params: {
  key: string;
  body: Buffer;
  contentType: string;
}) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  return {
    bucket: env.AWS_S3_BUCKET,
    key: params.key,
    url: `s3://${env.AWS_S3_BUCKET}/${params.key}`,
  };
};

export const getSignedUrlForKey = async (params: { key: string; expiresInSeconds?: number }) => {
  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: params.key,
  });
  return getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds ?? 900 });
};
