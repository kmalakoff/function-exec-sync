import type { InteropMode, ModuleType } from 'module-compat';

export type ExecWorkerOptions = {
  name?: string;
  cwd?: string;
  env?: object;
  callbacks?: boolean;
  execPath?: string;
  sleep?: number;
  /** Module type detection: 'auto' (default), 'module', or 'commonjs' */
  moduleType?: 'auto' | ModuleType;
  /** How to handle ESM default exports: 'default' (default), 'raw', or 'typescript' */
  interop?: InteropMode;
};
