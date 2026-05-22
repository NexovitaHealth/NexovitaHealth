declare module "ssh2-sftp-client" {
  export default class SftpClient {
    connect(config: Record<string, unknown>): Promise<void>;
    put(
      input: Buffer | string,
      remotePath: string,
      options?: Record<string, unknown>,
    ): Promise<void>;
    list(remotePath: string): Promise<unknown[]>;
    mkdir(remotePath: string, recursive?: boolean): Promise<void>;
    end(): Promise<void>;
  }
}
