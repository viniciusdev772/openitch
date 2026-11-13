import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

export async function resolve(specifier, context, next) {
  let target = null;
  if (specifier.startsWith("@/")) target = path.join(SRC, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (target && !path.extname(target) && existsSync(target + ".ts")) {
    return next(pathToFileURL(target + ".ts").href, context);
  }
  if (target && specifier.startsWith("@/")) return next(pathToFileURL(target).href, context);
  return next(specifier, context);
}
