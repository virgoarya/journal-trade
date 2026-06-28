import fs from 'fs';
export const silentLogger = {
  debug: (msg?: any, ...args: any[]) => fs.appendFileSync('debug.log', `[DEBUG] ${msg} ${args.map(a => JSON.stringify(a)).join(' ')}\n`),
  info: (msg?: any, ...args: any[]) => fs.appendFileSync('debug.log', `[INFO] ${msg} ${args.map(a => JSON.stringify(a)).join(' ')}\n`),
  warn: (msg?: any, ...args: any[]) => fs.appendFileSync('debug.log', `[WARN] ${msg} ${args.map(a => JSON.stringify(a)).join(' ')}\n`),
  error: (msg?: any, ...args: any[]) => fs.appendFileSync('debug.log', `[ERROR] ${msg} ${args.map(a => JSON.stringify(a)).join(' ')}\n`),
};
