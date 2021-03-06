import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const lzjs = require('lzjs');
import { COBOLFileSymbol, globalSymbolFilename, InMemoryGlobalSymbolCache, COBOLGlobalSymbolTable } from './cobolglobalcache';
import { replacer, reviver } from './cobolglobalcache_file';

export class GlobalCachesHelper {
    private static isFileT(sdir: string): [boolean, fs.Stats | undefined] {
        try {
            if (fs.existsSync(sdir)) {
                const f = fs.statSync(sdir);
                if (f && f.isFile()) {
                    return [true, f];
                }
            }
        }
        catch {
            return [false, undefined];
        }
        return [false, undefined];
    }

    public static isGlobalSymbolCacheLoadRequired(cacheDirectory: string): boolean {
        const fn: string = path.join(cacheDirectory, globalSymbolFilename);
        const fnStat = GlobalCachesHelper.isFileT(fn);
        if (fnStat[0]) {
            const stat4cache: fs.Stats = fs.statSync(fn);
            if (stat4cache.mtimeMs !== InMemoryGlobalSymbolCache.lastModifiedTime) {
                return true;
            }
        }

        return false;
    }

    public static loadGlobalSymbolCache(cacheDirectory: string): boolean {

        const fn: string = path.join(cacheDirectory, globalSymbolFilename);
        const fnStat = GlobalCachesHelper.isFileT(fn);
        if (fnStat[0]) {
            const stat4cache: fs.Stats = fs.statSync(fn);
            if (stat4cache.mtimeMs !== InMemoryGlobalSymbolCache.lastModifiedTime) {
                try {
                    const str: string = fs.readFileSync(fn).toString();
                    const cachableTable: COBOLGlobalSymbolTable = JSON.parse(lzjs.decompress(str), reviver);
                    InMemoryGlobalSymbolCache.callableSymbols = cachableTable.callableSymbols;
                    InMemoryGlobalSymbolCache.sourceFilenameModified = cachableTable.sourceFilenameModified;
                    InMemoryGlobalSymbolCache.lastModifiedTime = stat4cache.mtimeMs;
                    InMemoryGlobalSymbolCache.isDirty = false;
                    return true;
                }
                catch (e) {
                    try {
                        fs.unlinkSync(fn);
                    }
                    catch {
                        //continue
                    }
                    return false;
                }
            }
        }
        return false;
    }

    public static saveGlobalCache(cacheDirectory: string): void {
        if (InMemoryGlobalSymbolCache.isDirty) {
            const fnGlobalSymbolFilename: string = path.join(cacheDirectory, globalSymbolFilename);
            fs.writeFileSync(fnGlobalSymbolFilename, lzjs.compress(JSON.stringify(InMemoryGlobalSymbolCache, replacer)));
            InMemoryGlobalSymbolCache.isDirty = false;
        }
    }


    private static addSymbolToCache(srcfilename: string, symbolUnchanged: string, lineNumber: number, symbolsCache: Map<string, COBOLFileSymbol[]>) {
        const symbol = symbolUnchanged.toLowerCase();
        if (symbolsCache.has(symbol)) {
            const symbolList: COBOLFileSymbol[] | undefined = symbolsCache.get(symbol);

            /* search the list of COBOLFileSymbols */
            if (symbolList !== undefined) {
                let found = false;
                for (let i = 0; i < symbolList.length; i++) {
                    if (symbolList[i].filename === srcfilename && symbolList[i].lnum === lineNumber) {
                        found = true;
                        break;
                    }
                }
                // not found?
                if (found === false) {
                    symbolList.push(new COBOLFileSymbol(srcfilename, lineNumber));
                    InMemoryGlobalSymbolCache.isDirty = true;
                }
            }
        }
        const symbolList = [];
        symbolList.push(new COBOLFileSymbol(srcfilename, lineNumber));
        symbolsCache.set(symbol, symbolList);
        InMemoryGlobalSymbolCache.isDirty = true;
        return;
    }

    public static addClassSymbol(srcfilename: string, symbolUnchanged: string, lineNumber: number): void {
        const symbolsCache = InMemoryGlobalSymbolCache.classSymbols;

        GlobalCachesHelper.addSymbolToCache(srcfilename, symbolUnchanged, lineNumber, symbolsCache);
    }


    public static addMethodSymbol(srcfilename: string, symbolUnchanged: string, lineNumber: number): void {
        const symbolsCache = InMemoryGlobalSymbolCache.methodSymbols;
        GlobalCachesHelper.addSymbolToCache(srcfilename, symbolUnchanged, lineNumber, symbolsCache);
    }


    public static addSymbol(srcfilename: string, symbolUnchanged: string, lineNumber: number): void {
        const symbolsCache = InMemoryGlobalSymbolCache.callableSymbols;
        GlobalCachesHelper.addSymbolToCache(srcfilename, symbolUnchanged, lineNumber, symbolsCache);
    }

    public static getGlobalSymbolCache(): COBOLGlobalSymbolTable {
        return InMemoryGlobalSymbolCache;
    }

    public static addFilename(filename: string, lastModified: number): void {
        if (InMemoryGlobalSymbolCache.sourceFilenameModified.has(filename)) {
            InMemoryGlobalSymbolCache.sourceFilenameModified.delete(filename);
            InMemoryGlobalSymbolCache.sourceFilenameModified.set(filename, lastModified);
        } else {
            InMemoryGlobalSymbolCache.sourceFilenameModified.set(filename, lastModified);
        }
    }
}
