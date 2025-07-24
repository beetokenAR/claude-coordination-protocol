import { z } from 'zod';
/**
 * Validates input data against a Zod schema
 * Throws ValidationError with detailed information on failure
 */
export declare function validateInput<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T;
/**
 * Safely parses input data, returning default value on failure
 */
export declare function safeParseInput<T>(schema: z.ZodSchema<T>, data: unknown, defaultValue: T): T;
/**
 * Validates that participant IDs are properly formatted
 */
export declare function validateParticipantId(id: string): void;
/**
 * Validates message ID format (e.g., "CONTRACT-001", "ARCH-002")
 */
export declare function validateMessageId(id: string): void;
/**
 * Validates thread ID format
 */
export declare function validateThreadId(id: string): void;
/**
 * Validates file path security (prevent directory traversal)
 */
export declare function validateFilePath(filePath: string): void;
/**
 * Validates that content is not too large for token limits
 */
export declare function validateContentSize(content: string, maxTokens?: number): void;
/**
 * Validates date ranges
 */
export declare function validateDateRange(from?: Date, to?: Date): void;
/**
 * Validates that arrays don't exceed reasonable limits
 */
export declare function validateArraySize<T>(array: T[], maxSize: number, name: string): void;
/**
 * Validates message dependencies don't create cycles
 */
export declare function validateNoCycles(messageId: string, dependencies: string[], getDependencies: (id: string) => string[]): void;
//# sourceMappingURL=validation.d.ts.map