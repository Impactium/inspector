export namespace Utils {
  export function _throw(Exception: new () => Error): never {
    // @ts-ignore
    throw Exception;
  }

  export const escapeHtml = (string: string): string => string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
