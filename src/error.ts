export namespace ApplicationError {
  export class EnvironmentKeyNotProvided extends Error {
    constructor(key?: string) {
      super(`Ключ ${key} не был передан в .env файле`);
    }

    static new = (key: string) => new EnvironmentKeyNotProvided(key) as unknown as new () => EnvironmentKeyNotProvided;
  }
}
