declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MAIL_ENCRYPTION_KEY?: string;
  }
}
