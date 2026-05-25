import { createHash, createHmac } from "node:crypto";

export type S3ObjectTarget = {
  host: string;
  requestUrl: string;
  canonicalUri: string;
  region: string;
};

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function hashBuffer(data: Buffer | string) {
  const hash = createHash("sha256");
  if (typeof data === "string") hash.update(data, "utf8");
  else hash.update(data);
  return hash.digest("hex");
}

function amzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function signKey(secret: string, dateStamp: string, region: string) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function encodePath(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/** Resolve host + URI for AWS S3, Cloudflare R2, or GCS S3-interop. */
export function resolveS3ObjectTarget(
  bucket: string,
  key: string,
  region: string,
): S3ObjectTarget {
  const customEndpoint = process.env.S3_ENDPOINT?.trim();
  const signingRegion = region || process.env.AWS_REGION || "auto";

  if (customEndpoint) {
    const url = new URL(
      customEndpoint.includes("://")
        ? customEndpoint
        : `https://${customEndpoint}`,
    );
    const pathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";
    const encodedKey = encodePath(key);

    if (pathStyle) {
      const canonicalUri = `/${bucket}/${encodedKey}`;
      return {
        host: url.host,
        requestUrl: `${url.origin}${canonicalUri}`,
        canonicalUri,
        region: signingRegion,
      };
    }

    const host = `${bucket}.${url.host}`;
    const canonicalUri = `/${encodedKey}`;
    return {
      host,
      requestUrl: `${url.protocol}//${host}${canonicalUri}`,
      canonicalUri,
      region: signingRegion,
    };
  }

  const host = `${bucket}.s3.${signingRegion}.amazonaws.com`;
  const canonicalUri = `/${encodePath(key)}`;
  return {
    host,
    requestUrl: `https://${host}${canonicalUri}`,
    canonicalUri,
    region: signingRegion,
  };
}

async function signedS3Request(params: {
  method: "GET" | "PUT" | "DELETE";
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  body?: Buffer;
  contentType?: string;
}) {
  const now = new Date();
  const amz = amzDate(now);
  const dateStamp = amz.slice(0, 8);
  const target = resolveS3ObjectTarget(params.bucket, params.key, params.region);
  const payloadHash = hashBuffer(params.body ?? "");

  const headerLines = [`host:${target.host}`, `x-amz-content-sha256:${payloadHash}`, `x-amz-date:${amz}`];
  const signedHeaderNames = ["host", "x-amz-content-sha256", "x-amz-date"];

  if (params.contentType) {
    headerLines.unshift(`content-type:${params.contentType}`);
    signedHeaderNames.unshift("content-type");
  }

  const canonicalHeaders = `${headerLines.join("\n")}\n`;
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    params.method,
    target.canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${target.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    hashBuffer(canonicalRequest),
  ].join("\n");

  const signature = hmac(
    signKey(params.secretAccessKey, dateStamp, target.region),
    stringToSign,
  ).toString("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    Authorization: authorization,
    "x-amz-date": amz,
    "x-amz-content-sha256": payloadHash,
  };
  if (params.contentType) headers["Content-Type"] = params.contentType;

  const res = await fetch(target.requestUrl, {
    method: params.method,
    headers,
    body: params.body ? new Uint8Array(params.body) : undefined,
  });

  return res;
}

export async function s3PutObject(params: {
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  body: Buffer;
  contentType: string;
}) {
  const res = await signedS3Request({
    method: "PUT",
    ...params,
    contentType: params.contentType,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function s3GetObject(params: {
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  const res = await signedS3Request({ method: "GET", ...params });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 read failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    buffer,
    mimeType: res.headers.get("content-type") ?? undefined,
  };
}

export async function s3DeleteObject(params: {
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  await signedS3Request({ method: "DELETE", ...params }).catch(() => {});
}

function getS3Credentials() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION || "auto";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required when using object storage",
    );
  }
  return { bucket, region, accessKeyId, secretAccessKey };
}

export async function putS3Object(
  key: string,
  body: Buffer,
  contentType: string,
) {
  const cfg = getS3Credentials();
  await s3PutObject({ ...cfg, key, body, contentType });
}

export async function readS3Object(key: string) {
  const cfg = getS3Credentials();
  return s3GetObject({ ...cfg, key });
}

export async function deleteS3Object(key: string) {
  const cfg = getS3Credentials();
  await s3DeleteObject({ ...cfg, key });
}
