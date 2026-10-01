import { createDirectus, deleteFile, readAssetArrayBuffer, rest, staticToken, uploadFiles } from "@directus/sdk";

export type DirectusFileUpload = { bytes: Uint8Array; filename: string; contentType: string };

export interface DirectusFilesGateway {
  uploadFile(payload: DirectusFileUpload): Promise<string>;
  deleteFile(id: string): Promise<void>;
  readFileBytes(id: string): Promise<Uint8Array>;
}

type DirectusFileRecord = {
  id?: unknown;
};

type DirectusSchema = {
  directus_files: DirectusFileRecord[];
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  return buffer;
}

export function createDirectusFilesGateway(url: string, token: string): DirectusFilesGateway {
  const client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());

  return {
    async uploadFile(payload: DirectusFileUpload) {
      const formData = new FormData();
      const blob = new Blob([toArrayBuffer(payload.bytes)], { type: payload.contentType });

      formData.append("file", blob, payload.filename);

      if (process.env.DIRECTUS_PHOTOS_FOLDER) {
        formData.append("folder", process.env.DIRECTUS_PHOTOS_FOLDER);
      }

      const record = (await client.request(uploadFiles(formData))) as DirectusFileRecord;

      if (typeof record.id !== "string") {
        throw new Error("Uploaded Directus file did not return an id");
      }

      return record.id;
    },

    async deleteFile(id: string) {
      try {
        await client.request(deleteFile(id));
      } catch (error) {
        if (error && typeof error === "object" && "status" in error && error.status === 404) {
          return;
        }
        throw error;
      }
    },

    async readFileBytes(id: string) {
      return new Uint8Array(await client.request(readAssetArrayBuffer(id)));
    },
  };
}
