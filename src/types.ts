export type ExecWorkerOptions = {
  name?: string;
  cwd?: string;
  env?: object;
  callbacks?: boolean;
  execPath?: string;
  sleep?: number;
};
