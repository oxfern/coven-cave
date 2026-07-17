declare module "bun" {
  export type ShellOutput = {
    exitCode: number;
    stderr: Buffer;
    stdout: Buffer;
  };

  export type ShellPromise = Promise<ShellOutput> & {
    cwd(directory: string): ShellPromise;
    env(environment: Record<string, string | undefined>): ShellPromise;
    json(): Promise<unknown>;
    nothrow(): ShellPromise;
    quiet(): ShellPromise;
    text(): Promise<string>;
  };

  export type Shell = (
    strings: TemplateStringsArray,
    ...expressions: unknown[]
  ) => ShellPromise;

  export const $: Shell;

  export type Subprocess = {
    exitCode: number | null;
    exited: Promise<number>;
    kill(signal?: NodeJS.Signals): void;
    pid: number;
    stderr: ReadableStream<Uint8Array>;
    stdin: { end(): void; write(chunk: string | Uint8Array): void };
    stdout: ReadableStream<Uint8Array>;
  };
}

declare module "bun:test" {
  export const describe: (name: string, suite: () => void) => void;
  export const expect: (value: unknown) => any;
  export const test: (name: string, testCase: () => unknown | Promise<unknown>) => void;
}

declare namespace Bun {
  type FileHandle = {
    exists(): Promise<boolean>;
    json(): Promise<any>;
    readonly size: number;
    text(): Promise<string>;
  };

  type SpawnOptions = {
    cwd?: string;
    env?: Record<string, string | undefined>;
    stderr?: "ignore" | "inherit" | "pipe" | FileHandle;
    stdin?: "ignore" | "inherit" | "pipe";
    stdout?: "ignore" | "inherit" | "pipe" | FileHandle;
  };

  const argv: string[];
  function file(path: string): FileHandle;
  function sleep(milliseconds: number): Promise<void>;
  function spawn(argv: string[], options?: SpawnOptions): import("bun").Subprocess;
  function write(destination: string | FileHandle, data: string | Uint8Array): Promise<number>;
}

interface ImportMeta {
  readonly dir: string;
}
