export const BASELINE_VERSION: bigint;
export const MIGRATION_FILE: RegExp;
export function parseMigrationName(fileName: string): { version: string; name: string } | null;
export function isAfterBaseline(version: string): boolean;
export function stripSql(text: string): string;
export function lintMigrationSql(sql: string): string[];
export function lintMigrationsDir(dir: string): { file: string; problems: string[] }[];
