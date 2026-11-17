import type { StorageProvider } from "@stylaiize/shared";

export interface UploadInput {
  /** Original filename for extension + content-type inference. */
  filename: string;
  /** MIME type of the file. */
  mimeType: string;
  buffer: Buffer;
  /** Optional destination folder/tag. */
  folder?: string;
}

export interface UploadResult {
  url: string;
  publicId: string;
  provider: StorageProvider;
}

export interface StorageProviderPort {
  readonly provider: StorageProvider;
  readonly isConfigured: boolean;
  upload(input: UploadInput): Promise<UploadResult>;
  /** Remove a previously uploaded asset by its public id. */
  delete(publicId: string): Promise<void>;
}
