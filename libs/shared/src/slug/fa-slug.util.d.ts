export declare const FA_SLUG_REGEX: RegExp;
export declare const FA_SLUG_MAX_LENGTH = 200;
export declare function clampFaSlug(slug: string): string;
export declare function normalizeFaText(input: string): string;
export declare function makeFaSlug(input: string): string;
export declare function safeDecodeSlug(raw: string): string;
