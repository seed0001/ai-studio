import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const CONTENT_TYPE_BY_FORMAT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

export async function uploadAudio(
  key: string,
  body: Buffer,
  format: string,
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: CONTENT_TYPE_BY_FORMAT[format] ?? "application/octet-stream",
    }),
  );

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
