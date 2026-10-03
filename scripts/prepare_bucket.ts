import { infrai } from "../src/infrai_storage";

const bucket = process.env.PRIVATE_FILES_BUCKET ?? "fintech-customer-files";
await infrai.storage.bucket.create(bucket);
console.log(`Private bucket ready: ${bucket}`);
