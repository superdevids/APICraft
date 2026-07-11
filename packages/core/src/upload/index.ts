import "reflect-metadata";
import { PARAM_METADATA_KEY } from "../metadata/index.js";

export const UPLOAD_METADATA_KEY = "apicraft:upload";

/**
 * Configuration options for a file upload parameter.
 */
export interface UploadConfig {
  /** Maximum file size as a string (e.g. "5mb", "10mb", "1gb", "500kb") */
  maxSize?: string;
  /** Allowed MIME types (e.g. ["image/jpeg", "image/png", "application/pdf"]) */
  types?: string[];
  /** Directory to save uploaded files (if not using buffer mode) */
  destination?: string;
  /** Whether multiple files are accepted */
  multiple?: boolean;
}

/**
 * Represents a single uploaded file.
 */
export interface UploadedFile {
  /** Form field name */
  fieldname: string;
  /** Original file name as provided by the client */
  originalname: string;
  /** Encoding type (e.g. "7bit") */
  encoding: string;
  /** MIME type (e.g. "image/jpeg") */
  mimetype: string;
  /** File size in bytes */
  size: number;
  /** Raw file buffer (available when not saving to disk) */
  buffer?: Buffer;
  /** File path on disk (available when saved to destination) */
  path?: string;
}

/**
 * Parameter decorator that marks a parameter as a file upload.
 * Registers both upload metadata and standard parameter metadata
 * for the route system.
 *
 * @param name - The form field name to expect
 * @param config - Upload configuration (size limits, allowed types, etc.)
 *
 * @example
 * ```typescript
 * @post("/upload")
 * async uploadFile(@upload("avatar", { maxSize: "5mb", types: ["image/jpeg", "image/png"] }) file: UploadedFile) {
 *   return { filename: file.originalname, size: file.size }
 * }
 *
 * @post("/uploads")
 * async uploadMultiple(@upload("files", { multiple: true }) files: UploadedFile[]) {
 *   return files.map(f => f.originalname)
 * }
 * ```
 */
export function upload(name: string, config?: UploadConfig): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;

    const existingConfig: UploadConfig[] = Reflect.getOwnMetadata(UPLOAD_METADATA_KEY, target, propertyKey) ?? [];
    existingConfig[parameterIndex] = config ?? {};
    Reflect.defineMetadata(UPLOAD_METADATA_KEY, existingConfig, target, propertyKey);

    const paramDefs: any[] = Reflect.getOwnMetadata(PARAM_METADATA_KEY, target, propertyKey) ?? [];
    paramDefs.push({
      kind: "upload",
      name,
      index: parameterIndex,
      type: {
        kind: "object",
        name: "File",
        properties: {
          filename: { kind: "string", name: "string" },
          mimetype: { kind: "string", name: "string" },
          size: { kind: "number", name: "number" },
        },
      },
      required: true,
    });
    Reflect.defineMetadata(PARAM_METADATA_KEY, paramDefs, target, propertyKey);
  };
}

/**
 * Validates uploaded files against size and type constraints.
 */
export class FileValidator {
  /**
   * Check whether a file's size is within the allowed limit.
   *
   * @param file - The uploaded file to check
   * @param maxSize - Maximum size string (e.g. "5mb")
   * @returns `true` if the file size is within the limit
   */
  static validateSize(file: UploadedFile, maxSize: string): boolean {
    const maxBytes = FileValidator.parseMaxSize(maxSize);
    return file.size <= maxBytes;
  }

  /**
   * Check whether a file's MIME type is in the allowed list.
   *
   * @param file - The uploaded file to check
   * @param allowedTypes - List of allowed MIME types (empty list allows everything)
   * @returns `true` if the file type is allowed
   */
  static validateType(file: UploadedFile, allowedTypes: string[]): boolean {
    if (!allowedTypes || allowedTypes.length === 0) return true;
    return allowedTypes.includes(file.mimetype);
  }

  /**
   * Parse a human-readable size string into bytes.
   *
   * @param size - Size string (e.g. "5mb", "10kb", "1gb", "500b")
   * @returns Size in bytes
   * @throws {Error} If the format is invalid
   */
  static parseMaxSize(size: string): number {
    const match = size.match(/^(\d+)\s*(b|kb|mb|gb)$/i);
    if (!match) {
      throw new Error(
        `Invalid max size format: "${size}". Use formats like "5mb", "10kb", "500b", "1gb"`,
      );
    }
    const value = parseInt(match[1], 10);
    if (value < 0) {
      throw new Error("File size cannot be negative");
    }
    const unit = match[2].toLowerCase();
    switch (unit) {
      case "b":
        return value;
      case "kb":
        return value * 1024;
      case "mb":
        return value * 1024 * 1024;
      case "gb":
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }
}

/**
 * Validate an uploaded file against the given upload configuration.
 * Throws on the first validation failure.
 *
 * @param file - The uploaded file to validate
 * @param config - Upload configuration
 * @throws {Error} If any validation check fails
 */
export function validateUploadedFile(file: UploadedFile, config: UploadConfig): void {
  const errors: string[] = [];

  if (config.maxSize && !FileValidator.validateSize(file, config.maxSize)) {
    errors.push(
      `File "${file.originalname}" (${file.size} bytes) exceeds maximum size of ${config.maxSize}`,
    );
  }

  if (config.types && config.types.length > 0 && !FileValidator.validateType(file, config.types)) {
    errors.push(
      `File "${file.originalname}" has unsupported type "${file.mimetype}". ` +
        `Allowed types: ${config.types.join(", ")}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Upload validation failed: ${errors.join("; ")}`);
  }
}
