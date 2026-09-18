declare module "node:sqlite" {
  export interface StatementResultingChanges {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...bindParameters: unknown[]): StatementResultingChanges;
    get(...bindParameters: unknown[]): unknown;
    all(...bindParameters: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(
      path: string,
      options?: {
        open?: boolean;
        enableForeignKeyConstraints?: boolean;
        readOnly?: boolean;
        timeout?: number;
      },
    );
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
