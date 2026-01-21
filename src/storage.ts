import * as fs from 'fs/promises';
import { resolve } from "path";

export class Storage {
  constructor() {
    console.log(process.cwd());
  }

  public static readonly FILE = resolve(process.cwd(), '/domains.json');

  public static get = (): Promise<Set<string>> => fs.readFile(Storage.FILE, 'utf-8').then(domains => new Set(JSON.parse(domains)))

  public static set = (domains: Set<string>): Promise<void> => fs.writeFile(Storage.FILE, JSON.stringify([...domains.values()], null, 2), 'utf-8')
}
